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

export type TimeSensitivity = "none" | "moderate" | "urgent" | "critical";

export function computeTimeSensitivity(args: {
  deadlineISO?: string | null;
  now?: Date;
}): TimeSensitivity {
  const { deadlineISO, now = new Date() } = args;
  if (!deadlineISO) return "none";

  const deadline = new Date(deadlineISO);
  if (Number.isNaN(deadline.getTime())) return "none";

  // Normalize to start of day for both
  const dDate = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
  const nDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffTime = dDate.getTime() - nDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "critical"; // Overdue is critical
  if (diffDays <= 2) return "critical";
  if (diffDays <= 6) return "urgent";
  if (diffDays <= 14) return "moderate";
  return "none";
}

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
  const appearanceDateISO = str(v.appearanceDateISO) ?? str(v.appearanceDate);
  if (appearanceDateISO) fields.appearanceDateISO = appearanceDateISO;
  const sources = asStringArray(v.sources);
  if (sources.length > 0) fields.sources = sources;
  return fields;
}

// ── Response signals ────────────────────────────────────────────────

export type ResponseSignals = {
  responseDeadlineISO?: string;
  responseDestination: "court" | "sender" | "agency" | "unknown";
  responseChannels: ("email" | "mail" | "portal" | "in_person" | "phone")[];
  timeSensitivity: TimeSensitivity;
  jurisdictionState?: string;
  missing: {
    deadline: boolean;
    sender: boolean;
    court: boolean;
    channel: boolean;
  };
};

export type ResponsePlan = {
  requiredActions: ("respond" | "appear" | "produce_documents" | "file_answer" | "dispute" | "pay" | "negotiate")[];
  proofToKeep: string[];                 // always safe items like “copies”, “receipts”, “screenshots”
  destination: ResponseSignals["responseDestination"];
  channels: ResponseSignals["responseChannels"];
  deadlineISO?: string;
};

export type ResponseOutline = {
  subject?: string;
  sections: string[];
};

export function computeResponseOutline(args: {
  family: DocumentFamily;
  plan: ResponsePlan;
  extracted: ExtractedFields;
  signals: ResponseSignals;
  language: AppLanguage;
}): ResponseOutline {
  const { family, plan, extracted, language } = args;
  const es = language === "es";
  const datePlaceholder = es ? "[Insertar fecha]" : "[Insert date]";
  const casePlaceholder = es ? "[Insertar numero de caso]" : "[Insert case number]";

  let subject: string | undefined;
  const sections: string[] = [];

  switch (family) {
    case "summons":
    case "small_claims":
      subject = es
        ? `Respuesta relativa al caso ${extracted.caseNumber || casePlaceholder}`
        : `Response regarding case ${extracted.caseNumber || casePlaceholder}`;
      sections.push(es ? "Acuse de recibo de la citacion" : "Acknowledge receipt of the summons");
      sections.push(es ? "Declaracion de intencion de responder o comparecer" : "State intent to respond or appear");
      sections.push(es ? "Solicitud de aclaracion sobre las alegaciones si es necesario" : "Request clarification on allegations if needed");
      sections.push(es ? "Cierre respetuoso" : "Close respectfully");
      break;

    case "subpoena":
      subject = es
        ? `Respuesta a la citacion con fecha ${extracted.appearanceDateISO || datePlaceholder}`
        : `Response to Subpoena dated ${extracted.appearanceDateISO || datePlaceholder}`;
      sections.push(es ? "Acuse de recibo de la citacion" : "Acknowledge receipt of the subpoena");
      sections.push(es ? "Confirmacion de la revision de los materiales solicitados" : "Confirm review of requested materials");
      sections.push(es ? "Plan de cumplimiento o necesidad de aclaracion" : "State compliance plan or need for clarification");
      sections.push(es ? "Solicitud de confirmacion de recibo" : "Request confirmation of receipt");
      break;

    case "demand_letter":
    case "debt_collection":
    case "collections_validation":
      subject = es
        ? `Respuesta a la carta con fecha ${datePlaceholder}`
        : `Response to Letter dated ${datePlaceholder}`;
      sections.push(es ? "Acuse de recibo de la comunicacion" : "Acknowledge receipt of the communication");
      sections.push(es ? "Declaracion de disputa o solicitud de validacion de deuda" : "State dispute or request validation of debt");
      sections.push(es ? "Solicitud de documentacion de respaldo si aplica" : "Request supporting documentation if applicable");
      sections.push(es ? "Solicitud de confirmacion por escrito" : "Request written confirmation");
      break;

    case "agency_notice":
      subject = es
        ? `Respuesta al aviso con fecha ${datePlaceholder}`
        : `Response to Notice dated ${datePlaceholder}`;
      sections.push(es ? "Acuse de recibo del aviso gubernamental" : "Acknowledge receipt of government notice");
      sections.push(es ? "Declaracion de intencion de responder o solicitar revision" : "State intent to respond or request review");
      sections.push(es ? "Solicitud de aclaracion o documentacion adicional" : "Request clarification or documentation");
      sections.push(es ? "Cierre" : "Close");
      break;

    case "eviction":
      subject = es
        ? `Respuesta al aviso con fecha ${datePlaceholder}`
        : `Response to Notice dated ${datePlaceholder}`;
      sections.push(es ? "Acuse de recibo del aviso de desalojo" : "Acknowledge receipt of eviction notice");
      sections.push(es ? "Declaracion de intencion de abordar el asunto" : "State intent to address the matter");
      sections.push(es ? "Solicitud de aclaracion o discusion sobre el cumplimiento" : "Request clarification or discuss compliance");
      sections.push(es ? "Cierre respetuoso" : "Close respectfully");
      break;

    default:
      subject = es ? "Respuesta a la comunicacion legal" : "Response to legal communication";
      sections.push(es ? "Acuse de recibo del documento" : "Acknowledge receipt of the document");
      sections.push(es ? "Declaracion de intencion de revisar y responder" : "State intent to review and respond");
      sections.push(es ? "Solicitud de informacion adicional si es necesario" : "Request additional information if needed");
      sections.push(es ? "Cierre" : "Close");
  }

  return { subject, sections };
}

