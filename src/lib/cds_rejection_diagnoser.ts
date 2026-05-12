import { CDS_H1_DATA_ELEMENTS } from "../../convex/lib/cds_h1_data_elements";
import { CDS_WCO_REFERENCES } from "../../convex/lib/cds_wco_references";
import { CDS_ERROR_CODES } from "./cds_error_codes";

type ErrorCodeInfo = { description: string; explanation: string };

export interface CdsFunctionalError {
  field?: string;
  code?: string;
  reason?: string;
  pointerChain?: Array<{ documentSectionCode?: string; tagId?: string; sequenceNumeric?: string }>;
}

export interface CdsRejectionDiagnosis {
  ruleCode: string;
  ruleMeaning: string;
  ruleExplanation: string;
  pointer: string;
  pathResolved: string;
  fieldHumanName: string;
  dataElement: string;
  tcmRow?: number;
  wcoId?: string;
  wcoElementName?: string;
  reason: string;
}

function normalisePath(path: string): string {
  return path.replace(/\s*\/\s*/g, "/").replace(/\s+/g, " ").trim();
}

function codeInfo(code?: string): ErrorCodeInfo {
  if (!code) return { description: "", explanation: "" };
  return (CDS_ERROR_CODES as Record<string, ErrorCodeInfo>)[code] || {
    description: code,
    explanation: "",
  };
}

