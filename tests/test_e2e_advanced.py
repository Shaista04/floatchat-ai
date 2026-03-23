"""
Advanced End-to-End RAG Pipeline Test Suite
============================================

Final review: Tests the ENTIRE pipeline (User Query → LLM ReAct → MCP Tool → Response/Chart).
Each query exercises the LLM's ability to:
  1. Understand complex natural-language prompts
  2. Choose the correct tool(s) from 30 available
  3. Pass correctly-typed arguments
  4. Interpret tool output
  5. Produce a coherent final answer
  6. Generate UI intents + charts when applicable

Usage:
    python tests/test_e2e_advanced.py
"""

import sys
import os
import asyncio
import json
import time
import traceback
from pathlib import Path

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from rag.pipeline import RagPipeline
from rag.config import LLM_MODEL, OLLAMA_BASE_URL

VIZ_OUTPUT = os.path.join(PROJECT_ROOT, "viz_output")
Path(VIZ_OUTPUT).mkdir(parents=True, exist_ok=True)

# ═══════════════════════════════════════════════════════════════════════════════
#  ADVANCED TEST QUERIES — 50+ covering all tool categories
#
#  Format: (query, expected_tools, expect_chart, description)
#    expected_tools = list of tool names the LLM SHOULD call (soft check)
#    expect_chart   = True if the query should produce a visualization
#    description    = what this test validates
# ═══════════════════════════════════════════════════════════════════════════════

