import React, { useState } from "react";
import PlotlyChart from "react-plotly.js";
const Plot = PlotlyChart.default || PlotlyChart;
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import {
  Download, ChevronDown, ChevronUp,
  MapPin, Calendar, Database, Layers, Activity
} from "lucide-react";

/**
 * ChatMessageRenderer
 *
 * Renders the right visual component based on tool_result.type:
 *   plotly         → interactive Plotly chart
 *   leaflet        → interactive Leaflet map (trajectory or markers)
 *   metadata_card  → float info card
 *   data_table     → scrollable inline table
 *   stats_card     → mean / std / min / max summary
 *   export_csv     → download button
 *   data           → nothing extra (text answer is enough)
 */
const ChatMessageRenderer = ({ toolResult }) => {
  if (!toolResult || toolResult.error || !toolResult.type) return null;

  switch (toolResult.type) {
    case "plotly":
      return <PlotlyRenderer plotly={toolResult.plotly} />;

    case "leaflet":
      return (
        <LeafletRenderer
          center={toolResult.center}
          zoom={toolResult.zoom}
          markers={toolResult.markers}
          polyline={toolResult.polyline}
        />
      );

    case "metadata_card":
      return <MetadataCard data={toolResult.data} />;

    case "data_table":
      return <DataTable columns={toolResult.columns} rows={toolResult.rows} />;

    case "stats_card":
      return (
        <StatsCard
          param={toolResult.param}
          platform={toolResult.platform}
          data={toolResult.data}
        />
      );

    case "export_csv":
      return <CsvDownloadButton csv={toolResult.csv} />;

    default:
      return null;
  }
};

// ─── Plotly Chart ─────────────────────────────────────────────────────────────

const PlotlyRenderer = ({ plotly }) => {
  if (!plotly || !plotly.data) return null;
  return (
    <div className="mt-4 rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm">
      <Plot
        data={plotly.data}
        layout={{
          autosize: true,
          margin: { l: 55, r: 20, t: 45, b: 50 },
          paper_bgcolor: "rgba(255,255,255,0)",
          plot_bgcolor: "rgba(248,250,252,1)",
          font: { family: "Inter, sans-serif", size: 12, color: "#334155" },
          ...plotly.layout,
        }}
        config={{
          displayModeBar: true,
          displaylogo: false,
          modeBarButtonsToRemove: ["lasso2d", "select2d"],
          responsive: true,
        }}
        useResizeHandler
        style={{ width: "100%", height: "340px" }}
      />
    </div>
  );
};

// ─── Leaflet Map ──────────────────────────────────────────────────────────────

