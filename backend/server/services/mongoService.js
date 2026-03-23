'use strict';

const { MongoClient, ObjectId } = require('mongodb');

/**
 * MongoService — Full implementation for FloatChat-AI backend.
 * Collections (matching ingestion.py):
 *   floats        — one doc per unique platform_number
 *   profiles      — core ARGO profiles
 *   bgc_profiles  — BGC ARGO profiles
 */
class MongoService {
  constructor(uri, dbName) {
    this.uri = uri;
    this.dbName = dbName;
    this.client = new MongoClient(uri);
    this.db = null;
  }

  async connect() {
    if (this.db) return;
    await this.client.connect();
    this.db = this.client.db(this.dbName);
    console.log(`✅ MongoDB connected: ${this.dbName}`);
  }

  _profiles()    { return this.db.collection('profiles'); }
  _bgc()         { return this.db.collection('bgc_profiles'); }
  _floats()      { return this.db.collection('floats'); }
  _sessions()    { return this.db.collection('chat_sessions'); }
  _messages()    { return this.db.collection('chat_messages'); }

  // ─── Floats ───────────────────────────────────────────────────────────────

  /**
   * List all floats summary (one doc per platform).
   * Fields: platform_number, total_cycles, has_bgc, first_date, last_date,
   *         geo_bounding_box, project_name, pi_name, data_centre
   */
  async getAllFloats(limit = 500) {
    const docs = await this._floats()
      .find({})
      .project({
        platform_number: 1,
        project_name: 1,
        pi_name: 1,
        platform_type: 1,
        data_centre: 1,
        total_cycles: 1,
        has_bgc: 1,
        bgc_parameters: 1,
        first_date: 1,
        last_date: 1,
        geo_bounding_box: 1,
        data_modes_used: 1,
      })
      .limit(limit)
      .toArray();
    return docs;
  }

  /** Single float metadata by platform number. */
  async getFloat(platformNumber) {
    return this._floats().findOne({ platform_number: String(platformNumber) });
  }

  // ─── Query Float (legacy / MCP tool: query_float) ─────────────────────────

  async queryFloat(platform, cycle = null) {
    const query = { platform_number: String(platform) };
    if (cycle !== null) query.cycle_number = Number(cycle);
    return this._profiles().find(query).limit(10).toArray();
  }

  // ─── Profile Queries ──────────────────────────────────────────────────────

  /** Single profile by MongoDB _id. */
  async getProfile(id) {
    try {
      return await this._profiles().findOne({ _id: id });
    } catch (e) {
      return null;
    }
  }

  /**
   * Nearest floats to a lat/lon point within radius_km.
   * Uses 2dsphere index on geo_location (set by ingestion.py).
   */
  async nearestFloats(lat, lon, radius_km = 100, limit = 20) {
    const radiusRadians = radius_km / 6371; // Earth radius km
    const docs = await this._profiles()
      .find({
        geo_location: {
          $geoWithin: {
            $centerSphere: [[lon, lat], radiusRadians],
          },
        },
      })
      .project({
        platform_number: 1, cycle_number: 1,
        latitude: 1, longitude: 1,
        timestamp: 1, max_pres: 1,
      })
      .limit(limit)
      .toArray();
    return docs;
  }

  /**
   * Profiles in a date range, optionally within a bounding box.
   * @param {string} startDate ISO date string
   * @param {string} endDate   ISO date string
   * @param {object|null} bbox { lat_min, lat_max, lon_min, lon_max }
   */
  async profilesByDate(startDate, endDate, bbox = null, limit = 50) {
    let end = new Date(endDate);
    // If the endDate is exactly midnight (meaning no time was specified), stretch it to 23:59:59 to include the whole day
    if (end.getUTCHours() === 0 && end.getUTCMinutes() === 0 && end.getUTCSeconds() === 0) {
      end.setUTCHours(23, 59, 59, 999);
    }

    const q = {
      timestamp: {
        $gte: new Date(startDate).toISOString(),
        $lte: end.toISOString(),
      }
    };
    if (bbox && bbox.lat_min !== undefined && bbox.lat_max !== undefined) {
      q.latitude  = { $gte: bbox.lat_min, $lte: bbox.lat_max };
      q.longitude = { $gte: bbox.lon_min, $lte: bbox.lon_max };
    }
    return this._profiles()
      .find(q)
      .project({ platform_number: 1, cycle_number: 1, latitude: 1, longitude: 1, timestamp: 1, max_pres: 1, measurements: 1 })
      .limit(limit)
      .toArray();
  }
  /**
   * Profiles within a geographic bounding box.
   */
  async profilesByRegion(lat_min, lat_max, lon_min, lon_max, limit = 200) {
    const docs = await this._profiles()
      .find({
        latitude:  { $gte: lat_min, $lte: lat_max },
        longitude: { $gte: lon_min, $lte: lon_max },
      })
      .project({ platform_number: 1, cycle_number: 1, latitude: 1, longitude: 1, timestamp: 1, max_pres: 1 })
      .limit(limit)
      .toArray();
    return docs;
  }

