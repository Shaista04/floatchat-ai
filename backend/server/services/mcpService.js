'use strict';

/**
 * mcpService.js — Complete MCP Tool Registry
 *
 * ARCHITECTURE: Every tool returns a typed output envelope:
 *   { tool, type, ...payload }
 *
 * TYPES (what the Chat UI renders):
 *   "plotly"          → <Plot data layout />
 *   "leaflet"         → <MapContainer markers polyline />
 *   "metadata_card"   → <MetadataCard />
 *   "data_table"      → <InlineTable rows cols />
 *   "stats_card"      → <StatsCard mean std min max />
 *   "data"            → raw data (no chart, text only)
 *
 * TOOL REGISTRY (25 tools):
 * ── Data Retrieval ─────────────────────────────────────────
 *   query_float, nearest_floats, get_nearest_floats,
 *   profiles_by_date, search_profiles, profiles_by_region,
 *   search_bgc_profiles, get_float_info, get_profile_data,
 *   aggregate_statistics, get_dataset_metadata
 * ── Analytics ──────────────────────────────────────────────
 *   parameter_stats, compare_regions, time_series_stats
 * ── Visualization (all return typed JSON for the renderer) ─
 *   visualize_ts_diagram        (T-S scatter)
 *   visualize_depth_profile     (param vs depth, line)
 *   visualize_time_series       (param over cycles, line)
 *   visualize_trajectory        (float path on map)
 *   visualize_float_map         (multiple float positions)
 *   visualize_bar_chart         (platforms vs scalar value)
 *   visualize_comparison_bar    (region1 vs region2)
 *   visualize_heatmap           (depth × cycle, colour=value)
 *   visualize_multi_panel       (stacked subplots, multi-param)
 *   get_metadata_card           (float metadata card)
 *   get_data_table              (inline scrollable table)
 *   get_stats_card              (mean/std/min/max card)
 */

class McpService {
  constructor(mongoService, pythonBin = 'python', projectRoot = null) {
    this.mongo       = mongoService;
    this.pythonBin   = pythonBin;
    this.projectRoot = projectRoot;
  }

  // ─── Public dispatch ─────────────────────────────────────────────────────

