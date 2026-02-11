type TruthLayerInput = {
  caseId: string;
  assetId: string;
  extractionId: string;
  extractionEngine: string;
  extractionCreatedAt: Date;
  rawText: string;
  structuredFacts: unknown;
};

type DocumentRule = {
  documentType: string;
  keywords: string[];
};

export type DeadlineSignal = {
  kind: "absolute_date" | "relative_days" | "urgent_phrase";
  sourceText: string;
  confidence: number;
  dateIso?: string;
  daysFromExtraction?: number;
};

export type TruthLayerResult = {
  documentType: string;
  classificationConfidence: number;
  matchedKeywords: string[];
  timeSensitive: boolean;
  earliestDeadlineIso: string | null;
  deadlineSignals: DeadlineSignal[];
  facts: Record<string, unknown>;
};

const DOCUMENT_RULES: DocumentRule[] = [
  {
    documentType: "summons_complaint",
    keywords: ["summons", "complaint", "plaintiff", "defendant", "served"]
  },
  {
    documentType: "eviction_notice",
    keywords: ["eviction", "notice to vacate", "pay or quit", "landlord", "tenant"]
  },
  {
    documentType: "debt_collection_notice",
    keywords: ["debt", "collector", "collection", "creditor", "amount due", "validation notice"]
  },
  {
    documentType: "court_hearing_notice",
    keywords: ["hearing", "court date", "appearance", "courtroom", "docket"]
  },
  {
    documentType: "citation_ticket",
    keywords: ["citation", "ticket", "violation", "fine", "infraction"]
  }
];

const MONTH_NAMES = new Map<string, number>([
  ["january", 1],
  ["february", 2],
  ["march", 3],
  ["april", 4],
  ["may", 5],
  ["june", 6],
  ["july", 7],
  ["august", 8],
  ["september", 9],
  ["october", 10],
  ["november", 11],
  ["december", 12]
]);

function normalizeText(input: string): string {
  return input.replace(/\s+/g, " ").trim().toLowerCase();
}

function collectTextFragments(value: unknown, fragments: string[]): void {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) {
      fragments.push(trimmed);
    }
    return;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    fragments.push(String(value));
    return;
  }

  if (!value) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectTextFragments(item, fragments);
    }
    return;
  }

  if (typeof value === "object") {
    for (const nestedValue of Object.values(value as Record<string, unknown>)) {
      collectTextFragments(nestedValue, fragments);
    }
  }
}

