import { commodityRequiresSupplementaryUnit, validateOverseasExporter, validateTradeTerms, validateTransactionNatureCode } from "./wco-mapper";
import { validateGoodsLocationForSubmit } from "./goods-location";
import { validateGoodsItemSequences } from "./submit-goods-items";

export const DECLARATION_INCOMPLETE_ERROR = "Declaration incomplete";

type H1SubmitLane = {
  eori?: string;
  dispatchCountry?: string;
  destinationCountry?: string;
  locationId?: string;
  goodsLocationKind?: string;
  goodsLocationTypeCode?: string;
  goodsLocationQualifier?: string;
  transportMode?: string;
  transportId?: string;
  transportIdType?: string;
  invoiceCurrency?: string;
  exporterName?: string;
  exporterCity?: string;
  exporterLine?: string;
  exporterPostcode?: string;
  exporterEori?: string;
};

type H1SubmitItem = {
  commodityCode?: string;
  description?: string;
  originCountry?: string;
  procedureCode?: string;
  additionalProcedureCode?: string;
  valueAmount?: number | string;
  grossWeightKg?: number | string;
  supplementaryUnitQty?: number | string;
  packageType?: string;
  packageCount?: number | string;
};

export function validateDeclaration(lane: H1SubmitLane, items: H1SubmitItem[]) {
  const errors: string[] = [];
  if (!lane?.eori) errors.push("Missing declarant EORI");
  if (!lane?.dispatchCountry) errors.push("Missing dispatch country (DE 5/14)");
  if (!lane?.destinationCountry) errors.push("Missing destination country (DE 5/8)");
  errors.push(...validateGoodsLocationForSubmit(lane || {}));
  if (!lane?.transportMode) errors.push("Missing transport mode (DE 7/4)");
  if (!lane?.transportId) errors.push("Missing transport identity (DE 7/9)");
  if (!lane?.transportIdType) errors.push("Missing transport identity type (DE 7/7)");
  if (!lane?.invoiceCurrency) errors.push("Missing invoice currency");
  errors.push(...validateOverseasExporter(lane as Record<string, unknown>));
  errors.push(...validateTransactionNatureCode(lane as Record<string, unknown>));
  errors.push(...validateTradeTerms(lane as Record<string, unknown>));
  if (!Array.isArray(items) || items.length === 0) {
    errors.push("No goods items");
    return errors;
  }
  errors.push(...validateGoodsItemSequences(items));
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it?.commodityCode) errors.push(`Item ${i}: missing commodity code (DE 6/14)`);
    if (!it?.description) errors.push(`Item ${i}: missing description`);
    if (!it?.originCountry) errors.push(`Item ${i}: missing origin (DE 5/15)`);
    if (!it?.procedureCode) errors.push(`Item ${i}: missing CPC (DE 1/10)`);
    if (!it?.additionalProcedureCode) errors.push(`Item ${i}: missing additional procedure (DE 1/11)`);
    const v = parseFloat(String(it?.valueAmount ?? ""));
    if (!Number.isFinite(v) || v <= 0) errors.push(`Item ${i}: value must be > 0`);
    const g = parseFloat(String(it?.grossWeightKg ?? ""));
    if (!Number.isFinite(g) || g <= 0) errors.push(`Item ${i}: gross weight must be > 0`);
    if (!it?.packageType) errors.push(`Item ${i}: missing package type (DE 6/9)`);
    const pc = parseInt(String(it?.packageCount ?? ""));
    if (!Number.isFinite(pc) || pc < 1) errors.push(`Item ${i}: package count must be >= 1`);
    if (commodityRequiresSupplementaryUnit(it?.commodityCode)) {
      const su = parseFloat(String(it?.supplementaryUnitQty ?? ""));
      if (!Number.isFinite(su) || su <= 0) {
        errors.push(`Item ${i}: supplementary units (DE 6/2, p/st) required for commodity ${it.commodityCode}`);
      }
    }
  }
  return errors;
}

export function declarationIncompleteResponse(missing: string[]) {
  return { error: DECLARATION_INCOMPLETE_ERROR, missing };
}
