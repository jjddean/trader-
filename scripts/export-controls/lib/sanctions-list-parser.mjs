/**
 * UK Sanctions List (FCDO XML) → slim normalized JSON for R2 screening.
 * Full designation set; deduped identifiers; screening-relevant fields only.
 */

/** @param {unknown} value */
export function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

/** @param {unknown} node */
export function textVal(node) {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node).trim();
  if (Array.isArray(node)) return textVal(node[0]);
  if (typeof node === "object") {
    if ("#text" in node) return String(node["#text"] ?? "").trim();
    for (const v of Object.values(node)) {
      const t = textVal(v);
      if (t) return t;
    }
  }
  return "";
}

/** @param {string} ukDate dd/mm/yyyy */
export function parseUkDate(ukDate) {
  const match = String(ukDate).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return ukDate || null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

/** @param {Record<string, unknown>} nameNode */
export function buildFullName(nameNode) {
  const parts = [1, 2, 3, 4, 5, 6]
    .map((i) => textVal(nameNode[`Name${i}`]))
    .filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  return textVal(nameNode.Name6);
}

const MEASURE_FLAG_MAP = {
  AssetFreeze: "asset_freeze",
  ArmsEmbargo: "arms_embargo",
  TargetedArmsEmbargo: "targeted_arms_embargo",
  CharteringOfShips: "chartering_of_ships",
  ClosureOfRepresentativeOffices: "closure_of_representative_offices",
  CrewServicingOfShipsAndAircraft: "crew_servicing",
  Deflag: "deflag",
  PreventionOfBusinessArrangements: "prevention_of_business_arrangements",
  ProhibitionOfPortEntry: "prohibition_of_port_entry",
  TravelBan: "travel_ban",
  PreventionOfCharteringOfShips: "prevention_of_chartering_ships",
  PreventionOfCharteringOfShipsAndAircraft: "prevention_of_chartering_ships_aircraft",
  TechnicalAssistanceRelatedToAircraft: "technical_assistance_aircraft",
  TrustServicesSanctions: "trust_services_sanctions",
  DirectorDisqualificationSanction: "director_disqualification",
};

/** @param {unknown} value */
function isTruthy(value) {
  if (value === true) return true;
  return textVal(value).toLowerCase() === "true";
}

/** @param {Record<string, unknown> | undefined} indicators */
export function extractMeasures(indicators) {
  if (!indicators) return [];
  /** @type {string[]} */
  const measures = [];
  for (const [flag, code] of Object.entries(MEASURE_FLAG_MAP)) {
    if (isTruthy(indicators[flag])) measures.push(code);
  }
  return measures;
}

/** @param {unknown} value */
function uniqueStrings(value) {
  return [...new Set(asArray(value).map((v) => textVal(v)).filter(Boolean))];
}

/** @param {Record<string, unknown>} designation */
export function parseDesignation(designation) {
  const uniqueId = textVal(designation.UniqueID);
  if (!uniqueId) return null;

  const groupTypeRaw = textVal(designation.IndividualEntityShip).toLowerCase();
  const groupType =
    groupTypeRaw === "individual"
      ? "individual"
      : groupTypeRaw === "ship"
        ? "ship"
        : "entity";

  /** @type {{ nameType: string, fullName: string, aliasStrength?: string, nameParts: Record<string, string> }[]} */
  const names = [];
  for (const nameNode of asArray(designation.Names?.Name)) {
    const fullName = buildFullName(nameNode);
    if (!fullName) continue;
    /** @type {Record<string, string>} */
    const nameParts = {};
    for (const i of [1, 2, 3, 4, 5, 6]) {
      const part = textVal(nameNode[`Name${i}`]);
      if (part) nameParts[`name${i}`] = part;
    }
    names.push({
      nameType: textVal(nameNode.NameType) || "Unknown",
      fullName,
      aliasStrength: textVal(nameNode.AliasStrength) || undefined,
      nameParts,
    });
  }

  const nonLatinNames = uniqueStrings(
    asArray(designation.NonLatinNames?.NonLatinName).map((n) =>
      textVal(n?.NameNonLatinScript),
    ),
  );

  /** @type {{ lines: string[], country?: string, postalCode?: string }[]} */
  const addresses = [];
  for (const addr of asArray(designation.Addresses?.Address)) {
    const lines = [1, 2, 3, 4, 5, 6]
      .map((i) => textVal(addr[`AddressLine${i}`]))
      .filter(Boolean);
    if (lines.length === 0 && !textVal(addr.AddressCountry)) continue;
    addresses.push({
      lines,
      country: textVal(addr.AddressCountry) || undefined,
      postalCode: textVal(addr.PostCode) || undefined,
    });
  }

  const dobs = uniqueStrings(
    asArray(designation.IndividualDetails?.Individual?.DOBs?.DOB),
  );

  /** @type {{ type: string, value: string, extra?: string }[]} */
  const identifiers = [];
  const seenIds = new Set();

  function addIdentifier(type, value, extra) {
    const normalized = String(value).trim();
    if (!normalized) return;
    const key = `${type}:${normalized.toUpperCase()}`;
    if (seenIds.has(key)) return;
    seenIds.add(key);
    identifiers.push({ type, value: normalized, extra: extra || undefined });
  }

  for (const passport of asArray(
    designation.IndividualDetails?.Individual?.PassportDetails?.Passport,
  )) {
    addIdentifier(
      "passport",
      textVal(passport.PassportNumber),
      textVal(passport.PassportAdditionalInformation) || undefined,
    );
  }

  for (const imo of asArray(designation.ShipDetails?.Ship?.IMONumbers?.IMONumber)) {
    addIdentifier("imo", textVal(imo).replace(/^IMO/i, ""), undefined);
  }

  for (const biz of asArray(
    designation.EntityDetails?.Entity?.BusinessRegistrationNumbers?.BusinessRegistrationNumber,
  )) {
    addIdentifier("business_registration", textVal(biz), undefined);
  }

  const measures = extractMeasures(designation.SanctionsImposedIndicators);
  const sanctionsImposed = textVal(designation.SanctionsImposed);

  return {
    uniqueId,
    ofsiGroupId: textVal(designation.OFSIGroupID) || undefined,
    unReferenceNumber: textVal(designation.UNReferenceNumber) || undefined,
    groupType,
    regimeName: textVal(designation.RegimeName),
    designationSource: textVal(designation.DesignationSource) || undefined,
    sanctionsImposed: sanctionsImposed || undefined,
    measures,
    names,
    nonLatinNames,
    addresses,
    dobs,
    identifiers,
    statementOfReasons: textVal(designation.UKStatementofReasons) || undefined,
    otherInformation: textVal(designation.OtherInformation) || undefined,
    lastUpdated: parseUkDate(textVal(designation.LastUpdated)),
    dateDesignated: parseUkDate(textVal(designation.DateDesignated)),
  };
}

/**
 * @param {Record<string, unknown>} parsedXml
 */
export function parseSanctionsXml(parsedXml) {
  const root = parsedXml.Designations ?? parsedXml;
  const dateGenerated = parseUkDate(textVal(root.DateGenerated));

  /** @type {ReturnType<typeof parseDesignation>[]} */
  const entities = [];
  for (const designation of asArray(root.Designation)) {
    const entity = parseDesignation(designation);
    if (entity) entities.push(entity);
  }

  entities.sort((a, b) => a.uniqueId.localeCompare(b.uniqueId));

  return {
    version: dateGenerated,
    sourceRef: "UK Sanctions List",
    sourceUrl: "https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.xml",
    govPublicationUrl: "https://www.gov.uk/government/publications/the-uk-sanctions-list",
    dateGenerated,
    entityCount: entities.length,
    entities,
  };
}

/** @param {ReturnType<typeof parseSanctionsXml>} dataset */
export function summariseDataset(dataset) {
  const byType = { individual: 0, entity: 0, ship: 0 };
  let withAssetFreeze = 0;
  let withAliases = 0;
  let withIdentifiers = 0;

  for (const entity of dataset.entities) {
    byType[entity.groupType] = (byType[entity.groupType] ?? 0) + 1;
    if (entity.measures.includes("asset_freeze")) withAssetFreeze++;
    if (entity.names.some((n) => /alias/i.test(n.nameType))) withAliases++;
    if (entity.identifiers.length > 0) withIdentifiers++;
  }

  return { byType, withAssetFreeze, withAliases, withIdentifiers };
}

export const GOLDEN_UNIQUE_IDS = ["AFG0001", "RUS0268", "DPR0075"];
