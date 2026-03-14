const WS_URL = process.env.AGENT_WS_URL || "ws://localhost:8787/agents/orchestrator/global";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("--- Starting WebSocket RPC Diagnostics ---");
  console.log(`Connecting: ${WS_URL}`);

  const ws = new WebSocket(WS_URL);
  const messages = [];

  ws.onopen = () => {
    const payload = {
      type: "rpc",
      id: "ws-test-1",
      method: "ask",
      args: ["ping"]
    };
    console.log("Sending RPC payload:", JSON.stringify(payload));
    ws.send(JSON.stringify(payload));
  };

  ws.onmessage = (event) => {
    messages.push(event.data);
    console.log(`Message: ${String(event.data).slice(0, 300)}`);
  };

  ws.onerror = (event) => {
    console.log("WebSocket error:", event.message || "unknown");
  };

  await wait(15000);
  ws.close();

  const parsed = messages.map((m) => {
    try {
      return JSON.parse(m);
    } catch {
      return m;
    }
  });

  const rpcResponse = parsed.find(
    (m) =>
      typeof m === "object" &&
      m !== null &&
      m.type === "rpc" &&
      m.id === "ws-test-1"
  );

  if (rpcResponse) {
    console.log("RPC response received.");
    process.exitCode = 0;
    return;
  }

  console.log("No RPC response received.");
  process.exitCode = 1;
}

main();
