/**
 * UK Strategic Export Control List PDF → structured JSON.
 * Chunks by entry and clause; threshold text stays intact within clause chunks.
 */

const TOP_LEVEL_HEADER =
  /^((?:ML|PL)\d+[a-z]?|\d{1,2}[A-E]\d{3}[a-z]?)[\t ]+(.+)$/;

const ENTRY_CODE =
  /\b((?:ML|PL)\d+[a-z]?(?:\.\d+[a-z]?)*|\d{1,2}[A-E]\d{3}[a-z]?(?:\.\d+[a-z]?)*)\b/g;

const CLAUSE_SPLIT = /(?:^|\n)\s*([a-z])\.\s+/g;

const NOTE_BLOCK = /(?:^|\n)\s*(N\.B\.|Note(?:\s+\d+)?)\s*[:.]?\s*/gi;

const SEE_ALSO = /\b(?:SEE ALSO|See also)\s+([\d]{1,2}[A-E]\d{3}[a-z]?(?:\.\d+[a-z]?)*|ML\d+[a-z]?(?:\.\d+[a-z]?)*|PL\d+[a-z]?(?:\.\d+[a-z]?)*)/gi;

const SPECIFIED_IN =
  /\bspecified in\s+([\d]{1,2}[A-E]\d{3}[a-z]?(?:\.\d+[a-z]?)*|ML\d+[a-z]?(?:\.\d+[a-z]?)*|PL\d+[a-z]?(?:\.\d+[a-z]?)*|PL\d+[a-z]?\.[a-z]\.?)/gi;

/** @param {string} line */
function parseTopLevelHeader(line) {
  const trimmed = line.trim();
  const match = trimmed.match(TOP_LEVEL_HEADER);
  if (!match) return null;

  const code = match[1];
  const title = match[2].trim();

  if (/^[a-z]\.(\s|$)/i.test(title)) return null;
  if (/^Note(\s+\d+)?(\s|:)/i.test(title)) return null;
  if (/^Technical Notes/i.test(title)) return null;
  if (title.length < 8) return null;

  return { code, title };
}

/** @param {string} code */
function inferEntryType(code) {
  if (code.startsWith("ML")) return "military";
  if (code.startsWith("PL")) return "firearms";
  if (/^0[A-E]/.test(code)) return "radioactive";
  return "dual_use";
}

/** @param {string} code */
function inferCategory(code) {
  if (code.startsWith("ML")) return "ML";
  if (code.startsWith("PL")) return "PL";
  const match = code.match(/^(\d{1,2})/);
  return match ? match[1] : null;
}

/** @param {string} text @param {string} sourceCode */
function extractCrossRefs(text, sourceCode) {
  /** @type {{ targetEntryCode: string, relationType: string }[]} */
  const refs = [];
  const seen = new Set();

  for (const re of [SEE_ALSO, SPECIFIED_IN]) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(text)) !== null) {
      const target = match[1].replace(/\.$/, "");
      if (target === sourceCode || seen.has(target)) continue;
      seen.add(target);
      refs.push({
        targetEntryCode: target,
        relationType: re === SEE_ALSO ? "see_also" : "specified_in",
      });
    }
  }

  return refs;
}

/** @param {string} text */
function extractNotesAndExclusions(text) {
  /** @type {string[]} */
  const notes = [];
  /** @type {string[]} */
  const exclusions = [];

  const doesNotControl = text.match(
    /does not control:([\s\S]*?)(?=(?:\n\s*[a-z]\.\s)|$)/gi,
  );
  if (doesNotControl) {
    for (const block of doesNotControl) {
      exclusions.push(block.replace(/\s+/g, " ").trim());
    }
  }

  NOTE_BLOCK.lastIndex = 0;
  const parts = text.split(NOTE_BLOCK);
  for (let i = 1; i < parts.length; i += 2) {
    const label = parts[i];
    const body = (parts[i + 1] || "").split(/\n\s*[a-z]\.\s/)[0];
    const normalized = `${label}: ${body.replace(/\s+/g, " ").trim()}`.trim();
    if (normalized.length > 10) notes.push(normalized);
  }

  return { notes, exclusions };
}

