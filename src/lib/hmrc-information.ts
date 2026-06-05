import { HMRC_CONFIG } from "./hmrc-config";

/** Trade Test sandbox = Information API v1.0; production CDS Live = v2.0 (CDS E2E guide). */
export function informationAcceptHeader(): string {
  if (process.env.HMRC_INFORMATION_ACCEPT) {
    return process.env.HMRC_INFORMATION_ACCEPT;
  }
  return process.env.HMRC_ENVIRONMENT === "sandbox"
    ? HMRC_CONFIG.accept.v1Xml
    : HMRC_CONFIG.accept.v2Xml;
}

export function parseDeclarationStatusXml(xml: string) {
  const tag = (name: string) => {
    const m = xml.match(new RegExp(`<(?:[a-zA-Z0-9]+:)?${name}>([^<]*)</(?:[a-zA-Z0-9]+:)?${name}>`));
    return m?.[1];
  };

  return {
    mrn: tag("ID"),
    versionId: tag("VersionID"),
    ics: tag("ICS"),
    roe: tag("ROE"),
    acceptanceDateTime: tag("DateTimeString"),
    typeCode: tag("TypeCode"),
    functionCode: tag("FunctionCode"),
    submitterId: tag("ID"),
  };
}
