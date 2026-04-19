const GROUPS: Record<string, string[]> = {
  group1: [
    "Angola", "Benin", "Burkina Faso", "Burundi", "Central African Republic",
    "Chad", "Democratic Republic of Congo", "Djibouti", "Eritrea", "Ethiopia",
    "Gambia", "Guinea", "Guinea-Bissau", "Liberia", "Madagascar", "Malawi",
    "Mali", "Mauritania", "Mozambique", "Niger", "Rwanda", "Senegal",
    "Sierra Leone", "Somalia", "South Sudan", "Sudan", "Tanzania", "Togo",
    "Uganda", "Zambia", "Cameroon", "Cape Verde", "Comoros", "Republic of Congo",
    "Côte d'Ivoire", "Eswatini", "Ghana", "Kenya", "Lesotho", "Mauritius",
    "Morocco", "Zimbabwe", "Botswana", "Namibia", "Nigeria",
  ],
  group2: ["Brunei", "Cambodia", "Indonesia", "Laos", "Myanmar", "Philippines", "Vietnam"],
  group3: ["Afghanistan", "Bangladesh", "Bhutan", "India", "Maldives", "Nepal", "Pakistan", "Sri Lanka"],
};

function getCountryGroup(country: string): string | null {
  for (const [groupName, countries] of Object.entries(GROUPS)) {
    if (countries.includes(country)) return groupName;
  }
  return null;
}

interface Material { country: string; value: number; description: string; }

export interface RoOResult {
  isCompliant: boolean;
  valueAddedPercent: number;
  threshold: number;
  message: string;
  cumulationApplied: boolean;
}

export function simulateRoO(args: {
  originCountry: string;
  valueUK: number;
  valueOrigin: number;
  valueThirdParty: number;
  materials?: Material[];
}): RoOResult {
  const originGroup = getCountryGroup(args.originCountry);
  let qualifyingMaterialValue = args.valueOrigin + args.valueUK;
  const cumulationSummary: string[] = [];

  for (const material of args.materials ?? []) {
    const materialGroup = getCountryGroup(material.country);
    if (originGroup && materialGroup === originGroup && material.country !== args.originCountry) {
      qualifyingMaterialValue += material.value;
      cumulationSummary.push(`${material.description} from ${material.country} (Group Cumulation ✅)`);
    } else if (material.country === "UK") {
      qualifyingMaterialValue += material.value;
    }
  }

  const totalValue =
    args.valueOrigin +
    args.valueUK +
    args.valueThirdParty +
    (args.materials?.reduce((acc, m) => acc + m.value, 0) ?? 0);

  const valueAddedPercent = totalValue > 0 ? (qualifyingMaterialValue / totalValue) * 100 : 0;
  const threshold = 30;
  const isCompliant = valueAddedPercent >= threshold;

  let message = isCompliant
    ? `Compliant: ${valueAddedPercent.toFixed(1)}% qualifying content exceeds the ${threshold}% threshold.`
    : `Non-Compliant: Only ${valueAddedPercent.toFixed(1)}% qualifying content. Minimum ${threshold}% required for DCTS preference.`;

  if (isCompliant && cumulationSummary.length > 0) {
    message += ` Benefited from Group Cumulation: ${cumulationSummary.join(", ")}.`;
  }

  return { isCompliant, valueAddedPercent, threshold, message, cumulationApplied: cumulationSummary.length > 0 };
}
