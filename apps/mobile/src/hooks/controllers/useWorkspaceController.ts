import { useMemo } from "react";
import { useWorkspaceUI } from "./workspace/useWorkspaceUI";
import { useWorkspaceSummary } from "./workspace/useWorkspaceSummary";
import { useWorkspaceTimeline } from "./workspace/useWorkspaceTimeline";
import { useWorkspaceUpload } from "./workspace/useWorkspaceUpload";

export function useWorkspaceController(ui: any, cases: any) {
  const uiState = useWorkspaceUI(ui, cases);
  const summary = useWorkspaceSummary(ui, cases);
  const timeline = useWorkspaceTimeline(ui, cases, summary);
  const actions = useWorkspaceUpload(ui, cases, uiState);

  return useMemo(() => ({
    ...uiState,
    ...summary,
    ...timeline,
    ...actions,
    premiumActionSteps: [] // placeholder as before
  }), [uiState, summary, timeline, actions]);
}
