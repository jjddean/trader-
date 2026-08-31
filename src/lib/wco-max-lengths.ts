/**
 * Maximum value lengths published by the WCO DEC-DMS 3.6 schema.
 *
 * Taken from the `WCOFormat` annotations on text-valued elements in
 * `docs/hmrc/specs/wco-3.6/WCO_DEC_2_DMS.xsd`. The `maxLength` facets
 * themselves live in the imported datatypes schema, which is not mirrored
 * here, so the annotations are the local source; they agree with what HMRC
 * enforces:
 *
 *   cvc-maxLength-valid: Value '59000 Lille' with length = '11' is not
 *   facet-valid with respect to maxLength '9' for type
 *   '#AnonType_AddressPostcodeIDType'
 *
 * HMRC applies this before CDS reads the declaration, so an over-length value
 * is rejected with no notification and no MRN — the failure is invisible
 * unless the response body is read.
 *
 * Keyed by element name. Container elements are excluded; only elements
 * declared with a simple `ds:` type carry text. Where a name appears with
 * different lengths in different places, the widest is used, so the check
 * never rejects a value the schema would have allowed. 45 of the 53
 * names are unambiguous.
 */
export const WCO_MAX_LENGTHS: Record<string, number> = {
  AcceptanceDateTime: 35,
  AccessCode: 4,
  AdditionCode: 4,
  Authentication: 256,
  // published as 3, 4 depending on context — widest used
  CategoryCode: 4,
  ChangeReasonCode: 3,
  ChargesTypeCode: 3,
  CityName: 35,
  ConditionCode: 3,
  ContainerCode: 3,
  // published as 2, 4 depending on context — widest used
  CountryCode: 4,
  CountryRelationshipCode: 3,
  CountrySubDivisionCode: 9,
  CountrySubDivisionName: 35,
  CurrencyTypeCode: 3,
  CurrentCode: 7,
  DeclarationOfficeID: 17,
  // published as 70, 512 depending on context — widest used
  Description: 512,
  DocumentSectionCode: 3,
  DutyRegimeCode: 3,
  EffectiveDateTime: 35,
  ExitDateTime: 35,
  FunctionCode: 3,
  FunctionalReferenceID: 35,
  // published as 2, 17, 18, 35, 50, 70 depending on context — widest used
  ID: 70,
  // published as 3, 17 depending on context — widest used
  IdentificationTypeCode: 17,
  IssueDateTime: 35,
  IssueLocationID: 5,
  LPCOExemptionCode: 3,
  Line: 70,
  LocationID: 17,
  LocationName: 256,
  MarksNumbersID: 512,
  // published as 1, 3 depending on context — widest used
  MethodCode: 3,
  // published as 35, 70, 256 depending on context — widest used
  Name: 256,
  PackingMaterialDescription: 256,
  PaymentMethodCode: 3,
  PostcodeID: 9,
  PreviousCode: 7,
  QuotaOrderID: 17,
  ReferenceID: 35,
  RegionID: 9,
  RegistrationNationalityCode: 2,
  RoleCode: 3,
  RoutingCountryCode: 2,
  SecurityDetailsCode: 3,
  SpecificCircumstancesCodeCode: 3,
  StatementCode: 17,
  StatementDescription: 512,
  StatementTypeCode: 3,
  TagID: 4,
  TraderAssignedReferenceID: 35,
  // published as 2, 3, 4 depending on context — widest used
  TypeCode: 4,
};

export interface OverLengthValue {
  element: string;
  length: number;
  maxLength: number;
  value: string;
}

/**
 * Text values in a rendered declaration that exceed the schema's limit.
 *
 * Only elements with no child elements are examined, which is what the
 * name-keyed map can be trusted for.
 */
export function findOverLengthValues(xml: string): OverLengthValue[] {
  const findings: OverLengthValue[] = [];
  const seen = new Set<string>();
  const pattern = /<([A-Za-z]+)(?:\s[^>]*)?>([^<]+)<\/\1>/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(xml)) !== null) {
    const [, element, raw] = match;
    const maxLength = WCO_MAX_LENGTHS[element];
    if (maxLength === undefined) continue;
    // Compare the decoded value — an escaped ampersand is one character to the
    // schema and five in the serialised document.
    const value = raw
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&");
    if (value.length <= maxLength) continue;
    const key = element + ":" + value;
    if (seen.has(key)) continue;
    seen.add(key);
    findings.push({ element, length: value.length, maxLength, value });
  }

  return findings;
}
