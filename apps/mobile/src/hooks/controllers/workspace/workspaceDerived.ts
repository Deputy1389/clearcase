import {
  deriveCaseSeverity,
  fallbackSummaryForDocumentType,
  buildRecommendedNextSteps,
} from "../../../utils/case-logic";
import { asRecord } from "../../../utils/parsing";
import { daysUntil } from "../../../utils/formatting";
import type { AppLanguage, CaseSeverity, UploadStage } from "../../../types";
import type { CaseDetail, CaseSummary, Verdict } from "../../../api";

// ── Types ────────────────────────────────────────────────────────────

export type TimelineRow = {
  kind: string;
  label: string;
  dateIso: string | null;
  daysRemaining: number | null;
  confidence: number | null;
  sourceText: string;
};

export type DeadlineReminder = {
  label: string;
  reminderDateIso: string | null;
};

// ── Pure functions ──────────────────────────────────────────────────

export function computeLatestVerdictOutput(
  selectedCase: CaseDetail | null
): Record<string, unknown> | null {
  return asRecord(
    (selectedCase?.verdicts as Verdict[] | undefined)?.[0]?.outputJson
  );
}

export function computeWorkspaceSeverity(
  documentType: string | null,
  timeSensitive: boolean,
  earliestDeadline: string | null
): CaseSeverity {
  return deriveCaseSeverity(documentType, timeSensitive, earliestDeadline);
}

export function computeWorkspaceSummaryText(
  plainEnglishExplanation: string | null | undefined,
  documentType: string | null,
  language: AppLanguage
): string {
  const value = plainEnglishExplanation?.trim();
  if (language === "en" && value) return value;
  return fallbackSummaryForDocumentType(documentType, language);
}

export function computeWorkspaceNextSteps(
  documentType: string | null,
  earliestDeadline: string | null,
  language: AppLanguage
): string[] {
  return buildRecommendedNextSteps(documentType, earliestDeadline, language);
}

export function computeUploadStatusText(
  uploading: boolean,
  uploadStage: UploadStage,
  language: AppLanguage
): string {
  if (!uploading) {
    return language === "es" ? "Listo para cargar" : "Ready to upload";
  }
  if (language === "es") {
    if (uploadStage === "picking") return "Elegir archivo";
    if (uploadStage === "preparing") return "Preparando carga";
    if (uploadStage === "sending") return "Cargando de forma segura";
    if (uploadStage === "processing") return "Generando analisis";
    return "Listo para cargar";
  }
  if (uploadStage === "picking") return "Choose file";
  if (uploadStage === "preparing") return "Preparing upload";
  if (uploadStage === "sending") return "Uploading securely";
  if (uploadStage === "processing") return "Generating insight";
  return "Ready to upload";
}

export function computeDeadlineGuardReminders(
  verdictOutput: Record<string, unknown> | null
): DeadlineReminder[] {
  const deadlineGuard = asRecord(verdictOutput?.deadlineGuard);
  const reminders = Array.isArray(deadlineGuard?.reminders)
    ? deadlineGuard.reminders
    : [];
  return reminders
    .map((row) => asRecord(row))
    .filter((row): row is Record<string, unknown> => Boolean(row))
    .map((row) => ({
      label: typeof row.label === "string" ? row.label : "Reminder",
      reminderDateIso:
        typeof row.reminderDateIso === "string" ? row.reminderDateIso : null,
    }))
    .filter((row) => Boolean(row.reminderDateIso));
}

export function computeTimelineRows(
  verdictOutput: Record<string, unknown> | null
): TimelineRow[] {
  const deadlines = asRecord(verdictOutput?.deadlines);
  const signalRows = Array.isArray(deadlines?.signals)
    ? deadlines.signals
    : [];

  return signalRows
    .map((row) => asRecord(row))
    .filter((row): row is Record<string, unknown> => Boolean(row))
    .map((row) => {
      const dateIso =
        typeof row.dateIso === "string" ? row.dateIso : null;
      const remaining = dateIso ? daysUntil(dateIso) : null;
      return {
        kind: typeof row.kind === "string" ? row.kind : "signal",
        label:
          typeof row.sourceText === "string"
            ? row.sourceText
            : "Detected signal",
        dateIso,
        daysRemaining: remaining,
        confidence:
          typeof row.confidence === "number" ? row.confidence : null,
        sourceText:
          typeof row.sourceText === "string"
            ? row.sourceText
            : "Detected signal",
      };
    })
    .sort((a, b) => {
      if (!a.dateIso && !b.dateIso) return 0;
      if (!a.dateIso) return 1;
      if (!b.dateIso) return -1;
      return a.dateIso.localeCompare(b.dateIso);
    });
}