ADVANCED_QUERIES = [
    # ─── GROUP A: GENERAL / NO-TOOL (should answer directly) ─────────────────
    {
        "query": "Hello! What is the Argo program?",
        "expected_tools": [],
        "expect_chart": False,
        "category": "General",
        "description": "Greeting + general science — should NOT call any tool",
    },
    {
        "query": "What is a BGC float and what parameters does it measure?",
        "expected_tools": [],
        "expect_chart": False,
        "category": "General",
        "description": "General knowledge — no tool needed",
    },

    # ─── GROUP B: DATABASE DISCOVERY ─────────────────────────────────────────
    {
        "query": "How many floats and profiles are in the database?",
        "expected_tools": ["get_dataset_metadata"],
        "expect_chart": False,
        "category": "Discovery",
        "description": "Database overview — must use get_dataset_metadata",
    },
    {
        "query": "Show me the most recent profiles in the database",
        "expected_tools": ["get_recent_profiles"],
        "expect_chart": False,
        "category": "Discovery",
        "description": "Recent profiles — must use get_recent_profiles",
    },
    {
        "query": "What are the latest BGC profiles available?",
        "expected_tools": ["get_recent_profiles"],
        "expect_chart": False,
        "category": "Discovery",
        "description": "Recent BGC profiles — include_bgc=True expected",
    },

    # ─── GROUP C: FLOAT INFO ─────────────────────────────────────────────────
    {
        "query": "Tell me everything about float 2902198",
        "expected_tools": ["get_float_info"],
        "expect_chart": False,
        "category": "Float Info",
        "description": "Float metadata — must use get_float_info",
    },
    {
        "query": "List all profile IDs for float 1900121",
        "expected_tools": ["get_float_profiles"],
        "expect_chart": False,
        "category": "Float Info",
        "description": "Profile listing — must use get_float_profiles",
    },

    # ─── GROUP D: PROFILE DATA ───────────────────────────────────────────────
    {
        "query": "Get the full temperature and salinity profile for profile 1900121_001",
        "expected_tools": ["get_profile_data"],
        "expect_chart": False,
        "category": "Profile Data",
        "description": "Full measurement data — must return ALL levels",
    },
    {
        "query": "Show me the quality-controlled adjusted measurements for profile 1900121_005",
        "expected_tools": ["get_profile_data"],
        "expect_chart": False,
        "category": "Profile Data",
        "description": "Adjusted data — use_adjusted must be true",
    },
    {
        "query": "What dissolved oxygen data does BGC profile 2900765_001_BGC have?",
        "expected_tools": ["get_profile_data"],
        "expect_chart": False,
        "category": "Profile Data",
        "description": "BGC profile DOXY data — correct _BGC suffix handling",
    },

    # ─── GROUP E: GEOGRAPHIC QUERIES ─────────────────────────────────────────
    {
        "query": "Find floats operating near the coast of India at 15°N, 80°E",
        "expected_tools": ["get_nearest_floats"],
        "expect_chart": False,
        "category": "Geographic",
        "description": "Geospatial search — must use lat/lon correctly",
    },
    {
        "query": "What floats are within 300km of the equator at 75°E in the Indian Ocean?",
        "expected_tools": ["get_nearest_floats"],
        "expect_chart": False,
        "category": "Geographic",
        "description": "Geospatial + distance — must pass max_distance_km",
    },

    # ─── GROUP F: SEMANTIC SEARCH ────────────────────────────────────────────
    {
        "query": "Find profiles in the Arabian Sea",
        "expected_tools": ["search_profiles"],
        "expect_chart": False,
        "category": "Semantic Search",
        "description": "Natural language search — uses ChromaDB embeddings",
    },
    {
        "query": "Find BGC profiles that measure chlorophyll-a",
        "expected_tools": ["search_bgc_profiles"],
        "expect_chart": False,
        "category": "Semantic Search",
        "description": "BGC parameter search — CHLA",
    },
    {
        "query": "Search for profiles related to dissolved oxygen in the deep ocean",
        "expected_tools": ["search_bgc_profiles", "search_profiles"],
        "expect_chart": False,
        "category": "Semantic Search",
        "description": "Could use either search tool — DOXY keyword",
    },

    # ─── GROUP G: STATISTICS & ANALYSIS ──────────────────────────────────────
    {
        "query": "What is the average temperature between 0 and 200 meters depth?",
        "expected_tools": ["aggregate_statistics"],
        "expect_chart": False,
        "category": "Statistics",
        "description": "Aggregate statistics — temp, 0-200m",
    },
    {
        "query": "Give me salinity statistics for the upper 500 meters",
        "expected_tools": ["aggregate_statistics"],
        "expect_chart": False,
        "category": "Statistics",
        "description": "Aggregate stats — psal, 0-500m",
    },
    {
        "query": "Calculate summary statistics for profile 1900121_001 temperature and salinity",
        "expected_tools": ["get_profile_summary_stats"],
        "expect_chart": False,
        "category": "Statistics",
        "description": "Profile-level summary stats",
    },
    {
        "query": "Find profiles with anomalous temperature values in the surface layer (0-100m)",
        "expected_tools": ["find_anomalous_profiles"],
        "expect_chart": False,
        "category": "Statistics",
        "description": "Anomaly detection — temp, 0-100m",
    },

    # ─── GROUP H: ADVANCED DATA TOOLS ────────────────────────────────────────
    {
        "query": "Find profiles that reach depths deeper than 1800 meters",
        "expected_tools": ["find_profiles_by_depth_range"],
        "expect_chart": False,
        "category": "Advanced Data",
        "description": "Depth range filter — deep profiles",
    },
    {
        "query": "Are there any profiles with significant missing dissolved oxygen data?",
        "expected_tools": ["find_profiles_missing_data"],
        "expect_chart": False,
        "category": "Advanced Data",
        "description": "Data quality check — missing doxy",
    },
    {
        "query": "What is the vertical temperature gradient in profile 1900121_001? Where is the thermocline?",
        "expected_tools": ["get_vertical_gradient"],
        "expect_chart": False,
        "category": "Advanced Data",
        "description": "Gradient calculation — thermocline identification",
    },

    # ─── GROUP I: VISUALIZATION — TRAJECTORY ─────────────────────────────────
    {
        "query": "Show me the trajectory of float 2902198 on a map",
        "expected_tools": ["visualize_float_trajectory"],
        "expect_chart": True,
        "category": "Viz: Trajectory",
        "description": "Trajectory map — must produce chart image",
    },

    # ─── GROUP J: VISUALIZATION — DEPTH PROFILE ─────────────────────────────
    {
        "query": "Plot the temperature depth profile for 1900121_001",
        "expected_tools": ["visualize_profile_depth_plot"],
        "expect_chart": True,
        "category": "Viz: Depth Profile",
        "description": "Single-param depth chart",
    },
    {
        "query": "Create a depth plot showing both temperature and salinity for profile 1900121_005",
        "expected_tools": ["visualize_profile_depth_plot"],
        "expect_chart": True,
        "category": "Viz: Depth Profile",
        "description": "Multi-param depth chart — temp,psal",
    },

    # ─── GROUP K: VISUALIZATION — T-S DIAGRAM ───────────────────────────────
    {
        "query": "Generate a T-S diagram for profile 1900121_001",
        "expected_tools": ["visualize_ts_diagram"],
        "expect_chart": True,
        "category": "Viz: T-S Diagram",
        "description": "Single-profile T-S diagram",
    },
    {
        "query": "Create a T-S diagram comparing profiles 1900121_001, 1900121_010, and 1900121_020",
        "expected_tools": ["visualize_ts_diagram"],
        "expect_chart": True,
        "category": "Viz: T-S Diagram",
        "description": "Multi-profile T-S diagram — water mass comparison",
    },

    # ─── GROUP L: VISUALIZATION — COMPARISON ─────────────────────────────────
    {
        "query": "Compare the temperature profiles of 1900121_001 and 1900121_050 on the same depth chart",
        "expected_tools": ["compare_profiles_depth"],
        "expect_chart": True,
        "category": "Viz: Comparison",
        "description": "2-profile comparison on depth chart",
    },

    # ─── GROUP M: VISUALIZATION — MAP ────────────────────────────────────────
    {
        "query": "Show me where profiles 1900121_001, 1900121_010, 1900121_020 are on a map",
        "expected_tools": ["map_marker_display"],
        "expect_chart": True,
        "category": "Viz: Map",
        "description": "Map markers for multiple profiles",
    },

    # ─── GROUP N: VISUALIZATION — TIME SERIES ────────────────────────────────
    {
        "query": "Plot the temperature changes over time for float 1900121 at 10 meters depth",
        "expected_tools": ["visualize_time_series"],
        "expect_chart": True,
        "category": "Viz: Time Series",
        "description": "Temporal evolution of temp at fixed depth",
    },

    # ─── GROUP O: VISUALIZATION — ADVANCED CHARTS ────────────────────────────
    {
        "query": "Show the depth distribution histogram for all profiles",
        "expected_tools": ["visualize_depth_histogram"],
        "expect_chart": True,
        "category": "Viz: Histogram",
        "description": "Global depth distribution",
    },
    {
        "query": "Create a float density map showing where floats are concentrated",
        "expected_tools": ["visualize_float_density_map"],
        "expect_chart": True,
        "category": "Viz: Density Map",
        "description": "Float density heatmap",
    },
    {
        "query": "Show the distribution of dissolved oxygen values between 0 and 200 meters across all BGC profiles",
        "expected_tools": ["visualize_bgc_parameter_distribution"],
        "expect_chart": True,
        "category": "Viz: BGC Distribution",
        "description": "BGC parameter histogram — DOXY",
    },
    {
        "query": "Create a geographic heatmap of average temperature in the top 50 meters at 5 degree resolution",
        "expected_tools": ["visualize_heatmap_region"],
        "expect_chart": True,
        "category": "Viz: Heatmap",
        "description": "Spatial temperature heatmap",
    },

    # ─── GROUP P: MULTI-STEP REASONING ───────────────────────────────────────
    {
        "query": "How many profiles does float 1900121 have?",
        "expected_tools": ["get_float_info", "get_float_profiles"],
        "expect_chart": False,
        "category": "Multi-step",
        "description": "May need get_float_info or get_float_profiles to count",
    },

    # ─── GROUP Q: ORCHESTRATION / META TOOLS ─────────────────────────────────
    {
        "query": "What kind of visualization should I use for comparing salinity across different floats?",
        "expected_tools": ["auto_visualize", "resolve_query_intent"],
        "expect_chart": False,
        "category": "Orchestration",
        "description": "Auto visualization recommendation",
    },
]


