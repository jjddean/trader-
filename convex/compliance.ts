import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// DCTS Regional Cumulation Groups
const GROUPS: Record<string, string[]> = {
  group1: [
    // Africa
    "Angola",
    "Benin",
    "Burkina Faso",
    "Burundi",
    "Central African Republic",
    "Chad",
    "Democratic Republic of Congo",
    "Djibouti",
    "Eritrea",
    "Ethiopia",
    "Gambia",
    "Guinea",
    "Guinea-Bissau",
    "Liberia",
    "Madagascar",
    "Malawi",
    "Mali",
    "Mauritania",
    "Mozambique",
    "Niger",
    "Rwanda",
    "Senegal",
    "Sierra Leone",
    "Somalia",
    "South Sudan",
    "Sudan",
    "Tanzania",
    "Togo",
    "Uganda",
    "Zambia",
    "Cameroon",
    "Cape Verde",
    "Comoros",
    "Republic of Congo",
    "Côte d'Ivoire",
    "Eswatini",
    "Ghana",
    "Kenya",
    "Lesotho",
    "Mauritius",
    "Morocco",
    "Zimbabwe",
    "Botswana",
    "Namibia",
    "Nigeria",
  ],
  group2: [
    // ASEAN
    "Brunei",
    "Cambodia",
    "Indonesia",
    "Laos",
    "Myanmar",
    "Philippines",
    "Vietnam",
  ],
  group3: [
    // SAARC
    "Afghanistan",
    "Bangladesh",
    "Bhutan",
    "India",
    "Maldives",
    "Nepal",
    "Pakistan",
    "Sri Lanka",
  ],
};

function getCountryGroup(country: string): string | null {
  for (const [groupName, countries] of Object.entries(GROUPS)) {
    if (countries.includes(country)) return groupName;
  }
  return null;
}

export const checkEligibility = query({
  args: { originCountry: v.string() },
  handler: async (ctx, args) => {
    // DCTS Tier Categorization
    const tiers: Record<string, string[]> = {
      Comprehensive: [
        "Afghanistan",
        "Angola",
        "Bangladesh",
        "Benin",
        "Bhutan",
        "Burkina Faso",
        "Burundi",
        "Cambodia",
        "Central African Republic",
        "Chad",
        "Comoros",
        "Democratic Republic of Congo",
        "Djibouti",
        "Eritrea",
        "Ethiopia",
        "Gambia",
        "Guinea",
        "Guinea-Bissau",
        "Haiti",
        "Kiribati",
        "Laos",
        "Lesotho",
        "Liberia",
        "Madagascar",
        "Malawi",
        "Mali",
        "Mauritania",
        "Mozambique",
        "Myanmar",
        "Nepal",
        "Niger",
        "Rwanda",
        "São Tomé and Príncipe",
        "Senegal",
        "Sierra Leone",
        "Solomon Islands",
        "Somalia",
        "South Sudan",
        "Sudan",
        "Tanzania",
        "Timor-Leste",
        "Togo",
        "Tuvalu",
        "Uganda",
        "Vanuatu",
        "Yemen",
        "Zambia",
      ],
      Enhanced: [
        "Armenia",
        "Bolivia",
        "Cape Verde",
        "Kyrgyzstan",
        "Mongolia",
        "Pakistan",
        "Philippines",
        "Sri Lanka",
        "Tajikistan",
        "Uzbekistan",
        "Vietnam",
      ],
      Standard: [
        "Algeria",
        "Congo",
        "Cook Islands",
        "India",
        "Indonesia",
        "Micronesia",
        "Nigeria",
        "Niue",
        "Samoa",
        "Syria",
      ],
    };

    if (tiers["Comprehensive"].includes(args.originCountry)) {
      return { eligible: true, tier: "Comprehensive", duty: "0%", confidence: 1.0 };
    }
    if (tiers["Enhanced"].includes(args.originCountry)) {
      return { eligible: true, tier: "Enhanced", duty: "0% on 2/3 of lines", confidence: 0.95 };
    }
    if (tiers["Standard"].includes(args.originCountry)) {
      return { eligible: true, tier: "Standard", duty: "Reduced", confidence: 0.9 };
    }

    return {
      eligible: false,
      tier: "None",
      duty: "MFN (Standard UK Global Tariff)",
      confidence: 1.0,
    };
  },
});

export const simulateRoO = mutation({
  args: {
    originCountry: v.string(),
    commodityCode: v.string(),
    valueUK: v.number(),
    valueOrigin: v.number(),
    valueThirdParty: v.number(),
    materials: v.optional(
      v.array(
        v.object({
          country: v.string(),
          value: v.number(),
          description: v.string(),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const originGroup = getCountryGroup(args.originCountry);
    let qualifyingMaterialValue = args.valueOrigin + args.valueUK;
    const cumulationSummary: string[] = [];

    if (args.materials) {
      for (const material of args.materials) {
        const materialGroup = getCountryGroup(material.country);

        // Cumulation Rule: If from same group, it counts as originating
        if (
          originGroup &&
          materialGroup === originGroup &&
          material.country !== args.originCountry
        ) {
          qualifyingMaterialValue += material.value;
          cumulationSummary.push(
            `${material.description} from ${material.country} (Group Cumulation ✅)`,
          );
        } else if (material.country === "UK") {
          // Explicit UK value added via materials list (if not already in valueUK)
          qualifyingMaterialValue += material.value;
        }
      }
    }

    const totalValue =
      args.valueOrigin +
      args.valueUK +
      args.valueThirdParty +
      (args.materials?.reduce((acc, m) => acc + m.value, 0) || 0);
    const valueAddedPercent = totalValue > 0 ? (qualifyingMaterialValue / totalValue) * 100 : 0;

    const threshold = 30; // 30% local/applied value added requirement for DCTS
    const isCompliant = valueAddedPercent >= threshold;

    let message = "";
    if (isCompliant) {
      message = `Compliant: ${valueAddedPercent.toFixed(1)}% qualifying content exceeds the ${threshold}% threshold.`;
      if (cumulationSummary.length > 0) {
        message += ` Benefited from Group Cumulation: ${cumulationSummary.join(", ")}.`;
      }
    } else {
      message = `Non-Compliant: Only ${valueAddedPercent.toFixed(1)}% qualifying content. Minimum ${threshold}% required for DCTS preference.`;
    }

    return {
      isCompliant,
      valueAddedPercent,
      threshold,
      message,
      cumulationApplied: cumulationSummary.length > 0,
    };
  },
});
