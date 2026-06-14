#!/usr/bin/env node
/**
 * LoRA pipeline orchestrator — minimal manual steps.
 *
 *   npm run lora:prepare   → generate train.csv (10k rows)
 *   npm run lora:colab     → zip dataset + script for Google Colab (no local GPU)
 *   npm run lora:train     → train locally if CUDA GPU
 *   npm run lora:deploy    → upload adapters to Cloudflare Workers AI
 *   npm run lora:all       → prepare → train OR colab bundle → deploy (if trained)
 */

import { execSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const DATA_DIR = join(ROOT, "lora-dataset");
const OUT_DIR = join(ROOT, "lora-output");
const BUNDLE_DIR = join(ROOT, "lora-colab-bundle");
const LORA_NAME = "hs-classifier-v1";

function run(cmd, opts = {}) {
  console.log(`\n▶ ${cmd}\n`);
  execSync(cmd, { cwd: ROOT, stdio: "inherit", ...opts });
}

function prepare() {
  run("node generate-training-data.mjs --rows 10000 --out ./lora-dataset");
}

function hasCuda() {
  const r = spawnSync("python", ["-c", "import torch; print(torch.cuda.is_available())"], {
    cwd: ROOT,
    encoding: "utf-8",
  });
  return r.stdout?.trim() === "True";
}

function hasPython() {
  const r = spawnSync("python", ["--version"], { cwd: ROOT, encoding: "utf-8" });
  return r.status === 0;
}

function train() {
  if (!existsSync(join(DATA_DIR, "train.csv"))) {
    console.log("No dataset — running prepare first…");
    prepare();
  }
  if (!hasPython()) {
    console.error("Python not found. Install Python 3.10+");
    process.exit(1);
  }
  if (hasCuda()) {
    run("python scripts/lora/train_unsloth.py");
    return;
  }
  console.log("\nNo CUDA GPU — using HuggingFace Spaces AutoTrain (remote GPU)…\n");
  run("python scripts/lora/pipeline.py install");
  run("python scripts/lora/pipeline.py train");
}

function colab() {
  if (!existsSync(join(DATA_DIR, "train.csv"))) {
    prepare();
  }

  mkdirSync(BUNDLE_DIR, { recursive: true });
  copyFileSync(join(DATA_DIR, "train.csv"), join(BUNDLE_DIR, "train.csv"));
  if (existsSync(join(DATA_DIR, "eval.csv"))) {
    copyFileSync(join(DATA_DIR, "eval.csv"), join(BUNDLE_DIR, "eval.csv"));
  }
  copyFileSync(join(__dirname, "train_unsloth.py"), join(BUNDLE_DIR, "train_unsloth.py"));

  const readme = `# Colab — hs-classifier-v1 (Unsloth)

1. **Runtime → Change runtime type → T4 GPU**
2. Upload this folder (or \`lora-colab-bundle.zip\`) to Colab
3. Run:

\`\`\`python
!pip install -q unsloth datasets trl
!python train_unsloth.py
\`\`\`

4. Download \`lora-output/\` folder (adapter_model.safetensors + adapter_config.json)
5. Copy into repo \`lora-output/\` on your PC
6. Run: \`npm run lora:deploy\`
`;
  writeFileSync(join(BUNDLE_DIR, "COLAB.md"), readme);

  const zipPath = join(ROOT, "lora-colab-bundle.zip");
  if (process.platform === "win32") {
    run(
      `powershell -NoProfile -Command "Compress-Archive -Path '${BUNDLE_DIR}\\*' -DestinationPath '${zipPath}' -Force"`,
    );
  } else {
    run(`cd lora-colab-bundle && zip -r ../lora-colab-bundle.zip .`);
  }

  console.log(`\n✅ Colab bundle: ${zipPath}`);
  console.log("   Upload to https://colab.research.google.com → follow COLAB.md\n");
}

function deploy() {
  const adapter = join(OUT_DIR, "adapter_model.safetensors");
  const config = join(OUT_DIR, "adapter_config.json");

  if (!existsSync(adapter) || !existsSync(config)) {
    console.error(`Missing ${OUT_DIR}/adapter_model.safetensors — train first (local GPU or Colab).`);
    process.exit(1);
  }

  const cfg = JSON.parse(readFileSync(config, "utf-8"));
  if (cfg.model_type !== "mistral") {
    cfg.model_type = "mistral";
    writeFileSync(config, JSON.stringify(cfg, null, 2) + "\n");
  }

  const cloudagent = join(ROOT, "cloudagent");
  try {
    run(`npx wrangler ai finetune create ${LORA_NAME}`, { cwd: cloudagent });
  } catch {
    console.log("(finetune create skipped — may already exist)");
  }

  run(`npx wrangler ai finetune upload ${LORA_NAME} "${adapter}"`, { cwd: cloudagent });
  run(`npx wrangler ai finetune upload ${LORA_NAME} "${config}"`, { cwd: cloudagent });

  console.log(`\n✅ Uploaded ${LORA_NAME} to Cloudflare Workers AI`);
  console.log("   Test: POST https://cloudagent.jkdproductivity.workers.dev/classify-gir\n");
}

const step = process.argv[2] || "all";

switch (step) {
  case "prepare":
    prepare();
    break;
  case "train":
    train();
    break;
  case "colab":
    colab();
    break;
  case "deploy":
    deploy();
    break;
  case "all":
    prepare();
    if (hasCuda()) {
      train();
      deploy();
    } else {
      colab();
      console.log("After Colab training + download lora-output/, run:  npm run lora:deploy");
    }
    break;
  default:
    console.log("Usage: node scripts/lora/run.mjs [prepare|train|colab|deploy|all]");
    process.exit(1);
}
