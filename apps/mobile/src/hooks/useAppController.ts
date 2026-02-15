import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, LayoutAnimation, PanResponder, Platform, Share, Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CaseAsset, CaseSummary, ConsultPacketLink, MeResponse, PlainMeaningRow, ManualDocumentType } from "../api";
import { createConsultPacketLink, disableConsultPacketLink, finalizeAssetUpload, getCaseAssetAccess, getConsultPacketLinks, getPlainMeaning, patchMe, patchNotificationPreferences, registerPushDevice, saveCaseContext, setCaseClassification, setCaseWatchMode, trackEvent } from "../api";
import { DEMO_CASES, DEMO_CASE_DETAIL_MAP } from "../data/demo-cases";
import type { AppLanguage, PremiumActionStep, PremiumStepGroup, StepProgress, WorkspaceAccordionKey, PacketHistoryEntry, OnboardingSlide } from "../types";
import { useAuth } from "./useAuth";
import { useCases } from "./useCases";
import { useConnection } from "./useConnection";
import { useLanguage } from "./useLanguage";
import { useNavigation } from "./useNavigation";
import { usePaywall } from "./usePaywall";
import { useUpload } from "./useUpload";
import { buildRecommendedNextSteps, deriveCaseSeverity, manualCategoryLabel, severityLabel, severitySummary, isManualDocumentType, casePriorityLevel, casePriorityLabel } from "../utils/case-logic";
import { clamp, fmtDate, fmtDateTime, localizedConfidenceLabel, titleize } from "../utils/formatting";
import { asRecord, asStringArray, emptyIntakeDraft, intakeStorageKey, parseIntakeDraft, parseLanguage, parsePlanTier, parseStepProgress, stepStatusStorageKey } from "../utils/parsing";
import { withNetworkHint, summarizeError, isPlusRequiredApiError, parseFreeLimitApiError, isFreeOcrDisabledApiError, formatLimitResetAt } from "../utils/error-helpers";
import type { IntakeDraft, PlanTier } from "../types";
import { STORAGE_API_BASE, STORAGE_EMAIL, STORAGE_OFFLINE_SESSION, STORAGE_ONBOARDED, STORAGE_PLAN_TIER, STORAGE_PUSH_DEVICE_ID, STORAGE_SUBJECT, DEFAULT_EMAIL, DEFAULT_SUBJECT } from "../constants";
import { ENV_API_BASE, DEFAULT_API_BASE, isLoopbackHost, isLocalApiBase, isLoopbackApiBase, isPrivateIpv4Host, extractHostFromApiBase, buildHeaders } from "../utils/network";
import { onboardingSlidesByLanguage } from "../data/onboarding-slides";

