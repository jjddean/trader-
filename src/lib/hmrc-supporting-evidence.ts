/**
 * HMRC supporting evidence — the documentary-check request and how it maps to
 * documents FreightCode already holds.
 *
 * Sources, retrieved 2026-08-23:
 * - Uploading supporting documents, HMRC Developer Hub
 *   https://developer.service.hmrc.gov.uk/guides/customs-declarations-end-to-end-service-guide/documentation/uploading-supporting-documents.html
 * - Send documents to support declarations for CDS, GOV.UK
 *   https://www.gov.uk/guidance/send-documents-to-support-declarations-for-the-customs-declaration-service
 * - WCO DEC-DMS reference mirrored at `convex/lib/cds_wco_references.ts`
 *
 * ## What DMSDOC actually carries
 *
 * A documentary check arrives as a DMSDOC notification. The request itself is
 * in `AdditionalInformation`, and the WCO reference states the discriminator
 * exactly:
 *
 * > StatementTypeCode — "DMSDOC: 'ACA' (document type to be presented for
 * > document control)"
 *
 * So **`ACA` is the StatementTypeCode that marks a block as a documentary
 * request — it is not the requested document type itself.** The request
 * content is in the sibling elements:
 *
 * | Element                | DE  | Format                | Carries |
 * |------------------------|-----|-----------------------|---------|
 * | `StatementTypeCode`    | —   | an..3                 | `ACA`, the marker |
 * | `StatementCode`        | 2/2 | an..17 header, an..5 item | The document code HMRC wants |
 * | `StatementDescription` | 2/2 | an..512               | Its description |
 *
 * `AdditionalInformation` occurs at two levels, and both are read here:
 *
 * - `Declaration/AdditionalInformation` — header, with an optional `Pointer`
 *   (`DocumentSectionCode` / `SequenceNumeric` / `TagID`) identifying the goods
 *   item it concerns.
 * - `Declaration/GoodsShipment/GovernmentAgencyGoodsItem/AdditionalInformation`
 *   — per goods item.
 *
 * ## What is deliberately not done
 *
 * No inference. If a block carries no `StatementCode`, it is surfaced with its
 * description and left unmatched rather than being guessed at, and matching is
 * never attempted on filename — see `matchRequestedEvidence`.
 */

/** A single document HMRC has asked to see. */
export interface DocumentaryRequestItem {
  /** DE 2/2 StatementCode — the document code HMRC named, when it gave one. */
  statementCode?: string;
  /** DE 2/2 StatementDescription — free text describing what is wanted. */
  description?: string;
  /** Goods item this concerns, from a header Pointer or the item's position. */
  goodsItemNumber?: number;
  /** Pointer detail from a header-level block, kept for the audit trail. */
  pointer?: { documentSectionCode?: string; sequenceNumeric?: number; tagID?: string };
  /** "header" | "item" — where in the message the request was found. */
  level: "header" | "item";
}

export interface DocumentaryRequest {
  mrn: string;
  items: DocumentaryRequestItem[];
  issueDateTime?: string;
}

/** StatementTypeCode that marks an AdditionalInformation block as a DMSDOC request. */
export const DOCUMENTARY_REQUEST_STATEMENT_TYPE = "ACA";

function tag(block: string, name: string): string | undefined {
  const m = block.match(
    new RegExp(`<(?:[^>]*:)?${name}[^>]*>([\\s\\S]*?)</(?:[^>]*:)?${name}>`, "i"),
  );
  const value = m?.[1]?.trim();
  return value ? value : undefined;
}

function parsePointer(block: string): DocumentaryRequestItem["pointer"] | undefined {
  const pointerBlock = block.match(
    /<(?:[^>]*:)?Pointer\b[^>]*>([\s\S]*?)<\/(?:[^>]*:)?Pointer>/i,
  )?.[1];
  if (!pointerBlock) return undefined;
  const sequence = tag(pointerBlock, "SequenceNumeric");
  return {
    documentSectionCode: tag(pointerBlock, "DocumentSectionCode"),
    sequenceNumeric: sequence ? Number(sequence) : undefined,
    tagID: tag(pointerBlock, "TagID"),
  };
}

function isDocumentaryBlock(block: string): boolean {
  return (
    tag(block, "StatementTypeCode")?.toUpperCase() === DOCUMENTARY_REQUEST_STATEMENT_TYPE
  );
}

/**
 * Extract the documentary-check request from a DMSDOC payload.
 *
 * Returns an empty item list for any notification that carries no `ACA` block,
 * including a DMSDOC with no detail — the caller then falls back to proactive
 * upload rather than inventing a request.
 */
