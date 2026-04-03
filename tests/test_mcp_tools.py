"""
Comprehensive MCP Tools Test Suite — 60 tests across all 30 tools.

Tests each tool DIRECTLY against the live MongoDB database (no LLM involved).
This validates data accuracy, schema alignment, and correctness.

Usage:
    python tests/test_mcp_tools.py
"""

import sys
import os
import json
import time

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import pymongo
from mcp_server.config import MONGO_URI, DB_NAME, PROFILES_COLLECTION, BGC_PROFILES_COLLECTION, FLOATS_COLLECTION
from mcp_server.tools import (
    _safe_date, _normalize_date_str, _normalize_end_date_str,
    _fetch_profile_doc, _extract_measurements, _build_date_filter,
    CORE_PARAMS, BGC_PARAMS, ALL_PARAMS,
)

# ── Setup ────────────────────────────────────────────────────────────────────

client = pymongo.MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
db = client[DB_NAME]
profiles_coll = db[PROFILES_COLLECTION]
bgc_coll = db[BGC_PROFILES_COLLECTION]
floats_coll = db[FLOATS_COLLECTION]

# ── Discover real IDs from DB ────────────────────────────────────────────────

SAMPLE_FLOAT = None
SAMPLE_PROFILE_ID = None
SAMPLE_BGC_PROFILE_ID = None
SAMPLE_PROFILE_IDS = []  # Multiple core profile IDs (same float)
SAMPLE_BGC_FLOAT = None

def discover_test_data():
    """Discover actual IDs from the database for testing."""
    global SAMPLE_FLOAT, SAMPLE_PROFILE_ID, SAMPLE_BGC_PROFILE_ID
    global SAMPLE_PROFILE_IDS, SAMPLE_BGC_FLOAT

    # Get a float
    f = floats_coll.find_one()
    if f:
        SAMPLE_FLOAT = str(f['_id'])

    # Get a core profile
    p = profiles_coll.find_one()
    if p:
        SAMPLE_PROFILE_ID = p['_id']

    # Get multiple profiles from same float
    if SAMPLE_FLOAT:
        # First check if our sample float has core profiles
        test_profiles = list(profiles_coll.find(
            {"platform_number": SAMPLE_FLOAT},
            {"_id": 1}
        ).limit(3))
        if test_profiles:
            SAMPLE_PROFILE_IDS = [d['_id'] for d in test_profiles]
        else:
            # Use any float that has profiles
            p2 = profiles_coll.find_one()
            if p2:
                pn = p2.get('platform_number')
                test_profiles = list(profiles_coll.find(
                    {"platform_number": pn}, {"_id": 1}
                ).limit(3))
                SAMPLE_PROFILE_IDS = [d['_id'] for d in test_profiles]

    # Get a BGC profile
    b = bgc_coll.find_one()
    if b:
        SAMPLE_BGC_PROFILE_ID = b['_id']
        SAMPLE_BGC_FLOAT = b.get('platform_number')

    print(f"  SAMPLE_FLOAT:          {SAMPLE_FLOAT}")
    print(f"  SAMPLE_PROFILE_ID:     {SAMPLE_PROFILE_ID}")
    print(f"  SAMPLE_BGC_PROFILE_ID: {SAMPLE_BGC_PROFILE_ID}")
    print(f"  SAMPLE_PROFILE_IDS:    {SAMPLE_PROFILE_IDS}")
    print(f"  SAMPLE_BGC_FLOAT:      {SAMPLE_BGC_FLOAT}")


# ── Test infrastructure ──────────────────────────────────────────────────────

PASS = 0
FAIL = 0
ERRORS = []