  // ─── Visualization Queries ────────────────────────────────────────────────

  /** Float trajectory — lat/lon/timestamp per cycle, sorted ascending. */
  async getTrajectory(platformNumber) {
    return this._profiles()
      .find({ platform_number: String(platformNumber) })
      .project({ cycle_number: 1, latitude: 1, longitude: 1, timestamp: 1 })
      .sort({ cycle_number: 1 })
      .toArray();
  }

  /**
   * Profile measurements for Plotly traces.
   * Returns array of { platform_number, cycle_number, latitude, longitude, timestamp, data: [{pres, value}] }
   * param: field name in measurements array e.g. 'PSAL', 'TEMP'
   */
  async getProfileMeasurements(platforms, param = 'PSAL') {
    const paramKey = param.toUpperCase();
    const presKey  = 'PRES';

    const docs = await this._profiles()
      .find({ platform_number: { $in: platforms.map(String) } })
      .project({
        platform_number: 1, cycle_number: 1,
        latitude: 1, longitude: 1, timestamp: 1,
        [`measurements.${paramKey}`]: 1,
        [`measurements.${presKey}`]: 1,
      })
      .limit(50)
      .toArray();

    return docs.map(doc => {
      const presArr  = (doc.measurements && doc.measurements[presKey])  || [];
      const valArr   = (doc.measurements && doc.measurements[paramKey]) || [];
      const data = presArr.map((p, i) => ({ pres: p, value: valArr[i] }))
        .filter(d => d.pres != null && d.value != null);
      return {
        profile_id: doc._id,
        platform_number: doc.platform_number,
        cycle_number: doc.cycle_number,
        latitude: doc.latitude,
        longitude: doc.longitude,
        timestamp: doc.timestamp,
        data,
      };
    });
  }

  /**
   * Depth-time data for a single float.
   * Returns array of { cycle, timestamp, data: [{pres, value}] }
   */
  async getDepthTimeData(platformNumber, param = 'TEMP') {
    const paramKey = param.toUpperCase();
    const presKey  = 'PRES';

    const docs = await this._profiles()
      .find({ platform_number: String(platformNumber) })
      .project({
        cycle_number: 1, timestamp: 1,
        [`measurements.${paramKey}`]: 1,
        [`measurements.${presKey}`]: 1,
      })
      .sort({ cycle_number: 1 })
      .toArray();

    return docs.map(doc => {
      const presArr = (doc.measurements && doc.measurements[presKey])  || [];
      const valArr  = (doc.measurements && doc.measurements[paramKey]) || [];
      const data = presArr.map((p, i) => ({ pres: p, value: valArr[i] }))
        .filter(d => d.pres != null && d.value != null);
      return { cycle: doc.cycle_number, timestamp: doc.timestamp, data };
    });
  }

  // ─── Analytics ────────────────────────────────────────────────────────────

  /**
   * Compute mean/std/min/max for a parameter across a list of profile _ids.
   */
  async parameterStats(profileIds, param = 'PSAL') {
    const paramKey = param.toUpperCase();
    const docs = await this._profiles()
      .find({ _id: { $in: profileIds } })
      .project({ [`measurements.${paramKey}`]: 1 })
      .toArray();

    const values = [];
    for (const doc of docs) {
      const arr = (doc.measurements && doc.measurements[paramKey]) || [];
      for (const v of arr) { if (v != null) values.push(v); }
    }

    if (values.length === 0) return { count: 0, mean: null, std: null, min: null, max: null };

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    return {
      count: values.length,
      mean: +mean.toFixed(4),
      std:  +(Math.sqrt(variance)).toFixed(4),
      min:  +Math.min(...values).toFixed(4),
      max:  +Math.max(...values).toFixed(4),
    };
  }

  /**
   * Compare two geographic regions for a parameter.
   * region: { lat_min, lat_max, lon_min, lon_max }
   */
  async compareRegions(region1, region2, param = 'PSAL', limit = 100) {
    const paramKey = param.toUpperCase();

    const fetchIds = async (region) => {
      const docs = await this._profiles()
        .find({
          latitude:  { $gte: region.lat_min, $lte: region.lat_max },
          longitude: { $gte: region.lon_min, $lte: region.lon_max },
        })
        .project({ _id: 1 })
        .limit(limit)
        .toArray();
      return docs.map(d => d._id);
    };

    const [ids1, ids2] = await Promise.all([fetchIds(region1), fetchIds(region2)]);
    const [stats1, stats2] = await Promise.all([
      this.parameterStats(ids1, param),
      this.parameterStats(ids2, param),
    ]);

    return {
      param,
      region1: { bounds: region1, profile_count: ids1.length, stats: stats1 },
      region2: { bounds: region2, profile_count: ids2.length, stats: stats2 },
    };
  }