export function parseDocumentaryRequest(rawPayload: string, mrn = ""): DocumentaryRequest {
  const items: DocumentaryRequestItem[] = [];

  // Goods-item blocks first, so their own sequence number is available.
  const itemRegex =
    /<(?:[^>]*:)?GovernmentAgencyGoodsItem\b[^>]*>([\s\S]*?)<\/(?:[^>]*:)?GovernmentAgencyGoodsItem>/gi;
  let itemMatch: RegExpExecArray | null;
  const consumed: string[] = [];

  while ((itemMatch = itemRegex.exec(rawPayload)) !== null) {
    const itemBlock = itemMatch[1];
    consumed.push(itemMatch[0]);
    const sequence = tag(itemBlock, "SequenceNumeric");
    const goodsItemNumber = sequence ? Number(sequence) : undefined;

    const aiRegex =
      /<(?:[^>]*:)?AdditionalInformation\b[^>]*>([\s\S]*?)<\/(?:[^>]*:)?AdditionalInformation>/gi;
    let aiMatch: RegExpExecArray | null;
    while ((aiMatch = aiRegex.exec(itemBlock)) !== null) {
      const block = aiMatch[1];
      if (!isDocumentaryBlock(block)) continue;
      items.push({
        statementCode: tag(block, "StatementCode"),
        description: tag(block, "StatementDescription"),
        goodsItemNumber,
        level: "item",
      });
    }
  }

  // Header blocks — everything outside the goods items already scanned.
  let header = rawPayload;
  for (const block of consumed) header = header.replace(block, "");

  const headerAiRegex =
    /<(?:[^>]*:)?AdditionalInformation\b[^>]*>([\s\S]*?)<\/(?:[^>]*:)?AdditionalInformation>/gi;
  let headerMatch: RegExpExecArray | null;
  while ((headerMatch = headerAiRegex.exec(header)) !== null) {
    const block = headerMatch[1];
    if (!isDocumentaryBlock(block)) continue;
    const pointer = parsePointer(block);
    items.push({
      statementCode: tag(block, "StatementCode"),
      description: tag(block, "StatementDescription"),
      goodsItemNumber: pointer?.sequenceNumeric,
      pointer,
      level: "header",
    });
  }

  return { mrn, items };
}

/** A DE 2/3 supporting-document reference already recorded on the declaration. */
export interface DeclarationSupportingDocument {
  /** DE 2/3 document code, e.g. N935. */
  code?: string;
  /** DE 2/3 document identifier — the invoice or licence number. */
  reference?: string;
  name?: string;
  goodsItemNumber?: number;
  /** FreightCode document row already linked to this requirement, if any. */
  linkedDocumentId?: string;
  linkedFileName?: string;
}

export interface MatchedEvidence {
  request: DocumentaryRequestItem;
  /** The DE 2/3 record this request corresponds to, when it can be established. */
  supportingDocument?: DeclarationSupportingDocument;
  /** The FreightCode document already held against that record, when there is one. */
  documentId?: string;
  fileName?: string;
  /** How the correlation was reached. `unmatched` means the user must attach. */
  matchedBy: "document_code" | "document_code_and_item" | "description" | "unmatched";
}

function normaliseCode(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * Correlate HMRC's request to the declaration's own supporting-document data.
 *
 * The chain is:
 *
 *   DMSDOC request → StatementCode → DE 2/3 document code → linked document
 *
 * Filename is never used. A file called `invoice.pdf` is not evidence that it
 * satisfies a request for N935, and a wrong correlation sends HMRC the wrong
 * document under the right heading.
 *
 * Description matching is the last resort and only fires on an exact,
 * case-insensitive match of the whole description against a recorded document
 * name — a partial or fuzzy match would be a guess.
 */
export function matchRequestedEvidence(
  requests: DocumentaryRequestItem[],
  supporting: DeclarationSupportingDocument[],
): MatchedEvidence[] {
  return requests.map((request) => {
    const code = normaliseCode(request.statementCode);

    if (code) {
      // Prefer a record on the same goods item — a code can repeat across items.
      const onSameItem = supporting.find(
        (s) =>
          normaliseCode(s.code) === code &&
          request.goodsItemNumber !== undefined &&
          s.goodsItemNumber === request.goodsItemNumber,
      );
      if (onSameItem) {
        return {
          request,
          supportingDocument: onSameItem,
          documentId: onSameItem.linkedDocumentId,
          fileName: onSameItem.linkedFileName,
          matchedBy: "document_code_and_item",
        };
      }

      const byCode = supporting.filter((s) => normaliseCode(s.code) === code);
      // Ambiguity is not a match: two records with the same code and no item
      // number to separate them cannot be told apart.
      if (byCode.length === 1) {
        return {
          request,
          supportingDocument: byCode[0],
          documentId: byCode[0].linkedDocumentId,
          fileName: byCode[0].linkedFileName,
          matchedBy: "document_code",
        };
      }
    }

    const description = String(request.description ?? "").trim().toLowerCase();
    if (description) {
      const byName = supporting.filter(
        (s) => String(s.name ?? "").trim().toLowerCase() === description,
      );
      if (byName.length === 1) {
        return {
          request,
          supportingDocument: byName[0],
          documentId: byName[0].linkedDocumentId,
          fileName: byName[0].linkedFileName,
          matchedBy: "description",
        };
      }
    }

    return { request, matchedBy: "unmatched" };
  });
}

/**
 * The `DocumentType` to send for a file, or `undefined` to omit the element.
 *
 * HMRC's specification makes `DocumentType` **optional** and publishes no
 * enumerated list of values — `Licence` appears only as an example. So:
 *
 * - When HMRC named the document in its own request, echo that back. It is
 *   HMRC's own vocabulary, which is the only vocabulary known to be acceptable.
 * - When the user picked a document type explicitly, use it.
 * - Otherwise omit the element. Sending `"invoice"` for a certificate of origin
 *   is worse than sending nothing, and CDS document codes such as `N935` are
 *   **not** valid here: the file-upload specification never defines that
 *   mapping, and DE 2/3 codes belong on the declaration, not in this message.
 */
export function resolveDocumentType(input: {
  /** What the user chose, if the UI offered a choice. */
  selected?: string;
  /** StatementDescription from the DMSDOC request this file answers. */
  requestDescription?: string;
}): string | undefined {
  const selected = String(input.selected ?? "").trim();
  if (selected) return selected;

  const fromRequest = String(input.requestDescription ?? "").trim();
  if (fromRequest) return fromRequest;

  return undefined;
}
