import fetch from "node-fetch";

const BASE_URL = "http://localhost:8787";

async function diagnose() {
  console.log("--- Starting RPC Diagnostics ---");

  const endpoints = [
    { name: "Root", url: "/", method: "GET" },
    { name: "Lowercase", url: "/agents/orchestrator/global/call/ask", method: "POST" },
    { name: "Lowercase Global Call", url: "/agents/orchestrator/global/call", method: "POST" },
    { name: "Lowercase Global Ask", url: "/agents/orchestrator/global/ask", method: "POST" },
    { name: "Lowercase Call Ask", url: "/agents/orchestrator/call/ask", method: "POST" },
    { name: "Lowercase Base", url: "/agents/orchestrator/global", method: "POST" },
    { name: "Uppercase", url: "/agents/ORCHESTRATOR/global/call/ask", method: "POST" },
    { name: "Kebab", url: "/agents/orchestrator-agent/global/call/ask", method: "POST" },
    { name: "Uppercase Global Call", url: "/agents/ORCHESTRATOR/global/call", method: "POST" },
    { name: "Uppercase Global Ask", url: "/agents/ORCHESTRATOR/global/ask", method: "POST" },
    { name: "Uppercase Call Ask", url: "/agents/ORCHESTRATOR/call/ask", method: "POST" },
    { name: "Kebab Global Call", url: "/agents/orchestrator-agent/global/call", method: "POST" },
    { name: "Kebab Global Ask", url: "/agents/orchestrator-agent/global/ask", method: "POST" }
  ];

  const payloads = [
    { name: "rpc_type_args", headers: { "Content-Type": "application/json" }, body: { type: "rpc", id: "test-id", method: "ask", args: ["ping"] } },
    { name: "method_params", headers: { "Content-Type": "application/json" }, body: { method: "ask", params: { input: "ping" } } },
    { name: "method_args", headers: { "Content-Type": "application/json" }, body: { method: "ask", args: ["ping"] } },
    { name: "jsonrpc_2", headers: { "Content-Type": "application/json" }, body: { jsonrpc: "2.0", id: "1", method: "ask", params: ["ping"] } },
    { name: "action_data", headers: { "Content-Type": "application/json" }, body: { action: "ask", data: { input: "ping" } } },
    { name: "text_plain", headers: { "Content-Type": "text/plain" }, body: "ping" }
  ];

  for (const ep of endpoints) {
    console.log(`\nEndpoint: ${ep.name} ${ep.url}`);
    const method = ep.method || "POST";
    if (method === "GET") {
      try {
        const res = await fetch(`${BASE_URL}${ep.url}`, { method: "GET" });
        console.log(`Result: ${res.status} ${res.statusText}`);
        const text = await res.text();
        console.log(`Body: ${text.substring(0, 200)}${text.length > 200 ? "..." : ""}`);
      } catch (e) {
        console.log(`Error: ${e.message}`);
      }
      continue;
    }
    for (const pl of payloads) {
      console.log(`  Payload: ${pl.name}`);
      try {
        const res = await fetch(`${BASE_URL}${ep.url}`, {
          method: "POST",
          headers: pl.headers,
          body: typeof pl.body === "string" ? pl.body : JSON.stringify(pl.body)
        });
        console.log(`    Result: ${res.status} ${res.statusText}`);
        const text = await res.text();
        console.log(`    Body: ${text.substring(0, 200)}${text.length > 200 ? "..." : ""}`);
        if (res.status === 200) return;
      } catch (e) {
        console.log(`    Error: ${e.message}`);
      }
    }
  }
}

diagnose();
