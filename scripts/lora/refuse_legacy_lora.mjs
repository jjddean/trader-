#!/usr/bin/env node

console.error("Refusing legacy LoRA dataset command.");
console.error("");
console.error("The old lora-dataset path contained representation / indirect-rep training rows.");
console.error("Do not regenerate or train it for /classify-gir worker-json classification.");
console.error("");
console.error("Use a reviewed explicit dataset name such as:");
console.error("  lora-dataset-worker-json-v2");
console.error("");
process.exit(1);
