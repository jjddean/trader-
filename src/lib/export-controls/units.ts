export interface ParsedUnit {
  key: string;
  valueRaw: string;
  valueNum: number | null;
  unit: string | null;
  sourceQuote: string;
}

const UNIT_PATTERNS: { key: string; re: RegExp }[] = [
  { key: "frequency", re: /\b(\d+(?:\.\d+)?)\s*(GHz|MHz|kHz|Hz)\b/gi },
  { key: "power", re: /\b(\d+(?:\.\d+)?)\s*(GW|MW|kW|W|mW|nW|µW|uW)\b/gi },
  { key: "compute", re: /\b(\d+(?:\.\d+)?)\s*(TFLOPS|GFLOPS|MFLOPS|FLOPS|TOPS|GOPS)\b/gi },
  { key: "wavelength", re: /\b(\d+(?:\.\d+)?)\s*(nm|µm|um|mm|cm)\b/gi },
  { key: "bandwidth", re: /\b(\d+(?:\.\d+)?)\s*(Gbit\/s|Mbit\/s|kbit\/s|Mbps|Gbps)\b/gi },
];

const POWER_TO_W: Record<string, number> = {
  GW: 1e9,
  MW: 1e6,
  kW: 1e3,
  W: 1,
  mW: 1e-3,
  nW: 1e-9,
  "µW": 1e-6,
  uW: 1e-6,
};

const FREQ_TO_HZ: Record<string, number> = {
  GHz: 1e9,
  MHz: 1e6,
  kHz: 1e3,
  Hz: 1,
};

export function normaliseUnitValue(valueNum: number, unit: string, key: string): number {
  const u = unit.replace(/µ/g, "u");
  if (key === "power") return valueNum * (POWER_TO_W[u] ?? 1);
  if (key === "frequency") return valueNum * (FREQ_TO_HZ[u] ?? 1);
  return valueNum;
}

/** Regex pre-pass — surfaces numeric specs for LLM anchoring and deterministic rules later. */
export function extractUnitFacts(text: string): ParsedUnit[] {
  const results: ParsedUnit[] = [];
  const seen = new Set<string>();

  for (const { key, re } of UNIT_PATTERNS) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const valueRaw = match[0];
      const dedupe = `${key}:${valueRaw.toLowerCase()}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);

      const valueNum = Number(match[1]);
      const unit = match[2];
      results.push({
        key,
        valueRaw,
        valueNum: Number.isFinite(valueNum) ? valueNum : null,
        unit,
        sourceQuote: valueRaw,
      });
    }
  }

  return results;
}
