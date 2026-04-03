"""
RAG Pipeline for FloatChat-AI
Uses a manual ReAct loop to work with llama3:8b (no native tool calling).

The LLM outputs Thought/Action/Action Input as text, which we parse and
execute against the MCP Server tools via stdio. Stop sequences prevent
the LLM from hallucinating fake results.

When a visualization tool returns a ui_intent, the pipeline automatically
renders an actual matplotlib chart and returns the image path.
"""
import asyncio
import os
import re
import json
from contextlib import asynccontextmanager

from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from .config import LLM_MODEL, OLLAMA_BASE_URL, VENV_PYTHON, MAX_ITERATIONS
from .prompts import SYSTEM_PROMPT


class RagPipeline:
    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.llm = ChatOllama(
            model=LLM_MODEL,
            base_url=OLLAMA_BASE_URL,
            temperature=0.0,
            num_predict=400,
            stop=[
                "Observation:",
                "Observation :",
                "\nResult:",
                "\nOutput:",
                "\nResponse:",
                "\nNote:",
                "\nPlease wait",
            ],
        )

    def _log(self, msg):
        if self.verbose:
            print(f"  [DEBUG] {msg}")

    @asynccontextmanager
    async def _mcp_connect(self):
        """Spawn the FastMCP server as a subprocess and yield the MCP session."""
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        server_params = StdioServerParameters(
            command=VENV_PYTHON,
            args=["-m", "mcp_server.server"],
            env={**os.environ, "PYTHONPATH": project_root},
        )
        async with stdio_client(server_params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                yield session

    @asynccontextmanager
    async def session(self):
        """Persistent session — keeps MCP server alive for multiple queries."""
        async with self._mcp_connect() as mcp_session:
            self._persistent_session = mcp_session
            try:
                yield self
            finally:
                self._persistent_session = None

    async def _call_tool(self, session: ClientSession, tool_name: str, tool_args: dict) -> str:
        """Execute a single MCP tool and return its text result."""
        try:
            result = await session.call_tool(tool_name, tool_args)
            texts = []
            for block in result.content:
                if hasattr(block, "text"):
                    texts.append(block.text)
            return "\n".join(texts) if texts else "Tool returned no output."
        except Exception as e:
            return f"Error calling tool '{tool_name}': {str(e)}"

    def _fix_json(self, raw: str) -> dict:
        """Parse JSON from the LLM, handling common issues."""
        raw = raw.strip()

        # Try direct parse
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            pass

        # Fix Python booleans and None
        fixed = raw
        fixed = re.sub(r'\bTrue\b', 'true', fixed)
        fixed = re.sub(r'\bFalse\b', 'false', fixed)
        fixed = re.sub(r'\bNone\b', 'null', fixed)
        # Fix single quotes to double quotes
        fixed = fixed.replace("'", '"')

        try:
            return json.loads(fixed)
        except json.JSONDecodeError:
            pass

        # Try to extract just the JSON object (handle trailing text)
        brace_match = re.search(r'\{.*\}', fixed, re.DOTALL)
        if brace_match:
            try:
                return json.loads(brace_match.group(0))
            except json.JSONDecodeError:
                pass

        self._log(f"Could not parse JSON: {raw[:200]}")
        return {}

    def _extract_json_block(self, text: str, start_pos: int) -> str:
        """Extract a balanced JSON block starting from a '{' at start_pos."""
        if start_pos >= len(text) or text[start_pos] != '{':
            return "{}"
        depth = 0
        in_string = False
        escape = False
        for i in range(start_pos, len(text)):
            c = text[i]
            if escape:
                escape = False
                continue
            if c == '\\':
                escape = True
                continue
            if c == '"' and not escape:
                in_string = not in_string
            if in_string:
                continue
            if c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    return text[start_pos:i+1]
        # Unbalanced — return what we have
        return text[start_pos:] + "}"

    def _parse_action(self, llm_output: str):
        """
        Parse the LLM's ReAct output.
        Returns: (action_name, action_args, final_answer)
        Action always takes priority over Final Answer.
        """
        # Parse Action first (takes priority)
        action_match = re.search(r"Action:\s*(\w+)", llm_output)
        if action_match:
            action = action_match.group(1).strip()

            # Find Action Input JSON — handle nested braces properly
            input_marker = re.search(r"Action Input:\s*", llm_output)
            if input_marker:
                json_start = llm_output.find("{", input_marker.end())
                if json_start >= 0:
                    json_str = self._extract_json_block(llm_output, json_start)
                    args = self._fix_json(json_str)
                else:
                    args = {}
            else:
                args = {}

            return action, args, None

        # No Action — check for Final Answer
        final_match = re.search(r"Final Answer:\s*(.*)", llm_output, re.DOTALL)
        if final_match:
            return None, None, final_match.group(1).strip()

        # Neither — treat the entire output as the final answer
        return None, None, llm_output.strip()

    async def chat(self, user_query: str) -> dict:
        """
        Run the ReAct loop.
        Returns: {
            "text": str,           # The agent's final text answer
            "ui_intents": list,    # Raw ui_intent dicts for the frontend
            "images": list,        # Absolute paths to generated chart images
        }
        """
        if hasattr(self, '_persistent_session') and self._persistent_session:
            return await self._run_react(self._persistent_session, user_query)
        else:
            async with self._mcp_connect() as session:
                return await self._run_react(session, user_query)

    async def _run_react(self, session: ClientSession, user_query: str) -> dict:
        """Core ReAct loop."""
        messages = [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=user_query),
        ]

        ui_intents = []
        images = []
        seen_actions = set()  # Track action+args to detect loops

        for iteration in range(MAX_ITERATIONS):
            self._log(f"--- Iteration {iteration + 1} ---")

            response = await self.llm.ainvoke(messages)
            llm_text = response.content.strip()
            self._log(f"LLM output:\n{llm_text}")

            action, args, final_answer = self._parse_action(llm_text)

            # Final Answer → done
            if action is None and final_answer is not None:
                self._log("Final Answer detected.")
                return {"text": final_answer, "ui_intents": ui_intents, "images": images}

            if action:
                # Detect tool call loops (same action + same args)
                action_key = f"{action}:{json.dumps(args, sort_keys=True)}"
                if action_key in seen_actions:
                    self._log(f"Loop detected: {action} called with same args again. Breaking.")
                    return {
                        "text": f"I was unable to complete this request. The tool '{action}' didn't return useful results. Please try rephrasing your question.",
                        "ui_intents": ui_intents,
                        "images": images,
                    }
                seen_actions.add(action_key)

                self._log(f"Calling tool: {action}({json.dumps(args)})")
                observation = await self._call_tool(session, action, args)
                self._log(f"Tool result: {observation[:500]}")

                # Collect ui_intents and auto-render images
                try:
                    obs_json = json.loads(observation)
                    if isinstance(obs_json, dict) and "ui_intent" in obs_json:
                        intent = obs_json["ui_intent"]
                        ui_intents.append(intent)

                        # Auto-render the visualization chart
                        try:
                            from .visualizer import render_from_intent
                            img_path = render_from_intent(intent)
                            if img_path and os.path.isfile(img_path):
                                images.append(img_path)
                                self._log(f"Chart saved: {img_path}")
                        except Exception as viz_err:
                            self._log(f"Visualization error: {viz_err}")
                except (json.JSONDecodeError, TypeError):
                    pass

                # Truncate LLM output to only Thought+Action+ActionInput
                input_marker = re.search(r"Action Input:\s*", llm_text)
                if input_marker:
                    json_start = llm_text.find("{", input_marker.end())
                    if json_start >= 0:
                        json_block = self._extract_json_block(llm_text, json_start)
                        clean_llm = llm_text[:json_start] + json_block
                    else:
                        clean_llm = llm_text.strip()
                else:
                    clean_llm = llm_text.strip()

                messages.append(AIMessage(content=clean_llm.strip()))
                messages.append(HumanMessage(content=f"Observation: {observation}"))
            else:
                self._log("No action or final answer parsed.")
                return {"text": llm_text, "ui_intents": ui_intents, "images": images}

        return {
            "text": "I ran out of steps. Please try a more specific query.",
            "ui_intents": ui_intents,
            "images": images,
        }

    async def list_tools(self) -> list:
        """List all available MCP tools."""
        if hasattr(self, '_persistent_session') and self._persistent_session:
            result = await self._persistent_session.list_tools()
        else:
            async with self._mcp_connect() as session:
                result = await session.list_tools()
        return [{"name": t.name, "description": t.description} for t in result.tools]


if __name__ == "__main__":
    async def test():
        pipeline = RagPipeline(verbose=True)

        print(f"=== FloatChat-AI RAG Pipeline Test ===")
        print(f"LLM: {LLM_MODEL} @ {OLLAMA_BASE_URL}\n")

        async with pipeline.session() as s:
            print("Loading MCP tools...")
            tools = await s.list_tools()
            for t in tools:
                print(f"  • {t['name']}")
            print()

            q = "How many floats do we have in the database?"
            print(f"User: {q}")
            print("-" * 50)
            result = await s.chat(q)
            print("-" * 50)
            print(f"Agent: {result['text']}")
            if result.get("images"):
                for img in result["images"]:
                    print(f"📊 Chart: {img}")

    asyncio.run(test())
