"""
MCP Tools for FloatChat-AI

Two tool categories:
  1. Data Retrieval  — fetch data from MongoDB + ChromaDB (semantic search), return text/JSON
  2. Visualization   — return a ui_intent JSON for the React frontend to render charts/maps

Design principles:
  - All comparison/visualization tools take List[str] arrays — works for 1, 2, 3, or N items
  - Semantic search in ChromaDB → fetch full data from MongoDB
  - Generalized parameter fetching for any measurement type
  - Date range queries use the 'timestamp' field from MongoDB
  - Profile _id format:  core → "{platform}_{cycle:03d}"   BGC → "{platform}_{cycle:03d}_BGC"

MongoDB Schema (from actual data):
  profiles:     {_id, platform_number, cycle_number, latitude, longitude, timestamp, geo_location,
                 measurements[{pres, temp, psal, *_qc, *_adjusted, *_adjusted_error}],
                 station_parameters, n_levels, max_pres, data_mode, pi_name, project_name, ...}
  bgc_profiles: Same as above + doxy, chla, bbp700, nitrate columns in measurements +
                bgc_parameters[], contains_bgc=true.  _id has "_BGC" suffix.
  floats:       {_id=platform_number, platform_type, total_cycles, has_bgc, bgc_parameters[],
                 first_date, last_date, geo_bounding_box{min_lat,max_lat,min_lon,max_lon},
                 pi_name, project_name, data_centre, data_modes_used[]}
"""

import json
import pymongo
from datetime import datetime
from typing import List, Optional
from mcp.server.fastmcp import FastMCP

from mcp_server.config import (
    MONGO_URI, DB_NAME,
    PROFILES_COLLECTION, BGC_PROFILES_COLLECTION, FLOATS_COLLECTION,
)

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from vector_db.vector_store import ArgoVectorStore


# ─── Helpers ─────────────────────────────────────────────────────────────────

# Measurement parameter keys that exist in the database (lowercase in measurements array)
CORE_PARAMS = ["pres", "temp", "psal"]
BGC_PARAMS = ["doxy", "chla", "bbp700", "bbp532", "nitrate",
              "ph_in_situ_total", "cdom", "down_irradiance380",
              "down_irradiance412", "down_irradiance490", "downwelling_par"]
ALL_PARAMS = CORE_PARAMS + BGC_PARAMS


def _safe_date(val):
    """Safely convert a datetime or string to ISO string."""
    if val is None:
        return None
    try:
        if isinstance(val, datetime):
            return val.strftime("%Y-%m-%dT%H:%M:%SZ")
        return str(val)
    except Exception:
        return str(val)


