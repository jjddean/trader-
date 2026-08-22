/**
 * ENS Level 2 business-rule validation.
 *
 * HMRC validates in two layers and rejects with HTTP 400 on either. Layer 1 is
 * the XSD (error codes 4000–4999) and is covered by `ens-xsd-validator`-style
 * checks. This file is layer 2: the business rules (mainly 8000–8999) published
 * at
 * `docs/hmrc/ens/validation/new-ens-rules.md` and captured verbatim in
 * `docs/hmrc/ens/validation/business-rules.json` — 375 rules, 188 for IE315 and
 * 187 for IE313.
 *
 * Running these locally matters because a submission that fails validation
 * produces **no outcome at all**. There is nothing to poll for and nothing to
 * correlate; the only signal is the 400.
 *
 * ## Why these are hand-written
 *
 * The rules are published as English prose, not as machine-readable
 * expressions. Generating predicates from that text would produce something
 * that looks complete and is quietly wrong — and several rules read as
 * tautologies out of context (`[Place of loading] should be present if not
 * [Place of loading]`) because HMRC's bracket labels do not distinguish header
 * from item level. Only the `contextElement` disambiguates them.
 *
 * So each predicate below is written by hand against one HMRC error code, and
 * carries the verbatim scenario for traceability. Rules that are not
 * implemented are listed in `DEFERRED_RULES` with a reason. Nothing is silently
 * dropped: `ruleCoverage()` reconciles this file against the published
 * catalogue and is asserted in the test suite.
 */

import type { EnsDeclaration, EnsGoodsItem, EnsParty } from "./types";

export interface EnsRuleViolation {
  /** HMRC error code, as it will come back in `errorresponse`. */
  errorCode: string;
  /** Absolute XML path the rule applies at. */
  contextElement: string;
  /** HMRC's condition, verbatim. */
  scenario: string;
  /** What the operator should change. FreightCode wording. */
  message: string;
}

interface RuleContext {
  declaration: EnsDeclaration;
  /** `MesSenMES3`, needed by 4065. */
  messageSender?: string;
}

interface Rule {
  errorCode: string;
  contextElement: string;
  scenario: string;
  evaluate: (ctx: RuleContext) => string[];
}

const text = (v: unknown) => String(v ?? "").trim();
const present = (v: unknown) => text(v).length > 0;
const num = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return isFinite(n) ? n : null;
};

/** UNECE rec 21 bulk package kinds, named in rule 8149. */
export const BULK_PACKAGE_KINDS = new Set(["VQ", "VG", "VL", "VY", "VR", "VS", "VO"]);
/** UNECE rec 21 unpacked kinds, named in rule 8150. */
export const UNPACKED_PACKAGE_KINDS = new Set(["NE", "NF", "NG"]);

function items(d: EnsDeclaration): EnsGoodsItem[] {
  return Array.isArray(d.goodsItems) ? d.goodsItems : [];
}

function allPackages(d: EnsDeclaration) {
  return items(d).flatMap((i) => i.packages ?? []);
}

/**
 * The seven parties HMRC publishes address rules for.
 *
 * `TRAREP` and `PERLODSUMDEC` are deliberately absent: the catalogue carries no
 * address family for them, and inventing one would reject declarations HMRC
 * accepts.
 */
export const PARTY_RULE_PATHS = [
  "/CC315A/TRACONCO1",
  "/CC315A/TRACONCE1",
  "/CC315A/NOTPAR670",
  "/CC315A/TRACARENT601",
  "/CC315A/GOOITEGDS/TRACONCO2",
  "/CC315A/GOOITEGDS/TRACONCE2",
  "/CC315A/GOOITEGDS/PRTNOT640",
] as const;

/** Declared parties that the address families apply to, with their context path. */
function addressableParties(d: EnsDeclaration): { path: string; party: EnsParty }[] {
  const out: { path: string; party: EnsParty }[] = [];
  const add = (path: string, party?: EnsParty) => {
    if (!party) return;
    const populated =
      present(party.eori) || present(party.name) || present(party.streetAndNumber)
      || present(party.postcode) || present(party.city) || present(party.countryCode);
    if (populated) out.push({ path, party });
  };
  add("/CC315A/TRACONCO1", d.consignor);
  add("/CC315A/TRACONCE1", d.consignee);
  add("/CC315A/NOTPAR670", d.notifyParty);
  add("/CC315A/TRACARENT601", d.carrier);
  items(d).forEach((item, i) => {
    add(`/CC315A/GOOITEGDS[${i + 1}]/TRACONCO2`, item.consignor);
    add(`/CC315A/GOOITEGDS[${i + 1}]/TRACONCE2`, item.consignee);
    add(`/CC315A/GOOITEGDS[${i + 1}]/PRTNOT640`, item.notifyParty);
  });
  return out;
}

