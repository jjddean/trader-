const AGENT_WS_URL = process.env.AGENT_WS_URL || "ws://localhost:8787/agents/orchestrator/global";

function askAgent(query, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const id = `test-${Math.random().toString(36).slice(2, 9)}`;
    let settled = false;
    const ws = new WebSocket(AGENT_WS_URL);

    const done = (fn) => {
      if (settled) return;
      settled = true;
      try {
        ws.close();
      } catch {}
      fn();
    };

    const timer = setTimeout(() => {
      done(() => reject(new Error("Timed out waiting for RPC response")));
    }, timeoutMs);

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "rpc",
          id,
          method: "ask",
          args: [query],
        }),
      );
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data));
        if (msg?.type !== "rpc" || msg?.id !== id) return;
        clearTimeout(timer);
        if (!msg.success) {
          done(() => reject(new Error(msg.error || "RPC failed")));
          return;
        }
        done(() => resolve(msg.result));
      } catch {}
    };

    ws.onerror = () => {
      clearTimeout(timer);
      done(() => reject(new Error("WebSocket connection error")));
    };
  });
}

async function testAgent(query) {
  console.log(`\nTesting: "${query}"`);
  const result = await askAgent(query);
  const text = String(result ?? "");
  console.log("Agent Response:", text.slice(0, 500));
  if (text.includes("[ORCHESTRATOR ERROR]")) {
    throw new Error(text);
  }
}

// Ensure the user understands they need wrangler dev running
console.log("-----------------------------------------");
console.log("Freightcode Agent Test Suite");
console.log("Make sure 'npx wrangler dev --remote' is running in another terminal.");
console.log("-----------------------------------------\n");

// Execute tests
(async () => {
  try {
    const fullSuite = process.env.FULL_AGENT_TEST === "1";
    if (!fullSuite) {
      await testAgent("ping");
      console.log("\nBasic agent RPC test passed. Set FULL_AGENT_TEST=1 to run AI-heavy prompts.");
      return;
    }
    await testAgent("Does HS 6109 (T-shirts) from Bangladesh qualify for 0% tariff under DCTS?");
    await testAgent("Find me UK buyers for organic cotton textiles.");
    await testAgent("Draft an introductory email to BRAVISSIMO LIMITED about a new textile supply.");
    await testAgent("Explain how DCTS cumulation works for least developed countries.");
    console.log("\nAll agent tests passed.");
  } catch (error) {
    console.error("\nAgent test suite failed:", error.message);
    process.exitCode = 1;
  }
})();