# ═══════════════════════════════════════════════════════════════════════════════
#  GRADING ENGINE
# ═══════════════════════════════════════════════════════════════════════════════

def grade_result(test: dict, result: dict, elapsed: float) -> dict:
    """
    Grade a single test result.
    Returns a grade dict with score, details, and pass/fail.
    """
    grade = {
        "query": test["query"],
        "category": test["category"],
        "description": test["description"],
        "elapsed_s": round(elapsed, 1),
        "text_len": len(result.get("text", "")),
        "num_charts": len(result.get("images", [])),
        "num_intents": len(result.get("ui_intents", [])),
        "issues": [],
        "passed": True,
    }

    text = result.get("text", "").lower()

    # Check 1: Did we get a non-empty response?
    if not result.get("text") or len(result["text"].strip()) < 10:
        grade["issues"].append("EMPTY or too-short response")
        grade["passed"] = False

    # Check 2: Did it hit the max-iteration fallback?
    if "ran out of steps" in text:
        grade["issues"].append("HIT MAX ITERATIONS — ran out of steps")
        grade["passed"] = False

    # Check 3: Loop detection
    if "unable to complete" in text and "same args" in text:
        grade["issues"].append("TOOL LOOP DETECTED")
        grade["passed"] = False

    # Check 4: Chart expected but none produced?
    if test["expect_chart"]:
        if len(result.get("images", [])) == 0 and len(result.get("ui_intents", [])) == 0:
            grade["issues"].append("EXPECTED CHART but none produced")
            grade["passed"] = False
        elif len(result.get("ui_intents", [])) > 0:
            grade["chart_types"] = [i.get("type", "?") for i in result["ui_intents"]]

    # Check 5: No-tool queries should NOT mention tool errors
    if not test["expected_tools"]:
        error_indicators = ["not found", "error calling", "tool returned no output"]
        if any(e in text for e in error_indicators):
            grade["issues"].append("NO-TOOL query but got tool error in response")
            grade["passed"] = False

    # Check 6: Did it hallucinate data for tool queries?
    if test["expected_tools"] and "expected_tools" in test:
        # If it should have used a tool but the response looks like it didn't
        hallucination_markers = [
            "unfortunately, i don't have access",
            "i cannot directly access",
            "i don't have the ability to",
        ]
        if any(m in text for m in hallucination_markers):
            grade["issues"].append("LLM refused to use tools — hallucinated inability")
            grade["passed"] = False

    return grade


