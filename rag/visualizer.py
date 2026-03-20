"""
Visualization module for FloatChat-AI

When the LLM calls a visualization tool, this module fetches the actual data
from MongoDB and renders a matplotlib chart, saving it as a PNG image.

Supported chart types:
  - chart_depth_profile: Parameter vs Depth plot
  - chart_ts_diagram: Temperature-Salinity scatter
  - chart_comparison: Overlay N profiles on same depth chart
  - map_trajectory: Float trajectory on simple coordinate plot
  - map_markers: Profile locations on coordinate plot
"""

import os
import json
import pymongo
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime
from pathlib import Path


# ─── Config ──────────────────────────────────────────────────────────────────

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
DB_NAME = os.getenv("DB_NAME", "floatchat_ai")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "viz_output")

# Ensure output directory exists
Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)

# Parameter display labels and units
PARAM_LABELS = {
    "temp": "Temperature (°C)",
    "psal": "Salinity (PSU)",
    "pres": "Pressure (dbar)",
    "doxy": "Dissolved Oxygen (µmol/kg)",
    "chla": "Chlorophyll-a (mg/m³)",
    "bbp700": "BBP700 (m⁻¹)",
    "nitrate": "Nitrate (µmol/kg)",
}

# Color palette for multi-line plots
COLORS = ['#2196F3', '#FF5722', '#4CAF50', '#9C27B0', '#FF9800',
          '#00BCD4', '#E91E63', '#8BC34A', '#3F51B5', '#FFEB3B']


# ─── Style ───────────────────────────────────────────────────────────────────

def _apply_style():
    """Apply a clean oceanographic chart style."""
    plt.rcParams.update({
        'figure.facecolor': '#0a1628',
        'axes.facecolor': '#0f1f3d',
        'axes.edgecolor': '#3d5a80',
        'axes.labelcolor': '#e0e0e0',
        'text.color': '#e0e0e0',
        'xtick.color': '#b0b0b0',
        'ytick.color': '#b0b0b0',
        'grid.color': '#1a3358',
        'grid.alpha': 0.5,
        'font.size': 11,
        'axes.titlesize': 14,
        'axes.labelsize': 12,
        'legend.facecolor': '#0f1f3d',
        'legend.edgecolor': '#3d5a80',
        'figure.figsize': (10, 7),
    })


# ─── DB helpers ──────────────────────────────────────────────────────────────

def _get_db():
    client = pymongo.MongoClient(MONGO_URI)
    return client[DB_NAME]


def _fetch_profile(db, profile_id: str):
    """Fetch a profile document from core or BGC collection."""
    doc = db["profiles"].find_one({"_id": profile_id})
    if not doc:
        doc = db["bgc_profiles"].find_one({"_id": profile_id})
    if not doc and not profile_id.endswith("_BGC"):
        doc = db["bgc_profiles"].find_one({"_id": profile_id + "_BGC"})
    return doc


def _get_measurements(doc, params, use_adjusted=False):
    """Extract depth and parameter values from profile measurements."""
    measurements = doc.get("measurements", [])
    depths = []
    param_data = {p: [] for p in params}

    for m in measurements:
        depth = m.get("pres")
        if depth is None:
            continue
        depths.append(depth)
        for p in params:
            if use_adjusted:
                val = m.get(f"{p}_adjusted", m.get(p))
            else:
                val = m.get(p)
            param_data[p].append(val)

    return depths, param_data


# ─── Chart Generators ────────────────────────────────────────────────────────

def render_depth_profile(profile_id: str, parameters: list, output_path: str = None) -> str:
    """Render parameter(s) vs depth for a single profile."""
    _apply_style()
    db = _get_db()
    doc = _fetch_profile(db, profile_id)
    if not doc:
        return f"Profile {profile_id} not found."

    depths, param_data = _get_measurements(doc, parameters)
    if not depths:
        return f"No measurement data in profile {profile_id}."

    fig, axes = plt.subplots(1, len(parameters), figsize=(5 * len(parameters), 8), squeeze=False)

    for i, param in enumerate(parameters):
        ax = axes[0][i]
        values = param_data[param]
        valid_d = [d for d, v in zip(depths, values) if v is not None]
        valid_v = [v for v in values if v is not None]

        if valid_v:
            ax.plot(valid_v, valid_d, color=COLORS[i % len(COLORS)], linewidth=2, marker='o', markersize=3)
        ax.invert_yaxis()
        ax.set_xlabel(PARAM_LABELS.get(param, param.upper()))
        ax.set_ylabel("Depth (m)")
        ax.set_title(param.upper())
        ax.grid(True, alpha=0.3)

    platform = doc.get("platform_number", "?")
    cycle = doc.get("cycle_number", "?")
    date = doc.get("timestamp", "")
    date_str = date.strftime("%Y-%m-%d") if isinstance(date, datetime) else str(date)[:10]
    fig.suptitle(f"Float {platform} — Cycle {cycle} — {date_str}", fontsize=15, fontweight='bold')
    plt.tight_layout()

    if not output_path:
        output_path = os.path.join(OUTPUT_DIR, f"depth_{profile_id}.png")
    fig.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close(fig)
    return os.path.abspath(output_path)


