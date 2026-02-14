import { MANUAL_DOCUMENT_TYPES } from "../api";
import type { ManualDocumentType } from "../api";
import type { AppLanguage, CaseSeverity } from "../types";
import { titleize, fmtDate, daysUntil } from "./formatting";

export type ManualCategoryOption = {
  value: ManualDocumentType;
  label: string;
};

// This array will move to data/ in Round 2.
export const manualCategoryOptions: ManualCategoryOption[] = [
  { value: "summons_complaint", label: "Summons / Complaint" },
  { value: "court_hearing_notice", label: "Court Hearing Notice" },
  { value: "subpoena_notice", label: "Subpoena Notice" },
  { value: "judgment_notice", label: "Judgment Notice" },
  { value: "small_claims_complaint", label: "Small Claims Complaint" },
  { value: "family_court_notice", label: "Family Court Notice" },
  { value: "protective_order_notice", label: "Protective Order Notice" },
  { value: "eviction_notice", label: "Eviction Notice" },
  { value: "foreclosure_default_notice", label: "Foreclosure / Default Notice" },
  { value: "repossession_notice", label: "Repossession Notice" },
  { value: "landlord_security_deposit_notice", label: "Security Deposit Notice" },
  { value: "lease_violation_notice", label: "Lease Violation Notice" },
  { value: "debt_collection_notice", label: "Debt Collection Notice" },
  { value: "wage_garnishment_notice", label: "Wage Garnishment Notice" },
  { value: "tax_notice", label: "Tax Notice" },
  { value: "insurance_denial_letter", label: "Insurance Denial Letter" },
  { value: "insurance_subrogation_notice", label: "Insurance Subrogation Notice" },
  { value: "workers_comp_denial_notice", label: "Workers' Comp Denial Notice" },
  { value: "unemployment_benefits_denial", label: "Unemployment Benefits Denial" },
  { value: "benefits_overpayment_notice", label: "Benefits Overpayment Notice" },
  { value: "utility_shutoff_notice", label: "Utility Shutoff Notice" },
  { value: "license_suspension_notice", label: "License Suspension Notice" },
  { value: "citation_ticket", label: "Citation / Ticket" },
  { value: "demand_letter", label: "Demand Letter" },
  { value: "incident_evidence_photo", label: "Incident Evidence Photo" },
  { value: "general_legal_notice", label: "General Legal Notice" },
  { value: "non_legal_or_unclear_image", label: "Not Legal / Unclear Image" },
  { value: "unknown_legal_document", label: "Unknown Legal Document" }
];

// This map will move to data/ in Round 2.
const labelsEs: Record<ManualDocumentType, string> = {
  summons_complaint: "Citacion / Demanda",
  court_hearing_notice: "Aviso de audiencia judicial",
  subpoena_notice: "Aviso de citatorio",
  judgment_notice: "Aviso de sentencia",
  demand_letter: "Carta de requerimiento",
  small_claims_complaint: "Demanda de reclamos menores",
  family_court_notice: "Aviso de tribunal familiar",
  protective_order_notice: "Aviso de orden de proteccion",
  eviction_notice: "Aviso de desalojo",
  foreclosure_default_notice: "Aviso de ejecucion / incumplimiento",
  repossession_notice: "Aviso de recuperacion",
  landlord_security_deposit_notice: "Aviso de deposito de garantia",
  lease_violation_notice: "Aviso de incumplimiento de contrato",
  debt_collection_notice: "Aviso de cobro de deuda",
  wage_garnishment_notice: "Aviso de embargo de salario",
  tax_notice: "Aviso de impuestos",
  insurance_denial_letter: "Carta de denegacion de seguro",
  insurance_subrogation_notice: "Aviso de subrogacion de seguro",
  workers_comp_denial_notice: "Denegacion de compensacion laboral",
  unemployment_benefits_denial: "Denegacion de beneficios por desempleo",
  benefits_overpayment_notice: "Aviso de sobrepago de beneficios",
  incident_evidence_photo: "Foto de evidencia de incidente",
  utility_shutoff_notice: "Aviso de corte de servicio",
  license_suspension_notice: "Aviso de suspension de licencia",
  citation_ticket: "Multa / infraccion",
  general_legal_notice: "Aviso legal general",
  non_legal_or_unclear_image: "Imagen no legal o poco clara",
  unknown_legal_document: "Documento legal no identificado"
};

