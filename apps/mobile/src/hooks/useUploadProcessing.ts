import { useRef } from "react";
import { Alert } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import type { AuthHeaders, CaseDetail } from "../api";
import { createAssetUploadPlan, finalizeAssetUpload, getCaseById } from "../api";
import { compressUploadImage } from "../utils/upload-helpers";
import {
  withNetworkHint,
  parseFreeLimitApiError,
  isFreeOcrDisabledApiError,
  formatLimitResetAt
} from "../utils/error-helpers";
import { titleize, sleep } from "../utils/formatting";
import type { AppLanguage, BannerTone, UploadStage, UploadAssetInput } from "../types";

// Local helpers
function buildAutoCaseTitle(rawTitle?: string | null): string {
  const cleaned = (rawTitle ?? "")
    .replace(/\.[^.]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned) return cleaned.slice(0, 120);
  return `Uploaded Document - ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

function askTakeAnotherPhoto(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert("Photo added", "Take another photo?", [
      { text: "Done", onPress: () => resolve(false), style: "cancel" },
      { text: "Take another", onPress: () => resolve(true) }
    ]);
  });
}

export interface UseUploadProcessingDeps {
  apiBase: string;
  headers: AuthHeaders;
  language: AppLanguage;
  offlineMode: boolean;
  showBanner: (tone: BannerTone, text: string) => void;
}

export interface UseUploadProcessingCallbacks {
  createCaseWithTitle: (title?: string) => Promise<string | null>;
  loadCase: (caseId: string, base?: string, auth?: AuthHeaders) => Promise<void>;
  loadDashboard: (base?: string, auth?: AuthHeaders) => Promise<void>;
  loadCaseAssetsForSelectedCase: (caseId: string, base?: string, auth?: AuthHeaders) => Promise<void>;
  setCases: React.Dispatch<React.SetStateAction<any[]>>;
  setSelectedCaseId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedCase: React.Dispatch<React.SetStateAction<any>>;
  setScreen: React.Dispatch<React.SetStateAction<any>>;
  sendTrackedEvent: (event: string, source?: string, properties?: Record<string, unknown>) => Promise<void>;
  reconnectWorkspace: () => Promise<void>;
  openPaywall: (triggerSource: string) => void;
}

export interface UseUploadProcessingState {
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

export interface UseUploadProcessingReturn {
  uploadAssets: (assets: UploadAssetInput[], caseIdArg?: string, userDescription?: string, preferredCaseTitle?: string) => Promise<void>;
  uploadDocument: (caseIdArg?: string, userDescription?: string, preferredCaseTitle?: string) => Promise<void>;
  uploadFromCamera: (caseIdArg?: string, userDescription?: string, preferredCaseTitle?: string) => Promise<void>;
  beginFileUpload: () => Promise<void>;
  beginCameraUpload: () => Promise<void>;
  homeUploadFlow: () => Promise<void>;
  openUploadSheetForCase: (caseId: string | null) => Promise<void>;
  waitForCaseInsight: (caseId: string, maxWaitMs?: number) => Promise<CaseDetail | null>;
  callbacks: React.MutableRefObject<UseUploadProcessingCallbacks>;
}

export function useUploadProcessing(
  deps: UseUploadProcessingDeps,
  state: UseUploadProcessingState
): UseUploadProcessingReturn {
  const { apiBase, headers, language, offlineMode, showBanner } = deps;
  const {
    uploading, setUploading,
    uploadStage, setUploadStage,
    uploadDescription, setUploadDescription,
    uploadTargetCaseId, setUploadTargetCaseId,
    uploadCaseTitle, setUploadCaseTitle,
    uploadSheetOpen, setUploadSheetOpen,
    latestContextReuseSourceCaseId, setLatestContextReuseSourceCaseId
  } = state;

  const callbacks = useRef<UseUploadProcessingCallbacks>({
    createCaseWithTitle: async () => null,
    loadCase: async () => {},
    loadDashboard: async () => {},
    loadCaseAssetsForSelectedCase: async () => {},
    setCases: () => {},
    setSelectedCaseId: () => {},
    setSelectedCase: () => {},
    setScreen: () => {},
    sendTrackedEvent: async () => {},
    reconnectWorkspace: async () => {},
    openPaywall: () => {}
  });

  // Polling helper
  async function waitForCaseInsight(caseId: string, maxWaitMs = 20000): Promise<CaseDetail | null> {
    if (offlineMode) return null;
    const startedAt = Date.now();
    let lastSeen: CaseDetail | null = null;

    while (Date.now() - startedAt < maxWaitMs) {
      try {
        const found = await getCaseById(apiBase, headers, caseId);
        lastSeen = found;
        const hasInsight =
          Boolean(found.documentType) ||
          Boolean(found.plainEnglishExplanation) ||
          found.extractions.length > 0 ||
          found.verdicts.length > 0;
        if (hasInsight) return found;
      } catch {
        // Keep polling window short; transient fetch failures are handled by caller.
      }
      await sleep(2000);
    }
    return lastSeen;
  }

  // Core upload orchestration
  async function uploadAssets(
    assets: UploadAssetInput[],
    caseIdArg?: string,
    userDescription?: string,
    preferredCaseTitle?: string
  ): Promise<void> {
    const cb = callbacks.current;

    if (offlineMode) {
      Alert.alert("Offline mode", "Uploads need API connectivity.", [
        { text: "Retry connection", onPress: () => void cb.reconnectWorkspace() },
        { text: "Open workspace", onPress: () => cb.setScreen("workspace") },
        { text: "Cancel", style: "cancel" }
      ]);
      return;
    }
    if (assets.length === 0) {
      setUploadStage("idle");
      return;
    }

    let caseId = caseIdArg ?? null;
    if (!caseId) {
      const baseTitle = buildAutoCaseTitle(preferredCaseTitle);
      caseId = await cb.createCaseWithTitle(baseTitle);
    }
    if (!caseId) {
      setUploadStage("idle");
      Alert.alert("Could not start case", "We could not create a case from this upload. Please retry.");
      return;
    }

    setUploading(true);
    void cb.sendTrackedEvent("upload_started", "asset_upload_flow", {
      caseId: caseIdArg ?? null,
      fileCount: assets.length
    });

    try {
      let uploadedCount = 0;
      let crossCaseReuseSource: string | null = null;

      for (const sourceFile of assets) {
        setUploadStage("preparing");
        const file = await compressUploadImage(sourceFile);
        const blob = await (await fetch(file.uri)).blob();
        const safeFileName = (file.name ?? "").trim() || `upload-${Date.now()}.bin`;
        const plan = await createAssetUploadPlan(apiBase, headers, caseId, {
          fileName: safeFileName,
          mimeType: file.mimeType ?? "application/octet-stream",
          byteSize: file.size ?? blob.size
        });

        setUploadStage("sending");
        const response = await fetch(plan.uploadUrl, {
          method: plan.uploadMethod,
          headers: plan.uploadHeaders,
          body: blob
        });
        if (!response.ok) throw new Error("Upload failed (" + response.status + ")");
        const finalized = await finalizeAssetUpload(apiBase, headers, caseId, plan.assetId, {
          userDescription: userDescription?.trim() || undefined
        });
        if (finalized.contextReuse?.reused && finalized.contextReuse.sourceCaseId) {
          crossCaseReuseSource = finalized.contextReuse.sourceCaseId;
        }
        uploadedCount += 1;
      }

      setUploadStage("processing");
      cb.setSelectedCaseId(caseId);
      await Promise.all([cb.loadDashboard(), cb.loadCase(caseId)]);
      await cb.loadCaseAssetsForSelectedCase(caseId);
      cb.setScreen("workspace");

      const uploadedCountText = uploadedCount > 1 ? `${uploadedCount} files uploaded.` : "Upload complete.";
      if (crossCaseReuseSource) {
        setLatestContextReuseSourceCaseId(crossCaseReuseSource);
        showBanner(
          "info",
          `${uploadedCountText} Saved details were reused to reduce repeat entry. Processing started in workspace.`
        );
      } else {
        setLatestContextReuseSourceCaseId(null);
        showBanner("info", `${uploadedCountText} Processing started in workspace.`);
      }

      void cb.sendTrackedEvent("upload_completed", "asset_upload_flow", {
        caseId,
        fileCount: uploadedCount,
        reusedCrossCaseMemory: Boolean(crossCaseReuseSource)
      });

      // Background insight polling after upload succeeds
      void (async () => {
        try {
          const caseAfterUpload = await waitForCaseInsight(caseId, 12000);
          if (!caseAfterUpload) {
            showBanner("info", "Still processing. Pull to refresh in Workspace in a few seconds.");
            return;
          }

          await Promise.all([cb.loadDashboard(), cb.loadCase(caseId)]);
          await cb.loadCaseAssetsForSelectedCase(caseId);
          if (caseAfterUpload.earliestDeadline) {
            void cb.sendTrackedEvent("first_deadline_detected", "asset_upload_flow", {
              caseId,
              earliestDeadline: caseAfterUpload.earliestDeadline
            });
          }
          const detectedType = caseAfterUpload.documentType ?? null;
          if (
            detectedType &&
            detectedType !== "unknown_legal_document" &&
            detectedType !== "non_legal_or_unclear_image"
          ) {
            showBanner("good", `Auto-detected: ${titleize(detectedType)}.`);
          } else {
            showBanner(
              "info",
              "Upload complete. We could not confidently identify a legal document yet. Add upload context and clearer legal pages for better extraction."
            );
          }
        } catch {
          showBanner("info", "Upload succeeded. Insight is still processing.");
        }
      })();
    } catch (error) {
      const freeLimit = parseFreeLimitApiError(error);
      if (freeLimit) {
        const resetAtLabel = formatLimitResetAt(freeLimit.resetAt, language);
        const baseMessage =
          language === "es"
            ? "Aun puede revisar su caso. Plus reactiva procesamiento ahora y mantiene recordatorios, memoria y preparacion para consulta."
            : "You can still review your case. Plus re-enables new processing now and keeps reminders, memory, and consultation prep active.";
        const detail =
          language === "es"
            ? `Uso actual: ${freeLimit.used}/${freeLimit.limit}. En Free se reinicia al final del mes (${resetAtLabel}).`
            : `Current usage: ${freeLimit.used}/${freeLimit.limit}. Resets at month end on Free (${resetAtLabel}).`;
        showBanner("info", `${baseMessage} ${detail}`);
        cb.openPaywall("free_limit_reached");
        Alert.alert(
          language === "es" ? "Se alcanzo el limite mensual de Free" : "Free monthly limit reached",
          `${baseMessage}\n\n${detail}`,
          [
            {
              text: language === "es" ? "Activar Plus" : "Unlock Plus",
              onPress: () => cb.openPaywall("free_limit_reached")
            },
            {
              text: language === "es" ? "Ahora no" : "Not now",
              style: "cancel"
            }
          ]
        );
        return;
      }

      if (isFreeOcrDisabledApiError(error)) {
        const message =
          language === "es"
            ? "Aun puede revisar su caso. Plus reactiva procesamiento ahora y mantiene recordatorios, memoria y preparacion para consulta."
            : "You can still review your case. Plus re-enables new processing now and keeps reminders, memory, and consultation prep active.";
        showBanner("info", message);
        cb.openPaywall("free_ocr_disabled");
        Alert.alert(language === "es" ? "Se alcanzo el limite mensual de Free" : "Free monthly limit reached", message, [
          { text: language === "es" ? "Activar Plus" : "Unlock Plus", onPress: () => cb.openPaywall("free_ocr_disabled") },
          { text: language === "es" ? "Ahora no" : "Not now", style: "cancel" }
        ]);
        return;
      }

      const message = withNetworkHint(error, apiBase);
      showBanner("bad", "Upload failed: " + message);
      Alert.alert("Upload failed", message);
    } finally {
      setUploading(false);
      setUploadStage("idle");
    }
  }

  // Document picker upload
  async function uploadDocument(
    caseIdArg?: string,
    userDescription?: string,
    preferredCaseTitle?: string
  ): Promise<void> {
    setUploadStage("picking");
    const picked = await DocumentPicker.getDocumentAsync({
      type: ["image/*", "application/pdf"],
      multiple: true,
      copyToCacheDirectory: true
    });
    if (picked.canceled || picked.assets.length === 0) {
      setUploadStage("idle");
      return;
    }
    await uploadAssets(
      picked.assets.map((file) => ({
        uri: file.uri,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size
      })),
      caseIdArg,
      userDescription,
      preferredCaseTitle
    );
  }

  // Camera upload
  async function uploadFromCamera(
    caseIdArg?: string,
    userDescription?: string,
    preferredCaseTitle?: string
  ): Promise<void> {
    const cb = callbacks.current;

    if (offlineMode) {
      Alert.alert("Offline mode", "Uploads need API connectivity.", [
        { text: "Retry connection", onPress: () => void cb.reconnectWorkspace() },
        { text: "Open workspace", onPress: () => cb.setScreen("workspace") },
        { text: "Cancel", style: "cancel" }
      ]);
      return;
    }

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Camera permission needed", "Allow camera access to capture photos.");
      return;
    }

    setUploadStage("picking");
    const captured: Array<{ uri: string; name: string; mimeType?: string | null; size?: number | null }> = [];
    let keepTaking = true;

    while (keepTaking) {
      const shot = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.5
      });
      if (shot.canceled || shot.assets.length === 0) break;

      const image = shot.assets[0];
      const generatedName = image.fileName ?? `camera-${Date.now()}-${captured.length + 1}.jpg`;
      captured.push({
        uri: image.uri,
        name: generatedName,
        mimeType: image.mimeType ?? "image/jpeg",
        size: (image as { fileSize?: number | null }).fileSize ?? null
      });
      keepTaking = await askTakeAnotherPhoto();
    }

    if (captured.length === 0) {
      setUploadStage("idle");
      return;
    }
    await uploadAssets(captured, caseIdArg, userDescription, preferredCaseTitle);
  }

  // Sheet / flow entry points
  async function openUploadSheetForCase(caseId: string | null): Promise<void> {
    setUploadTargetCaseId(caseId);
    setUploadDescription("");
    setUploadCaseTitle("");
    setUploadSheetOpen(true);
  }

  async function homeUploadFlow(): Promise<void> {
    await openUploadSheetForCase(null);
  }

  async function beginFileUpload(): Promise<void> {
    const description = uploadDescription.trim();
    const caseTitle = uploadCaseTitle.trim();
    const targetCaseId = uploadTargetCaseId;
    setUploadSheetOpen(false);
    setUploadDescription("");
    setUploadCaseTitle("");
    setUploadTargetCaseId(null);
    await uploadDocument(targetCaseId ?? undefined, description, caseTitle || undefined);
  }

  async function beginCameraUpload(): Promise<void> {
    const description = uploadDescription.trim();
    const caseTitle = uploadCaseTitle.trim();
    const targetCaseId = uploadTargetCaseId;
    setUploadSheetOpen(false);
    setUploadDescription("");
    setUploadCaseTitle("");
    setUploadTargetCaseId(null);
    await uploadFromCamera(targetCaseId ?? undefined, description, caseTitle || undefined);
  }

  return {
    uploadAssets,
    uploadDocument,
    uploadFromCamera,
    beginFileUpload,
    beginCameraUpload,
    homeUploadFlow,
    openUploadSheetForCase,
    waitForCaseInsight,
    callbacks
  };
}
