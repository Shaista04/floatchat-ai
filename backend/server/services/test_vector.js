const VectorService = require('./vectorService');

async function test() {
    const v = new VectorService();
    // Use the Promise properly
    try {
        const stats = await v.getStats();
        console.log('Stats:', stats);
        
        const res = await v.searchAll('temperature in the arabian sea', 2);
        console.log('Search:', res.map(r => r.id));
    } catch(e) {
        console.error(e);
    }
}
test();
