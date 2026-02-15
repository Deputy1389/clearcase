import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, LayoutAnimation, PanResponder, Platform, Share, Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CaseAsset, CaseSummary, ConsultPacketLink, MeResponse, PlainMeaningRow } from "../api";
import { createConsultPacketLink, disableConsultPacketLink, finalizeAssetUpload, getCaseAssetAccess, getConsultPacketLinks, getPlainMeaning, patchMe, patchNotificationPreferences, registerPushDevice, saveCaseContext, setCaseClassification, setCaseWatchMode, trackEvent } from "../api";
import { DEMO_CASES, DEMO_CASE_DETAIL_MAP } from "../data/demo-cases";
import type { AppLanguage, PremiumActionStep, PremiumStepGroup, StepProgress, WorkspaceAccordionKey } from "../types";
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

  // Return complete controller object
  return {
    // Language
    language, setLanguage, setLanguageWithPersistence, loadPersistedLanguage,
    // Navigation
    screen, setScreen, postLanguageScreen, setPostLanguageScreen, goBack,
    slide, setSlide,
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
    // Derived values
    plusEnabled, onboardingSlides, activeDocumentType, activeEarliestDeadline,
    activeTimeSensitive, workspaceSeverity, workspaceSummaryText, workspaceNextSteps,
    workspaceSectionMeta, toggleWorkspaceSection
  };
}
