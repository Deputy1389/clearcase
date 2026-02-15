import { useMemo } from "react";
import { 
  deriveCaseSeverity, 
  fallbackSummaryForDocumentType, 
  buildRecommendedNextSteps, 
  manualCategoryLabel 
} from "../../../utils/case-logic";
import { asStringArray, asRecord } from "../../../utils/parsing";

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
    return {
      caseTitle: cases.selectedCase?.title ?? "Untitled",
      summary: workspaceSummaryText,
      facts: [],
      dates: [],
      parties: [],
      openQuestions: [],
      evidence: [],
      intakeOverview: [],
      communicationsLog: "", // Will be merged in composer if needed
      financialImpact: "",
      desiredOutcome: "",
      consultAgenda: [],
      nextSteps: workspaceNextSteps,
      disclaimer: "Informational only."
    };
  }, [cases.selectedCase?.title, workspaceSummaryText, workspaceNextSteps]);

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
