from mcp.server.fastmcp import FastMCP
from mcp_server.tools import register_all_tools

# Initialize the FastMCP Server
mcp = FastMCP("FloatChat-AI")

# Register all MongoDB and ChromaDB tools
register_all_tools(mcp)

if __name__ == "__main__":
    # Start the standard stdio server loop
    mcp.run()
