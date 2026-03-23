"""
Visualization module for FloatChat-AI

ARCHITECTURE RULE: This module NEVER queries MongoDB.
All data comes pre-fetched in the ui_intent payload from MCP tools.
This module ONLY renders charts from the data it receives.

Supported chart types:
  - chart_depth_profile: Parameter vs Depth plot
  - chart_ts_diagram: Temperature-Salinity scatter
  - chart_comparison: Overlay N profiles on same depth chart
  - chart_parameter_scatter: Any X vs Y scatter
  - chart_time_series: Parameter over time at one depth
  - chart_depth_histogram: Depth distribution histogram
  - chart_parameter_correlation: Multi-parameter correlation
  - chart_bgc_distribution: BGC parameter value histogram
  - chart_section: Depth-section colored by parameter
  - map_trajectory: Float trajectory on coordinate plot
  - map_markers: Profile locations on coordinate plot
  - map_density: Float density heatmap
  - map_heatmap: Parameter geographic heatmap
"""

import os
import json
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import numpy as np
from datetime import datetime
from pathlib import Path


# ─── Config ──────────────────────────────────────────────────────────────────

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "viz_output")
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


# ─── Chart Generators (NO DB ACCESS — data comes from ui_intent) ────────────

def render_depth_profile(params: dict, output_path: str = None) -> str:
    """Render parameter(s) vs depth for a single profile. Data from ui_intent."""
    try:
        _apply_style()
        data = params.get("data", [])
        parameters = params.get("parameters", ["temp"])
        profile_id = params.get("profile_id", "?")
        platform = params.get("platform_number", "?")
        cycle = params.get("cycle_number", "?")
        date_str = str(params.get("date", ""))[:10]

        if not data:
            return f"No measurement data to plot."

        # Filter out parameters with no valid data
        valid_params = []
        for param in parameters:
            values = [d.get(param) for d in data if d.get(param) is not None]
            if values:
                valid_params.append(param)
        
        if not valid_params:
            return f"No valid data for any requested parameters."

        fig, axes = plt.subplots(1, len(valid_params), figsize=(5 * len(valid_params), 8), squeeze=False)

        for i, param in enumerate(valid_params):
            ax = axes[0][i] if len(valid_params) > 1 else axes[0][0]
            depths = [d.get("depth_m") for d in data]
            values = [d.get(param) for d in data]
            valid_d = [d for d, v in zip(depths, values) if d is not None and v is not None]
            valid_v = [v for d, v in zip(depths, values) if d is not None and v is not None]

            if valid_v:
                ax.plot(valid_v, valid_d, color=COLORS[i % len(COLORS)], linewidth=2, marker='o', markersize=3)
            ax.invert_yaxis()
            ax.set_xlabel(PARAM_LABELS.get(param, param.upper()))
            ax.set_ylabel("Depth (m)")
            ax.set_title(param.upper())
            ax.grid(True, alpha=0.3)

        fig.suptitle(f"Float {platform} — Cycle {cycle} — {date_str}", fontsize=15, fontweight='bold')
        plt.tight_layout()

        if not output_path:
            output_path = os.path.join(OUTPUT_DIR, f"depth_{profile_id}.png")
        fig.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close(fig)
        return os.path.abspath(output_path)
    except Exception as e:
        print(f"[render_depth_profile] Error: {e}")
        return f"Error rendering depth profile: {str(e)}"


def render_ts_diagram(params: dict, output_path: str = None) -> str:
    """Render a Temperature-Salinity diagram. Data from ui_intent."""
    try:
        _apply_style()
        profiles = params.get("profiles", [])
        fig, ax = plt.subplots(figsize=(10, 8))

        labels = []
        for i, prof in enumerate(profiles):
            data = prof.get("data", [])
            label = prof.get("label", f"Profile {i}")
            temps = [d.get("temp") for d in data if d.get("temp") is not None]
            psals = [d.get("psal") for d in data if d.get("psal") is not None]

            if not temps or not psals or len(temps) != len(psals):
                continue

            # Find common indices for valid temp-sal pairs
            valid_pairs = []
            for j in range(len(data)):
                t = data[j].get("temp")
                s = data[j].get("psal")
                if t is not None and s is not None:
                    valid_pairs.append((t, s))
            
            if not valid_pairs:
                continue

            t_vals, s_vals = zip(*valid_pairs)
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
            pids = [p.get("profile_id", "?") for p in profiles[:3]]
            output_path = os.path.join(OUTPUT_DIR, f"ts_diagram_{'_'.join(str(p) for p in pids)}.png")
        fig.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close(fig)
        return os.path.abspath(output_path)
    except Exception as e:
        print(f"[render_ts_diagram] Error: {e}")
        return f"Error rendering T-S diagram: {str(e)}"


