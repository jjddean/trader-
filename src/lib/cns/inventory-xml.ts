/**
 * Inventory-linked XML handling.
 *
 * There is exactly one CDS XML builder in this codebase (wco-mapper →
 * h1-xml-renderer) and CNS accepts the same DMS/WCO payload it forwards to CDS.
 * Nothing here builds a parallel XML model — it adds the inventory reference and
 * asserts the invariants CNS enforces before forwarding.
 */

/**
 * Trim and upper-case without altering internal characters (spec §11.1).
 * Defined locally rather than imported from ./routing so this module — which the
 * XML mapper depends on — stays free of environment-reading config.
 */
export function normalizeUcn(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

/**
 * DE 2/1 previous document carrying the inventory reference.
 *
 * The declaration-side reference type is MCR. CNS calls the record a UCN; the
 * Declaration API v1.0.3 nil/blank amendment example shows the same value
 * carried as GoodsShipment/PreviousDocument with CategoryCode Z, TypeCode MCR.
 *
 * Spec §7.2 requires this mapping be PROVEN by the first EUAT declaration rather
 * than assumed. It is isolated here so correcting it is a single-file change.
 */
export const INVENTORY_REFERENCE_CATEGORY_CODE = "Z";
export const INVENTORY_REFERENCE_TYPE_CODE = "MCR";

export interface InventoryPreviousDocument {
  CategoryCode: string;
  TypeCode: string;
  ID: string;
  LineNumeric: string;
}

export function buildInventoryPreviousDocument(ucn: unknown): InventoryPreviousDocument {
  const id = normalizeUcn(ucn);
  if (!id) {
    throw new Error("Cannot build inventory PreviousDocument without a UCN.");
  }
  return {
    CategoryCode: INVENTORY_REFERENCE_CATEGORY_CODE,
    TypeCode: INVENTORY_REFERENCE_TYPE_CODE,
    ID: id,
    LineNumeric: "1",
  };
}

/**
 * Hard gate (spec §7.4). CNS performs the arrival notification for an
 * inventory-linked import; a Goods Presentation message against such a
 * declaration is rejected with DMSREJ / CDS12015.
 *
 * The repository has no GPR feature today, so this assertion exists to keep it
 * that way for the CNS route rather than to fix a current defect.
 */
export function assertNoGoodsPresentation(xmlPayload: string): void {
  if (/<(?:[^>]*:)?TypeCode>\s*GPR\s*<\/(?:[^>]*:)?TypeCode>/i.test(xmlPayload)) {
    throw new Error(
      "Goods Presentation (GPR) messages must never be sent for a CNS inventory-linked declaration — CNS performs the arrival notification. CDS would reject this with DMSREJ/CDS12015.",
    );
  }
}

/**
 * Assert the generated XML actually carries the inventory reference and the
 * inventory-linked goods location before it leaves the building. Catches a
 * routing/mapping mismatch locally instead of burning a CNS pre-check.
 */
export function assertInventoryFieldsPresent(
  xmlPayload: string,
  ucn: unknown,
  goodsLocationCode: string,
): void {
  const expectedUcn = normalizeUcn(ucn);
  const failures: string[] = [];

  if (!expectedUcn) {
    failures.push("no UCN was supplied");
  } else if (!xmlPayload.includes(`<ID>${expectedUcn}</ID>`)) {
    failures.push(`the UCN ${expectedUcn} is not present as a PreviousDocument ID`);
  }

  if (!new RegExp(`<TypeCode>\\s*${INVENTORY_REFERENCE_TYPE_CODE}\\s*</TypeCode>`).test(xmlPayload)) {
    failures.push(`no PreviousDocument with TypeCode ${INVENTORY_REFERENCE_TYPE_CODE}`);
  }

  // DE 5/23 is rendered as the decomposed Appendix 16C code, so the
  // consolidated string never appears verbatim — check the coded identifier
  // (positions 5+), which is what lands in GoodsLocation/Name.
  const codedId = String(goodsLocationCode || "").trim().toUpperCase().slice(4);
  if (codedId && !xmlPayload.includes(`<Name>${codedId}</Name>`)) {
    failures.push(`goods location ${goodsLocationCode} is not present in GoodsLocation`);
  }

  if (failures.length > 0) {
    throw new Error(`Inventory-linked XML is incomplete: ${failures.join("; ")}.`);
  }
}

/**
 * Consignment fields the CSP pre-check compares against the inventory record.
 * Spec §7.3: treat UCN, container, package quantity, gross weight, badge and
 * goods location as a single fixture — never submit a generic declaration
 * against a UCN with mismatched consignment data.
 */
export interface InventoryFixture {
  ucn: string;
  containerNumber?: string;
  packageQuantity?: number;
  grossWeightKg?: number;
}

/**
 * Compare the declaration's consignment data against the selected inventory
 * record. Returns operator-facing warnings; the caller decides whether to block.
 * Deliberately advisory — CNS is the authority on what matches, and a false
 * block here would be worse than a pre-check rejection.
 */
export function compareAgainstInventoryFixture(
  declared: { containerNumber?: string; packageQuantity?: number; grossWeightKg?: number },
  fixture: InventoryFixture,
): string[] {
  const warnings: string[] = [];

  const declaredContainer = String(declared.containerNumber ?? "").trim().toUpperCase();
  const fixtureContainer = String(fixture.containerNumber ?? "").trim().toUpperCase();
  if (fixtureContainer && declaredContainer && declaredContainer !== fixtureContainer) {
    warnings.push(
      `Container ${declaredContainer} does not match inventory record ${fixtureContainer}.`,
    );
  }

  if (
    typeof fixture.packageQuantity === "number" &&
    typeof declared.packageQuantity === "number" &&
    declared.packageQuantity !== fixture.packageQuantity
  ) {
    warnings.push(
      `Package quantity ${declared.packageQuantity} does not match inventory record ${fixture.packageQuantity}.`,
    );
  }

  if (
    typeof fixture.grossWeightKg === "number" &&
    typeof declared.grossWeightKg === "number" &&
    Math.abs(declared.grossWeightKg - fixture.grossWeightKg) > 0.001
  ) {
    warnings.push(
      `Gross weight ${declared.grossWeightKg} does not match inventory record ${fixture.grossWeightKg}.`,
    );
  }

  return warnings;
}