def _parse_date(date_str: str):
    """Parse a date string into a datetime object. Supports YYYY-MM-DD and ISO formats."""
    if not date_str:
        return None
    for fmt in ["%Y-%m-%d", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S", "%Y-%m"]:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    return None


def _fetch_profile_doc(profiles_coll, bgc_coll, profile_id: str):
    """
    Look up a profile in core first, then BGC.
    Handles the fact that BGC IDs end with '_BGC'.
    """
    doc = profiles_coll.find_one({"_id": profile_id})
    if doc:
        return doc
    # Try BGC
    doc = bgc_coll.find_one({"_id": profile_id})
    if doc:
        return doc
    # Maybe user forgot _BGC suffix — try adding it
    if not profile_id.endswith("_BGC"):
        doc = bgc_coll.find_one({"_id": profile_id + "_BGC"})
    return doc


def _extract_measurements(doc, parameters: List[str], use_adjusted: bool = False):
    """
    Extract measurement data for any list of parameters from a profile document.
    Always includes depth (pres). Returns a list of dicts.
    """
    measurements = doc.get("measurements", [])
    if not measurements:
        return []

    data = []
    for m in measurements:
        point = {"depth_m": m.get("pres")}
        for param in parameters:
            p = param.lower()
            if p == "pres":
                continue  # already included as depth_m
            if use_adjusted:
                val = m.get(f"{p}_adjusted", m.get(p))
            else:
                val = m.get(p)
            point[p] = val
            # Also include QC flag if available
            qc_key = f"{p}_qc" if not use_adjusted else f"{p}_adjusted_qc"
            if qc_key in m:
                point[f"{p}_qc"] = m.get(qc_key)
        data.append(point)
    return data


def _build_date_filter(start_date: str = None, end_date: str = None) -> dict:
    """Build a MongoDB date range filter on the 'timestamp' field."""
    if not start_date and not end_date:
        return {}
    date_filter = {}
    if start_date:
        d = _parse_date(start_date)
        if d:
            date_filter["$gte"] = d
    if end_date:
        d = _parse_date(end_date)
        if d:
            date_filter["$lte"] = d
    return {"timestamp": date_filter} if date_filter else {}


# ─── Tool Registration ──────────────────────────────────────────────────────

def register_all_tools(mcp: FastMCP):
    """Register all MCP tools with the FastMCP server instance."""

    # ── DB connections ───────────────────────────────────────────────────
    client = pymongo.MongoClient(MONGO_URI)
    db = client[DB_NAME]
    profiles_coll = db[PROFILES_COLLECTION]
    bgc_coll = db[BGC_PROFILES_COLLECTION]
    floats_coll = db[FLOATS_COLLECTION]

    # ── Vector store (ChromaDB) ──────────────────────────────────────────
    vector_store = None
    try:
        vector_store = ArgoVectorStore()
    except Exception as e:
        print(f"[MCP] Warning: ChromaDB not available: {e}")

    # =====================================================================
    #  CATEGORY 1: DATA RETRIEVAL TOOLS
    # =====================================================================

    @mcp.tool()
    def search_profiles(query: str, limit: int = 5) -> str:
        """Semantic search for ocean profiles by natural language description. Searches ChromaDB embeddings and returns matching profile IDs with summaries. Use this to find profiles related to locations, features, date patterns, or phenomena."""
        if not vector_store:
            return "Vector store not available. ChromaDB is not initialized."

        results = vector_store.query_profiles(query, n_results=limit)
        if not results or not results['ids'] or not results['ids'][0]:
            return "No profiles found matching your query."

        lines = [f"Found {len(results['ids'][0])} matching profiles:"]
        for i in range(len(results['ids'][0])):
            pid = results['ids'][0][i]
            doc_text = results['documents'][0][i] if results['documents'] else ""
            meta = results['metadatas'][0][i] if results['metadatas'] else {}
            dist = results['distances'][0][i] if results['distances'] else None

            line = f"- profile_id: {pid}"
            if meta.get("platform_number"):
                line += f", float: {meta['platform_number']}"
            if meta.get("date"):
                line += f", date: {meta['date']}"
            if meta.get("latitude") and meta.get("longitude"):
                line += f", location: ({meta['latitude']}, {meta['longitude']})"
            if dist is not None:
                line += f", relevance: {1 - dist:.2f}"
            lines.append(line)
            if doc_text:
                lines.append(f"  Summary: {doc_text[:200]}")
        return "\n".join(lines)

    @mcp.tool()
    def search_bgc_profiles(bgc_parameter: str, limit: int = 5) -> str:
        """Search for BGC profiles that measure a specific biogeochemical parameter. Valid parameters: DOXY, CHLA, BBP700, NITRATE, PH_IN_SITU_TOTAL, CDOM. First tries semantic search in ChromaDB, falls back to MongoDB."""
        param_upper = bgc_parameter.upper()

        # Try semantic search first
        if vector_store:
            results = vector_store.query_bgc_profiles(
                f"BGC profile measuring {param_upper} dissolved oxygen chlorophyll",
                n_results=limit
            )
            if results and results['ids'] and results['ids'][0]:
                lines = [f"Found {len(results['ids'][0])} BGC profiles with {param_upper}:"]
                for i in range(len(results['ids'][0])):
                    pid = results['ids'][0][i]
                    doc_text = results['documents'][0][i] if results['documents'] else ""
                    meta = results['metadatas'][0][i] if results['metadatas'] else {}
                    line = f"- profile_id: {pid}"
                    if meta.get("platform_number"):
                        line += f", float: {meta['platform_number']}"
                    if meta.get("date"):
                        line += f", date: {meta['date']}"
                    lines.append(line)
                    if doc_text:
                        lines.append(f"  Summary: {doc_text[:200]}")
                return "\n".join(lines)

        # Fallback: MongoDB direct query
        query = {"bgc_parameters": param_upper}
        docs = list(bgc_coll.find(
            query,
            {"_id": 1, "platform_number": 1, "cycle_number": 1,
             "timestamp": 1, "latitude": 1, "longitude": 1, "bgc_parameters": 1}
        ).limit(limit))

        if not docs:
            return f"No BGC profiles found with parameter {param_upper}."

        lines = [f"Found {len(docs)} BGC profiles measuring {param_upper}:"]
        for d in docs:
            lines.append(
                f"- profile_id: {d['_id']}, float: {d.get('platform_number')}, "
                f"cycle: {d.get('cycle_number')}, date: {_safe_date(d.get('timestamp'))}, "
                f"lat: {d.get('latitude')}, lon: {d.get('longitude')}, "
                f"bgc_params: {d.get('bgc_parameters', [])}"
            )
        return "\n".join(lines)

    @mcp.tool()
    def get_float_info(platform_number: str) -> str:
        """Get complete metadata for a specific float: type, PI name, total cycles, date range, BGC capability, geographic bounding box, and data modes."""
        doc = floats_coll.find_one({"_id": platform_number})
        if not doc:
            return f"Float {platform_number} not found in the database."

        info = {
            "platform_number": doc["_id"],
            "platform_type": doc.get("platform_type"),
            "project_name": doc.get("project_name"),
            "pi_name": doc.get("pi_name"),
            "data_centre": doc.get("data_centre"),
            "total_cycles": doc.get("total_cycles"),
            "has_bgc": doc.get("has_bgc", False),
            "bgc_parameters": doc.get("bgc_parameters", []),
            "first_date": _safe_date(doc.get("first_date")),
            "last_date": _safe_date(doc.get("last_date")),
            "geo_bounding_box": doc.get("geo_bounding_box"),
            "data_modes_used": doc.get("data_modes_used", []),
        }
        return json.dumps(info, indent=2, default=str)

    @mcp.tool()
    def get_float_profiles(platform_number: str, limit: int = 20,
                           start_date: str = "", end_date: str = "") -> str:
        """List all profile IDs for a float with their dates and locations. Use this BEFORE get_profile_data to find valid profile IDs. Supports optional date range filtering using start_date and end_date (format: YYYY-MM-DD)."""
        query = {"platform_number": platform_number}
        date_filter = _build_date_filter(start_date or None, end_date or None)
        if date_filter:
            query.update(date_filter)

        projection = {"_id": 1, "cycle_number": 1, "latitude": 1,
                      "longitude": 1, "timestamp": 1, "n_levels": 1,
                      "station_parameters": 1, "data_mode": 1}

        docs = list(profiles_coll.find(query, projection).sort("cycle_number", 1).limit(limit))

        # Also check BGC profiles
        bgc_docs = list(bgc_coll.find(query, projection).sort("cycle_number", 1).limit(limit))

        if not docs and not bgc_docs:
            return f"No profiles found for float {platform_number}."

        total_core = profiles_coll.count_documents({"platform_number": platform_number})
        total_bgc = bgc_coll.count_documents({"platform_number": platform_number})

        lines = [f"Float {platform_number}: {total_core} core + {total_bgc} BGC profiles"]

        if docs:
            lines.append(f"\nCore profiles (showing first {len(docs)}):")
            for d in docs:
                lines.append(
                    f"- profile_id: {d['_id']}, cycle: {d.get('cycle_number')}, "
                    f"date: {_safe_date(d.get('timestamp'))}, "
                    f"lat: {d.get('latitude', '?')}, lon: {d.get('longitude', '?')}, "
                    f"levels: {d.get('n_levels', '?')}, params: {d.get('station_parameters', [])}"
                )

        if bgc_docs:
            lines.append(f"\nBGC profiles (showing first {len(bgc_docs)}):")
            for d in bgc_docs:
                lines.append(
                    f"- profile_id: {d['_id']}, cycle: {d.get('cycle_number')}, "
                    f"date: {_safe_date(d.get('timestamp'))}, "
                    f"lat: {d.get('latitude', '?')}, lon: {d.get('longitude', '?')}, "
                    f"levels: {d.get('n_levels', '?')}, params: {d.get('station_parameters', [])}"
                )

        return "\n".join(lines)

    @mcp.tool()
    def get_profile_data(profile_id: str, parameters: str = "temp,psal",
                         use_adjusted: bool = False) -> str:
        """Get measurement data for a single profile. Specify parameters as comma-separated: 'temp,psal' or 'temp,psal,doxy'. Always includes depth (pres). Profile ID format: core='1900121_002', BGC='2900765_001_BGC'. Set use_adjusted=true for quality-controlled adjusted values."""
        doc = _fetch_profile_doc(profiles_coll, bgc_coll, profile_id)
        if not doc:
            return (
                f"Profile '{profile_id}' not found. "
                f"Use get_float_profiles first to find valid profile IDs. "
                f"Note: BGC profiles end with '_BGC' suffix."
            )

        param_list = [p.strip().lower() for p in parameters.split(",")]

        # Validate parameters
        invalid = [p for p in param_list if p not in ALL_PARAMS]
        if invalid:
            available = doc.get("station_parameters", [])
            return (
                f"Invalid parameter(s): {', '.join(invalid)}. "
                f"This profile measures: {available}. "
                f"Valid keys: {', '.join(ALL_PARAMS[:8])}"
            )

        data = _extract_measurements(doc, param_list, use_adjusted)
        if not data:
            return f"No measurement data in profile {profile_id}."

        meta = {
            "profile_id": doc["_id"],
            "platform_number": doc.get("platform_number"),
            "cycle_number": doc.get("cycle_number"),
            "date": _safe_date(doc.get("timestamp")),
            "latitude": doc.get("latitude"),
            "longitude": doc.get("longitude"),
            "total_levels": len(data),
            "showing_levels": min(30, len(data)),
            "parameters_requested": param_list,
            "station_parameters": doc.get("station_parameters", []),
            "data_mode": doc.get("data_mode"),
            "max_depth_m": doc.get("max_pres"),
        }

        return json.dumps({"metadata": meta, "measurements": data[:30]}, indent=2, default=str)

    @mcp.tool()
    def get_nearest_floats(lat: float, lon: float, max_distance_km: float = 500) -> str:
        """Find unique floats near a geographic coordinate using geospatial query. Returns platform numbers and sample profile locations within the given radius."""
        max_dist_meters = max_distance_km * 1000
        try:
            docs = list(profiles_coll.find(
                {
                    "geo_location": {
                        "$nearSphere": {
                            "$geometry": {"type": "Point", "coordinates": [lon, lat]},
                            "$maxDistance": max_dist_meters
                        }
                    }
                },
                {"_id": 1, "platform_number": 1, "latitude": 1, "longitude": 1, "timestamp": 1}
            ).limit(100))
        except Exception as e:
            return f"Geospatial query error: {str(e)}. Make sure the geo_location index exists."

        if not docs:
            return f"No floats found within {max_distance_km}km of ({lat}°N, {lon}°E)."

        # Group by platform, keep closest sample
        platforms = {}
        for d in docs:
            pn = str(d.get("platform_number", ""))
            if pn and pn not in platforms:
                platforms[pn] = {
                    "sample_profile_id": d["_id"],
                    "lat": d.get("latitude"),
                    "lon": d.get("longitude"),
                    "date": _safe_date(d.get("timestamp")),
                }

        lines = [f"Found {len(platforms)} unique floats within {max_distance_km}km of ({lat}°N, {lon}°E):"]
        for pn, info in list(platforms.items())[:20]:
            lines.append(
                f"- float: {pn}, sample_profile: {info['sample_profile_id']}, "
                f"lat: {info['lat']}, lon: {info['lon']}, date: {info['date']}"
            )
        return "\n".join(lines)

    @mcp.tool()
    def aggregate_statistics(min_depth: float, max_depth: float,
                             parameter: str = "temp",
                             start_date: str = "", end_date: str = "") -> str:
        """Calculate avg/min/max statistics for a measurement parameter within a depth range and optional date range. Parameter must be one of: temp, psal, pres, doxy, chla, bbp700. Date format: YYYY-MM-DD."""
        param_key = parameter.lower()
        if param_key not in ALL_PARAMS:
            return f"Invalid parameter '{parameter}'. Valid: {', '.join(ALL_PARAMS[:8])}"

        # Use BGC collection if it's a BGC parameter
        is_bgc = param_key in BGC_PARAMS
        coll = bgc_coll if is_bgc else profiles_coll

        # Build match stage
        match_stage = {
            "measurements.pres": {"$gte": min_depth, "$lte": max_depth},
            f"measurements.{param_key}": {"$ne": None}
        }
        date_filter = _build_date_filter(start_date or None, end_date or None)
        if date_filter:
            match_stage.update(date_filter)

        pipeline = [
            {"$match": date_filter if date_filter else {}},
            {"$unwind": "$measurements"},
            {"$match": {
                "measurements.pres": {"$gte": min_depth, "$lte": max_depth},
                f"measurements.{param_key}": {"$ne": None}
            }},
            {"$group": {
                "_id": None,
                "avg": {"$avg": f"$measurements.{param_key}"},
                "min": {"$min": f"$measurements.{param_key}"},
                "max": {"$max": f"$measurements.{param_key}"},
                "count": {"$sum": 1},
                "num_profiles": {"$addToSet": "$_id"}
            }},
            {"$project": {
                "avg": 1, "min": 1, "max": 1, "count": 1,
                "num_profiles": {"$size": "$num_profiles"}
            }}
        ]

        res = list(coll.aggregate(pipeline))
        if not res:
            date_info = ""
            if start_date or end_date:
                date_info = f" between dates {start_date or '...'} and {end_date or '...'}"
            return f"No data found for '{param_key}'{date_info} between {min_depth}m and {max_depth}m depth."

        s = res[0]
        result = (
            f"Statistics for {param_key.upper()} between {min_depth}m and {max_depth}m depth:\n"
            f"- Average: {s['avg']:.4f}\n"
            f"- Min: {s['min']:.4f}\n"
            f"- Max: {s['max']:.4f}\n"
            f"- Based on {s['count']:,} measurements from {s.get('num_profiles', '?')} profiles"
        )
        if start_date or end_date:
            result += f"\n- Date range: {start_date or 'earliest'} to {end_date or 'latest'}"
        return result

    @mcp.tool()
    def get_dataset_metadata() -> str:
        """Get a summary of the entire database: total floats, profiles, BGC profiles, date coverage, available parameters, and collection counts."""
        total_floats = floats_coll.count_documents({})
        total_profiles = profiles_coll.count_documents({})
        total_bgc = bgc_coll.count_documents({})
        bgc_floats = floats_coll.count_documents({"has_bgc": True})

        return (
            f"Database summary:\n"
            f"- {total_floats} floats ({bgc_floats} with BGC sensors)\n"
            f"- {total_profiles:,} core profiles (temp, psal, pres)\n"
            f"- {total_bgc:,} BGC profiles (doxy, chla, bbp700, etc.)\n"
            f"- Coverage: Indian Ocean, 2002-2023\n"
            f"- Core measurement parameters: temp (°C), psal (PSU), pres (dbar)\n"
            f"- BGC measurement parameters: doxy, chla, bbp700, nitrate, ph_in_situ_total, cdom\n"
            f"- Profile ID format: core='1900121_002', BGC='2900765_001_BGC'\n"
            f"- Date field: 'timestamp' (when the float measured the data)"
        )

    # =====================================================================
    #  CATEGORY 2: VISUALIZATION TOOLS (UI Intents)
    # =====================================================================

    @mcp.tool()
    def visualize_float_trajectory(platform_number: str) -> str:
        """Render a Leaflet map showing a float's trajectory path over all its cycles. Returns a ui_intent with trajectory data for the frontend to render."""
        doc = floats_coll.find_one({"_id": platform_number})
        if not doc:
            return f"Float {platform_number} not found."

        # Fetch all trajectory points
        points = list(profiles_coll.find(
            {"platform_number": platform_number},
            {"latitude": 1, "longitude": 1, "timestamp": 1, "cycle_number": 1}
        ).sort("cycle_number", 1))

        trajectory = []
        for p in points:
            trajectory.append({
                "lat": p.get("latitude"),
                "lon": p.get("longitude"),
                "date": _safe_date(p.get("timestamp")),
                "cycle": p.get("cycle_number"),
            })

        summary = (
            f"Float {platform_number} ({doc.get('platform_type', '?')}): "
            f"{doc.get('total_cycles', '?')} cycles from "
            f"{_safe_date(doc.get('first_date'))} to {_safe_date(doc.get('last_date'))}. "
            f"Trajectory has {len(trajectory)} data points."
        )

        intent = {
            "type": "map_trajectory",
            "params": {
                "platform_number": platform_number,
                "total_points": len(trajectory),
            }
        }
        return json.dumps({"summary": summary, "ui_intent": intent})

    @mcp.tool()
    def visualize_profile_depth_plot(profile_id: str, parameters: str = "temp") -> str:
        """Render a depth profile chart for one or more parameters. Parameters as comma-separated: 'temp', 'temp,psal', 'temp,psal,doxy'. Returns a ui_intent for the frontend to render a Plotly chart."""
        doc = _fetch_profile_doc(profiles_coll, bgc_coll, profile_id)
        if not doc:
            return f"Profile {profile_id} not found."

        param_list = [p.strip().lower() for p in parameters.split(",")]
        summary = (
            f"Depth profile chart for {', '.join(p.upper() for p in param_list)} "
            f"on profile {doc['_id']} "
            f"(float {doc.get('platform_number')}, cycle {doc.get('cycle_number')}, "
            f"date: {_safe_date(doc.get('timestamp'))}, "
            f"lat: {doc.get('latitude')}, lon: {doc.get('longitude')})."
        )
        intent = {
            "type": "chart_depth_profile",
            "params": {
                "profile_id": doc["_id"],
                "parameters": param_list,
            }
        }
        return json.dumps({"summary": summary, "ui_intent": intent})

    @mcp.tool()
    def visualize_ts_diagram(profile_ids: List[str]) -> str:
        """Render a Temperature-Salinity scatter diagram for water mass analysis. Works with 1 to N profiles — each profile is a separate series on the T-S plot. Pass an array of any number of profile IDs."""
        valid = []
        for pid in profile_ids:
            doc = _fetch_profile_doc(profiles_coll, bgc_coll, pid)
            if doc:
                valid.append({
                    "profile_id": doc["_id"],
                    "platform_number": doc.get("platform_number"),
                    "cycle_number": doc.get("cycle_number"),
                    "date": _safe_date(doc.get("timestamp")),
                })

        if not valid:
            return f"None of the provided profile IDs were found: {profile_ids}"

        summary = (
            f"T-S Diagram for {len(valid)} profile(s): "
            f"{', '.join(v['profile_id'] for v in valid)}."
        )
        intent = {
            "type": "chart_ts_diagram",
            "params": {
                "profile_ids": [v["profile_id"] for v in valid],
                "labels": [f"{v['platform_number']}@c{v['cycle_number']}" for v in valid],
            }
        }
        return json.dumps({"summary": summary, "ui_intent": intent})

    @mcp.tool()
    def compare_profiles_depth(profile_ids: List[str], parameter: str = "temp") -> str:
        """Compare N profiles on the same depth chart. Takes an array of ANY number of profile IDs (2, 3, 5, etc.) and overlays them. Works for any parameter: temp, psal, doxy, chla, etc. Each profile becomes a separate line on the depth plot."""
        param_key = parameter.lower()
        valid = []
        for pid in profile_ids:
            doc = _fetch_profile_doc(profiles_coll, bgc_coll, pid)
            if doc:
                valid.append({
                    "profile_id": doc["_id"],
                    "platform_number": doc.get("platform_number"),
                    "cycle_number": doc.get("cycle_number"),
                    "date": _safe_date(doc.get("timestamp")),
                    "lat": doc.get("latitude"),
                    "lon": doc.get("longitude"),
                })

        if not valid:
            return f"None of the provided profile IDs were found: {profile_ids}"

        labels = [f"{v['platform_number']}@c{v['cycle_number']}" for v in valid]
        summary = (
            f"Comparing {param_key.upper()} vs depth for {len(valid)} profiles: "
            f"{', '.join(labels)}."
        )
        intent = {
            "type": "chart_comparison",
            "params": {
                "profile_ids": [v["profile_id"] for v in valid],
                "parameter": param_key,
                "labels": labels,
            }
        }
        return json.dumps({"summary": summary, "ui_intent": intent})

    @mcp.tool()
    def map_marker_display(profile_ids: List[str]) -> str:
        """Render a Leaflet map with markers pinned at profile locations. Works with any number of profiles. Each marker shows the profile's position, date, and float info."""
        locations = []
        for pid in profile_ids:
            doc = _fetch_profile_doc(profiles_coll, bgc_coll, pid)
            if doc:
                locations.append({
                    "profile_id": doc["_id"],
                    "platform_number": doc.get("platform_number"),
                    "lat": doc.get("latitude"),
                    "lon": doc.get("longitude"),
                    "date": _safe_date(doc.get("timestamp")),
                    "cycle_number": doc.get("cycle_number"),
                })

        if not locations:
            return f"None of the provided profile IDs were found: {profile_ids}"

        summary = f"Map with {len(locations)} profile markers."
        intent = {
            "type": "map_markers",
            "params": {
                "profile_ids": [loc["profile_id"] for loc in locations],
                "locations": locations,
            }
        }
        return json.dumps({"summary": summary, "ui_intent": intent})

    @mcp.tool()
    def visualize_parameter_scatter(profile_ids: List[str], param_x: str = "psal",
                                     param_y: str = "temp") -> str:
        """Plot any two parameters against each other for N profiles. Like a T-S diagram but generalized for ANY parameter pair: temp vs doxy, chla vs doxy, psal vs temp, etc. Works with core and BGC profiles. Each profile becomes a separate colored series."""
        px = param_x.lower()
        py = param_y.lower()

        for p in [px, py]:
            if p not in ALL_PARAMS:
                return f"Invalid parameter '{p}'. Valid: {', '.join(ALL_PARAMS[:8])}"

        valid = []
        for pid in profile_ids:
            doc = _fetch_profile_doc(profiles_coll, bgc_coll, pid)
            if doc:
                valid.append({
                    "profile_id": doc["_id"],
                    "platform_number": doc.get("platform_number"),
                    "cycle_number": doc.get("cycle_number"),
                    "date": _safe_date(doc.get("timestamp")),
                })

        if not valid:
            return f"None of the provided profile IDs were found: {profile_ids}"

        labels = [f"{v['platform_number']}@c{v['cycle_number']}" for v in valid]
        summary = (
            f"{px.upper()} vs {py.upper()} scatter for {len(valid)} profile(s): "
            f"{', '.join(labels)}."
        )
        intent = {
            "type": "chart_parameter_scatter",
            "params": {
                "profile_ids": [v["profile_id"] for v in valid],
                "param_x": px,
                "param_y": py,
                "labels": labels,
            }
        }
        return json.dumps({"summary": summary, "ui_intent": intent})

