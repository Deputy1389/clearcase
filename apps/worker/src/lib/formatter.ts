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
    protective_order_notice: "a protective or restraining-order notice",
    family_court_notice: "a family-court notice",
    small_claims_complaint: "a small claims complaint",
    summons_complaint: "a court summons or complaint",
    subpoena_notice: "a subpoena notice",
    judgment_notice: "a court judgment notice",
    court_hearing_notice: "a court hearing notice",
    demand_letter: "a demand letter",
    eviction_notice: "an eviction notice",
    foreclosure_default_notice: "a foreclosure or mortgage-default notice",
    repossession_notice: "a repossession notice",
    landlord_security_deposit_notice: "a landlord security-deposit notice",
    lease_violation_notice: "a lease-violation notice",
    debt_collection_notice: "a debt collection notice",
    wage_garnishment_notice: "a wage garnishment notice",
    tax_notice: "a tax notice",
    unemployment_benefits_denial: "an unemployment-benefits denial notice",
    workers_comp_denial_notice: "a workers-compensation denial notice",
    benefits_overpayment_notice: "a benefits overpayment notice",
    insurance_denial_letter: "an insurance denial letter",
    insurance_subrogation_notice: "an insurance subrogation notice",
    incident_evidence_photo: "an incident evidence photo",
    utility_shutoff_notice: "a utility shutoff notice",
    license_suspension_notice: "a license suspension notice",
    citation_ticket: "a citation or ticket",
    general_legal_notice: "a legal notice",
    unknown_legal_document: "an unclear legal document",
    non_legal_or_unclear_image: "a non-legal or unclear image"
  };
  return map[documentType] ?? "an unclear legal document";
}

