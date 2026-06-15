import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import unusedImports from "eslint-plugin-unused-imports";
import simpleImportSort from "eslint-plugin-simple-import-sort";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      "unused-imports": unusedImports,
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      "unused-imports/no-unused-imports": "error",
      "simple-import-sort/imports": "off",
      "simple-import-sort/exports": "off",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["convex/**/*.ts", "src/lib/**/*.ts", "src/lib/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  globalIgnores([
    // Next.js / build output
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Dependencies & tooling caches
    "node_modules/**",
    ".vercel/**",
    // Local scratch & experiments (not production code)
    "tmp/**",
    "cloudagent/.wrangler/**",
    // ML / Kaggle artifacts
    "lora-output/**",
    "lora-output-kaggle-test/**",
    "lora-colab-bundle/**",
    ".kaggle-*/**",
    ".kaggle-wheels/**",
    ".kaggle-dataset-staging/**",
    ".kaggle-wheels-staging/**",
    // Generated / vendor
    "convex/_generated/**",
    "**/__pycache__/**",
  ]),
]);

export default eslintConfig;