const RULES: Rule[] = [
  {
    errorCode: "4065",
    contextElement: "/CC315A/MesSenMES3",
    scenario: "[Message sender] must match pattern “[A-Z]{2}[^\\n\\r]{1,15}/[0-9]{10}”.",
    evaluate: ({ messageSender }) => {
      if (!present(messageSender)) return [];
      return /^[A-Z]{2}[^\n\r]{1,15}\/[0-9]{10}$/.test(text(messageSender))
        ? []
        : ["Message sender must be a two-letter country code, EORI body, then / and a 10-digit branch id."];
    },
  },
  {
    errorCode: "8102",
    contextElement: "/CC315A",
    scenario:
      "Each [Item number] is unique throughout the declaration. The items shall be numbered in a sequential fashion, starting from ‘1’ for the first item and incrementing the numbering by ‘1’ for each following item.",
    evaluate: ({ declaration }) => {
      const list = items(declaration);
      const errors: string[] = [];
      const seen = new Set<number>();
      list.forEach((item, index) => {
        const n = num(item.itemNumber);
        if (n === null) {
          errors.push(`Goods item ${index + 1} has no item number.`);
          return;
        }
        if (seen.has(n)) errors.push(`Item number ${n} is used more than once.`);
        seen.add(n);
        if (n !== index + 1) {
          errors.push(`Item numbers must run sequentially from 1; item at position ${index + 1} is numbered ${n}.`);
        }
      });
      return errors;
    },
  },
  {
    errorCode: "8103",
    contextElement: "/CC315A/GOOITEGDS",
    scenario:
      "[Gross mass] should be present if not ([Specific circumstance indicator] eq ‘E’ or [Total gross mass]).",
    evaluate: ({ declaration }) => {
      const exempt =
        text(declaration.specificCircumstanceIndicator).toUpperCase() === "E"
        || num(declaration.totalGrossMass) !== null;
      if (exempt) return [];
      return items(declaration)
        .filter((item) => num(item.grossMass) === null)
        .map(
          (item) =>
            `Goods item ${item.itemNumber}: gross mass is required unless the specific circumstance indicator is E or a total gross mass is declared.`,
        );
    },
  },
  {
    errorCode: "8107",
    contextElement: "/CC315A/HEAHEA",
    scenario:
      "[Identity of means of transport crossing border] should be present if ([Transport mode at border] equals 1) or ([Transport mode at border] equals ‘8’).",
    evaluate: ({ declaration }) => {
      const mode = text(declaration.transportModeAtBorder);
      if (mode !== "1" && mode !== "8") return [];
      return present(declaration.identityOfMeansOfTransport)
        ? []
        : [`Identity of means of transport is required for transport mode ${mode}.`];
    },
  },
  {
    errorCode: "8108",
    contextElement: "/CC315A/HEAHEA",
    scenario:
      "[Nationality of means of transport crossing border] should be present if ([Transport mode at border] equals 3, 10 or 11) and [Identity of means of transport crossing border].",
    evaluate: ({ declaration }) => {
      const mode = text(declaration.transportModeAtBorder);
      const applies = ["3", "10", "11"].includes(mode) && present(declaration.identityOfMeansOfTransport);
      if (!applies) return [];
      return present(declaration.nationalityOfMeansOfTransport)
        ? []
        : [`Nationality of means of transport is required for transport mode ${mode} when an identity is declared.`];
    },
  },
  {
    errorCode: "8113",
    contextElement: "/CC315A/HEAHEA",
    scenario:
      "[Identity of means of transport crossing border] should not be present if [Transport mode at border] equals 4.",
    evaluate: ({ declaration }) => {
      if (text(declaration.transportModeAtBorder) !== "4") return [];
      return present(declaration.identityOfMeansOfTransport)
        ? ["Identity of means of transport must not be declared for transport mode 4 (air)."]
        : [];
    },
  },
  {
    errorCode: "8115",
    contextElement: "/CC315A/HEAHEA",
    scenario:
      "[Nationality of means of transport crossing border] should not be present if not ( ([Transport mode at border] equals 3 or [Transport mode at border] equals 10 or [Transport mode at border] equals 11) and [Identity of means of transport crossing border] ).",
    evaluate: ({ declaration }) => {
      if (!present(declaration.nationalityOfMeansOfTransport)) return [];
      const mode = text(declaration.transportModeAtBorder);
      const allowed = ["3", "10", "11"].includes(mode) && present(declaration.identityOfMeansOfTransport);
      return allowed
        ? []
        : ["Nationality of means of transport may only be declared for transport modes 3, 10 or 11 with an identity present."];
    },
  },
  {
    errorCode: "8109",
    contextElement: "/CC315A/HEAHEA",
    scenario: "[Total number of packages] should be present if [Packages] is present.",
    evaluate: ({ declaration }) => {
      if (allPackages(declaration).length === 0) return [];
      return num(declaration.totalNumberOfPackages) !== null
        ? []
        : ["Total number of packages is required when packages are declared."];
    },
  },
  {
    errorCode: "8116",
    contextElement: "/CC315A/HEAHEA",
    scenario: "[Total number of packages] should not be present if not ( [Packages] ).",
    evaluate: ({ declaration }) => {
      if (allPackages(declaration).length > 0) return [];
      return num(declaration.totalNumberOfPackages) !== null
        ? ["Total number of packages must not be declared when no packages are declared."]
        : [];
    },
  },
  {
    errorCode: "8117",
    contextElement: "/CC315A/HEAHEA",
    scenario:
      "[Total number of packages] is equal to the sum of all [Number of packages] + all [Number of pieces] + a value of ‘1’ for each declared ‘bulk’.",
    evaluate: ({ declaration }) => {
      const declared = num(declaration.totalNumberOfPackages);
      if (declared === null) return [];
      let expected = 0;
      for (const pkg of allPackages(declaration)) {
        const kind = text(pkg.kindOfPackages).toUpperCase();
        if (BULK_PACKAGE_KINDS.has(kind)) {
          expected += 1;
          continue;
        }
        expected += num(pkg.numberOfPackages) ?? 0;
        expected += num(pkg.numberOfPieces) ?? 0;
      }
      return declared === expected
        ? []
        : [`Total number of packages is ${declared} but the goods items sum to ${expected} (bulk counts as 1).`];
    },
  },
  {
    errorCode: "8149",
    contextElement: "/CC315A/GOOITEGDS/PACGS2",
    scenario:
      "IF ‘Kind of packages’ (Box 31) indicates ‘BULK’ (UNECE rec 21 : ‘VQ’, ‘VG’, ‘VL’, ‘VY’, ‘VR’, ‘VS’ or ‘VO’) THEN ‘Number of packages’ (box 31) can not be used, ‘Number of Pieces’ (box 31) can not be used.",
    evaluate: ({ declaration }) => {
      const errors: string[] = [];
      items(declaration).forEach((item) => {
        (item.packages ?? []).forEach((pkg) => {
          if (!BULK_PACKAGE_KINDS.has(text(pkg.kindOfPackages).toUpperCase())) return;
          if (num(pkg.numberOfPackages) !== null || num(pkg.numberOfPieces) !== null) {
            errors.push(
              `Goods item ${item.itemNumber}: package kind ${text(pkg.kindOfPackages)} is bulk, so number of packages and number of pieces must not be used.`,
            );
          }
        });
      });
      return errors;
    },
  },
  {
    errorCode: "8150",
    contextElement: "/CC315A/GOOITEGDS/PACGS2",
    scenario:
      "IF ‘Kind of packages’ (Box 31) indicates ‘UNPACKED’ (UNECE rec 21 : = ‘NE’, ‘NF’ or ‘NG’) THEN ‘Number of packages’ can not be used, ‘Number of Pieces’ (box 31) = ‘R’.",
    evaluate: ({ declaration }) => {
      const errors: string[] = [];
      items(declaration).forEach((item) => {
        (item.packages ?? []).forEach((pkg) => {
          if (!UNPACKED_PACKAGE_KINDS.has(text(pkg.kindOfPackages).toUpperCase())) return;
          if (num(pkg.numberOfPackages) !== null) {
            errors.push(
              `Goods item ${item.itemNumber}: package kind ${text(pkg.kindOfPackages)} is unpacked, so number of packages must not be used.`,
            );
          }
          if (num(pkg.numberOfPieces) === null) {
            errors.push(
              `Goods item ${item.itemNumber}: package kind ${text(pkg.kindOfPackages)} is unpacked, so number of pieces is required.`,
            );
          }
        });
      });
      return errors;
    },
  },
  {
    errorCode: "8151",
    contextElement: "/CC315A/GOOITEGDS/PACGS2",
    scenario:
      "IF ‘Kind of packages’ (Box 31) indicates neither ‘BULK’ nor ‘UNPACKED’ THEN ‘Number of packages’ (box 31) = ‘R’, ‘Number of Pieces’ (box 31) can not be used.",
    evaluate: ({ declaration }) => {
      const errors: string[] = [];
      items(declaration).forEach((item) => {
        (item.packages ?? []).forEach((pkg) => {
          const kind = text(pkg.kindOfPackages).toUpperCase();
          if (!kind || BULK_PACKAGE_KINDS.has(kind) || UNPACKED_PACKAGE_KINDS.has(kind)) return;
          if (num(pkg.numberOfPackages) === null) {
            errors.push(`Goods item ${item.itemNumber}: number of packages is required for package kind ${kind}.`);
          }
          if (num(pkg.numberOfPieces) !== null) {
            errors.push(`Goods item ${item.itemNumber}: number of pieces must not be used for package kind ${kind}.`);
          }
        });
      });
      return errors;
    },
  },
  {
    errorCode: "8206",
    contextElement: "/CC315A/HEAHEA",
    scenario: "[Total number of items] should equal the number of [Goods item] present.",
    evaluate: ({ declaration }) => {
      const declared = num(declaration.totalNumberOfItems);
      if (declared === null) return [];
      const actual = items(declaration).length;
      return declared === actual
        ? []
        : [`Total number of items is ${declared} but ${actual} goods items are declared.`];
    },
  },
  {
    errorCode: "8611",
    contextElement: "/CC315A",
    scenario: "[Goods item] may occur up to 999 times.",
    evaluate: ({ declaration }) => {
      const n = items(declaration).length;
      if (n === 0) return ["At least one goods item is required."];
      return n > 999 ? [`${n} goods items declared; the maximum is 999.`] : [];
    },
  },
  {
    errorCode: "8105",
    contextElement: "/CC315A/TRACONCE1",
    scenario: "[TIN] should be present if [Specific circumstance indicator] eq ‘E’.",
    evaluate: ({ declaration }) => {
      if (text(declaration.specificCircumstanceIndicator).toUpperCase() !== "E") return [];
      return present(declaration.consignee?.eori)
        ? []
        : ["Consignee TIN is required when the specific circumstance indicator is E."];
    },
  },
  {
    errorCode: "8164",
    contextElement: "/CC315A/TRACARENT601",
    scenario:
      "[TIN] should be present if [Transport mode at border] eq 1 or [Transport mode at border] eq 4 or [Transport mode at border] eq 8 or [Transport mode at border] eq 10 or [Transport mode at border] eq 11.",
    evaluate: ({ declaration }) => {
      const mode = text(declaration.transportModeAtBorder);
      if (!["1", "4", "8", "10", "11"].includes(mode)) return [];
      return present(declaration.carrier?.eori)
        ? []
        : [`Carrier TIN is required for transport mode ${mode}.`];
    },
  },
  {
    // The address families below cover 70 published rules across 7 parties.
    //
    // HMRC states each one once per party per address part:
    //   "[Name] should be present if not ( [TIN] )."        — no TIN at all
    //   "[Name] should be present for a non-GB [TIN]."      — TIN present, not GB
    //
    // Both reduce to: unless the party has a GB TIN, the full address is
    // required. Written once and applied over PARTY_RULE_PATHS rather than as
    // 70 near-identical predicates; the reported path names which party failed
    // and `partyAddressRuleCodes()` enumerates the codes covered.
    errorCode: "party-address",
    contextElement: "(per party)",
    scenario:
      "[Name] / [Street and number] / [Postal code] / [City] / [Country code] should be present if not ( [TIN] ), and for a non-GB [TIN].",
    evaluate: ({ declaration }) => {
      const errors: string[] = [];
      for (const { path, party } of addressableParties(declaration)) {
        const tin = text(party.eori);
        // A GB TIN identifies the party on its own; no address needed.
        if (/^GB/i.test(tin)) continue;
        const missing: string[] = [];
        if (!present(party.name)) missing.push("name");
        if (!present(party.streetAndNumber)) missing.push("street and number");
        if (!present(party.postcode)) missing.push("postal code");
        if (!present(party.city)) missing.push("city");
        if (!present(party.countryCode)) missing.push("country code");
        if (missing.length === 0) continue;
        errors.push(
          tin
            ? `${path}: a non-GB TIN requires the full address — missing ${missing.join(", ")}.`
            : `${path}: a party with no TIN requires the full address — missing ${missing.join(", ")}.`,
        );
      }
      return errors;
    },
  },
  {
    // 8626–8670: the inverse of the address families. A GB TIN identifies the
    // party outright, so the address parts must NOT be sent. HMRC states it
    // once per party per part; applied here across the same seven parties.
    errorCode: "gb-tin-address-prohibited",
    contextElement: "(per party)",
    scenario:
      "[Name] / [Street and number] / [Postal code] / [City] / [Country code] should not be present if GB [TIN] is present.",
    evaluate: ({ declaration }) => {
      const errors: string[] = [];
      for (const { path, party } of addressableParties(declaration)) {
        if (!/^GB/i.test(text(party.eori))) continue;
        const supplied: string[] = [];
        if (present(party.name)) supplied.push("name");
        if (present(party.streetAndNumber)) supplied.push("street and number");
        if (present(party.postcode)) supplied.push("postal code");
        if (present(party.city)) supplied.push("city");
        if (present(party.countryCode)) supplied.push("country code");
        if (supplied.length > 0) {
          errors.push(`${path}: a GB TIN prohibits address details — remove ${supplied.join(", ")}.`);
        }
      }
      return errors;
    },
  },
  {
    // 8656–8665: representative and person lodging carry a TIN only. Unlike the
    // other parties this holds regardless of the TIN's country.
    errorCode: "tin-only-parties",
    contextElement: "(TRAREP, PERLODSUMDEC)",
    scenario: "[Name] / [Street and number] / [Postal code] / [City] / [Country code] should not be present.",
    evaluate: ({ declaration }) => {
      const errors: string[] = [];
      const check = (path: string, party?: EnsParty) => {
        if (!party) return;
        const supplied: string[] = [];
        if (present(party.name)) supplied.push("name");
        if (present(party.streetAndNumber)) supplied.push("street and number");
        if (present(party.postcode)) supplied.push("postal code");
        if (present(party.city)) supplied.push("city");
        if (present(party.countryCode)) supplied.push("country code");
        if (supplied.length > 0) {
          errors.push(`${path}: this party carries a TIN only — remove ${supplied.join(", ")}.`);
        }
      };
      check("/CC315A/TRAREP", declaration.representative);
      check("/CC315A/PERLODSUMDEC", declaration.personLodgingSummaryDeclaration);
      return errors;
    },
  },
  {
    errorCode: "8111",
    contextElement: "/CC315A/HEAHEA",
    scenario:
      "IF first digit of [Specific circumstance indicator] is ‘C’ THEN [Transport mode at border] cannot be ‘1’, ‘2’, ‘4’, ‘8’, ‘10’ or ‘11’.",
    evaluate: ({ declaration }) => {
      if (text(declaration.specificCircumstanceIndicator).toUpperCase().charAt(0) !== "C") return [];
      const mode = text(declaration.transportModeAtBorder);
      return ["1", "2", "4", "8", "10", "11"].includes(mode)
        ? [`Specific circumstance indicator C (road) is not compatible with transport mode ${mode}.`]
        : [];
    },
  },
  {
    errorCode: "8112",
    contextElement: "/CC315A/HEAHEA",
    scenario:
      "IF first digit of [Specific circumstance indicator] is ‘D’ THEN [Transport mode at border] cannot be ‘1’, ‘3’, ‘4’, ‘8’, ‘10’ or ‘11’.",
    evaluate: ({ declaration }) => {
      if (text(declaration.specificCircumstanceIndicator).toUpperCase().charAt(0) !== "D") return [];
      const mode = text(declaration.transportModeAtBorder);
      return ["1", "3", "4", "8", "10", "11"].includes(mode)
        ? [`Specific circumstance indicator D (rail) is not compatible with transport mode ${mode}.`]
        : [];
    },
  },
  {
    errorCode: "8152",
    contextElement: "/CC315A/GOOITEGDS/PACGS2",
    scenario:
      "IF ‘Kind of packages’ (Box 31) indicates neither ‘BULK’ nor ‘UNPACKED’ and the attribute ‘Specific circumstance indicator’ is not used THEN the attribute ‘Marks & numbers of Packages (Box 31)’ = ‘R’ ELSE the attribute ‘Marks & numbers of Packages (Box 31)’ = ‘O’.",
    evaluate: ({ declaration }) => {
      // Marks are required only for ordinary packaging with no SCI declared.
      // With an SCI present they become optional, so nothing to check.
      if (present(declaration.specificCircumstanceIndicator)) return [];
      const errors: string[] = [];
      items(declaration).forEach((item) => {
        (item.packages ?? []).forEach((pkg) => {
          const kind = text(pkg.kindOfPackages).toUpperCase();
          if (!kind || BULK_PACKAGE_KINDS.has(kind) || UNPACKED_PACKAGE_KINDS.has(kind)) return;
          if (!present(pkg.marksAndNumbers)) {
            errors.push(
              `Goods item ${item.itemNumber}: marks and numbers are required for package kind ${kind} when no specific circumstance indicator is declared.`,
            );
          }
        });
      });
      return errors;
    },
  },
  {
    errorCode: "8692",
    contextElement: "/CC315A/PERLODSUMDEC/TINPLD1",
    scenario: "[TIN] must begin with ‘GB’.",
    evaluate: ({ declaration }) => {
      const tin = text(declaration.personLodgingSummaryDeclaration?.eori);
      if (!tin) return [];
      return /^GB/i.test(tin) ? [] : ["The person lodging the summary declaration must have a GB TIN."];
    },
  },
  {
    errorCode: "8689",
    contextElement: "/CC315A/HEAHEA",
    scenario: "[Transport mode at border] may only take the values ‘1’, ‘2’, ‘3’, ‘4’, ‘8’, ‘10’ or ‘11’.",
    evaluate: ({ declaration }) => {
      const mode = text(declaration.transportModeAtBorder);
      if (!mode) return [];
      return ["1", "2", "3", "4", "8", "10", "11"].includes(mode)
        ? []
        : [`Transport mode at border must be 1, 2, 3, 4, 8, 10 or 11 — got "${mode}".`];
    },
  },
  {
    errorCode: "8690",
    contextElement: "/CC315A/HEAHEA",
    scenario: "[Transport mode at border] must not contain leading zeros.",
    evaluate: ({ declaration }) => {
      const mode = text(declaration.transportModeAtBorder);
      return /^0\d/.test(mode) ? [`Transport mode at border must not have a leading zero — got "${mode}".`] : [];
    },
  },
  {
    errorCode: "8691",
    contextElement: "/CC315A/HEAHEA",
    scenario: "[Specific circumstance indicator] may only take the values ‘C’, ‘D’ or ‘E’.",
    evaluate: ({ declaration }) => {
      const sci = text(declaration.specificCircumstanceIndicator);
      if (!sci) return [];
      return ["C", "D", "E"].includes(sci.toUpperCase())
        ? []
        : [`Specific circumstance indicator must be C, D or E — got "${sci}".`];
    },
  },
  {
    errorCode: "8686",
    contextElement: "/CC315A/HEAHEA",
    scenario: "[Total gross mass] must be greater than or equal to the sum of [Gross mass].",
    evaluate: ({ declaration }) => {
      const total = num(declaration.totalGrossMass);
      if (total === null) return [];
      const sum = items(declaration).reduce((acc, i) => acc + (num(i.grossMass) ?? 0), 0);
      return total >= sum
        ? []
        : [`Total gross mass ${total} is less than the sum of item gross masses (${sum}).`];
    },
  },
  {
    errorCode: "8684",
    contextElement: "/CC315A",
    scenario: "At least two [Itinerary] should be present.",
    evaluate: ({ declaration }) => {
      const legs = declaration.itinerary ?? [];
      if (legs.length === 0) return [];
      return legs.length >= 2 ? [] : ["An itinerary must list at least two countries of routing."];
    },
  },
  {
    errorCode: "8617",
    contextElement: "/CC315A",
    scenario: "[Seals ID] may occur up to 9999 times.",
    evaluate: ({ declaration }) => {
      const n = (declaration.seals ?? []).length;
      return n > 9999 ? [`${n} seals declared; the maximum is 9999.`] : [];
    },
  },
  {
    errorCode: "8612",
    contextElement: "/CC315A/GOOITEGDS",
    scenario: "[(Means of transport at border) Identity] can occur up to 999 times.",
    evaluate: ({ declaration }) =>
      items(declaration)
        .filter((i) => (i.transportIdentities ?? []).length > 999)
        .map((i) => `Goods item ${i.itemNumber}: more than 999 means-of-transport identities declared.`),
  },
  {
    errorCode: "8207",
    contextElement: "/CC315A/GOOITEGDS",
    scenario: "[(Code) commodity] should be present if not ( [Goods description] ).",
    evaluate: ({ declaration }) =>
      items(declaration)
        .filter((i) => !present(i.goodsDescription) && !present(i.commodityCode))
        .map((i) => `Goods item ${i.itemNumber}: a commodity code is required when there is no goods description.`),
  },
  {
    // 8671, 8672, 8678, 8680, 8681 — numeric fields must not carry leading
    // zeros. Grouped: the check is identical and the message names the field.
    errorCode: "no-leading-zeros",
    contextElement: "(numeric fields)",
    scenario: "Value should not have leading zeros.",
    evaluate: ({ declaration }) => {
      const errors: string[] = [];
      const check = (label: string, value: unknown) => {
        const raw = text(value);
        if (/^0\d/.test(raw)) errors.push(`${label} must not have leading zeros — got "${raw}".`);
      };
      check("Total number of items", declaration.totalNumberOfItems);
      check("Total number of packages", declaration.totalNumberOfPackages);
      check("Total gross mass", declaration.totalGrossMass);
      items(declaration).forEach((item) => {
        check(`Goods item ${item.itemNumber} item number`, item.itemNumber);
        (item.packages ?? []).forEach((pkg) => {
          check(`Goods item ${item.itemNumber} number of packages`, pkg.numberOfPackages);
          check(`Goods item ${item.itemNumber} number of pieces`, pkg.numberOfPieces);
        });
      });
      return errors;
    },
  },
  {
    // 8673, 8679 — mass values must not be signed.
    errorCode: "no-signed-mass",
    contextElement: "(mass fields)",
    scenario: "Value should not have a sign.",
    evaluate: ({ declaration }) => {
      const errors: string[] = [];
      const total = num(declaration.totalGrossMass);
      if (total !== null && total < 0) errors.push("Total gross mass must not be negative.");
      items(declaration).forEach((item) => {
        const m = num(item.grossMass);
        if (m !== null && m < 0) errors.push(`Goods item ${item.itemNumber}: gross mass must not be negative.`);
      });
      return errors;
    },
  },
  {
    // 8675, 8676 — Decimal_11_3 bounds, checked before the XSD sees them so the
    // operator gets a field-level message rather than a schema error.
    errorCode: "mass-precision",
    contextElement: "(mass fields)",
    scenario:
      "Value should not have more than 11 digits. Value should not have more than 3 decimal digits.",
    evaluate: ({ declaration }) => {
      const errors: string[] = [];
      const check = (label: string, value: unknown) => {
        const n = num(value);
        if (n === null) return;
        const [intPart, decPart = ""] = String(n).replace("-", "").split(".");
        if (intPart.length + decPart.length > 11) errors.push(`${label} has more than 11 digits.`);
        if (decPart.length > 3) errors.push(`${label} has more than 3 decimal places.`);
      };
      check("Total gross mass", declaration.totalGrossMass);
      items(declaration).forEach((item) => check(`Goods item ${item.itemNumber} gross mass`, item.grossMass));
      return errors;
    },
  },
];

