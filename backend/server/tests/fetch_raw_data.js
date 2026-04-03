const MongoService = require('../services/mongoService');

async function fetchRawData() {
    const mongo = new MongoService('mongodb://localhost:27017', 'floatchat_ai');
    await mongo.connect();

    const targets = [
        { platform: '2902178', cycle: 53 },
        { platform: '2901303', cycle: 203 }
    ];

    console.log("==================================================================");
    console.log(" RAW ARGO DATA OUTPUT (August 23-24, 2016 - Indian Ocean)");
    console.log("==================================================================\n");

    for (const target of targets) {
        console.log(`📡 FLOAT: ${target.platform} | CYCLE: ${target.cycle}`);
        console.log("------------------------------------------------------------------");
        console.log(" Pressure(db) | Temp(°C) | Salinity(PSU) | Date ");
        console.log("------------------------------------------------------------------");

        try {
            const profiles = await mongo.queryFloat(target.platform, target.cycle);
            if (profiles.length > 0) {
                const profile = profiles[0];
                const measurements = profile.measurements || [];
                
                // Show a subset of depths (every 5th or 10th if many)
                measurements.slice(0, 20).forEach(m => {
                    const pres = (m.pres !== undefined ? m.pres.toFixed(1) : 'N/A').padStart(12);
                    const temp = (m.temp_adjusted !== undefined ? m.temp_adjusted : m.temp !== undefined ? m.temp : 'N/A');
                    const tempStr = (typeof temp === 'number' ? temp.toFixed(3) : 'N/A').padStart(9);
                    const psal = (m.psal_adjusted !== undefined ? m.psal_adjusted : m.psal !== undefined ? m.psal : 'N/A');
                    const psalStr = (typeof psal === 'number' ? psal.toFixed(3) : 'N/A').padStart(14);
                    const date = profile.timestamp
                        ? new Date(profile.timestamp).toISOString().split('T')[0]
                        : 'N/A';
                    
                    console.log(`${pres} | ${tempStr} | ${psalStr} | ${date}`);
                });
                
                if (measurements.length > 20) {
                    console.log(`... (${measurements.length - 20} more levels available)`);
                }
            } else {
                console.log("  ⚠️ No data found for this platform/cycle.");
            }
        } catch (e) {
            console.log(`  ❌ Error fetching data: ${e.message}`);
        }
        console.log("\n");
    }

    await mongo.close();
}

fetchRawData().catch(console.error);
