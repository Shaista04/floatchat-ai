import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { motion } from "framer-motion";
import axios from "axios";
import PlotlyChart from "react-plotly.js";
const Plot = PlotlyChart.default || PlotlyChart;
import {
  MapPin,
  Thermometer,
  Droplets,
  Filter,
  Download,
  RefreshCw,
  TrendingUp,
  Globe,
  Database,
} from "lucide-react";

// API URL (match your Express server)
const API_URL = "http://localhost:3001/api";

const Dashboard = () => {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState("global");
  const [timeRange, setTimeRange] = useState("7d");
  const [selectedParameter, setSelectedParameter] = useState("temperature");

  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [floats, setFloats] = useState([]);
  const [error, setError] = useState(null);

  // Fetch real data from the backend
  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [statsRes, floatsRes] = await Promise.all([
        axios.get(`${API_URL}/stats`),
        axios.get(`${API_URL}/floats?limit=150`),
      ]);
      setStats(statsRes.data);
      // floats endpoint returns { count, floats: [...] }
      setFloats(floatsRes.data.floats || []);
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError(
        err.message ||
          "Failed to load dashboard data. Make sure backend server is running on port 3001.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const summaryStats = [
    {
      label: "Active Floats",
      value: stats ? (stats.activeFloats ?? stats.total_floats ?? "—") : "...",
      icon: MapPin,
      color: "#14b8a6",
      bgColor: "#f0fdfa",
    },
    {
      label: "Recent Profiles (30d)",
      value: stats
        ? (stats.recentProfiles ?? stats.recent_profiles ?? "—")
        : "...",
      icon: TrendingUp,
      color: "#0284c7",
      bgColor: "#f0f9ff",
    },
    {
      label: "BGC Coverage",
      value: stats ? (stats.bgcCoverage ?? "—") : "...",
      icon: Globe,
      color: "#0d9488",
      bgColor: "#ccfbf1",
    },
    {
      label: "Total Profiles",
      value: stats
        ? (stats.dataPoints ?? stats.total_profiles?.toLocaleString() ?? "—")
        : "...",
      icon: Database,
      color: "#0ea5e9",
      bgColor: "#e0f2fe",
    },
  ];

  // Build chart data from float bounding box info (available without loading profiles)
  // Shows distribution of floats by latitude as a proxy for depth profiles
  const latDistData = floats
    .filter((f) => f.geo_bounding_box)
    .slice(0, 100)
    .map((f, i) => ({
      x: i,
      lat: (f.geo_bounding_box.min_lat + f.geo_bounding_box.max_lat) / 2,
      cycles: f.total_cycles || 0,
    }));

  const chartData = {
    temperature: {
      title: "Float Distribution by Latitude",
      data: latDistData.length > 0 ? latDistData : [{ lat: 0, cycles: 0 }],
    },
    salinity: {
      title: "Cycles per Float",
      data: latDistData.length > 0 ? latDistData : [{ lat: 0, cycles: 0 }],
    },
  };

  const getFloatIcon = (status) => {
    const color = status === "active" ? "#10b981" : "#f59e0b";
    return L.divIcon({
      className: "custom-div-icon",
      html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); animation: pulse 2s infinite;"></div>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "white",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Animated Background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        <motion.div
          style={{
            position: "absolute",
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(20, 184, 166, 0.1), rgba(14, 165, 233, 0.05))",
            top: "-100px",
            right: "-100px",
          }}
          animate={{ y: [0, -20, 0], x: [0, 10, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          style={{
            position: "absolute",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(2, 132, 199, 0.08), rgba(14, 165, 233, 0.03))",
            bottom: "-50px",
            left: "-50px",
          }}
          animate={{ y: [0, 20, 0], x: [0, -15, 0] }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
        />
      </div>

      {/* Error Banner */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            position: "relative",
            zIndex: 15,
            background: "#fef2f2",
            border: "2px solid #fca5a5",
            borderRadius: "12px",
            padding: "16px 20px",
            margin: "16px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            maxWidth: "1280px",
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          <div style={{ color: "#dc2626", fontSize: "20px" }}>⚠️</div>
          <div>
            <p
              style={{ color: "#991b1b", fontWeight: 600, marginBottom: "4px" }}
            >
              Connection Error
            </p>
            <p style={{ color: "#7f1d1d", fontSize: "14px", margin: 0 }}>
              {error}
            </p>
          </div>
          <button
            onClick={() => setError(null)}
            style={{
              marginLeft: "auto",
              background: "transparent",
              border: "none",
              color: "#7f1d1d",
              cursor: "pointer",
              fontSize: "20px",
            }}
          >
            ✕
          </button>
        </motion.div>
      )}

      <motion.div
        style={{
          maxWidth: "1280px",
          marginLeft: "auto",
          marginRight: "auto",
          padding: "16px",
          position: "relative",
          zIndex: 10,
        }}
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        {/* Header */}
        <div
          style={{
            marginBottom: "24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            borderBottom: "1px solid #e2e8f0",
            paddingBottom: "24px",
          }}
        >
          <div>
            <motion.h1
              style={{
                fontSize: "36px",
                fontWeight: 800,
                background: "linear-gradient(135deg, #14b8a6, #0284c7)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                marginBottom: "8px",
              }}
              variants={itemVariants}
            >
              Dashboard
            </motion.h1>
            <motion.p
              style={{
                color: "#475569",
                fontFamily: "monospace",
                fontSize: "14px",
              }}
              variants={itemVariants}
            >
              Live ARGO data • Status:{" "}
              <span style={{ color: "#10b981", fontWeight: "bold" }}>
                ACTIVE
              </span>
            </motion.p>
          </div>
          <button
            onClick={fetchData}
            style={{
              background: "linear-gradient(135deg, #14b8a6, #0284c7)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              padding: "10px 16px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 4px 12px rgba(20, 184, 166, 0.3)",
              transition: "all 0.2s",
            }}
          >
            <RefreshCw
              style={{
                width: "16px",
                height: "16px",
                animation: isLoading ? "spin 1s linear infinite" : "none",
              }}
            />
            {isLoading ? "Syncing..." : "Refresh"}
          </button>
        </div>

        {/* Summary Cards */}
        <motion.div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "16px",
            marginBottom: "24px",
          }}
          variants={containerVariants}
        >
          {summaryStats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={index}
                variants={itemVariants}
                whileHover={{ scale: 1.02 }}
                style={{
                  background: "white",
                  borderRadius: "12px",
                  padding: "20px",
                  boxShadow: "0 2px 8px rgba(20, 184, 166, 0.08)",
                  border: "1px solid #e2e8f0",
                  transition: "all 0.2s",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <p
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#64748b",
                        marginBottom: "8px",
                      }}
                    >
                      {stat.label}
                    </p>
                    <p
                      style={{
                        fontSize: "28px",
                        fontWeight: 800,
                        color: "#0f172a",
                      }}
                    >
                      {stat.value}
                    </p>
                  </div>
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "8px",
                      background: stat.bgColor,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon
                      style={{
                        width: "24px",
                        height: "24px",
                        color: stat.color,
                      }}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gap: "24px",
            marginBottom: "24px",
          }}
        >
          {/* Map Visualization */}
          <motion.div variants={itemVariants}>
            <div
              style={{
                background: "white",
                borderRadius: "12px",
                padding: "20px",
                boxShadow: "0 2px 8px rgba(20, 184, 166, 0.08)",
                border: "1px solid #e2e8f0",
                minHeight: "450px",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: "16px",
                  gap: "8px",
                }}
              >
                <Globe
                  style={{ width: "20px", height: "20px", color: "#14b8a6" }}
                />
                <h3
                  style={{
                    fontSize: "16px",
                    fontWeight: 700,
                    color: "#0f172a",
                  }}
                >
                  Float Locations
                </h3>
              </div>

              <div
                style={{
                  flex: 1,
                  borderRadius: "8px",
                  overflow: "hidden",
                  border: "1px solid #e2e8f0",
                }}
              >
                {isLoading ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "100%",
                      background: "#f0fdfa",
                    }}
                  >
                    <div
                      style={{
                        animation: "spin 1s linear infinite",
                        width: "32px",
                        height: "32px",
                        border: "3px solid #e2e8f0",
                        borderTopColor: "#14b8a6",
                        borderRadius: "50%",
                      }}
                    />
                  </div>
                ) : (
                  <MapContainer
                    center={[10, 70]}
                    zoom={3}
                    style={{ height: "400px", width: "100%" }}
                  >
                    <TileLayer
                      url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                      attribution="&copy; OpenStreetMap &copy; CARTO"
                    />
                    {floats
                      .filter(
                        (f) =>
                          f.geo_bounding_box &&
                          f.geo_bounding_box.min_lat != null &&
                          f.geo_bounding_box.min_lon != null,
                      )
                      .map((float) => {
                        const lat =
                          (float.geo_bounding_box.min_lat +
                            float.geo_bounding_box.max_lat) /
                          2;
                        const lon =
                          (float.geo_bounding_box.min_lon +
                            float.geo_bounding_box.max_lon) /
                          2;
                        if (isNaN(lat) || isNaN(lon)) return null;
                        return (
                          <Marker
                            key={float.platform_number}
                            position={[lat, lon]}
                            icon={getFloatIcon(
                              float.has_bgc ? "active" : "idle",
                            )}
                          >
                            <Popup className="rounded-lg shadow-xl border-0">
                              <div
                                style={{ padding: "12px", minWidth: "220px" }}
                              >
                                <h4
                                  style={{
                                    fontWeight: 700,
                                    color: "#0f172a",
                                    marginBottom: "8px",
                                    borderBottom: "1px solid #e2e8f0",
                                    paddingBottom: "8px",
                                  }}
                                >
                                  Platform {float.platform_number}
                                </h4>
                                <div
                                  style={{
                                    marginTop: "12px",
                                    fontSize: "13px",
                                    display: "grid",
                                    gridTemplateColumns: "1fr 1fr",
                                    gap: "8px",
                                  }}
                                >
                                  <p style={{ color: "#64748b" }}>
                                    Data Centre:
                                  </p>
                                  <p
                                    style={{
                                      fontWeight: 600,
                                      color: "#0f172a",
                                      textAlign: "right",
                                    }}
                                  >
                                    {float.data_centre || "—"}
                                  </p>
                                  <p style={{ color: "#64748b" }}>
                                    Total Cycles:
                                  </p>
                                  <p
                                    style={{
                                      fontWeight: 600,
                                      color: "#0f172a",
                                      textAlign: "right",
                                    }}
                                  >
                                    {float.total_cycles}
                                  </p>
                                  <p style={{ color: "#64748b" }}>Has BGC:</p>
                                  <p
                                    style={{
                                      fontWeight: 600,
                                      color: float.has_bgc
                                        ? "#10b981"
                                        : "#64748b",
                                      textAlign: "right",
                                    }}
                                  >
                                    {float.has_bgc ? "Yes" : "No"}
                                  </p>
                                  <p style={{ color: "#64748b" }}>Last Seen:</p>
                                  <p
                                    style={{
                                      fontWeight: 600,
                                      color: "#0f172a",
                                      textAlign: "right",
                                    }}
                                  >
                                    {float.last_date
                                      ? new Date(
                                          float.last_date,
                                        ).toLocaleDateString()
                                      : "—"}
                                  </p>
                                </div>
                              </div>
                            </Popup>
                          </Marker>
                        );
                      })}
                  </MapContainer>
                )}
              </div>
            </div>
          </motion.div>

          {/* Sidebar Stats */}
          <motion.div
            style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            variants={itemVariants}
          >
            <div
              style={{
                background: "white",
                borderRadius: "12px",
                padding: "20px",
                boxShadow: "0 2px 8px rgba(20, 184, 166, 0.08)",
                border: "1px solid #e2e8f0",
              }}
            >
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "#0f172a",
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Database
                  style={{ width: "20px", height: "20px", color: "#14b8a6" }}
                />
                Network Health
              </h3>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px",
                    background: "#f0fdfa",
                    borderRadius: "8px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#64748b",
                    }}
                  >
                    Data Integrity
                  </span>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "#10b981",
                    }}
                  >
                    99.8%
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px",
                    background: "#f0f9ff",
                    borderRadius: "8px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#64748b",
                    }}
                  >
                    Telemetry Success
                  </span>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "#0284c7",
                    }}
                  >
                    97.4%
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px",
                    background: "#ccfbf1",
                    borderRadius: "8px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#64748b",
                    }}
                  >
                    Global Coverage
                  </span>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "#0d9488",
                    }}
                  >
                    Extensive
                  </span>
                </div>
              </div>
            </div>

            <div
              style={{
                background: "white",
                borderRadius: "12px",
                padding: "20px",
                boxShadow: "0 2px 8px rgba(20, 184, 166, 0.08)",
                border: "1px solid #e2e8f0",
              }}
            >
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "#0f172a",
                  marginBottom: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <TrendingUp
                  style={{ width: "20px", height: "20px", color: "#14b8a6" }}
                />
                Network Info
              </h3>
              <p
                style={{
                  fontSize: "13px",
                  color: "#64748b",
                  lineHeight: "1.5",
                }}
              >
                The global ARGO array consists of ~4,000 floats profiling the
                world's oceans in real-time with consistent and reliable data
                collection.
              </p>
            </div>
          </motion.div>
        </div>

        {/* Charts Section */}
        <motion.div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "24px",
          }}
          variants={containerVariants}
        >
          {/* Float Distribution Chart */}
          <motion.div
            variants={itemVariants}
            whileHover={{ y: -5 }}
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "20px",
              boxShadow: "0 2px 8px rgba(20, 184, 166, 0.08)",
              border: "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "16px",
              }}
            >
              <Thermometer
                style={{ width: "20px", height: "20px", color: "#14b8a6" }}
              />
              <h3
                style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a" }}
              >
                Distribution by Latitude
              </h3>
            </div>
            <div
              style={{
                height: "300px",
                borderRadius: "8px",
                background: "#f0fdfa",
                padding: "8px",
                overflow: "hidden",
              }}
            >
              <Plot
                data={[
                  {
                    x: chartData.temperature.data.map((p) => p.lat),
                    y: chartData.temperature.data.map((p) => p.cycles),
                    type: "bar",
                    marker: { color: "#14b8a6", opacity: 0.8 },
                    name: "Total Cycles",
                  },
                ]}
                layout={{
                  autosize: true,
                  margin: { l: 50, r: 20, t: 20, b: 40 },
                  paper_bgcolor: "rgba(240, 253, 250, 0.3)",
                  plot_bgcolor: "rgba(0,0,0,0)",
                  xaxis: {
                    title: "Latitude (°)",
                    gridcolor: "rgba(226, 232, 240, 0.3)",
                    titlefont: { color: "#64748b" },
                    tickfont: { color: "#64748b" },
                  },
                  yaxis: {
                    title: "Total Cycles",
                    gridcolor: "rgba(226, 232, 240, 0.3)",
                    titlefont: { color: "#64748b" },
                    tickfont: { color: "#64748b" },
                  },
                }}
                useResizeHandler={true}
                style={{ width: "100%", height: "100%" }}
                config={{ displayModeBar: false }}
              />
            </div>
          </motion.div>

          {/* Activity Chart */}
          <motion.div
            variants={itemVariants}
            whileHover={{ y: -5 }}
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "20px",
              boxShadow: "0 2px 8px rgba(20, 184, 166, 0.08)",
              border: "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "16px",
              }}
            >
              <Droplets
                style={{ width: "20px", height: "20px", color: "#0284c7" }}
              />
              <h3
                style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a" }}
              >
                Cycles per Float
              </h3>
            </div>
            <div
              style={{
                height: "300px",
                borderRadius: "8px",
                background: "#f0f9ff",
                padding: "8px",
                overflow: "hidden",
              }}
            >
              <Plot
                data={[
                  {
                    x: floats.slice(0, 30).map((f) => f.platform_number),
                    y: floats.slice(0, 30).map((f) => f.total_cycles || 0),
                    type: "bar",
                    marker: { color: "#0284c7", opacity: 0.8 },
                    name: "Cycles",
                  },
                ]}
                layout={{
                  autosize: true,
                  margin: { l: 50, r: 20, t: 20, b: 60 },
                  paper_bgcolor: "rgba(240, 249, 255, 0.3)",
                  plot_bgcolor: "rgba(0,0,0,0)",
                  xaxis: {
                    title: "Platform",
                    tickangle: -45,
                    gridcolor: "rgba(226, 232, 240, 0.3)",
                    titlefont: { color: "#64748b" },
                    tickfont: { color: "#64748b" },
                  },
                  yaxis: {
                    title: "Total Cycles",
                    gridcolor: "rgba(226, 232, 240, 0.3)",
                    titlefont: { color: "#64748b" },
                    tickfont: { color: "#64748b" },
                  },
                }}
                useResizeHandler={true}
                style={{ width: "100%", height: "100%" }}
                config={{ displayModeBar: false }}
              />
            </div>
          </motion.div>
        </motion.div>
      </motion.div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
