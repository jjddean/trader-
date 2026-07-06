# lora-dataset-worker-json-v2 Audit

Generated correction dataset for v3. No training run.

## Counts

- train: 24
- eval: 8
- locked test: 24

## Scope

Focused only on footwear failures:

- leather shoes
- footwear subheadings
- 640351 vs 640399
- men/women leather shoes
- leather outer sole vs rubber/plastic/composition leather outer sole, without adding composition leather unless stated

## Guardrails

- locked tests are written only to `tests/locked-footwear.jsonl`
- locked tests are not duplicated in train/eval
- no old `lora-dataset` directory name
- output target remains `lora-output-worker-json-v2` for any future training