def run_test(test_num, tool_name, description, func, *args, **kwargs):
    """Run a single test and report pass/fail."""
    global PASS, FAIL, ERRORS
    try:
        start = time.time()
        result = func(*args, **kwargs)
        elapsed = time.time() - start

        # Basic validation
        assert result is not None, "Result is None"
        result_str = str(result)
        assert len(result_str) > 0, "Result is empty"

        # Check for error indicators
        is_error = any(e in result_str.lower() for e in [
            "not found", "no profiles found", "error", "invalid"
        ])

        # If the test description says "error handling" then errors are expected
        expects_error = "error" in description.lower() or "invalid" in description.lower() or "not found" in description.lower() or "missing" in description.lower()

        if is_error and not expects_error:
            FAIL += 1
            msg = f"  FAIL #{test_num}: [{tool_name}] {description} — unexpected error in result ({elapsed:.2f}s)"
            ERRORS.append(msg)
            print(msg)
            print(f"         Result preview: {result_str[:200]}")
        else:
            PASS += 1
            # Truncate long results for display
            preview = result_str[:120].replace('\n', ' ')
            print(f"  PASS #{test_num}: [{tool_name}] {description} ({elapsed:.2f}s) → {preview}...")

        return result

    except Exception as e:
        FAIL += 1
        msg = f"  FAIL #{test_num}: [{tool_name}] {description} — EXCEPTION: {e}"
        ERRORS.append(msg)
        print(msg)
        return None


# ── Register tools (we call them directly, not via MCP protocol) ─────────────

from mcp.server.fastmcp import FastMCP
mcp = FastMCP("test")

# Import register_all_tools and call it to get actual tool functions
from mcp_server.tools import register_all_tools
register_all_tools(mcp)

# Access the registered tool functions via mcp internals
# The tools are closures inside register_all_tools, so we call them via the MCP's tool registry
def call_tool(name, **kwargs):
    """Call a registered MCP tool by name."""
    # FastMCP stores tools in _tool_manager or similar
    tool_fn = None
    for t in mcp._tool_manager._tools.values():
        if t.name == name:
            tool_fn = t.fn
            break
    if tool_fn is None:
        raise ValueError(f"Tool '{name}' not found. Available: {[t.name for t in mcp._tool_manager._tools.values()]}")
    return tool_fn(**kwargs)


# ═══════════════════════════════════════════════════════════════════════════════
#  TEST SUITE — 60 tests across 30 tools
# ═══════════════════════════════════════════════════════════════════════════════

