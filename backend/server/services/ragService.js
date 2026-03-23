'use strict';

const axios  = require('axios');
const { spawn, execSync } = require('child_process');

/**
 * RagService — Hybrid RAG + MCP pipeline.
 *
 * Flow per user query:
 *   1. Vector search (ChromaDB) → top-K context snippets
 *   2. Intent classification (McpService) → tool name + params
 *   3. MCP tool dispatch → real MongoDB data
 *   4. Build prompt: system + vector context + real data results
 *   5. Call Ollama LLM → final answer
 *   6. If LLM unavailable → smart data-driven fallback (NOT a raw dump)
 *   7. Save message to MongoDB (if sessionId provided)
 */
class RagService {
  constructor(vectorService, mongoService, mcpService, config) {
    this.vectorService = vectorService;
    this.mongoService  = mongoService;
    this.mcpService    = mcpService;
    this.config        = config;
    this._ollamaReady  = false;
    this._ollamaChecked = false;
  }

  // ─── Auto-start Ollama if installed but not running ──────────────────

  async ensureOllama() {
    if (this._ollamaChecked) return this._ollamaReady;
    this._ollamaChecked = true;

    try {
      // 1. Is it already running?
      await axios.get(`${this.config.llmApiUrl.replace('/api', '')}/api/tags`, { timeout: 2000 });
      console.log('[Ollama] Already running ✓');
      this._ollamaReady = true;
      return true;
    } catch (_) {
      // 2. Not running — try to start it
      console.log('[Ollama] Not running — attempting to start...');
      try {
        const proc = spawn('ollama', ['serve'], {
          detached: true, stdio: 'ignore',
          shell: process.platform === 'win32',
        });
        proc.unref();

        // Wait up to 8 seconds for it to come up
        for (let i = 0; i < 8; i++) {
          await new Promise(r => setTimeout(r, 1000));
          try {
            await axios.get(`${this.config.llmApiUrl.replace('/api', '')}/api/tags`, { timeout: 1000 });
            console.log(`[Ollama] Started successfully after ${i + 1}s ✓`);
            this._ollamaReady = true;
            return true;
          } catch (_) { /* keep waiting */ }
        }
        console.warn('[Ollama] Started but did not respond in 8s — will retry on first query');
        return false;
      } catch (err) {
        console.warn('[Ollama] Could not start:', err.message);
        return false;
      }
    }
  }

  // ─── Main chat entry point ───────────────────────────────────────────

