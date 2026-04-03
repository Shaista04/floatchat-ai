"""
Programmatic test for the MCP Server tools.

Usage (run from ANY directory):
    python /path/to/floatchat-ai/tests/test_mcp.py
    python tests/test_mcp.py                        # from project root
"""
import sys
import os
import asyncio

# Auto-detect project root and add to sys.path (works from any directory)
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from mcp_server.server import mcp


async def test_tools():
    print("Testing MCP Server Tools...")

    # 1. Test get_dataset_metadata (no args)
    print("\n[1] Testing get_dataset_metadata()...")
    res = await mcp.call_tool("get_dataset_metadata", {})
    print(f"Result: {res}")

    # 2. Test get_nearest_floats (geo query)
    print("\n[2] Testing get_nearest_floats(lat=10.0, lon=60.0, max_distance_km=200)...")
    res = await mcp.call_tool("get_nearest_floats", {"lat": 10.0, "lon": 60.0, "max_distance_km": 200})
    print(f"Result: {res}")

    # 3. Test visualize_float_trajectory (UI intent)
    print("\n[3] Testing visualize_float_trajectory(...)...")
    from mcp_server.config import MONGO_URI, DB_NAME, FLOATS_COLLECTION
    import pymongo
    client = pymongo.MongoClient(MONGO_URI)
    db = client[DB_NAME]
    sample_float = db[FLOATS_COLLECTION].find_one()
    platform = sample_float['_id'] if sample_float else '1900121'

    print(f"Using platform: {platform}")
    res = await mcp.call_tool("visualize_float_trajectory", {"platform_number": platform})
    print(f"Result: {res}")


if __name__ == "__main__":
    asyncio.run(test_tools())
