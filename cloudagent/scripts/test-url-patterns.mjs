import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:8787';

const PATTERNS = [
    '/agents/OrchestratorAgent/global/call/ask',
    '/agents/orchestrator-agent/global/call/ask',
    '/OrchestratorAgent/global/call/ask',
    '/orchestrator-agent/global/call/ask',
    '/agents/orchestratoragent/global/call/ask',
    '/orchestratoragent/global/call/ask',
    '/agents/ORCHESTRATOR/global/call/ask', // Using binding name
    '/ORCHESTRATOR/global/call/ask'
];

async function runTest() {
    for (const pattern of PATTERNS) {
        const url = `${BASE_URL}${pattern}`;
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(['test ping'])
            });
            console.log(`URL: ${url} -> Status: ${res.status}`);
            if (res.ok) {
                const data = await res.json();
                console.log(`   SUCCESS! Data:`, data);
                break;
            }
        } catch (e) {
            console.log(`URL: ${url} -> Error: ${e.message}`);
        }
    }
}

runTest();
