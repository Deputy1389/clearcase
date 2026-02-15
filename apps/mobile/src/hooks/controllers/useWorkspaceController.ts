import { useMemo } from "react";
import { useWorkspaceUI } from "./workspace/useWorkspaceUI";
import { useWorkspaceSummary } from "./workspace/useWorkspaceSummary";
import { useWorkspaceTimeline } from "./workspace/useWorkspaceTimeline";
import { useWorkspaceUpload } from "./workspace/useWorkspaceUpload";
import { useWorkspaceDerived } from "./workspace/useWorkspaceDerived";

export function useWorkspaceController(ui: any, cases: any, upload: any) {
  const uiState = useWorkspaceUI(ui, cases);
  const summary = useWorkspaceSummary(ui, cases);
  const timeline = useWorkspaceTimeline(ui, cases, summary);
  const actions = useWorkspaceUpload(ui, cases, uiState);
  const derived = useWorkspaceDerived({
    language: ui.language,
    selectedCase: cases.selectedCase,
    selectedCaseSummary: cases.selectedCaseSummary,
    uploading: upload.uploading ?? false,
    uploadStage: upload.uploadStage ?? "idle",
  });

  return useMemo(() => ({
    ...uiState,
    ...summary,
    ...timeline,
    ...actions,
    ...derived,
    premiumActionSteps: [] // placeholder as before
  }), [uiState, summary, timeline, actions, derived]);
}