export function useAppController() {
  // Initialize all hooks
  const { language, setLanguage, setLanguageWithPersistence, loadPersistedLanguage } = useLanguage();
  const { screen, setScreen, postLanguageScreen, setPostLanguageScreen, goBack } = useNavigation();
  const [slide, setSlide] = useState(0);

  const {
    apiBase, setApiBase,
    apiBaseInput, setApiBaseInput,
    connStatus, setConnStatus,
    connMessage, setConnMessage,
    offlineMode, setOfflineMode,
    banner, setBanner,
    subject, setSubject,
    subjectInput, setSubjectInput,
    email, setEmail,
    emailInput, setEmailInput,
    headers,
    showBanner,
    verifyConnection,
    detectLanApiBase,
    persistConnection,
    applyConnection
  } = useConnection();

  const {
    paywallConfig, setPaywallConfig,
    planTier, setPlanTier,
    startingCheckout,
    planSheetOpen, setPlanSheetOpen,
    loadPaywallConfigState,
    startPlusCheckout,
    openPaywall,
    promptPlusUpgrade,
    callbacks: paywallCallbacks
  } = usePaywall({ apiBase, headers, language, offlineMode, showBanner });

  const {
    me, setMe,
    cases, setCases,
    selectedCaseId, setSelectedCaseId,
    selectedCase, setSelectedCase,
    caseAssets, setCaseAssets,
    loadingCaseAssets, setLoadingCaseAssets,
    profileName, setProfileName,
    profileZip, setProfileZip,
    newCaseTitle, setNewCaseTitle,
    caseSearch, setCaseSearch,
    caseFilter, setCaseFilter,
    loadingDashboard, setLoadingDashboard,
    loadingCase, setLoadingCase,
    creatingCase,
    savingProfile,
    refreshing,
    selectedCaseSummary,
    latestCase,
    userFirstName,
    filteredCases,
    loadDashboard,
    loadCase,
    loadCaseAssetsForSelectedCase,
    createCaseWithTitle,
    saveProfile,
    refreshWorkspace,
    reconnectWorkspace,
    callbacks: casesCallbacks
  } = useCases({
    apiBase, headers, language, offlineMode, showBanner,
    verifyConnection, setConnStatus, setConnMessage, setOfflineMode, email
  });

  const {
    uploading, setUploading,
    uploadStage, setUploadStage,
    uploadDescription, setUploadDescription,
    uploadTargetCaseId, setUploadTargetCaseId,
    uploadCaseTitle, setUploadCaseTitle,
    uploadSheetOpen, setUploadSheetOpen,
    latestContextReuseSourceCaseId, setLatestContextReuseSourceCaseId,
    uploadAssets, uploadDocument, uploadFromCamera,
    beginFileUpload, beginCameraUpload,
    homeUploadFlow, openUploadSheetForCase,
    waitForCaseInsight,
    callbacks: uploadCallbacks
  } = useUpload({
    apiBase, headers, language, offlineMode, showBanner
  });

  // Local state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lawyerSummaryOpen, setLawyerSummaryOpen] = useState(false);
  const [assetViewerOpen, setAssetViewerOpen] = useState(false);
  const [assetViewerAsset, setAssetViewerAsset] = useState<CaseAsset | null>(null);
  const [assetViewerUrl, setAssetViewerUrl] = useState<string | null>(null);
  const [assetViewerPdfPage, setAssetViewerPdfPage] = useState(1);
  const [assetViewerPdfZoom, setAssetViewerPdfZoom] = useState(100);
  const [assetViewerImageZoom, setAssetViewerImageZoom] = useState(1);
  const [assetViewerImagePan, setAssetViewerImagePan] = useState({ x: 0, y: 0 });
  const [assetViewerImageBounds, setAssetViewerImageBounds] = useState({ width: 320, height: 340 });
  const [assetViewerLoading, setAssetViewerLoading] = useState(false);
  const assetViewerImagePanRef = useRef({ x: 0, y: 0 });
  const assetViewerImagePanStartRef = useRef({ x: 0, y: 0 });
  const [plainMeaningOpen, setPlainMeaningOpen] = useState(false);
  const [loadingPlainMeaning, setLoadingPlainMeaning] = useState(false);
  const [plainMeaningRows, setPlainMeaningRows] = useState<PlainMeaningRow[]>([]);
  const [plainMeaningBoundary, setPlainMeaningBoundary] = useState("");
  const [intakeModalOpen, setIntakeModalOpen] = useState(false);
  const [consultLinks, setConsultLinks] = useState<ConsultPacketLink[]>([]);
  const [loadingConsultLinks, setLoadingConsultLinks] = useState(false);
  const [creatingConsultLink, setCreatingConsultLink] = useState(false);
  const [disablingConsultToken, setDisablingConsultToken] = useState<string | null>(null);
  const [caseContextDraft, setCaseContextDraft] = useState("");
  const [classificationSheetOpen, setClassificationSheetOpen] = useState(false);
  const [classificationDraft, setClassificationDraft] = useState<string>("unknown_legal_document");
  const [legalReturnScreen, setLegalReturnScreen] = useState<typeof screen>("home");
  const [legalAidSearch, setLegalAidSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushQuietHoursEnabled, setPushQuietHoursEnabled] = useState(false);
  const [savingPushPreferences, setSavingPushPreferences] = useState(false);

  const {
    authMode, setAuthMode,
    authName, setAuthName,
    authZip, setAuthZip,
    authEmail, setAuthEmail,
    authPassword, setAuthPassword,
    authIntent, setAuthIntent,
    authBusy, setAuthBusy,
    authStage, setAuthStage,
    isBootstrapping, setIsBootstrapping,
    signOut,
    bootstrapOfflineSession,
    agreeAndContinue,
    resolveAuthApiBase
  } = useAuth(
    {
      apiBase, setApiBase, apiBaseInput, setApiBaseInput,
      email, setEmail, setEmailInput,
      subject, setSubject, setSubjectInput,
      headers, offlineMode, setOfflineMode,
      setConnStatus, setConnMessage,
      showBanner, detectLanApiBase, persistConnection
    },
    {
      language,
      resetAppState: () => {
        setDrawerOpen(false);
        setMe(null);
        setCases([]);
        setSelectedCaseId(null);
        setSelectedCase(null);
        setScreen("auth");
        setPlanTier("free");
        setPushEnabled(false);
        setPushQuietHoursEnabled(false);
      },
      applyOfflineSession: (offMe, offCases, firstId) => {
        setMe(offMe);
        setCases(offCases);
        setSelectedCaseId(firstId);
        setSelectedCase(firstId ? (DEMO_CASE_DETAIL_MAP[firstId] ?? null) : null);
        setProfileName(offMe.user.fullName ?? "");
        setProfileZip(offMe.user.zipCode ?? "");
        setPlanTier("plus");
        setPushEnabled(false);
        setPushQuietHoursEnabled(false);
      },
      applyServerMeState: (...args) => applyServerMeStateRef.current(...args),
      applyAuthSuccess: (nextCases, firstId) => {
        setCases(nextCases);
        setSelectedCaseId(firstId);
        setScreen("home");
      },
      applyOfflineFallback: () => {
        setScreen("home");
      }
    }
  );

  // Define applyServerMeState as a ref first to avoid circular dependency
  const applyServerMeStateRef = useRef<(meData: MeResponse, base: string, auth: { "x-auth-subject": string; "x-user-email": string }) => Promise<void>>(async () => {});

  const [savingCaseContext, setSavingCaseContext] = useState(false);
  const [savingClassification, setSavingClassification] = useState(false);
  const [savingWatchMode, setSavingWatchMode] = useState(false);
  const [intakeDraft, setIntakeDraft] = useState(emptyIntakeDraft());
  const [stepProgressMap, setStepProgressMap] = useState<Record<string, StepProgress>>({});
  const [workspaceSectionOpen, setWorkspaceSectionOpen] = useState<Record<WorkspaceAccordionKey, boolean>>({
    steps: false,
    watch: false,
    packet: false,
    context: false,
    category: false,
    summary: false,
    plain_meaning: false,
    timeline: false
  });

  // Define the actual applyServerMeState function
  async function applyServerMeState(meData: MeResponse, base: string, auth: { "x-auth-subject": string; "x-user-email": string }): Promise<void> {
    setMe(meData);
    setProfileName(meData.user.fullName ?? "");
    setProfileZip(meData.user.zipCode ?? "");

    const resolvedTier: PlanTier = meData.entitlement?.isPlus ? "plus" : "free";
    setPlanTier(resolvedTier);
    setPushEnabled(Boolean(meData.pushPreferences?.enabled));
    setPushQuietHoursEnabled(
      Boolean(meData.pushPreferences?.quietHoursStart && meData.pushPreferences?.quietHoursEnd)
    );

    try {
      await AsyncStorage.setItem(STORAGE_PLAN_TIER, resolvedTier);
    } catch {
      // Ignore storage failures.
    }
  }

  // Update the ref
  applyServerMeStateRef.current = applyServerMeState;

  // Derived values
  const plusEnabled = me?.entitlement?.isPlus ?? false;
  const onboardingSlides = useMemo(() => onboardingSlidesByLanguage[language], [language]);

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
  const workspaceSeverity = useMemo(
    () => deriveCaseSeverity(activeDocumentType, activeTimeSensitive, activeEarliestDeadline),
    [activeDocumentType, activeTimeSensitive, activeEarliestDeadline]
  );

  const workspaceSummaryText = useMemo(() => {
    const value = selectedCase?.plainEnglishExplanation?.trim();
    if (language === "en" && value) return value;
    return "Case summary unavailable.";
  }, [selectedCase?.plainEnglishExplanation, language]);

  const workspaceNextSteps = useMemo(
    () => buildRecommendedNextSteps(activeDocumentType, activeEarliestDeadline, language),
    [activeDocumentType, activeEarliestDeadline, language]
  );

  const workspaceSectionMeta = useMemo(() => {
    return {
      steps: {
        title: language === "es" ? "Pasos recomendados" : "Recommended next steps",
        summary: language === "es" ? "Checklist dinamico" : "Dynamic checklist"
      },
      watch: {
        title: language === "es" ? "Revision semanal del caso" : "Weekly case check-in",
        summary: plusEnabled
          ? language === "es"
            ? "Plus activo"
            : "Plus active"
          : language === "es"
            ? "Vista previa"
            : "Preview"
      },
      context: {
        title: language === "es" ? "Contexto del caso" : "Case context",
        summary: language === "es" ? "Ayuda en cargas futuras" : "Helps future uploads"
      },
      packet: {
        title: language === "es" ? "Paquete para consulta con abogado" : "Lawyer prep packet",
        summary: language === "es" ? "Intake + paquete" : "Intake + packet"
      },
      category: {
        title: language === "es" ? "Categoria del documento" : "Document category",
        summary: manualCategoryLabel(selectedCase?.documentType ?? selectedCaseSummary?.documentType ?? null, language)
      },
      summary: {
        title: language === "es" ? "Resumen en lenguaje claro" : "Plain-language summary",
        summary: language === "es" ? "Automatico" : "Automated"
      },
      plain_meaning: {
        title: language === "es" ? "Vista de significado simple" : "Plain meaning view",
        summary: plusEnabled ? (language === "es" ? "Plus activo" : "Plus active") : "Plus"
      },
      timeline: {
        title: language === "es" ? "Cronologia del caso" : "Case timeline",
        summary: selectedCase
          ? `${selectedCase.assets.length} ${language === "es" ? "archivos" : "assets"}`
          : language === "es"
            ? "Sin caso"
            : "No case"
      }
    } as const;
  }, [
    language,
    plusEnabled,
    selectedCase?.assets.length,
    selectedCase?.documentType,
    selectedCaseSummary?.documentType
  ]);

  function toggleWorkspaceSection(key: WorkspaceAccordionKey): void {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setWorkspaceSectionOpen((current) => ({
      ...current,
      [key]: !current[key]
    }));
  }

  async function selectInitialLanguage(nextLanguage: AppLanguage): Promise<void> {
    await setLanguageWithPersistence(nextLanguage);
    if (postLanguageScreen === "onboarding") {
      setSlide(0);
    }
    setScreen(postLanguageScreen);
  }

  async function applyLanguageFromSettings(nextLanguage: AppLanguage): Promise<void> {
    if (nextLanguage === language) return;
    await setLanguageWithPersistence(nextLanguage);
    if (!offlineMode) {
      try {
        const updated = await patchNotificationPreferences(apiBase, headers, {
          language: nextLanguage
        });
        setPushEnabled(updated.pushPreferences.enabled);
        setPushQuietHoursEnabled(
          Boolean(updated.pushPreferences.quietHoursStart && updated.pushPreferences.quietHoursEnd)
        );
        setMe((current) =>
          current
            ? {
                ...current,
                pushPreferences: updated.pushPreferences
              }
            : current
        );
      } catch {
        // Ignore preference sync failures during language switch.
      }
    }
    void registerDefaultPushDevice(apiBase, headers, nextLanguage);
    showBanner(
      "good",
      nextLanguage === "es" ? "Idioma cambiado a Espanol." : "Language set to English."
    );
  }

  async function updatePushPreferences(input: {
    enabled?: boolean;
    quietHoursStart?: string | null;
    quietHoursEnd?: string | null;
    language?: AppLanguage;
  }): Promise<void> {
    if (offlineMode) {
      showBanner(
        "info",
        language === "es"
          ? "Las preferencias de notificaciones necesitan conexion API."
          : "Notification preferences need API connectivity."
      );
      return;
    }
    setSavingPushPreferences(true);
    try {
      const response = await patchNotificationPreferences(apiBase, headers, input);
      setPushEnabled(response.pushPreferences.enabled);
      setPushQuietHoursEnabled(
        Boolean(response.pushPreferences.quietHoursStart && response.pushPreferences.quietHoursEnd)
      );
      setMe((current) =>
        current
          ? {
              ...current,
              pushPreferences: response.pushPreferences
            }
          : current
      );
      showBanner(
        "good",
        language === "es" ? "Preferencias de notificaciones guardadas." : "Notification preferences saved."
      );
    } catch (error) {
      showBanner(
        "bad",
        language === "es"
          ? `No se pudieron guardar las notificaciones: ${withNetworkHint(error, apiBase)}`
          : `Could not save notifications: ${withNetworkHint(error, apiBase)}`
      );
    } finally {
      setSavingPushPreferences(false);
    }
  }

  async function togglePushNotifications(): Promise<void> {
    await updatePushPreferences({
      enabled: !pushEnabled,
      language
    });
  }

  async function togglePushQuietHours(): Promise<void> {
    if (!pushEnabled) {
      showBanner(
        "info",
        language === "es"
          ? "Activa notificaciones antes de configurar horas de silencio."
          : "Enable notifications before setting quiet hours."
      );
      return;
    }
    if (pushQuietHoursEnabled) {
      await updatePushPreferences({
        quietHoursStart: null,
        quietHoursEnd: null
      });
    } else {
      await updatePushPreferences({
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00"
      });
    }
  }

  async function toggleCaseWatchMode(): Promise<void> {
    if (!plusEnabled) {
      promptPlusUpgrade("watch_mode");
      return;
    }
    if (!selectedCaseId) {
      Alert.alert(
        language === "es" ? "Sin caso seleccionado" : "No case selected",
        language === "es" ? "Abre un caso antes de activar el seguimiento." : "Open a case before enabling watch mode."
      );
      return;
    }
    if (offlineMode) {
      showBanner("info", language === "es" ? "El modo seguimiento requiere conexion API." : "Case watch mode needs API connectivity.");
      return;
    }

    setSavingWatchMode(true);
    try {
      const nextEnabled = !caseWatchEnabled;
      await setCaseWatchMode(apiBase, headers, selectedCaseId, nextEnabled);
      await loadCase(selectedCaseId);
      showBanner(
        "good",
        nextEnabled
          ? language === "es"
            ? "Modo seguimiento activado."
            : "Case Watch Mode is active."
          : language === "es"
            ? "Modo seguimiento desactivado."
            : "Case Watch Mode is off."
      );
    } catch (error) {
      if (isPlusRequiredApiError(error)) {
        promptPlusUpgrade("watch_mode");
        return;
      }
      showBanner(
        "bad",
        language === "es"
          ? `No se pudo actualizar el modo seguimiento: ${withNetworkHint(error, apiBase)}`
          : `Could not update watch mode: ${withNetworkHint(error, apiBase)}`
      );
    } finally {
      setSavingWatchMode(false);
    }
  }

  async function loadConsultPacketLinks(caseId: string): Promise<void> {
    if (offlineMode) {
      setConsultLinks([]);
      return;
    }
    if (!plusEnabled) {
      setConsultLinks([]);
      return;
    }
    setLoadingConsultLinks(true);
    try {
      const response = await getConsultPacketLinks(apiBase, headers, caseId);
      setConsultLinks(response.links);
    } catch (error) {
      if (isPlusRequiredApiError(error)) {
        promptPlusUpgrade("consult_links");
        return;
      }
      showBanner("bad", `Could not load consult links: ${withNetworkHint(error, apiBase)}`);
    } finally {
      setLoadingConsultLinks(false);
    }
  }

  async function createConsultPacketShareLink(): Promise<void> {
    if (!plusEnabled) {
      promptPlusUpgrade("consult_links");
      return;
    }
    if (!selectedCaseId) {
      Alert.alert(
        language === "es" ? "Sin caso seleccionado" : "No case selected",
        language === "es" ? "Abre un caso antes de crear un enlace para compartir." : "Open a case before creating a share link."
      );
      return;
    }
    if (offlineMode) {
      showBanner("info", language === "es" ? "Los enlaces para compartir requieren conexion API." : "Share links need API connectivity.");
      return;
    }
    setCreatingConsultLink(true);
    try {
      const created = await createConsultPacketLink(apiBase, headers, selectedCaseId, { expiresInDays: 7 });
      showBanner(
        "good",
        language === "es"
          ? "Enlace creado. El acceso estara activo por 7 dias."
          : "Share link created. Access is active for 7 days."
      );
      await loadConsultPacketLinks(selectedCaseId);
      await Share.share({
        title:
          language === "es"
            ? `Enlace del paquete de consulta - ${lawyerReadySummary.caseTitle}`
            : `Consult packet link - ${lawyerReadySummary.caseTitle}`,
        message:
          language === "es"
            ? `Enlace activo por 7 dias: ${created.shareUrl}`
            : `Share link active for 7 days: ${created.shareUrl}`
      });
    } catch (error) {
      if (isPlusRequiredApiError(error)) {
        promptPlusUpgrade("consult_links");
        return;
      }
      showBanner(
        "bad",
        language === "es"
          ? `No se pudo crear el enlace: ${withNetworkHint(error, apiBase)}`
          : `Could not create share link: ${withNetworkHint(error, apiBase)}`
      );
    } finally {
      setCreatingConsultLink(false);
    }
  }

  async function disableConsultPacketShareLink(linkId: string): Promise<void> {
    if (!plusEnabled) {
      promptPlusUpgrade("consult_links");
      return;
    }
    if (!selectedCaseId || offlineMode) return;
    setDisablingConsultToken(linkId);
    try {
      await disableConsultPacketLink(apiBase, headers, selectedCaseId, linkId);
      showBanner("good", language === "es" ? "Enlace desactivado." : "Share link disabled.");
      await loadConsultPacketLinks(selectedCaseId);
    } catch (error) {
      if (isPlusRequiredApiError(error)) {
        promptPlusUpgrade("consult_links");
        return;
      }
      showBanner(
        "bad",
        language === "es"
          ? `No se pudo desactivar el enlace: ${withNetworkHint(error, apiBase)}`
          : `Could not disable share link: ${withNetworkHint(error, apiBase)}`
      );
    } finally {
      setDisablingConsultToken(null);
    }
  }

  function buildLawyerReadySummaryText(): string {
    const sections: string[] = [];
    sections.push(language === "es" ? "Paquete de consulta de ClearCase" : "ClearCase Lawyer-Ready Packet");
    sections.push(
      language === "es"
        ? `Generado: ${new Date().toLocaleString()}`
        : `Generated: ${new Date().toLocaleString()}`
    );
    sections.push(language === "es" ? `Caso: ${lawyerReadySummary.caseTitle}` : `Case: ${lawyerReadySummary.caseTitle}`);
    sections.push("");
    sections.push(language === "es" ? "Resumen en lenguaje claro:" : "Plain-language summary:");
    sections.push(lawyerReadySummary.summary);
    sections.push("");
    sections.push(language === "es" ? "Hechos clave:" : "Key facts:");
    for (const item of lawyerReadySummary.facts) sections.push(`- ${item}`);
    sections.push("");
    sections.push(language === "es" ? "Fechas detectadas:" : "Detected dates:");
    for (const item of lawyerReadySummary.dates) sections.push(`- ${item}`);
    sections.push("");
    sections.push(language === "es" ? "Partes y jurisdiccion:" : "Parties and jurisdiction:");
    for (const item of lawyerReadySummary.parties) sections.push(`- ${item}`);
    sections.push("");
    sections.push(language === "es" ? "Resumen de intake formal:" : "Formal intake snapshot:");
    for (const item of lawyerReadySummary.intakeOverview) sections.push(`- ${item}`);
    sections.push("");
    sections.push(language === "es" ? "Registro de comunicaciones:" : "Communications log:");
    sections.push(lawyerReadySummary.communicationsLog);
    sections.push("");
    sections.push(language === "es" ? "Impacto financiero:" : "Financial impact:");
    sections.push(lawyerReadySummary.financialImpact);
    sections.push("");
    sections.push(language === "es" ? "Resultado deseado:" : "Desired outcome:");
    sections.push(lawyerReadySummary.desiredOutcome);
    sections.push("");
    sections.push(language === "es" ? "Lista de evidencia:" : "Evidence checklist:");
    for (const item of lawyerReadySummary.evidence) sections.push(`- ${item}`);
    sections.push("");
    sections.push(language === "es" ? "Preguntas abiertas:" : "Open questions:");
    for (const item of lawyerReadySummary.openQuestions) sections.push(`- ${item}`);
    sections.push("");
    sections.push(language === "es" ? "Agenda sugerida para consulta:" : "Suggested consult agenda:");
    for (const item of lawyerReadySummary.consultAgenda) sections.push(`- ${item}`);
    sections.push("");
    sections.push(language === "es" ? "Pasos que algunas personas consideran utiles:" : "Steps people often find useful:");
    for (const item of lawyerReadySummary.nextSteps) sections.push(`- ${item}`);
    sections.push("");
    sections.push(language === "es" ? "Indicador de ahorro de costos:" : "Cost-saving indicator:");
    sections.push(costSavingIndicator.message);
    sections.push(costSavingIndicator.assumptions);
    sections.push("");
    sections.push(language === "es" ? `Aviso: ${lawyerReadySummary.disclaimer}` : `Disclaimer: ${lawyerReadySummary.disclaimer}`);
    return sections.join("\n");
  }

  async function shareLawyerReadySummary(): Promise<void> {
    const message = buildLawyerReadySummaryText();
    try {
      await Share.share({
        title:
          language === "es"
            ? `Paquete de consulta - ${lawyerReadySummary.caseTitle}`
            : `Lawyer-ready packet - ${lawyerReadySummary.caseTitle}`,
        message
      });
    } catch (error) {
      showBanner(
        "bad",
        language === "es"
          ? `No se pudo compartir el paquete: ${summarizeError(error)}`
          : `Could not share summary: ${summarizeError(error)}`
      );
    }
  }

  async function emailLawyerReadySummary(): Promise<void> {
    const subject =
      language === "es"
        ? `Paquete de consulta: ${lawyerReadySummary.caseTitle}`
        : `Lawyer-ready packet: ${lawyerReadySummary.caseTitle}`;
    const body = buildLawyerReadySummaryText();
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        await shareLawyerReadySummary();
        return;
      }
      await Linking.openURL(url);
    } catch (error) {
      showBanner(
        "bad",
        language === "es"
          ? `No se pudo abrir el borrador de correo: ${summarizeError(error)}`
          : `Could not open email draft: ${summarizeError(error)}`
      );
    }
  }

  async function completeOnboarding(): Promise<void> {
    setSlide(0);
    setScreen("auth");
    try {
      await AsyncStorage.setItem(STORAGE_ONBOARDED, "1");
    } catch {
      // Ignore storage failures.
    }
  }

  function currentPushPlatform(): "ios" | "android" | "web" {
    if (Platform.OS === "ios") return "ios";
    if (Platform.OS === "android") return "android";
    return "web";
  }

  async function getOrCreatePushDeviceId(): Promise<string> {
    const existing = await AsyncStorage.getItem(STORAGE_PUSH_DEVICE_ID);
    if (existing?.trim()) return existing.trim();
    const generated = `dev-${currentPushPlatform()}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    await AsyncStorage.setItem(STORAGE_PUSH_DEVICE_ID, generated);
    return generated;
  }

  async function registerDefaultPushDevice(base: string, auth: { "x-auth-subject": string; "x-user-email": string }, lang: AppLanguage): Promise<void> {
    if (offlineMode) return;
    try {
      const deviceId = await getOrCreatePushDeviceId();
      // Try to get a real Expo push token; fall back to synthetic token for dev
      // (requestExpoPushToken would need to be moved/available here too)
      const token = `clearcase-dev-${deviceId}`;
      await registerPushDevice(base, auth, {
        deviceId,
        platform: currentPushPlatform(),
        token,
        language: lang
      });
    } catch {
      // Registration is best-effort and should not block core app usage.
    }
  }

  function closeAssetViewer(): void {
    setAssetViewerOpen(false);
    setAssetViewerAsset(null);
    setAssetViewerUrl(null);
    setAssetViewerPdfPage(1);
    setAssetViewerPdfZoom(100);
    setAssetViewerImageZoom(1);
    setAssetViewerImagePan({ x: 0, y: 0 });
    setAssetViewerLoading(false);
  }

  function buildViewerUrlWithPdfControls(source: string, page: number, zoom: number): string {
    const clean = source.split("#")[0];
    return `${clean}#page=${Math.max(1, page)}&zoom=${Math.max(50, Math.min(300, zoom))}`;
  }

  async function openViewerUrlExternally(): Promise<void> {
    if (!assetViewerUrl) return;
    try {
      await Linking.openURL(assetViewerUrl);
    } catch {
      // No-op fallback.
    }
  }

  async function openAssetAccess(assetId: string, action: "view" | "download"): Promise<void> {
    if (!selectedCaseId) return;
    if (offlineMode) {
      showBanner(
        "info",
        language === "es"
          ? "La vista de documentos requiere conexion API."
          : "Document viewing requires API connectivity."
      );
      return;
    }
    try {
      const access = await getCaseAssetAccess(apiBase, headers, selectedCaseId, assetId, action);
      if (action === "download") {
        await Linking.openURL(access.accessUrl);
        return;
      }
      const asset = caseAssets.find((row) => row.id === assetId) ?? null;
      setAssetViewerLoading(true);
      setAssetViewerAsset(asset);
      setAssetViewerPdfPage(1);
      setAssetViewerPdfZoom(100);
      setAssetViewerImageZoom(1);
      setAssetViewerImagePan({ x: 0, y: 0 });
      setAssetViewerUrl(access.accessUrl);
      setAssetViewerOpen(true);
    } catch (error) {
      showBanner(
        "bad",
        language === "es"
          ? `No se pudo abrir el archivo: ${withNetworkHint(error, apiBase)}`
          : `Could not open file: ${withNetworkHint(error, apiBase)}`
      );
    }
  }

  async function openPlainMeaningTranslator(): Promise<void> {
    if (!plusEnabled) {
      promptPlusUpgrade("watch_mode");
      return;
    }
    if (!selectedCaseId) return;
    if (offlineMode) {
      showBanner(
        "info",
        language === "es"
          ? "La vista de significado simple requiere conexion API."
          : "Plain meaning view needs API connectivity."
      );
      return;
    }
    setLoadingPlainMeaning(true);
    try {
      const response = await getPlainMeaning(apiBase, headers, selectedCaseId, language);
      setPlainMeaningRows(response.rows);
      setPlainMeaningBoundary(response.boundary);
      setPlainMeaningOpen(true);
    } catch (error) {
      if (isPlusRequiredApiError(error)) {
        promptPlusUpgrade("watch_mode");
        return;
      }
      showBanner(
        "bad",
        language === "es"
          ? `No se pudo cargar significado simple: ${withNetworkHint(error, apiBase)}`
          : `Could not load plain meaning: ${withNetworkHint(error, apiBase)}`
      );
    } finally {
      setLoadingPlainMeaning(false);
    }
  }

  async function saveCaseContextForSelectedCase(): Promise<void> {
    const description = caseContextDraft.trim();
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

    setSavingCaseContext(true);
    try {
      await saveCaseContext(apiBase, headers, selectedCaseId, description);
      const latestAssetId = selectedCase?.assets?.[0]?.id ?? null;
      if (latestAssetId) {
        try {
          await finalizeAssetUpload(apiBase, headers, selectedCaseId, latestAssetId, {
            userDescription: description
          });
          showBanner(
            "info",
            language === "es"
              ? "Contexto guardado. Se inicio reprocesamiento con este contexto."
              : "Case context saved. Reprocessing latest upload with this context..."
          );
          await waitForCaseInsight(selectedCaseId, 12000);
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
            openPaywall("context_reprocess_free_limit");
          } else if (isFreeOcrDisabledApiError(error)) {
            showBanner(
              "info",
              language === "es"
                ? "Aun puede revisar su caso. Plus reactiva procesamiento ahora y mantiene recordatorios, memoria y preparacion para consulta."
                : "You can still review your case. Plus re-enables new processing now and keeps reminders, memory, and consultation prep active."
            );
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
      setSavingCaseContext(false);
    }
  }

  function openManualCategoryPicker(): void {
    if (!selectedCaseId) {
      Alert.alert("No case selected", "Open a case first.");
      return;
    }
    setClassificationSheetOpen(true);
  }

  async function saveManualCategoryForSelectedCase(): Promise<void> {
    if (!selectedCaseId) {
      Alert.alert("No case selected", "Open a case first.");
      return;
    }
    if (offlineMode) {
      showBanner("info", "Manual category update needs API connectivity.");
      return;
    }

    setSavingClassification(true);
    try {
      await setCaseClassification(apiBase, headers, selectedCaseId, classificationDraft as any);
      setClassificationSheetOpen(false);
      await Promise.all([loadDashboard(), loadCase(selectedCaseId)]);
      showBanner(
        "good",
        language === "es"
          ? `Categoria actualizada a ${manualCategoryLabel(classificationDraft, "es")}.`
          : `Category updated to ${manualCategoryLabel(classificationDraft, "en")}.`
      );
    } catch (error) {
      const message = withNetworkHint(error, apiBase);
      showBanner("bad", `Could not update category: ${message}`);
      Alert.alert("Could not update category", message);
    } finally {
      setSavingClassification(false);
    }
  }

  function stepGroupLabel(group: PremiumStepGroup): string {
    if (language === "es") {
      if (group === "now") return "Ahora";
      if (group === "this_week") return "Esta semana";
      if (group === "before_consult") return "Antes de consulta";
      return "Despues de nueva carga";
    }
    if (group === "now") return "Now";
    if (group === "this_week") return "This week";
    if (group === "before_consult") return "Before consult";
    return "After new upload";
  }

  function intakeSectionLabel(key: keyof IntakeDraft): string {
    const labelsEn: Record<keyof IntakeDraft, string> = {
      matterSummary: "Matter Summary",
      clientGoals: "Client Goals",
      constraints: "Constraints",
      timelineNarrative: "Timeline Narrative",
      partiesAndRoles: "Parties and Roles",
      communicationsLog: "Communications Log",
      financialImpact: "Financial Impact",
      questionsForCounsel: "Questions for Counsel",
      desiredOutcome: "Desired Outcome"
    };
    const labelsEs: Record<keyof IntakeDraft, string> = {
      matterSummary: "Resumen del asunto",
      clientGoals: "Objetivos de la persona",
      constraints: "Restricciones",
      timelineNarrative: "Cronologia narrativa",
      partiesAndRoles: "Partes y roles",
      communicationsLog: "Registro de comunicaciones",
      financialImpact: "Impacto financiero",
      questionsForCounsel: "Preguntas para asesoria",
      desiredOutcome: "Resultado deseado"
    };
    return language === "es" ? labelsEs[key] : labelsEn[key];
  }

  function intakePlaceholder(key: keyof IntakeDraft): string {
    if (language === "es") {
      const labelsEs: Record<keyof IntakeDraft, string> = {
        matterSummary: "Describe el asunto en 3-5 lineas y su estado actual.",
        clientGoals: "Que resultado te gustaria obtener en consulta.",
        constraints: "Tiempo, presupuesto, idioma, disponibilidad u otras limitaciones.",
        timelineNarrative: "Linea de tiempo breve (eventos y fechas aproximadas).",
        partiesAndRoles: "Quien esta involucrado y que relacion tiene con el caso.",
        communicationsLog: "Mensajes o llamadas importantes y fechas aproximadas.",
        financialImpact: "Costos, perdidas, cobros o montos discutidos.",
        questionsForCounsel: "Preguntas que te gustaria cubrir durante la consulta.",
        desiredOutcome: "Como se veria un resultado razonable para ti."
      };
      return labelsEs[key];
    }
    const labelsEn: Record<keyof IntakeDraft, string> = {
      matterSummary: "Describe the matter in 3-5 lines and current state.",
      clientGoals: "What outcome would you like from consultation.",
      constraints: "Time, budget, language, availability, or other limits.",
      timelineNarrative: "Short timeline narrative (events and approximate dates).",
      partiesAndRoles: "Who is involved and each role in the matter.",
      communicationsLog: "Important messages/calls and approximate dates.",
      financialImpact: "Costs, losses, claims, or amounts in dispute.",
      questionsForCounsel: "Questions you want to cover during consultation.",
      desiredOutcome: "What a reasonable outcome would look like for you."
    };
    return labelsEn[key];
  }

  const completion = useMemo(() => {
    if (!me) return 0;
    const count = [me.user.fullName, me.user.zipCode, me.user.jurisdictionState].filter(Boolean).length;
    return Math.round((count / 3) * 100);
  }, [me]);

  const classificationConfidenceValue = useMemo(
    () => selectedCase?.classificationConfidence ?? selectedCaseSummary?.classificationConfidence ?? null,
    [selectedCase?.classificationConfidence, selectedCaseSummary?.classificationConfidence]
  );

  function localizedCaseStatus(value: string | null | undefined, language: AppLanguage = "en"): string {
    const normalized = (value ?? "").trim().toLowerCase();
    if (!normalized) return language === "es" ? "Abierto" : "Open";

    if (language === "es") {
      if (normalized === "open") return "Abierto";
      if (normalized === "closed") return "Cerrado";
      if (normalized === "archived") return "Archivado";
      if (normalized === "pending") return "Pendiente";
      if (normalized === "in_progress") return "En progreso";
    }

    return titleize(normalized);
  }

  function extractCaseContextFromAuditLogs(auditLogs: Array<{ payload: unknown }> | undefined): string {
    if (!auditLogs || auditLogs.length === 0) return "";
    for (const row of auditLogs) {
      if (!row.payload || typeof row.payload !== "object" || Array.isArray(row.payload)) {
        continue;
      }
      const payload = row.payload as Record<string, unknown>;
      if (payload.subtype !== "case_context_set") continue;
      const description = payload.description;
      if (typeof description === "string" && description.trim()) {
        return description.trim();
      }
    }
    return "";
  }

  function extractCaseWatchModeFromAuditLogs(auditLogs: Array<{ payload: unknown }> | undefined): boolean {
    if (!auditLogs || auditLogs.length === 0) return false;
    for (const row of auditLogs) {
      if (!row.payload || typeof row.payload !== "object" || Array.isArray(row.payload)) {
        continue;
      }
      const payload = row.payload as Record<string, unknown>;
      if (payload.subtype !== "case_watch_mode_set") continue;
      if (typeof payload.enabled === "boolean") {
        return payload.enabled;
      }
    }
    return false;
  }

  function buildPacketHistoryEntries(
    auditLogs: Array<{ eventType: string; createdAt: string; payload: unknown }> | undefined,
    language: AppLanguage
  ): PacketHistoryEntry[] {
    if (!auditLogs || auditLogs.length === 0) return [];

    const rows = [...auditLogs].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    const history: PacketHistoryEntry[] = [];

    for (const row of rows) {
      const payload = asRecord(row.payload);
      const subtype = typeof payload?.subtype === "string" ? payload.subtype : "";

      if (subtype === "asset_uploaded_enqueued") {
        history.push({
          version: history.length + 1,
          reason:
            history.length === 0
              ? language === "es"
                ? "carga inicial"
                : "initial upload"
              : language === "es"
                ? "despues de nueva carga"
                : "after new upload",
          createdAt: row.createdAt
        });
        continue;
      }

      if (subtype === "case_context_set") {
        history.push({
          version: history.length + 1,
          reason: language === "es" ? "despues de agregar contexto" : "after context added",
          createdAt: row.createdAt
        });
        continue;
      }

      if (subtype === "manual_document_type_set") {
        history.push({
          version: history.length + 1,
          reason: language === "es" ? "despues de actualizar categoria" : "after category update",
          createdAt: row.createdAt
        });
      }
    }

    return history.slice(-8);
  }

  const lawyerReadySummary = useMemo(() => {
    const caseTitle = selectedCase?.title ?? selectedCaseSummary?.title ?? (language === "es" ? "Caso sin titulo" : "Untitled case");
    const status = localizedCaseStatus(selectedCase?.status ?? selectedCaseSummary?.status ?? "open", language);
    const category = manualCategoryLabel(activeDocumentType, language);
    const verdictOutput = asRecord(selectedCase?.verdicts?.[0]?.outputJson);
    const evidenceFromVerdict = asStringArray(verdictOutput?.evidenceToGather);
    const uncertainty = asRecord(verdictOutput?.uncertainty);
    const uncertaintyNotes = asStringArray(uncertainty?.notes);

    const facts: string[] = [
      language === "es" ? `Titulo del caso: ${caseTitle}.` : `Case title: ${caseTitle}.`,
      language === "es" ? `Categoria del documento: ${category}.` : `Document category: ${category}.`,
      language === "es" ? `Estado actual: ${status}.` : `Current status: ${status}.`,
      language === "es"
        ? `Senal sensible al tiempo: ${activeTimeSensitive ? "Detectada" : "No detectada actualmente"}.`
        : `Time-sensitive signal: ${activeTimeSensitive ? "Detected" : "Not currently detected"}.`
    ];

    if (selectedCase?.id) {
      facts.push(language === "es" ? `ID del caso: ${selectedCase.id}.` : `Case id: ${selectedCase.id}.`);
    }

    const dates: string[] = [
      activeEarliestDeadline
        ? language === "es"
          ? `Fecha detectada mas cercana: ${fmtDate(activeEarliestDeadline, language)}.`
          : `Earliest detected date: ${fmtDate(activeEarliestDeadline, language)}.`
        : language === "es"
          ? "No se detecto una fecha explicita en la extraccion actual."
          : "No explicit deadline detected in current extraction."
    ];
    if (selectedCase?.updatedAt ?? selectedCaseSummary?.updatedAt) {
      dates.push(
        language === "es"
          ? `Ultima actualizacion: ${fmtDateTime(selectedCase?.updatedAt ?? selectedCaseSummary?.updatedAt ?? null)}.`
          : `Last updated: ${fmtDateTime(selectedCase?.updatedAt ?? selectedCaseSummary?.updatedAt ?? null)}.`
      );
    }

    const parties: string[] = [];
    const accountName = me?.user.fullName?.trim() || email;
    if (accountName) {
      parties.push(language === "es" ? `Titular de la cuenta: ${accountName}.` : `Account holder: ${accountName}.`);
    }
    if (me?.user.zipCode || me?.user.jurisdictionState) {
      parties.push(
        language === "es"
          ? `Perfil de jurisdiccion: ${me?.user.zipCode ?? "ZIP sin configurar"} / ${me?.user.jurisdictionState ?? "Estado sin configurar"}.`
          : `Jurisdiction profile: ${me?.user.zipCode ?? "ZIP not set"} / ${me?.user.jurisdictionState ?? "State not set"}.`
      );
    }

    const openQuestions: string[] = [];
    if (!activeEarliestDeadline) {
      openQuestions.push(
        language === "es"
          ? "Existe una fecha de respuesta en paginas que todavia no se han cargado?"
          : "Is there a response date in pages that were not uploaded yet?"
      );
    }
    if (!caseContextDraft.trim()) {
      openQuestions.push(
        language === "es"
          ? "Que paso, cuando y donde aun no esta documentado en el contexto del caso."
          : "What happened, when, and where is not yet documented in case context."
      );
    }
    if (activeDocumentType === "unknown_legal_document" || activeDocumentType === "non_legal_or_unclear_image") {
      openQuestions.push(
        language === "es"
          ? "Una imagen mas clara del documento mejoraria la confianza de clasificacion?"
          : "Would a clearer document image improve classification confidence?"
      );
    }
    for (const note of uncertaintyNotes) {
      openQuestions.push(note.endsWith(".") ? note : `${note}.`);
    }
    if (openQuestions.length === 0) {
      openQuestions.push(
        language === "es"
          ? "No se identificaron preguntas abiertas importantes en la extraccion estructurada actual."
          : "No major open questions were flagged by current structured extraction."
      );
    }

    const evidence =
      evidenceFromVerdict.length > 0
        ? evidenceFromVerdict
        : [
            language === "es"
              ? "Copia completa del documento y sobre/matasellos (si esta disponible)."
              : "Complete copy of the document and envelope/postmark (if available).",
            language === "es"
              ? "Avisos previos y mensajes relacionados (correo, email, texto)."
              : "Prior notices and related messages (mail, email, text).",
            language === "es"
              ? "Notas de cronologia sobre cuando se recibio cada comunicacion."
              : "Timeline notes for when each communication was received."
          ];

    const intakeOverview: string[] = [];
    if (intakeDraft.matterSummary.trim()) {
      intakeOverview.push(intakeDraft.matterSummary.trim());
    }
    if (intakeDraft.clientGoals.trim()) {
      intakeOverview.push(
        language === "es"
          ? `Objetivo principal: ${intakeDraft.clientGoals.trim()}`
          : `Primary goal: ${intakeDraft.clientGoals.trim()}`
      );
    }
    if (intakeDraft.constraints.trim()) {
      intakeOverview.push(
        language === "es"
          ? `Restricciones compartidas: ${intakeDraft.constraints.trim()}`
          : `Shared constraints: ${intakeDraft.constraints.trim()}`
      );
    }
    if (intakeOverview.length === 0) {
      intakeOverview.push(
        language === "es"
          ? "Intake formal aun no completado. Agregar detalles puede reducir tiempo de explicacion en consulta."
          : "Formal intake is not completed yet. Adding details can reduce explanation time in consultation."
      );
    }

    const consultAgenda = Array.from(
      new Set([
        ...openQuestions,
        ...(intakeDraft.questionsForCounsel
          .split(/\n+/)
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
          .map((line) => (line.endsWith("?") || line.endsWith(".") ? line : `${line}?`))),
        ...workspaceNextSteps
      ])
    ).slice(0, 10);

    const disclaimer =
      language === "es"
        ? "Solo para contexto informativo. No es asesoria legal."
        : selectedCase?.nonLegalAdviceDisclaimer ?? "For informational context only. Not legal advice.";

    return {
      caseTitle,
      summary: workspaceSummaryText,
      facts,
      dates,
      parties,
      openQuestions,
      evidence,
      intakeOverview,
      communicationsLog:
        intakeDraft.communicationsLog.trim() ||
        (language === "es" ? "Sin registro adicional en este momento." : "No additional log provided at this time."),
      financialImpact:
        intakeDraft.financialImpact.trim() ||
        (language === "es" ? "Sin impacto financiero adicional documentado." : "No additional financial impact documented."),
      desiredOutcome:
        intakeDraft.desiredOutcome.trim() ||
        (language === "es" ? "Resultado deseado aun no especificado." : "Desired outcome not specified yet."),
      consultAgenda,
      nextSteps: workspaceNextSteps,
      disclaimer
    };
  }, [
    selectedCase?.title,
    selectedCase?.status,
    selectedCase?.id,
    selectedCase?.updatedAt,
    selectedCase?.verdicts,
    selectedCase?.nonLegalAdviceDisclaimer,
    selectedCaseSummary?.title,
    selectedCaseSummary?.status,
    selectedCaseSummary?.updatedAt,
    activeDocumentType,
    activeTimeSensitive,
    activeEarliestDeadline,
    caseContextDraft,
    me?.user.fullName,
    me?.user.zipCode,
    me?.user.jurisdictionState,
    email,
    language,
    workspaceSummaryText,
    workspaceNextSteps,
    intakeDraft
  ]);

  const latestVerdictOutput = useMemo(
    () => asRecord(selectedCase?.verdicts?.[0]?.outputJson),
    [selectedCase?.verdicts]
  );

  const deadlineSignals = useMemo(() => {
    const deadlines = asRecord(latestVerdictOutput?.deadlines);
    const signalRows = Array.isArray(deadlines?.signals) ? deadlines?.signals : [];
    return signalRows
      .map((row) => asRecord(row))
      .filter((row): row is Record<string, unknown> => Boolean(row))
      .map((row) => ({
        kind: typeof row.kind === "string" ? row.kind : "signal",
        sourceText: typeof row.sourceText === "string" ? row.sourceText : "Detected signal",
        confidence: typeof row.confidence === "number" ? row.confidence : null,
        dateIso: typeof row.dateIso === "string" ? row.dateIso : null
      }));
  }, [latestVerdictOutput]);

  const uncertaintyNotes = useMemo(() => {
    const uncertainty = asRecord(latestVerdictOutput?.uncertainty);
    return asStringArray(uncertainty?.notes);
  }, [latestVerdictOutput]);

  const deadlineGuardReminders = useMemo(() => {
    const deadlineGuard = asRecord(latestVerdictOutput?.deadlineGuard);
    const reminders = Array.isArray(deadlineGuard?.reminders) ? deadlineGuard?.reminders : [];
    return reminders
      .map((row) => asRecord(row))
      .filter((row): row is Record<string, unknown> => Boolean(row))
      .map((row) => ({
        label: typeof row.label === "string" ? row.label : "Reminder",
        reminderDateIso: typeof row.reminderDateIso === "string" ? row.reminderDateIso : null
      }))
      .filter((row) => Boolean(row.reminderDateIso));
  }, [latestVerdictOutput]);

  const reminderScheduleLine = useMemo(() => {
    if (deadlineGuardReminders.length === 0) {
      return language === "es"
        ? "Aun no hay calendario de recordatorios hasta detectar una fecha."
        : "No reminder schedule is available until a deadline is detected.";
    }
    return language === "es"
      ? `Calendario de recordatorios activo con ${deadlineGuardReminders.length} hitos.`
      : `Reminder schedule is active with ${deadlineGuardReminders.length} milestones.`;
  }, [deadlineGuardReminders.length, language]);

  const evidenceChecklist = useMemo(
    () => asStringArray(latestVerdictOutput?.evidenceToGather),
    [latestVerdictOutput]
  );

  const evidenceCompleteness = useMemo(() => {
    const assetsCount = selectedCase?.assets.length ?? selectedCaseSummary?._count?.assets ?? 0;
    const hasContext = Boolean(caseContextDraft.trim());
    const hasDeadline = Boolean(activeEarliestDeadline);
    const hasStrongClassification = (selectedCase?.classificationConfidence ?? selectedCaseSummary?.classificationConfidence ?? 0) >= 0.6;
    const checks = [assetsCount >= 1, assetsCount >= 2, hasContext, hasDeadline || hasStrongClassification];
    const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
    const status =
      score >= 70
        ? language === "es"
          ? "Comunmente suficiente"
          : "Commonly sufficient"
        : language === "es"
          ? "Probablemente incompleto"
          : "Likely incomplete";
    const missing: string[] = [];
    if (assetsCount < 2) {
      missing.push(
        language === "es"
          ? "Agrega paginas adicionales o archivos de respaldo para mayor continuidad."
          : "Add additional pages or supporting files for stronger continuity."
      );
    }
    if (!hasContext) {
      missing.push(
        language === "es"
          ? "Agrega contexto describiendo que paso, cuando y donde."
          : "Add context describing what happened, when, and where."
      );
    }
    if (!hasDeadline) {
      missing.push(
        language === "es"
          ? "Aun no se detecta una fecha. Paginas legales mas claras pueden ayudar con la extraccion de fechas."
          : "No deadline detected yet. Clearer legal pages may help date extraction."
      );
    }
    if (missing.length === 0 && evidenceChecklist.length > 0) {
      missing.push(
        language === "es"
          ? `En muchos casos se considera util este elemento de lista: ${evidenceChecklist[0]}`
          : `Many people consider this checklist item useful: ${evidenceChecklist[0]}`
      );
    }
    return { score, status, missing };
  }, [
    selectedCase?.assets.length,
    selectedCase?.classificationConfidence,
    selectedCaseSummary?._count?.assets,
    selectedCaseSummary?.classificationConfidence,
    caseContextDraft,
    activeEarliestDeadline,
    evidenceChecklist,
    language
  ]);

  const readinessSnapshots = useMemo(() => {
    const rows = selectedCase?.auditLogs ?? [];
    return rows
      .map((row) => {
        const payload = asRecord(row.payload);
        if (!payload || payload.subtype !== "case_readiness_snapshot") return null;
        const score = typeof payload.score === "number" ? payload.score : null;
        if (score === null) return null;
        return {
          createdAt: row.createdAt,
          score
        };
      })
      .filter((row): row is { createdAt: string; score: number } => Boolean(row))
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  }, [selectedCase?.auditLogs]);

  const readinessTrajectory = useMemo(() => {
    if (readinessSnapshots.length === 0) {
      return {
        start: evidenceCompleteness.score,
        end: evidenceCompleteness.score,
        delta: 0,
        days: 0,
        message:
          language === "es"
            ? "La linea base de preparacion del caso esta disponible. El historial aparecera a medida que se procesen actualizaciones."
            : "Case readiness baseline is available. Progress history will appear as updates are processed."
      };
    }

    const now = Date.now();
    const tenDaysAgo = now - 10 * 24 * 60 * 60 * 1000;
    const inWindow = readinessSnapshots.filter((row) => {
      const ms = new Date(row.createdAt).getTime();
      return Number.isFinite(ms) && ms >= tenDaysAgo;
    });
    const usable = inWindow.length >= 2 ? inWindow : readinessSnapshots;
    const start = usable[0]?.score ?? evidenceCompleteness.score;
    const end = usable[usable.length - 1]?.score ?? evidenceCompleteness.score;
    const delta = end - start;
    const startTime = new Date(usable[0]?.createdAt ?? Date.now()).getTime();
    const endTime = new Date(usable[usable.length - 1]?.createdAt ?? Date.now()).getTime();
    const days = Math.max(0, Math.round((endTime - startTime) / (24 * 60 * 60 * 1000)));

    const message =
      delta > 0
        ? language === "es"
          ? `La preparacion del caso mejoro de ${start}% a ${end}% en los ultimos ${Math.max(days, 1)} dias.`
          : `Case readiness has improved from ${start}% to ${end}% over the last ${Math.max(days, 1)} days.`
        : delta < 0
          ? language === "es"
            ? `La preparacion del caso cambio de ${start}% a ${end}% en los ultimos ${Math.max(days, 1)} dias.`
            : `Case readiness moved from ${start}% to ${end}% over the last ${Math.max(days, 1)} days.`
          : language === "es"
            ? `La preparacion del caso se mantiene en ${end}% en los ultimos ${Math.max(days, 1)} dias.`
            : `Case readiness is stable at ${end}% over the last ${Math.max(days, 1)} days.`;

    return { start, end, delta, days, message };
  }, [readinessSnapshots, evidenceCompleteness.score, language]);

  const weeklyAssuranceData = useMemo(() => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const truthRuns = (selectedCase?.auditLogs ?? [])
      .filter((row) => row.eventType === "TRUTH_LAYER_RUN")
      .filter((row) => {
        const ms = new Date(row.createdAt).getTime();
        return Number.isFinite(ms) && ms >= sevenDaysAgo;
      });

    if (truthRuns.length === 0) {
      return {
        message:
          language === "es"
            ? "Esta semana no se detectaron cambios nuevos que suelen ser urgentes."
            : "No new time-sensitive changes were detected this week.",
        receiptCount: 0,
        confidence: "low",
        uncertainty:
          language === "es"
            ? "Esta confirmacion refleja cargas procesadas durante los ultimos 7 dias."
            : "This assurance reflects processed uploads from the last 7 days."
      };
    }

    const hasTimeSensitive = truthRuns.some((row) => {
      const payload = asRecord(row.payload);
      const truthLayer = asRecord(payload?.truthLayer);
      return truthLayer?.timeSensitive === true;
    });

    if (!hasTimeSensitive) {
      return {
        message:
          language === "es"
            ? "Esta semana no se detectaron cambios nuevos que suelen ser urgentes."
            : "No new time-sensitive changes were detected this week.",
        receiptCount: truthRuns.length,
        confidence: "high",
        uncertainty:
          language === "es"
            ? "Esta confirmacion refleja cargas procesadas durante los ultimos 7 dias."
            : "This assurance reflects processed uploads from the last 7 days."
      };
    }

    const latest = truthRuns[0];
    return {
      message:
        language === "es"
          ? `Esta semana incluyo senales sensibles al tiempo en una actualizacion reciente (${fmtDateTime(latest.createdAt)}).`
          : `This week included time-sensitive signals in a recent processing update (${fmtDateTime(latest.createdAt)}).`,
      receiptCount: truthRuns.length,
      confidence: "medium",
      uncertainty:
        language === "es"
          ? "La deteccion sensible al tiempo depende de la calidad del texto extraido."
          : "Time-sensitive detection depends on extracted text quality."
    };
  }, [selectedCase?.auditLogs, language]);

  const topUncertaintyNote = useMemo(
    () =>
      uncertaintyNotes[0] ??
      (language === "es"
        ? "No se detectaron senales de incertidumbre importantes en la extraccion estructurada mas reciente."
        : "No major uncertainty flags were detected in the latest structured extraction."),
    [uncertaintyNotes, language]
  );

  const caseWatchEnabled = useMemo(
    () => extractCaseWatchModeFromAuditLogs(selectedCase?.auditLogs),
    [selectedCase?.auditLogs]
  );

  const packetHistoryEntries = useMemo(
    () => buildPacketHistoryEntries(selectedCase?.auditLogs, language),
    [selectedCase?.auditLogs, language]
  );

  const watchMicroEvents = useMemo(() => {
    if (!caseWatchEnabled) return [];

    const events: string[] = [];
    events.push(
      language === "es"
        ? `Cronologia actualizada: ${fmtDateTime(selectedCase?.updatedAt ?? new Date().toISOString())}.`
        : `Timeline refreshed: ${fmtDateTime(selectedCase?.updatedAt ?? new Date().toISOString())}.`
    );
    events.push(weeklyAssuranceData.message);

    if (readinessSnapshots.length >= 2) {
      const latest = readinessSnapshots[readinessSnapshots.length - 1]?.score ?? 0;
      const previous = readinessSnapshots[readinessSnapshots.length - 2]?.score ?? 0;
      if (latest === previous) {
        events.push(
          language === "es"
            ? `Integridad de evidencia sin cambios (${latest}%).`
            : `Evidence completeness unchanged (${latest}%).`
        );
      } else if (latest > previous) {
        events.push(
          language === "es"
            ? `Integridad de evidencia mejoro de ${previous}% a ${latest}%.`
            : `Evidence completeness improved from ${previous}% to ${latest}%.`
        );
      } else {
        events.push(
          language === "es"
            ? `Integridad de evidencia cambio de ${previous}% a ${latest}%.`
            : `Evidence completeness moved from ${previous}% to ${latest}%.`
        );
      }
    }

    const latestContextSet = (selectedCase?.auditLogs ?? []).find((row) => {
      const payload = asRecord(row.payload);
      return payload?.subtype === "case_context_set";
    });
    if (latestContextSet) {
      events.push(
        language === "es"
          ? "Paquete actualizado despues de nuevo contexto."
          : "Packet updated after new context."
      );
    }

    const updatedMs = new Date(selectedCase?.updatedAt ?? "").getTime();
    if (Number.isFinite(updatedMs)) {
      const quietDays = Math.max(0, Math.floor((Date.now() - updatedMs) / (24 * 60 * 60 * 1000)));
      events.push(
        language === "es"
          ? `Este caso ha estado sin cambios durante ${quietDays} dias.`
          : `This case has been quiet for ${quietDays} days.`
      );
    }

    return events.slice(0, 5);
  }, [caseWatchEnabled, language, readinessSnapshots, selectedCase?.auditLogs, selectedCase?.updatedAt, weeklyAssuranceData.message]);

  const watchStatusLine = useMemo(() => {
    if (!caseWatchEnabled) {
      return language === "es"
        ? "Activa el modo de seguimiento para monitoreo continuo y calmado."
        : "Turn on Case Watch Mode for ongoing, calm monitoring.";
    }
    return language === "es"
      ? "ClearCase esta monitoreando este caso para ti."
      : "ClearCase is monitoring this case for you.";
  }, [caseWatchEnabled, language]);

  const weeklyCheckInStatus = useMemo(() => {
    if (!caseWatchEnabled) {
      return language === "es" ? "Estado: Revision semanal desactivada." : "Status: Weekly check-in is off.";
    }
    if (activeEarliestDeadline) {
      return language === "es"
        ? `Estado: Se detecta una fecha importante (${fmtDate(activeEarliestDeadline, language)}).`
        : `Status: An important date was detected (${fmtDate(activeEarliestDeadline, language)}).`;
    }
    return language === "es" ? "Estado: No hay cambios urgentes esta semana." : "Status: No urgent changes this week.";
  }, [caseWatchEnabled, activeEarliestDeadline, language]);

  const weeklyCheckInAction = useMemo(() => {
    if (!caseWatchEnabled) {
      return language === "es" ? "Accion: Activa la revision semanal." : "Action: Turn on weekly check-in.";
    }
    if (activeEarliestDeadline) {
      return language === "es" ? "Accion: Guarda la fecha en tu calendario." : "Action: Add the date to your calendar.";
    }
    if (evidenceCompleteness.score < 70) {
      return language === "es" ? "Accion: Sube los documentos que faltan." : "Action: Upload missing documents.";
    }
    return language === "es" ? "Accion: No necesitas hacer nada ahora." : "Action: No action needed right now.";
  }, [caseWatchEnabled, activeEarliestDeadline, evidenceCompleteness.score, language]);

  const packetShareStatusLine = useMemo(() => {
    const total = consultLinks.length;
    const active = consultLinks.filter((link) => link.status === "active").length;
    const disabled = consultLinks.filter((link) => link.status === "disabled").length;
    const expired = consultLinks.filter((link) => link.status === "expired").length;
    if (language === "es") {
      return `Versiones de paquete: ${packetHistoryEntries.length}. Enlaces para compartir: ${total} (${active} activos, ${expired} vencidos, ${disabled} desactivados).`;
    }
    return `Packet versions: ${packetHistoryEntries.length}. Share links: ${total} (${active} active, ${expired} expired, ${disabled} disabled).`;
  }, [consultLinks, packetHistoryEntries.length, language]);

  const intakeCompleteness = useMemo(() => {
    const sections = [
      intakeDraft.matterSummary,
      intakeDraft.clientGoals,
      intakeDraft.constraints,
      intakeDraft.timelineNarrative,
      intakeDraft.partiesAndRoles,
      intakeDraft.communicationsLog,
      intakeDraft.financialImpact,
      intakeDraft.questionsForCounsel,
      intakeDraft.desiredOutcome
    ];
    const total = sections.length;
    const completed = sections.filter((row) => row.trim().length >= 8).length;
    return Math.round((completed / total) * 100);
  }, [intakeDraft]);

  const costSavingIndicator = useMemo(() => {
    const readinessWeight = (readinessTrajectory.end ?? 0) / 100;
    const intakeWeight = intakeCompleteness / 100;
    const evidenceWeight = evidenceCompleteness.score / 100;
    const stepsDoneWeight =
      Object.values(stepProgressMap).length > 0
        ? Object.values(stepProgressMap).filter((value) => value === "done").length / Math.max(1, Object.keys(stepProgressMap).length)
        : 0;
    const minutesSaved = Math.round(12 + readinessWeight * 18 + intakeWeight * 22 + evidenceWeight * 15 + stepsDoneWeight * 14);
    const low = Math.max(8, minutesSaved - 8);
    const high = Math.min(95, minutesSaved + 12);
    const confidence =
      intakeCompleteness >= 75 && evidenceCompleteness.score >= 70
        ? "high"
        : intakeCompleteness >= 45
          ? "medium"
          : "low";
    const message =
      language === "es"
        ? `Ahorro estimado en preparacion de consulta: ${low}-${high} minutes.`
        : `Estimated consultation prep time saved: ${low}-${high} minutes.`;
    const assumptions =
      language === "es"
        ? "Basado en integridad de evidencia, completitud de intake y continuidad de cronologia."
        : "Based on evidence completeness, intake completeness, and timeline continuity.";
    return {
      low,
      high,
      confidence,
      message,
      assumptions
    };
  }, [readinessTrajectory.end, intakeCompleteness, evidenceCompleteness.score, stepProgressMap, language]);

  const premiumActionSteps = useMemo((): PremiumActionStep[] => {
    const steps: PremiumActionStep[] = [];
    const caseIdReceipt = selectedCase?.id ?? selectedCaseSummary?.id ?? "case";
    const confidenceText = localizedConfidenceLabel(language, classificationConfidenceValue);

    if (activeEarliestDeadline) {
      steps.push({
        id: "now-calendar-deadline",
        group: "now",
        title: language === "es" ? "Guarda esta fecha en tu calendario" : "Add this date to your calendar",
        detail:
          language === "es"
            ? `Agregar la fecha ${fmtDate(activeEarliestDeadline, language)} al calendario ayuda a mantener continuidad.`
            : `Adding ${fmtDate(activeEarliestDeadline, language)} to your calendar helps maintain continuity.`,
        consequenceIfIgnored:
          language === "es"
            ? "Si se pospone, muchas personas observan menos margen para organizar documentos antes de responder."
            : "If delayed, many people see less time to organize records before responding.",
        effort: "5m",
        confidence: "high",
        receipts: [
          language === "es" ? `Fecha detectada en el caso ${caseIdReceipt}` : `Detected date in case ${caseIdReceipt}`,
          language === "es" ? `Comprobantes de fecha: ${deadlineSignals.length}` : `Date receipts: ${deadlineSignals.length}`
        ]
      });
    } else {
      steps.push({
        id: "now-find-deadline",
        group: "now",
        title: language === "es" ? "Sube paginas faltantes para encontrar la fecha" : "Upload missing pages to find the date",
        detail:
          language === "es"
            ? "Cargar paginas con encabezados y firmas suele mejorar deteccion de fechas."
            : "Uploading pages with headers and signatures often improves date detection.",
        consequenceIfIgnored:
          language === "es"
            ? "Sin una fecha clara, muchas personas mantienen planes menos precisos para la semana."
            : "Without a clear date, many people keep less precise plans for the week.",
        effort: "15m",
        confidence: "medium",
        receipts: [
          language === "es" ? "No hay fecha explicita detectada" : "No explicit date detected",
          language === "es" ? `Confianza de clasificacion: ${confidenceText}` : `Classification confidence: ${confidenceText}`
        ]
      });
    }

    steps.push({
      id: "now-context",
      group: "now",
      title: language === "es" ? "Agrega que paso, cuando y donde" : "Add what happened, when, and where",
      detail:
        language === "es"
          ? "Agregar que paso, cuando y donde mejora la calidad de futuros resumenes y del paquete."
          : "Adding what happened, when, and where improves future summaries and packet quality.",
      consequenceIfIgnored:
        language === "es"
          ? "Si falta contexto, muchas personas repiten explicaciones al iniciar consulta."
          : "If context is missing, many people repeat explanations during consultation.",
      effort: "10m",
      confidence: "high",
      receipts: [
        language === "es"
          ? caseContextDraft.trim()
            ? "Contexto del caso presente"
            : "Contexto del caso aun vacio"
          : caseContextDraft.trim()
            ? "Case context currently present"
            : "Case context currently empty",
        language === "es" ? `Versiones de paquete: ${packetHistoryEntries.length}` : `Packet versions: ${packetHistoryEntries.length}`
      ]
    });

    if (evidenceCompleteness.score < 70) {
      steps.push({
        id: "this-week-evidence-gap",
        group: "this_week",
        title: language === "es" ? "Sube documentos que faltan" : "Upload missing documents",
        detail:
          language === "es"
            ? `La integridad de evidencia esta en ${evidenceCompleteness.score}%. Cargar archivos complementarios suele mejorar continuidad.`
            : `Evidence completeness is ${evidenceCompleteness.score}%. Adding supporting files often improves continuity.`,
        consequenceIfIgnored:
          language === "es"
            ? "Si continua incompleto, muchas consultas comienzan con mas tiempo en recopilacion inicial."
            : "If this stays incomplete, many consultations spend more time on initial collection.",
        effort: "20m",
        confidence: "medium",
        receipts: [
          language === "es" ? `Puntaje de integridad: ${evidenceCompleteness.score}%` : `Completeness score: ${evidenceCompleteness.score}%`,
          language === "es" ? `Elementos sugeridos: ${evidenceChecklist.length}` : `Suggested items: ${evidenceChecklist.length}`
        ]
      });
    }

    steps.push({
      id: "this-week-intake",
      group: "this_week",
      title: language === "es" ? "Llena el formulario para tu abogado" : "Fill out your lawyer prep form",
      detail:
        language === "es"
          ? `Intake actual ${intakeCompleteness}%. Completar campos mejora el traspaso a abogado.`
          : `Current intake is ${intakeCompleteness}%. Filling sections improves attorney handoff.`,
      consequenceIfIgnored:
        language === "es"
          ? "Con intake parcial, muchas personas dedican mas minutos pagados a cubrir informacion basica."
          : "With partial intake, many people spend more paid minutes covering basics.",
      effort: "25m",
      confidence: "high",
      receipts: [
        language === "es" ? `Intake completado: ${intakeCompleteness}%` : `Intake completed: ${intakeCompleteness}%`,
        language === "es" ? `Ahorro estimado: ${costSavingIndicator.low}-${costSavingIndicator.high}m` : `Estimated savings: ${costSavingIndicator.low}-${costSavingIndicator.high}m`
      ]
    });

    steps.push({
      id: "before-consult-questions",
      group: "before_consult",
      title: language === "es" ? "Escribe tus 3 preguntas principales" : "Write your top 3 questions",
      detail:
        language === "es"
          ? "Reunir preguntas clave y resultados deseados suele hacer mas eficiente la primera llamada."
          : "Collecting key questions and desired outcomes often makes the first call more efficient.",
      consequenceIfIgnored:
        language === "es"
          ? "Sin agenda, muchas personas cubren menos temas prioritarios durante la consulta inicial."
          : "Without an agenda, many people cover fewer priority topics during the first consultation.",
      effort: "10m",
      confidence: "medium",
      receipts: [
        language === "es" ? `Preguntas abiertas detectadas: ${lawyerReadySummary.openQuestions.length}` : `Detected open questions: ${lawyerReadySummary.openQuestions.length}`,
        language === "es" ? `Preguntas de intake: ${intakeDraft.questionsForCounsel.trim() ? 1 : 0}` : `Intake question section set: ${intakeDraft.questionsForCounsel.trim() ? "yes" : "no"}`
      ]
    });

    steps.push({
      id: "before-consult-packet",
      group: "before_consult",
      title: language === "es" ? "Crea el paquete para tu abogado" : "Create your lawyer packet",
      detail:
        language === "es"
          ? "El paquete incluye hechos, cronologia, evidencia, preguntas y estado de enlaces."
          : "The packet includes facts, timeline, evidence, questions, and share-link status.",
      consequenceIfIgnored:
        language === "es"
          ? "Si no se comparte el paquete, muchas personas duplican explicaciones y reenvio de documentos."
          : "Without a packet, many people duplicate explanations and document sharing.",
      effort: "8m",
      confidence: "high",
      receipts: [
        language === "es" ? `Versiones de paquete: ${packetHistoryEntries.length}` : `Packet versions: ${packetHistoryEntries.length}`,
        language === "es" ? `Enlaces activos: ${consultLinks.filter((link) => link.status === "active").length}` : `Active links: ${consultLinks.filter((link) => link.status === "active").length}`
      ]
    });

    steps.push({
      id: "after-upload-refresh",
      group: "after_upload",
      title: language === "es" ? "Revisa que cambio despues de subir" : "Check what changed after upload",
      detail:
        language === "es"
          ? "Comparar resumen, fechas y estado de evidencia despues de cada carga mantiene continuidad."
          : "Comparing summary, dates, and evidence status after each upload keeps continuity.",
        consequenceIfIgnored:
          language === "es"
            ? "Si no se evalua, muchas personas detectan tarde cambios utiles para la preparacion."
            : "If skipped, many people notice useful prep changes later than expected.",
      effort: "6m",
      confidence: "medium",
      receipts: [
        language === "es" ? `Ultima actualizacion: ${fmtDateTime(selectedCase?.updatedAt ?? selectedCaseSummary?.updatedAt ?? new Date().toISOString())}` : `Last update: ${fmtDateTime(selectedCase?.updatedAt ?? selectedCaseSummary?.updatedAt ?? new Date().toISOString())}`,
        weeklyAssuranceData.message
      ]
    });

    return steps;
  }, [
    selectedCase?.id,
    selectedCase?.updatedAt,
    selectedCaseSummary?.id,
    selectedCaseSummary?.updatedAt,
    language,
    classificationConfidenceValue,
    activeEarliestDeadline,
    deadlineSignals.length,
    caseContextDraft,
    packetHistoryEntries.length,
    evidenceCompleteness.score,
    evidenceChecklist.length,
    intakeCompleteness,
    costSavingIndicator.low,
    costSavingIndicator.high,
    lawyerReadySummary.openQuestions.length,
    intakeDraft.questionsForCounsel,
    consultLinks,
    weeklyAssuranceData.message
  ]);

  const groupedPremiumSteps = useMemo(() => {
    return {
      now: premiumActionSteps.filter((row) => row.group === "now"),
      this_week: premiumActionSteps.filter((row) => row.group === "this_week"),
      before_consult: premiumActionSteps.filter((row) => row.group === "before_consult"),
      after_upload: premiumActionSteps.filter((row) => row.group === "after_upload")
    };
  }, [premiumActionSteps]);

  const workspaceChecklistItems = useMemo(() => {
    if (!plusEnabled) {
      return workspaceNextSteps.map((text, index) => ({
        id: `free-step-${index}`,
        text
      }));
    }
    return premiumActionSteps.slice(0, 10).map((step) => ({
      id: step.id,
      text: step.title
    }));
  }, [plusEnabled, workspaceNextSteps, premiumActionSteps]);

  const premiumStepSummaryLine = useMemo(() => {
    if (!plusEnabled) return null;
    if (language === "es") {
      return `${premiumActionSteps.length} pasos dinamicos disponibles con consecuencias, comprobantes y confianza.`;
    }
    return `${premiumActionSteps.length} dynamic steps available with consequences, receipts, and confidence.`;
  }, [plusEnabled, language, premiumActionSteps.length]);

  const accountInitials = useMemo(() => {
    const source = me?.user.fullName?.trim() || email.split("@")[0] || "CC";
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
    return (parts[0]?.slice(0, 2) ?? "CC").toUpperCase();
  }, [me, email]);

  const assetViewerIsPdf = useMemo(
    () => Boolean(assetViewerAsset?.mimeType?.toLowerCase().includes("pdf")),
    [assetViewerAsset?.mimeType]
  );
  const assetViewerIsImage = useMemo(
    () => Boolean(assetViewerAsset?.mimeType?.toLowerCase().startsWith("image/")),
    [assetViewerAsset?.mimeType]
  );
  const assetViewerRenderUrl = useMemo(() => {
    if (!assetViewerUrl) return null;
    if (!assetViewerIsPdf) return assetViewerUrl;
    return buildViewerUrlWithPdfControls(assetViewerUrl, assetViewerPdfPage, assetViewerPdfZoom);
  }, [assetViewerUrl, assetViewerIsPdf, assetViewerPdfPage, assetViewerPdfZoom]);

  // Return complete controller object
  return {
    // Language
    language, setLanguage, setLanguageWithPersistence, loadPersistedLanguage,
    selectInitialLanguage, applyLanguageFromSettings,
    // Navigation
    screen, setScreen, postLanguageScreen, setPostLanguageScreen, goBack,
    slide, setSlide, completeOnboarding,
    // Connection
    apiBase, setApiBase, apiBaseInput, setApiBaseInput,
    connStatus, setConnStatus, connMessage, setConnMessage,
    offlineMode, setOfflineMode, banner, setBanner,
    subject, setSubject, subjectInput, setSubjectInput,
    email, setEmail, emailInput, setEmailInput,
    headers, showBanner, verifyConnection, detectLanApiBase, persistConnection, applyConnection,
    // Paywall
    paywallConfig, setPaywallConfig, planTier, setPlanTier,
    startingCheckout, planSheetOpen, setPlanSheetOpen,
    loadPaywallConfigState, startPlusCheckout, openPaywall, promptPlusUpgrade,
    paywallCallbacks,
    // Cases
    me, setMe, cases, setCases, selectedCaseId, setSelectedCaseId,
    selectedCase, setSelectedCase, caseAssets, setCaseAssets,
    loadingCaseAssets, setLoadingCaseAssets, profileName, setProfileName,
    profileZip, setProfileZip, newCaseTitle, setNewCaseTitle,
    caseSearch, setCaseSearch, caseFilter, setCaseFilter,
    loadingDashboard, setLoadingDashboard, loadingCase, setLoadingCase,
    creatingCase, savingProfile, refreshing, selectedCaseSummary,
    latestCase, userFirstName, filteredCases,
    loadDashboard, loadCase, loadCaseAssetsForSelectedCase,
    createCaseWithTitle, saveProfile, refreshWorkspace, reconnectWorkspace,
    casesCallbacks,
    // Upload
    uploading, setUploading, uploadStage, setUploadStage,
    uploadDescription, setUploadDescription, uploadTargetCaseId, setUploadTargetCaseId,
    uploadCaseTitle, setUploadCaseTitle, uploadSheetOpen, setUploadSheetOpen,
    latestContextReuseSourceCaseId, setLatestContextReuseSourceCaseId,
    uploadAssets, uploadDocument, uploadFromCamera,
    beginFileUpload, beginCameraUpload, homeUploadFlow, openUploadSheetForCase,
    waitForCaseInsight, uploadCallbacks,
    // Local state
    drawerOpen, setDrawerOpen, lawyerSummaryOpen, setLawyerSummaryOpen,
    assetViewerOpen, setAssetViewerOpen, assetViewerAsset, setAssetViewerAsset,
    assetViewerUrl, setAssetViewerUrl, assetViewerPdfPage, setAssetViewerPdfPage,
    assetViewerPdfZoom, setAssetViewerPdfZoom, assetViewerImageZoom, setAssetViewerImageZoom,
    assetViewerImagePan, setAssetViewerImagePan, assetViewerImageBounds, setAssetViewerImageBounds,
    assetViewerLoading, setAssetViewerLoading,
    assetViewerImagePanRef, assetViewerImagePanStartRef,
    plainMeaningOpen, setPlainMeaningOpen, loadingPlainMeaning, setLoadingPlainMeaning,
    plainMeaningRows, setPlainMeaningRows, plainMeaningBoundary, setPlainMeaningBoundary,
    intakeModalOpen, setIntakeModalOpen, consultLinks, setConsultLinks,
    loadingConsultLinks, setLoadingConsultLinks, creatingConsultLink, setCreatingConsultLink,
    disablingConsultToken, setDisablingConsultToken, caseContextDraft, setCaseContextDraft,
    classificationSheetOpen, setClassificationSheetOpen, classificationDraft, setClassificationDraft,
    legalReturnScreen, setLegalReturnScreen, legalAidSearch, setLegalAidSearch,
    selectedTemplate, setSelectedTemplate,
    pushEnabled, setPushEnabled, pushQuietHoursEnabled, setPushQuietHoursEnabled,
    savingPushPreferences, setSavingPushPreferences,
    togglePushNotifications, togglePushQuietHours,
    // Auth
    authMode, setAuthMode, authName, setAuthName, authZip, setAuthZip,
    authEmail, setAuthEmail, authPassword, setAuthPassword,
    authIntent, setAuthIntent, authBusy, setAuthBusy, authStage, setAuthStage,
    isBootstrapping, setIsBootstrapping, signOut, bootstrapOfflineSession,
    agreeAndContinue, resolveAuthApiBase,
    // Workspace state
    savingCaseContext, setSavingCaseContext, savingClassification, setSavingClassification,
    savingWatchMode, setSavingWatchMode, intakeDraft, setIntakeDraft,
    stepProgressMap, setStepProgressMap, workspaceSectionOpen, setWorkspaceSectionOpen,
    toggleCaseWatchMode, loadConsultPacketLinks, createConsultPacketShareLink,
    disableConsultPacketShareLink, buildLawyerReadySummaryText, shareLawyerReadySummary,
    emailLawyerReadySummary, closeAssetViewer, buildViewerUrlWithPdfControls,
    openViewerUrlExternally, openAssetAccess, openPlainMeaningTranslator,
    saveCaseContextForSelectedCase, openManualCategoryPicker, saveManualCategoryForSelectedCase,
    intakeSectionLabel, intakePlaceholder, stepGroupLabel,
    // Derived values
    plusEnabled, onboardingSlides, activeDocumentType, activeEarliestDeadline,
    activeTimeSensitive, workspaceSeverity, workspaceSummaryText, workspaceNextSteps,
    workspaceSectionMeta, toggleWorkspaceSection, completion, classificationConfidenceValue,
    lawyerReadySummary, latestVerdictOutput, deadlineSignals, uncertaintyNotes,
    deadlineGuardReminders, reminderScheduleLine, evidenceChecklist, evidenceCompleteness,
    readinessSnapshots, readinessTrajectory, weeklyAssuranceData, topUncertaintyNote,
    caseWatchEnabled, packetHistoryEntries, watchMicroEvents, watchStatusLine,
    weeklyCheckInStatus, weeklyCheckInAction, packetShareStatusLine, intakeCompleteness,
    costSavingIndicator, premiumActionSteps, groupedPremiumSteps, workspaceChecklistItems,
    premiumStepSummaryLine, accountInitials, assetViewerIsPdf, assetViewerIsImage, assetViewerRenderUrl
  };
}