  async chat(query, sessionId = null, userId = null) {
    // Start Ollama in background on first call (non-blocking)
    this.ensureOllama().catch(() => {});

    // ── 1. Save user message ──────────────────────────────────────────
    if (sessionId && userId) {
      await this.mongoService.saveMessage(sessionId, 'user', query).catch(() => {});
    }

    // ── 2. Vector Search (top-12 context) ────────────────────────────
    let vectorContext = [];
    try {
      const raw = await this.vectorService.search(query, 12);
      vectorContext = Array.isArray(raw) ? raw.slice(0, 12) : [];
    } catch (e) {
      console.warn('[RAG] Vector search failed:', e.message);
    }

    // ── 3. Intent Classification via Native LLM Tool Calling ──────────
    let intent = { tool: 'generic_chat', params: {} };
    let llmReasoning = '';
    let llmConnected = false;

    try {
      console.log(`[RAG] LLM Intent Classification POST ${this.config.llmApiUrl}/chat`);
      const toolRes = await axios.post(`${this.config.llmApiUrl}/chat`, {
        model: this.config.llmModel,
        messages: [
          { role: 'system', content: 'You are FloatChat-AI, an expert oceanographic assistant. If the user asks for data or maps, use the provided tools. If the user just says hi, asks your name, or asks a generic conversational question, answer them naturally in a friendly tone without using any tools. CRITICAL RULE FOR DATES: If the user asks for a single specific day (e.g. October 12 2018), you MUST set BOTH date_start and date_end to that exact day (2018-10-12). NEVER default date_start to the first of the month unless explicitly asked!' },
          { role: 'user', content: query }
        ],
        tools: this.mcpService.getToolSchemas(),
        stream: false,
      }, { timeout: 45000 });

      llmConnected = true;
      const msg = toolRes.data?.message;
      if (msg?.tool_calls && msg.tool_calls.length > 0) {
        const call = msg.tool_calls[0].function;
        intent.tool = call.name;
        // Arguments can come back as a string or an object depending on Ollama version
        intent.params = typeof call.arguments === 'string' ? JSON.parse(call.arguments) : (call.arguments || {});
        console.log(`[RAG] LLM selected tool: ${intent.tool} with params:`, intent.params);
      } else if (msg?.content) {
        // If LLM decides a tool is not needed, treat as generic conversation
        intent.tool = 'generic_chat';
        llmReasoning = msg.content;
      }
    } catch (e) {
      console.warn('[RAG] LLM tool extraction failed/offline. Falling back to generic/keyword intent.', e.message);
      // Basic offline fallback mechanism if LLM crashes
      if (/float|table|map|chart|plot|temperature|salinity|depth|argo/.test(query.toLowerCase())) {
        intent = { tool: 'get_data_table', params: {} };
      }
    }

    // ── 4. Execute MCP Tool ───────────────────────────────────────────
    let toolResult  = null;
    let toolSummary = '';
    let toolCode    = null;

    if (intent.tool !== 'generic_chat') {
      try {
        toolResult = await this.mcpService.runTool(intent.tool, intent.params);
        console.log(`[RAG] MCP Tool Executed | Type: ${toolResult?.type}`);

        if (toolResult && !toolResult.error) {
          toolSummary = this._buildToolSummary(intent.tool, toolResult);
          toolCode    = JSON.stringify({ tool: intent.tool, params: intent.params, type: toolResult.type }, null, 2);
        }
      } catch (e) {
        console.warn('[RAG] MCP tool failed:', e.message);
      }
    }

    // ── 5. Build Final Response ───────────────────────────────────────
    let answer = '';
    
    // Instead of doing a SECOND massive roundtrip to the LLM just to write a text summary,
    // we use our super-fast _smartFallback string generator if it was a data query, OR 
    // the LLM's initial conversational response if it was a generic chat query.
    if (intent.tool === 'generic_chat' && llmConnected) {
      answer = llmReasoning || "I'm FloatChat-AI! How can I help you analyze ARGO data today?";
    } else {
      answer = this._smartFallback(query, intent, toolResult, toolSummary);
    }

    // ── 7. Build & save response ──────────────────────────────────────
    const aiMessage = {
      type:        'ai',
      content:     answer,
      hasCode:     !!toolCode,
      code:        toolCode,
      tool_used:   intent.tool,
      tool_result: toolResult,
      timestamp:   new Date(),
    };

    if (sessionId) {
      await this.mongoService.saveMessage(sessionId, 'ai', answer, toolCode).catch(() => {});
    }

    return aiMessage;
  }

  // ─── Smart Data-Driven Fallback (no LLM required) ───────────────────