def render_comparison(params: dict, output_path: str = None) -> str:
    """Overlay N profiles on the same depth chart. Data from ui_intent."""
    try:
        _apply_style()
        profiles = params.get("profiles", [])
        parameter = params.get("parameter", "temp")
        
        if not profiles:
            return "No profile data to compare."
        
        fig, ax = plt.subplots(figsize=(10, 8))

        labels = []
        for i, prof in enumerate(profiles):
            data = prof.get("data", [])
            if not data:
                continue
            label = prof.get("label", f"Profile {i}")
            depths = [d.get("depth_m") for d in data]
            values = [d.get(parameter) for d in data]

            valid_d = [d for d, v in zip(depths, values) if d is not None and v is not None]
            valid_v = [v for d, v in zip(depths, values) if d is not None and v is not None]
            if not valid_v:
                continue

            labels.append(label)
            ax.plot(valid_v, valid_d, color=COLORS[i % len(COLORS)], linewidth=2,
                    marker='o', markersize=3, label=label)

        if not labels:
            return "No valid data found in any profile to compare."
        
        ax.invert_yaxis()
        ax.set_xlabel(PARAM_LABELS.get(parameter, parameter.upper()))
        ax.set_ylabel("Depth (m)")
        ax.set_title(f"{parameter.upper()} Comparison — {len(labels)} profiles", fontsize=15, fontweight='bold')
        ax.legend(loc='lower right', fontsize=9)
        ax.grid(True, alpha=0.3)
        plt.tight_layout()

        if not output_path:
            pids = [p.get("profile_id", "?") for p in profiles[:3]]
            output_path = os.path.join(OUTPUT_DIR, f"compare_{parameter}_{'_'.join(str(p) for p in pids)}.png")
        fig.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close(fig)
        return os.path.abspath(output_path)
    except Exception as e:
        print(f"[render_comparison] Error: {e}")
        return f"Error rendering comparison: {str(e)}"


def render_trajectory(params: dict, output_path: str = None) -> str:
    """Render a float's trajectory. Data from ui_intent."""
    try:
        _apply_style()
        trajectory = params.get("trajectory", [])
        platform_number = params.get("platform_number", "?")

        if not trajectory:
            return f"No trajectory data to plot."

        lats = [p.get("lat") for p in trajectory if p.get("lat") is not None]
        lons = [p.get("lon") for p in trajectory if p.get("lon") is not None]

        if not lats or not lons or len(lats) != len(lons):
            return f"Invalid or incomplete coordinates in trajectory data."

        fig, ax = plt.subplots(figsize=(10, 8))
        ax.plot(lons, lats, color='#00BCD4', linewidth=1.5, alpha=0.7)
        if lats and lons:
            ax.scatter(lons[0], lats[0], c='#4CAF50', s=100, zorder=5, marker='^', label='Start', edgecolors='white')
            ax.scatter(lons[-1], lats[-1], c='#FF5722', s=100, zorder=5, marker='v', label='End', edgecolors='white')
        ax.scatter(lons, lats, c=range(len(lons)), cmap='viridis', s=20, alpha=0.6, zorder=3)

        ax.set_xlabel("Longitude (°E)")
        ax.set_ylabel("Latitude (°N)")
        ax.set_title(f"Float {platform_number} — {len(trajectory)} cycles", fontsize=15, fontweight='bold')
        ax.legend(loc='upper left')
        ax.grid(True, alpha=0.3)
        plt.tight_layout()

        if not output_path:
            output_path = os.path.join(OUTPUT_DIR, f"trajectory_{platform_number}.png")
        fig.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close(fig)
        return os.path.abspath(output_path)
    except Exception as e:
        print(f"[render_trajectory] Error: {e}")
        return f"Error rendering trajectory: {str(e)}"


