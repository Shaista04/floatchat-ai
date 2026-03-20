"""
Interactive test script for the FloatChat-AI RAG Pipeline.

Usage (run from ANY directory):
    python /path/to/floatchat-ai/tests/test_rag_pipeline.py
    python tests/test_rag_pipeline.py              # from project root
    python tests/test_rag_pipeline.py batch        # predefined test queries

The MCP server starts ONCE and stays alive for all queries (fast!).
Visualization charts are automatically saved to viz_output/.
Type 'quit' or 'exit' to stop.
"""
import sys
import os
import asyncio
import json
from pathlib import Path

# Auto-detect project root and add to sys.path (works from any directory)
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from rag.pipeline import RagPipeline
from rag.config import LLM_MODEL, OLLAMA_BASE_URL

# Visualization output directory (relative to project root)
VIZ_OUTPUT_DIR = os.path.join(PROJECT_ROOT, "viz_output")
Path(VIZ_OUTPUT_DIR).mkdir(parents=True, exist_ok=True)


def _print_result(result: dict):
    """Pretty-print a chat result, including any generated chart images."""
    print(f"\n🤖 Agent: {result['text']}\n")

    # Show generated chart images with full paths
    if result.get("images"):
        print("=" * 50)
        print("📊 GENERATED VISUALIZATIONS")
        print(f"   Output folder: {VIZ_OUTPUT_DIR}")
        print("-" * 50)
        for img_path in result["images"]:
            filename = os.path.basename(img_path)
            size_kb = os.path.getsize(img_path) / 1024 if os.path.isfile(img_path) else 0
            print(f"   🖼️  {filename}  ({size_kb:.1f} KB)")
            print(f"       → {img_path}")
        print("=" * 50)
        print(f"\n💡 Open the images from: {VIZ_OUTPUT_DIR}")
        print()

    # Show UI Intents (for frontend developers)
    if result.get("ui_intents"):
        print("📐 UI Intents (for frontend rendering):")
        print(json.dumps(result["ui_intents"], indent=2))
        print()


async def interactive_test():
    print("=" * 60)
    print("  FloatChat-AI — RAG Pipeline Interactive Tester")
    print("=" * 60)
    print(f"  LLM Model  : {LLM_MODEL}")
    print(f"  Ollama URL : {OLLAMA_BASE_URL}")
    print(f"  Viz Output : {VIZ_OUTPUT_DIR}")
    print("=" * 60)

    pipeline = RagPipeline(verbose=True)

    print("\n⏳ Starting MCP server (one-time startup, may take ~15s)...")

    async with pipeline.session() as session:
        # List available tools
        try:
            tools = await session.list_tools()
            print(f"✅ {len(tools)} tools loaded:")
            for t in tools:
                print(f"   • {t['name']}")
        except Exception as e:
            print(f"❌ Failed to load tools: {e}")
            return

        print("\n" + "-" * 60)
        print("MCP server is running. Type a question below.")
        print("Visualization queries will save charts to viz_output/")
        print("Type 'quit' to exit.\n")

        while True:
            try:
                user_input = input("You: ").strip()
            except (EOFError, KeyboardInterrupt):
                print("\nGoodbye!")
                break

            if not user_input:
                continue
            if user_input.lower() in ['quit', 'exit', 'q']:
                print("Goodbye!")
                break

            print("-" * 40)
            try:
                result = await session.chat(user_input)
                print("-" * 40)
                _print_result(result)
            except Exception as e:
                print(f"\n❌ Error: {e}\n")
                import traceback
                traceback.print_exc()


async def batch_test():
    """Run a predefined set of test queries with persistent session."""
    print("=" * 60)
    print("  FloatChat-AI — Batch Test")
    print("=" * 60)
    print(f"  Viz Output : {VIZ_OUTPUT_DIR}")
    print("=" * 60)

    pipeline = RagPipeline(verbose=True)

    test_queries = [
        "How many floats do we have in the database?",
        "Tell me about float 1900121",
        "Show me the trajectory of float 2902198",
    ]

    print("\n⏳ Starting MCP server...")

    async with pipeline.session() as session:
        tools = await session.list_tools()
        print(f"✅ {len(tools)} tools loaded.\n")

        for i, query in enumerate(test_queries, 1):
            print(f"{'=' * 60}")
            print(f"Test {i}/{len(test_queries)}: {query}")
            print("=" * 60)

            try:
                result = await session.chat(query)
                _print_result(result)
            except Exception as e:
                print(f"❌ Error: {e}")

            print()

    # Summary of all generated images
    all_images = list(Path(VIZ_OUTPUT_DIR).glob("*.png"))
    if all_images:
        print("=" * 60)
        print(f"📊 All charts in {VIZ_OUTPUT_DIR}:")
        for img in sorted(all_images):
            size_kb = img.stat().st_size / 1024
            print(f"   🖼️  {img.name}  ({size_kb:.1f} KB)")
        print("=" * 60)

    print("✅ All tests complete.")


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "interactive"

    if mode == "batch":
        asyncio.run(batch_test())
    else:
        asyncio.run(interactive_test())
