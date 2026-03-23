require('dotenv').config({ path: '../.env' });
const MongoService = require('../services/mongoService');
const VectorService = require('../services/vectorService');
const RagService = require('../services/ragService');

async function testSpecificQuery() {
    console.log("==========================================");
    console.log(" Testing specific user query");
    console.log("==========================================\n");

    const mongoService = new MongoService('mongodb://localhost:27017', 'floatchat_ai');
    await mongoService.connect();

    const vectorService = new VectorService();
    await vectorService.connect();

    const ragService = new RagService(vectorService, mongoService, {
        llmApiUrl: 'http://localhost:11434/v1',
        llmApiKey: 'ollama',
        llmModel: 'llama3.1:8b'
    });

    const query = "what is the pressure and salinity in indian ocean on 23rd august in 2016";
    console.log(`💬 User Query: "${query}"\n`);
    console.log('⏳ Processing query through the RAG pipeline...');

    try {
        const startTime = Date.now();
        const response = await ragService.chat(query);
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);

        console.log(`\n✅ Flow Completed! (${duration}s)\n`);
        console.log(`🤖 **Ollama LLaMA3.1:8b Response:**\n\n${response.answer}\n`);

        if (Object.keys(response.structured).length > 0) {
            console.log(`\n🧩 Structured Data Extracted:`, JSON.stringify(response.structured, null, 2));
        }

        console.log(`\n📚 Context used: ${response.context.length} documents retrieved from ChromaDB`);

    } catch (e) {
        console.error("\n❌ Error: ", e.message);
    }

    await mongoService.close();
}

testSpecificQuery();