  /**
   * Per-cycle time series statistics for a single float.
   * cycleRange: [start, end] inclusive or null for all cycles.
   */
  async timeSeriesStats(platformNumber, param = 'TEMP', cycleRange = null) {
    const paramKey = param.toUpperCase();
    const query = { platform_number: String(platformNumber) };
    if (cycleRange) {
      query.cycle_number = { $gte: cycleRange[0], $lte: cycleRange[1] };
    }

    const docs = await this._profiles()
      .find(query)
      .project({
        cycle_number: 1, timestamp: 1,
        [`measurements.${paramKey}`]: 1,
      })
      .sort({ cycle_number: 1 })
      .toArray();

    return docs.map(doc => {
      const arr = (doc.measurements && doc.measurements[paramKey]) || [];
      const vals = arr.filter(v => v != null);
      const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      return {
        cycle: doc.cycle_number,
        timestamp: doc.timestamp,
        count: vals.length,
        mean: mean != null ? +mean.toFixed(4) : null,
        min: vals.length ? +Math.min(...vals).toFixed(4) : null,
        max: vals.length ? +Math.max(...vals).toFixed(4) : null,
      };
    });
  }

  // ─── Export ───────────────────────────────────────────────────────────────

  /**
   * Export selected profiles to CSV string.
   * params: array of parameter names e.g. ['PRES','TEMP','PSAL']
   */
  async exportCsv(profileIds, params = ['PRES', 'TEMP', 'PSAL']) {
    const upperParams = params.map(p => p.toUpperCase());
    const docs = await this._profiles()
      .find({ _id: { $in: profileIds } })
      .project({
        platform_number: 1, cycle_number: 1,
        latitude: 1, longitude: 1, timestamp: 1,
        ...Object.fromEntries(upperParams.map(p => [`measurements.${p}`, 1])),
      })
      .toArray();

    // Build CSV rows — one row per depth level
    const header = ['profile_id','platform_number','cycle_number','latitude','longitude','timestamp','level', ...upperParams].join(',');
    const rows = [header];

    for (const doc of docs) {
      const presArr = (doc.measurements && doc.measurements['PRES']) || [];
      const len = presArr.length || 1;

      for (let i = 0; i < len; i++) {
        const row = [
          doc._id,
          doc.platform_number,
          doc.cycle_number,
          doc.latitude,
          doc.longitude,
          doc.timestamp ? new Date(doc.timestamp).toISOString() : '',
          i + 1,
          ...upperParams.map(p => {
            const arr = (doc.measurements && doc.measurements[p]) || [];
            const v = arr[i];
            return v != null ? v : '';
          }),
        ];
        rows.push(row.join(','));
      }
    }

    return rows.join('\n');
  }

  // ─── System Stats ─────────────────────────────────────────────────────────

  /** Returns overall database statistics for the Dashboard. */
  async getStats() {
    const [
      totalFloats,
      totalProfiles,
      totalBgc,
      recentProfiles,
      bgcFloats,
    ] = await Promise.all([
      this._floats().countDocuments({}),
      this._profiles().countDocuments({}),
      this._bgc().countDocuments({}),
      this._profiles().countDocuments({
        timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      }),
      this._floats().countDocuments({ has_bgc: true }),
    ]);

    return {
      total_floats: totalFloats,
      total_profiles: totalProfiles,
      total_bgc_profiles: totalBgc,
      recent_profiles: recentProfiles,
      bgc_floats: bgcFloats,
      // For summary cards
      activeFloats:    totalFloats,
      recentProfiles:  recentProfiles,
      bgcCoverage:     totalFloats > 0 ? `${Math.round((bgcFloats / totalFloats) * 100)}%` : '0%',
      dataPoints:      `${(totalProfiles + totalBgc).toLocaleString()}`,
    };
  }

  // ─── Chat Sessions ─────────────────────────────────────────────────────────

  async createSession(userId, title = 'New Session') {
    const doc = {
      userId,
      title,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await this._sessions().insertOne(doc);
    return { ...doc, _id: result.insertedId, id: result.insertedId.toString() };
  }

  async getSessions(userId) {
    return this._sessions()
      .find({ userId })
      .sort({ updatedAt: -1 })
      .limit(50)
      .toArray();
  }

  async deleteSession(sessionId) {
    await this._sessions().deleteOne({ _id: new ObjectId(sessionId) });
    await this._messages().deleteMany({ sessionId });
  }

  async saveMessage(sessionId, type, content, code = null) {
    const doc = {
      sessionId,
      type,
      content,
      code,
      hasCode: !!code,
      timestamp: new Date(),
    };
    const result = await this._messages().insertOne(doc);
    // Update session timestamp
    await this._sessions().updateOne(
      { _id: new ObjectId(sessionId) },
      { $set: { updatedAt: new Date() } }
    );
    return { ...doc, _id: result.insertedId, id: result.insertedId.toString() };
  }

  async getMessages(sessionId, limit = 100) {
    return this._messages()
      .find({ sessionId })
      .sort({ timestamp: 1 })
      .limit(limit)
      .toArray();
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  async close() {
    await this.client.close();
  }
}

module.exports = MongoService;
