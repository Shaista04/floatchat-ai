'use strict';

const { spawn } = require('child_process');
const path      = require('path');

/**
 * VectorService — bridges Node.js to ChromaDB via Python subprocess.
 * Uses the project's venv python binary for reliable module access.
 */
class VectorService {
  /**
   * @param {string} pythonBin  Path to python executable (venv)
   */
  constructor(pythonBin = 'python') {
    this.pythonBin   = pythonBin;
    this.searchScript = path.join(__dirname, '../search_chroma.py');
  }

  async connect() {
    console.log(`✅ VectorService initialized (python: ${this.pythonBin})`);
  }

  /**
   * Search ChromaDB for nearest context documents.
   * @param {string} query
   * @param {number} limit
   * @returns {Promise<string[]>}  Array of document text strings
   */
  async search(query, limit = 16) {
    return new Promise((resolve) => {
      const proc = spawn(this.pythonBin, [this.searchScript, query, String(limit)]);
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (d) => { stdout += d.toString(); });
      proc.stderr.on('data', (d) => { stderr += d.toString(); });

      proc.on('close', (code) => {
        if (code !== 0) {
          console.warn(`[VectorService] search exited ${code}: ${stderr.trim().slice(0, 200)}`);
          return resolve([]);
        }
        try {
          const result = JSON.parse(stdout);
          // ChromaDB returns { documents: [[...]], metadatas: [[...]], ... }
          const docs = result.documents?.[0] ?? result.documents ?? result ?? [];
          resolve(Array.isArray(docs) ? docs : []);
        } catch (e) {
          console.warn('[VectorService] JSON parse error:', e.message);
          resolve([]);
        }
      });

      proc.on('error', (err) => {
        console.warn('[VectorService] spawn error:', err.message);
        resolve([]);
      });
    });
  }

  async getStats() {
    return { status: 'ok', engine: 'chromadb', script: this.searchScript };
  }
}

module.exports = VectorService;
