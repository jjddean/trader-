/**
 * UK Integrated Online Tariff goods classification — 21 sections / chapter ranges.
 * @see https://www.trade-tariff.service.gov.uk/browse
 */
export const HS_TARIFF_SECTIONS = [
  { value: "all", label: "All sections", chapterFrom: 1, chapterTo: 99 },
  { value: "I", label: "I — Live animals & animal products (01–05)", chapterFrom: 1, chapterTo: 5 },
  { value: "II", label: "II — Vegetable products (06–14)", chapterFrom: 6, chapterTo: 14 },
  { value: "III", label: "III — Fats & oils (15)", chapterFrom: 15, chapterTo: 15 },
  { value: "IV", label: "IV — Food, drink & tobacco (16–24)", chapterFrom: 16, chapterTo: 24 },
  { value: "V", label: "V — Mineral products (25–27)", chapterFrom: 25, chapterTo: 27 },
  { value: "VI", label: "VI — Chemicals (28–38)", chapterFrom: 28, chapterTo: 38 },
  { value: "VII", label: "VII — Plastics & rubber (39–40)", chapterFrom: 39, chapterTo: 40 },
  { value: "VIII", label: "VIII — Hides, leather & furs (41–43)", chapterFrom: 41, chapterTo: 43 },
  { value: "IX", label: "IX — Wood & cork (44–46)", chapterFrom: 44, chapterTo: 46 },
  { value: "X", label: "X — Pulp, paper & books (47–49)", chapterFrom: 47, chapterTo: 49 },
  { value: "XI", label: "XI — Textiles (50–63)", chapterFrom: 50, chapterTo: 63 },
  { value: "XII", label: "XII — Footwear & headgear (64–67)", chapterFrom: 64, chapterTo: 67 },
  { value: "XIII", label: "XIII — Stone, ceramics & glass (68–70)", chapterFrom: 68, chapterTo: 70 },
  { value: "XIV", label: "XIV — Pearls & precious metals (71)", chapterFrom: 71, chapterTo: 71 },
  { value: "XV", label: "XV — Base metals (72–83)", chapterFrom: 72, chapterTo: 83 },
  { value: "XVI", label: "XVI — Machinery & electrical (84–85)", chapterFrom: 84, chapterTo: 85 },
  { value: "XVII", label: "XVII — Vehicles & transport (86–89)", chapterFrom: 86, chapterTo: 89 },
  { value: "XVIII", label: "XVIII — Optical & precision (90–92)", chapterFrom: 90, chapterTo: 92 },
  { value: "XIX", label: "XIX — Arms & ammunition (93)", chapterFrom: 93, chapterTo: 93 },
  { value: "XX", label: "XX — Miscellaneous manufactures (94–96)", chapterFrom: 94, chapterTo: 96 },
  { value: "XXI", label: "XXI — Art & antiques (97–99)", chapterFrom: 97, chapterTo: 99 },
] as const;

export type HsTariffSectionValue = (typeof HS_TARIFF_SECTIONS)[number]["value"];

export function chapterFromHsCode(code: string): number | null {
  const digits = String(code ?? "").replace(/\D/g, "");
  if (digits.length < 2) return null;
  const chapter = Number.parseInt(digits.slice(0, 2), 10);
  return Number.isFinite(chapter) ? chapter : null;
}

export function hsCodeInSection(code: string, sectionValue: HsTariffSectionValue): boolean {
  if (sectionValue === "all") return true;
  const section = HS_TARIFF_SECTIONS.find((s) => s.value === sectionValue);
  if (!section) return true;
  const chapter = chapterFromHsCode(code);
  if (chapter == null) return false;
  return chapter >= section.chapterFrom && chapter <= section.chapterTo;
}