/** @param {string} entryCode @param {string} fullText @param {number} pageStart @param {number} pageEnd */
function buildClauseChunks(entryCode, fullText, pageStart, pageEnd) {
  /** @type {{ chunkId: string, clausePath: string, text: string, pageStart: number, pageEnd: number }[]} */
  const chunks = [
    {
      chunkId: `${entryCode}_full`,
      clausePath: "",
      text: fullText,
      pageStart,
      pageEnd,
    },
  ];

  const matches = [...fullText.matchAll(/(?:^|\n)\s*([a-z])\.\s+/g)];
  if (matches.length === 0) return chunks;

  for (let i = 0; i < matches.length; i++) {
    const clauseLetter = matches[i][1];
    const start = matches[i].index ?? 0;
    const end =
      i + 1 < matches.length ? (matches[i + 1].index ?? fullText.length) : fullText.length;
    const clauseText = fullText.slice(start, end).trim();
    if (clauseText.length < 20) continue;

    chunks.push({
      chunkId: `${entryCode}_${clauseLetter}`,
      clausePath: clauseLetter,
      text: clauseText,
      pageStart,
      pageEnd,
    });
  }

  return chunks;
}

/**
 * @param {{ num: number, text: string }[]} pages
 */
export function parseControlListPages(pages) {
  /** @type {{ pageNum: number, line: string }[]} */
  const allLines = [];
  for (const page of pages) {
    for (const line of (page.text || "").split(/\r?\n/)) {
      allLines.push({ pageNum: page.num, line });
    }
  }

  /** @type {object[]} */
  const entries = [];
  /** @type {object | null} */
  let current = null;

  function flushEntry() {
    if (!current) return;

    const fullText = current.lines.join("\n").replace(/\s+/g, " ").trim();
    const { notes, exclusions } = extractNotesAndExclusions(fullText);
    const crossRefs = extractCrossRefs(fullText, current.entryCode);

    entries.push({
      entryCode: current.entryCode,
      entryType: inferEntryType(current.entryCode),
      category: inferCategory(current.entryCode),
      title: current.title,
      fullText,
      pageStart: current.pageStart,
      pageEnd: current.pageEnd,
      chunks: buildClauseChunks(
        current.entryCode,
        current.lines.join("\n").trim(),
        current.pageStart,
        current.pageEnd,
      ),
      notes,
      exclusions,
      crossRefs,
    });
    current = null;
  }

  for (const { pageNum, line } of allLines) {
    const header = parseTopLevelHeader(line);
    if (header) {
      flushEntry();
      current = {
        entryCode: header.code,
        title: header.title,
        lines: [line.trim()],
        pageStart: pageNum,
        pageEnd: pageNum,
      };
      continue;
    }

    if (current) {
      current.lines.push(line);
      current.pageEnd = pageNum;
    }
  }

  flushEntry();
  return entries;
}

/** @param {object[]} entries */
export function buildControlListDataset(entries, meta = {}) {
  return {
    version: meta.version ?? "2025-12-16",
    sourceRef: "UK Strategic Export Control List",
    govSourceUrl:
      "https://www.gov.uk/government/publications/uk-strategic-export-control-lists-the-consolidated-list-of-strategic-military-and-dual-use-items-that-require-export-authorisation",
    effectiveDate: meta.version ?? "2025-12-16",
    parsedAt: new Date().toISOString(),
    entryCount: entries.length,
    entries,
  };
}

/** @param {object[]} entries @param {string[]} requiredCodes */
export function verifyGoldenEntries(entries, requiredCodes) {
  const byCode = new Map(entries.map((e) => [e.entryCode, e]));
  /** @type {{ code: string, ok: boolean, reason?: string }[]} */
  const results = [];

  for (const code of requiredCodes) {
    const entry = byCode.get(code);
    if (!entry) {
      results.push({ code, ok: false, reason: "missing entry" });
      continue;
    }
    if (!entry.fullText || entry.fullText.length < 50) {
      results.push({ code, ok: false, reason: "fullText too short" });
      continue;
    }
    if (!entry.title) {
      results.push({ code, ok: false, reason: "missing title" });
      continue;
    }
    results.push({ code, ok: true });
  }

  return results;
}

export const GOLDEN_ENTRY_CODES = [
  "ML1",
  "ML5",
  "ML10",
  "0A001",
  "1A001",
  "2B001",
  "2D352",
  "3A001",
  "3D006",
  "4A003",
  "5A002",
  "6A002",
  "7A001",
  "8A002",
  "9A001",
  "9E003",
  "PL9010",
];
