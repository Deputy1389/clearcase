import { useMemo } from "react";
import { 
  deriveCaseSeverity, 
  fallbackSummaryForDocumentType, 
  buildRecommendedNextSteps, 
  manualCategoryLabel 
} from "../../../utils/case-logic";
import { asStringArray, asRecord } from "../../../utils/parsing";
import { fmtDate, fmtDateTime } from "../../../utils/formatting";

export function useWorkspaceSummary(ui: any, cases: any) {
  const language = ui.language;

  const activeDocumentType = useMemo(
    () => cases.selectedCase?.documentType ?? cases.selectedCaseSummary?.documentType ?? null,
    [cases.selectedCase?.documentType, cases.selectedCaseSummary?.documentType]
  );

  const activeEarliestDeadline = useMemo(
    () => cases.selectedCase?.earliestDeadline ?? cases.selectedCaseSummary?.earliestDeadline ?? null,
    [cases.selectedCase?.earliestDeadline, cases.selectedCaseSummary?.earliestDeadline]
  );

  const activeTimeSensitive = useMemo(
    () => cases.selectedCase?.timeSensitive ?? cases.selectedCaseSummary?.timeSensitive ?? false,
    [cases.selectedCase?.timeSensitive, cases.selectedCaseSummary?.timeSensitive]
  );

  const workspaceSeverity = useMemo(
    () => deriveCaseSeverity(activeDocumentType, activeTimeSensitive, activeEarliestDeadline),
    [activeDocumentType, activeTimeSensitive, activeEarliestDeadline]
  );

  const workspaceSummaryText = useMemo(() => {
    const value = cases.selectedCase?.plainEnglishExplanation?.trim();
    if (language === "en" && value) return value;
    return fallbackSummaryForDocumentType(activeDocumentType, language);
  }, [cases.selectedCase?.plainEnglishExplanation, activeDocumentType, language]);

  const workspaceNextSteps = useMemo(
    () => buildRecommendedNextSteps(activeDocumentType, activeEarliestDeadline, language),
    [activeDocumentType, activeEarliestDeadline, language]
  );

  const classificationConfidenceValue = useMemo(
    () => cases.selectedCase?.classificationConfidence ?? cases.selectedCaseSummary?.classificationConfidence ?? null,
    [cases.selectedCase?.classificationConfidence, cases.selectedCaseSummary?.classificationConfidence]
  );

  const lawyerReadySummary = useMemo(() => {
    const caseTitle = cases.selectedCase?.title ?? cases.selectedCaseSummary?.title ?? (language === "es" ? "Caso sin titulo" : "Untitled case");
    
    const facts: string[] = [
      language === "es" ? `Titulo del caso: ${caseTitle}.` : `Case title: ${caseTitle}.`,
      language === "es" ? `Categoria del documento: ${manualCategoryLabel(activeDocumentType, "es")}.` : `Document category: ${manualCategoryLabel(activeDocumentType, "en")}.`,
      language === "es" ? `Senal sensible al tiempo: ${activeTimeSensitive ? "Detectada" : "No detectada actualmente"}.` : `Time-sensitive signal: ${activeTimeSensitive ? "Detected" : "Not currently detected"}.`
    ];

    const dates: string[] = [
      activeEarliestDeadline
        ? language === "es" ? `Fecha detectada mas cercana: ${fmtDate(activeEarliestDeadline, language)}.` : `Earliest detected date: ${fmtDate(activeEarliestDeadline, language)}.`
        : language === "es" ? "No se detecto una fecha explicita en la extraccion actual." : "No explicit deadline detected in current extraction."
    ];

    const parties: string[] = [];
    const accountName = cases.me?.user.fullName?.trim() || ui.email;
    if (accountName) {
      parties.push(language === "es" ? `Titular de la cuenta: ${accountName}.` : `Account holder: ${accountName}.`);
    }

    const openQuestions: string[] = [];
    if (!activeEarliestDeadline) {
      openQuestions.push(language === "es" ? "Existe una fecha de respuesta en paginas que todavia no se han cargado?" : "Is there a response date in pages that were not uploaded yet?");
    }

    const disclaimer = language === "es" ? "Solo para contexto informativo. No es asesoria legal." : cases.selectedCase?.nonLegalAdviceDisclaimer ?? "For informational context only. Not legal advice.";

    return {
      caseTitle,
      summary: workspaceSummaryText,
      facts,
      dates,
      parties,
      openQuestions,
      evidence: [],
      intakeOverview: [],
      communicationsLog: "",
      financialImpact: "",
      desiredOutcome: "",
      consultAgenda: openQuestions,
      nextSteps: workspaceNextSteps,
      disclaimer
    };
  }, [cases.selectedCase?.title, cases.selectedCaseSummary?.title, cases.selectedCase?.nonLegalAdviceDisclaimer, workspaceSummaryText, workspaceNextSteps, activeDocumentType, activeTimeSensitive, activeEarliestDeadline, language, cases.me?.user.fullName, ui.email]);

  return useMemo(() => ({
    activeDocumentType,
    activeEarliestDeadline,
    activeTimeSensitive,
    workspaceSeverity,
    workspaceSummaryText,
    workspaceNextSteps,
    classificationConfidenceValue,
    lawyerReadySummary
  }), [
    activeDocumentType,
    activeEarliestDeadline,
    activeTimeSensitive,
    workspaceSeverity,
    workspaceSummaryText,
    workspaceNextSteps,
    classificationConfidenceValue,
    lawyerReadySummary
  ]);
}