def render_markers(params: dict, output_path: str = None) -> str:
    """Render map markers for profiles. Data from ui_intent."""
    try:
        _apply_style()
        locations = params.get("locations", [])
        profile_ids = params.get("profile_ids", [])
        
        if not locations:
            return "No location data to plot."
        
        valid_locs = [loc for loc in locations if loc.get("lat") is not None and loc.get("lon") is not None]
        if not valid_locs:
            return "No valid coordinates found in location data."
        
        fig, ax = plt.subplots(figsize=(10, 8))

        for i, loc in enumerate(valid_locs):
            lat, lon = loc.get("lat"), loc.get("lon")
            ax.scatter(lon, lat, c=COLORS[i % len(COLORS)], s=80, zorder=5,
                       marker='o', edgecolors='white', linewidth=1)
            ax.annotate(str(loc.get("platform_number", "")),
                        (lon, lat), textcoords="offset points",
                        xytext=(5, 5), fontsize=8, color='#e0e0e0')

        ax.set_xlabel("Longitude (°E)")
        ax.set_ylabel("Latitude (°N)")
        ax.set_title(f"Profile Locations — {len(valid_locs)} markers", fontsize=15, fontweight='bold')
        ax.grid(True, alpha=0.3)
        plt.tight_layout()

        if not output_path:
            output_path = os.path.join(OUTPUT_DIR, f"markers_{'_'.join(str(p) for p in profile_ids[:3])}.png")
        fig.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close(fig)
        return os.path.abspath(output_path)
    except Exception as e:
        print(f"[render_markers] Error: {e}")
        return f"Error rendering markers: {str(e)}"


def render_parameter_scatter(params: dict, output_path: str = None) -> str:
    """Generalized scatter: any param_x vs param_y. Data from ui_intent."""
    try:
        _apply_style()
        profiles = params.get("profiles", [])
        param_x = params.get("param_x", "psal")
        param_y = params.get("param_y", "temp")
        
        if not profiles:
            return "No profile data to scatter."
        
        fig, ax = plt.subplots(figsize=(10, 8))

        labels = []
        for i, prof in enumerate(profiles):
            data = prof.get("data", [])
            if not data:
                continue
            label = prof.get("label", f"Profile {i}")
            x_vals = [d.get(param_x) for d in data]
            y_vals = [d.get(param_y) for d in data]

            valid_pairs = [(x, y) for x, y in zip(x_vals, y_vals) if x is not None and y is not None]
            if not valid_pairs:
                continue

            xs, ys = zip(*valid_pairs)
            labels.append(label)
            ax.scatter(xs, ys, c=COLORS[i % len(COLORS)], s=15, alpha=0.7, label=label)

        if not labels:
            return "No valid data pairs found in profiles."
        
        x_label = PARAM_LABELS.get(param_x, param_x.upper())
        y_label = PARAM_LABELS.get(param_y, param_y.upper())
        ax.set_xlabel(x_label)
        ax.set_ylabel(y_label)
        ax.set_title(f"{param_x.upper()} vs {param_y.upper()} — {len(labels)} profile(s)",
                     fontsize=15, fontweight='bold')
        ax.legend(loc='upper left', fontsize=9)
        ax.grid(True, alpha=0.3)
        plt.tight_layout()

        if not output_path:
            pids = [p.get("profile_id", "?") for p in profiles[:3]]
            output_path = os.path.join(OUTPUT_DIR, f"scatter_{param_x}_{param_y}_{'_'.join(str(p) for p in pids)}.png")
        fig.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close(fig)
        return os.path.abspath(output_path)
    except Exception as e:
        print(f"[render_parameter_scatter] Error: {e}")
        return f"Error rendering scatter plot: {str(e)}"