export function computeResponsePlan(args: {
  family: DocumentFamily;
  extracted: ExtractedFields;
  signals: ResponseSignals;
}): ResponsePlan {
  const { family, extracted, signals } = args;
  const actions: ResponsePlan["requiredActions"] = [];

  switch (family) {
    case "summons":
    case "small_claims":
      if (extracted.appearanceDateISO) {
        actions.push("appear");
      } else if (extracted.courtName) {
        actions.push("file_answer");
      } else {
        actions.push("respond");
      }
      break;
    case "subpoena":
      actions.push("produce_documents");
      if (extracted.appearanceDateISO) {
        actions.push("appear");
      }
      break;
    case "demand_letter":
      actions.push("respond");
      actions.push("negotiate");
      break;
    case "debt_collection":
    case "collections_validation":
      actions.push("dispute");
      actions.push("respond");
      break;
    case "agency_notice":
      actions.push("respond");
      break;
    case "eviction":
      actions.push("respond");
      // Usually implies potential appearance
      actions.push("appear");
      break;
    case "cease_and_desist":
      actions.push("respond");
      break;
    case "lien":
      actions.push("respond");
      actions.push("pay");
      break;
    default:
      actions.push("respond");
  }

  return {
    requiredActions: actions,
    proofToKeep: ["copies of what you send", "delivery proof if available", "receipts"],
    destination: signals.responseDestination,
    channels: signals.responseChannels,
    deadlineISO: signals.responseDeadlineISO,
  };
}