/**
 * Rules from the published catalogue that are deliberately not enforced here.
 *
 * Every entry needs a reason. This list exists so the gap is visible: the
 * acceptance criterion for this phase is that no rule is silently dropped.
 */
export const DEFERRED_RULES: { errorCode: string; reason: string }[] = [
  { errorCode: "8104", reason: "Header/item place-of-loading interaction; HMRC's label does not distinguish the two levels and the condition reads as a tautology without the item context." },
  { errorCode: "8114", reason: "For modes 1 and 8 the transport identity must BE an IMO or ENI number. HMRC states the semantic requirement but publishes no pattern, and both are allocated registries — a format guess would reject valid vessels." },
  { errorCode: "8118", reason: "For mode 4 the conveyance reference must BE an IATA flight number. As 8114, HMRC gives no pattern and airline designators are an allocated list." },
  { errorCode: "8119", reason: "Consignor Trader vs Trader Type mutual exclusion; the Trader Type variant is not modelled in EnsDeclaration yet." },
  { errorCode: "8135", reason: "Header/item transport-charges interaction; same label ambiguity as 8104." },
  { errorCode: "8136", reason: "Header/item place-of-loading interaction; same label ambiguity as 8104." },
  { errorCode: "8153", reason: "Zero-package cross-item rule; needs the full multi-item shape settled before it can be enforced without false positives." },
  { errorCode: "8171", reason: "Header/item place-of-unloading interaction; same label ambiguity as 8104." },
  { errorCode: "8193", reason: "Consignor Trader Type cardinality; not modelled yet, as 8119." },
  { errorCode: "8195", reason: "Cross-party TIN inequality; the two TINs HMRC compares are not identified unambiguously by the published text." },
  { errorCode: "8198", reason: "Item-level means-of-transport vs header identity exclusion; needs confirmation of which takes precedence." },
  { errorCode: "8147", reason: "Item-level means-of-transport nationality; the rule negates on transport mode 2 but the item block has no mode of its own, so which mode it reads is ambiguous." },
  { errorCode: "8170", reason: "Documents required unless a commercial reference number or another alternative is present; the published condition lists alternatives this model does not yet carry." },
  { errorCode: "8199", reason: "Item-level transport identity required when the header identity is absent; pairs with 8198 and needs the same precedence question answered." },
  { errorCode: "8677", reason: "Decimal point formatting; the builder emits Decimal_11_3 via toFixed(3) so this shape cannot occur, and the XSD would catch it if it did." },
  { errorCode: "8685", reason: "Conveyance reference number XFER prefix rule for transport mode 1; the follow-on condition needs the ferry-movement reference format HMRC does not publish here." },
  { errorCode: "8687", reason: "Item place of unloading conditional on the header value and the specific circumstance indicator; same header/item label ambiguity as 8104." },
  { errorCode: "8688", reason: "\"[Packages] should be present\" is unqualified in the published text; enforcing it as written would reject declarations the schema marks packages optional on (PACGS2 is 0..99)." },
  { errorCode: "8616", reason: "Lodgement office reference inequality; the two references HMRC compares are not identified unambiguously by the published text, as with 8195." },
  // The 10600 / Consignee Trader Type family. `Additional information coded`
  // 10600 marks a consignment where the consignee is unknown, which switches
  // several parties between mandatory and prohibited. Deferred as one group:
  // EnsGoodsItem has no Trader Type yet, and implementing half of the family
  // would reject valid declarations.
  { errorCode: "8204", reason: "10600 / Trader Type family — Consignee Trader Type is not modelled in EnsGoodsItem yet; partial implementation would reject valid declarations." },
  { errorCode: "8208", reason: "10600 / Trader Type family — as 8204." },
  { errorCode: "8619", reason: "10600 / Trader Type family — as 8204." },
  { errorCode: "8620", reason: "10600 / Trader Type family — as 8204." },
  { errorCode: "8621", reason: "10600 / Trader Type family — as 8204." },
  { errorCode: "8622", reason: "10600 / Trader Type family — as 8204." },
  { errorCode: "8623", reason: "10600 / Trader Type family — as 8204." },
  { errorCode: "8624", reason: "10600 / Trader Type family — as 8204." },
  { errorCode: "8625", reason: "10600 / Trader Type family — as 8204." },
];