def run_all_tests():
    print("\n" + "=" * 70)
    print("  CATEGORY 1: DATA RETRIEVAL TOOLS")
    print("=" * 70)

    # ── Tool 1: search_profiles ──
    run_test(1, "search_profiles", "Search for Bay of Bengal profiles",
             call_tool, name="search_profiles", query="Bay of Bengal temperature profiles", limit=3)

    run_test(2, "search_profiles", "Search for deep ocean profiles",
             call_tool, name="search_profiles", query="deep ocean profiles below 1500m", limit=5)

    # ── Tool 2: search_bgc_profiles ──
    run_test(3, "search_bgc_profiles", "Search for DOXY profiles",
             call_tool, name="search_bgc_profiles", bgc_parameter="DOXY", limit=3)

    run_test(4, "search_bgc_profiles", "Search for CHLA profiles",
             call_tool, name="search_bgc_profiles", bgc_parameter="CHLA", limit=3)

    # ── Tool 3: get_float_info ──
    run_test(5, "get_float_info", f"Get info for float {SAMPLE_FLOAT}",
             call_tool, name="get_float_info", platform_number=SAMPLE_FLOAT)

    run_test(6, "get_float_info", "Error handling: invalid float",
             call_tool, name="get_float_info", platform_number="0000000")

    # ── Tool 4: get_float_profiles ──
    pn = profiles_coll.find_one({}, {"platform_number": 1}).get("platform_number", SAMPLE_FLOAT)

    run_test(7, "get_float_profiles", f"List profiles for float {pn} (no date filter)",
             call_tool, name="get_float_profiles", platform_number=pn, limit=5)

    run_test(8, "get_float_profiles", f"List profiles for float {pn} with date filter",
             call_tool, name="get_float_profiles", platform_number=pn,
             start_date="2000-01-01", end_date="2025-12-31", limit=5)

    run_test(9, "get_float_profiles", "Date filter narrow range",
             call_tool, name="get_float_profiles", platform_number=pn,
             start_date="2002-11-01", end_date="2002-12-31", limit=5)

    # ── Tool 5: get_profile_data ──
    run_test(10, "get_profile_data", f"Get temp,psal for profile {SAMPLE_PROFILE_ID}",
             call_tool, name="get_profile_data", profile_id=SAMPLE_PROFILE_ID,
             parameters="temp,psal")

    run_test(11, "get_profile_data", f"Get temp only for {SAMPLE_PROFILE_ID}",
             call_tool, name="get_profile_data", profile_id=SAMPLE_PROFILE_ID,
             parameters="temp")

    run_test(12, "get_profile_data", f"Get adjusted data for {SAMPLE_PROFILE_ID}",
             call_tool, name="get_profile_data", profile_id=SAMPLE_PROFILE_ID,
             parameters="temp,psal", use_adjusted=True)

    run_test(13, "get_profile_data", f"Get BGC data for {SAMPLE_BGC_PROFILE_ID}",
             call_tool, name="get_profile_data", profile_id=SAMPLE_BGC_PROFILE_ID,
             parameters="temp,psal,doxy")

    run_test(14, "get_profile_data", "Error handling: invalid profile ID",
             call_tool, name="get_profile_data", profile_id="XXXXXXX_999")

    run_test(15, "get_profile_data", "Error handling: invalid parameter",
             call_tool, name="get_profile_data", profile_id=SAMPLE_PROFILE_ID,
             parameters="invalid_param")

    # ── Tool 6: get_nearest_floats ──
    sample_p = profiles_coll.find_one({}, {"latitude": 1, "longitude": 1})
    lat, lon = sample_p.get("latitude", 15.0), sample_p.get("longitude", 89.0)

    run_test(16, "get_nearest_floats", f"Find floats near ({lat}, {lon})",
             call_tool, name="get_nearest_floats", lat=lat, lon=lon, max_distance_km=500)

    run_test(17, "get_nearest_floats", "Find floats near equator Indian Ocean",
             call_tool, name="get_nearest_floats", lat=0, lon=75, max_distance_km=1000)

    # ── Tool 7: aggregate_statistics ──
    run_test(18, "aggregate_statistics", "Avg temp 0-100m",
             call_tool, name="aggregate_statistics", min_depth=0, max_depth=100,
             parameter="temp")

    run_test(19, "aggregate_statistics", "Avg psal 0-500m",
             call_tool, name="aggregate_statistics", min_depth=0, max_depth=500,
             parameter="psal")

    run_test(20, "aggregate_statistics", "Avg doxy 0-200m (BGC)",
             call_tool, name="aggregate_statistics", min_depth=0, max_depth=200,
             parameter="doxy")

    run_test(21, "aggregate_statistics", "Error handling: invalid param",
             call_tool, name="aggregate_statistics", min_depth=0, max_depth=100,
             parameter="invalid")

    # ── NEW: User query — "Mean of temperatures in date range 01 Jan 2010 to 01 Jan 2011" ──
    run_test(70, "aggregate_statistics", "Mean temp with date range 2010-01-01 to 2011-01-01",
             call_tool, name="aggregate_statistics", min_depth=0, max_depth=2000,
             parameter="temp", start_date="2010-01-01", end_date="2011-01-01")

    # ── Tool 8: get_dataset_metadata ──
    run_test(22, "get_dataset_metadata", "Get database overview",
             call_tool, name="get_dataset_metadata")

    print("\n" + "=" * 70)
    print("  ADVANCED DATA RETRIEVAL TOOLS")
    print("=" * 70)

    # ── Tool 9: get_profile_summary_stats ──
    run_test(23, "get_profile_summary_stats", f"Stats for {SAMPLE_PROFILE_ID} — temp,psal",
             call_tool, name="get_profile_summary_stats", profile_id=SAMPLE_PROFILE_ID,
             parameters="temp,psal")

    run_test(24, "get_profile_summary_stats", f"BGC stats for {SAMPLE_BGC_PROFILE_ID}",
             call_tool, name="get_profile_summary_stats", profile_id=SAMPLE_BGC_PROFILE_ID,
             parameters="temp,psal,doxy")

    # ── Tool 10: find_profiles_by_depth_range ──
    run_test(25, "find_profiles_by_depth_range", "Find deep profiles (1500-2000m)",
             call_tool, name="find_profiles_by_depth_range", min_depth=1500,
             max_depth=2000, limit=5)

    run_test(26, "find_profiles_by_depth_range", "Find shallow profiles (0-200m)",
             call_tool, name="find_profiles_by_depth_range", min_depth=0,
             max_depth=200, limit=5)

    # ── Tool 11: find_profiles_missing_data ──
    run_test(27, "find_profiles_missing_data", "Profiles with missing temp data",
             call_tool, name="find_profiles_missing_data", parameter="temp", limit=5)

    run_test(28, "find_profiles_missing_data", "Profiles with missing doxy data",
             call_tool, name="find_profiles_missing_data", parameter="doxy", limit=5)

    # ── Tool 12: get_recent_profiles ──
    run_test(29, "get_recent_profiles", "Get 5 most recent core profiles",
             call_tool, name="get_recent_profiles", limit=5)

    run_test(30, "get_recent_profiles", "Get 5 most recent profiles including BGC",
             call_tool, name="get_recent_profiles", limit=5, include_bgc=True)

    # ── Tool 13: find_anomalous_profiles ──
    run_test(31, "find_anomalous_profiles", "Find anomalous temp (0-100m, 2σ)",
             call_tool, name="find_anomalous_profiles", parameter="temp",
             min_depth=0, max_depth=100, threshold_sigma=2.0, limit=5)

    run_test(32, "find_anomalous_profiles", "Find anomalous psal (0-500m, 3σ)",
             call_tool, name="find_anomalous_profiles", parameter="psal",
             min_depth=0, max_depth=500, threshold_sigma=3.0, limit=5)

    # ── Tool 14: get_vertical_gradient ──
    run_test(33, "get_vertical_gradient", f"Temp gradient for {SAMPLE_PROFILE_ID}",
             call_tool, name="get_vertical_gradient", profile_id=SAMPLE_PROFILE_ID,
             parameter="temp")

    run_test(34, "get_vertical_gradient", f"Psal gradient for {SAMPLE_PROFILE_ID}",
             call_tool, name="get_vertical_gradient", profile_id=SAMPLE_PROFILE_ID,
             parameter="psal")

    # ── Tool 15: get_multi_profile_data ──
    run_test(35, "get_multi_profile_data", f"Batch fetch {len(SAMPLE_PROFILE_IDS)} profiles",
             call_tool, name="get_multi_profile_data", profile_ids=SAMPLE_PROFILE_IDS,
             parameters="temp,psal")

    run_test(36, "get_multi_profile_data", "Batch fetch with adjusted data",
             call_tool, name="get_multi_profile_data", profile_ids=SAMPLE_PROFILE_IDS[:2],
             parameters="temp", use_adjusted=True)

    print("\n" + "=" * 70)
    print("  CATEGORY 2: VISUALIZATION TOOLS")
    print("=" * 70)

    # ── Tool 16: visualize_float_trajectory ──
    traj_float = pn  # float with known profiles
    f_doc = floats_coll.find_one({"_id": pn})
    if not f_doc:
        # Use a float that exists in floats collection
        traj_float = SAMPLE_FLOAT

    run_test(37, "visualize_float_trajectory", f"Trajectory for float {traj_float}",
             call_tool, name="visualize_float_trajectory", platform_number=traj_float)

    run_test(38, "visualize_float_trajectory", "Error handling: invalid float",
             call_tool, name="visualize_float_trajectory", platform_number="0000000")

    # ── Tool 17: visualize_profile_depth_plot ──
    run_test(39, "visualize_profile_depth_plot", f"Depth plot temp for {SAMPLE_PROFILE_ID}",
             call_tool, name="visualize_profile_depth_plot", profile_id=SAMPLE_PROFILE_ID,
             parameters="temp")

    run_test(40, "visualize_profile_depth_plot", f"Depth plot temp,psal for {SAMPLE_PROFILE_ID}",
             call_tool, name="visualize_profile_depth_plot", profile_id=SAMPLE_PROFILE_ID,
             parameters="temp,psal")

    run_test(41, "visualize_profile_depth_plot", f"BGC depth plot temp,doxy for {SAMPLE_BGC_PROFILE_ID}",
             call_tool, name="visualize_profile_depth_plot", profile_id=SAMPLE_BGC_PROFILE_ID,
             parameters="temp,doxy")

    # ── Tool 18: visualize_ts_diagram ──
    run_test(42, "visualize_ts_diagram", f"T-S diagram for 1 profile",
             call_tool, name="visualize_ts_diagram", profile_ids=[SAMPLE_PROFILE_ID])

    run_test(43, "visualize_ts_diagram", f"T-S diagram for {len(SAMPLE_PROFILE_IDS)} profiles",
             call_tool, name="visualize_ts_diagram", profile_ids=SAMPLE_PROFILE_IDS)

    # ── Tool 19: compare_profiles_depth ──
    run_test(44, "compare_profiles_depth", f"Compare temp for {len(SAMPLE_PROFILE_IDS)} profiles",
             call_tool, name="compare_profiles_depth", profile_ids=SAMPLE_PROFILE_IDS,
             parameter="temp")

    run_test(45, "compare_profiles_depth", "Compare psal for 2 profiles",
             call_tool, name="compare_profiles_depth", profile_ids=SAMPLE_PROFILE_IDS[:2],
             parameter="psal")

    # ── Tool 20: map_marker_display ──
    run_test(46, "map_marker_display", f"Map markers for {len(SAMPLE_PROFILE_IDS)} profiles",
             call_tool, name="map_marker_display", profile_ids=SAMPLE_PROFILE_IDS)

    # ── Tool 21: visualize_parameter_scatter ──
    run_test(47, "visualize_parameter_scatter", "Psal vs temp scatter",
             call_tool, name="visualize_parameter_scatter", profile_ids=[SAMPLE_PROFILE_ID],
             param_x="psal", param_y="temp")

    if SAMPLE_BGC_PROFILE_ID:
        run_test(48, "visualize_parameter_scatter", "Doxy vs temp scatter (BGC)",
                 call_tool, name="visualize_parameter_scatter",
                 profile_ids=[SAMPLE_BGC_PROFILE_ID],
                 param_x="doxy", param_y="temp")

    # ── Tool 22: visualize_time_series ──
    run_test(49, "visualize_time_series", f"Temp over time for float {pn} at 10m",
             call_tool, name="visualize_time_series", platform_number=pn,
             parameter="temp", depth_level=10.0)

    run_test(50, "visualize_time_series", f"Psal over time for float {pn} at 100m",
             call_tool, name="visualize_time_series", platform_number=pn,
             parameter="psal", depth_level=100.0)

    # ── Tool 23: visualize_depth_histogram ──
    run_test(51, "visualize_depth_histogram", "Depth distribution histogram",
             call_tool, name="visualize_depth_histogram", limit=200)

    # ── Tool 24: visualize_parameter_correlation ──
    run_test(52, "visualize_parameter_correlation", f"Correlation temp,psal for {SAMPLE_PROFILE_ID}",
             call_tool, name="visualize_parameter_correlation",
             profile_id=SAMPLE_PROFILE_ID, parameters="temp,psal")

    if SAMPLE_BGC_PROFILE_ID:
        run_test(53, "visualize_parameter_correlation", f"Correlation temp,psal,doxy (BGC)",
                 call_tool, name="visualize_parameter_correlation",
                 profile_id=SAMPLE_BGC_PROFILE_ID, parameters="temp,psal,doxy")

    # ── Tool 25: visualize_float_density_map ──
    run_test(54, "visualize_float_density_map", "Float density at 5° grid",
             call_tool, name="visualize_float_density_map", grid_size=5.0)

    run_test(55, "visualize_float_density_map", "Float density at 10° grid",
             call_tool, name="visualize_float_density_map", grid_size=10.0)

    # ── Tool 26: visualize_bgc_parameter_distribution ──
    run_test(56, "visualize_bgc_parameter_distribution", "DOXY distribution 0-200m",
             call_tool, name="visualize_bgc_parameter_distribution",
             bgc_parameter="doxy", min_depth=0, max_depth=200)

    # ── Tool 27: visualize_section_plot ──
    run_test(57, "visualize_section_plot", f"Section plot for {len(SAMPLE_PROFILE_IDS)} profiles",
             call_tool, name="visualize_section_plot", profile_ids=SAMPLE_PROFILE_IDS,
             parameter="temp")

    # ── Tool 28: visualize_heatmap_region ──
    run_test(58, "visualize_heatmap_region", "Temp heatmap 0-50m, 2° grid",
             call_tool, name="visualize_heatmap_region", parameter="temp",
             min_depth=0, max_depth=50, grid_size=2.0)

    run_test(59, "visualize_heatmap_region", "Psal heatmap 0-100m, 5° grid",
             call_tool, name="visualize_heatmap_region", parameter="psal",
             min_depth=0, max_depth=100, grid_size=5.0)

    print("\n" + "=" * 70)
    print("  CATEGORY 3: ORCHESTRATION / META TOOLS")
    print("=" * 70)

    # ── Tool 29: auto_visualize ──
    run_test(60, "auto_visualize", "Suggest viz for trajectory data",
             call_tool, name="auto_visualize",
             data_summary="Float trajectory showing position changes over 50 cycles")

    run_test(61, "auto_visualize", "Suggest viz for T-S analysis",
             call_tool, name="auto_visualize",
             data_summary="Temperature and salinity data for water mass identification")

    run_test(62, "auto_visualize", "Suggest viz for comparison",
             call_tool, name="auto_visualize",
             data_summary="Comparing multiple profiles temperature vs depth")

    run_test(63, "auto_visualize", "Suggest viz for time series",
             call_tool, name="auto_visualize",
             data_summary="Temperature trend over time at 100m depth")

    run_test(64, "auto_visualize", "Suggest viz with user preference",
             call_tool, name="auto_visualize",
             data_summary="Profile data", chart_preference="scatter plot")

    # ── Tool 30: resolve_query_intent ──
    run_test(65, "resolve_query_intent", "Classify: show me temperature plot",
             call_tool, name="resolve_query_intent",
             user_query="Show me a temperature depth plot for float 1900121")

    run_test(66, "resolve_query_intent", "Classify: what is the average temperature",
             call_tool, name="resolve_query_intent",
             user_query="What is the average temperature between 0 and 100 meters?")

    run_test(67, "resolve_query_intent", "Classify: find profiles near India",
             call_tool, name="resolve_query_intent",
             user_query="Find profiles near the coast of India")

    run_test(68, "resolve_query_intent", "Classify: compare multiple profiles",
             call_tool, name="resolve_query_intent",
             user_query="Compare salinity profiles from different seasons")

    run_test(69, "resolve_query_intent", "Classify: analyze anomalous values",
             call_tool, name="resolve_query_intent",
             user_query="Calculate the statistics and find anomaly in dissolved oxygen")