export function computeResponseSignals(args: {
  family: DocumentFamily;
  extracted: ExtractedFields;
  activeEarliestDeadlineISO?: string | null;
  now?: Date;
}): ResponseSignals {
  const { family, extracted, activeEarliestDeadlineISO, now } = args;

  const hasContact = Boolean(
    extracted.senderEmail || extracted.senderPhone || extracted.senderAddress
  );

  let responseDestination: ResponseSignals["responseDestination"];
  if (extracted.courtName) responseDestination = "court";
  else if (hasContact) responseDestination = "sender";
  else if (family === "agency_notice") responseDestination = "agency";
  else responseDestination = "unknown";

  const responseChannels: ResponseSignals["responseChannels"] = [];
  if (extracted.senderEmail) responseChannels.push("email");
  if (extracted.senderPhone) responseChannels.push("phone");
  if (extracted.senderAddress) responseChannels.push("mail");
  if (extracted.courtWebsite) responseChannels.push("portal");

  const timeSensitivity = computeTimeSensitivity({ deadlineISO: activeEarliestDeadlineISO, now });

  // Look for 2-letter state code in court address (e.g., ", CA 90012" or " New York, NY ")
  let jurisdictionState: string | undefined;
  if (extracted.courtAddress) {
    const match = extracted.courtAddress.match(/,\s*([A-Z]{2})\s+\d{5}/);
    if (match) {
      jurisdictionState = match[1];
    }
  }

  const signals: ResponseSignals = {
    responseDestination,
    responseChannels,
    timeSensitivity,
    missing: {
      deadline: !activeEarliestDeadlineISO,
      sender: !hasContact && !extracted.senderName,
      court: !extracted.courtName,
      channel: responseChannels.length === 0,
    },
  };

  if (jurisdictionState) {
    signals.jurisdictionState = jurisdictionState;
  }

  if (activeEarliestDeadlineISO) {
    signals.responseDeadlineISO = activeEarliestDeadlineISO;
  }

  return signals;
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
  if (raw.includes("small") && raw.includes("claim")) return "small_claims";
  if (raw.includes("summons") || raw.includes("complaint") || raw.includes("petition")) return "summons";
  if (raw.includes("cease") || raw.includes("desist")) return "cease_and_desist";
  if (raw.includes("validation") && (raw.includes("debt") || raw.includes("collection"))) return "collections_validation";
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

function buildMissingInfoStrings(signals: ResponseSignals, es: boolean): string[] {
  const missing: string[] = [];
  if (signals.missing.deadline) {
    missing.push(es
      ? "No pudimos encontrar una fecha limite en el documento"
      : "We could not find a deadline in the document");
  }
  if (signals.missing.sender) {
    missing.push(es
      ? "No pudimos identificar quien envio este documento"
      : "We could not identify who sent this document");
  }
  if (signals.missing.court && (signals.responseDestination === "court" || signals.missing.sender)) {
    // Only flag missing court if it's likely a court document or we don't even have a sender
    missing.push(es
      ? "No se identifico un tribunal en este documento"
      : "No court was identified in this document");
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

function projectPlanToSteps(plan: ResponsePlan, es: boolean): string[] {
  const steps: string[] = [];
  if (plan.requiredActions.includes("file_answer")) {
    steps.push(es ? "Prepare su respuesta formal (contestacion) para el tribunal" : "Prepare your formal response (answer) for the court");
  }
  if (plan.requiredActions.includes("appear")) {
    steps.push(es ? "Asegurese de comparecer en la fecha y lugar indicados" : "Ensure you appear at the indicated date and location");
  }
  if (plan.requiredActions.includes("produce_documents")) {
    steps.push(es ? "Reuna y presente los documentos solicitados" : "Gather and produce the requested documents");
  }
  if (plan.requiredActions.includes("dispute")) {
    steps.push(es ? "Envie una carta de disputa por escrito para proteger sus derechos" : "Send a written dispute letter to protect your rights");
  }
  if (plan.requiredActions.includes("pay")) {
    steps.push(es ? "Considere realizar el pago para resolver el asunto y evitar gravamenes" : "Consider making the payment to resolve the matter and avoid liens");
  }
  if (plan.requiredActions.includes("negotiate")) {
    steps.push(es ? "Considere negociar un acuerdo o plan de pago" : "Consider negotiating a settlement or payment plan");
  }
  return steps;
}

export function computeActionInstructions(args: {
  language: AppLanguage;
  activeDocumentType?: string | null;
  activeEarliestDeadlineISO?: string | null;
  activeTimeSensitive?: boolean;
  extracted?: Record<string, unknown> | null;
  latestVerdictOutput?: Record<string, unknown> | null;
  responseSignals?: ResponseSignals;
  responsePlan?: ResponsePlan;
}): ActionInstruction[] {
  const { language, activeDocumentType, activeEarliestDeadlineISO, extracted, responseSignals, responsePlan } = args;
  const es = language === "es";

  const fields = normalizeExtractedFields(extracted ?? null);
  const hasDeadline = Boolean(activeEarliestDeadlineISO);
  const hasIssuer = Boolean(fields.senderName);

  const family = computeDocumentFamily({ docType: activeDocumentType, extracted: fields });
  const template = findTemplateByFamily(family);

  const signals = responseSignals ?? computeResponseSignals({
    family,
    extracted: fields,
    activeEarliestDeadlineISO,
  });

  const plan = responsePlan ?? computeResponsePlan({
    family,
    extracted: fields,
    signals,
  });

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
    
    // Incorporate plan actions into steps if not already present
    const planSteps = projectPlanToSteps(plan, es);
    for (const ps of planSteps) {
      if (!steps.some(s => s.toLowerCase().includes(ps.toLowerCase().substring(0, 10)))) {
        steps.push(ps);
      }
    }
  } else {
    id = "generic-respond";
    title = es ? "Como responder" : "How to respond";
    explanation = es
      ? "Este documento puede tener plazos. Los siguientes pasos son los mas seguros."
      : "This document may have deadlines. The safest next steps are below.";
    consequence = es
      ? "Ignorar documentos legales puede tener consecuencias serias"
      : "Ignoring legal documents can have serious consequences";
    
    const planSteps = projectPlanToSteps(plan, es);
    if (planSteps.length > 0) {
      steps = [
        ...planSteps,
        ...buildGenericFallbackSteps(fields, language).slice(0, 3)
      ];
    } else {
      steps = buildGenericFallbackSteps(fields, language);
    }
  }

  const contact = buildContact(fields);
  const court = buildCourt(fields);
  const channels = buildChannels(fields, es);

  const missingInfo = buildMissingInfoStrings(signals, es);
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
