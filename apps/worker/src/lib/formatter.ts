import { createHash } from "node:crypto";
import type { DeadlineSignal, TruthLayerResult } from "./truth-layer.ts";

export type FormatterInput = {
  caseId: string;
  extractionId: string;
  truth: TruthLayerResult;
};

export type FormatterOutput = {
  llmModel: string;
  inputHash: string;
  plainEnglishExplanation: string;
  nonLegalAdviceDisclaimer: string;
  outputJson: Record<string, unknown>;
};

export interface CaseFormatter {
  format(input: FormatterInput): Promise<FormatterOutput>;
}

function humanDocumentLabel(documentType: string): string {
  const map: Record<string, string> = {
    summons_complaint: "a court summons or complaint",
    eviction_notice: "an eviction notice",
    debt_collection_notice: "a debt collection notice",
    court_hearing_notice: "a court hearing notice",
    citation_ticket: "a citation or ticket",
    general_legal_notice: "a legal notice",
    unknown_legal_document: "a legal document"
  };
  return map[documentType] ?? "a legal document";
}

function escalationSignal(documentType: string, timeSensitive: boolean): {
  recommended: boolean;
  reason: string;
} {
  if (documentType === "summons_complaint" || documentType === "court_hearing_notice") {
    return {
      recommended: true,
      reason: "Court-related documents often benefit from timely legal review."
    };
  }

  if (documentType === "eviction_notice" && timeSensitive) {
    return {
      recommended: true,
      reason: "Eviction timelines can move quickly and may affect housing stability."
    };
  }

  return {
    recommended: false,
    reason: "No immediate escalation signal was detected from structured facts."
  };
}

function evidenceChecklist(documentType: string): string[] {
  const common = [
    "A complete copy of the document and envelope/postmark if available.",
    "Any prior notices or related messages (mail, email, text).",
    "Timeline notes: when you received each communication."
  ];

  const specific: Record<string, string[]> = {
    summons_complaint: [
      "Any contract or agreement related to the dispute.",
      "Proof of service details (date, time, method)."
    ],
    eviction_notice: [
      "Lease agreement and payment records.",
      "Photos or maintenance records if conditions are relevant."
    ],
    debt_collection_notice: [
      "Account statements and payment history.",
      "Any dispute letters sent to collector/creditor."
    ],
    court_hearing_notice: [
      "Calendar proof and transport/planning notes for hearing attendance.",
      "Prior filings, notices, or correspondence from the court."
    ],
    citation_ticket: [
      "Citation copy and related photos/videos.",
      "Witness details and location/time context."
    ]
  };

  return [...common, ...(specific[documentType] ?? [])];
}

function uncertaintyNotes(truth: TruthLayerResult): string[] {
  const notes: string[] = [];

  if (truth.classificationConfidence < 0.7) {
    notes.push("Document classification confidence is moderate or low.");
  }

  if (!truth.earliestDeadlineIso) {
    notes.push("No explicit calendar date was detected in the extracted text.");
  }

  if (truth.matchedKeywords.length === 0) {
    notes.push("Classification was inferred from general legal-language patterns.");
  }

  if (notes.length === 0) {
    notes.push("No major uncertainty flags were detected in this formatting pass.");
  }

  return notes;
}

function deadlineSummary(truth: TruthLayerResult): string {
  if (truth.earliestDeadlineIso) {
    return `Earliest detected date: ${truth.earliestDeadlineIso}.`;
  }

  if (truth.timeSensitive) {
    return "Time-sensitive language was detected, but no exact date was extracted.";
  }

  return "No deadline signal was detected from current structured facts.";
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(",")}}`;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function receiptSignals(signals: DeadlineSignal[]): Array<Record<string, unknown>> {
  return signals.map((signal) => ({
    kind: signal.kind,
    sourceText: signal.sourceText,
    confidence: signal.confidence,
    dateIso: signal.dateIso ?? null,
    daysFromExtraction: signal.daysFromExtraction ?? null
  }));
}

class DeterministicStructuredFormatter implements CaseFormatter {
  async format(input: FormatterInput): Promise<FormatterOutput> {
    const label = humanDocumentLabel(input.truth.documentType);
    const escalation = escalationSignal(input.truth.documentType, input.truth.timeSensitive);
    const disclaimer =
      "ClearCase provides legal information, not legal advice. Consider a licensed attorney for advice about your specific situation.";

    const plainEnglishExplanation = [
      `This document appears to be ${label}.`,
      deadlineSummary(input.truth),
      escalation.reason,
      "This summary is informational and based only on extracted structured facts."
    ].join(" ");

    const outputJson: Record<string, unknown> = {
      version: "v1",
      generatedBy: "deterministic_structured_formatter_stub",
      tone: "calm_non_alarming",
      summary: plainEnglishExplanation,
      whatThisUsuallyMeans: [
        `People receiving ${label} usually need to track dates and keep copies of all related records.`,
        "The next practical step is to organize documents and verify facts before responding."
      ],
      deadlines: {
        timeSensitive: input.truth.timeSensitive,
        earliestDeadlineIso: input.truth.earliestDeadlineIso,
        signals: receiptSignals(input.truth.deadlineSignals)
      },
      evidenceToGather: evidenceChecklist(input.truth.documentType),
      escalationSignal: escalation,
      uncertainty: {
        classificationConfidence: input.truth.classificationConfidence,
        notes: uncertaintyNotes(input.truth)
      },
      receipts: {
        caseId: input.caseId,
        extractionId: input.extractionId,
        documentType: input.truth.documentType,
        matchedKeywords: input.truth.matchedKeywords,
        deadlineSignals: receiptSignals(input.truth.deadlineSignals)
      },
      disclaimer
    };

    const inputForHash = {
      caseId: input.caseId,
      extractionId: input.extractionId,
      truth: input.truth.facts
    };

    return {
      llmModel: "deterministic-formatter-v1",
      inputHash: sha256Hex(stableJson(inputForHash)),
      plainEnglishExplanation,
      nonLegalAdviceDisclaimer: disclaimer,
      outputJson
    };
  }
}

export function createCaseFormatter(): CaseFormatter {
  const provider = process.env.LLM_PROVIDER?.trim() ?? "stub";

  if (provider === "stub") {
    return new DeterministicStructuredFormatter();
  }

  throw new Error(
    `Unsupported LLM_PROVIDER='${provider}'. Only LLM_PROVIDER=stub is currently implemented.`
  );
}