  async runTool(toolName, params = {}) {
    try {
      switch (toolName) {

        // ═══════════════════════════════════════════
        // DATA RETRIEVAL TOOLS
        // ═══════════════════════════════════════════

        case 'query_float':
          return { tool: toolName, type: 'data',
            data: await this.mongo.queryFloat(params.platform, params.cycle || null) };

        case 'nearest_floats':
        case 'get_nearest_floats':
          return { tool: toolName, type: 'data',
            data: await this.mongo.nearestFloats(
              +params.lat, +params.lon,
              +(params.radius_km || 300), +(params.limit || 20)) };

        case 'profiles_by_date':
        case 'search_profiles':
          return { tool: toolName, type: 'data',
            data: await this.mongo.profilesByDate(
              params.date_start, params.date_end, params.bbox || null) };

        case 'profiles_by_region':
          return { tool: toolName, type: 'data',
            data: await this.mongo.profilesByRegion(
              +params.lat_min, +params.lat_max,
              +params.lon_min, +params.lon_max,
              +(params.limit || 200)) };

        case 'search_bgc_profiles':
          return { tool: toolName, type: 'data',
            data: await this.mongo.profilesByRegion(
              +(params.lat_min || -90), +(params.lat_max || 90),
              +(params.lon_min || -180), +(params.lon_max || 180),
              +(params.limit || 100)) };

        case 'get_float_info':
          return { tool: toolName, type: 'data',
            data: await this.mongo.getFloat(params.platform) };

        case 'get_profile_data':
          return { tool: toolName, type: 'data',
            data: await this.mongo.getProfile(params.profile_id) };

        case 'aggregate_statistics':
        case 'get_dataset_metadata':
          return { tool: toolName, type: 'data',
            data: await this.mongo.getStats() };

        case 'greeting':
          return { tool: toolName, type: 'text',
            data: "Hello! I am FloatChat-AI. Try asking me:\n• 'Show me a T-S diagram near Mumbai'\n• 'Heatmap for float 2902277'\n• 'What is the salinity in the Arabian Sea?'" };

        case 'generic_chat':
          // We return empty data so ragService.js passes it purely to the LLM.
          return { tool: toolName, type: 'text', data: null };


        // ═══════════════════════════════════════════
        // ANALYTICS TOOLS
        // ═══════════════════════════════════════════

        case 'parameter_stats': {
          const stats = await this.mongo.parameterStats(
            params.profiles || [], params.param || 'PSAL');
          return { tool: toolName, type: 'data', data: stats };
        }

        case 'compare_regions': {
          const cmp = await this.mongo.compareRegions(
            params.region1, params.region2,
            params.param || 'PSAL', params.limit || 100);
          return { tool: toolName, type: 'data', data: cmp };
        }

        case 'time_series_stats': {
          const ts = await this.mongo.timeSeriesStats(
            params.platform, params.param || 'TEMP', params.cycles || null);
          return { tool: toolName, type: 'data', data: ts };
        }

        // ═══════════════════════════════════════════
        // VISUALIZATION TOOLS
        // ═══════════════════════════════════════════

        /**
         * T-S Diagram — Temperature vs Salinity scatter
         * Params: { platforms[], [lat_min, lat_max, lon_min, lon_max], [date_start, date_end] }
         */
        case 'visualize_ts_diagram': {
          const profiles = await this._resolveProfiles(params);
          const tempParam = 'TEMP', psalParam = 'PSAL';
          const [tempData, psalData] = await Promise.all([
            this.mongo.getProfileMeasurements(profiles, tempParam),
            this.mongo.getProfileMeasurements(profiles, psalParam),
          ]);

          const traces = tempData.map((tp, i) => {
            const sp = psalData[i] || { data: [] };
            const temps = tp.data.map(d => d.value).filter(v => v != null);
            const psals = psalData[i]
              ? psalData[i].data.map(d => d.value).filter(v => v != null)
              : [];
            return {
              x: psals,
              y: temps,
              mode: 'markers',
              type: 'scatter',
              name: `${tp.platform_number} C${tp.cycle_number}`,
              marker: { size: 5, opacity: 0.75 },
              text: tp.data.map(d => `Depth: ${Math.abs(d.pres || 0).toFixed(0)} m`),
            };
          }).filter(t => t.x.length > 0);

          return {
            tool: toolName, type: 'plotly',
            plotly: {
              data: traces,
              layout: {
                title: { text: 'Temperature–Salinity (T-S) Diagram', font: { size: 14 } },
                xaxis: { title: 'Salinity (PSU)' },
                yaxis: { title: 'Temperature (°C)' },
                legend: { orientation: 'h', y: -0.25 },
                hovermode: 'closest',
              },
            },
          };
        }

        /**
         * Depth Profile — any parameter vs pressure (depth)
         * Params: { platforms[], param }
         */
        case 'visualize_depth_profile':
        case 'plot_profiles':
        case 'compare_profiles_depth':
        case 'visualize_profile_depth_plot': {
          const param = (params.param || 'TEMP').toUpperCase();
          const platforms = Array.isArray(params.platforms) ? params.platforms : (params.platform ? [params.platform] : []);
          const profiles = platforms.length ? platforms : await this._resolveProfiles(params);
          const data = await this.mongo.getProfileMeasurements(profiles, param);

          const axisLabel = {
            TEMP: 'Temperature (°C)', PSAL: 'Salinity (PSU)',
            PRES: 'Pressure (dbar)', DOXY: 'Dissolved Oxygen (µmol/kg)',
            CHLA: 'Chlorophyll-a (mg/m³)', NITRATE: 'Nitrate (µmol/kg)',
          };

          const traces = data.map(p => ({
            x: p.data.map(d => d.value),
            y: p.data.map(d => -(d.pres || 0)),
            mode: 'lines+markers',
            type: 'scatter',
            name: `${p.platform_number} C${p.cycle_number}`,
            line: { width: 2 },
            marker: { size: 4 },
          })).filter(t => t.x.length > 0);

          return {
            tool: toolName, type: 'plotly',
            plotly: {
              data: traces,
              layout: {
                title: { text: `${param} Depth Profile`, font: { size: 14 } },
                xaxis: { title: axisLabel[param] || param },
                yaxis: { title: 'Depth (m)', autorange: true },
                legend: { orientation: 'h', y: -0.25 },
                hovermode: 'closest',
              },
            },
          };
        }

        /**
         * Time Series — parameter mean per cycle over time
         * Params: { platform, param, [cycles: [start, end]] }
         */
        case 'visualize_time_series':
        case 'depth_time_plot': {
          const param = (params.param || 'TEMP').toUpperCase();
          const series = await this.mongo.timeSeriesStats(
            params.platform, param, params.cycles || null);

          return {
            tool: toolName, type: 'plotly',
            plotly: {
              data: [{
                x: series.map(s => s.timestamp || s.cycle),
                y: series.map(s => s.mean),
                error_y: {
                  type: 'data',
                  array: series.map(s => s.max != null && s.min != null ? (s.max - s.min) / 2 : 0),
                  visible: true, color: '#94a3b8',
                },
                mode: 'lines+markers',
                type: 'scatter',
                name: `${params.platform} — ${param}`,
                line: { color: '#0ea5e9', width: 2 },
                marker: { size: 5 },
                hovertemplate: 'Cycle %{x}<br>Mean: %{y:.3f}<extra></extra>',
              }],
              layout: {
                title: { text: `${param} — Cycle Time Series (Platform ${params.platform})`, font: { size: 14 } },
                xaxis: { title: 'Cycle / Date', type: 'date' },
                yaxis: { title: `Mean ${param}` },
              },
            },
          };
        }

        /**
         * Float Trajectory — path on interactive Leaflet map
         * Params: { platform, [cycles: [start, end]] }
         */
        case 'visualize_trajectory':
        case 'trajectory_map':
        case 'visualize_float_trajectory': {
          const points = await this.mongo.getTrajectory(params.platform);
          return {
            tool: toolName, type: 'leaflet',
            center: points.length
              ? [points[Math.floor(points.length/2)].latitude, points[Math.floor(points.length/2)].longitude]
              : [10, 70],
            zoom: 5,
            polyline: points.map(p => [p.latitude, p.longitude]),
            markers: points.map(p => ({
              lat: p.latitude, lon: p.longitude,
              popup: `Platform ${params.platform} — Cycle ${p.cycle_number}<br>${p.timestamp ? new Date(p.timestamp).toLocaleDateString() : ''}`,
            })),
          };
        }

        /**
         * Float Map — multiple float positions as markers
         * Params: { lat_min, lat_max, lon_min, lon_max, [date_start, date_end] }
         */
        case 'visualize_float_map':
        case 'map_marker_display': {
          const profiles = await this.mongo.profilesByRegion(
            +(params.lat_min || -60), +(params.lat_max || 30),
            +(params.lon_min || 20),  +(params.lon_max || 120),
            +(params.limit || 200));

          return {
            tool: toolName, type: 'leaflet',
            center: [10, 75], zoom: 4,
            polyline: null,
            markers: profiles
              .filter(p => p.latitude != null && p.longitude != null)
              .map(p => ({
                lat: p.latitude, lon: p.longitude,
                popup: `Platform ${p.platform_number} — Cycle ${p.cycle_number}`,
              })),
          };
        }

        /**
         * Bar Chart — compare scalar values per platform
         * Params: { platforms[], param }
         */
        case 'visualize_bar_chart': {
          const param = (params.param || 'PSAL').toUpperCase();
          const platforms = Array.isArray(params.platforms) ? params.platforms : [];
          const seriesList = await Promise.all(
            platforms.map(p => this.mongo.timeSeriesStats(p, param, null)));

          const means = seriesList.map(s => {
            const vals = s.map(c => c.mean).filter(v => v != null);
            return vals.length ? +(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(4) : 0;
          });

          return {
            tool: toolName, type: 'plotly',
            plotly: {
              data: [{
                x: platforms,
                y: means,
                type: 'bar',
                marker: { color: '#06b6d4', opacity: 0.85 },
                text: means.map(v => v.toFixed(3)),
                textposition: 'auto',
              }],
              layout: {
                title: { text: `Mean ${param} per Float Platform`, font: { size: 14 } },
                xaxis: { title: 'Platform Number', tickangle: -30 },
                yaxis: { title: `Mean ${param}` },
                bargap: 0.3,
              },
            },
          };
        }

        /**
         * Comparison Bar — two regions side by side
         * Params: { region1, region2, param }
         */
        case 'visualize_comparison_bar':
        case 'compare_regions': {
          const param = (params.param || 'PSAL').toUpperCase();
          const result = await this.mongo.compareRegions(
            params.region1, params.region2, param, params.limit || 100);

          const r1 = result.region1.stats;
          const r2 = result.region2.stats;

          return {
            tool: toolName, type: 'plotly',
            plotly: {
              data: [
                {
                  x: ['Mean', 'Std Dev', 'Min', 'Max'],
                  y: [r1.mean, r1.std, r1.min, r1.max],
                  name: 'Region 1',
                  type: 'bar',
                  marker: { color: '#0ea5e9' },
                },
                {
                  x: ['Mean', 'Std Dev', 'Min', 'Max'],
                  y: [r2.mean, r2.std, r2.min, r2.max],
                  name: 'Region 2',
                  type: 'bar',
                  marker: { color: '#f97316' },
                },
              ],
              layout: {
                title: { text: `${param} — Region Comparison`, font: { size: 14 } },
                barmode: 'group',
                xaxis: { title: 'Statistic' },
                yaxis: { title: param },
                legend: { orientation: 'h', y: -0.3 },
              },
            },
            summary: result,
          };
        }

        /**
         * Heatmap — parameter at depth × cycle
         * Params: { platform, param }
         */
        case 'visualize_heatmap': {
          const param = (params.param || 'TEMP').toUpperCase();
          const depthData = await this.mongo.getDepthTimeData(params.platform, param);

          if (!depthData.length) return { tool: toolName, type: 'data', data: [] };

          // Build a common pressure grid from all cycles
          const allPres = [...new Set(
            depthData.flatMap(d => d.data.map(v => Math.round(v.pres)))
          )].sort((a, b) => a - b);

          const cycles   = depthData.map(d => `C${d.cycle}`);
          const zMatrix  = allPres.map(pres =>
            depthData.map(d => {
              const match = d.data.find(v => Math.abs(v.pres - pres) < 10);
              return match ? match.value : null;
            })
          );

          return {
            tool: toolName, type: 'plotly',
            plotly: {
              data: [{
                z: zMatrix,
                x: cycles,
                y: allPres.map(p => -p),
                type: 'heatmap',
                colorscale: param === 'TEMP' ? 'RdBu' : 'Viridis',
                reversescale: param === 'TEMP',
                colorbar: { title: param },
                hoverongaps: false,
              }],
              layout: {
                title: { text: `${param} Heatmap — Platform ${params.platform}`, font: { size: 14 } },
                xaxis: { title: 'Cycle' },
                yaxis: { title: 'Depth (m)', autorange: true },
              },
            },
          };
        }

        /**
         * Multi-Panel — stacked subplots for multiple parameters
         * Params: { platform|platforms[], params[] }
         */
        case 'visualize_multi_panel': {
          const panelParams = Array.isArray(params.params)
            ? params.params.map(p => p.toUpperCase())
            : ['TEMP', 'PSAL', 'PRES'];

          const platform = params.platform || (Array.isArray(params.platforms) ? params.platforms[0] : null);
          if (!platform) return { tool: toolName, type: 'data', data: null };

          const allData = await Promise.all(
            panelParams.map(p => this.mongo.timeSeriesStats(platform, p, null)));

          const colors = ['#0ea5e9', '#f97316', '#10b981', '#a855f7', '#ef4444'];

          const traces = allData.map((series, i) => ({
            x: series.map(s => s.timestamp || `C${s.cycle}`),
            y: series.map(s => s.mean),
            mode: 'lines+markers',
            type: 'scatter',
            name: panelParams[i],
            line: { color: colors[i % colors.length], width: 2 },
            marker: { size: 4 },
            xaxis: `x${i > 0 ? i+1 : ''}`,
            yaxis: `y${i > 0 ? i+1 : ''}`,
          }));

          // Build layout domains for stacked panels
          const n = panelParams.length;
          const step = 1 / n;
          const layout = {
            title: { text: `Multi-Parameter View — Platform ${platform}`, font: { size: 14 } },
            showlegend: true,
            legend: { orientation: 'h', y: -0.15 },
          };
          panelParams.forEach((p, i) => {
            const key = i === 0 ? '' : (i+1).toString();
            const bottom = 1 - (i+1) * step;
            const top    = 1 - i * step;
            layout[`xaxis${key}`] = { domain: [0, 1], anchor: `y${key}`, showticklabels: i === n-1 };
            layout[`yaxis${key}`] = { domain: [bottom + 0.02, top - 0.02], anchor: `x${key}`, title: p };
          });

          return { tool: toolName, type: 'plotly', plotly: { data: traces, layout } };
        }

        /**
         * Metadata Card — structured float info
         * Params: { platform }
         */
        case 'get_metadata_card': {
          const float = await this.mongo.getFloat(params.platform);
          return {
            tool: toolName, type: 'metadata_card',
            data: float || { error: `Float ${params.platform} not found` },
          };
        }

        case 'get_data_table': {
          let rows;
          if (params.date_start || params.date_end) {
            const profiles = await this.mongo.profilesByDate(
              params.date_start || '2000-01-01', 
              params.date_end || '2030-01-01', 
              params
            );
            rows = profiles.map(p => {
              const row = {
                platform_number: p.platform_number, cycle_number: p.cycle_number,
                date: p.timestamp ? new Date(p.timestamp).toLocaleDateString() : '—',
              };
              let targetParams = params.params || ['TEMP', 'PSAL'];
              if (typeof targetParams === 'string') {
                try { targetParams = JSON.parse(targetParams.replace(/'/g, '"')); } 
                catch(e) { targetParams = ['TEMP', 'PSAL']; }
              }
              if (!Array.isArray(targetParams)) targetParams = ['TEMP', 'PSAL'];

              targetParams.forEach(param => {
                const paramKey = param.toLowerCase();
                const measurements = (p.measurements || []).map(m => m[paramKey]);
                const pressures = (p.measurements || []).map(m => m.pres);
                
                // Filter by depth
                let validVals = [];
                for(let i=0; i<pressures.length; i++) {
                  const depth = Math.abs(pressures[i]);
                  if (params.depth_min && depth < params.depth_min) continue;
                  if (params.depth_max && depth > params.depth_max) continue;
                  if (measurements[i] != null) validVals.push(measurements[i]);
                }
                
                row[`Avg ${param} (${params.depth_min||0}-${params.depth_max||'Max'}m)`] = validVals.length 
                  ? (validVals.reduce((a,b)=>a+b,0)/validVals.length).toFixed(3) 
                  : 'N/A';
              });
              return row;
            });
          } else if (params.platform && params.platform !== '00000' && params.platform !== 'null') {
            const profiles = await this.mongo.queryFloat(params.platform, null);
            rows = profiles.map(p => ({
              platform_number: p.platform_number, cycle_number: p.cycle_number,
              latitude: p.latitude?.toFixed(4), longitude: p.longitude?.toFixed(4),
              timestamp: p.timestamp ? new Date(p.timestamp).toLocaleDateString() : '—',
              max_pres: p.max_pres,
            }));
          } else {
            const floats = await this.mongo.getAllFloats(50);
            rows = floats.map(f => ({
              platform_number: f.platform_number,
              total_cycles: f.total_cycles,
              has_bgc: f.has_bgc ? 'Yes' : 'No',
              data_centre: f.data_centre,
              first_date: f.first_date ? new Date(f.first_date).toLocaleDateString() : '—',
              last_date: f.last_date ? new Date(f.last_date).toLocaleDateString() : '—',
            }));
          }
          return {
            tool: toolName, type: 'data_table',
            columns: rows.length ? Object.keys(rows[0]) : [],
            rows,
          };
        }

        /**
         * Stats Card — mean/std/min/max with visual summary
         * Params: { profiles[], param } or { platform, param }
         */
        case 'get_stats_card': {
          const param = (params.param || 'PSAL').toUpperCase();
          let profileIds = params.profiles || [];
          if (!profileIds.length && params.platform) {
            const docs = await this.mongo.queryFloat(params.platform, null);
            profileIds = docs.map(d => d._id);
          }
          const stats = await this.mongo.parameterStats(profileIds, param);
          return {
            tool: toolName, type: 'stats_card',
            param, platform: params.platform || null,
            data: stats,
          };
        }

        /**
         * Export CSV
         * Params: { profiles[], params[] }
         */
        case 'export_csv': {
          const csv = await this.mongo.exportCsv(
            params.profiles || [], params.params || ['PRES','TEMP','PSAL']);
          return { tool: toolName, type: 'export_csv', csv };
        }

        default:
          return { tool: toolName, type: 'data', error: `Unknown tool: ${toolName}`, data: null };
      }
    } catch (err) {
      console.error(`[MCP] "${toolName}" failed:`, err.message);
      return { tool: toolName, type: 'data', error: err.message, data: null };
    }
  }

  // ─── Native LLM Tool Schemas ──────────────────────────────────────────────

  /**
   * Returns Ollama/OpenAI compatible JSON schemas for native LLM tool calling
   */
  getToolSchemas() {
    return [
      {
        type: "function",
        function: {
          name: "visualize_ts_diagram",
          description: "Generate a Temperature-Salinity (T-S) scatter plot diagram.",
          parameters: {
            type: "object",
            properties: {
              platform: { type: "string", description: "Optional specific float platform number" },
              lat_min: { type: "number" }, lat_max: { type: "number" },
              lon_min: { type: "number" }, lon_max: { type: "number" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "visualize_depth_profile",
          description: "Generate a depth profile line chart for a specific parameter (vs pressure/depth).",
          parameters: {
            type: "object",
            properties: {
              platform: { type: "string", description: "Float platform number" },
              param: { type: "string", enum: ["TEMP", "PSAL", "DOXY", "CHLA", "NITRATE", "PRES"], description: "The parameter to plot" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_data_table",
          description: "Retrieve ARGO float data in a structured raw data table format.",
          parameters: {
            type: "object",
            properties: {
              platform: { type: "string", description: "Specific platform float ID" },
              date_start: { type: "string", description: "Start date YYYY-MM-DD. If the user specifies a single day, this MUST be that exact day, NOT the 1st of the month." },
              date_end: { type: "string", description: "End date YYYY-MM-DD. If the user specifies a single day, this MUST be the exact same day as date_start." },
              depth_min: { type: "number", description: "Minimum depth in meters" },
              depth_max: { type: "number", description: "Maximum depth in meters" },
              params: { type: "array", items: { type: "string" }, description: "Parameters to include like TEMP, PSAL" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "visualize_float_map",
          description: "Show a geographical map with markers of ARGO floats in a specific region or time frame.",
          parameters: {
            type: "object",
            properties: {
              date_start: { type: "string", description: "Start date YYYY-MM-DD. If a single day, this MUST be that exact day, NOT the 1st of the month." },
              date_end: { type: "string", description: "End date YYYY-MM-DD. If a single day, this MUST be the exact same day as date_start." },
              lat_min: { type: "number" }, lat_max: { type: "number" },
              lon_min: { type: "number" }, lon_max: { type: "number" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "visualize_heatmap",
          description: "Generate a heatmap comparing depth, cycles, and parameter values.",
          parameters: {
            type: "object",
            properties: {
              platform: { type: "string", description: "Platform ID" },
              param: { type: "string", description: "Parameter like TEMP or PSAL" }
            },
            required: ["platform", "param"]
          }
        }
      }
    ];
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  /** Resolves a list of platform numbers from params, falling back to a bbox query */
  async _resolveProfiles(params) {
    if (Array.isArray(params.platforms) && params.platforms.length)
      return params.platforms.map(String);
    if (params.platform) return [String(params.platform)];

    // Fetch from region
    const bbox = params.bbox || this._indianOceanBbox();
    const docs  = await this.mongo.profilesByRegion(
      bbox.lat_min, bbox.lat_max, bbox.lon_min, bbox.lon_max, 20);
    return docs.map(d => d.platform_number).filter(Boolean);
  }

  _indianOceanBbox() {
    return { lat_min: -60, lat_max: 30, lon_min: 20, lon_max: 120 };
  }

  _extractPlatform(q) {
    const m = q.match(/(?:float|platform|wmo|argo)\s*#?\s*(\d{5,8})|(?:^|\s)(\d{7,8})(?:\s|$)/);
    return m ? (m[1] || m[2]) : null;
  }

  _extractParam(q) {
    if (/\btemp(erature)?\b/.test(q)) return 'TEMP';
    if (/\bsal(inity|initiy)?\b|\bpsal\b/.test(q)) return 'PSAL';
    if (/\boxy(gen)?\b|\bdoxy\b/.test(q)) return 'DOXY';
    if (/\bchloro(phyll)?\b|\bchla\b/.test(q)) return 'CHLA';
    if (/\bnitrate\b/.test(q)) return 'NITRATE';
    if (/\bpress(ure)?\b|\bpres\b/.test(q)) return 'PRES';
    return 'TEMP'; // default
  }

  _extractMultiParams(q) {
    const found = [];
    if (/temp/.test(q)) found.push('TEMP');
    if (/sal/.test(q))  found.push('PSAL');
    if (/oxy/.test(q))  found.push('DOXY');
    if (/chla|chloro/.test(q)) found.push('CHLA');
    if (/nitrate/.test(q)) found.push('NITRATE');
    return found.length ? found : ['TEMP', 'PSAL'];
  }

  _extractCoords(q) {
    // Named cities → coords
    const cities = {
      mumbai: { lat: 19.07, lon: 72.88 }, chennai: { lat: 13.08, lon: 80.27 },
      kolkata: { lat: 22.57, lon: 88.36 }, delhi: { lat: 28.61, lon: 77.21 },
      'kuala lumpur': { lat: 3.13, lon: 101.68 }, singapore: { lat: 1.35, lon: 103.82 },
      'sri lanka': { lat: 7.87, lon: 80.77 }, maldives: { lat: 3.2, lon: 73.22 },
      'port blair': { lat: 11.67, lon: 92.75 }, karachi: { lat: 24.86, lon: 67.01 },
      goa: { lat: 15.49, lon: 73.82 }, kochi: { lat: 9.93, lon: 76.26 },
    };
    for (const [city, coords] of Object.entries(cities)) {
      if (q.includes(city)) return coords;
    }

    // Numeric coords
    const latM = q.match(/([\d.]+)\s*°?\s*[nNsS]/);
    const lonM = q.match(/([\d.]+)\s*°?\s*[eEwW]/);
    if (latM && lonM) return { lat: parseFloat(latM[1]), lon: parseFloat(lonM[1]) };

    return { lat: 15, lon: 75 }; // Indian Ocean centre default
  }

  _extractDateRange(q) {
    const months = { january:1,february:2,march:3,april:4,may:5,june:6,
      july:7,august:8,september:9,october:10,november:11,december:12 };
    const yearM  = q.match(/\b(20\d{2})\b/);
    const year   = yearM ? yearM[1] : '2023';
    let month = 1;
    for (const [name, num] of Object.entries(months)) {
      if (q.includes(name)) { month = num; break; }
    }
    const dayM = q.match(/\b(\d{1,2})(st|nd|rd|th)?\b/);
    const day  = dayM ? parseInt(dayM[1]) : null;

    const pad = n => String(n).padStart(2, '0');
    if (day) {
      return {
        date_start: `${year}-${pad(month)}-${pad(day)}`,
        date_end:   `${year}-${pad(month)}-${pad(day)}`,
      };
    }
    const lastDay = new Date(+year, month, 0).getDate();
    return {
      date_start: `${year}-${pad(month)}-01`,
      date_end:   `${year}-${pad(month)}-${lastDay}`,
    };
  }

  _regionParams(q) {
    const coords = this._extractCoords(q);
    return {
      lat_min: coords.lat - 5, lat_max: coords.lat + 5,
      lon_min: coords.lon - 5, lon_max: coords.lon + 5,
    };
  }
}

module.exports = McpService;
