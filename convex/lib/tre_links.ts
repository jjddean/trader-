/** Build links only from declarations already restricted to the active tenant. */
export function buildTenantDeclarationMrnLinks(
  declarations: Array<{ _id: unknown; mrn?: unknown }>,
): Map<string, string> {
  const links = new Map<string, string>();

  for (const declaration of declarations) {
    const mrn = String(declaration.mrn ?? "").trim();
    if (mrn && !links.has(mrn)) {
      links.set(mrn, String(declaration._id));
    }
  }

  return links;
}
