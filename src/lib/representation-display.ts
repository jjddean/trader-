export type RepresentationType = "self" | "direct" | "indirect";

export function normalizeRepresentationType(
  value: string | undefined | null,
): RepresentationType {
  if (value === "direct" || value === "indirect") return value;
  return "self";
}

export function representationSummaryLabel(type: RepresentationType): string {
  switch (type) {
    case "indirect":
      return "Indirect (DE 3/21)";
    case "direct":
      return "Direct representation";
    default:
      return "Self-represented";
  }
}

export function representationListChipLabel(type: RepresentationType): string | null {
  if (type === "indirect") return "Indirect";
  return null;
}