function escalationSignal(documentType: string, timeSensitive: boolean): {
  recommended: boolean;
  reason: string;
} {
  if (
    documentType === "summons_complaint" ||
    documentType === "small_claims_complaint" ||
    documentType === "subpoena_notice" ||
    documentType === "judgment_notice" ||
    documentType === "court_hearing_notice" ||
    documentType === "family_court_notice" ||
    documentType === "protective_order_notice"
  ) {
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

  if (documentType === "wage_garnishment_notice") {
    return {
      recommended: true,
      reason: "Wage garnishment notices can affect paychecks quickly and may have short response windows."
    };
  }

  if (documentType === "foreclosure_default_notice") {
    return {
      recommended: true,
      reason: "Foreclosure and default notices often include strict timelines tied to housing risk."
    };
  }

  if (documentType === "repossession_notice" || documentType === "utility_shutoff_notice") {
    return {
      recommended: true,
      reason: "This type of notice can quickly affect essential property or services."
    };
  }

  if (documentType === "license_suspension_notice") {
    return {
      recommended: true,
      reason: "License suspension notices often include strict procedural deadlines."
    };
  }

  if (
    (documentType === "tax_notice" ||
      documentType === "unemployment_benefits_denial" ||
      documentType === "workers_comp_denial_notice" ||
      documentType === "benefits_overpayment_notice") &&
    timeSensitive
  ) {
    return {
      recommended: true,
      reason: "Administrative notices can include short appeal or response windows."
    };
  }

  if (documentType === "insurance_denial_letter" && timeSensitive) {
    return {
      recommended: true,
      reason: "Insurance denial letters can include appeal windows that may expire quickly."
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
    incident_evidence_photo: [
      "Photos from multiple angles and distances to show full context.",
      "Date/time/location notes and any police or incident report numbers.",
      "Contact/insurance information for involved parties if available."
    ],
    protective_order_notice: [
      "The full order/notice with service details and hearing date.",
      "Any prior related court filings or incident reports."
    ],
    family_court_notice: [
      "Prior court orders, parenting plans, or support records.",
      "Calendar notes and documents tied to the scheduled proceeding."
    ],
    small_claims_complaint: [
      "Any invoices, contracts, receipts, or photos supporting your side of the claim.",
      "Proof of service and hearing/appearance details."
    ],
    summons_complaint: [
      "Any contract or agreement related to the dispute.",
      "Proof of service details (date, time, method)."
    ],
    subpoena_notice: [
      "The subpoena and any attached schedule/list of requested records.",
      "Records retention notes and timeline for response."
    ],
    judgment_notice: [
      "The judgment document and docket/case number details.",
      "Payment records or prior filings related to the judgment."
    ],
    court_hearing_notice: [
      "Calendar proof and transport/planning notes for hearing attendance.",
      "Prior filings, notices, or correspondence from the court."
    ],
    demand_letter: [
      "The full demand letter and any attachments.",
      "Records supporting your response position (payments, correspondence, contract terms)."
    ],
    eviction_notice: [
      "Lease agreement and payment records.",
      "Photos or maintenance records if conditions are relevant."
    ],
    foreclosure_default_notice: [
      "Mortgage statements and payment history.",
      "Notice of default/sale and any loan servicer correspondence."
    ],
    repossession_notice: [
      "Loan/financing agreement and account statements.",
      "Notice timing details and any cure/reinstatement terms."
    ],
    landlord_security_deposit_notice: [
      "Move-in/move-out photos and condition reports.",
      "Lease clauses and an itemized deposit deduction statement."
    ],
    lease_violation_notice: [
      "Lease sections referenced in the notice.",
      "Written communications showing cure steps or disputed facts."
    ],
    debt_collection_notice: [
      "Account statements and payment history.",
      "Any dispute letters sent to collector/creditor."
    ],
    wage_garnishment_notice: [
      "Employer withholding notice and pay stubs.",
      "Court order or creditor documentation tied to the garnishment."
    ],
    tax_notice: [
      "The full notice with tax period, amount, and stated deadline.",
      "Prior returns, payment confirmations, and related agency letters."
    ],
    unemployment_benefits_denial: [
      "Denial determination letter and cited reasons.",
      "Employment/pay records that support the claim."
    ],
    workers_comp_denial_notice: [
      "Claim denial letter and claim/incident numbers.",
      "Medical records and employer incident reports."
    ],
    benefits_overpayment_notice: [
      "Overpayment calculation notice and period covered.",
      "Records supporting waiver, repayment, or dispute position."
    ],
    insurance_denial_letter: [
      "Policy language and denial letter with cited exclusions.",
      "Claim file documents and any available appeal instructions."
    ],
    insurance_subrogation_notice: [
      "Subrogation demand and underlying incident documents.",
      "Insurance policy terms and prior claims communications."
    ],
    utility_shutoff_notice: [
      "The utility notice showing disconnect date and amount due.",
      "Billing/payment records and any prior hardship communications."
    ],
    license_suspension_notice: [
      "Suspension notice and basis for suspension.",
      "Any hearing request forms and prior DMV/court correspondence."
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

function confidenceBand(value: number): "high" | "medium" | "low" {
  if (value >= 0.85) return "high";
  if (value >= 0.6) return "medium";
  return "low";
}

function buildDeadlineGuard(earliestDeadlineIso: string | null): Record<string, unknown> {
  if (!earliestDeadlineIso) {
    return {
      hasTrackedDeadline: false,
      reminders: [],
      weeklyAssurance: "No new time-sensitive changes were detected this week."
    };
  }

  const base = new Date(`${earliestDeadlineIso}T00:00:00.000Z`);
  if (Number.isNaN(base.getTime())) {
    return {
      hasTrackedDeadline: false,
      reminders: [],
      weeklyAssurance: "No new time-sensitive changes were detected this week."
    };
  }

  const offsets = [14, 7, 3, 1];
  const reminders = offsets.map((offsetDays) => {
    const date = new Date(base.getTime());
    date.setUTCDate(date.getUTCDate() - offsetDays);
    return {
      label: `T-${offsetDays}`,
      reminderDateIso: date.toISOString().slice(0, 10)
    };
  });

  return {
    hasTrackedDeadline: true,
    deadlineIso: earliestDeadlineIso,
    reminders,
    weeklyAssurance: "No new time-sensitive changes were detected this week."
  };
}

class DeterministicStructuredFormatter implements CaseFormatter {
  async format(input: FormatterInput): Promise<FormatterOutput> {
    const label = humanDocumentLabel(input.truth.documentType);
    const escalation = escalationSignal(input.truth.documentType, input.truth.timeSensitive);
    const disclaimer =
      "ClearCase provides legal information, not legal advice. Consider a licensed attorney for advice about your specific situation.";

    const plainEnglishExplanation =
      input.truth.documentType === "non_legal_or_unclear_image"
        ? [
            `This upload appears to be ${label}.`,
            "We did not detect strong legal-document signals in the extracted content.",
            "Add anything not visible in the document (what happened, when, where) and upload related notices or letters for better continuity.",
            "This summary is informational and based only on extracted structured facts."
          ].join(" ")
        : [
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
        `People receiving ${label} often choose to track dates and keep copies of related records.`,
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
        classificationConfidenceBand: confidenceBand(input.truth.classificationConfidence),
        notes: uncertaintyNotes(input.truth)
      },
      deadlineGuard: buildDeadlineGuard(input.truth.earliestDeadlineIso),
      consultPacket: {
        sections: ["facts", "dates", "parties", "evidence", "openQuestions"],
        accessControlHint: "Share links can be time-limited and disabled."
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
  return new DeterministicStructuredFormatter();
}