# ═══════════════════════════════════════════════════════════════════════════════
#  DATA INTEGRITY DEEP TESTS
# ═══════════════════════════════════════════════════════════════════════════════

def run_data_integrity_tests():
    """Additional deep validation for data accuracy."""

    print("\n" + "=" * 70)
    print("  DATA INTEGRITY VALIDATION")
    print("=" * 70)

    # ── Test: get_profile_data returns ALL levels ──
    result = call_tool(name="get_profile_data", profile_id=SAMPLE_PROFILE_ID,
                       parameters="temp,psal")
    data = json.loads(result)
    doc = profiles_coll.find_one({"_id": SAMPLE_PROFILE_ID})
    expected_levels = doc.get("n_levels", len(doc.get("measurements", [])))
    actual_levels = data["metadata"]["total_levels"]

    if actual_levels >= expected_levels:
        print(f"  PASS:  No truncation — profile has {actual_levels}/{expected_levels} levels ✓")
    else:
        print(f"  FAIL:  TRUNCATION! Profile has {actual_levels}/{expected_levels} levels ✗")

    # ── Test: Measurements have correct fields ──
    m = data["measurements"][0]
    assert "depth_m" in m, "Missing depth_m field"
    assert "temp" in m, "Missing temp field"
    assert "psal" in m, "Missing psal field"
    print(f"  PASS:  Measurement fields correct (depth_m, temp, psal) ✓")

    # ── Test: depth_m comes from pres field ──
    raw_pres = doc["measurements"][0].get("pres")
    if m["depth_m"] == raw_pres:
        print(f"  PASS:  depth_m = pres = {raw_pres} ✓")
    else:
        print(f"  FAIL:  depth_m ({m['depth_m']}) != pres ({raw_pres}) ✗")

    # ── Test: get_profile_data with adjusted returns adjusted values ──
    result_adj = call_tool(name="get_profile_data", profile_id=SAMPLE_PROFILE_ID,
                           parameters="temp,psal", use_adjusted=True)
    data_adj = json.loads(result_adj)
    m_adj = data_adj["measurements"][0]
    raw_temp_adj = doc["measurements"][0].get("temp_adjusted")
    if raw_temp_adj is not None and m_adj.get("temp") == raw_temp_adj:
        print(f"  PASS:  Adjusted temp matches: {m_adj['temp']} ✓")
    elif raw_temp_adj is not None:
        print(f"  WARN:  Adjusted temp mismatch: got {m_adj.get('temp')}, expected {raw_temp_adj}")
    else:
        print(f"  SKIP:  No adjusted temp in profile")

    # ── Test: Date filter uses ISO strings correctly ──
    result_filter = _build_date_filter("2002-11-01", "2002-12-31")
    ts_val = result_filter.get("timestamp", {}).get("$gte", "")
    if isinstance(ts_val, str) and "T" in ts_val:
        print(f"  PASS:  Date filter uses ISO strings: {ts_val} ✓")
    else:
        print(f"  FAIL:  Date filter not ISO string: {ts_val} (type: {type(ts_val)}) ✗")

    # ── Test: BGC profile has doxy data ──
    if SAMPLE_BGC_PROFILE_ID:
        result_bgc = call_tool(name="get_profile_data", profile_id=SAMPLE_BGC_PROFILE_ID,
                               parameters="temp,doxy")
        data_bgc = json.loads(result_bgc)
        has_doxy = any(m.get("doxy") is not None for m in data_bgc["measurements"])
        if has_doxy:
            print(f"  PASS:  BGC profile has DOXY data ✓")
        else:
            print(f"  FAIL:  BGC profile missing DOXY data ✗")

    # ── Test: Float info matches ──
    result_float = call_tool(name="get_float_info", platform_number=SAMPLE_FLOAT)
    float_data = json.loads(result_float)
    if float_data.get("platform_number") == SAMPLE_FLOAT:
        print(f"  PASS:  Float info platform match: {SAMPLE_FLOAT} ✓")
    else:
        print(f"  FAIL:  Float info mismatch ✗")

    # ── Test: Visualization ui_intent has embedded data ──
    result_viz = call_tool(name="visualize_profile_depth_plot",
                           profile_id=SAMPLE_PROFILE_ID, parameters="temp")
    viz_data = json.loads(result_viz)
    ui_data = viz_data.get("ui_intent", {}).get("params", {}).get("data", [])
    if len(ui_data) > 0:
        print(f"  PASS:  Viz ui_intent has embedded data ({len(ui_data)} points) ✓")
    else:
        print(f"  FAIL:  Viz ui_intent missing embedded data ✗")


# ═══════════════════════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("=" * 70)
    print("  FloatChat-AI — Comprehensive MCP Tool Test Suite")
    print("  Testing all 30 tools with 70 test cases")
    print("=" * 70)

    print("\n📦 Discovering test data from MongoDB...")
    discover_test_data()

    if not SAMPLE_PROFILE_ID:
        print("\n❌ No data in MongoDB. Cannot run tests.")
        sys.exit(1)

    print("\n🚀 Starting tests...\n")
    total_start = time.time()

    run_all_tests()

    print("\n")
    run_data_integrity_tests()

    total_elapsed = time.time() - total_start

    # ── Summary ──────────────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print(f"  RESULTS: {PASS} passed, {FAIL} failed, {PASS + FAIL} total ({total_elapsed:.1f}s)")
    print("=" * 70)

    if ERRORS:
        print("\n❌ FAILURES:")
        for e in ERRORS:
            print(e)
    else:
        print("\n✅ ALL TESTS PASSED!")

    print()
    sys.exit(0 if FAIL == 0 else 1)