function containsToken(haystack: string, token: string): boolean {
  if (!token) return false;
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Z0-9])${escaped}(?=$|[^A-Z0-9])`, "i").test(haystack);
}

function resolveWcoReference(pointer: string) {
  const upper = pointer.toUpperCase();
  const matches = CDS_WCO_REFERENCES
    .filter((ref) => ref.wcoId && ref.wcoPath && containsToken(upper, ref.wcoId.toUpperCase()))
    .map((ref) => ({
      ref,
      pos: upper.lastIndexOf(ref.wcoId.toUpperCase()),
      pathDepth: normalisePath(ref.wcoPath).split("/").length,
    }))
    .sort((a, b) => a.pos - b.pos || a.pathDepth - b.pathDepth);

  return matches.at(-1)?.ref;
}

function resolveWcoReferenceFromChain(chain?: CdsFunctionalError["pointerChain"]) {
  if (!chain?.length) return undefined;

  let currentPath = "";
  let currentRef: (typeof CDS_WCO_REFERENCES)[number] | undefined;

  for (const pointer of chain) {
    const ids = [pointer.documentSectionCode, pointer.tagId].filter(Boolean) as string[];
    for (const id of ids) {
      const candidates = CDS_WCO_REFERENCES
        .filter((ref) => ref.wcoId.toUpperCase() === id.toUpperCase() && ref.wcoPath)
        .filter((ref) => !currentPath || normalisePath(ref.wcoPath).startsWith(currentPath))
        .map((ref) => ({
          ref,
          depth: normalisePath(ref.wcoPath).split("/").length,
        }))
        .sort((a, b) => a.depth - b.depth);

      const next = candidates[0]?.ref;
      if (next) {
        currentRef = next;
        currentPath = normalisePath(next.wcoPath);
      }
    }
  }

  return currentRef;
}

function resolveH1DataElement(path: string) {
  const resolvedPath = normalisePath(path);
  if (!resolvedPath) return undefined;

  return CDS_H1_DATA_ELEMENTS.find((element) => {
    const elementPath = normalisePath(element.wcoPath);
    return elementPath === resolvedPath;
  }) || CDS_H1_DATA_ELEMENTS.find((element) => {
    const elementPath = normalisePath(element.wcoPath);
    return elementPath.includes(resolvedPath) || resolvedPath.startsWith(elementPath);
  });
}

export function diagnoseCdsFunctionalError(error: CdsFunctionalError): CdsRejectionDiagnosis {
  const pointer = error.field || "";
  const code = error.code || "";
  const info = codeInfo(code);
  const wco = resolveWcoReferenceFromChain(error.pointerChain) || resolveWcoReference(pointer);
  const pathResolved = wco ? normalisePath(wco.wcoPath) : "";
  const dataElement = resolveH1DataElement(pathResolved);

  return {
    ruleCode: code,
    ruleMeaning: info.description,
    ruleExplanation: info.explanation,
    pointer,
    pathResolved,
    fieldHumanName: dataElement?.name || wco?.elementName?.replace(/^~+/, "") || pointer || "Declaration",
    dataElement: dataElement?.ucc || "",
    tcmRow: dataElement?.tcmRow,
    wcoId: wco?.wcoId,
    wcoElementName: wco?.elementName?.replace(/^~+/, ""),
    reason: error.reason || info.description || code,
  };
}

export function diagnoseCdsFieldErrors(errors: CdsFunctionalError[]): CdsRejectionDiagnosis[] {
  return errors.map(diagnoseCdsFunctionalError);
}

export function extractCdsFunctionalErrors(rawPayload: string): CdsFunctionalError[] {
  const errors: CdsFunctionalError[] = [];
  const functionalErrorRegex = /<(?:[^>]*:)?FunctionalError[^>]*>([\s\S]*?)<\/(?:[^>]*:)?FunctionalError>/gi;
  let errMatch: RegExpExecArray | null;

  while ((errMatch = functionalErrorRegex.exec(rawPayload)) !== null) {
    const block = errMatch[1];
    errors.push({
      field: block.match(/<(?:[^>]*:)?ErrorPointer[^>]*>([^<]+)<\/(?:[^>]*:)?ErrorPointer>/i)?.[1]?.trim(),
      code: block.match(/<(?:[^>]*:)?ErrorCode[^>]*>([^<]+)<\/(?:[^>]*:)?ErrorCode>/i)?.[1]?.trim(),
      reason: block.match(/<(?:[^>]*:)?ErrorReason[^>]*>([^<]+)<\/(?:[^>]*:)?ErrorReason>/i)?.[1]?.trim(),
    });
  }

  const responseErrorRegex = /<(?:[^>]*:)?Error[^>]*>([\s\S]*?)<\/(?:[^>]*:)?Error>/gi;
  while ((errMatch = responseErrorRegex.exec(rawPayload)) !== null) {
    const block = errMatch[1];
    const code = block.match(/<(?:[^>]*:)?ValidationCode[^>]*>([^<]+)<\/(?:[^>]*:)?ValidationCode>/i)?.[1]?.trim();
    if (!code) continue;

    const pointerChain: CdsFunctionalError["pointerChain"] = [];
    const pointerRegex = /<(?:[^>]*:)?Pointer[^>]*>([\s\S]*?)<\/(?:[^>]*:)?Pointer>/gi;
    let pointerMatch: RegExpExecArray | null;
    while ((pointerMatch = pointerRegex.exec(block)) !== null) {
      const pointerBlock = pointerMatch[1];
      pointerChain.push({
        documentSectionCode: pointerBlock.match(/<(?:[^>]*:)?DocumentSectionCode[^>]*>([^<]+)<\/(?:[^>]*:)?DocumentSectionCode>/i)?.[1]?.trim(),
        tagId: pointerBlock.match(/<(?:[^>]*:)?TagID[^>]*>([^<]+)<\/(?:[^>]*:)?TagID>/i)?.[1]?.trim(),
        sequenceNumeric: pointerBlock.match(/<(?:[^>]*:)?SequenceNumeric[^>]*>([^<]+)<\/(?:[^>]*:)?SequenceNumeric>/i)?.[1]?.trim(),
      });
    }

    const field = pointerChain
      .map((pointer) => [pointer.sequenceNumeric ? `#${pointer.sequenceNumeric}` : "", pointer.documentSectionCode, pointer.tagId].filter(Boolean).join(":"))
      .filter(Boolean)
      .join(" > ");

    errors.push({ code, field, pointerChain });
  }

  return errors;
}

export function diagnoseCdsRejectionXml(rawPayload: string): CdsRejectionDiagnosis[] {
  return diagnoseCdsFieldErrors(extractCdsFunctionalErrors(rawPayload));
}
