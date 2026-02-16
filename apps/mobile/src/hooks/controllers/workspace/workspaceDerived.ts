import {
  deriveCaseSeverity,
  fallbackSummaryForDocumentType,
  buildRecommendedNextSteps,
} from "../../../utils/case-logic";
import { asRecord, asStringArray } from "../../../utils/parsing";
import { daysUntil } from "../../../utils/formatting";
import { findTemplateByFamily } from "../../../data/action-templates";
import type { AppLanguage, CaseSeverity, UploadStage, ExtractedFields, DocumentFamily } from "../../../types";
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

export type ActionInstruction = {
  id: string;
  title: string;
  explanation: string;
  steps: string[];
  channels?: string[];
  contact?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    website?: string;
  };
  court?: {
    name?: string;
    address?: string;
    website?: string;
    caseNumber?: string;
  };
  deadlineISO?: string;
  deadlineLabel?: string;
  consequences?: string[];
  confidence?: number;
  sources?: string[];
  missingInfo?: string[];
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
  if (!verdictOutput) return [];
  const deadlines = asRecord(verdictOutput.deadlines);
  const signalRows = Array.isArray(deadlines?.signals)
    ? deadlines.signals
    : [];

  return signalRows
    .map((row) => asRecord(row))
    .filter((row): row is Record<string, unknown> => Boolean(row))
    .map((row) => {
      const rawDate = typeof row.dateIso === "string" ? row.dateIso : null;
      const parsedDate = rawDate ? new Date(rawDate) : null;
      const dateIso = parsedDate && !Number.isNaN(parsedDate.getTime()) ? rawDate : null;
      const remaining = dateIso ? daysUntil(dateIso!) : null;
      const rawConfidence = typeof row.confidence === "number" ? row.confidence : null;
      const confidence = rawConfidence !== null && Number.isFinite(rawConfidence) ? rawConfidence : null;

      const label =
        (typeof row.label === "string" && row.label) ||
        (typeof row.sourceText === "string" && row.sourceText) ||
        (typeof row.title === "string" && row.title) ||
        "Deadline";

      return {
        kind: typeof row.kind === "string" ? row.kind : "signal",
        label,
        dateIso,
        daysRemaining: remaining,
        confidence,
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

// ── Extracted-field normalizer ───────────────────────────────────────

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export function normalizeExtractedFields(
  verdictOutput: Record<string, unknown> | null
): ExtractedFields {
  if (!verdictOutput) return {};
  const v = verdictOutput;
  const fields: ExtractedFields = {};
  const senderName = str(v.issuingParty) ?? str(v.senderName) ?? str(v.attorneyName) ?? str(v.from);
  if (senderName) fields.senderName = senderName;
  const senderEmail = str(v.contactEmail) ?? str(v.email);
  if (senderEmail) fields.senderEmail = senderEmail;
  const senderPhone = str(v.contactPhone) ?? str(v.phone);
  if (senderPhone) fields.senderPhone = senderPhone;
  const senderAddress = str(v.contactAddress) ?? str(v.address);
  if (senderAddress) fields.senderAddress = senderAddress;
  const courtName = str(v.courtName) ?? str(v.court);
  if (courtName) fields.courtName = courtName;
  const courtAddress = str(v.courtAddress);
  if (courtAddress) fields.courtAddress = courtAddress;
  const courtWebsite = str(v.courtWebsite);
  if (courtWebsite) fields.courtWebsite = courtWebsite;
  const caseNumber = str(v.caseNumber);
  if (caseNumber) fields.caseNumber = caseNumber;
  const website = str(v.website);
  if (website) fields.website = website;
  const sources = asStringArray(v.sources);
  if (sources.length > 0) fields.sources = sources;
  return fields;
}

// ── Document family classification ──────────────────────────────────

export function computeDocumentFamily(args: {
  docType?: string | null;
  extracted?: ExtractedFields;
  latestVerdictOutput?: unknown;
}): DocumentFamily {
  const raw = args.docType?.toLowerCase().trim() ?? "";
  if (!raw) return "other";
  if (raw.includes("subpoena") || raw.includes("duces")) return "subpoena";
  if (raw.includes("summons") || raw.includes("complaint") || raw.includes("petition")) return "summons";
  if (raw.includes("cease") || raw.includes("desist")) return "cease_and_desist";
  if (raw.includes("debt") || raw.includes("collection")) return "debt_collection";
  if (raw.includes("eviction") || raw.includes("unlawful detainer") || raw.includes("notice to quit") || raw.includes("pay or quit")) return "eviction";
  if (raw.includes("agency") || raw.includes("administrative") || raw.includes("government")) return "agency_notice";
  if (raw.includes("demand")) return "demand_letter";
  if (raw.includes("lien")) return "lien";
  return "other";
}

// ── Action instructions ─────────────────────────────────────────────

function buildContact(f: ExtractedFields): ActionInstruction["contact"] | undefined {
  const c: ActionInstruction["contact"] = {};
  if (f.senderName) c.name = f.senderName;
  if (f.senderEmail) c.email = f.senderEmail;
  if (f.senderPhone) c.phone = f.senderPhone;
  if (f.senderAddress) c.address = f.senderAddress;
  if (f.website) c.website = f.website;
  if (!c.name && !c.email && !c.phone && !c.address && !c.website) return undefined;
  return c;
}

function buildCourt(f: ExtractedFields): ActionInstruction["court"] | undefined {
  const c: ActionInstruction["court"] = {};
  if (f.courtName) c.name = f.courtName;
  if (f.courtAddress) c.address = f.courtAddress;
  if (f.courtWebsite) c.website = f.courtWebsite;
  if (f.caseNumber) c.caseNumber = f.caseNumber;
  if (!c.name && !c.address && !c.website && !c.caseNumber) return undefined;
  return c;
}

function buildChannels(f: ExtractedFields, es: boolean): string[] {
  const ch: string[] = [];
  if (f.senderEmail) ch.push(es ? "Correo electronico" : "Email");
  if (f.senderAddress) ch.push(es ? "Correo postal" : "Mail");
  ch.push(es ? "Por escrito" : "In writing");
  if (f.courtName) ch.push(es ? "Presentacion ante el tribunal" : "Court filing");
  return ch;
}

function buildMissingInfo(f: ExtractedFields, hasDeadline: boolean, es: boolean): string[] {
  const missing: string[] = [];
  if (!hasDeadline) {
    missing.push(es
      ? "No pudimos encontrar una fecha limite en el documento"
      : "We could not find a deadline in the document");
  }
  if (!f.senderName) {
    missing.push(es
      ? "No pudimos identificar quien envio este documento"
      : "We could not identify who sent this document");
  }
  return missing;
}

function computeConfidence(hasDeadline: boolean, hasIssuer: boolean, templateMatch: boolean): number {
  if (hasDeadline && hasIssuer) return 80;
  if (templateMatch && (hasDeadline || hasIssuer)) return 60;
  if (hasDeadline || hasIssuer) return 60;
  return 40;
}

function buildGenericFallbackSteps(f: ExtractedFields, lang: "en" | "es"): string[] {
  const es = lang === "es";
  return [
    es
      ? "Busque palabras como 'debe responder antes de' o 'fecha de audiencia' para encontrar la fecha limite"
      : "Look for words like 'must respond by' or 'hearing date' to find the deadline",
    f.senderName
      ? (es ? `Identifique al remitente: ${f.senderName}` : `Identify the sender: ${f.senderName}`)
      : (es ? "Busque en el encabezado o bloque de firma quien lo envio" : "Look at the letterhead or signature block to identify who sent it"),
    es
      ? "Determine que accion se le pide y como debe responder"
      : "Determine what action is being requested and how you should respond",
    es
      ? "Reuna los documentos relevantes y conserve prueba de entrega"
      : "Gather relevant documents and keep proof of delivery",
    es
      ? "Si la fecha limite se acerca o las consecuencias son graves, busque asistencia legal"
      : "If the deadline is near or consequences are serious, seek legal help",
  ];
}

export function computeActionInstructions(args: {
  language: AppLanguage;
  activeDocumentType?: string | null;
  activeEarliestDeadlineISO?: string | null;
  activeTimeSensitive?: boolean;
  extracted?: Record<string, unknown> | null;
  latestVerdictOutput?: Record<string, unknown> | null;
}): ActionInstruction[] {
  const { language, activeDocumentType, activeEarliestDeadlineISO, extracted } = args;
  const es = language === "es";

  const fields = normalizeExtractedFields(extracted ?? null);
  const hasDeadline = Boolean(activeEarliestDeadlineISO);
  const hasIssuer = Boolean(fields.senderName);

  const family = computeDocumentFamily({ docType: activeDocumentType, extracted: fields });
  const template = findTemplateByFamily(family);

  let id: string;
  let title: string;
  let explanation: string;
  let consequence: string;
  let steps: string[];

  if (template) {
    const s = template.strings[language];
    id = template.id;
    title = s.title;
    explanation = s.explanation;
    consequence = s.consequence;
    steps = template.buildSteps(fields, language);
  } else {
    id = "generic-respond";
    title = es ? "Como responder" : "How to respond";
    explanation = es
      ? "Este documento puede tener plazos. Los siguientes pasos son los mas seguros."
      : "This document may have deadlines. The safest next steps are below.";
    consequence = es
      ? "Ignorar documentos legales puede tener consecuencias serias"
      : "Ignoring legal documents can have serious consequences";
    steps = buildGenericFallbackSteps(fields, language);
  }

  const contact = buildContact(fields);
  const court = buildCourt(fields);
  const channels = buildChannels(fields, es);
  const missingInfo = buildMissingInfo(fields, hasDeadline, es);
  const confidence = computeConfidence(hasDeadline, hasIssuer, Boolean(template));

  const instruction: ActionInstruction = {
    id,
    title,
    explanation,
    steps,
    channels,
    consequences: [consequence],
    confidence,
    missingInfo: missingInfo.length > 0 ? missingInfo : undefined,
    sources: fields.sources,
  };

  if (contact) instruction.contact = contact;
  if (court) instruction.court = court;

  if (activeEarliestDeadlineISO) {
    instruction.deadlineISO = activeEarliestDeadlineISO;
    instruction.deadlineLabel = es ? "Responder antes de" : "Respond by";
  }

  return [instruction];
}