def render_ts_diagram(profile_ids: list, output_path: str = None) -> str:
    """Render a Temperature-Salinity diagram for N profiles."""
    _apply_style()
    db = _get_db()
    fig, ax = plt.subplots(figsize=(10, 8))

    labels = []
    for i, pid in enumerate(profile_ids):
        doc = _fetch_profile(db, pid)
        if not doc:
            continue
        depths, param_data = _get_measurements(doc, ["temp", "psal"])
        temps = param_data["temp"]
        psals = param_data["psal"]

        valid_pairs = [(t, s) for t, s in zip(temps, psals) if t is not None and s is not None]
        if not valid_pairs:
            continue

        t_vals, s_vals = zip(*valid_pairs)
        platform = doc.get("platform_number", "?")
        cycle = doc.get("cycle_number", "?")
        label = f"{platform}@c{cycle}"
        labels.append(label)

        ax.scatter(s_vals, t_vals, c=COLORS[i % len(COLORS)], s=15, alpha=0.7, label=label)

    ax.set_xlabel("Salinity (PSU)")
    ax.set_ylabel("Temperature (°C)")
    ax.set_title(f"T-S Diagram — {len(labels)} profile(s)", fontsize=15, fontweight='bold')
    if labels:
        ax.legend(loc='upper left', fontsize=9)
    ax.grid(True, alpha=0.3)
    plt.tight_layout()

    if not output_path:
        output_path = os.path.join(OUTPUT_DIR, f"ts_diagram_{'_'.join(profile_ids[:3])}.png")
    fig.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close(fig)
    return os.path.abspath(output_path)


def render_comparison(profile_ids: list, parameter: str = "temp", output_path: str = None) -> str:
    """Overlay N profiles on the same depth chart for comparison."""
    _apply_style()
    db = _get_db()
    fig, ax = plt.subplots(figsize=(10, 8))

    labels = []
    for i, pid in enumerate(profile_ids):
        doc = _fetch_profile(db, pid)
        if not doc:
            continue
        depths, param_data = _get_measurements(doc, [parameter])
        values = param_data[parameter]

        valid_d = [d for d, v in zip(depths, values) if v is not None]
        valid_v = [v for v in values if v is not None]
        if not valid_v:
            continue

        platform = doc.get("platform_number", "?")
        cycle = doc.get("cycle_number", "?")
        label = f"{platform}@c{cycle}"
        labels.append(label)

        ax.plot(valid_v, valid_d, color=COLORS[i % len(COLORS)], linewidth=2,
                marker='o', markersize=3, label=label)

    ax.invert_yaxis()
    ax.set_xlabel(PARAM_LABELS.get(parameter, parameter.upper()))
    ax.set_ylabel("Depth (m)")
    ax.set_title(f"{parameter.upper()} Comparison — {len(labels)} profiles", fontsize=15, fontweight='bold')
    if labels:
        ax.legend(loc='lower right', fontsize=9)
    ax.grid(True, alpha=0.3)
    plt.tight_layout()

    if not output_path:
        output_path = os.path.join(OUTPUT_DIR, f"compare_{parameter}_{'_'.join(profile_ids[:3])}.png")
    fig.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close(fig)
    return os.path.abspath(output_path)


def render_trajectory(platform_number: str, output_path: str = None) -> str:
    """Render a float's trajectory as a line plot on a coordinate grid."""
    _apply_style()
    db = _get_db()

    points = list(db["profiles"].find(
        {"platform_number": platform_number},
        {"latitude": 1, "longitude": 1, "timestamp": 1, "cycle_number": 1}
    ).sort("cycle_number", 1))

    if not points:
        return f"No trajectory data for float {platform_number}."

    lats = [p.get("latitude") for p in points if p.get("latitude") is not None]
    lons = [p.get("longitude") for p in points if p.get("longitude") is not None]

    if not lats or not lons:
        return f"No valid coordinates for float {platform_number}."

    fig, ax = plt.subplots(figsize=(10, 8))

    # Plot trajectory line
    ax.plot(lons, lats, color='#00BCD4', linewidth=1.5, alpha=0.7)
    # Start and end markers
    ax.scatter(lons[0], lats[0], c='#4CAF50', s=100, zorder=5, marker='^', label='Start', edgecolors='white')
    ax.scatter(lons[-1], lats[-1], c='#FF5722', s=100, zorder=5, marker='v', label='End', edgecolors='white')
    # All points
    ax.scatter(lons, lats, c=range(len(lons)), cmap='viridis', s=20, alpha=0.6, zorder=3)

    ax.set_xlabel("Longitude (°E)")
    ax.set_ylabel("Latitude (°N)")

    float_doc = db["floats"].find_one({"_id": platform_number})
    type_str = float_doc.get("platform_type", "?") if float_doc else "?"
    ax.set_title(f"Float {platform_number} ({type_str}) — {len(points)} cycles", fontsize=15, fontweight='bold')
    ax.legend(loc='upper left')
    ax.grid(True, alpha=0.3)
    plt.tight_layout()

    if not output_path:
        output_path = os.path.join(OUTPUT_DIR, f"trajectory_{platform_number}.png")
    fig.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close(fig)
    return os.path.abspath(output_path)


