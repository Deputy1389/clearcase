import { useMemo } from "react";
import {
  computeLatestVerdictOutput,
  computeWorkspaceSeverity,
  computeWorkspaceSummaryText,
  computeWorkspaceNextSteps,
  computeUploadStatusText,
  computeDeadlineGuardReminders,
  computeTimelineRows,
  computeActionInstructions,
  computeDocumentFamily,
  normalizeExtractedFields,
  computeResponseSignals,
} from "./workspaceDerived";
import type { AppLanguage, CaseSeverity, UploadStage } from "../../../types";
import type { CaseDetail, CaseSummary } from "../../../api";

export type { TimelineRow, ActionInstruction, ResponseSignals } from "./workspaceDerived";

type DerivedInput = {
  language: AppLanguage;
  selectedCase: CaseDetail | null;
  selectedCaseSummary: CaseSummary | null;
  uploading: boolean;
  uploadStage: UploadStage;
};

export function useWorkspaceDerived(input: DerivedInput) {
  const { language, selectedCase, selectedCaseSummary, uploading, uploadStage } = input;

  const activeDocumentType = useMemo(
    () => selectedCase?.documentType ?? selectedCaseSummary?.documentType ?? null,
    [selectedCase?.documentType, selectedCaseSummary?.documentType]
  );

  const activeEarliestDeadline = useMemo(
    () => selectedCase?.earliestDeadline ?? selectedCaseSummary?.earliestDeadline ?? null,
    [selectedCase?.earliestDeadline, selectedCaseSummary?.earliestDeadline]
  );

  const activeTimeSensitive = useMemo(
    () => selectedCase?.timeSensitive ?? selectedCaseSummary?.timeSensitive ?? false,
    [selectedCase?.timeSensitive, selectedCaseSummary?.timeSensitive]
  );

  const latestVerdictOutput = useMemo(
    () => computeLatestVerdictOutput(selectedCase),
    [selectedCase?.verdicts]
  );

  const workspaceSeverity: CaseSeverity = useMemo(
    () => computeWorkspaceSeverity(activeDocumentType, activeTimeSensitive, activeEarliestDeadline),
    [activeDocumentType, activeTimeSensitive, activeEarliestDeadline]
  );

  const workspaceSummaryText = useMemo(
    () => computeWorkspaceSummaryText(selectedCase?.plainEnglishExplanation, activeDocumentType, language),
    [selectedCase?.plainEnglishExplanation, activeDocumentType, language]
  );

  const workspaceNextSteps = useMemo(
    () => computeWorkspaceNextSteps(activeDocumentType, activeEarliestDeadline, language),
    [activeDocumentType, activeEarliestDeadline, language]
  );

  const uploadStatusText = useMemo(
    () => computeUploadStatusText(uploading, uploadStage, language),
    [uploading, uploadStage, language]
  );

  const deadlineGuardReminders = useMemo(
    () => computeDeadlineGuardReminders(latestVerdictOutput),
    [latestVerdictOutput]
  );

  const timelineRows = useMemo(
    () => computeTimelineRows(latestVerdictOutput),
    [latestVerdictOutput]
  );

  const responseSignals = useMemo(() => {
    const family = computeDocumentFamily({ docType: activeDocumentType });
    const extracted = normalizeExtractedFields(latestVerdictOutput);
    return computeResponseSignals({
      family,
      extracted,
      activeEarliestDeadlineISO: activeEarliestDeadline,
    });
  }, [activeDocumentType, latestVerdictOutput, activeEarliestDeadline]);

  const actionInstructions = useMemo(
    () => computeActionInstructions({
      language,
      activeDocumentType,
      activeEarliestDeadlineISO: activeEarliestDeadline,
      activeTimeSensitive,
      extracted: latestVerdictOutput,
      latestVerdictOutput,
      responseSignals,
    }),
    [language, activeDocumentType, activeEarliestDeadline, activeTimeSensitive, latestVerdictOutput, responseSignals]
  );

  return useMemo(() => ({
    activeDocumentType,
    activeEarliestDeadline,
    activeTimeSensitive,
    latestVerdictOutput,
    workspaceSeverity,
    workspaceSummaryText,
    workspaceNextSteps,
    uploadStatusText,
    deadlineGuardReminders,
    timelineRows,
    actionInstructions,
    responseSignals,
  }), [
    activeDocumentType,
    activeEarliestDeadline,
    activeTimeSensitive,
    latestVerdictOutput,
    workspaceSeverity,
    workspaceSummaryText,
    workspaceNextSteps,
    uploadStatusText,
    deadlineGuardReminders,
    timelineRows,
    actionInstructions,
    responseSignals,
  ]);
}
