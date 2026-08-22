/**
 * Builds CC315A (new ENS, IE315) and CC313A (amendment, IE313) XML.
 *
 * Schemas:   `docs/hmrc/ens/schemas/declarations/CC315A-v11-2.xsd`, `CC313A-v11-2.xsd`
 * Structure: `docs/hmrc/ens/reference/raw/cc315a-structure.json`
 * Fields:    `docs/hmrc/ens/reference/fields.md`
 *
 * Both messages are `xs:sequence`, so **element order is part of the contract**.
 * The order below is taken from the schema, not from the example payloads.
 * Emitting a valid element in the wrong position is a schema error in the
 * 4000–4999 band, and the message never reaches business validation.
 *
 * Every interpolated value goes through `xmlEscape()`, matching the rule the
 * CDS renderers already follow.
 */

import { xmlEscape } from "../xml-utils";
import type {
  EnsDeclaration,
  EnsGoodsItem,
  EnsParty,
  EnsProducedDocument,
} from "./types";

/** HMRC message type codes, written into `MesTypMES20`. */
export const ENS_MESSAGE_TYPES = { IE315: "CC315A", IE313: "CC313A" } as const;

export interface BuildOptions {
  /** `MesSenMES3` — the declarant EORI and branch, e.g. `GB000000000012/0000000010`. */
  messageSender: string;
  /** `MesRecMES6`. Optional. */
  messageRecipient?: string;
  /** `MesIdeMES19` — max 14 chars. Generated when omitted. */
  messageId?: string;
  /** `CorIdeMES25`. On an amendment this is the original message's id. */
  correlationIdentifier?: string;
  /** Fixes the clock, so a build is reproducible in tests. */
  now?: Date;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

/** `DatePrepType` — `yyMMdd`. */
export function formatDatePrep(d: Date): string {
  const yy = String(d.getUTCFullYear()).slice(2);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

/** `TimeType` — `HHmm`. */
export function formatTimePrep(d: Date): string {
  return `${String(d.getUTCHours()).padStart(2, "0")}${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** `DateTimeType` — `yyyyMMddHHmm`, exactly 12 characters. */
export function formatDateTime(d: Date): string {
  const yyyy = String(d.getUTCFullYear()).padStart(4, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}${formatTimePrep(d)}`;
}

/**
 * `Decimal_11_3` — up to 11 total digits, 3 fractional.
 * Emitted with 3 decimal places, matching HMRC's own example (`1.000`).
 */
export function formatDecimal(value: unknown): string | null {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  if (!isFinite(n) || n < 0) return null;
  return n.toFixed(3);
}

/** Accepts a `DateTimeType` string already in shape, or anything Date can parse. */
function asDateTime(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  if (/^[1-9]\d{11}$/.test(raw)) return raw;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : formatDateTime(d);
}

function el(tag: string, value: unknown, indent: string): string {
  const v = text(value);
  return v ? `\n${indent}<${tag}>${xmlEscape(v)}</${tag}>` : "";
}

/**
 * How a party's address is treated.
 *
 * - `gb-tin-suppressed` — the default. Rules 8626–8670 prohibit address parts
 *   whenever the party carries a GB TIN, because the TIN identifies it outright.
 *   Service guide v1.9 states the same thing for the notify party specifically.
 * - `tin-only` — rules 8656–8665: TRAREP and PERLODSUMDEC never carry an
 *   address, whatever the TIN's country.
 */
type AddressPolicy = "gb-tin-suppressed" | "tin-only";

/**
 * A party block.
 *
 * HMRC gives every party its own element names, so the suffixes are passed in
 * rather than assumed. Order follows the schema: Name, Street, Postcode, City,
 * Country, [LNG], TIN.
 */
function partyXml(
  tag: string,
  party: EnsParty | undefined,
  ids: {
    name: string;
    street: string;
    postcode: string;
    city: string;
    country: string;
    tin: string;
  },
  indent: string,
  policy: AddressPolicy = "gb-tin-suppressed",
): string {
  if (!party) return "";
  const eori = text(party.eori);
  const dropAddress = policy === "tin-only" || /^GB/i.test(eori);

  const inner = dropAddress
    ? ""
    : el(ids.name, party.name, `${indent}  `)
      + el(ids.street, party.streetAndNumber, `${indent}  `)
      + el(ids.postcode, party.postcode, `${indent}  `)
      + el(ids.city, party.city, `${indent}  `)
      + el(ids.country, party.countryCode, `${indent}  `);

  const tin = el(ids.tin, eori, `${indent}  `);
  if (!inner && !tin) return "";
  return `\n${indent}<${tag}>${inner}${tin}\n${indent}</${tag}>`;
}

/** Element ids per party, from the CC315A schema. They are not interchangeable. */
const PARTY_IDS = {
  consignor: { name: "NamCO17", street: "StrAndNumCO122", postcode: "PosCodCO123", city: "CitCO124", country: "CouCO125", tin: "TINCO159" },
  consignee: { name: "NamCE17", street: "StrAndNumCE122", postcode: "PosCodCE123", city: "CitCE124", country: "CouCE125", tin: "TINCE159" },
  notifyParty: { name: "NamNOTPAR672", street: "StrNumNOTPAR673", postcode: "PosCodNOTPAR676", city: "CitNOTPAR674", country: "CouCodNOTPAR675", tin: "TINNOTPAR671" },
  representative: { name: "NamTRE1", street: "StrAndNumTRE1", postcode: "PosCodTRE1", city: "CitTRE1", country: "CouCodTRE1", tin: "TINTRE1" },
  personLodging: { name: "NamPLD1", street: "StrAndNumPLD1", postcode: "PosCodPLD1", city: "CitPLD1", country: "CouCodPLD1", tin: "TINPLD1" },
  carrier: { name: "NamTRACARENT604", street: "StrNumTRACARENT607", postcode: "PstCodTRACARENT606", city: "CtyTRACARENT603", country: "CouCodTRACARENT605", tin: "TINTRACARENT602" },
  itemConsignor: { name: "NamCO27", street: "StrAndNumCO222", postcode: "PosCodCO223", city: "CitCO224", country: "CouCO225", tin: "TINCO259" },
  itemConsignee: { name: "NamCE27", street: "StrAndNumCE222", postcode: "PosCodCE223", city: "CitCE224", country: "CouCO225", tin: "TINCE259" },
  itemNotifyParty: { name: "NamPRTNOT642", street: "StrNumPRTNOT646", postcode: "PstCodPRTNOT644", city: "CtyPRTNOT643", country: "CouCodGINOT647", tin: "TINPRTNOT641" },
} as const;

function documentsXml(docs: EnsProducedDocument[] | undefined, indent: string): string {
  return (docs ?? [])
    .filter((d) => text(d.documentType) && text(d.reference))
    .map(
      (d) =>
        `\n${indent}<PRODOCDC2>`
        + el("DocTypDC21", d.documentType, `${indent}  `)
        + el("DocRefDC23", d.reference, `${indent}  `)
        + `\n${indent}</PRODOCDC2>`,
    )
    .join("");
}

/**
 * One goods item. Schema order within `GOOITEGDS`:
 * IteNumGDS7, GooDesGDS23, GroMasGDS46, MetOfPayGDI12, ComRefNumGIM1,
 * UNDanGooCodGDI1, PlaLoaGOOITE333, PlaUnlGOOITE333, PRODOCDC2, SPEMENMT2,
 * TRACONCO2, COMCODGODITM, TRACONCE2, CONNR2, IDEMEATRAGI970, PACGS2, PRTNOT640.
 */
function goodsItemXml(item: EnsGoodsItem, indent: string): string {
  const i2 = `${indent}  `;
  const specialMentions = (item.specialMentions ?? [])
    .filter((m) => text(m.additionalInformationCode))
    .map(
      (m) =>
        `\n${i2}<SPEMENMT2>` + el("AddInfCodMT23", m.additionalInformationCode, `${i2}  `) + `\n${i2}</SPEMENMT2>`,
    )
    .join("");

  const commodity = text(item.commodityCode)
    ? `\n${i2}<COMCODGODITM>` + el("ComNomCMD1", item.commodityCode, `${i2}  `) + `\n${i2}</COMCODGODITM>`
    : "";

  const containers = (item.containers ?? [])
    .filter((c) => text(c.containerNumber))
    .map((c) => `\n${i2}<CONNR2>` + el("ConNumNR21", c.containerNumber, `${i2}  `) + `\n${i2}</CONNR2>`)
    .join("");

  const transports = (item.transportIdentities ?? [])
    .filter((t) => text(t.identity))
    .map(
      (t) =>
        `\n${i2}<IDEMEATRAGI970>`
        + el("NatIDEMEATRAGI973", t.nationality, `${i2}  `)
        + el("IdeMeaTraGIMEATRA971", t.identity, `${i2}  `)
        + `\n${i2}</IDEMEATRAGI970>`,
    )
    .join("");

  const packages = (item.packages ?? [])
    .filter((p) => text(p.kindOfPackages))
    .map(
      (p) =>
        `\n${i2}<PACGS2>`
        + el("KinOfPacGS23", p.kindOfPackages, `${i2}  `)
        + el("NumOfPacGS24", p.numberOfPackages, `${i2}  `)
        + el("NumOfPieGS25", p.numberOfPieces, `${i2}  `)
        + el("MarNumOfPacGSL21", p.marksAndNumbers, `${i2}  `)
        + `\n${i2}</PACGS2>`,
    )
    .join("");

  return (
    `\n${indent}<GOOITEGDS>`
    + el("IteNumGDS7", item.itemNumber, i2)
    + el("GooDesGDS23", item.goodsDescription, i2)
    + el("GroMasGDS46", formatDecimal(item.grossMass), i2)
    + el("MetOfPayGDI12", item.transportChargesMethodOfPayment, i2)
    + el("ComRefNumGIM1", item.commercialReferenceNumber, i2)
    + el("UNDanGooCodGDI1", item.unDangerousGoodsCode, i2)
    + el("PlaLoaGOOITE333", item.placeOfLoading, i2)
    + el("PlaUnlGOOITE333", item.placeOfUnloading, i2)
    + documentsXml(item.documents, i2)
    + specialMentions
    + partyXml("TRACONCO2", item.consignor, PARTY_IDS.itemConsignor, i2)
    + commodity
    + partyXml("TRACONCE2", item.consignee, PARTY_IDS.itemConsignee, i2)
    + containers
    + transports
    + packages
    + partyXml("PRTNOT640", item.notifyParty, PARTY_IDS.itemNotifyParty, i2)
    + `\n${indent}</GOOITEGDS>`
  );
}

/** Totals HMRC derives from the items rather than trusting the caller. */
function derivedTotals(declaration: EnsDeclaration) {
  const items = declaration.goodsItems ?? [];
  const packages = items.reduce(
    (acc, item) =>
      acc + (item.packages ?? []).reduce((a, p) => a + (Number(p.numberOfPackages) || 0), 0),
    0,
  );
  return { totalItems: items.length, totalPackages: packages };
}

function buildMessage(
  declaration: EnsDeclaration,
  options: BuildOptions,
  messageType: "IE315" | "IE313",
): string {
  const now = options.now ?? new Date();
  const root = ENS_MESSAGE_TYPES[messageType];
  const totals = derivedTotals(declaration);
  const messageId = text(options.messageId) || `FC${now.getTime().toString(36).toUpperCase()}`.slice(0, 14);

  const declarationDateTime = asDateTime(declaration.declarationDateTime) ?? formatDateTime(now);
  const expectedArrival = asDateTime(declaration.expectedArrivalDateTime);

  // HEAHEA is not shared between the two messages. The amendment swaps three
  // elements, and the schema sequence rejects the other message's names:
  //   RefNumHEA4 (LRN)      → DocNumHEA5 (the MRN being amended)
  //   DecPlaHEA394          → AmdPlaHEA598
  //   DecDatTimHEA114       → DatTimAmeHEA113
  const isAmendment = messageType === "IE313";
  const header =
    `\n  <HEAHEA>`
    + (isAmendment
      ? el("DocNumHEA5", declaration.movementReferenceNumber, "    ")
      : el("RefNumHEA4", declaration.localReferenceNumber, "    "))
    + el("TraModAtBorHEA76", declaration.transportModeAtBorder, "    ")
    + el("IdeOfMeaOfTraCroHEA85", declaration.identityOfMeansOfTransport, "    ")
    + el("NatOfMeaOfTraCroHEA87", declaration.nationalityOfMeansOfTransport, "    ")
    + el("TotNumOfIteHEA305", totals.totalItems, "    ")
    + (totals.totalPackages > 0 ? el("TotNumOfPacHEA306", totals.totalPackages, "    ") : "")
    + el("TotGroMasHEA307", formatDecimal(declaration.totalGrossMass), "    ")
    + (isAmendment
      ? el("AmdPlaHEA598", declaration.declarationPlace, "    ")
      : el("DecPlaHEA394", declaration.declarationPlace, "    "))
    + el("SpeCirIndHEA1", declaration.specificCircumstanceIndicator, "    ")
    + el("TraChaMetOfPayHEA1", declaration.transportChargesMethodOfPayment, "    ")
    + el("ComRefNumHEA", declaration.commercialReferenceNumber, "    ")
    + el("ConRefNumHEA", declaration.conveyanceReferenceNumber, "    ")
    + el("PlaLoaGOOITE334", declaration.placeOfLoading, "    ")
    + el("PlaUnlGOOITE334", declaration.placeOfUnloading, "    ")
    + (isAmendment
      ? el("DatTimAmeHEA113", declarationDateTime, "    ")
      : el("DecDatTimHEA114", declarationDateTime, "    "))
    + `\n  </HEAHEA>`;

  const itinerary = (declaration.itinerary ?? [])
    .filter((i) => text(i.countryCode))
    .map((i) => `\n  <ITI>` + el("CouOfRouCodITI1", i.countryCode, "    ") + `\n  </ITI>`)
    .join("");

  const seals = (declaration.seals ?? [])
    .filter((s) => text(s.sealIdentity))
    .map((s) => `\n  <SEAID529>` + el("SeaIdSEAID530", s.sealIdentity, "    ") + `\n  </SEAID529>`)
    .join("");

  const firstEntry =
    text(declaration.customsOfficeOfFirstEntry) || expectedArrival
      ? `\n  <CUSOFFFENT730>`
        + el("RefNumCUSOFFFENT731", declaration.customsOfficeOfFirstEntry, "    ")
        + el("ExpDatOfArrFIRENT733", expectedArrival, "    ")
        + `\n  </CUSOFFFENT730>`
      : "";

  const subsequentEntry = (declaration.subsequentEntryOffices ?? [])
    .filter((o) => text(o))
    .map((o) => `\n  <CUSOFFSENT740>` + el("RefNumSUBENR909", o, "    ") + `\n  </CUSOFFSENT740>`)
    .join("");

  const lodgement = text(declaration.lodgementCustomsOffice)
    ? `\n  <CUSOFFLON>` + el("RefNumCOL1", declaration.lodgementCustomsOffice, "    ") + `\n  </CUSOFFLON>`
    : "";

  // Declaration-level sequence, straight from the schema. Do not reorder.
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n`
    + `<ie:${root} xmlns:ie="http://ics.dgtaxud.ec/${root}">`
    + el("MesSenMES3", options.messageSender, "  ")
    + el("MesRecMES6", options.messageRecipient, "  ")
    + el("DatOfPreMES9", formatDatePrep(now), "  ")
    + el("TimOfPreMES10", formatTimePrep(now), "  ")
    + el("MesIdeMES19", messageId, "  ")
    + el("MesTypMES20", root, "  ")
    + el("CorIdeMES25", options.correlationIdentifier, "  ")
    + header
    + partyXml("TRACONCO1", declaration.consignor, PARTY_IDS.consignor, "  ")
    + partyXml("TRACONCE1", declaration.consignee, PARTY_IDS.consignee, "  ")
    + partyXml("NOTPAR670", declaration.notifyParty, PARTY_IDS.notifyParty, "  ")
    + (declaration.goodsItems ?? []).map((item) => goodsItemXml(item, "  ")).join("")
    + itinerary
    + lodgement
    + partyXml("TRAREP", declaration.representative, PARTY_IDS.representative, "  ", "tin-only")
    + partyXml("PERLODSUMDEC", declaration.personLodgingSummaryDeclaration, PARTY_IDS.personLodging, "  ", "tin-only")
    + seals
    + firstEntry
    + subsequentEntry
    + partyXml("TRACARENT601", declaration.carrier, PARTY_IDS.carrier, "  ")
    + `\n</ie:${root}>\n`
  );
}

/** Build a new ENS (IE315 / CC315A). */
export function buildCC315A(declaration: EnsDeclaration, options: BuildOptions): string {
  return buildMessage(declaration, options, "IE315");
}

/**
 * Build an ENS amendment (IE313 / CC313A).
 *
 * `mrn` must equal `declaration.movementReferenceNumber` — HMRC requires the
 * body's `DocNumHEA5` and the `{mrn}` path parameter to agree, and a mismatch
 * is only discovered after a round trip. Checked here instead.
 */
export function buildCC313A(
  declaration: EnsDeclaration,
  options: BuildOptions & { mrn: string },
): string {
  const bodyMrn = text(declaration.movementReferenceNumber);
  const pathMrn = text(options.mrn);
  if (!bodyMrn) {
    throw new Error("Amendment requires movementReferenceNumber (DocNumHEA5).");
  }
  if (bodyMrn !== pathMrn) {
    throw new Error(
      `Amendment MRN mismatch: body DocNumHEA5 is "${bodyMrn}" but the request path is "${pathMrn}".`,
    );
  }
  return buildMessage(declaration, options, "IE313");
}