def render_markers(profile_ids: list, locations: list = None, output_path: str = None) -> str:
    """Render map markers for a list of profiles."""
    _apply_style()
    db = _get_db()
    fig, ax = plt.subplots(figsize=(10, 8))

    if not locations:
        locations = []
        for pid in profile_ids:
            doc = _fetch_profile(db, pid)
            if doc:
                locations.append({
                    "profile_id": doc["_id"],
                    "lat": doc.get("latitude"),
                    "lon": doc.get("longitude"),
                    "platform_number": doc.get("platform_number"),
                })

    for i, loc in enumerate(locations):
        lat, lon = loc.get("lat"), loc.get("lon")
        if lat is not None and lon is not None:
            ax.scatter(lon, lat, c=COLORS[i % len(COLORS)], s=80, zorder=5,
                       marker='o', edgecolors='white', linewidth=1)
            ax.annotate(str(loc.get("platform_number", "")),
                        (lon, lat), textcoords="offset points",
                        xytext=(5, 5), fontsize=8, color='#e0e0e0')

    ax.set_xlabel("Longitude (°E)")
    ax.set_ylabel("Latitude (°N)")
    ax.set_title(f"Profile Locations — {len(locations)} markers", fontsize=15, fontweight='bold')
    ax.grid(True, alpha=0.3)
    plt.tight_layout()

    if not output_path:
        output_path = os.path.join(OUTPUT_DIR, f"markers_{'_'.join(profile_ids[:3])}.png")
    fig.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close(fig)
    return os.path.abspath(output_path)


# ─── Dispatcher ──────────────────────────────────────────────────────────────

def render_parameter_scatter(profile_ids: list, param_x: str = "psal",
                              param_y: str = "temp", output_path: str = None) -> str:
    """Generalized scatter: any param_x vs param_y for N profiles."""
    _apply_style()
    db = _get_db()
    fig, ax = plt.subplots(figsize=(10, 8))

    labels = []
    for i, pid in enumerate(profile_ids):
        doc = _fetch_profile(db, pid)
        if not doc:
            continue
        depths, param_data = _get_measurements(doc, [param_x, param_y])
        x_vals = param_data[param_x]
        y_vals = param_data[param_y]

        valid_pairs = [(x, y) for x, y in zip(x_vals, y_vals) if x is not None and y is not None]
        if not valid_pairs:
            continue

        xs, ys = zip(*valid_pairs)
        platform = doc.get("platform_number", "?")
        cycle = doc.get("cycle_number", "?")
        label = f"{platform}@c{cycle}"
        labels.append(label)

        ax.scatter(xs, ys, c=COLORS[i % len(COLORS)], s=15, alpha=0.7, label=label)

    x_label = PARAM_LABELS.get(param_x, param_x.upper())
    y_label = PARAM_LABELS.get(param_y, param_y.upper())
    ax.set_xlabel(x_label)
    ax.set_ylabel(y_label)
    ax.set_title(f"{param_x.upper()} vs {param_y.upper()} — {len(labels)} profile(s)",
                 fontsize=15, fontweight='bold')
    if labels:
        ax.legend(loc='upper left', fontsize=9)
    ax.grid(True, alpha=0.3)
    plt.tight_layout()

    if not output_path:
        output_path = os.path.join(OUTPUT_DIR, f"scatter_{param_x}_{param_y}_{'_'.join(profile_ids[:3])}.png")
    fig.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close(fig)
    return os.path.abspath(output_path)


def render_from_intent(ui_intent: dict) -> str:
    """
    Given a ui_intent dict from a visualization tool, render the chart
    and return the absolute path to the saved image file.
    """
    intent_type = ui_intent.get("type", "")
    params = ui_intent.get("params", {})

    if intent_type == "chart_depth_profile":
        return render_depth_profile(
            params.get("profile_id", ""),
            params.get("parameters", ["temp"]),
        )
    elif intent_type == "chart_ts_diagram":
        return render_ts_diagram(params.get("profile_ids", []))
    elif intent_type == "chart_comparison":
        return render_comparison(
            params.get("profile_ids", []),
            params.get("parameter", "temp"),
        )
    elif intent_type == "chart_parameter_scatter":
        return render_parameter_scatter(
            params.get("profile_ids", []),
            params.get("param_x", "psal"),
            params.get("param_y", "temp"),
        )
    elif intent_type == "map_trajectory":
        return render_trajectory(params.get("platform_number", ""))
    elif intent_type == "map_markers":
        return render_markers(
            params.get("profile_ids", []),
            params.get("locations"),
        )
    else:
        return f"Unknown visualization type: {intent_type}"

