# FloatChat-AI 🌊🤖

**An AI-powered Conversational Interface for ARGO Ocean Data Discovery and Visualization**

FloatChat-AI is a full-stack application that transforms raw ARGO oceanography data into an interactive, intelligent conversational system. It ingests NetCDF files into MongoDB, generates semantic embeddings with ChromaDB, and provides a RAG-powered chatbot interface (React + Node.js + Python) to query ocean salinity, temperature, and biogeochemical metrics through natural language.

> ⚠️ **Status:** This product is still under active development. Features and APIs may change.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
![Python](https://img.shields.io/badge/Python-3.10%2B-blue)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)
![MongoDB](https://img.shields.io/badge/MongoDB-Local-brightgreen)

---

## 📋 Table of Contents

- [Features](#features)
- [System Requirements](#-system-requirements)
- [Quick Start](#-quick-start)
- [Running Each Phase](#-running-each-phase)
- [Project Structure](#-project-structure)
- [API Endpoints](#-api-endpoints)
- [Development](#-development)
- [Testing](#-testing)
- [License](#-license)

---

## ✨ Features

- **Semantic Search**: Query ARGO data using natural language thanks to ChromaDB embeddings
- **Real-Time Chat**: Multi-turn conversations with citation tracking and source logging
- **Data Visualization**: Geographic mapping with Leaflet and multi-dimensional charts with Plotly
- **Full Stack**: Python data pipelines + Node.js REST API + React frontend
- **Scalable**: Multiprocess data ingestion and ChromaDB for fast vector similarity search
- **Local LLM Support**: Integration with Llama3:8b for on-device inference
- **Model Context Protocol**: MCP integration for extensible tool support

---

## 💻 System Requirements

- **Minimum**: 16GB RAM, 20GB disk space
- **Recommended**: 32GB RAM, 50GB SSD
- **Network**: Internet access for initial setup
- **OS**: Linux/macOS/Windows (WSL2 recommended for Windows)

### Required Software

- **Python 3.10+** – Data processing and ML pipelines
- **Node.js 18+** – Express backend and build tools
- **MongoDB 5.0+** – Primary data store (local or remote)
- **Llama3:8b** – Local LLM inference via Ollama

---

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/cherry-2207/floatchat-ai.git
cd floatchat-ai
```

### 2. Set Up Python Environment

```bash
# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate
# On Windows: .venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt
```

### 3. Set Up Node.js Environment

```bash
# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend/server
npm install
```

### 4. Configure Environment Variables

Create a `.env` file in `backend/server/`:

```bash
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=floatchat_ai

# LLM Configuration (Ollama)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3:8b

# Server Configuration
PORT=3001
NODE_ENV=development
```

### 5. Start Services

```bash
# Terminal 1: Start MongoDB (ensure it's running on port 27017)
mongod

# Terminal 2: Start Ollama with Llama3:8b
ollama pull llama3:8b && ollama serve

# Terminal 3: Start Node.js backend
cd backend/server
npm start

# Terminal 4: Start React frontend
cd frontend
npm run dev
```

Visit `http://localhost:5173` (Vite dev server) to access the UI.

---

---

## 📂 Project Structure

```
floatchat-ai/
├── backend/
│   ├── mongodb/              # CRUD example application
│   │   ├── server.js
│   │   ├── routes/
│   │   ├── controller/
│   │   ├── model/
│   │   └── package.json
│   └── server/               # Main Express API
│       ├── server.js         # Entry point
│       ├── package.json
│       ├── .env              # Environment config
│       ├── routes/
│       │   └── chatRoutes.js
│       ├── services/
│       │   ├── mongoService.js
│       │   ├── vectorService.js
│       │   ├── ragService.js
│       │   └── mcpService.js
│       └── tests/
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── index.html
│   ├── public/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── hooks/
│       └── App.jsx
├── data/                    # Phase 1: Data Ingestion
│   ├── config.py            # MongoDB config & field mappings
│   ├── nc_parser.py         # NetCDF parsing logic
│   ├── ingestion.py         # Multiprocess batch insertion
│   └── run_ingestion.py     # CLI entry point
├── vector_db/               # Phase 2a: Embeddings
│   ├── config.py            # ChromaDB & model config
│   ├── summary_generator.py # Text generation
│   ├── vector_store.py      # ChromaDB wrapper
│   └── build_embeddings.py  # Builder CLI
├── mcp_server/              # Phase 2b: MCP Protocol
│   └── server.py
├── rag/                     # Phase 2c: RAG Pipeline
│   ├── retriever.py
│   ├── generator.py
│   └── chain.py
├── tests/                   # Validation & unit tests
│   ├── validate_ingestion.py
│   └── validate_embeddings.py
├── incois_data/             # 📥 Input: Place raw .nc files here
├── chroma_data/             # 📤 Output: Vector database
├── requirements.txt         # Python dependencies
└── README.md                # This file
```

---

## 🛠️ Development

### Run Development Servers

```bash
# Frontend (with hot reload)
cd frontend && npm run dev

# Backend (with nodemon)
cd backend/server && npm run dev
```

### Code Quality

```bash
# Lint frontend
cd frontend && npm run lint

# Type checking (if using TypeScript)
cd frontend && npx tsc --noEmit
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# MongoDB
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=floatchat_ai

# Ollama / LLM
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3:8b

# Server
PORT=3001
NODE_ENV=development
LOG_LEVEL=debug
```

---

## 🧪 Testing

```bash
# Validate data ingestion
python tests/validate_ingestion.py

# Validate embeddings
python tests/validate_embeddings.py

# Test API endpoints (using curl or Postman)
curl -X GET http://localhost:3001/api/stats
```

## 📝 License

This project is licensed under the **MIT License** – see [LICENSE](LICENSE) file for details.

---

## � Authors

**Developed by:**

- [Parimi Sai Charan](https://github.com/cherry-2207)
- [Shaista Kausar](https://github.com/Shaista04)
- [Pabbu Saideepak](https://github.com/saideepak2005)

---

## 🙏 Acknowledgments

- [ARGO Program](https://www.argodatamgt.org/) – Global oceanographic data
- [ChromaDB](https://www.trychroma.com/) – Open-source vector database
- [Ollama](https://ollama.ai/) – Local LLM inference
- [React](https://react.dev/) & [Vite](https://vitejs.dev/) – Frontend tooling
- [MongoDB](https://www.mongodb.com/) – Data persistence

---

## 📚 Learn More

- [ARGO Data Documentation](https://www.argodatamgt.org/)
- [ChromaDB Guide](https://docs.trychroma.com/)
- [Ollama & Llama3 Models](https://ollama.ai/)
- [Express.js Documentation](https://expressjs.com/)
- [React Documentation](https://react.dev/)

---

**Last Updated:** March 2026  
**Status:** Under Active Development
