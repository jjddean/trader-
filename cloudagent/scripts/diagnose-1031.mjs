
import fetch from 'node-fetch';

const NGROK_URL = 'https://7330-62-31-164-236.ngrok-free.app';

async function diagnose() {
    console.log("--- Final System Check: Freightcode Cloudflare Agents ---");

    // 1. Clear history
    try {
        await fetch(`${NGROK_URL}/agents/orchestrator/global/call/clearHistory`, {
            method: 'POST',
            body: JSON.stringify([])
        });
        console.log("✅ History Cleaned");
    } catch (e) {}

    // 2. Discover
    console.log("\nStep 1: AI-Driven Lead Discovery");
    try {
        const discRes = await fetch(`${NGROK_URL}/agents/orchestrator/global/call/discover`, {
            method: 'POST',
            body: JSON.stringify([])
        });
        const leads = await discRes.json();
        const count = Array.isArray(leads) ? leads.length : 0;
        console.log(`✅ Discovery Status: Received ${count} partners from D1.`);
        if (count > 0) {
            console.log(`   Sample: ${leads[0].companyName} (${leads[0].country})`);
        } else {
            console.log(`   ⚠️  No partners found in D1. Ensure the database is seeded.`);
        }
    } catch (e) {
        console.error("❌ Discovery Failed:", e.message);
    }

    // 3. Routing
    console.log("\nStep 2: Multi-Agent Routing Tests");
    const tests = [
        { name: "Compliance (Origin)", query: "Bangladesh/Textile Origin Rules" },
        { name: "Product (Search)", query: "Vietnamese apparel manufacturers" }
    ];

    for (const test of tests) {
        try {
            const res = await fetch(`${NGROK_URL}/agents/orchestrator/global/call/ask`, {
                method: 'POST',
                body: JSON.stringify([test.query])
            });
            const text = await res.json();
            console.log(`✅ ${test.name}: Pass (Response received)`);
        } catch (e) {
            console.error(`❌ ${test.name} Failed:`, e.message);
        }
    }

    console.log("\n--- Final System Check Complete ---");
}

diagnose();