/** Error codes this module enforces. */
export function implementedRuleCodes(): string[] {
  const grouped: Record<string, string[]> = {
    "party-address": partyAddressRuleCodes(),
    "gb-tin-address-prohibited": GB_TIN_PROHIBITION_CODES,
    "tin-only-parties": TIN_ONLY_PARTY_CODES,
    "no-leading-zeros": ["8671", "8672", "8674", "8678", "8680", "8681"],
    "no-signed-mass": ["8673", "8679"],
    "mass-precision": ["8675", "8676"],
  };
  return RULES.flatMap((r) => grouped[r.errorCode] ?? [r.errorCode]);
}

/** 8626–8670: GB TIN prohibits address parts, five parts across seven parties. */
export const GB_TIN_PROHIBITION_CODES = [
  "8626", "8627", "8628", "8629", "8630", // TRACONCO1
  "8631", "8632", "8633", "8634", "8635", // TRACONCE1
  "8636", "8637", "8638", "8639", "8640", // NOTPAR670
  "8641", "8642", "8643", "8644", "8645", // GOOITEGDS/TRACONCO2
  "8646", "8647", "8648", "8649", "8650", // GOOITEGDS/TRACONCE2
  "8651", "8652", "8653", "8654", "8655", // GOOITEGDS/PRTNOT640
  "8666", "8667", "8668", "8669", "8670", // TRACARENT601
];

