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

const TABLE_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const TABLE_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

const isDateLikeValue = (value) =>
  value instanceof Date ||
  (typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}(?:T|\b)/.test(value) &&
    !Number.isNaN(new Date(value).getTime()));

const isTimestampColumn = (column) => /timestamp|date/i.test(column);
const isLatitudeColumn = (column) => /^(lat|latitude)$/i.test(column);
const isLongitudeColumn = (column) => /^(lon|lng|longitude)$/i.test(column);

const formatColumnLabel = (column) => {
  const specialLabels = {
    _id: "Profile ID",
    platform_number: "Platform Number",
    cycle_number: "Cycle",
    max_pres: "Max Pressure",
  };

  if (specialLabels[column]) return specialLabels[column];
  return column
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatCoordinate = (value, axis) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;

  const direction =
    axis === "lat"
      ? numeric >= 0
        ? "N"
        : "S"
      : numeric >= 0
        ? "E"
        : "W";

  return {
    compact: `${Math.abs(numeric).toFixed(4)}° ${direction}`,
    raw: numeric.toFixed(4),
  };
};

const formatTemporalValue = (value, column) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const showTime =
    /timestamp/i.test(column) ||
    (typeof value === "string" && value.includes("T"));

  return showTime
    ? {
        primary: TABLE_TIMESTAMP_FORMATTER.format(date),
        secondary: "UTC",
      }
    : {
        primary: TABLE_DATE_FORMATTER.format(date),
        secondary: null,
      };
};

const formatTableCellValue = (value, maxLength = 48) => {
  if (value == null || value === "") return "—";
  if (value instanceof Date) return value.toLocaleDateString();

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    if (
      value.every(
        (item) =>
          item == null ||
          ["string", "number", "boolean"].includes(typeof item),
      )
    ) {
      const joined = value.join(", ");
      return joined.length > maxLength
        ? `${joined.slice(0, maxLength - 1)}…`
        : joined;
    }
    return `${value.length} item${value.length === 1 ? "" : "s"}`;
  }

  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (!keys.length) return "{}";
    const preview = keys
      .slice(0, 2)
      .map((key) => `${key}: ${formatTableCellValue(value[key], 16)}`)
      .join(", ");
    return keys.length > 2 ? `${preview}, …` : preview;
  }

  const text = String(value);
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
};

const renderTableCell = (column, value) => {
  if (value == null || value === "") {
    return <span className="text-slate-300">—</span>;
  }

  if (isLatitudeColumn(column) || isLongitudeColumn(column)) {
    const coordinate = formatCoordinate(
      value,
      isLatitudeColumn(column) ? "lat" : "lon",
    );
    if (coordinate) {
      return (
        <div className="min-w-[8rem] leading-tight">
          <div className="font-semibold text-slate-800">{coordinate.compact}</div>
          <div className="mt-1 text-[11px] text-slate-400">{coordinate.raw}</div>
        </div>
      );
    }
  }

  if (isTimestampColumn(column) && isDateLikeValue(value)) {
    const temporal = formatTemporalValue(value, column);
    if (temporal) {
      return (
        <div className="min-w-[10.5rem] leading-tight">
          <div className="font-semibold text-slate-800">{temporal.primary}</div>
          {temporal.secondary && (
            <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">
              {temporal.secondary}
            </div>
          )}
        </div>
      );
    }
  }

  if (column === "platform_number") {
    return (
      <span className="inline-flex min-w-[7.5rem] items-center justify-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-sky-800">
        {String(value)}
      </span>
    );
  }

  if (column === "cycle_number") {
    return (
      <span className="inline-flex min-w-[4.5rem] items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
        C{String(value)}
      </span>
    );
  }

  if (column === "_id" || /(^|_)id$/i.test(column)) {
    return (
      <span className="block min-w-[11rem] font-mono text-[11px] leading-5 text-slate-600 break-all">
        {formatTableCellValue(value, 120)}
      </span>
    );
  }

  return (
    <span className="block text-slate-700">
      {formatTableCellValue(value)}
    </span>
  );
};

const getColumnClassName = (column) => {
  if (column === "_id" || /(^|_)id$/i.test(column)) {
    return "min-w-[13rem]";
  }
  if (column === "platform_number") {
    return "min-w-[9rem]";
  }
  if (column === "cycle_number") {
    return "min-w-[6rem]";
  }
  if (isLatitudeColumn(column) || isLongitudeColumn(column)) {
    return "min-w-[9rem]";
  }
  if (isTimestampColumn(column)) {
    return "min-w-[11rem]";
  }
  return "min-w-[8rem]";
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
  const hasCoordinates =
    columns.some(isLatitudeColumn) && columns.some(isLongitudeColumn);
  const hasTemporalColumn = columns.some(isTimestampColumn);

  if (!columns.length || !rows.length) return null;

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#082f49_0%,#0f172a_55%,#164e63_100%)] px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <Layers className="h-4 w-4 text-sky-200" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">
                Structured Result Table
              </div>
              <div className="mt-1 text-xs text-sky-100/80">
                Showing {visible.length} of {rows.length} records
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {hasTemporalColumn && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-medium text-sky-50">
                <Calendar className="h-3.5 w-3.5" />
                Time in UTC
              </span>
            )}
            {hasCoordinates && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-medium text-sky-50">
                <MapPin className="h-3.5 w-3.5" />
                Coordinates as N/S, E/W
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="max-h-80 overflow-auto bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.08),_transparent_32%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]">
        <table className="min-w-full text-left text-xs">
          <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur">
            <tr>
              {columns.map(col => (
                <th
                  key={col}
                  className={`border-b border-slate-200 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 ${getColumnClassName(col)}`}
                >
                  {formatColumnLabel(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((row, i) => (
              <tr
                key={i}
                className="bg-white/80 transition-colors odd:bg-slate-50/55 hover:bg-sky-50/70"
              >
                {columns.map(col => (
                  <td
                    key={col}
                    className={`px-4 py-3 align-top ${col === "_id" || /(^|_)id$/i.test(col) ? "border-r border-slate-100 pr-6" : ""}`}
                  >
                    {renderTableCell(col, row[col])}
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
          className="flex w-full items-center justify-center gap-1 border-t border-slate-200 bg-white py-2.5 text-xs font-medium text-sky-700 transition-colors hover:bg-sky-50"
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
        {stats.map((stat) => {
          const StatIcon = stat.icon;
          return (
            <div key={stat.label} className={`flex flex-col items-center py-4 ${stat.bg}`}>
              <StatIcon className={`w-4 h-4 mb-1 ${stat.color}`} />
              <span className="text-xs font-medium text-slate-500">{stat.label}</span>
              <span className={`text-lg font-bold font-mono ${stat.color}`}>
                {stat.value != null ? stat.value.toFixed(3) : "—"}
              </span>
            </div>
          );
        })}
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