def render_time_series(params: dict, output_path: str = None) -> str:
    """Render a time series chart. Data from ui_intent."""
    try:
        _apply_style()
        data = params.get("data", [])
        parameter = params.get("parameter", "temp")
        platform_number = params.get("platform_number", "?")
        depth_level = params.get("depth_level", "?")

        if not data:
            return "No time series data to plot."

        dates = []
        values = []
        for d in data:
            try:
                dt = datetime.strptime(str(d.get("date", ""))[:10], "%Y-%m-%d")
                dates.append(dt)
                values.append(d.get("value"))
            except (ValueError, TypeError):
                continue

        if not dates or not values:
            return "Could not parse time series dates or no valid values found."

        fig, ax = plt.subplots(figsize=(12, 6))
        ax.plot(dates, values, color='#2196F3', linewidth=2, marker='o', markersize=4)
        ax.set_xlabel("Date")
        ax.set_ylabel(PARAM_LABELS.get(parameter, parameter.upper()))
        ax.set_title(f"Float {platform_number} — {parameter.upper()} at ~{depth_level}m",
                     fontsize=15, fontweight='bold')
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m'))
        plt.xticks(rotation=45)
        ax.grid(True, alpha=0.3)
        plt.tight_layout()

        if not output_path:
            output_path = os.path.join(OUTPUT_DIR, f"timeseries_{platform_number}_{parameter}.png")
        fig.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close(fig)
        return os.path.abspath(output_path)
    except Exception as e:
        print(f"[render_time_series] Error: {e}")
        return f"Error rendering time series: {str(e)}"


def render_depth_histogram(params: dict, output_path: str = None) -> str:
    """Render depth distribution histogram. Data from ui_intent."""
    try:
        _apply_style()
        data = params.get("data", [])
        if not data:
            return "No histogram data to plot."

        bins = [d.get("depth_bin", 0) for d in data]
        counts = [d.get("count", 0) for d in data]
        
        if not bins or not counts or len(bins) != len(counts):
            return "Invalid bin or count data in histogram."

        fig, ax = plt.subplots(figsize=(10, 6))
        ax.bar(bins, counts, width=80, color='#2196F3', edgecolor='#1565C0', alpha=0.8)
        ax.set_xlabel("Max Depth (m)")
        ax.set_ylabel("Number of Profiles")
        ax.set_title("Profile Depth Distribution", fontsize=15, fontweight='bold')
        ax.grid(True, alpha=0.3, axis='y')
        plt.tight_layout()

        if not output_path:
            output_path = os.path.join(OUTPUT_DIR, "depth_histogram.png")
        fig.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close(fig)
        return os.path.abspath(output_path)
    except Exception as e:
        print(f"[render_depth_histogram] Error: {e}")
        return f"Error rendering depth histogram: {str(e)}"


def render_bgc_distribution(params: dict, output_path: str = None) -> str:
    """Render BGC parameter value distribution. Data from ui_intent."""
    try:
        _apply_style()
        values = params.get("values", [])
        parameter = params.get("parameter", "?")
        depth_range = params.get("depth_range", [0, 200])

        if not values:
            return "No distribution data to plot."
        
        numeric_values = [v for v in values if isinstance(v, (int, float))]
        if not numeric_values:
            return "No numeric values in distribution data."

        fig, ax = plt.subplots(figsize=(10, 6))
        ax.hist(numeric_values, bins=50, color='#4CAF50', edgecolor='#2E7D32', alpha=0.8)
        ax.set_xlabel(PARAM_LABELS.get(parameter, parameter.upper()))
        ax.set_ylabel("Frequency")
        ax.set_title(f"{parameter.upper()} Distribution ({depth_range[0]}-{depth_range[1]}m)",
                     fontsize=15, fontweight='bold')
        ax.grid(True, alpha=0.3, axis='y')
        plt.tight_layout()

        if not output_path:
            output_path = os.path.join(OUTPUT_DIR, f"distribution_{parameter}.png")
        fig.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close(fig)
        return os.path.abspath(output_path)
    except Exception as e:
        print(f"[render_bgc_distribution] Error: {e}")
        return f"Error rendering BGC distribution: {str(e)}"


