"""
MCP Tools for FloatChat-AI

Two tool categories:
  1. Data Retrieval  — fetch data from MongoDB + ChromaDB (semantic search), return text/JSON
  2. Visualization   — return a ui_intent JSON for the React frontend to render charts/maps

Design principles:
  - Tools strictly query the exact schema ingested in Phase 1
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
import calendar
import sys
import os

from mcp.server.fastmcp import FastMCP

from mcp_server.config import (
    MONGO_URI, DB_NAME,
    PROFILES_COLLECTION, BGC_PROFILES_COLLECTION, FLOATS_COLLECTION,
)

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


def _normalize_date_str(date_str: str) -> str:
    """
    Normalize a date string to ISO 8601 format for string comparison.
    MongoDB stores timestamps as ISO strings like '2002-11-11T09:20:28Z'.
    Input may be 'YYYY-MM-DD' or 'YYYY-MM' or full ISO.
    """
    if not date_str:
        return ""
    date_str = date_str.strip()
    # Already full ISO
    if "T" in date_str:
        return date_str
    # YYYY-MM-DD -> start of day
    if len(date_str) == 10:  # 2021-07-01
        return date_str + "T00:00:00Z"
    # YYYY-MM -> start of month
    if len(date_str) == 7:  # 2021-07
        return date_str + "-01T00:00:00Z"
    return date_str


def _normalize_end_date_str(date_str: str) -> str:
    """
    Normalize an end date string to end-of-day/month ISO format.
    """
    if not date_str:
        return ""
    date_str = date_str.strip()
    if "T" in date_str:
        return date_str
    if len(date_str) == 10:  # 2021-07-31
        return date_str + "T23:59:59Z"
    if len(date_str) == 7:  # 2021-07
        # Get last day of month
        try:
            dt = datetime.strptime(date_str + "-01", "%Y-%m-%d")
            last_day = calendar.monthrange(dt.year, dt.month)[1]
            return f"{date_str}-{last_day:02d}T23:59:59Z"
        except Exception:
            return date_str + "-28T23:59:59Z"
    return date_str


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
    """
    Build a MongoDB date range filter on the 'timestamp' field.
    IMPORTANT: timestamps are stored as ISO 8601 strings in MongoDB,
    so we use string comparison (which works correctly for ISO dates).
    """
    if not start_date and not end_date:
        return {}
    date_filter = {}
    if start_date:
        iso = _normalize_date_str(start_date)
        if iso:
            date_filter["$gte"] = iso
    if end_date:
        iso = _normalize_end_date_str(end_date)
        if iso:
            date_filter["$lte"] = iso
    return {"timestamp": date_filter} if date_filter else {}


# ─── Tool Registration ──────────────────────────────────────────────────────

def register_all_tools(mcp: FastMCP):
    """Register all MCP tools with the FastMCP server instance."""

    # ── DB connections ───────────────────────────────────────────────────
    try:
        client = pymongo.MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        db = client[DB_NAME]
        db.command('ping')
        profiles_coll = db[PROFILES_COLLECTION]
        bgc_coll = db[BGC_PROFILES_COLLECTION]
        floats_coll = db[FLOATS_COLLECTION]
    except Exception as e:
        print(f"[MCP] ERROR: MongoDB connection failed: {e}")
        raise

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
    def search_profiles(region: str = "", start_date: str = "", end_date: str = "", 
                       limit: int = 10) -> str:
        """Find core profiles matching specific location, date, or semantic descriptions.
        
        Inputs:
        - region (optional): region name or description for semantic search
        - start_date (optional): ISO date or YYYY-MM-DD format
        - end_date (optional): ISO date or YYYY-MM-DD format
        - limit: max results to return (1-1000)
        
        Uses hybrid search: ChromaDB for semantic query + MongoDB for temporal/spatial filtering.
        Returns structured JSON data of all matching profiles."""
        
        try:
            # Validate limit
            limit = min(max(1, limit), 1000)
            
            query_parts = []
            if region:
                query_parts.append(region)
            if start_date or end_date:
                dates = " ".join([d for d in [start_date, end_date] if d])
                query_parts.append(f"from {dates}")
            query = " ".join(query_parts) if query_parts else "all ocean profiles"
            
            # Try semantic search first
            profile_ids = []
            if vector_store:
                try:
                    results = vector_store.query_profiles(query, n_results=min(limit*2, 100))
                    if results and results.get('ids') and results['ids'][0]:
                        profile_ids = results['ids'][0][:limit]
                except Exception as e:
                    print(f"[search_profiles] ChromaDB error: {e}")
            
            # Fallback: MongoDB query with date filter
            if not profile_ids:
                date_filter = _build_date_filter(start_date or None, end_date or None)
                query_filter = date_filter if date_filter else {}
                docs = list(profiles_coll.find(
                    query_filter,
                    {"_id": 1, "platform_number": 1, "latitude": 1, "longitude": 1, 
                     "timestamp": 1, "station_parameters": 1}
                ).sort("timestamp", -1).limit(limit))
                profile_ids = [d["_id"] for d in docs]
            
            # Fetch full data for returned profiles
            profiles_data = []
            for pid in profile_ids:
                try:
                    doc = profiles_coll.find_one({"_id": pid})
                    if doc:
                        profiles_data.append({
                            "profile_id": doc["_id"],
                            "platform_number": doc.get("platform_number"),
                            "cycle_number": doc.get("cycle_number"),
                            "date": _safe_date(doc.get("timestamp")),
                            "latitude": doc.get("latitude"),
                            "longitude": doc.get("longitude"),
                            "n_levels": doc.get("n_levels"),
                            "max_depth": doc.get("max_pres"),
                            "parameters": doc.get("station_parameters", [])
                        })
                except Exception as e:
                    print(f"[search_profiles] Error fetching {pid}: {e}")
                    continue
            
            if not profiles_data:
                return json.dumps({
                    "query": query,
                    "count": 0,
                    "profiles": [],
                    "message": "No profiles found matching criteria"
                }, indent=2, default=str)
            
            return json.dumps({
                "query": query,
                "count": len(profiles_data),
                "profiles": profiles_data
            }, indent=2, default=str)
        except Exception as e:
            return json.dumps({
                "error": str(e),
                "query": query if 'query' in locals() else "",
                "profiles": []
            }, indent=2, default=str)

    @mcp.tool()
    def search_bgc_profiles(region: str = "", bgc_parameter: str = "", limit: int = 10) -> str:
        """Search for BGC profiles specifically by parameter (DOXY, CHLA, etc.) and region.
        
        Inputs:
        - region (optional): region name for filtering
        - bgc_parameter (optional): parameter like 'DOXY', 'CHLA', 'BBP700', 'NITRATE'
        - limit: max results
        
        Backend Flow: MongoDB query on bgc_profiles collection where contains_bgc=true 
        and bgc_parameters array contains the requested parameter.
        Returns: Structured JSON data of all matching profiles."""
        
        try:
            limit = min(max(1, limit), 1000)
            query_filter = {"contains_bgc": True}
            
            if bgc_parameter:
                param_upper = bgc_parameter.upper()
                # Validate parameter name
                if param_upper not in BGC_PARAMS:
                    return json.dumps({
                        "error": f"Invalid BGC parameter '{bgc_parameter}'",
                        "valid_parameters": BGC_PARAMS,
                        "profiles": []
                    }, indent=2, default=str)
                query_filter["bgc_parameters"] = param_upper
            
            docs = list(bgc_coll.find(
                query_filter,
                {"_id": 1, "platform_number": 1, "cycle_number": 1, "timestamp": 1,
                 "latitude": 1, "longitude": 1, "bgc_parameters": 1, "n_levels": 1, "max_pres": 1}
            ).sort("timestamp", -1).limit(limit))
            
            profiles_data = []
            for d in docs:
                try:
                    profiles_data.append({
                        "profile_id": d["_id"],
                        "platform_number": d.get("platform_number"),
                        "cycle_number": d.get("cycle_number"),
                        "date": _safe_date(d.get("timestamp")),
                        "latitude": d.get("latitude"),
                        "longitude": d.get("longitude"),
                        "n_levels": d.get("n_levels"),
                        "max_depth": d.get("max_pres"),
                        "bgc_parameters": d.get("bgc_parameters", [])
                    })
                except Exception as e:
                    print(f"[search_bgc_profiles] Error processing {d.get('_id')}: {e}")
                    continue
            
            if not profiles_data:
                return json.dumps({
                    "region": region or "any",
                    "bgc_parameter": bgc_parameter or "any",
                    "count": 0,
                    "profiles": [],
                    "message": "No BGC profiles found matching criteria"
                }, indent=2, default=str)
            
            return json.dumps({
                "region": region or "any",
                "bgc_parameter": bgc_parameter or "any",
                "count": len(profiles_data),
                "profiles": profiles_data
            }, indent=2, default=str)
        except Exception as e:
            return json.dumps({
                "error": str(e),
                "profiles": []
            }, indent=2, default=str)

    @mcp.tool()
    def get_float_info(platform_number: str) -> str:
        """Get all technical metadata for a specific float.
        
        Inputs: platform_number (string)
        
        Backend Flow: Queries the aggregated MongoDB floats collection by platform_number.
        Extracts platform_type, total_cycles, first_date, last_date, geo_bounding_box, and bgc_parameters.
        Returns: Comprehensive string describing the float."""
        try:
            if not platform_number or not isinstance(platform_number, str):
                return json.dumps({"error": "Invalid platform_number: must be non-empty string"}, indent=2)
            
            doc = floats_coll.find_one({"_id": platform_number})
            if not doc:
                return json.dumps({
                    "error": f"Float {platform_number} not found in the database.",
                    "platform_number": platform_number
                }, indent=2)

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
        except Exception as e:
            print(f"[get_float_info] Error: {e}")
            return json.dumps({"error": f"Error fetching float info: {str(e)}"}, indent=2)

    @mcp.tool()
    def get_profile_data(profile_id: str, use_adjusted: bool = False) -> str:
        """Retrieve the exact raw measurement numerical data for a single profile.
        
        Inputs:
        - profile_id (string): e.g. '1900121_001' (core) or '2900765_001_BGC' (BGC)
        - use_adjusted (boolean): if true, use adjusted values; otherwise raw
        
        Backend Flow: Queries profiles or bgc_profiles by _id. Extracts the measurements array.
        If use_adjusted is true, yields temp_adjusted, otherwise raw temp.
        Returns: Array of {depth: pres, temperature: temp, salinity: psal, ...} dicts.
        CRITICAL: Returns ALL measurement levels — NEVER truncates."""
        
        try:
            if not profile_id or not isinstance(profile_id, str):
                return json.dumps({
                    "error": "profile_id must be a non-empty string",
                    "example": "1900121_001 or 2900765_001_BGC"
                }, indent=2)
            
            doc = _fetch_profile_doc(profiles_coll, bgc_coll, profile_id)
            if not doc:
                return json.dumps({
                    "error": f"Profile '{profile_id}' not found",
                    "note": "Use search_profiles first to find valid profile IDs",
                    "profile_id": profile_id
                }, indent=2)

            # Extract all available measurements
            measurements = doc.get("measurements", [])
            if not measurements:
                return json.dumps({
                    "error": f"No measurement data in profile {profile_id}",
                    "profile_id": profile_id
                }, indent=2)

            # Build full measurement data (ALL levels, no truncation!)
            data = []
            for m in measurements:
                point = {
                    "depth_m": m.get("pres"),
                    "temperature": m.get("temp_adjusted" if use_adjusted else "temp"),
                    "salinity": m.get("psal_adjusted" if use_adjusted else "psal"),
                }
                # Add BGC parameters if present
                for param in BGC_PARAMS:
                    param_key = f"{param}_adjusted" if use_adjusted else param
                    if param_key in m or param in m:
                        val = m.get(param_key) or m.get(param)
                        if val is not None:
                            point[param] = val
                data.append(point)

            result = {
                "metadata": {
                    "profile_id": doc["_id"],
                    "platform_number": doc.get("platform_number"),
                    "cycle_number": doc.get("cycle_number"),
                    "date": _safe_date(doc.get("timestamp")),
                    "latitude": doc.get("latitude"),
                    "longitude": doc.get("longitude"),
                    "total_levels": len(data),
                    "max_depth": doc.get("max_pres"),
                    "use_adjusted": use_adjusted,
                    "station_parameters": doc.get("station_parameters", [])
                },
                "measurements": data  # ALL levels, NEVER truncated!
            }
            return json.dumps(result, indent=2, default=str)
        except Exception as e:
            return json.dumps({
                "error": str(e),
                "profile_id": profile_id
            }, indent=2)

    @mcp.tool()
    def get_nearest_floats(lat: float, lon: float, max_distance_km: float = 500) -> str:
        """Find floats physically operating near a specific coordinate.
        
        Inputs:
        - lat (float): latitude (-90 to 90)
        - lon (float): longitude (-180 to 180)
        - max_distance_km (float): search radius in kilometers
        
        Backend Flow: MongoDB $nearSphere query on the geo_location 2dsphere index 
        of the profiles collection to find recent coordinates. Use $group to get unique platform_numbers.
        Returns: List of nearby float IDs and distances."""
        
        try:
            # Validate input coordinates
            if lat < -90 or lat > 90:
                return json.dumps({
                    "error": f"Invalid latitude {lat}: must be between -90 and 90"
                }, indent=2)
            if lon < -180 or lon > 180:
                return json.dumps({
                    "error": f"Invalid longitude {lon}: must be between -180 and 180"
                }, indent=2)
            
            # Validate distance
            max_distance_km = max(1, max_distance_km)
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
                    {"_id": 1, "platform_number": 1, "latitude": 1, "longitude": 1, 
                     "timestamp": 1, "cycle_number": 1}
                ).limit(100))
            except Exception as e:
                return json.dumps({
                    "error": f"Geospatial query error: {str(e)}",
                    "note": "Make sure the geo_location 2dsphere index exists on profiles collection"
                }, indent=2)

            if not docs:
                return json.dumps({
                    "query_location": {"latitude": lat, "longitude": lon},
                    "max_distance_km": max_distance_km,
                    "floats_found": 0,
                    "floats": [],
                    "message": f"No floats found within {max_distance_km}km"
                }, indent=2)

            # Group by platform, get first occurrence (closest)
            platforms = {}
            for d in docs:
                pn = str(d.get("platform_number", ""))
                if pn and pn not in platforms:
                    lat2 = d.get("latitude")
                    lon2 = d.get("longitude")
                    
                    # Calculate distance (simplified)
                    distance_km = None
                    if lat2 is not None and lon2 is not None:
                        # Haversine formula - simplified
                        dlat = lat2 - lat
                        dlon = lon2 - lon
                        distance_km = ((dlat**2 + dlon**2) ** 0.5) * 111.32
                    
                    platforms[pn] = {
                        "platform_number": pn,
                        "sample_profile_id": d["_id"],
                        "latest_cycle": d.get("cycle_number"),
                        "latitude": lat2,
                        "longitude": lon2,
                        "latest_date": _safe_date(d.get("timestamp")),
                        "distance_km": round(distance_km, 2) if distance_km is not None else None
                    }

            result = {
                "query_location": {"latitude": lat, "longitude": lon},
                "max_distance_km": max_distance_km,
                "floats_found": len(platforms),
                "floats": sorted(list(platforms.values()), 
                               key=lambda x: x.get("distance_km") or 999999)[:20]
            }
            return json.dumps(result, indent=2, default=str)
        except Exception as e:
            return json.dumps({
                "error": str(e),
                "floats": []
            }, indent=2)

    @mcp.tool()
    def aggregate_statistics(parameter: str = "temp", min_depth: float = 0, 
                             max_depth: float = 100, start_date: str = "", 
                             end_date: str = "") -> str:
        """Calculate statistical averages across thousands of measurements.
        
        Inputs:
        - parameter (string): 'temp', 'psal', 'doxy', 'chla', etc.
        - min_depth (float): minimum pressure in dbar
        - max_depth (float): maximum pressure in dbar
        - start_date, end_date: optional date range (YYYY-MM-DD)
        
        Backend Flow: MongoDB Aggregation Pipeline:
          1. $match profiles via depth and parameter availability
          2. $unwind the measurements array
          3. $match where measurements.pres >= min_depth and <= max_depth
          4. $group to $avg, $min, $max the measurements.<parameter>
        Returns: Numerical averages"""
        
        try:
            param_key = parameter.lower()
            if param_key not in ALL_PARAMS:
                return json.dumps({
                    "error": f"Invalid parameter '{parameter}'",
                    "valid_parameters": ALL_PARAMS
                }, indent=2)

            # Validate depth range
            if min_depth < 0 or max_depth < 0 or min_depth > max_depth:
                return json.dumps({
                    "error": f"Invalid depth range: {min_depth} to {max_depth}",
                    "note": "min_depth must be >= 0 and <= max_depth"
                }, indent=2)

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
                {"$match": match_stage},
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
            if not res or res[0].get("avg") is None:
                return json.dumps({
                    "error": f"No data found for parameter '{param_key}' between {min_depth}m and {max_depth}m depth",
                    "depth_range": {"min": min_depth, "max": max_depth},
                    "parameter": param_key
                }, indent=2)

            s = res[0]
            result = {
                "parameter": param_key.upper(),
                "depth_range": {"min": min_depth, "max": max_depth},
                "statistics": {
                    "average": round(float(s['avg']), 4),
                    "minimum": round(float(s['min']), 4),
                    "maximum": round(float(s['max']), 4),
                    "measurement_count": s['count'],
                    "profile_count": s.get('num_profiles', 0)
                },
                "date_range": {
                    "start": start_date or "earliest",
                    "end": end_date or "latest"
                }
            }
            return json.dumps(result, indent=2, default=str)
        except Exception as e:
            return json.dumps({
                "error": str(e),
                "parameter": parameter if 'parameter' in locals() else ""
            }, indent=2)

    @mcp.tool()
    def get_mean_for_given_parameter_of_profile(profile_id: str, parameter: str = "temp",
                                                 use_adjusted: bool = False) -> str:
        """Calculate mean value for given parameter of a profile.
        
        Inputs:
        - profile_id (string): profile ID
        - parameter (string): 'temp', 'pres', 'psal', etc.
        - use_adjusted (boolean)
        
        Backend Flow: Queries profiles or bgc_profiles by _id. Extracts the measurements array 
        and gets the mean of temp / pres / psal values inside profile depending on parameter.
        Returns: Numerical averages (e.g., 'Avg temp for float with id 1900121_001 is 28.5°C')."""
        try:
            if not profile_id or not isinstance(profile_id, str):
                return json.dumps({
                    "error": "Invalid profile_id: must be non-empty string"
                }, indent=2)
            
            if not parameter or not isinstance(parameter, str):
                return json.dumps({
                    "error": "Invalid parameter: must be non-empty string"
                }, indent=2)
            
            doc = _fetch_profile_doc(profiles_coll, bgc_coll, profile_id)
            if not doc:
                return json.dumps({
                    "error": f"Profile '{profile_id}' not found",
                    "profile_id": profile_id
                }, indent=2)

            param_key = parameter.lower()
            if param_key not in ALL_PARAMS:
                return json.dumps({
                    "error": f"Invalid parameter '{parameter}'",
                    "valid_parameters": sorted(list(ALL_PARAMS))
                }, indent=2)

            measurements = doc.get("measurements", [])
            if not measurements:
                return json.dumps({
                    "error": f"No measurements found in profile {profile_id}",
                    "profile_id": profile_id
                }, indent=2)
            
            values = []
            for m in measurements:
                if use_adjusted:
                    val = m.get(f"{param_key}_adjusted", m.get(param_key))
                else:
                    val = m.get(param_key)
                if val is not None and isinstance(val, (int, float)):
                    values.append(val)

            if not values:
                return json.dumps({
                    "error": f"No valid numeric {param_key} data in profile {profile_id}",
                    "profile_id": profile_id,
                    "parameter": param_key
                }, indent=2)

            mean_val = sum(values) / len(values)
            result = {
                "profile_id": doc["_id"],
                "platform_number": doc.get("platform_number"),
                "cycle_number": doc.get("cycle_number"),
                "date": _safe_date(doc.get("timestamp")),
                "parameter": param_key.upper(),
                "mean": round(mean_val, 4),
                "min": round(min(values), 4),
                "max": round(max(values), 4),
                "data_point_count": len(values),
                "use_adjusted": use_adjusted
            }
            return json.dumps(result, indent=2, default=str)
        except Exception as e:
            print(f"[get_mean_for_given_parameter_of_profile] Error: {e}")
            return json.dumps({"error": f"Error calculating parameter mean: {str(e)}"}, indent=2)

    @mcp.tool()
    def get_dataset_metadata() -> str:
        """Helps the LLM understand what data is actually available in the whole database.
        
        Returns: Total float counts, date coverage, geographic coverage, available parameters, etc."""
        
        try:
            total_floats = floats_coll.count_documents({})
            total_profiles = profiles_coll.count_documents({})
            total_bgc = bgc_coll.count_documents({})
            bgc_floats = floats_coll.count_documents({"has_bgc": True})

            # Get date range
            first_doc = list(profiles_coll.find({}).sort("timestamp", 1).limit(1))
            last_doc = list(profiles_coll.find({}).sort("timestamp", -1).limit(1))
            
            first_date = _safe_date(first_doc[0].get("timestamp")) if first_doc else "unknown"
            last_date = _safe_date(last_doc[0].get("timestamp")) if last_doc else "unknown"

            # Get geographic bounds
            pipeline_bounds = [
                {"$group": {
                    "_id": None,
                    "min_lat": {"$min": "$latitude"},
                    "max_lat": {"$max": "$latitude"},
                    "min_lon": {"$min": "$longitude"},
                    "max_lon": {"$max": "$longitude"}
                }}
            ]
            bounds = list(profiles_coll.aggregate(pipeline_bounds))
            geo_bounds = bounds[0] if bounds else {}

            metadata = {
                "summary": {
                    "total_floats": total_floats,
                    "floats_with_bgc": bgc_floats,
                    "total_core_profiles": total_profiles,
                    "total_bgc_profiles": total_bgc,
                    "total_profiles": total_profiles + total_bgc
                },
                "date_coverage": {
                    "start": first_date,
                    "end": last_date
                },
                "geographic_coverage": {
                    "latitude_range": [
                        geo_bounds.get("min_lat"),
                        geo_bounds.get("max_lat")
                    ],
                    "longitude_range": [
                        geo_bounds.get("min_lon"),
                        geo_bounds.get("max_lon")
                    ]
                },
                "core_parameters": {
                    "temperature": "temp (°C)",
                    "salinity": "psal (PSU)",
                    "pressure": "pres (dbar)"
                },
                "bgc_parameters": BGC_PARAMS,
                "profile_id_format": {
                    "core": "{platform}_{cycle:03d}",
                    "bgc": "{platform}_{cycle:03d}_BGC"
                },
                "timestamp_field": "ISO 8601 strings when float measured data"
            }
            return json.dumps(metadata, indent=2, default=str)
        except Exception as e:
            return json.dumps({
                "error": str(e),
                "summary": {
                    "total_floats": 0,
                    "total_profiles": 0,
                    "total_bgc_profiles": 0
                }
            }, indent=2)

    # =====================================================================
    #  CATEGORY 2: VISUALIZATION TOOLS (UI Intents)
    # =====================================================================

    @mcp.tool()
    @mcp.tool()
    def visualize_float_trajectory(platform_number: str) -> str:
        """Track a specific float → renders a Leaflet path map.
        
        Inputs: platform_number (string)
        
        Backend Flow: MongoDB query on floats for the geo_bounding_box and total_cycles 
        to formulate the text summary.
        Frontend Intent: {"type": "map_trajectory", "params": {"platform_number": "1900121"}}"""
        try:
            if not platform_number or not isinstance(platform_number, str):
                return json.dumps({"error": "Invalid platform_number: must be non-empty string"}, indent=2)
            
            doc = floats_coll.find_one({"_id": platform_number})
            if not doc:
                return json.dumps({
                    "error": f"Float {platform_number} not found"
                }, indent=2)

            # Fetch all trajectory points
            points = list(profiles_coll.find(
                {"platform_number": platform_number},
                {"latitude": 1, "longitude": 1, "timestamp": 1, "cycle_number": 1}
            ).sort("cycle_number", 1))

            trajectory = []
            for p in points:
                lat = p.get("latitude")
                lon = p.get("longitude")
                if lat is not None and lon is not None:
                    trajectory.append({
                        "lat": lat,
                        "lon": lon,
                        "date": _safe_date(p.get("timestamp")),
                        "cycle": p.get("cycle_number"),
                    })

            if not trajectory:
                return json.dumps({
                    "error": f"No trajectory points found for float {platform_number}"
                }, indent=2)

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
                    "trajectory": trajectory,
                }
            }
            return json.dumps({"summary": summary, "ui_intent": intent}, default=str)
        except Exception as e:
            print(f"[visualize_float_trajectory] Error: {e}")
            return json.dumps({"error": f"Error fetching trajectory: {str(e)}"}, indent=2)

    @mcp.tool()
    def visualize_profile_depth_plot(profile_id: str, parameter: str = "TEMP") -> str:
        """Depth charts → renders interactive Plotly Temp/Salinity vs Depth.
        
        Inputs:
        - profile_id (string)
        - parameter (string): 'TEMP', 'PSAL', 'DOXY', 'CHLA', etc.
        
        Backend Flow: Queries measurements array in MongoDB to find max_pres 
        and min/max of the specific parameter to build the text summary.
        Frontend Intent: {"type": "chart_depth_profile", 
                          "params": {"profile_id": "1900121_001", "parameter": "TEMP"}}"""
        try:
            if not profile_id or not isinstance(profile_id, str):
                return json.dumps({"error": "Invalid profile_id: must be non-empty string"}, indent=2)
            
            doc = _fetch_profile_doc(profiles_coll, bgc_coll, profile_id)
            if not doc:
                return json.dumps({
                    "error": f"Profile {profile_id} not found"
                }, indent=2)

            param_key = parameter.lower()
            if param_key not in ALL_PARAMS:
                return json.dumps({
                    "error": f"Invalid parameter '{parameter}'",
                    "valid_parameters": sorted(list(ALL_PARAMS))
                }, indent=2)
            
            data = _extract_measurements(doc, [param_key])
            if not data:
                return json.dumps({
                    "error": f"No {parameter} data in profile {profile_id}",
                    "profile_id": profile_id,
                    "parameter": parameter
                }, indent=2)

            summary = (
                f"Depth profile chart for {parameter} on profile {doc['_id']} "
                f"(float {doc.get('platform_number')}, cycle {doc.get('cycle_number')}, "
                f"date: {_safe_date(doc.get('timestamp'))}, "
                f"lat: {doc.get('latitude')}, lon: {doc.get('longitude')})."
            )
            intent = {
                "type": "chart_depth_profile",
                "params": {
                    "profile_id": doc["_id"],
                    "platform_number": doc.get("platform_number"),
                    "cycle_number": doc.get("cycle_number"),
                    "date": _safe_date(doc.get("timestamp")),
                    "parameter": param_key,
                    "data": data,
                }
            }
            return json.dumps({"summary": summary, "ui_intent": intent}, default=str)
        except Exception as e:
            print(f"[visualize_profile_depth_plot] Error: {e}")
            return json.dumps({"error": f"Error fetching profile depth plot: {str(e)}"}, indent=2)

    @mcp.tool()
    @mcp.tool()
    def visualize_ts_diagram(profile_ids: List[str]) -> str:
        """Water mass analysis → renders a Temp-Salinity scatter plot.
        
        Inputs: profile_ids (array of strings)
        
        Backend Flow: Validates MongoDB profiles exist with station_parameters 
        containing both TEMP and PSAL.
        Frontend Intent: {"type": "chart_ts_diagram", "params": {"profile_ids": [...]}}"""
        try:
            if not profile_ids or not isinstance(profile_ids, list):
                return json.dumps({"error": "Invalid profile_ids: must be non-empty list of strings"}, indent=2)
            
            if len(profile_ids) > 20:
                return json.dumps({"error": f"Too many profiles for T-S diagram ({len(profile_ids)}). Max 20 allowed."}, indent=2)
            
            valid = []
            for pid in profile_ids:
                if not isinstance(pid, str) or not pid:
                    continue
                doc = _fetch_profile_doc(profiles_coll, bgc_coll, pid)
                if doc:
                    data = _extract_measurements(doc, ["temp", "psal"])
                    if data:
                        valid.append({
                            "profile_id": doc["_id"],
                            "platform_number": doc.get("platform_number"),
                            "cycle_number": doc.get("cycle_number"),
                            "date": _safe_date(doc.get("timestamp")),
                            "data": data,
                        })

            if not valid:
                return json.dumps({
                    "error": f"None of the provided profile IDs were found or had TEMP/PSAL data: {profile_ids}"
                }, indent=2)

            summary = (
                f"T-S Diagram for {len(valid)} profile(s): "
                f"{', '.join(v['profile_id'] for v in valid)}."
            )
            intent = {
                "type": "chart_ts_diagram",
                "params": {
                    "profiles": [
                        {
                            "profile_id": v["profile_id"],
                            "label": f"{v['platform_number']}@c{v['cycle_number']}",
                            "data": v["data"],
                        } for v in valid
                    ],
                }
            }
            return json.dumps({"summary": summary, "ui_intent": intent}, default=str)
        except Exception as e:
            print(f"[visualize_ts_diagram] Error: {e}")
            return json.dumps({"error": f"Error rendering T-S diagram: {str(e)}"}, indent=2)

    @mcp.tool()
    def compare_profiles_depth(profile_ids: List[str], parameter: str = "TEMP") -> str:
        """Overlay multiple profiles on the same chart.
        
        Inputs:
        - profile_ids (array of strings)
        - parameter (string)
        
        Backend Flow: Validates all IDs exist in MongoDB and have the requested parameter.
        Frontend Intent: {"type": "chart_comparison", 
                          "params": {"profile_ids": [...], "parameter": "DOXY"}}"""
        try:
            if not profile_ids or not isinstance(profile_ids, list):
                return json.dumps({"error": "Invalid profile_ids: must be non-empty list of strings"}, indent=2)
            
            if len(profile_ids) > 10:
                return json.dumps({"error": f"Too many profiles to compare ({len(profile_ids)}). Max 10 allowed."}, indent=2)
            
            param_key = parameter.lower()
            if param_key not in ALL_PARAMS:
                return json.dumps({
                    "error": f"Invalid parameter '{parameter}'",
                    "valid_parameters": sorted(list(ALL_PARAMS))
                }, indent=2)
            
            valid = []
            for pid in profile_ids:
                if not isinstance(pid, str) or not pid:
                    continue
                doc = _fetch_profile_doc(profiles_coll, bgc_coll, pid)
                if doc:
                    data = _extract_measurements(doc, [param_key])
                    if data:
                        valid.append({
                            "profile_id": doc["_id"],
                            "platform_number": doc.get("platform_number"),
                            "cycle_number": doc.get("cycle_number"),
                            "date": _safe_date(doc.get("timestamp")),
                            "data": data,
                        })

            if not valid:
                return json.dumps({
                    "error": f"None of the provided profile IDs were found or had {parameter} data: {profile_ids}"
                }, indent=2)

            summary = (
                f"Comparing {parameter} vs depth for {len(valid)} profiles: "
                f"{', '.join(v['profile_id'] for v in valid)}."
            )
            intent = {
                "type": "chart_comparison",
                "params": {
                    "parameter": param_key,
                    "profiles": [
                        {
                            "profile_id": v["profile_id"],
                            "label": f"{v['platform_number']}@c{v['cycle_number']}",
                            "data": v["data"],
                        } for v in valid
                    ],
                }
            }
            return json.dumps({"summary": summary, "ui_intent": intent}, default=str)
        except Exception as e:
            print(f"[compare_profiles_depth] Error: {e}")
            return json.dumps({"error": f"Error comparing profiles: {str(e)}"}, indent=2)

    @mcp.tool()
    def map_marker_display(profile_ids: List[str]) -> str:
        """Take a list of profiles (found via search_profiles or get_nearest_floats) 
        and render them as pins on a map.
        
        Inputs: profile_ids (array of strings)
        
        Backend Flow: None (the LLM passes IDs it already obtained from previous Data tools).
        Frontend Intent: {"type": "map_markers", "params": {"profile_ids": [...]}}"""
        try:
            if not profile_ids or not isinstance(profile_ids, list):
                return json.dumps({"error": "Invalid profile_ids: must be non-empty list of strings"}, indent=2)
            
            if len(profile_ids) > 100:
                return json.dumps({"error": f"Too many profiles to map ({len(profile_ids)}). Max 100 allowed."}, indent=2)
            
            locations = []
            for pid in profile_ids:
                if not isinstance(pid, str) or not pid:
                    continue
                doc = _fetch_profile_doc(profiles_coll, bgc_coll, pid)
                if doc:
                    lat = doc.get("latitude")
                    lon = doc.get("longitude")
                    if lat is not None and lon is not None:
                        locations.append({
                            "profile_id": doc["_id"],
                            "platform_number": doc.get("platform_number"),
                            "lat": lat,
                            "lon": lon,
                            "date": _safe_date(doc.get("timestamp")),
                            "cycle_number": doc.get("cycle_number"),
                        })

            if not locations:
                return json.dumps({
                    "error": f"None of the provided profile IDs were found or had valid coordinates: {profile_ids}"
                }, indent=2)

            summary = f"Map with {len(locations)} profile markers."
            intent = {
                "type": "map_markers",
                "params": {
                    "profile_ids": [loc["profile_id"] for loc in locations],
                    "locations": locations,
                }
            }
            return json.dumps({"summary": summary, "ui_intent": intent})
        except Exception as e:
            print(f"[map_marker_display] Error: {e}")
            return json.dumps({"error": f"Error displaying map markers: {str(e)}"}, indent=2)
