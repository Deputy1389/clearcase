import { useMemo } from "react";
import { useUpload } from "../useUpload";

export function useUploadController(ui: any, cases: any) {
  const {
    uploading, setUploading,
    uploadStage, setUploadStage,
    uploadDescription, setUploadDescription,
    uploadTargetCaseId, setUploadTargetCaseId,
    uploadCaseTitle, setUploadCaseTitle,
    uploadSheetOpen, setUploadSheetOpen,
    latestContextReuseSourceCaseId, setLatestContextReuseSourceCaseId,
    uploadAssets, uploadDocument, uploadFromCamera,
    beginFileUpload, beginCameraUpload, homeUploadFlow, openUploadSheetForCase,
    waitForCaseInsight,
    callbacks: uploadCallbacks
  } = useUpload({
    apiBase: ui.apiBase,
    headers: ui.headers,
    language: ui.language,
    offlineMode: ui.offlineMode,
    showBanner: ui.showBanner
  });

  // Wire callbacks
  uploadCallbacks.current = {
    createCaseWithTitle: cases.createCaseWithTitle,
    loadCase: cases.loadCase,
    loadDashboard: cases.loadDashboard,
    loadCaseAssetsForSelectedCase: cases.loadCaseAssetsForSelectedCase,
    setCases: cases.setCases,
    setSelectedCaseId: cases.setSelectedCaseId,
    setSelectedCase: cases.setSelectedCase,
    setScreen: ui.setScreen,
    sendTrackedEvent: async () => {}, // TODO
    reconnectWorkspace: cases.refreshWorkspace,
    openPaywall: ui.openPaywall
  };

  return useMemo(() => ({
    uploading, setUploading,
    uploadStage, setUploadStage,
    uploadDescription, setUploadDescription,
    uploadTargetCaseId, setUploadTargetCaseId,
    uploadCaseTitle, setUploadCaseTitle,
    uploadSheetOpen, setUploadSheetOpen,
    latestContextReuseSourceCaseId, setLatestContextReuseSourceCaseId,
    uploadAssets, uploadDocument, uploadFromCamera,
    beginFileUpload, beginCameraUpload, homeUploadFlow, openUploadSheetForCase,
    waitForCaseInsight,
    uploadCallbacks
  }), [
    uploading, uploadStage, uploadDescription, uploadTargetCaseId,
    uploadCaseTitle, uploadSheetOpen, latestContextReuseSourceCaseId,
    uploadAssets, uploadDocument, uploadFromCamera,
    beginFileUpload, beginCameraUpload, homeUploadFlow, openUploadSheetForCase,
    waitForCaseInsight, uploadCallbacks
  ]);
}