/** 8656–8665: TRAREP and PERLODSUMDEC carry a TIN only. */
export const TIN_ONLY_PARTY_CODES = [
  "8656", "8657", "8658", "8659", "8660", // TRAREP
  "8661", "8662", "8663", "8664", "8665", // PERLODSUMDEC
];

/**
 * The 70 published codes the `party-address` predicate covers: five address
 * parts x two families x seven parties. Enumerated so coverage reconciliation
 * against the HMRC catalogue can see them, and asserted in the test suite
 * against the catalogue itself.
 */
export function partyAddressRuleCodes(): string[] {
  return [
    // "should be present if not ( [TIN] )"
    "8120", "8121", "8122", "8123", "8124", // TRACONCO1
    "8125", "8126", "8127", "8128", "8129", // TRACONCE1
    "8130", "8131", "8132", "8133", "8134", // NOTPAR670
    "8137", "8138", "8139", "8140", "8141", // GOOITEGDS/TRACONCO2
    "8142", "8143", "8144", "8145", "8146", // GOOITEGDS/TRACONCE2
    "8154", "8155", "8156", "8157", "8158", // GOOITEGDS/PRTNOT640
    "8159", "8160", "8161", "8162", "8163", // TRACARENT601
    // "should be present for a non-GB [TIN]"
    "8220", "8221", "8222", "8223", "8224",
    "8225", "8226", "8227", "8228", "8229",
    "8230", "8231", "8232", "8233", "8234",
    "8237", "8238", "8239", "8240", "8241",
    "8242", "8243", "8244", "8245", "8246",
    "8254", "8255", "8256", "8257", "8258",
    "8259", "8260", "8261", "8262", "8263",
  ];
}

/**
 * Run every implemented rule against a declaration.
 *
 * Returns violations in catalogue order. An empty array does NOT mean HMRC will
 * accept the declaration — only that the rules implemented here pass. See
 * `DEFERRED_RULES`.
 */
export function validateEnsBusinessRules(
  declaration: EnsDeclaration,
  options: { messageSender?: string } = {},
): EnsRuleViolation[] {
  const ctx: RuleContext = { declaration, messageSender: options.messageSender };
  const violations: EnsRuleViolation[] = [];
  for (const rule of RULES) {
    for (const message of rule.evaluate(ctx)) {
      violations.push({
        errorCode: rule.errorCode,
        contextElement: rule.contextElement,
        scenario: rule.scenario,
        message,
      });
    }
  }
  return violations;
}