def render_section_plot(params: dict, output_path: str = None) -> str:
    """Render a depth-section plot. Data from ui_intent."""
    try:
        _apply_style()
        sections = params.get("sections", [])
        parameter = params.get("parameter", "temp")

        if not sections:
            return "No section data to plot."

        fig, ax = plt.subplots(figsize=(12, 8))
        points_plotted = 0

        for sec in sections:
            data = sec.get("data", [])
            if not data:
                continue
            idx = sec.get("index", 0)
            for d in data:
                depth = d.get("depth_m")
                val = d.get(parameter)
                if depth is not None and val is not None and isinstance(depth, (int, float)) and isinstance(val, (int, float)):
                    ax.scatter(idx, depth, c=val, cmap='RdYlBu_r', s=30, zorder=3)
                    points_plotted += 1

        if points_plotted == 0:
            return "No valid depth-value pairs found in section data."
        
        ax.invert_yaxis()
        ax.set_xlabel("Profile Index")
        ax.set_ylabel("Depth (m)")
        ax.set_title(f"Section Plot — {parameter.upper()} across {len(sections)} profiles",
                     fontsize=15, fontweight='bold')

        # Add labels
        labels = [s.get("label", str(s.get("index", ""))) for s in sections]
        if labels:
            ax.set_xticks(range(len(labels)))
            ax.set_xticklabels(labels, rotation=45, fontsize=8)
        ax.grid(True, alpha=0.3)
        plt.tight_layout()

        if not output_path:
            output_path = os.path.join(OUTPUT_DIR, f"section_{parameter}.png")
        fig.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close(fig)
        return os.path.abspath(output_path)
    except Exception as e:
        print(f"[render_section_plot] Error: {e}")
        return f"Error rendering section plot: {str(e)}"


def render_density_map(params: dict, output_path: str = None) -> str:
    """Render float density map. Data from ui_intent."""
    try:
        _apply_style()
        data = params.get("data", [])
        grid_size = params.get("grid_size", 5.0)

        if not data:
            return "No density data to plot."

        lats = [d.get("lat") for d in data if d.get("lat") is not None]
        lons = [d.get("lon") for d in data if d.get("lon") is not None]
        counts = [d.get("profile_count", 0) for d in data]
        
        if not lats or not lons or len(lats) != len(lons):
            return "Invalid or incomplete coordinate data in density map."

        fig, ax = plt.subplots(figsize=(12, 8))
        scatter = ax.scatter(lons, lats, c=counts, cmap='YlOrRd', s=200, alpha=0.7,
                             edgecolors='white', linewidth=0.5)
        plt.colorbar(scatter, ax=ax, label='Profile Count')

        ax.set_xlabel("Longitude (°E)")
        ax.set_ylabel("Latitude (°N)")
        ax.set_title(f"Float Density Map ({grid_size}° grid)", fontsize=15, fontweight='bold')
        ax.grid(True, alpha=0.3)
        plt.tight_layout()

        if not output_path:
            output_path = os.path.join(OUTPUT_DIR, "density_map.png")
        fig.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close(fig)
        return os.path.abspath(output_path)
    except Exception as e:
        print(f"[render_density_map] Error: {e}")
        return f"Error rendering density map: {str(e)}"