export function isManualDocumentType(value: string | null | undefined): value is ManualDocumentType {
  return Boolean(value && MANUAL_DOCUMENT_TYPES.includes(value as ManualDocumentType));
}

export function manualCategoryLabel(value: string | null | undefined, language: AppLanguage = "en"): string {
  if (!value) return language === "es" ? "Deteccion pendiente" : "Pending detection";
  const found = manualCategoryOptions.find((row) => row.value === value);
  if (!found) return titleize(value);

  if (language === "en") return found.label;
  return labelsEs[value as ManualDocumentType] ?? found.label;
}

export function fallbackSummaryForDocumentType(
  documentType: string | null | undefined,
  language: AppLanguage = "en"
): string {
  if (language === "es") {
    if (!documentType) {
      return "La carga esta completa. Todavia estamos determinando la mejor categoria. Agrega lo que no se ve en el documento (que paso, cuando, donde) y sube paginas mas claras para mejorar el resultado.";
    }

    if (documentType === "incident_evidence_photo") {
      return "Esto parece evidencia de un incidente (contenido fotografico) y no un aviso legal formal. Agrega lo que no se ve en las fotos (que paso, cuando, donde) y sube documentos de respaldo para mayor claridad.";
    }

    if (documentType === "non_legal_or_unclear_image") {
      return "Este archivo aun no parece un documento legal. Sube un aviso legal mas claro o agrega detalles del incidente para continuar.";
    }

    if (documentType === "unknown_legal_document") {
      return "Esto parece legal, pero aun no esta clasificado con buena confianza. Muchas personas optan por agregar paginas mas claras y contexto del caso para mejorar la deteccion de fechas y obligaciones.";
    }

    return `Esto parece ser ${manualCategoryLabel(documentType, "es")}. En muchos casos se considera util revisar la lista y considerar una consulta con un abogado para orientacion especifica.`;
  }

  if (!documentType) {
    return "Upload is complete. We are still determining the best category. Add anything not visible in the document (what happened, when, where) and upload clearer pages for a better result.";
  }

  if (documentType === "incident_evidence_photo") {
    return "This appears to be incident evidence (photo-based context) rather than a formal legal notice. Add anything not visible in the photos (what happened, when, where) and upload supporting documents for stronger guidance.";
  }

  if (documentType === "non_legal_or_unclear_image") {
    return "This file does not look like a legal document yet. Upload a clearer legal notice or add incident details to continue case building.";
  }

  if (documentType === "unknown_legal_document") {
    return "This appears legal but is not confidently classified yet. Many people add clearer pages and case context to improve deadline and obligation detection.";
  }

  return `This appears to be ${manualCategoryLabel(documentType, "en")}. Review the checklist below and consider speaking with a licensed attorney for advice specific to your situation.`;
}

