require('dotenv').config({ path: '../.env' });
const MongoService = require('../services/mongoService');
const VectorService = require('../services/vectorService');
const RagService = require('../services/ragService');

async function runQuery() {
    console.log("=================================================");
    console.log(" RUNNING PROJECT QUERY: Aug 23, 2016");
    console.log("=================================================\n");

    const mongoService = new MongoService('mongodb://localhost:27017', 'floatchat_ai');
    await mongoService.connect();

    const vectorService = new VectorService();
    await vectorService.connect();

    const ragService = new RagService(vectorService, mongoService, {
        llmApiUrl: 'http://localhost:11434/v1',
        llmApiKey: 'ollama',
        llmModel: 'llama3.1:8b'
    });

    const query = "what was the temperature and pressure on 23rd aug 2016";
    console.log(`💬 AI Query: "${query}"\n`);
    console.log('⏳ Running RAG (Vector Search + MongoDB + Ollama)...');

    try {
        const response = await ragService.chat(query);
        console.log(`\n🤖 **Ollama LLaMA3.1:8b Response:**\n\n${response.answer}\n`);
    } catch (e) {
        console.error("\n❌ Error: ", e.message);
    }

    await mongoService.close();
}

runQuery();
