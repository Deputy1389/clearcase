import type { CaseSummary, CaseDetail } from "../api";

export const DEMO_NOW = "2026-02-13T10:00:00.000Z";

export const DEMO_CASES: CaseSummary[] = [
  {
    id: "demo-case-eviction",
    title: "30-Day Eviction Notice",
    documentType: "eviction_notice",
    classificationConfidence: 0.92,
    status: "analyzed",
    timeSensitive: true,
    earliestDeadline: "2026-03-10",
    plainEnglishExplanation:
      "Your landlord filed a 30-day notice to vacate. This means you have until March 10, 2026 to either move out or respond. You may have defenses available — for example, if the notice was not properly served, or if local rent-control rules apply to your unit.",
    nonLegalAdviceDisclaimer: "This is informational context only and is not legal advice.",
    updatedAt: DEMO_NOW,
    _count: { assets: 2, extractions: 1, verdicts: 1 }
  },
  {
    id: "demo-case-debt",
    title: "Debt Collection Letter — $2,340",
    documentType: "debt_collection_notice",
    classificationConfidence: 0.88,
    status: "analyzed",
    timeSensitive: true,
    earliestDeadline: "2026-03-01",
    plainEnglishExplanation:
      "A debt collector is claiming you owe $2,340. Under the Fair Debt Collection Practices Act, you have 30 days to dispute this debt in writing. If you dispute within that window, the collector must stop collection until they verify the debt.",
    nonLegalAdviceDisclaimer: "This is informational context only and is not legal advice.",
    updatedAt: "2026-02-10T14:30:00.000Z",
    _count: { assets: 1, extractions: 1, verdicts: 1 }
  },
  {
    id: "demo-case-lease",
    title: "Lease Violation Warning",
    documentType: "lease_violation_notice",
    classificationConfidence: 0.78,
    status: "analyzed",
    timeSensitive: false,
    earliestDeadline: null,
    plainEnglishExplanation:
      "Your landlord is warning about a lease violation (noise complaint). This is a warning letter, not an eviction notice. No court date has been set. You should document your response and keep a copy.",
    nonLegalAdviceDisclaimer: "This is informational context only and is not legal advice.",
    updatedAt: "2026-02-08T09:15:00.000Z",
    _count: { assets: 1, extractions: 1, verdicts: 1 }
  }
];

export function buildDemoCaseDetail(summary: CaseSummary): CaseDetail {
  const now = summary.updatedAt;
  const baseVerdict = {
    id: `verdict-${summary.id}`,
    extractionId: `extraction-${summary.id}`,
    llmModel: "gpt-4o",
    status: "completed",
    createdAt: now
  };

  const verdictOutputByType: Record<string, unknown> = {
    eviction_notice: {
      deadlines: {
        signals: [
          { kind: "response_deadline", sourceText: "You have 30 days to vacate the premises", confidence: 0.95, dateIso: "2026-03-10" },
          { kind: "court_date", sourceText: "Hearing scheduled if tenant does not vacate", confidence: 0.7, dateIso: "2026-03-20" }
        ]
      },
      uncertainty: {
        notes: [
          "Rent-control status of this unit could not be determined from the document alone.",
          "Service method (personal vs. posted) is not stated explicitly."
        ]
      },
      deadlineGuard: {
        reminders: [
          { label: "Draft written response", reminderDateIso: "2026-02-20" },
          { label: "Seek legal aid consultation", reminderDateIso: "2026-02-25" },
          { label: "File response if contesting", reminderDateIso: "2026-03-05" }
        ]
      },
      evidenceToGather: [
        "Copy of your current lease agreement",
        "Rent payment receipts for the last 12 months",
        "Photos of the unit condition",
        "Any prior written communication with your landlord"
      ]
    },
    debt_collection_notice: {
      deadlines: {
        signals: [
          { kind: "dispute_deadline", sourceText: "You have 30 days from receipt to dispute this debt", confidence: 0.93, dateIso: "2026-03-01" }
        ]
      },
      uncertainty: {
        notes: [
          "The original creditor is referenced but account number is partially redacted.",
          "Interest and fees breakdown is not itemized in the letter."
        ]
      },
      deadlineGuard: {
        reminders: [
          { label: "Send written dispute letter (certified mail)", reminderDateIso: "2026-02-18" },
          { label: "Check credit report for this account", reminderDateIso: "2026-02-20" }
        ]
      },
      evidenceToGather: [
        "Any correspondence with the original creditor",
        "Bank or payment records related to the claimed debt",
        "Your credit report showing this account"
      ]
    },
    lease_violation_notice: {
      deadlines: { signals: [] },
      uncertainty: {
        notes: [
          "The notice references a noise complaint but does not include dates or specifics.",
          "It is unclear whether this is a first warning or a repeated violation."
        ]
      },
      deadlineGuard: { reminders: [] },
      evidenceToGather: [
        "Your signed lease agreement showing noise / quiet-hours clauses",
        "Written reply acknowledging or contesting the complaint"
      ]
    }
  };

  return {
    ...summary,
    assets: Array.from({ length: summary._count?.assets ?? 1 }, (_, i) => ({
      id: `asset-${summary.id}-${i}`,
      fileName: i === 0 ? "document-front.jpg" : "document-page-2.jpg",
      mimeType: "image/jpeg",
      byteSize: 245000 + i * 30000,
      createdAt: now,
      source: "camera" as const,
      processingStatus: "succeeded" as const,
      assetType: "image"
    })),
    extractions: [
      {
        id: `extraction-${summary.id}`,
        assetId: `asset-${summary.id}-0`,
        engine: "google-cloud-vision",
        structuredFacts: { ocrConfidence: 0.94 },
        status: "completed",
        createdAt: now
      }
    ],
    verdicts: [
      {
        ...baseVerdict,
        outputJson: verdictOutputByType[summary.documentType ?? ""] ?? verdictOutputByType.lease_violation_notice
      }
    ],
    auditLogs: [
      { id: `audit-${summary.id}-1`, eventType: "asset_uploaded", payload: { fileName: "document-front.jpg" }, createdAt: now },
      { id: `audit-${summary.id}-2`, eventType: "extraction_completed", payload: { engine: "google-cloud-vision", confidence: 0.94 }, createdAt: now },
      { id: `audit-${summary.id}-3`, eventType: "verdict_completed", payload: { model: "gpt-4o" }, createdAt: now }
    ]
  };
}

export const DEMO_CASE_DETAIL_MAP: Record<string, CaseDetail> = Object.fromEntries(
  DEMO_CASES.map((c) => [c.id, buildDemoCaseDetail(c)])
);
