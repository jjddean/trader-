/**
 * ENS (Safety & Security GB) domain model.
 *
 * Specification: `docs/hmrc/ens/IMPLEMENTATION_SPEC.md`
 * Field definitions: `docs/hmrc/ens/reference/fields.md` (151 fields, verbatim HMRC)
 * Message structure: `docs/hmrc/ens/reference/raw/cc315a-structure.json`
 * Schemas: `docs/hmrc/ens/schemas/declarations/`
 *
 * These types are FreightCode-shaped, not XML-shaped: readable names, flat
 * where the XML nests for no reason. Every field carries its HMRC element id in
 * a comment so a rejection naming `GroMasGDS46` can be traced to a property.
 * The mapping itself lives in `cc315-builder.ts` — this file has no XML in it.
 *
 * Requirement letters (M/O/C) are HMRC's, taken from the field descriptions.
 * They describe the HMRC message, not FreightCode's form: a field HMRC marks
 * conditional may still be required by a business rule in
 * `docs/hmrc/ens/validation/business-rules.json`.
 */

/** Which ICS message a record produces. */
export type EnsMessageType = "IE315" | "IE313";

/** HMRC environment binding, mirroring `declarations.environment` for CDS. */
export type EnsEnvironment = "sandbox" | "production";

/**
 * Lifecycle of an ENS submission.
 *
 * `submitted` means HMRC accepted the *message* and returned a correlation ID.
 * It does NOT mean the declaration was accepted — that only happens when an
 * outcome is collected. The two are deliberately separate states because
 * conflating them is the central trap of this API.
 */
export type EnsStatus =
  | "draft"
  | "submitted"
  | "accepted"
  | "rejected"
  | "amended"
  | "failed";

/**
 * A party's address.
 *
 * HMRC does NOT share element names across parties: the consignor uses
 * `NamCO17`/`StrAndNumCO122`/`TINCO159`, the person lodging uses
 * `NamPLD1`/`StrAndNumPLD1`/`TINPLD1`, and so on. The per-party mapping lives
 * in `cc315-builder.ts`; deliberately not named here, because one set of ids
 * would be wrong for every party but one.
 */
export interface EnsAddress {
  name?: string;
  streetAndNumber?: string;
  postcode?: string;
  city?: string;
  /** Two-letter code — see `reference/country-codes.md` */
  countryCode?: string;
}

/**
 * A trader party.
 *
 * When `eori` is a GB EORI on a notify party, HMRC requires the address parts
 * to be omitted entirely (service guide v1.9). The builder enforces that; do
 * not rely on callers to remember it.
 */
export interface EnsParty extends EnsAddress {
  /** The party's TIN — `TINCO159`, `TINPLD1`, … depending on the party. */
  eori?: string;
}

/** One produced document or certificate. `PRODOCDC2`, 0..99 per goods item. */
export interface EnsProducedDocument {
  /** `DocTypDC21` — M. See `reference/document-types.md` (603 codes) */
  documentType: string;
  /** `DocRefDC23` — M. */
  reference: string;
}

/**
 * `SPEMENMT2`, 0..99 per goods item. The schema carries the coded value only —
 * there is no free-text sibling. See `reference/additional-information.md`.
 */
export interface EnsSpecialMention {
  /** `AddInfCodMT23` — M. */
  additionalInformationCode: string;
}

/** `PACGS2` */
export interface EnsPackage {
  /** `KinOfPacGS23` — see `reference/package-types.md` (406 codes) */
  kindOfPackages: string;
  /** `NumOfPacGS24` */
  numberOfPackages?: number;
  /** `NumOfPieGS25` */
  numberOfPieces?: number;
  /** `MarNumOfPacGSL21` — the long form; note the `L`. */
  marksAndNumbers?: string;
}

/** `CONNR2`, 0..99 per goods item. */
export interface EnsContainer {
  /** `ConNumNR21` — M. */
  containerNumber: string;
}

/** `IDEMEATRAGI970`, 0..unbounded per goods item. */
export interface EnsTransportIdentity {
  /** `IdeMeaTraGIMEATRA971` — M. */
  identity: string;
  /** `NatIDEMEATRAGI973` — two-letter country code. */
  nationality?: string;
}

