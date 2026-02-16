import { useMemo } from "react";
import { useWorkspaceUI } from "./workspace/useWorkspaceUI";
import { useWorkspaceSummary } from "./workspace/useWorkspaceSummary";
import { useWorkspaceTimeline } from "./workspace/useWorkspaceTimeline";
import { useWorkspaceUpload } from "./workspace/useWorkspaceUpload";
import { useGuidedAssistance } from "./workspace/useGuidedAssistance";

export function useWorkspaceController(ui: any, cases: any, upload: any) {
  const uiState = useWorkspaceUI(ui, cases);
  const summary = useWorkspaceSummary(ui, cases, uiState);
  const timeline = useWorkspaceTimeline(ui, cases, summary, uiState);
  const actions = useWorkspaceUpload(ui, cases, uiState, upload, summary, timeline);
  const guided = useGuidedAssistance(cases.selectedCaseId);

  return useMemo(() => ({
    ...uiState,
    ...summary,
    ...timeline,
    ...actions,
    ...guided
  }), [uiState, summary, timeline, actions, guided]);
}
