import { useMemo } from "react";
import { useWorkspaceUI } from "./workspace/useWorkspaceUI";
import { useWorkspaceSummary } from "./workspace/useWorkspaceSummary";
import { useWorkspaceTimeline } from "./workspace/useWorkspaceTimeline";
import { useWorkspaceUpload } from "./workspace/useWorkspaceUpload";

export function useWorkspaceController(ui: any, cases: any, upload: any) {
  const uiState = useWorkspaceUI(ui, cases);
  const summary = useWorkspaceSummary(ui, cases, uiState);
  const timeline = useWorkspaceTimeline(ui, cases, summary, uiState);
  const actions = useWorkspaceUpload(ui, cases, uiState, upload);

  return useMemo(() => ({
    ...uiState,
    ...summary,
    ...timeline,
    ...actions
  }), [uiState, summary, timeline, actions]);
}