function utcDate(year: number, month: number, day: number): Date | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const candidate = new Date(Date.UTC(year, month - 1, day));
  const valid =
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day;

  return valid ? candidate : null;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toStartOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDaysUtc(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function diffDaysUtc(start: Date, end: Date): number {
  const a = toStartOfUtcDay(start).getTime();
  const b = toStartOfUtcDay(end).getTime();
  return Math.floor((b - a) / (24 * 60 * 60 * 1000));
}

function uniqueByDate(signals: DeadlineSignal[]): DeadlineSignal[] {
  const seen = new Set<string>();
  const deduped: DeadlineSignal[] = [];

  for (const signal of signals) {
    const key = `${signal.kind}:${signal.dateIso ?? "none"}:${signal.sourceText.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(signal);
  }

  return deduped;
}

function extractAbsoluteDateSignals(text: string): DeadlineSignal[] {
  const signals: DeadlineSignal[] = [];

  const isoPattern = /\b(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/g;
  for (const match of text.matchAll(isoPattern)) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = utcDate(year, month, day);
    if (!parsed) {
      continue;
    }

    signals.push({
      kind: "absolute_date",
      sourceText: match[0],
      confidence: 0.92,
      dateIso: toIsoDate(parsed)
    });
  }

  const slashPattern = /\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12]\d|3[01])[\/\-](20\d{2})\b/g;
  for (const match of text.matchAll(slashPattern)) {
    const month = Number(match[1]);
    const day = Number(match[2]);
    const year = Number(match[3]);
    const parsed = utcDate(year, month, day);
    if (!parsed) {
      continue;
    }

    signals.push({
      kind: "absolute_date",
      sourceText: match[0],
      confidence: 0.88,
      dateIso: toIsoDate(parsed)
    });
  }

  const monthNamePattern =
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+([0-3]?\d),?\s+(20\d{2})\b/g;
  for (const match of text.matchAll(monthNamePattern)) {
    const month = MONTH_NAMES.get(match[1].toLowerCase());
    const day = Number(match[2]);
    const year = Number(match[3]);
    if (!month) {
      continue;
    }

    const parsed = utcDate(year, month, day);
    if (!parsed) {
      continue;
    }

    signals.push({
      kind: "absolute_date",
      sourceText: match[0],
      confidence: 0.86,
      dateIso: toIsoDate(parsed)
    });
  }

  return uniqueByDate(signals);
}

function extractRelativeDaySignals(text: string, extractionCreatedAt: Date): DeadlineSignal[] {
  const signals: DeadlineSignal[] = [];
  const base = toStartOfUtcDay(extractionCreatedAt);
  const relativePatterns = [
    /\bwithin\s+(\d{1,3})\s+days?\b/g,
    /\b(?:in|after)\s+(\d{1,3})\s+days?\b/g
  ];

  for (const pattern of relativePatterns) {
    for (const match of text.matchAll(pattern)) {
      const days = Number(match[1]);
      if (!Number.isInteger(days) || days < 0 || days > 365) {
        continue;
      }

      const date = addDaysUtc(base, days);
      signals.push({
        kind: "relative_days",
        sourceText: match[0],
        confidence: 0.7,
        dateIso: toIsoDate(date),
        daysFromExtraction: days
      });
    }
  }

  return uniqueByDate(signals);
}

function extractUrgentSignals(text: string): DeadlineSignal[] {
  const urgentPhrases = [
    "urgent",
    "immediately",
    "final notice",
    "court date",
    "hearing",
    "deadline",
    "respond by",
    "pay or quit"
  ];

  const matches: DeadlineSignal[] = [];
  for (const phrase of urgentPhrases) {
    if (!text.includes(phrase)) {
      continue;
    }
    matches.push({
      kind: "urgent_phrase",
      sourceText: phrase,
      confidence: 0.6
    });
  }

  return matches;
}

function chooseDocumentType(text: string): {
  documentType: string;
  confidence: number;
  matchedKeywords: string[];
} {
  let bestType = "unknown_legal_document";
  let bestMatches: string[] = [];

  for (const rule of DOCUMENT_RULES) {
    const matches = rule.keywords.filter((keyword) => text.includes(keyword));
    if (matches.length > bestMatches.length) {
      bestMatches = matches;
      bestType = rule.documentType;
    }
  }

  if (bestMatches.length === 0) {
    if (text.includes("notice") || text.includes("court")) {
      return {
        documentType: "general_legal_notice",
        confidence: 0.55,
        matchedKeywords: []
      };
    }
    return {
      documentType: bestType,
      confidence: 0.4,
      matchedKeywords: []
    };
  }

  const confidence = Math.min(0.95, 0.6 + bestMatches.length * 0.08);
  return {
    documentType: bestType,
    confidence,
    matchedKeywords: bestMatches
  };
}

function earliestDeadlineIso(signals: DeadlineSignal[]): string | null {
  const datedSignals = signals
    .map((signal) => signal.dateIso)
    .filter((value): value is string => typeof value === "string");

  if (datedSignals.length === 0) {
    return null;
  }

  datedSignals.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return datedSignals[0];
}

export function buildTruthLayerResult(input: TruthLayerInput): TruthLayerResult {
  const fragments: string[] = [];
  collectTextFragments(input.structuredFacts, fragments);

  const combinedText = normalizeText([input.rawText, ...fragments].join("\n"));
  const docType = chooseDocumentType(combinedText);

  const absoluteDateSignals = extractAbsoluteDateSignals(combinedText);
  const relativeDateSignals = extractRelativeDaySignals(combinedText, input.extractionCreatedAt);
  const urgentSignals = extractUrgentSignals(combinedText);
  const deadlineSignals = [...absoluteDateSignals, ...relativeDateSignals, ...urgentSignals];
  const earliest = earliestDeadlineIso(deadlineSignals);

  let timeSensitive = urgentSignals.length > 0;
  if (earliest) {
    const parsed = utcDate(
      Number(earliest.slice(0, 4)),
      Number(earliest.slice(5, 7)),
      Number(earliest.slice(8, 10))
    );

    if (parsed) {
      const daysUntil = diffDaysUtc(input.extractionCreatedAt, parsed);
      if (daysUntil <= 45) {
        timeSensitive = true;
      }
    }
  }

  return {
    documentType: docType.documentType,
    classificationConfidence: docType.confidence,
    matchedKeywords: docType.matchedKeywords,
    timeSensitive,
    earliestDeadlineIso: earliest,
    deadlineSignals,
    facts: {
      truthLayerVersion: "v1",
      source: "deterministic_truth_layer",
      sourceCaseId: input.caseId,
      sourceAssetId: input.assetId,
      sourceExtractionId: input.extractionId,
      sourceExtractionEngine: input.extractionEngine,
      extractionCreatedAt: input.extractionCreatedAt.toISOString(),
      documentType: docType.documentType,
      classificationConfidence: docType.confidence,
      matchedKeywords: docType.matchedKeywords,
      timeSensitive,
      earliestDeadlineIso: earliest,
      deadlineSignals
    }
  };
}
