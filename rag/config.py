import os

# LLM Configuration
LLM_MODEL = os.getenv("LLM_MODEL", "llama3:8b")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

# MCP Server Configuration
VENV_PYTHON = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".venv", "bin", "python"))
MCP_SERVER_SCRIPT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "mcp_server", "server.py"))

# ReAct loop
MAX_ITERATIONS = 12