/** `GOOITEGDS` — one goods item. */
export interface EnsGoodsItem {
  /** `IteNumGDS7` — M. Must be unique and sequential from 1 (rule 8102). */
  itemNumber: number;
  /** `GooDesGDS23` — C. See `reference/acceptable-goods-descriptions.md` */
  goodsDescription?: string;
  /**
   * `GroMasGDS46` — C. Required unless the specific circumstance indicator is
   * `E`, or a total gross mass is given at header level (rule 8103).
   */
  grossMass?: number;
  /** `COMCODGODITM` → `ComNomCMD1` — C. Numeric, 4–8 digits (rule 8xxx pattern). */
  commodityCode?: string;
  /** `UNDanGooCodGDI1` — C. Numeric pattern; not free text. */
  unDangerousGoodsCode?: string;
  /** `MetOfPayGDI12` — see `reference/method-of-payment.md` */
  transportChargesMethodOfPayment?: string;
  /** `ComRefNumGIM1` */
  commercialReferenceNumber?: string;
  /** `PlaLoaGOOITE333` — conditional (service guide v1.10) */
  placeOfLoading?: string;
  /** `PlaUnlGOOITE333` — conditional (service guide v1.10) */
  placeOfUnloading?: string;
  /** `TRACONCO2` — item-level consignor */
  consignor?: EnsParty;
  /** `TRACONCE2` — item-level consignee */
  consignee?: EnsParty;
  /** `PRTNOT640` — item-level notify party */
  notifyParty?: EnsParty;
  documents?: EnsProducedDocument[];
  specialMentions?: EnsSpecialMention[];
  packages?: EnsPackage[];
  containers?: EnsContainer[];
  transportIdentities?: EnsTransportIdentity[];
}

/** `ITI`, 0..99. A country of routing; order is significant. C570. */
export interface EnsItineraryCountry {
  /** `CouOfRouCodITI1` — M. */
  countryCode: string;
}

/** `SEAID529`, 0..unbounded. */
export interface EnsSeal {
  /** `SeaIdSEAID530` — M. */
  sealIdentity: string;
}

/**
 * A complete ENS declaration, as FreightCode holds it.
 *
 * Message-level fields (`MesSenMES3`, `DatOfPreMES9`, `MesIdeMES19`, …) are not
 * modelled here: they are generated at submission time by the builder, not
 * authored by an operator.
 */
export interface EnsDeclaration {
  /** FreightCode record id, when persisted. */
  _id?: string;
  environment?: EnsEnvironment;
  status?: EnsStatus;

  // --- Header (HEAHEA) ---
  /** `RefNumHEA4` — M. Local Reference Number. Must be unique (rule via nonUniqueLRN). */
  localReferenceNumber: string;
  /** `TraModAtBorHEA76` — M. See `reference/modes-of-transport.md` */
  transportModeAtBorder: string;
  /** `IdeOfMeaOfTraCroHEA85` — C. Identity of means of transport crossing the border. */
  identityOfMeansOfTransport?: string;
  /** `NatOfMeaOfTraCroHEA87` — C. */
  nationalityOfMeansOfTransport?: string;
  /** `TotNumOfIteHEA305` — derived from the goods items, not authored. */
  totalNumberOfItems?: number;
  /** `TotNumOfPacHEA306` — derived. */
  totalNumberOfPackages?: number;
  /** `TotGroMasHEA307` — C. Presence changes whether item gross mass is required. */
  totalGrossMass?: number;
  /** `DecPlaHEA394` — C. */
  declarationPlace?: string;
  /** `SpeCirIndHEA1` — C. See `reference/specific-circumstance-indicators.md` */
  specificCircumstanceIndicator?: string;
  /** `TraChaMetOfPayHEA1` — C. */
  transportChargesMethodOfPayment?: string;
  /** `ComRefNumHEA` — C. */
  commercialReferenceNumber?: string;
  /** `ConRefNumHEA` — C. Conveyance reference number. */
  conveyanceReferenceNumber?: string;
  /** `PlaLoaGOOITE334` — conditional (service guide v1.10). */
  placeOfLoading?: string;
  /** `PlaUnlGOOITE334` — conditional (service guide v1.10). */
  placeOfUnloading?: string;
  /** `DecDatTimHEA114` — M. Declaration date and time; generated at submission. */
  declarationDateTime?: string;