export function buildRecommendedNextSteps(
  documentType: string | null | undefined,
  earliestDeadline: string | null | undefined,
  language: AppLanguage = "en"
): string[] {
  if (language === "es") {
    const genericEs: string[] = [
      "Confirma que la categoria seleccionada coincida con tu archivo.",
      "Agrega lo que no se ve en el documento (que paso, cuando, donde). Esto ayuda a mantener continuidad en futuras cargas.",
      "Muchas personas optan por consultar con un abogado cuando podria afectar derechos legales."
    ];

    let stepsEs = genericEs;
    if (
      documentType === "summons_complaint" ||
      documentType === "court_hearing_notice" ||
      documentType === "subpoena_notice" ||
      documentType === "judgment_notice" ||
      documentType === "small_claims_complaint" ||
      documentType === "family_court_notice" ||
      documentType === "protective_order_notice"
    ) {
      stepsEs = [
        "Muchas personas conservan juntas todas las paginas y sobres relacionados.",
        "Muchas personas optan por consultar con un abogado de litigio o familia para revisar opciones de respuesta.",
        "Una linea de tiempo simple de eventos y nombres puede facilitar una consulta."
      ];
    } else if (
      documentType === "eviction_notice" ||
      documentType === "foreclosure_default_notice" ||
      documentType === "repossession_notice" ||
      documentType === "lease_violation_notice" ||
      documentType === "landlord_security_deposit_notice"
    ) {
      stepsEs = [
        "Muchas personas reunen contrato, historial de pagos y comunicaciones relacionadas.",
        "Muchas personas optan por contactar ayuda legal de vivienda cuando los plazos parecen cortos.",
        "Fotos y notas con fecha suelen ayudar a preservar contexto del inmueble."
      ];
    } else if (
      documentType === "debt_collection_notice" ||
      documentType === "wage_garnishment_notice" ||
      documentType === "tax_notice" ||
      documentType === "benefits_overpayment_notice"
    ) {
      stepsEs = [
        "Muchas personas reunen estados de cuenta y avisos previos.",
        "Verifica si el aviso incluye instrucciones de disputa o apelacion.",
        "Muchas personas optan por consultar con un abogado de consumo o impuestos antes de responder."
      ];
    } else if (
      documentType === "insurance_denial_letter" ||
      documentType === "insurance_subrogation_notice" ||
      documentType === "workers_comp_denial_notice" ||
      documentType === "unemployment_benefits_denial"
    ) {
      stepsEs = [
        "Conserva la carta de denegacion completa y registros de poliza o reclamo.",
        "Identifica fechas de apelacion y documentos de respaldo requeridos.",
        "Muchas personas optan por consultar con un abogado de seguros o beneficios."
      ];
    } else if (documentType === "incident_evidence_photo") {
      stepsEs = [
        "Agrega lo que no se ve en las fotos (que paso, cuando, donde y quien participo).",
        "Sube documentos de respaldo (reporte policial, notas medicas, presupuestos, mensajes).",
        "Muchas personas optan por consultar con un abogado cuando hay lesiones o perdidas mayores."
      ];
    } else if (documentType === "non_legal_or_unclear_image") {
      stepsEs = [
        "Sube una imagen mas clara o un aviso formal si esta disponible.",
        "Usa el contexto del caso para explicar por que esta imagen es importante.",
        "Si esperabas un aviso legal, muchas personas optan por verificar detalles con el remitente o con un abogado."
      ];
    }

    if (earliestDeadline) {
      const label = fmtDate(earliestDeadline, "es");
      return [`Muchas personas optan por agendar esta fecha: ${label}.`, ...stepsEs];
    }
    return stepsEs;
  }

  const generic: string[] = [
    "Confirm the selected category matches your file.",
    "Add anything not visible in the document (what happened, when, where). This helps future uploads stay consistent.",
    "Many people choose to speak with a licensed attorney if this may affect legal rights."
  ];

  let steps = generic;

  if (
    documentType === "summons_complaint" ||
    documentType === "court_hearing_notice" ||
    documentType === "subpoena_notice" ||
    documentType === "judgment_notice" ||
    documentType === "small_claims_complaint" ||
    documentType === "family_court_notice" ||
    documentType === "protective_order_notice"
  ) {
    steps = [
      "Many people keep all related pages and envelopes together.",
      "Many people choose to consult a litigation or family-law attorney to discuss response options.",
      "A simple timeline of events and key names can make consultations easier."
    ];
  } else if (
    documentType === "eviction_notice" ||
    documentType === "foreclosure_default_notice" ||
    documentType === "repossession_notice" ||
    documentType === "lease_violation_notice" ||
    documentType === "landlord_security_deposit_notice"
  ) {
    steps = [
      "Many people gather lease records, payment history, and related communications.",
      "Many people choose to contact housing legal aid or an attorney when timelines feel short.",
      "Timestamped photos and notes can help preserve property-condition details."
    ];
  } else if (
    documentType === "debt_collection_notice" ||
    documentType === "wage_garnishment_notice" ||
    documentType === "tax_notice" ||
    documentType === "benefits_overpayment_notice"
  ) {
    steps = [
      "Many people gather account statements and prior notices.",
      "Check whether the notice provides dispute/appeal instructions.",
      "Many people choose to consult a consumer-law or tax attorney before responding."
    ];
  } else if (
    documentType === "insurance_denial_letter" ||
    documentType === "insurance_subrogation_notice" ||
    documentType === "workers_comp_denial_notice" ||
    documentType === "unemployment_benefits_denial"
  ) {
    steps = [
      "Keep the full denial letter and policy or claim records together.",
      "Identify appeal deadlines and required supporting records.",
      "Many people choose to consult an attorney focused on insurance or benefits appeals."
    ];
  } else if (documentType === "incident_evidence_photo") {
    steps = [
      "Add anything not visible in the photo set (what happened, when, where, who was involved).",
      "Upload supporting records (police report, medical notes, estimates, messages).",
      "Many people choose to consult counsel when there are injuries or major losses."
    ];
  } else if (documentType === "non_legal_or_unclear_image") {
    steps = [
      "Upload a clearer image or a formal notice if available.",
      "Use case context to explain why this image matters.",
      "If you expected a legal notice, many people verify details with the sender or a lawyer."
    ];
  }

  if (earliestDeadline) {
    const label = fmtDate(earliestDeadline, "en");
    return [`Many people choose to calendar this date: ${label}.`, ...steps];
  }

  return steps;
}