  _smartFallback(query, intent, toolResult, toolSummary) {
    const tool = intent.tool;
    const data = toolResult?.data;
    const type = toolResult?.type;

    // Visualization types — just say what's being shown
    if (type === 'plotly') {
      const layout = toolResult?.plotly?.layout;
      const title  = layout?.title?.text || tool.replace(/_/g, ' ');
      const traces = toolResult?.plotly?.data || [];
      const n      = traces.reduce((acc, t) => acc + (t.x?.length || 0), 0);
      return `📊 **${title}**\n\nGenerated from ${traces.length} data series with ${n.toLocaleString()} data points from the ARGO Indian Ocean array.\n\n${toolSummary ? toolSummary + '\n\n' : ''}_(Full LLM analysis available when Ollama is running)_`;
    }

    if (type === 'leaflet') {
      const markers = toolResult?.markers || [];
      return `🗺️ **Float Map — ${markers.length} locations**\n\nDisplaying ${markers.length} float position${markers.length !== 1 ? 's' : ''} from the ARGO Indian Ocean array.\n\n${toolResult?.polyline ? `The trajectory spans ${toolResult.polyline.length} waypoints.\n\n` : ''}_(Full LLM analysis available when Ollama is running)_`;
    }

    if (type === 'metadata_card') {
      const d = toolResult.data || {};
      return `🃏 **Float Metadata — Platform ${d.platform_number || '?'}**\n\n` +
        `• **Project:** ${d.project_name || '—'}\n` +
        `• **PI:** ${d.pi_name || '—'}\n` +
        `• **Type:** ${d.platform_type || d.float_type || '—'}\n` +
        `• **Total Cycles:** ${d.total_cycles || '—'}\n` +
        `• **BGC:** ${d.has_bgc ? 'Yes ✓' : 'No'}\n` +
        `• **First Date:** ${d.first_date ? new Date(d.first_date).toLocaleDateString() : '—'}\n` +
        `• **Last Date:** ${d.last_date ? new Date(d.last_date).toLocaleDateString() : '—'}`;
    }

    if (type === 'stats_card') {
      const d = toolResult.data || {};
      const p = toolResult.param || '';
      return `📈 **${p} Statistics${toolResult.platform ? ` — Platform ${toolResult.platform}` : ''}**\n\n` +
        `• **Mean:** ${d.mean?.toFixed(4) ?? '—'}\n` +
        `• **Std Dev:** ${d.std?.toFixed(4) ?? '—'}\n` +
        `• **Min:** ${d.min?.toFixed(4) ?? '—'}\n` +
        `• **Max:** ${d.max?.toFixed(4) ?? '—'}\n` +
        `• **Count:** ${d.count?.toLocaleString() ?? '—'} values`;
    }

    if (type === 'data_table') {
      const rows = toolResult.rows || [];
      if (rows.length === 0) return "No float data matched your query. Try a different region or date.";
      return `📋 **Float Data Table — ${rows.length} records**\n\n` +
        `Found ${rows.length} ARGO floats matching your query from the Indian Ocean array. The table is rendered below.`;
    }

    if (tool === 'generic_chat') {
      return "I am FloatChat-AI, an expert oceanographic assistant. I specialize in fetching live ARGO float data, generating charts, and answering marine science questions.\n\n_(Note: My primary language model is currently offline, but my data retrieval tools are fully functional!)_";
    }

    if (type === 'text') {
      return data || toolSummary || "Processing complete.";
    }

    // Data type — analyse the records
    if (type === 'data' && Array.isArray(data)) {
      if (data.length === 0) {
        return `I searched for data using the **${tool.replace(/_/g, ' ')}** tool but found 0 matching records. Try a different date range or a wider region in the Indian Ocean.`;
      }

      const sample = data[0];
      let intro = `Found **${data.length}** ARGO record${data.length !== 1 ? 's' : ''} for your query.\n\n`;

      if (tool === 'query_float') {
        intro += `**Platform ${sample.platform_number}** — Cycle ${sample.cycle_number}\n` +
          `• Location: ${sample.latitude?.toFixed(3)}°N, ${sample.longitude?.toFixed(3)}°E\n` +
          `• Date: ${sample.timestamp ? new Date(sample.timestamp).toLocaleDateString() : '—'}\n` +
          `• Max pressure: ${sample.max_pres || '—'} dbar`;
      } else if (tool.includes('nearest') || tool.includes('region') || tool.includes('date')) {
        const platforms = [...new Set(data.map(d => d.platform_number).filter(Boolean))];
        intro += `**Platforms:** ${platforms.slice(0, 5).join(', ')}${platforms.length > 5 ? ` +${platforms.length - 5} more` : ''}\n` +
          `**Date range:** ${data[0].timestamp ? new Date(data[0].timestamp).toLocaleDateString() : '—'} → ` +
          `${data[data.length - 1]?.timestamp ? new Date(data[data.length - 1].timestamp).toLocaleDateString() : '—'}`;
      }

      return intro;
    }

    if (type === 'data' && data && typeof data === 'object' && !Array.isArray(data)) {
      // Single document (stats, comparison, etc.)
      if (data.region1 && data.region2) {
        const r1 = data.region1.stats || {};
        const r2 = data.region2.stats || {};
        return `**Region Comparison**\n\n` +
          `| | Region 1 | Region 2 |\n|---|---|---|\n` +
          `| Mean | ${r1.mean?.toFixed(3) ?? '—'} | ${r2.mean?.toFixed(3) ?? '—'} |\n` +
          `| Std | ${r1.std?.toFixed(3) ?? '—'} | ${r2.std?.toFixed(3) ?? '—'} |\n` +
          `| Min | ${r1.min?.toFixed(3) ?? '—'} | ${r2.min?.toFixed(3) ?? '—'} |\n` +
          `| Max | ${r1.max?.toFixed(3) ?? '—'} | ${r2.max?.toFixed(3) ?? '—'} |`;
      }
      // Dataset stats
      if (data.activeFloats != null) {
        return `**ARGO Dataset Summary**\n\n` +
          `• Active Floats: **${data.activeFloats.toLocaleString()}**\n` +
          `• Total Profiles: **${data.total_profiles?.toLocaleString() || '—'}**\n` +
          `• BGC Profiles: **${data.total_bgc_profiles?.toLocaleString() || '—'}**\n` +
          `• BGC Coverage: **${data.bgcCoverage || '—'}**`;
      }
      return `📊 Data retrieved:\n\n${JSON.stringify(data, null, 2).substring(0, 500)}`;
    }

    if (tool === 'generic_chat') {
      return "I am FloatChat-AI, an expert oceanographic assistant. I specialize in fetching live ARGO float data, generating charts, and answering marine science questions.\n\n_(Note: My primary language model is currently offline, but my data retrieval tools are fully functional!)_";
    }

    // Generic fallback
    return `I processed your query about "${query}" using the **${tool.replace(/_/g, ' ')}** tool.${toolSummary ? '\n\n' + toolSummary : ''}\n\n_(Start Ollama with \`ollama serve\` for full AI-powered analysis)_`;
  }


