import { useCallback, useMemo } from "react";
import { Alert, Linking, Share, LayoutAnimation } from "react-native";
import { 
  getCaseAssetAccess, 
  getConsultPacketLinks, 
  getPlainMeaning, 
  saveCaseContext, 
  setCaseClassification, 
  setCaseWatchMode,
  createConsultPacketLink,
  disableConsultPacketLink,
  finalizeAssetUpload
} from "../../../api";
import { withNetworkHint, isPlusRequiredApiError, parseFreeLimitApiError, isFreeOcrDisabledApiError, formatLimitResetAt } from "../../../utils/error-helpers";
import { manualCategoryLabel } from "../../../utils/case-logic";

export function useWorkspaceUpload(ui: any, cases: any, uiState: any, upload: any) {
  const { language, apiBase, headers, offlineMode, showBanner, promptPlusUpgrade, openPaywall } = ui;
  const { selectedCaseId, selectedCase, loadDashboard, loadCase, loadCaseAssetsForSelectedCase } = cases;
  const { waitForCaseInsight } = upload;

  const toggleCaseWatchMode = useCallback(async () => {
    if (!uiState.plusEnabled) {
      promptPlusUpgrade("watch_mode");
      return;
    }
    if (!selectedCaseId) return;
    if (offlineMode) {
      showBanner("info", language === "es" ? "La revision semanal requiere conexion API." : "Weekly check-in needs API connectivity.");
      return;
    }

    const currentMode = uiState.caseWatchEnabled;
    const nextMode = !currentMode;

    uiState.setSavingWatchMode(true);
    try {
      await setCaseWatchMode(apiBase, headers, selectedCaseId, nextMode);
      await loadCase(selectedCaseId);
      showBanner("good", language === "es" ? (nextMode ? "Revision semanal activada." : "Revision semanal desactivada.") : (nextMode ? "Weekly check-in enabled." : "Weekly check-in disabled."));
    } catch (error) {
      showBanner("bad", `Could not update watch mode: ${withNetworkHint(error, apiBase)}`);
    } finally {
      uiState.setSavingWatchMode(false);
    }
  }, [uiState.plusEnabled, selectedCaseId, offlineMode, uiState.caseWatchEnabled, apiBase, headers, language, loadCase, showBanner, promptPlusUpgrade]);

  const loadConsultPacketLinks = useCallback(async (id: string) => {
    if (offlineMode) return;
    uiState.setLoadingConsultLinks(true);
    try {
      const data = await getConsultPacketLinks(apiBase, headers, id);
      uiState.setConsultLinks(data.links);
    } catch (error) {
      console.warn("Could not load consult links", error);
    } finally {
      uiState.setLoadingConsultLinks(false);
    }
  }, [offlineMode, apiBase, headers, uiState.setLoadingConsultLinks, uiState.setConsultLinks]);

  const createConsultPacketShareLink = useCallback(async () => {
    if (!selectedCaseId) return;
    if (offlineMode) {
      showBanner("info", "Link creation needs API connectivity.");
      return;
    }
    uiState.setCreatingConsultLink(true);
    try {
      await createConsultPacketLink(apiBase, headers, selectedCaseId);
      await loadConsultPacketLinks(selectedCaseId);
      showBanner("good", language === "es" ? "Enlace de consulta creado." : "Consult link created.");
    } catch (error) {
      showBanner("bad", `Could not create link: ${withNetworkHint(error, apiBase)}`);
    } finally {
      uiState.setCreatingConsultLink(false);
    }
  }, [selectedCaseId, offlineMode, apiBase, headers, language, loadConsultPacketLinks, showBanner]);

  const disableConsultPacketShareLink = useCallback(async (token: string) => {
    if (!selectedCaseId) return;
    uiState.setDisablingConsultToken(token);
    try {
      await disableConsultPacketLink(apiBase, headers, selectedCaseId, token);
      await loadConsultPacketLinks(selectedCaseId);
      showBanner("info", language === "es" ? "Enlace desactivado." : "Link disabled.");
    } catch (error) {
      showBanner("bad", `Could not disable link: ${withNetworkHint(error, apiBase)}`);
    } finally {
      uiState.setDisablingConsultToken(null);
    }
  }, [selectedCaseId, apiBase, headers, language, loadConsultPacketLinks, showBanner, uiState.setDisablingConsultToken]);

  const buildLawyerReadySummaryText = useCallback(() => {
    const s = uiState.lawyerReadySummary;
    const lines = [
      `# ${s.caseTitle}`,
      "",
      `## Summary`,
      s.summary,
      "",
      `## Facts`,
      ...s.facts.map((f: string) => `- ${f}`),
      "",
      `## Deadlines & Dates`,
      ...s.dates.map((d: string) => `- ${d}`),
      "",
      `## Open Questions`,
      ...s.openQuestions.map((q: string) => `- ${q}`),
      "",
      `## Evidence to Gather`,
      ...s.evidence.map((e: string) => `- ${e}`),
      "",
      `## Intake Overview`,
      ...s.intakeOverview.map((io: string) => `- ${io}`),
      "",
      `## Communications Log`,
      s.communicationsLog,
      "",
      `## Financial Impact`,
      s.financialImpact,
      "",
      `## Desired Outcome`,
      s.desiredOutcome,
      "",
      `## Consult Agenda`,
      ...s.consultAgenda.map((ca: string) => `- ${ca}`),
      "",
      `---`,
      s.disclaimer
    ];
    return lines.join("\n");
  }, [uiState.lawyerReadySummary]);

  const shareLawyerReadySummary = useCallback(async () => {
    const text = buildLawyerReadySummaryText();
    try {
      await Share.share({
        message: text,
        title: uiState.lawyerReadySummary.caseTitle
      });
    } catch (error) {
      Alert.alert("Share failed", "Could not open share sheet.");
    }
  }, [buildLawyerReadySummaryText, uiState.lawyerReadySummary.caseTitle]);

  const emailLawyerReadySummary = useCallback(async () => {
    const text = buildLawyerReadySummaryText();
    const subject = `ClearCase: Lawyer-Ready Summary - ${uiState.lawyerReadySummary.caseTitle}`;
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Email not supported", "No email app found to handle the request.");
      }
    } catch (error) {
      Alert.alert("Email failed", "Could not open email app.");
    }
  }, [buildLawyerReadySummaryText, uiState.lawyerReadySummary.caseTitle]);
  
  const openViewerUrlExternally = useCallback(async () => {
    if (uiState.assetViewerUrl) {
      try {
        await Linking.openURL(uiState.assetViewerUrl);
      } catch {
        Alert.alert("Error", "Could not open URL externally.");
      }
    }
  }, [uiState.assetViewerUrl]);

  const openAssetAccess = useCallback(async (assetId: string, action: string) => {
    if (offlineMode) {
      showBanner("info", "Asset access needs API connectivity.");
      return;
    }
    uiState.setAssetViewerLoading(true);
    try {
      const { accessUrl } = await getCaseAssetAccess(apiBase, headers, selectedCaseId, assetId, action as any);
      uiState.setAssetViewerUrl(accessUrl);
      const asset = selectedCase?.assets?.find((a: any) => a.id === assetId);
      uiState.setAssetViewerAsset(asset || { id: assetId, fileName: "Document", assetType: "pdf" });
      uiState.setAssetViewerPdfPage(1);
      uiState.setAssetViewerPdfZoom(100);
      uiState.setAssetViewerImageZoom(1);
      uiState.setAssetViewerImagePan({ x: 0, y: 0 });
      uiState.setAssetViewerOpen(true);
    } catch (error) {
      showBanner("bad", `Could not open file: ${withNetworkHint(error, apiBase)}`);
    } finally {
      uiState.setAssetViewerLoading(false);
    }
  }, [offlineMode, apiBase, headers, selectedCaseId, selectedCase?.assets, showBanner, uiState.setAssetViewerUrl, uiState.setAssetViewerAsset, uiState.setAssetViewerPdfPage, uiState.setAssetViewerPdfZoom, uiState.setAssetViewerImageZoom, uiState.setAssetViewerImagePan, uiState.setAssetViewerOpen, uiState.setAssetViewerLoading]);

  const openPlainMeaningTranslator = useCallback(async () => {
    if (!uiState.plusEnabled) {
      promptPlusUpgrade("watch_mode");
      return;
    }
    if (!selectedCaseId) return;
    if (offlineMode) {
      showBanner("info", language === "es" ? "La vista de significado simple requiere conexion API." : "Plain meaning view needs API connectivity.");
      return;
    }
    uiState.setLoadingPlainMeaning(true);
    try {
      const response = await getPlainMeaning(apiBase, headers, selectedCaseId, language);
      uiState.setPlainMeaningRows(response.rows);
      uiState.setPlainMeaningBoundary(response.boundary);
      uiState.setPlainMeaningOpen(true);
    } catch (error) {
      if (isPlusRequiredApiError(error)) {
        promptPlusUpgrade("watch_mode");
        return;
      }
      showBanner("bad", language === "es" ? `No se pudo cargar significado simple: ${withNetworkHint(error, apiBase)}` : `Could not load plain meaning: ${withNetworkHint(error, apiBase)}`);
    } finally {
      uiState.setLoadingPlainMeaning(false);
    }
  }, [uiState.plusEnabled, selectedCaseId, offlineMode, apiBase, headers, language, showBanner, promptPlusUpgrade, uiState.setLoadingPlainMeaning, uiState.setPlainMeaningRows, uiState.setPlainMeaningBoundary, uiState.setPlainMeaningOpen]);
  
  const saveCaseContextForSelectedCase = useCallback(async () => {
    const description = uiState.caseContextDraft.trim();
    if (!selectedCaseId) {
      Alert.alert("No case selected", "Open a case before saving context.");
      return;
    }
    if (!description) {
      Alert.alert("Context required", "Enter context to save.");
      return;
    }
    if (offlineMode) {
      showBanner("info", "Case context save needs API connectivity.");
      return;
    }

    uiState.setSavingCaseContext(true);
    try {
      await saveCaseContext(apiBase, headers, selectedCaseId, description);
      const latestAssetId = selectedCase?.assets?.[0]?.id ?? null;
      if (latestAssetId) {
        try {
          await finalizeAssetUpload(apiBase, headers, selectedCaseId, latestAssetId, {
            userDescription: description
          });
          showBanner("info", language === "es" ? "Contexto guardado. Se inicio reprocesamiento con este contexto." : "Case context saved. Reprocessing latest upload with this context...");
          await waitForCaseInsight(selectedCaseId, 12000);
        } catch (error) {
          const freeLimit = parseFreeLimitApiError(error);
          if (freeLimit) {
            const resetAtLabel = formatLimitResetAt(freeLimit.resetAt, language);
            const baseMessage = language === "es" ? "Aun puede revisar su caso. Plus reactiva procesamiento ahora y mantiene recordatorios, memoria y preparacion para consulta." : "You can still review your case. Plus re-enables new processing now and keeps reminders, memory, and consultation prep active.";
            const detail = language === "es" ? `Uso actual: ${freeLimit.used}/${freeLimit.limit}. En Free se reinicia al final del mes (${resetAtLabel}).` : `Current usage: ${freeLimit.used}/${freeLimit.limit}. Resets at month end on Free (${resetAtLabel}).`;
            showBanner("info", `${baseMessage} ${detail}`);
            openPaywall("context_reprocess_free_limit");
          } else if (isFreeOcrDisabledApiError(error)) {
            showBanner("info", language === "es" ? "Aun puede revisar su caso. Plus reactiva procesamiento ahora y mantiene recordatorios, memoria y preparacion para consulta." : "You can still review your case. Plus re-enables new processing now and keeps reminders, memory, and consultation prep active.");
            openPaywall("context_reprocess_ocr_disabled");
          } else {
            throw error;
          }
        }
      }
      await Promise.all([loadDashboard(), loadCase(selectedCaseId)]);
      showBanner("good", language === "es" ? "Contexto del caso guardado." : "Case context saved.");
    } catch (error) {
      const message = withNetworkHint(error, apiBase);
      showBanner("bad", `Could not save context: ${message}`);
      Alert.alert("Could not save context", message);
    } finally {
      uiState.setSavingCaseContext(false);
    }
  }, [uiState.caseContextDraft, selectedCaseId, offlineMode, apiBase, headers, selectedCase?.assets, language, showBanner, waitForCaseInsight, openPaywall, loadDashboard, loadCase, uiState.setSavingCaseContext]);

  const saveManualCategoryForSelectedCase = useCallback(async () => {
    if (!selectedCaseId) {
      Alert.alert("No case selected", "Open a case first.");
      return;
    }
    if (offlineMode) {
      showBanner("info", "Manual category update needs API connectivity.");
      return;
    }

    uiState.setSavingClassification(true);
    try {
      await setCaseClassification(apiBase, headers, selectedCaseId, uiState.classificationDraft as any);
      uiState.setClassificationSheetOpen(false);
      await Promise.all([loadDashboard(), loadCase(selectedCaseId)]);
      showBanner("good", language === "es" ? `Categoria actualizada a ${manualCategoryLabel(uiState.classificationDraft, "es")}.` : `Category updated to ${manualCategoryLabel(uiState.classificationDraft, "en")}.`);
    } catch (error) {
      const message = withNetworkHint(error, apiBase);
      showBanner("bad", `Could not update category: ${message}`);
      Alert.alert("Could not update category", message);
    } finally {
      uiState.setSavingClassification(false);
    }
  }, [selectedCaseId, offlineMode, apiBase, headers, uiState.classificationDraft, uiState.setClassificationSheetOpen, loadDashboard, loadCase, language, showBanner, uiState.setSavingClassification]);

  return useMemo(() => ({
    toggleCaseWatchMode,
    loadConsultPacketLinks,
    createConsultPacketShareLink,
    disableConsultPacketShareLink,
    buildLawyerReadySummaryText,
    shareLawyerReadySummary,
    emailLawyerReadySummary,
    openViewerUrlExternally,
    openAssetAccess,
    openPlainMeaningTranslator,
    saveCaseContextForSelectedCase,
    saveManualCategoryForSelectedCase
  }), [
    toggleCaseWatchMode,
    loadConsultPacketLinks,
    createConsultPacketShareLink,
    disableConsultPacketShareLink,
    buildLawyerReadySummaryText,
    shareLawyerReadySummary,
    emailLawyerReadySummary,
    openViewerUrlExternally,
    openAssetAccess,
    openPlainMeaningTranslator,
    saveCaseContextForSelectedCase,
    saveManualCategoryForSelectedCase
  ]);
}