const floatIcon = L.divIcon({
  className: "",
  html: `<div style="width:10px;height:10px;border-radius:50%;background:#0ea5e9;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>`,
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

const startIcon = L.divIcon({
  className: "",
  html: `<div style="width:12px;height:12px;border-radius:50%;background:#10b981;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

const endIcon = L.divIcon({
  className: "",
  html: `<div style="width:12px;height:12px;border-radius:50%;background:#f97316;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

const LeafletRenderer = ({ center, zoom, markers = [], polyline = null }) => {
  const safeCenter = center || [10, 75];
  const safeZoom   = zoom   || 4;

  return (
    <div className="mt-4 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
      <MapContainer
        center={safeCenter}
        zoom={safeZoom}
        style={{ height: "300px", width: "100%" }}
        className="z-0"
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution="© OpenStreetMap © CARTO"
        />
        {polyline && polyline.length > 1 && (
          <Polyline positions={polyline} color="#0ea5e9" weight={2} opacity={0.8} />
        )}
        {markers.map((m, i) => {
          const icon =
            polyline && i === 0
              ? startIcon
              : polyline && i === markers.length - 1
              ? endIcon
              : floatIcon;
          return (
            <Marker key={i} position={[m.lat, m.lon]} icon={icon}>
              {m.popup && (
                <Popup>
                  <div
                    className="text-xs text-slate-700"
                    dangerouslySetInnerHTML={{ __html: m.popup }}
                  />
                </Popup>
              )}
            </Marker>
          );
        })}
      </MapContainer>
      {polyline && (
        <div className="bg-white px-3 py-1.5 text-xs text-slate-500 flex gap-4 border-t border-slate-100">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Start</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block" /> End</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-500 inline-block" /> Waypoint</span>
          <span className="ml-auto">{markers.length} positions</span>
        </div>
      )}
    </div>
  );
};

// ─── Metadata Card ────────────────────────────────────────────────────────────

const MetadataCard = ({ data }) => {
  if (!data) return null;
  const rows = [
    ["Platform Number",  data.platform_number],
    ["Project",          data.project_name],
    ["PI Name",          data.pi_name],
    ["Platform Type",    data.platform_type],
    ["Data Centre",      data.data_centre],
    ["Total Cycles",     data.total_cycles],
    ["Has BGC",          data.has_bgc ? "Yes ✓" : "No"],
    ["BGC Parameters",   Array.isArray(data.bgc_parameters) ? data.bgc_parameters.join(", ") || "—" : "—"],
    ["First Date",       data.first_date ? new Date(data.first_date).toLocaleDateString() : "—"],
    ["Last Date",        data.last_date  ? new Date(data.last_date).toLocaleDateString()  : "—"],
    ["Latitude Range",   data.geo_bounding_box ? `${data.geo_bounding_box.min_lat?.toFixed(2)}° → ${data.geo_bounding_box.max_lat?.toFixed(2)}°` : "—"],
    ["Longitude Range",  data.geo_bounding_box ? `${data.geo_bounding_box.min_lon?.toFixed(2)}° → ${data.geo_bounding_box.max_lon?.toFixed(2)}°` : "—"],
  ].filter(([, v]) => v != null && v !== "" && v !== "—");

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-sky-600 to-blue-600 px-4 py-2 flex items-center gap-2">
        <Database className="w-4 h-4 text-white" />
        <span className="text-white text-sm font-bold">Float Metadata — {data.platform_number}</span>
      </div>
      <dl className="divide-y divide-slate-100">
        {rows.map(([label, val]) => (
          <div key={label} className="flex px-4 py-2 gap-4">
            <dt className="text-xs font-medium text-slate-500 w-36 shrink-0">{label}</dt>
            <dd className="text-xs text-slate-800 font-mono">{String(val)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

// ─── Data Table ───────────────────────────────────────────────────────────────

const DataTable = ({ columns = [], rows = [] }) => {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, 8);

  if (!columns.length || !rows.length) return null;

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="bg-slate-700 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-slate-300" />
          <span className="text-white text-sm font-bold">{rows.length} Records</span>
        </div>
      </div>
      <div className="overflow-x-auto max-h-56 overflow-y-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-slate-50 sticky top-0">
            <tr>
              {columns.map(col => (
                <th key={col} className="px-3 py-2 font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap border-b border-slate-200">
                  {col.replace(/_/g, " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                {columns.map(col => (
                  <td key={col} className="px-3 py-1.5 text-slate-700 whitespace-nowrap font-mono">
                    {row[col] != null ? String(row[col]) : "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 8 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-2 text-xs text-sky-600 hover:bg-sky-50 flex items-center justify-center gap-1 border-t border-slate-100 transition-colors"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? "Show less" : `Show all ${rows.length} rows`}
        </button>
      )}
    </div>
  );
};

// ─── Stats Card ───────────────────────────────────────────────────────────────

const StatsCard = ({ param, platform, data }) => {
  if (!data) return null;
  const stats = [
    { label: "Mean",   value: data.mean, color: "text-sky-600",    bg: "bg-sky-50",    icon: Activity },
    { label: "Std Dev",value: data.std,  color: "text-purple-600", bg: "bg-purple-50", icon: Layers },
    { label: "Min",    value: data.min,  color: "text-emerald-600",bg: "bg-emerald-50",icon: ChevronDown },
    { label: "Max",    value: data.max,  color: "text-orange-600", bg: "bg-orange-50", icon: ChevronUp },
  ];

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 flex items-center gap-2">
        <Activity className="w-4 h-4 text-white" />
        <span className="text-white text-sm font-bold">
          {param} Statistics {platform ? `— Platform ${platform}` : ""} ({data.count?.toLocaleString()} values)
        </span>
      </div>
      <div className="grid grid-cols-4 divide-x divide-slate-100">
        {stats.map(({ label, value, color, bg, icon: Icon }) => (
          <div key={label} className={`flex flex-col items-center py-4 ${bg}`}>
            <Icon className={`w-4 h-4 mb-1 ${color}`} />
            <span className="text-xs font-medium text-slate-500">{label}</span>
            <span className={`text-lg font-bold font-mono ${color}`}>
              {value != null ? value.toFixed(3) : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── CSV Download Button ──────────────────────────────────────────────────────

const CsvDownloadButton = ({ csv }) => {
  const handleDownload = () => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "argo_export.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const lines = csv ? csv.split("\n").length - 1 : 0;

  return (
    <div className="mt-4">
      <button
        onClick={handleDownload}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-600 to-blue-600 text-white text-sm font-semibold rounded-lg hover:shadow-md transition-all"
      >
        <Download className="w-4 h-4" />
        Download CSV ({lines} rows)
      </button>
    </div>
  );
};

export default ChatMessageRenderer;