  // --- Parties ---
  /** `TRACONCO1` — C511 */
  consignor?: EnsParty;
  /** `TRACONCE1` — C583 */
  consignee?: EnsParty;
  /** `NOTPAR670` — C583. GB EORI means the address parts must be omitted. */
  notifyParty?: EnsParty;
  /** `TRAREP` */
  representative?: EnsParty;
  /** `PERLODSUMDEC` — M. The person lodging the summary declaration. */
  personLodgingSummaryDeclaration: EnsParty;
  /** `TRACARENT601` */
  carrier?: EnsParty;

  // --- Places ---
  /**
   * `CUSOFFFENT730` / `RefNumCUSOFFFENT731` — M. Customs office of first entry.
   * A Northern Ireland office is rejected on the GB service, in sandbox and live.
   */
  customsOfficeOfFirstEntry: string;
  /** `ExpDatOfArrFIRENT733` — M within `CUSOFFFENT730`. Expected arrival. */
  expectedArrivalDateTime?: string;
  /** `CUSOFFSENT740` — subsequent entry offices. */
  subsequentEntryOffices?: string[];
  /** `CUSOFFLON` — lodgement customs office. */
  lodgementCustomsOffice?: string;

  // --- Collections ---
  /** `ITI` — 0..99, order significant. C570 */
  itinerary?: EnsItineraryCountry[];
  /** `SEAID529` — 0..unbounded */
  seals?: EnsSeal[];
  /** `GOOITEGDS` — 1..unbounded. At least one is mandatory. */
  goodsItems: EnsGoodsItem[];

  // --- Amendment only ---
  /**
   * `DocNumHEA5` — the MRN being amended. Present only on an IE313.
   * Must equal the `{mrn}` path parameter; the builder cross-checks.
   */
  movementReferenceNumber?: string;
}

/** Parsed from `SuccessResponse-v2-0.xsd`. */
export interface EnsSubmissionAck {
  /** The only handle on the submission until an MRN exists. Persist it first. */
  correlationId: string;
}

/** One error from `errorresponse-v2.0.xsd`. */
export interface EnsSubmissionError {
  /** 4000–4999 schema, 8000–8999 business. */
  errorCode: string;
  /** Absolute XML path, e.g. `/CC315A/GOOITEGDS`. */
  contextElement?: string;
  /** HMRC's text. */
  description?: string;
  originalValue?: string;
}

export type EnsOutcomeType = "IE328" | "IE316" | "IE304" | "IE305";

/** An outcome collected from the Outcomes API. */
export interface EnsOutcome {
  correlationId: string;
  outcomeType: EnsOutcomeType;
  /** Present on acceptance (IE328) only. Absence is the reject discriminator. */
  movementReferenceNumber?: string;
  errors?: EnsSubmissionError[];
  receivedAt: number;
  acknowledgedAt?: number;
  /** Raw XML, retained as evidence. */
  rawXml?: string;
}

/**
 * One customs intervention inside an IE351. Element ids below are from
 * `schemas/notifications/CC351A-v10-0.xsd`, not the CC315A set.
 */
export interface EnsIntervention {
  /** `CusIntCodCUSINT665` */
  interventionCode: string;
  /** `CusIntTexCUSINT666` */
  interventionText?: string;
  /** `IteNumConCUSINT668` — the goods item it applies to. */
  itemNumber?: number;
}

/** An advanced notification collected from the Notifications API. */
export interface EnsNotification {
  notificationId: string;
  correlationId?: string;
  movementReferenceNumber?: string;
  interventions: EnsIntervention[];
  /**
   * True when this is a Do Not Load. An operational stop, not an error — it
   * must never be auto-acknowledged and must be surfaced distinctly.
   */
  doNotLoad: boolean;
  receivedAt: number;
  acknowledgedAt?: number;
  rawXml?: string;
}