  // ─── Tool Summary Builder (for LLM prompt) ───────────────────────────

  _buildToolSummary(tool, toolResult) {
    const data = toolResult?.data;
    const type = toolResult?.type;

    if (type === 'plotly') {
      const traces = toolResult?.plotly?.data || [];
      return `Visualization ready: ${tool} with ${traces.length} trace(s).`;
    }
    if (type === 'leaflet') {
      return `Map ready with ${(toolResult.markers || []).length} markers.`;
    }
    if (type === 'metadata_card') {
      const d = toolResult.data || {};
      return `Float ${d.platform_number}: ${d.total_cycles} cycles, ${d.has_bgc ? 'BGC' : 'no BGC'}, project: ${d.project_name}.`;
    }
    if (type === 'stats_card') {
      const d = toolResult.data || {};
      return `${toolResult.param} stats: mean=${d.mean?.toFixed(3)}, std=${d.std?.toFixed(3)}, min=${d.min?.toFixed(3)}, max=${d.max?.toFixed(3)} (n=${d.count}).`;
    }
    if (type === 'data_table') {
      return `Table: ${(toolResult.rows || []).length} records.`;
    }
    if (Array.isArray(data) && data.length > 0) {
      const s = data[0];
      return `${tool} returned ${data.length} record(s). Sample: platform=${s.platform_number} lat=${s.latitude?.toFixed(2)} lon=${s.longitude?.toFixed(2)} ts=${s.timestamp ? new Date(s.timestamp).toLocaleDateString() : '—'}`;
    }
    if (data && typeof data === 'object') {
      return JSON.stringify(data, null, 2).substring(0, 400);
    }
    return '(No data)';
  }

  // ─── Pure semantic search ────────────────────────────────────────────

  async semanticSearch(query, n = 10) {
    try {
      return await this.vectorService.search(query, n);
    } catch (e) {
      console.error('[RAG] Semantic search error:', e.message);
      return [];
    }
  }
}

module.exports = RagService;
