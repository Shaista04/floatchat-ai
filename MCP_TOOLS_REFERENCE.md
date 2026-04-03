# MCP Tools Complete Reference Guide

> **Version**: 2.0
> **Last Updated**: March 2026
> **Architecture**: HLD/LLD compliant
> **LLM**: OpenRouter Qwen3.5-397B

---

## Table of Contents

1. [Data Retrieval Tools](#data-retrieval-tools)
2. [Visualization Tools](#visualization-tools)
3. [Analytics Tools](#analytics-tools)
4. [UI Card Tools](#ui-card-tools)
5. [Tool Response Formats](#tool-response-formats)
6. [Usage Examples](#usage-examples)

---

## Data Retrieval Tools

### get_float_info

**Purpose**: Get comprehensive metadata for a specific ARGO float.

```javascript
{
  name: 'get_float_info',
  parameters: {
    platform: 'string' (required) // 7-digit platform ID, e.g., "1900121"
  }
}
```

**Returns**:

```json
{
  "platform_number": "1900121",
  "float_serial_no": "763",
  "platform_type": "Provor",
  "data_centre": "IN",
  "pi_name": "...",
  "project_name": "...",
  "total_cycles": 87,
  "has_bgc": false,
  "bgc_parameters": [],
  "first_date": "2002-11-17T...",
  "last_date": "2010-08-...",
  "geo_bounding_box": { "lat_min": -9.857, "lat_max": 23.5, ... },
  ...
}
```

**Use When**: User asks about a specific float (e.g., "Tell me about float 1900121")

---

### get_float_profiles

**Purpose**: List all profiles (cycles) for a specific float.

```javascript
{
  name: 'get_float_profiles',
  parameters: {
    platform: 'string' (required),
    cycle: 'number' (optional)   // Specific cycle number
  }
}
```

**Returns**: Array of profile objects

```json
[
  {
    "_id": "ObjectId(...)",
    "platform_number": "1900121",
    "cycle_number": 1,
    "latitude": -9.857,
    "longitude": 55.953,
    "timestamp": "2002-11-17T...",
    "max_pres": 2010,
    "quality_flag": "1"
  },
  ...
]
```

**Use When**: User wants to see all profiles for a float or a specific cycle

---

### nearest_floats

**Purpose**: Find float profiles near geographic coordinates.

```javascript
{
  name: 'nearest_floats',
  parameters: {
    lat: 'number' (required),        // Latitude -90 to 90
    lon: 'number' (required),        // Longitude -180 to 180
    radius_km: 'number' (optional),  // Default 300 km
    limit: 'number' (optional)       // Default 20, max suggested 100
  }
}
```

**Returns**: Array of nearby profiles (sorted by distance, closest first)

```json
[
  {
    "platform_number": "2902277",
    "cycle_number": 45,
    "latitude": 15.2,
    "longitude": 80.1,
    "timestamp": "2024-03-10T...",
    "distance_km": 12.3
  },
  ...
]
```

**Use When**: User asks about floats near a location (e.g., "floats operating near 15°N 80°E")

---

### search_profiles

**Purpose**: Search for profiles by date range, with optional geographic filter.

```javascript
{
  name: 'search_profiles',
  parameters: {
    date_start: 'string' (required),  // YYYY-MM-DD or ISO 8601
    date_end: 'string' (required),
    lat_min: 'number' (optional),
    lat_max: 'number' (optional),
    lon_min: 'number' (optional),
    lon_max: 'number' (optional)
  }
}
```

**Returns**: Array of profiles within date range (and optional bounding box)

```json
[
  {
    "platform_number": "1900121",
    "cycle_number": 45,
    "latitude": 10.2,
    "longitude": 72.5,
    "timestamp": "2023-06-15T12:00:00Z",
    "max_pres": 1987,
    "contains_bgc": false
  },
  ...
]
```

**Use When**: User asks for profiles in a date range or region (e.g., "profiles from June 2023" or "profiles in Arabian Sea between May-August 2023")

---

### search_bgc_profiles

**Purpose**: Search for biogeochemical profiles in a region.

```javascript
{
  name: 'search_bgc_profiles',
  parameters: {
    lat_min: 'number' (optional, default -90),
    lat_max: 'number' (optional, default 90),
    lon_min: 'number' (optional, default -180),
    lon_max: 'number' (optional, default 180),
    limit: 'number' (optional, default 100)
  }
}
```

**Returns**: Array of BGC profile records with oxygen, chlorophyll-a, nitrate, pH, etc.

**Use When**: User asks about biogeochemical measurements (e.g., "BGC profiles with chlorophyll-a measurements")

---

### profiles_by_region

**Purpose**: Get ARGO profiles within a geographic bounding box.

```javascript
{
  name: 'profiles_by_region',
  parameters: {
    lat_min: 'number' (required),
    lat_max: 'number' (required),
    lon_min: 'number' (required),
    lon_max: 'number' (required),
    limit: 'number' (optional, default 200, max 1000)
  }
}
```

**Returns**: Array of profiles in the region (most recent first)

**Use When**: User specifies a geographic region (e.g., "show me profiles between 10°N-20°N and 70°E-80°E")

---

### get_profile_data

**Purpose**: Retrieve full measurement data for a specific profile.

```javascript
{
  name: 'get_profile_data',
  parameters: {
    profile_id: 'string' (required),  // Profile MongoDB ObjectId or reference
    use_adjusted: 'boolean' (optional) // Use adjusted values instead of raw
  }
}
```

**Returns**: Complete profile with measurements array

```json
{
  "_id": "...",
  "platform_number": "1900121",
  "cycle_number": 1,
  "latitude": -9.857,
  "longitude": 55.953,
  "measurements": [
    { "pres": 10, "temp": 28.5, "temp_adjusted": 28.51, "psal": 35.2, "pres_adjusted": 10.1 },
    { "pres": 25, "temp": 28.3, "psal": 35.3 },
    ...
  ]
}
```

**Use When**: User wants exact measurement values (e.g., "get raw temperature data for profile XYZ")

---

### get_dataset_metadata

**Purpose**: Get overall statistics about the dataset.

```javascript
{
  name: 'get_dataset_metadata',
  parameters: {} // No parameters
}
```

**Returns**:

```json
{
  "total_profiles": 87523,
  "activeFloats": 567,
  "total_bgc_profiles": 13445,
  "bgcCoverage": "42.3%",
  "date_range": {
    "first": "2002-01-15T...",
    "last": "2024-03-20T..."
  },
  "regions_covered": ["Arabian Sea", "Bay of Bengal", "Equatorial Indian Ocean", ...],
  "bgc_parameters_available": ["DOXY", "CHLA", "NITRATE", "PH", "CDOM"]
}
```

**Use When**: User asks about dataset overview (e.g., "how many floats", "what data do you have")

---

## Visualization Tools

All visualization tools return Plotly.js or Leaflet map configurations that React renders.

### visualize_depth_profile

**Purpose**: Create a depth profile chart showing parameter vs depth.

```javascript
{
  name: 'visualize_depth_profile',
  parameters: {
    platform: 'string' (optional),           // Single float
    platforms: 'array[string]' (optional),   // Multiple floats
    param: 'enum' (optional, default "TEMP") // TEMP|PSAL|DOXY|CHLA|NITRATE|PRES
  }
}
```

**Returns**: Plotly configuration with traces

```json
{
  "tool": "visualize_depth_profile",
  "type": "plotly",
  "plotly": {
    "data": [
      {
        "x": [28.5, 28.3, 27.9, ...],    // Temperature values
        "y": [-10, -25, -50, ...],        // Depths (negative inverted)
        "mode": "lines+markers",
        "name": "1900121 C1",
        "type": "scatter"
      }
    ],
    "layout": {
      "title": "TEMP Depth Profile",
      "xaxis": { "title": "Temperature (°C)" },
      "yaxis": { "title": "Depth (m)" }
    }
  }
}
```

**Output**: Interactive scatter plot with depth on Y-axis, parameter on X-axis

**Use When**: User asks for depth profile, vertical profile, or "plot X vs depth"

---

### visualize_ts_diagram

**Purpose**: Create a Temperature-Salinity diagram (water mass analysis).

```javascript
{
  name: 'visualize_ts_diagram',
  parameters: {
    platform: 'string' (optional),          // Single float
    platforms: 'array[string]' (optional),  // Multiple for comparison
    lat_min: 'number' (optional),
    lat_max: 'number' (optional),
    lon_min: 'number' (optional),
    lon_max: 'number' (optional)
  }
}
```

**Output**: Scatter plot with Temperature on Y-axis, Salinity on X-axis

- Each point represents a measurement
- Multiple series for different floats/profiles
- Color-coded by platform

**Use When**: User asks for "T-S diagram", "temperature-salinity plot", or "water mass analysis"

---

### visualize_trajectory

**Purpose**: Show float movement path on a map.

```javascript
{
  name: 'visualize_trajectory',
  parameters: {
    platform: 'string' (required)  // Single float platform ID
  }
}
```

**Output**: Leaflet map with:

- Polyline connecting all profile positions (sorted by cycle)
- Markers at each cycle location
- Popup with cycle number and date

**Use When**: User asks for "trajectory", "float path", "where did float X go"

---

### visualize_float_map

**Purpose**: Show positions of multiple floats on a map.

```javascript
{
  name: 'visualize_float_map',
  parameters: {
    lat_min: 'number' (optional),
    lat_max: 'number' (optional),
    lon_min: 'number' (optional),
    lon_max: 'number' (optional),
    date_start: 'string' (optional),  // YYYY-MM-DD
    date_end: 'string' (optional),
    limit: 'number' (optional, default 200)
  }
}
```

**Output**: Leaflet map with markers for each profile location

**Use When**: User asks for "map of floats", "show floats on map", "where are the measurements"

---

### visualize_time_series

**Purpose**: Plot parameter values across cycles over time.

```javascript
{
  name: 'visualize_time_series',
  parameters: {
    platform: 'string' (required),
    param: 'enum' (optional, default "TEMP"),  // TEMP|PSAL|DOXY|CHLA|NITRATE
    depth: 'number' (optional)  // Fixed depth for subsurface time series
  }
}
```

**Output**: Line plot with:

- X: Cycle number or date
- Y: Mean parameter value per cycle
- Error bars: Range (max-min)/2

**Use When**: User asks for "temperature over time", "salinity trends", "parameter changes"

---

### visualize_heatmap

**Purpose**: Show parameter values across depth and cycles.

```javascript
{
  name: 'visualize_heatmap',
  parameters: {
    platform: 'string' (required),
    param: 'string' (required)  // TEMP, PSAL, DOXY, etc.
  }
}
```

**Output**: Heatmap with:

- X: Cycle
- Y: Depth
- Color: Parameter value
- Color scale: RdBu for TEMP, Viridis for others

**Use When**: User asks for "heatmap", "parameter heatmap", "temporal-depth visualization"

---

### visualize_comparison_bar

**Purpose**: Compare parameter statistics between two regions.

```javascript
{
  name: 'visualize_comparison_bar',
  parameters: {
    region1: 'object' (required),  // { lat_min, lat_max, lon_min, lon_max }
    region2: 'object' (required),
    param: 'string' (optional, default "PSAL")
  }
}
```

**Output**: Grouped bar chart comparing Mean, Std Dev, Min, Max between regions

**Use When**: User asks for "compare regions", "regional comparison"

---

## Analytics Tools

### parameter_stats

**Purpose**: Calculate statistics for a parameter across profiles.

```javascript
{
  name: 'parameter_stats',
  parameters: {
    profiles: 'array[string]' (optional),  // Profile IDs
    param: 'string' (optional, default "PSAL")
  }
}
```

**Returns**:

```json
{
  "mean": 35.12,
  "std": 0.34,
  "min": 34.2,
  "max": 35.8,
  "count": 1245
}
```

---

### time_series_stats

**Purpose**: Get statistics per cycle for a float over time.

```javascript
{
  name: 'time_series_stats',
  parameters: {
    platform: 'string' (required),
    param: 'string' (optional, default "TEMP"),
    cycles: 'array[2]' (optional)  // [start_cycle, end_cycle]
  }
}
```

**Returns**: Array of stats per cycle

```json
[
  { "cycle": 1, "timestamp": "2002-11-17T...", "mean": 28.5, "min": 25.3, "max": 29.1, "count": 234 },
  ...
]
```

---

### compare_regions

**Purpose**: Compare parameter statistics between two geographic regions.

```javascript
{
  name: 'compare_regions',
  parameters: {
    region1: 'object' (required),
    region2: 'object' (required),
    param: 'string' (optional, default "PSAL"),
    limit: 'number' (optional, default 100)
  }
}
```

**Returns**:

```json
{
  "region1": {
    "count": 234,
    "stats": { "mean": 35.1, "std": 0.31, "min": 34.5, "max": 35.8 }
  },
  "region2": {
    "count": 567,
    "stats": { "mean": 35.3, "std": 0.42, "min": 34.2, "max": 36.1 }
  }
}
```

---

## UI Card Tools

### get_metadata_card

Returns float metadata for display in a card UI component.

**Parameters**: `platform` (string)

**Output**: Float record with all metadata fields

---

### get_data_table

Returns profiles in tabular format.

**Parameters**: `platform` (optional), `date_start`, `date_end` (optional)

**Output**: Array of rows with columns: platform_number, cycle_number, date, latitude, longitude, max_pres

---

### get_stats_card

Returns statistics for a parameter of a specific float.

**Parameters**: `platform` (string, required), `param` (string, default "PSAL")

**Output**: Statistics object with mean, std, min, max, count

---

## Tool Response Formats

### Standard Data Response

```json
{
  "tool": "tool_name",
  "type": "data",
  "data": { ... }
}
```

### Plotly Visualization Response

```json
{
  "tool": "tool_name",
  "type": "plotly",
  "plotly": {
    "data": [ ... ],
    "layout": { ... }
  }
}
```

### Leaflet Map Response

```json
{
  "tool": "tool_name",
  "type": "leaflet",
  "center": [latitude, longitude],
  "zoom": 5,
  "markers": [ { "lat": ..., "lon": ..., "popup": "..." } ],
  "polyline": [ [lat, lon], [lat, lon], ... ]
}
```

### Error Response

```json
{
  "tool": "tool_name",
  "type": "data",
  "error": "Error message",
  "data": null
}
```

---

## Usage Examples

### Example 1: "Show me profiles near Mumbai in the last month"

**Intent Detected**: `nearest_floats` + `search_profiles`

**LLM Tool Calls**:

1. `nearest_floats` with lat=19.08, lon=72.88, radius_km=500, limit=50
2. `visualize_float_map` with lat_min=15, lat_max=23, lon_min=68, lon_max=77, date_start=(1 month ago), date_end=(today)

---

### Example 2: "Compare temperature profiles in the Arabian Sea vs Bay of Bengal"

**Intent Detected**: `compare_regions`

**LLM Tool Calls**:

1. `compare_regions` with:
   - region1: { lat_min: 5, lat_max: 25, lon_min: 50, lon_max: 75 } // Arabian Sea
   - region2: { lat_min: 5, lat_max: 23, lon_min: 75, lon_max: 95 } // Bay of Bengal
   - param: "TEMP"

2. `visualize_comparison_bar` with same regions

---

### Example 3: "Get all BGC profiles and show the distribution"

**Intent Detected**: `search_bgc_profiles`

**LLM Tool Calls**:

1. `search_bgc_profiles` with lat_min=-60, lat_max=30, lon_min=20, lon_max=120, limit=200
2. `visualize_float_map` to show distribution

---

### Example 4: "Analyze float 1900121 in detail"

**Intent Detected**: `get_float_info`

**LLM Tool Calls**:

1. `get_float_info` platform="1900121"
2. `visualize_trajectory` platform="1900121"
3. `get_data_table` platform="1900121"
4. `get_stats_card` platform="1900121", param="TEMP"

---

## OpenRouter Integration Notes

All tools are integrated with OpenRouter Qwen3.5-397B via:

1. **Function Schemas**: Passed to LLM for tool selection
2. **Tool Dispatch**: `mcpService.runTool(toolName, params)`
3. **Result Formatting**: Returned with type indicator for frontend rendering
4. **Error Handling**: Graceful fallback to MongoDB-only if ChromaDB unavailable

---

**Reference**: See `HLD.jpeg` and `LLD.jpeg` for architecture diagrams
**Latest Guide**: See `MCP_TOOLS_SETUP_GUIDE.md`
**Accuracy**: See `MCP_TOOLS_ACCURACY_FIXES.md`
