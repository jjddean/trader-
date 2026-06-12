export { informationAcceptHeader } from "./hmrc-config";

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
