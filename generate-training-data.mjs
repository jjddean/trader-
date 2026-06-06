/**
 * CLOUDAGENT — LoRA Training Dataset Generator
 * Generates synthetic UK customs classification training data
 * Output: train.csv + eval.csv (JSONL-compatible rows)
 *
 * Usage:
 *   node generate-training-data.mjs [--rows 1000] [--out ./output]
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

// ─── CLI ARGS ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const TOTAL_ROWS = parseInt(args[args.find((a, i) => args[i - 1] === "--rows")] ?? "1000");
const OUT_DIR    = args[args.find((a, i) => args[i - 1] === "--out")]  ?? "./lora-dataset";
const EVAL_SPLIT = 0.1; // 10% reserved for eval

// ─── PRODUCT POOLS ───────────────────────────────────────────────────────────

const SIMPLE_GOODS = [
  // Clothing & Textiles
  { desc: "Men's cotton t-shirt, white, size M, imported from Bangladesh", hs: "6109100010", gir: ["1", "6"], confidence: 0.95, risk: "LOW", rep: "3", indirect: true, reason: "Cotton knitted T-shirt classified under heading 6109 (T-shirts, singlets). Non-UK importer requires indirect representation under UK customs rules." },
  { desc: "Women's polyester blouse, long sleeve, from Vietnam", hs: "6206400000", gir: ["1", "6"], confidence: 0.92, risk: "LOW", rep: "3", indirect: true, reason: "Woven polyester blouse classified under heading 6206. Non-UK established importer triggers indirect representation requirement." },
  { desc: "Children's denim jeans, size 6-8 years, from China", hs: "6203420090", gir: ["1", "6"], confidence: 0.94, risk: "LOW", rep: "3", indirect: true, reason: "Cotton denim trousers for boys classified under heading 6203. Chinese origin; non-UK importer requires DE Type 3 representation." },
  { desc: "Woollen men's suit jacket, imported from Italy by UK retailer", hs: "6203310000", gir: ["1", "6"], confidence: 0.96, risk: "LOW", rep: "2", indirect: false, reason: "Wool suit jacket classified under heading 6203. UK-established importer permits direct representation (Type 2)." },
  { desc: "Cotton socks, pairs, from Turkey", hs: "6115950000", gir: ["1", "6"], confidence: 0.93, risk: "LOW", rep: "3", indirect: true, reason: "Cotton hosiery classified under heading 6115. Non-UK importer triggers indirect representation." },
  { desc: "Synthetic fibre winter scarf from South Korea", hs: "6214300000", gir: ["1", "6"], confidence: 0.91, risk: "LOW", rep: "3", indirect: true, reason: "Knitted synthetic scarf classified under heading 6214. Non-UK origin requires indirect representation." },
  { desc: "Leather dress shoes, men's, size 42, from Portugal, imported by UK distributor", hs: "6403510090", gir: ["1", "6"], confidence: 0.94, risk: "LOW", rep: "2", indirect: false, reason: "Leather footwear classified under heading 6403. UK-established importer uses direct representation." },
  { desc: "Rubber sports trainers, children's, from Indonesia", hs: "6404190000", gir: ["1", "6"], confidence: 0.90, risk: "LOW", rep: "3", indirect: true, reason: "Rubber-soled trainers classified under heading 6404. Indonesian origin; indirect representation required." },

  // Electronics
  { desc: "USB-C phone charger cable, 1m, from China", hs: "8544422090", gir: ["1", "6"], confidence: 0.88, risk: "LOW", rep: "3", indirect: true, reason: "Insulated electric conductor classified under heading 8544. Non-UK importer requires indirect representation." },
  { desc: "Bluetooth wireless headphones, over-ear, from China", hs: "8518300090", gir: ["1", "6"], confidence: 0.89, risk: "LOW", rep: "3", indirect: true, reason: "Headphones classified under heading 8518. Standard consumer electronics; indirect rep triggered." },
  { desc: "Smart LED desk lamp, USB powered, imported from China", hs: "9405409100", gir: ["1", "6"], confidence: 0.87, risk: "LOW", rep: "3", indirect: true, reason: "LED desk lamp classified under heading 9405. Non-UK establishment triggers indirect representation." },
  { desc: "External USB 3.0 hard drive 2TB, from Taiwan", hs: "8471706000", gir: ["1", "6"], confidence: 0.90, risk: "LOW", rep: "3", indirect: true, reason: "External magnetic storage classified under heading 8471. Non-UK importer requires indirect representation." },
  { desc: "LED bicycle front light, rechargeable, from China", hs: "8512100000", gir: ["1", "6"], confidence: 0.88, risk: "MEDIUM", rep: "3", indirect: true, reason: "Electrical lighting apparatus classified under heading 8512. Non-UK importer triggers indirect representation liability assessment." },
  { desc: "Portable Bluetooth speaker, waterproof, IPX7, from China", hs: "8518220000", gir: ["1", "6"], confidence: 0.87, risk: "LOW", rep: "3", indirect: true, reason: "Single loudspeaker mounted in enclosure classified under heading 8518. Standard consumer electronics." },

  // Furniture & Household
  { desc: "Flat-pack wooden dining table, MDF top, from Poland, UK importer", hs: "9403300000", gir: ["1", "6"], confidence: 0.91, risk: "LOW", rep: "2", indirect: false, reason: "Wooden furniture classified under heading 9403. UK-established importer allows direct representation." },
  { desc: "Ceramic coffee mug set of 4, from China", hs: "6911100000", gir: ["1", "6"], confidence: 0.92, risk: "LOW", rep: "3", indirect: true, reason: "Ceramic tableware classified under heading 6911. Non-UK importer requires indirect representation." },
  { desc: "Stainless steel cutlery set 24 pieces, from India", hs: "8215990000", gir: ["1", "6"], confidence: 0.90, risk: "LOW", rep: "3", indirect: true, reason: "Stainless steel cutlery classified under heading 8215. Non-UK importer triggers indirect representation." },
  { desc: "Glass drinking glasses, set of 6, from Czech Republic, UK importer", hs: "7013370000", gir: ["1", "6"], confidence: 0.93, risk: "LOW", rep: "2", indirect: false, reason: "Drinking glasses classified under heading 7013. UK-established importer permits direct representation." },
];

const MEDIUM_GOODS = [
  // Mixed / Accessory / Multi-component
  { desc: "Laptop bag with built-in USB charging port and padded 15-inch sleeve, from China", hs: "4202120090", gir: ["1", "3b", "6"], confidence: 0.83, risk: "MEDIUM", rep: "3", indirect: true, reason: "Composite article; GIR 3(b) applies. The essential character is the bag function (heading 4202) as the USB port is ancillary. Non-UK importer requires indirect representation." },
  { desc: "Smart fitness watch with heart rate monitor, GPS, and replaceable wristband, from South Korea", hs: "8517620000", gir: ["1", "3b", "6"], confidence: 0.80, risk: "MEDIUM", rep: "3", indirect: true, reason: "Multi-function wearable device; GIR 3(b) applies. Essential character determined by primary function as data-transmitting apparatus under heading 8517. Non-UK importer triggers indirect rep." },
  { desc: "Gift set: perfume 50ml + body lotion 200ml + shower gel 200ml, packaged together, from France", hs: "3303000000", gir: ["1", "3b", "6"], confidence: 0.82, risk: "MEDIUM", rep: "3", indirect: true, reason: "Retail gift set with multiple cosmetic preparations. GIR 3(b): perfume (heading 3303) establishes essential character as highest-value component. Indirect representation required." },
  { desc: "Electric toothbrush kit with 3 replacement heads and travel case, from Germany, UK importer", hs: "8509800000", gir: ["1", "3b", "6"], confidence: 0.85, risk: "LOW", rep: "2", indirect: false, reason: "Electric toothbrush with accessories; GIR 3(b) applies. Essential character is the electric appliance (heading 8509). UK-established importer; direct representation permitted." },
  { desc: "Tool kit: 50-piece screwdriver set with case, from Taiwan", hs: "8205590000", gir: ["1", "3b", "6"], confidence: 0.84, risk: "MEDIUM", rep: "3", indirect: true, reason: "Assorted hand tools in retail set. GIR 3(b) applied; screwdrivers establish essential character under heading 8205. Non-UK importer triggers indirect representation." },
  { desc: "Baby stroller with rain cover, bag, and footmuff accessories, from China", hs: "8715000000", gir: ["1", "3b", "6"], confidence: 0.86, risk: "MEDIUM", rep: "3", indirect: true, reason: "Baby carriage with accessories presented together. GIR 3(b): essential character is the perambulator (heading 8715). Accessories are ancillary. Non-UK importer requires indirect rep." },
  { desc: "Camera bundle: DSLR body + 18-55mm lens + 50mm lens + camera bag, from Japan, via UK distributor", hs: "9006590000", gir: ["1", "3b", "6"], confidence: 0.81, risk: "MEDIUM", rep: "2", indirect: false, reason: "Camera sold as bundle with lenses and accessories. GIR 3(b): photographic camera body (heading 9006) determines essential character. UK distributor permits direct representation." },
  { desc: "Sports water bottle with integrated filter straw and carabiner clip, from China", hs: "3924100000", gir: ["1", "3b", "6"], confidence: 0.80, risk: "MEDIUM", rep: "3", indirect: true, reason: "Multi-component plastic article. GIR 3(b): essential character is drinking vessel (heading 3924). Filter and clip are ancillary. Non-UK importer triggers indirect rep." },
  { desc: "Sunglasses with hard case and cleaning cloth, from Italy, UK importer", hs: "9004100000", gir: ["1", "6"], confidence: 0.89, risk: "LOW", rep: "2", indirect: false, reason: "Sunglasses presented with ancillary accessories. GIR 1: heading 9004 applies directly. Accessories classified with main article. UK importer; direct representation permitted." },
  { desc: "Artificial Christmas tree with built-in LED lights and stand, 180cm, from China", hs: "9505100090", gir: ["1", "3b", "6"], confidence: 0.82, risk: "MEDIUM", rep: "3", indirect: true, reason: "Composite festive article. GIR 3(b): essential character established by the artificial tree (heading 9505). LEDs are ancillary. Non-UK importer requires indirect representation." },
  { desc: "Yoga mat with carrying strap and 2 resistance bands, from India", hs: "3926909790", gir: ["1", "3b", "6"], confidence: 0.79, risk: "MEDIUM", rep: "3", indirect: true, reason: "Sports accessories set. GIR 3(b): yoga mat (heading 3926) determines essential character by value and bulk. Non-UK importer triggers indirect representation." },
  { desc: "Backpack with detachable laptop sleeve and hydration bladder, from China", hs: "4202920090", gir: ["1", "3b", "6"], confidence: 0.81, risk: "MEDIUM", rep: "3", indirect: true, reason: "Multi-component backpack. GIR 3(b): bag function (heading 4202) establishes essential character. Accessories are ancillary. Non-UK importer requires indirect rep." },
];

const HIGH_RISK_GOODS = [
  // Indirect rep triggers + missing docs + liability + complex GIR
  { desc: "Industrial hydraulic press machine, 200 tonne capacity, from South Korea, buyer is Korean trading company with UK EORI (non-established)", hs: "8462101000", gir: ["1", "6"], confidence: 0.87, risk: "HIGH", rep: "3", indirect: true, reason: "Industrial press machine classified under heading 8462. Non-UK established importer MUST use indirect representation (Type 3). Liability exposure HIGH due to duty value. Missing: CE marking certificate (DE 2/3 N935), origin declaration." },
  { desc: "Pharmaceutical API: Amoxicillin trihydrate powder, 500kg bulk, from India — no UK import licence declared", hs: "2941100000", gir: ["1", "6"], confidence: 0.91, risk: "HIGH", rep: "3", indirect: true, reason: "Antibiotic compound classified under heading 2941. CRITICAL: Missing MHRA import licence (DE 2/3 C678). Non-UK importer requires indirect representation. Goods cannot clear without valid licence documentation." },
  { desc: "CITES-restricted timber: Rosewood (Dalbergia spp.) furniture panels, 500kg, from Brazil", hs: "4407290000", gir: ["1", "6"], confidence: 0.88, risk: "HIGH", rep: "3", indirect: true, reason: "Sawn rosewood timber classified under heading 4407. CRITICAL: CITES Appendix II species requires CITES export permit from Brazil and UK APHA import licence (DE 2/3 N853). Indirect representation mandatory. Non-compliance risks seizure." },
  { desc: "Dual-use encryption software on physical media, exported from USA, end-user unknown", hs: "8523802090", gir: ["1", "6"], confidence: 0.85, risk: "HIGH", rep: "3", indirect: true, reason: "Dual-use goods recorded medium classified under heading 8523. CRITICAL: UK Strategic Export Controls apply. Missing End-User Undertaking (EUU) and OGEL licence verification (DE 2/3 X002). Indirect representation required. Potential HMRC SECU referral." },
  { desc: "Lithium-ion battery pack, 100kWh industrial grade, air-freight, from China — no UN38.3 test report declared", hs: "8507600000", gir: ["1", "6"], confidence: 0.90, risk: "HIGH", rep: "3", indirect: true, reason: "Lithium accumulator classified under heading 8507. CRITICAL: Air transport of Li-ion batteries requires IATA DGR UN3480 declaration and UN38.3 test certification (DE 2/3 Y923). Missing documentation blocks clearance. Non-UK importer; indirect representation mandatory." },
  { desc: "Organic wheat flour, 20 tonne bulk shipment, from Ukraine — no phytosanitary certificate included", hs: "1101000015", gir: ["1", "6"], confidence: 0.93, risk: "HIGH", rep: "3", indirect: true, reason: "Wheat flour classified under heading 1101. CRITICAL: Plant health import requires APHA Phytosanitary Certificate (DE 2/3 N851) and Common Health Entry Document (CHED-PP). Non-UK importer requires indirect representation. Goods on hold pending APHA inspection." },
  { desc: "Second-hand children's toys with unknown chemical composition, from China, no REACH compliance declared", hs: "9503009900", gir: ["1", "6"], confidence: 0.84, risk: "HIGH", rep: "3", indirect: true, reason: "Toys classified under heading 9503. CRITICAL: UK Toy Safety Regulations require UKCA marking documentation. REACH compliance declaration missing (DE 2/3 N003). High risk of OPSS enforcement action. Non-UK importer triggers indirect representation." },
  { desc: "Commercial refrigeration compressor units, containing R-22 refrigerant, from Taiwan", hs: "8414303100", gir: ["1", "6"], confidence: 0.86, risk: "HIGH", rep: "3", indirect: true, reason: "Refrigerating compressor classified under heading 8414. CRITICAL: R-22 is controlled under UK F-Gas Regulations. Import licence from Environment Agency required (DE 2/3 Z003). Non-UK importer; indirect representation mandatory. Environmental compliance risk." },
  { desc: "Raw ivory ornamental carvings, 15 pieces, origin declared as antique pre-1947 but no documentation provided", hs: "9601100000", gir: ["1", "6"], confidence: 0.91, risk: "HIGH", rep: "3", indirect: true, reason: "Worked ivory classified under heading 9601. CRITICAL: CITES Appendix I species. Pre-1947 antique exemption requires documented proof (Article 10 certificate, DE 2/3 N853). Without documentation goods are presumed illegal. Indirect representation mandatory. APHA seizure risk." },
  { desc: "Agricultural pesticide compound, Chlorpyrifos 48% EC, 500L, from China, no UK HSE approval", hs: "3808913000", gir: ["1", "6"], confidence: 0.89, risk: "HIGH", rep: "3", indirect: true, reason: "Insecticide classified under heading 3808. CRITICAL: Chlorpyrifos banned in UK (HSE revocation 2022). Import requires specific derogation approval. Non-UK importer requires indirect representation. Likely refusal of entry by HMRC port authority." },
  { desc: "Steel wire rope, 50mm diameter, 500m, from China, anti-dumping duty potentially applicable", hs: "7312100981", gir: ["1", "6"], confidence: 0.85, risk: "HIGH", rep: "3", indirect: true, reason: "Steel wire rope classified under heading 7312. Anti-dumping duty applies under UK Trade Remedies Authority (TRA) investigation. Country of origin certificate (EUR.1 or Form A) required (DE 2/3 N865). Non-UK importer triggers indirect representation and elevated liability exposure." },
  { desc: "Counterfeit branded sportswear (Nike Air Jordan), 500 units, declared as 'generic athletic clothing', from China", hs: "6110200010", gir: ["1", "6"], confidence: 0.70, risk: "HIGH", rep: "3", indirect: true, reason: "Misdeclared goods: knitted cotton sportswear classified under heading 6110. CRITICAL: Intellectual property infringement suspected. HMRC IPR enforcement action triggered. Declaration accuracy obligations breached under TCTA 2018. Goods subject to seizure. Indirect representation mandatory; direct agent faces personal liability." },
  { desc: "Industrial drone with 5km range, camera payload, purchased by private individual from China — no CAA registration", hs: "8806219000", gir: ["1", "6"], confidence: 0.87, risk: "HIGH", rep: "3", indirect: true, reason: "Remotely piloted aircraft classified under heading 8806. CRITICAL: CAA OSC registration required for commercial-spec UAS. Missing Operator ID declaration (DE 2/3 N730). Non-UK importer triggers indirect representation. Dual-use screening may apply for 5km range specification." },

  // Valuation disputes
  { desc: "Luxury handbag branded as 'Hermes Birkin', declared value £50, suspected undervaluation, from China", hs: "4202210090", gir: ["1", "6"], confidence: 0.75, risk: "HIGH", rep: "3", indirect: true, reason: "Leather handbag classified under heading 4202. CRITICAL: Declared value £50 is implausible for article of this description. HMRC valuation dispute likely under Customs (Import Duty) Act 2018 Section 12. Indirect representation mandatory. Potential fraud investigation referral." },
  { desc: "Split consignment: 10 identical industrial laser cutters declared as '10 separate personal gifts', from China", hs: "8456110000", gir: ["1", "6"], confidence: 0.82, risk: "HIGH", rep: "3", indirect: true, reason: "Laser cutting machines classified under heading 8456. CRITICAL: Split consignment to evade customs thresholds is a customs offence under CEMA 1979. Goods require full commercial import declaration. C285 penalty risk. Indirect representation mandatory." },
];

const EDGE_CASES = [
  { desc: "3D printer filament (PLA), 1kg spool, from Germany, UK manufacturer importing own goods back after exhibition", hs: "3916901090", gir: ["1", "6"], confidence: 0.82, risk: "MEDIUM", rep: "2", indirect: false, reason: "Plastic monofilament classified under heading 3916. UK-established entity reimporting own goods; direct representation (Type 2) permitted. IP2 relief may apply — temporary export/reimport documentation recommended." },
  { desc: "Live tropical fish, ornamental, 200 units, airfreight, from Singapore — health certificate attached", hs: "0301190000", gir: ["1", "6"], confidence: 0.88, risk: "HIGH", rep: "3", indirect: true, reason: "Live ornamental fish classified under heading 0301. CITES check required for restricted species. APHA CHED-A required at designated BCP. Non-UK importer triggers indirect representation. Temperature-controlled clearance required." },
  { desc: "Disassembled bicycle: frame, wheels, handlebars, and drivetrain shipped separately in 3 boxes from China", hs: "8712003090", gir: ["2a", "6"], confidence: 0.79, risk: "MEDIUM", rep: "3", indirect: true, reason: "GIR 2(a) applies: incomplete or unassembled bicycle nonetheless classified under heading 8712. All components together constitute the complete article. Non-UK importer triggers indirect representation." },
  { desc: "Multi-vitamin supplement tablets containing CBD extract, 500mg per tablet, from USA — novel food status unclear", hs: "2106909852", gir: ["1", "3a", "6"], confidence: 0.72, risk: "HIGH", rep: "3", indirect: true, reason: "Food supplement preparation classified under heading 2106. CRITICAL: CBD as food additive requires FSA Novel Food authorisation. Mixture assessed under GIR 3(a); most specific description applies. Non-UK importer requires indirect representation. Goods may be detained by OPSS/FSA at port." },
  { desc: "Wooden pallets, heat treated, ISPM 15 compliant, from Poland, carrying machinery goods — pallets declared separately", hs: "4415200000", gir: ["1", "6"], confidence: 0.90, risk: "LOW", rep: "2", indirect: false, reason: "Wooden packing cases classified under heading 4415. ISPM 15 heat treatment mark required for wood packaging material. Pallet value typically below customs threshold if declared separately. UK machinery importer; direct representation permitted." },
  { desc: "Software licence key delivered digitally — physical USB also shipped as token, declared as 'promotional USB stick', value £5000", hs: "8523512000", gir: ["1", "6"], confidence: 0.76, risk: "HIGH", rep: "3", indirect: true, reason: "Semiconductor media classified under heading 8523. CRITICAL: Customs value must include software licence value per HMRC Notice 252. Undervaluation of digital content on physical carrier is a known HMRC audit trigger. Non-UK importer requires indirect representation." },
  { desc: "Electric vehicle battery module, 40kWh, lithium-iron-phosphate, from China, importing to UK for research lab", hs: "8507600000", gir: ["1", "6"], confidence: 0.88, risk: "HIGH", rep: "3", indirect: true, reason: "Lithium accumulator classified under heading 8507. UN38.3 test report required. Research lab import may qualify for CPC 40 00 C26 relief (scientific instruments). Non-UK entity requires indirect representation. HMRC EPSS relief application recommended." },
  { desc: "Reconditioned automotive engine, returned to UK exporter after repair in Germany — declared as new", hs: "8407341090", gir: ["1", "6"], confidence: 0.83, risk: "MEDIUM", rep: "2", indirect: false, reason: "Spark-ignition piston engine classified under heading 8407. UK exporter reimporting repaired goods should use OPR (Outward Processing Relief) CPC to avoid full duty. Misdeclaration as 'new' creates HMRC compliance risk. UK establishment permits direct representation." },
  { desc: "Unroasted green coffee beans, 10 tonnes, from Ethiopia — organic certification attached, fair-trade labelled", hs: "0901110000", gir: ["1", "6"], confidence: 0.94, risk: "LOW", rep: "3", indirect: true, reason: "Unroasted decaffeinated coffee classified under heading 0901. Organic certification requires GB Organic Operator Registration (DE 2/3 N910 / N853 equivalent). Non-UK importer requires indirect representation. Low tariff rate applicable." },
];

// ─── INSTRUCTION TEMPLATE ────────────────────────────────────────────────────

const INSTRUCTION = `You are a UK Customs Compliance Officer.

Your task is to classify goods under the UK Trade Tariff using GIR 1–6 and determine customs compliance obligations.

You must be legally accurate and follow HMRC-style reasoning.

Rules:
- Always apply GIR rules in order
- Always justify classification logically
- Always assess INDIRECT REPRESENTATION risk if importer is non-UK established
- Never guess without reasoning

Product:
{{PRODUCT_DESCRIPTION}}

Return structured output only.`;

// ─── OUTPUT TEMPLATE ─────────────────────────────────────────────────────────

function buildOutput(g) {
  return [
    `HS_CODE: ${g.hs}`,
    `CONFIDENCE: ${g.confidence.toFixed(2)}`,
    `GIR: ${g.gir.join(", ")}`,
    `REPRESENTATION: ${g.rep}`,
    `INDIRECT_REQUIRED: ${g.indirect}`,
    `RISK_LEVEL: ${g.risk}`,
    `REASON: ${g.reason}`,
  ].join("\n");
}

// ─── ROW BUILDER ─────────────────────────────────────────────────────────────

function buildRow(g) {
  const instruction = INSTRUCTION.replace("{{PRODUCT_DESCRIPTION}}", g.desc);
  const output = buildOutput(g);
  const text = `[INST] ${instruction} [/INST]\n\n${output}`;
  return JSON.stringify({ text });
}

// ─── WEIGHTED SAMPLER ────────────────────────────────────────────────────────

function weightedSample(pools) {
  // 40% simple, 35% medium, 25% high-risk/edge
  const r = Math.random();
  if (r < 0.40) return pools.simple[Math.floor(Math.random() * pools.simple.length)];
  if (r < 0.75) return pools.medium[Math.floor(Math.random() * pools.medium.length)];
  return pools.hard[Math.floor(Math.random() * pools.hard.length)];
}

// ─── GENERATE VARIATIONS ─────────────────────────────────────────────────────

const ORIGINATORS = [
  "from China", "from Vietnam", "from Bangladesh", "from India", "from South Korea",
  "from Germany", "from Italy", "from Japan", "from USA", "from Turkey", "from Taiwan",
  "from Pakistan", "from Brazil", "from Indonesia", "from Mexico"
];

const UK_SUFFIXES = [
  ", UK-established importer", ", imported by UK distributor", ", imported by UK retailer",
  ", via UK-based trading company", ", purchased by UK Ltd company"
];

const NONUK_SUFFIXES = [
  ", non-UK established buyer", ", imported by overseas trading company with UK EORI",
  ", foreign entity acting as importer of record", ", non-UK established entity"
];

function varyDescription(g) {
  // Randomly substitute origin or append UK/non-UK context for variety
  const varied = { ...g };
  const roll = Math.random();

  if (roll < 0.3) {
    // Swap origin
    const newOrigin = ORIGINATORS[Math.floor(Math.random() * ORIGINATORS.length)];
    varied.desc = varied.desc.replace(/from [A-Za-z\s]+(?=[,.]|$)/, newOrigin);
  }

  if (roll > 0.6 && varied.risk === "LOW") {
    // Sometimes make it UK-established (direct rep)
    if (Math.random() < 0.4) {
      varied.desc += UK_SUFFIXES[Math.floor(Math.random() * UK_SUFFIXES.length)];
      varied.rep = "2";
      varied.indirect = false;
      varied.reason = varied.reason.replace(/Non-UK (importer|established entity|entity|importer of record)[^.]*\./g,
        "UK-established importer permits direct representation (Type 2).");
    }
  }

  return varied;
}

// ─── MAIN GENERATOR ──────────────────────────────────────────────────────────

function generateDataset(count) {
  const pools = {
    simple: SIMPLE_GOODS,
    medium: MEDIUM_GOODS,
    hard: [...HIGH_RISK_GOODS, ...EDGE_CASES],
  };

  const rows = [];
  for (let i = 0; i < count; i++) {
    const base = weightedSample(pools);
    const varied = varyDescription(base);
    rows.push(buildRow(varied));
  }
  return rows;
}

// ─── CSV WRITER (JSONL-per-line, single 'text' column) ────────────────────────

function writeCSV(rows, filepath) {
  const header = "text";
  const lines = [header, ...rows.map(r => r)];
  writeFileSync(filepath, lines.join("\n"), "utf8");
  console.log(`✅ Written ${rows.length} rows → ${filepath}`);
}

// ─── EVAL DATASET (HELD-OUT CANONICAL EXAMPLES) ──────────────────────────────

function generateEvalSet() {
  // Use canonical examples with no variation for clean eval
  const evalPool = [
    ...SIMPLE_GOODS.slice(0, 4),
    ...MEDIUM_GOODS.slice(0, 4),
    ...HIGH_RISK_GOODS.slice(0, 6),
    ...EDGE_CASES.slice(0, 4),
  ];
  return evalPool.map(buildRow);
}

// ─── STATS REPORTER ──────────────────────────────────────────────────────────

function printStats(rows) {
  let low = 0, medium = 0, high = 0, direct = 0, indirect = 0;

  for (const r of rows) {
    const parsed = JSON.parse(r);
    const t = parsed.text;
    if (t.includes("RISK_LEVEL: LOW")) low++;
    else if (t.includes("RISK_LEVEL: MEDIUM")) medium++;
    else if (t.includes("RISK_LEVEL: HIGH")) high++;
    if (t.includes("INDIRECT_REQUIRED: true")) indirect++;
    else direct++;
  }

  const total = rows.length;
  console.log("\n📊 DATASET STATS");
  console.log("─────────────────────────────────────────");
  console.log(`Total rows      : ${total}`);
  console.log(`LOW risk        : ${low} (${((low/total)*100).toFixed(1)}%)`);
  console.log(`MEDIUM risk     : ${medium} (${((medium/total)*100).toFixed(1)}%)`);
  console.log(`HIGH risk       : ${high} (${((high/total)*100).toFixed(1)}%)`);
  console.log(`Indirect rep    : ${indirect} (${((indirect/total)*100).toFixed(1)}%)`);
  console.log(`Direct rep      : ${direct} (${((direct/total)*100).toFixed(1)}%)`);
  console.log("─────────────────────────────────────────");
}

// ─── ENTRYPOINT ──────────────────────────────────────────────────────────────

mkdirSync(OUT_DIR, { recursive: true });

const trainCount = Math.floor(TOTAL_ROWS * (1 - EVAL_SPLIT));
const evalCount  = Math.floor(TOTAL_ROWS * EVAL_SPLIT);

console.log(`\n🚀 CLOUDAGENT LoRA Dataset Generator`);
console.log(`   Total rows    : ${TOTAL_ROWS}`);
console.log(`   Train rows    : ${trainCount}`);
console.log(`   Eval rows     : ${evalCount}`);
console.log(`   Output dir    : ${OUT_DIR}\n`);

const trainRows = generateDataset(trainCount);
const evalRows  = generateEvalSet().concat(generateDataset(Math.max(0, evalCount - 18)));

writeCSV(trainRows, join(OUT_DIR, "train.csv"));
writeCSV(evalRows,  join(OUT_DIR, "eval.csv"));

printStats(trainRows);

console.log(`\n✅ Done. Upload ${OUT_DIR}/train.csv to your LoRA pipeline.`);
console.log(`   Use ${OUT_DIR}/eval.csv for post-training accuracy checks.\n`);
