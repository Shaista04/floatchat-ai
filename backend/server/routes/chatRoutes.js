/**
 * FloatChat-AI API Routes
 *
 * Endpoints:
 *   POST /api/chat          — RAG-powered chat (query → LLM answer + data)
 *   GET  /api/search        — Semantic search without LLM
 *   GET  /api/profiles/:id  — Get specific profile data
 *   GET  /api/profiles/near — Geo-proximity query
 *   GET  /api/floats/:pn    — Get float info
 *   GET  /api/floats        — List all floats
 *   GET  /api/stats         — System statistics
 */

const express = require('express');
const router = express.Router();

function createRoutes(ragService, mongoService, vectorService) {

    // NOTE: /chat is handled directly in server.js (before this router is mounted)
    // so it is intentionally NOT defined here to avoid duplication.


    // ─── Semantic Search ─────────────────────────────────────────────

    router.get('/search', async (req, res) => {
        try {
            const { q, n = 10, collection = 'all' } = req.query;
            if (!q) {
                return res.status(400).json({ error: 'Query parameter "q" is required' });
            }

            const results = await ragService.semanticSearch(q, parseInt(n), collection);
            res.json({ query: q, count: results.length, results });
        } catch (err) {
            console.error('Search error:', err);
            res.status(500).json({ error: 'Search failed', detail: err.message });
        }
    });

    // ─── Profile Data ────────────────────────────────────────────────

    router.get('/profiles/near', async (req, res) => {
        try {
            const { lat, lon, radius_km = 100, limit = 20 } = req.query;
            if (!lat || !lon) {
                return res.status(400).json({ error: 'lat and lon are required' });
            }

            const profiles = await mongoService.nearestFloats(
                parseFloat(lat), parseFloat(lon),
                parseFloat(radius_km), parseInt(limit)
            );
            res.json({
                center: { lat: parseFloat(lat), lon: parseFloat(lon) },
                radius_km: parseFloat(radius_km),
                count: profiles.length,
                profiles: profiles.map(p => ({
                    _id: p._id,
                    platform_number: p.platform_number,
                    cycle_number: p.cycle_number,
                    latitude: p.latitude,
                    longitude: p.longitude,
                    timestamp: p.timestamp,
                    max_pres: p.max_pres,
                }))
            });
        } catch (err) {
            console.error('Near query error:', err);
            res.status(500).json({ error: 'Near query failed', detail: err.message });
        }
    });

    router.get('/profiles/:id', async (req, res) => {
        try {
            const profile = await mongoService.getProfile(req.params.id);
            if (!profile) {
                return res.status(404).json({ error: 'Profile not found' });
            }
            res.json(profile);
        } catch (err) {
            console.error('Profile error:', err);
            res.status(500).json({ error: 'Failed to get profile', detail: err.message });
        }
    });

    router.get('/profiles/by-date', async (req, res) => {
        try {
            const { start, end, lat_min, lat_max, lon_min, lon_max } = req.query;
            if (!start || !end) {
                return res.status(400).json({ error: 'start and end dates are required' });
            }

            const bbox = lat_min ? {
                lat_min: parseFloat(lat_min), lat_max: parseFloat(lat_max),
                lon_min: parseFloat(lon_min), lon_max: parseFloat(lon_max)
            } : null;

            const profiles = await mongoService.profilesByDate(start, end, bbox);
            res.json({ count: profiles.length, profiles });
        } catch (err) {
            console.error('By-date error:', err);
            res.status(500).json({ error: 'Date query failed', detail: err.message });
        }
    });

    router.get('/profiles/by-region', async (req, res) => {
        try {
            const { lat_min, lat_max, lon_min, lon_max, limit = 200 } = req.query;
            if (!lat_min || !lat_max || !lon_min || !lon_max) {
                return res.status(400).json({ error: 'lat_min, lat_max, lon_min, lon_max are required' });
            }

            const profiles = await mongoService.profilesByRegion(
                parseFloat(lat_min), parseFloat(lat_max),
                parseFloat(lon_min), parseFloat(lon_max),
                parseInt(limit)
            );
            res.json({ count: profiles.length, profiles });
        } catch (err) {
            console.error('By-region error:', err);
            res.status(500).json({ error: 'Region query failed', detail: err.message });
        }
    });

    // ─── Float Data ──────────────────────────────────────────────────

    router.get('/floats', async (req, res) => {
        try {
            const limit = parseInt(req.query.limit || 500);
            const floats = await mongoService.getAllFloats(limit);
            res.json({ count: floats.length, floats });
        } catch (err) {
            console.error('Floats error:', err);
            res.status(500).json({ error: 'Failed to get floats', detail: err.message });
        }
    });

    router.get('/floats/:platformNumber', async (req, res) => {
        try {
            const float = await mongoService.getFloat(req.params.platformNumber);
            if (!float) {
                return res.status(404).json({ error: 'Float not found' });
            }
            res.json(float);
        } catch (err) {
            console.error('Float error:', err);
            res.status(500).json({ error: 'Failed to get float', detail: err.message });
        }
    });

    // ─── Visualization Endpoints ─────────────────────────────────────

    router.get('/viz/trajectory/:platformNumber', async (req, res) => {
        try {
            const points = await mongoService.getTrajectory(req.params.platformNumber);
            res.json({
                platform_number: req.params.platformNumber,
                point_count: points.length,
                markers: points.map(p => ({
                    lat: p.latitude, lon: p.longitude,
                    cycle: p.cycle_number, timestamp: p.timestamp
                }))
            });
        } catch (err) {
            console.error('Trajectory error:', err);
            res.status(500).json({ error: 'Trajectory failed', detail: err.message });
        }
    });

    router.post('/viz/plot-profiles', async (req, res) => {
        try {
            const { platforms, param = 'PSAL' } = req.body;
            if (!platforms || !Array.isArray(platforms)) {
                return res.status(400).json({ error: 'platforms array is required' });
            }

            const data = await mongoService.getProfileMeasurements(platforms, param);
            // Build Plotly-compatible trace data
            const traces = data.map(p => ({
                x: p.data.map(d => d.value),
                y: p.data.map(d => -d.pres), // negative for depth
                name: `${p.platform_number} C${p.cycle_number}`,
                type: 'scatter',
                mode: 'lines+markers',
                meta: {
                    profile_id: p.profile_id,
                    lat: p.latitude, lon: p.longitude,
                    timestamp: p.timestamp
                }
            }));

            res.json({
                plotly: {
                    data: traces,
                    layout: {
                        title: `${param} Profiles`,
                        xaxis: { title: param },
                        yaxis: { title: 'Depth (m)', autorange: true },
                    }
                }
            });
        } catch (err) {
            console.error('Plot profiles error:', err);
            res.status(500).json({ error: 'Plot failed', detail: err.message });
        }
    });

    router.get('/viz/depth-time/:platformNumber', async (req, res) => {
        try {
            const { param = 'TEMP' } = req.query;
            const data = await mongoService.getDepthTimeData(req.params.platformNumber, param);

            res.json({
                platform_number: req.params.platformNumber,
                param,
                cycle_count: data.length,
                data: data.map(d => ({
                    cycle: d.cycle,
                    timestamp: d.timestamp,
                    depths: d.data.map(v => v.pres),
                    values: d.data.map(v => v.value),
                }))
            });
        } catch (err) {
            console.error('Depth-time error:', err);
            res.status(500).json({ error: 'Depth-time failed', detail: err.message });
        }
    });

    // ─── Analytics Endpoints ─────────────────────────────────────────

    router.post('/analytics/param-stats', async (req, res) => {
        try {
            const { profile_ids, param = 'PSAL' } = req.body;
            if (!profile_ids || !Array.isArray(profile_ids)) {
                return res.status(400).json({ error: 'profile_ids array is required' });
            }
            const stats = await mongoService.parameterStats(profile_ids, param);
            res.json(stats);
        } catch (err) {
            console.error('Stats error:', err);
            res.status(500).json({ error: 'Stats failed', detail: err.message });
        }
    });

    router.post('/analytics/compare-regions', async (req, res) => {
        try {
            const { region1, region2, param = 'PSAL', limit = 100 } = req.body;
            if (!region1 || !region2) {
                return res.status(400).json({ error: 'region1 and region2 bounds are required' });
            }
            const result = await mongoService.compareRegions(region1, region2, param, limit);
            res.json(result);
        } catch (err) {
            console.error('Compare error:', err);
            res.status(500).json({ error: 'Compare failed', detail: err.message });
        }
    });

    router.get('/analytics/time-series/:platformNumber', async (req, res) => {
        try {
            const { param = 'TEMP', cycle_start, cycle_end } = req.query;
            const cycleRange = cycle_start && cycle_end
                ? [parseInt(cycle_start), parseInt(cycle_end)]
                : null;
            const data = await mongoService.timeSeriesStats(
                req.params.platformNumber, param, cycleRange
            );
            res.json({
                platform_number: req.params.platformNumber,
                param,
                cycle_count: data.length,
                series: data
            });
        } catch (err) {
            console.error('Time series error:', err);
            res.status(500).json({ error: 'Time series failed', detail: err.message });
        }
    });

    // ─── Export ───────────────────────────────────────────────────────

    router.post('/export/csv', async (req, res) => {
        try {
            const { profile_ids, params = ['PRES', 'TEMP', 'PSAL'] } = req.body;
            if (!profile_ids || !Array.isArray(profile_ids)) {
                return res.status(400).json({ error: 'profile_ids array is required' });
            }

            const csv = await mongoService.exportCsv(profile_ids, params);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="argo_data.csv"');
            res.send(csv);
        } catch (err) {
            console.error('Export error:', err);
            res.status(500).json({ error: 'Export failed', detail: err.message });
        }
    });

    // ─── System Stats ────────────────────────────────────────────────

    router.get('/stats', async (req, res) => {
        try {
            const [mongoStats, vectorStats] = await Promise.all([
                mongoService.getStats(),
                vectorService.getStats().catch(() => ({ status: 'unavailable' })),
            ]);
            res.json({
                ...mongoStats,
                vector_db: vectorStats,
                status: 'ok',
            });
        } catch (err) {
            res.status(500).json({ error: 'Stats failed', detail: err.message });
        }
    });

    return router;
}

module.exports = createRoutes;
