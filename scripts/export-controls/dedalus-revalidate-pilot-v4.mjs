import fs from "node:fs";
import path from "node:path";
import Dedalus from "dedalus";

const root = process.cwd();
for (const name of [".env.local", ".env.vercel.prod.check"]) {
  const file = path.join(root, name);
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}
delete process.env.OPENAI_API_KEY;
const pilot = JSON.parse(fs.readFileSync(path.join(root, "data/export-controls/candidates/gb-dualuse-pilot-6a003.json")));
const evidence = JSON.parse(fs.readFileSync(path.join(root, "scripts/export-controls/fixtures/6a003-pilot-evidence.json")));
const validator = fs.readFileSync(path.join(root, "scripts/export-controls/dedalus-pilot-validator-v4.py"), "utf8");
const machineId = pilot.run.machineId;
const client = new Dedalus({ apiKey: process.env.DEDALUS_API_KEY, maxRetries: 1 });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await client.machines.wake({ machine_id: machineId });
for (let i = 0; i < 60; i++) {
  const machine = await client.machines.retrieve({ machine_id: machineId });
  if (machine.status.phase === "running") break;
  await wait(1000);
}
try {
  const execution = await client.machines.executions.create({ machine_id: machineId, command: ["python3", "-c", validator], stdin: JSON.stringify({ evidence, proposed: { records: pilot.records } }), timeout_ms: 120000 });
  let state = execution;
  for (let i = 0; i < 120 && !["succeeded", "failed", "cancelled", "expired"].includes(state.status); i++) {
    await wait(1000);
    state = await client.machines.executions.retrieve({ machine_id: machineId, execution_id: execution.execution_id });
  }
  const output = await client.machines.executions.output({ machine_id: machineId, execution_id: execution.execution_id });
  if (state.status !== "succeeded") throw new Error(output.stderr || state.error_message || state.status);
  const result = JSON.parse(output.stdout);
  result.execution = { machineId, executionId: execution.execution_id, openAIRequestMade: false };
  const destination = path.join(root, "data/export-controls/candidates/gb-dualuse-pilot-dedalus-validation-v4.json");
  fs.writeFileSync(destination, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify({ destination, ...result.validation, execution: result.execution }));
} finally {
  await client.machines.sleep({ machine_id: machineId }).catch(() => {});
}
