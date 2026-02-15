import { useState } from "react";
import type { UploadStage } from "../types";

export interface UseUploadStateReturn {
  // Upload state
  uploading: boolean;
  setUploading: React.Dispatch<React.SetStateAction<boolean>>;
  uploadStage: UploadStage;
  setUploadStage: React.Dispatch<React.SetStateAction<UploadStage>>;
  uploadDescription: string;
  setUploadDescription: React.Dispatch<React.SetStateAction<string>>;
  uploadTargetCaseId: string | null;
  setUploadTargetCaseId: React.Dispatch<React.SetStateAction<string | null>>;
  uploadCaseTitle: string;
  setUploadCaseTitle: React.Dispatch<React.SetStateAction<string>>;
  uploadSheetOpen: boolean;
  setUploadSheetOpen: React.Dispatch<React.SetStateAction<boolean>>;
  latestContextReuseSourceCaseId: string | null;
  setLatestContextReuseSourceCaseId: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useUploadState(): UseUploadStateReturn {
  const [uploading, setUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState<UploadStage>("idle");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadTargetCaseId, setUploadTargetCaseId] = useState<string | null>(null);
  const [uploadCaseTitle, setUploadCaseTitle] = useState("");
  const [uploadSheetOpen, setUploadSheetOpen] = useState(false);
  const [latestContextReuseSourceCaseId, setLatestContextReuseSourceCaseId] = useState<string | null>(null);

  return {
    uploading,
    setUploading,
    uploadStage,
    setUploadStage,
    uploadDescription,
    setUploadDescription,
    uploadTargetCaseId,
    setUploadTargetCaseId,
    uploadCaseTitle,
    setUploadCaseTitle,
    uploadSheetOpen,
    setUploadSheetOpen,
    latestContextReuseSourceCaseId,
    setLatestContextReuseSourceCaseId,
  };
}