def render_heatmap(params: dict, output_path: str = None) -> str:
    """Render geographic heatmap of parameter averages. Data from ui_intent."""
    try:
        _apply_style()
        data = params.get("data", [])
        parameter = params.get("parameter", "temp")
        depth_range = params.get("depth_range", [0, 50])

        if not data:
            return "No heatmap data to plot."

        lats = [d.get("lat") for d in data if d.get("lat") is not None]
        lons = [d.get("lon") for d in data if d.get("lon") is not None]
        vals = [d.get("avg_value") for d in data if d.get("avg_value") is not None]
        
        if not lats or not lons or not vals or len(lats) != len(lons):
            return "Invalid or incomplete heatmap data."

        fig, ax = plt.subplots(figsize=(12, 8))
        scatter = ax.scatter(lons, lats, c=vals, cmap='RdYlBu_r', s=200, alpha=0.7,
                             edgecolors='white', linewidth=0.5)
        plt.colorbar(scatter, ax=ax, label=PARAM_LABELS.get(parameter, parameter.upper()))

        ax.set_xlabel("Longitude (°E)")
        ax.set_ylabel("Latitude (°N)")
        ax.set_title(f"{parameter.upper()} Heatmap ({depth_range[0]}-{depth_range[1]}m)",
                     fontsize=15, fontweight='bold')
        ax.grid(True, alpha=0.3)
        plt.tight_layout()

        if not output_path:
            output_path = os.path.join(OUTPUT_DIR, f"heatmap_{parameter}.png")
        fig.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close(fig)
        return os.path.abspath(output_path)
    except Exception as e:
        print(f"[render_heatmap] Error: {e}")
        return f"Error rendering heatmap: {str(e)}"


def render_parameter_correlation(params: dict, output_path: str = None) -> str:
    """Render parameter correlation scatter matrix. Data from ui_intent."""
    try:
        _apply_style()
        data = params.get("data", [])
        parameters = params.get("parameters", [])
        profile_id = params.get("profile_id", "?")

        if not data or len(parameters) < 2:
            return "Not enough parameters or data for correlation plot."

        n = len(parameters)
        if n > 10:
            return f"Too many parameters ({n}) for correlation plot. Max 10 allowed."
        
        fig, axes = plt.subplots(n, n, figsize=(4 * n, 4 * n), squeeze=False)

        for i, py in enumerate(parameters):
            for j, px in enumerate(parameters):
                ax = axes[i][j]
                x_vals = [d.get(px) for d in data]
                y_vals = [d.get(py) for d in data]
                valid = [(x, y) for x, y in zip(x_vals, y_vals) if x is not None and y is not None]

                if valid and i != j:
                    xs, ys = zip(*valid)
                    ax.scatter(xs, ys, c='#2196F3', s=10, alpha=0.6)
                elif valid and i == j:
                    vals = [v[0] for v in valid]
                    ax.hist(vals, bins=20, color='#2196F3', alpha=0.7)

                if i == n - 1:
                    ax.set_xlabel(px.upper(), fontsize=9)
                if j == 0:
                    ax.set_ylabel(py.upper(), fontsize=9)
                ax.tick_params(labelsize=7)

        fig.suptitle(f"Parameter Correlation — {profile_id}", fontsize=15, fontweight='bold')
        plt.tight_layout()

        if not output_path:
            output_path = os.path.join(OUTPUT_DIR, f"correlation_{profile_id}.png")
        fig.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close(fig)
        return os.path.abspath(output_path)
    except Exception as e:
        print(f"[render_parameter_correlation] Error: {e}")
        return f"Error rendering correlation plot: {str(e)}"


# ─── Dispatcher ──────────────────────────────────────────────────────────────

def render_from_intent(ui_intent: dict) -> str:
    """
    Given a ui_intent dict from a visualization tool, render the chart
    and return the absolute path to the saved image file.

    CRITICAL: All data is embedded in ui_intent.params — NO DB queries.
    """
    intent_type = ui_intent.get("type", "")
    params = ui_intent.get("params", {})

    renderers = {
        "chart_depth_profile": render_depth_profile,
        "chart_ts_diagram": render_ts_diagram,
        "chart_comparison": render_comparison,
        "chart_parameter_scatter": render_parameter_scatter,
        "chart_time_series": render_time_series,
        "chart_depth_histogram": render_depth_histogram,
        "chart_bgc_distribution": render_bgc_distribution,
        "chart_parameter_correlation": render_parameter_correlation,
        "chart_section": render_section_plot,
        "map_trajectory": render_trajectory,
        "map_markers": render_markers,
        "map_density": render_density_map,
        "map_heatmap": render_heatmap,
    }

    renderer = renderers.get(intent_type)
    if renderer:
        return renderer(params)
    return f"Unknown visualization type: {intent_type}"