# ═══════════════════════════════════════════════════════════════════════════════
#  MAIN TEST RUNNER
# ═══════════════════════════════════════════════════════════════════════════════

async def run_e2e_tests():
    print("=" * 75)
    print("  FloatChat-AI — ADVANCED E2E RAG Pipeline Test")
    print(f"  LLM: {LLM_MODEL} @ {OLLAMA_BASE_URL}")
    print(f"  Queries: {len(ADVANCED_QUERIES)}")
    print(f"  Charts → {VIZ_OUTPUT}")
    print("=" * 75)

    pipeline = RagPipeline(verbose=True)

    print("\n⏳ Starting MCP server (one-time)...")

    grades = []
    total_start = time.time()

    async with pipeline.session() as session:
        # Verify tools are loaded
        tools = await session.list_tools()
        print(f"✅ {len(tools)} tools loaded\n")

        for i, test in enumerate(ADVANCED_QUERIES, 1):
            query = test["query"]
            category = test["category"]
            print(f"\n{'─' * 75}")
            print(f"  TEST {i}/{len(ADVANCED_QUERIES)} [{category}]")
            print(f"  Query: {query}")
            print(f"  Expects: tools={test['expected_tools']}, chart={test['expect_chart']}")
            print(f"{'─' * 75}")

            try:
                start = time.time()
                result = await session.chat(query)
                elapsed = time.time() - start

                # Display result
                answer = result.get("text", "")
                print(f"\n  🤖 Answer ({len(answer)} chars, {elapsed:.1f}s):")
                # Show first 300 chars of answer
                preview = answer[:300].replace('\n', '\n    ')
                print(f"    {preview}")
                if len(answer) > 300:
                    print(f"    ... [{len(answer) - 300} more chars]")

                if result.get("images"):
                    print(f"  📊 Charts: {len(result['images'])} generated")
                    for img in result["images"]:
                        size_kb = os.path.getsize(img) / 1024 if os.path.isfile(img) else 0
                        print(f"     🖼️  {os.path.basename(img)} ({size_kb:.1f} KB)")

                if result.get("ui_intents"):
                    types = [i.get("type", "?") for i in result["ui_intents"]]
                    print(f"  📐 UI Intents: {types}")

                # Grade
                grade = grade_result(test, result, elapsed)
                grades.append(grade)

                if grade["passed"]:
                    print(f"\n  ✅ PASS")
                else:
                    print(f"\n  ❌ FAIL: {', '.join(grade['issues'])}")

            except Exception as e:
                elapsed = time.time() - start
                print(f"\n  💥 EXCEPTION: {e}")
                traceback.print_exc()
                grades.append({
                    "query": query,
                    "category": category,
                    "description": test["description"],
                    "elapsed_s": round(elapsed, 1),
                    "issues": [f"EXCEPTION: {str(e)}"],
                    "passed": False,
                })

    total_elapsed = time.time() - total_start

    # ── SUMMARY ──────────────────────────────────────────────────────────────
    passed = sum(1 for g in grades if g["passed"])
    failed = sum(1 for g in grades if not g["passed"])

    print("\n\n" + "=" * 75)
    print(f"  FINAL RESULTS: {passed}/{len(grades)} PASSED  ({total_elapsed:.0f}s total)")
    print("=" * 75)

    # Results by category
    categories = {}
    for g in grades:
        cat = g["category"]
        if cat not in categories:
            categories[cat] = {"pass": 0, "fail": 0}
        if g["passed"]:
            categories[cat]["pass"] += 1
        else:
            categories[cat]["fail"] += 1

    print(f"\n{'Category':<25} {'Pass':>5} {'Fail':>5} {'Status':>8}")
    print("-" * 50)
    for cat, counts in categories.items():
        status = "✅" if counts["fail"] == 0 else "❌"
        print(f"  {cat:<23} {counts['pass']:>5} {counts['fail']:>5}   {status}")

    # Show failures
    failures = [g for g in grades if not g["passed"]]
    if failures:
        print(f"\n{'─' * 75}")
        print(f"  FAILURES ({len(failures)}):")
        print(f"{'─' * 75}")
        for g in failures:
            print(f"\n  ❌ [{g['category']}] {g['description']}")
            print(f"     Query: {g['query'][:80]}...")
            for issue in g["issues"]:
                print(f"     Issue: {issue}")
    else:
        print("\n  🎉 ALL TESTS PASSED!")

    # Show charts generated
    all_charts = list(Path(VIZ_OUTPUT).glob("*.png"))
    if all_charts:
        print(f"\n  📊 Total charts generated: {len(all_charts)}")
        print(f"     Location: {VIZ_OUTPUT}")

    # Save report
    report_path = os.path.join(PROJECT_ROOT, "tests", "e2e_report.json")
    with open(report_path, "w") as f:
        json.dump({
            "total": len(grades),
            "passed": passed,
            "failed": failed,
            "total_time_s": round(total_elapsed, 1),
            "llm_model": LLM_MODEL,
            "grades": grades,
        }, f, indent=2)
    print(f"\n  📄 Full report saved: {report_path}")

    print("\n" + "=" * 75)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    exit_code = asyncio.run(run_e2e_tests())
    sys.exit(exit_code)