export function deriveCaseSeverity(
  documentType: string | null | undefined,
  timeSensitive: boolean | null | undefined,
  earliestDeadline: string | null | undefined
): CaseSeverity {
  if (timeSensitive) return "high";

  const urgentDocTypes = new Set<string>([
    "summons_complaint",
    "court_hearing_notice",
    "subpoena_notice",
    "judgment_notice",
    "small_claims_complaint",
    "protective_order_notice",
    "family_court_notice",
    "eviction_notice",
    "foreclosure_default_notice",
    "repossession_notice",
    "wage_garnishment_notice"
  ]);

  if (documentType && urgentDocTypes.has(documentType)) return "high";

  if (earliestDeadline) {
    const days = daysUntil(earliestDeadline);
    if (days !== null && days <= 7) return "high";
    return "medium";
  }

  if (documentType === "non_legal_or_unclear_image") return "low";
  if (documentType === "incident_evidence_photo") return "medium";
  if (documentType === "unknown_legal_document") return "medium";
  if (!documentType) return "medium";

  return "medium";
}

export function severityLabel(level: CaseSeverity, language: AppLanguage = "en"): string {
  if (language === "es") {
    if (level === "high") return "Prioridad alta";
    if (level === "medium") return "Prioridad media";
    return "Prioridad baja";
  }
  if (level === "high") return "High priority";
  if (level === "medium") return "Medium priority";
  return "Low priority";
}

export function severitySummary(level: CaseSeverity, language: AppLanguage = "en"): string {
  if (language === "es") {
    if (level === "high") return "Este documento contiene senales que a menudo son sensibles al tiempo.";
    if (level === "medium") return "La revision inicial esta completa. Los pasos siguientes suelen ayudar a reducir riesgo.";
    return "No se detecta una senal legal inmediata. Continua documentando y monitoreando actualizaciones.";
  }
  if (level === "high") return "This document contains signals that are often time-sensitive.";
  if (level === "medium") return "Initial review is complete. The steps below may help reduce risk.";
  return "No immediate legal signal detected. Continue documenting and monitor updates.";
}

export function casePriorityLevel(row: { timeSensitive: boolean; earliestDeadline: string | null }): "high" | "medium" | "low" {
  if (row.timeSensitive) return "high";
  if (row.earliestDeadline) return "medium";
  return "low";
}

export function casePriorityLabel(row: { timeSensitive: boolean; earliestDeadline: string | null }, language: AppLanguage = "en"): "High" | "Medium" | "Low" | "Alta" | "Media" | "Baja" {
  const level = casePriorityLevel(row);
  if (language === "es") {
    if (level === "high") return "Alta";
    if (level === "medium") return "Media";
    return "Baja";
  }
  if (level === "high") return "High";
  if (level === "medium") return "Medium";
  return "Low";
}
