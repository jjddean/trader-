import { v } from "convex/values";
import { query } from "./_generated/server";

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

