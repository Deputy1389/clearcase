import type { AuthHeaders } from "../api";
import type { AppLanguage, BannerTone, UploadStage, UploadAssetInput } from "../types";
import { useUploadState, type UseUploadStateReturn } from "./useUploadState";
import { 
  useUploadProcessing, 
  type UseUploadProcessingDeps, 
  type UseUploadProcessingCallbacks,
  type UseUploadProcessingReturn 
} from "./useUploadProcessing";

// Re-export types
export type { UseUploadStateReturn, UseUploadProcessingDeps, UseUploadProcessingCallbacks };

// Combined return type
export interface UseUploadReturn extends UseUploadStateReturn, UseUploadProcessingReturn {}

// Dependencies for the combined hook
export interface UseUploadDeps {
  apiBase: string;
  headers: AuthHeaders;
  language: AppLanguage;
  offlineMode: boolean;
  showBanner: (tone: BannerTone, text: string) => void;
}

// Combined hook
export function useUpload(deps: UseUploadDeps): UseUploadReturn {
  const state = useUploadState();
  const processing = useUploadProcessing(deps, state);

  return {
    // State from useUploadState
    uploading: state.uploading,
    setUploading: state.setUploading,
    uploadStage: state.uploadStage,
    setUploadStage: state.setUploadStage,
    uploadDescription: state.uploadDescription,
    setUploadDescription: state.setUploadDescription,
    uploadTargetCaseId: state.uploadTargetCaseId,
    setUploadTargetCaseId: state.setUploadTargetCaseId,
    uploadCaseTitle: state.uploadCaseTitle,
    setUploadCaseTitle: state.setUploadCaseTitle,
    uploadSheetOpen: state.uploadSheetOpen,
    setUploadSheetOpen: state.setUploadSheetOpen,
    latestContextReuseSourceCaseId: state.latestContextReuseSourceCaseId,
    setLatestContextReuseSourceCaseId: state.setLatestContextReuseSourceCaseId,
    // Operations from useUploadProcessing
    uploadAssets: processing.uploadAssets,
    uploadDocument: processing.uploadDocument,
    uploadFromCamera: processing.uploadFromCamera,
    beginFileUpload: processing.beginFileUpload,
    beginCameraUpload: processing.beginCameraUpload,
    homeUploadFlow: processing.homeUploadFlow,
    openUploadSheetForCase: processing.openUploadSheetForCase,
    waitForCaseInsight: processing.waitForCaseInsight,
    callbacks: processing.callbacks
  };
}
