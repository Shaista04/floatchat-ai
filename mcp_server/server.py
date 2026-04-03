"""
MCP Server for FloatChat-AI

This server implements the MCP (Model Context Protocol) specification for FloatChat-AI,
exposing two tool categories:
  1. Data Retrieval Tools - Query MongoDB + ChromaDB, return structured data/JSON
  2. Visualization Tools - Return UI intent objects for React frontend rendering

All tools query the exact schema ingested in Phase 1 and follow the architecture
defined in mcp_tools_enhanced.md.
"""

from mcp.server.fastmcp import FastMCP
from mcp_server.tools import register_all_tools

# Initialize the FastMCP Server
mcp = FastMCP("FloatChat-AI")

# Register all MongoDB and ChromaDB tools
register_all_tools(mcp)

if __name__ == "__main__":
    # Start the standard stdio server loop
    mcp.run()
