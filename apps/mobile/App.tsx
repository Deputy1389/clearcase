
import * as Sentry from "@sentry/react-native";
import { StatusBar } from "expo-status-bar";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { useFonts } from "expo-font";
import { LinearGradient } from "expo-linear-gradient";
import { Newsreader_600SemiBold, Newsreader_700Bold } from "@expo-google-fonts/newsreader";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold
} from "@expo-google-fonts/plus-jakarta-sans";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  LayoutAnimation,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import {
  type ApiError,
  type CaseAsset,
  type AuthHeaders,
  type CaseDetail,
  type CaseSummary,
  type ConsultPacketLink,
  type PlainMeaningRow,
  type ManualDocumentType,
  type MeResponse,
  MANUAL_DOCUMENT_TYPES,
  createBillingCheckout,
  createConsultPacketLink,
  createAssetUploadPlan,
  createCase,
  disableConsultPacketLink,
  getCaseAssetAccess,
  getCaseAssets,
  finalizeAssetUpload,
  getConsultPacketLinks,
  getCaseById,
  getCases,
  getHealth,
  getMe,
  getPaywallConfig,
  getPlainMeaning,
  patchNotificationPreferences,
  patchMe,
  registerPushDevice,
  trackEvent,
  setCaseWatchMode,
  setCaseClassification,
  saveCaseContext
} from "./src/api";
import {
  ENV_API_BASE,
  DEFAULT_API_BASE,
  extractMetroHost,
  isLoopbackHost,
  isPrivateIpv4Host,
  isLoopbackApiBase,
  extractHostFromApiBase,
  isLocalApiBase,
  resolveDefaultApiBase,
  buildHeaders
} from "./src/utils/network";
import {
  intakeStorageKey,
  stepStatusStorageKey,
  emptyIntakeDraft,
  parseStepProgress,
  parseIntakeDraft,
  parsePlanTier,
  planTierLabel,
  planTierShort,
  parseLanguage,
  languageLabel,
  asRecord,
  asStringArray
} from "./src/utils/parsing";
import {
  clamp,
  confidenceLabel,
  localizedConfidenceLabel,
  fmtIsoDate,
  titleize,
  daysUntil,
  fmtDate,
  fmtDateTime,
  sleep
} from "./src/utils/formatting";
import {
  manualCategoryOptions,
  isManualDocumentType,
  manualCategoryLabel,
  fallbackSummaryForDocumentType,
  buildRecommendedNextSteps,
  deriveCaseSeverity,
  severityLabel,
  severitySummary,
  casePriorityLevel,
  casePriorityLabel
} from "./src/utils/case-logic";
import {
  isImageFileUpload,
  replaceFileExtension,
  getImageDimensions,
  compressUploadImage
} from "./src/utils/upload-helpers";
import {
  type FreeLimitApiPayload,
  summarizeError,
  withNetworkHint,
  isPlusRequiredApiError,
  parseFreeLimitApiError,
  isFreeOcrDisabledApiError,
  formatLimitResetAt,
  plusUpgradeExplainer,
  isNetworkErrorLike
} from "./src/utils/error-helpers";
import {
  isValidEmail,
  isValidUsZip,
  isStrongPassword
} from "./src/utils/auth-helpers";
import {
  hapticTap,
  hapticSuccess
} from "./src/utils/haptics";
import { onboardingSlidesByLanguage } from "./src/data/onboarding-slides";
import { LEGAL_AID_RESOURCES } from "./src/data/legal-aid-resources";
import type { LegalAidResource } from "./src/data/legal-aid-resources";
import { DRAFT_TEMPLATES } from "./src/data/draft-templates";
import type { DraftTemplate } from "./src/data/draft-templates";
import { DEMO_CASES, buildDemoCaseDetail, DEMO_CASE_DETAIL_MAP } from "./src/data/demo-cases";
import type { OnboardingSlide, PaywallConfigState } from "./src/types";

// --- Sentry error tracking ---
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() ?? "";
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.2,
    enableAutoSessionTracking: true,
    environment: __DEV__ ? "development" : "production"
  });
}

// Configure notification handler for foreground notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

async function requestExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("deadline-reminders", {
      name: "Deadline Reminders",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default"
    });
  }
  const tokenData = await Notifications.getExpoPushTokenAsync();
  return tokenData.data;
}

type Screen = "language" | "onboarding" | "auth" | "home" | "workspace" | "cases" | "account" | "legal" | "legalAid" | "drafting";
type ContentScreen = Exclude<Screen, "language">;
type AuthMode = "selection" | "login" | "signup" | "disclaimer";
type BannerTone = "info" | "good" | "bad";
type ConnStatus = "unknown" | "ok" | "error";
type UploadStage = "idle" | "picking" | "preparing" | "sending" | "processing";
type CaseSeverity = "high" | "medium" | "low";
type PlanTier = "free" | "plus";
type AppLanguage = "en" | "es";
type PlusFeatureGate = "watch_mode" | "consult_links";
type StepProgress = "not_started" | "in_progress" | "done" | "deferred";
type PremiumStepGroup = "now" | "this_week" | "before_consult" | "after_upload";

type PremiumActionStep = {
  id: string;
  group: PremiumStepGroup;
  title: string;
  detail: string;
  consequenceIfIgnored: string;
  effort: string;
  confidence: "high" | "medium" | "low";
  receipts: string[];
};

type UploadAssetInput = {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
};

type WorkspaceAccordionKey =
  | "steps"
  | "watch"
  | "packet"
  | "context"
  | "category"
  | "summary"
  | "plain_meaning"
  | "timeline";

type IntakeDraft = {
  matterSummary: string;
  clientGoals: string;
  constraints: string;
  timelineNarrative: string;
  partiesAndRoles: string;
  communicationsLog: string;
  financialImpact: string;
  questionsForCounsel: string;
  desiredOutcome: string;
};

const STORAGE_API_BASE = "clearcase.mobile.apiBase";
const STORAGE_SUBJECT = "clearcase.mobile.subject";
const STORAGE_EMAIL = "clearcase.mobile.email";
const STORAGE_ONBOARDED = "clearcase.mobile.onboarded";
const STORAGE_OFFLINE_SESSION = "clearcase.mobile.offlineSession";
const STORAGE_PLAN_TIER = "clearcase.mobile.planTier";
const STORAGE_LANGUAGE = "clearcase.mobile.language";
const STORAGE_PUSH_DEVICE_ID = "clearcase.mobile.pushDeviceId";
const STORAGE_INTAKE_PREFIX = "clearcase.mobile.intake";
const STORAGE_STEP_STATUS_PREFIX = "clearcase.mobile.premiumSteps";
const DEFAULT_PLUS_PRICE_MONTHLY = "$15/month";
const IMAGE_UPLOAD_MAX_DIMENSION = 1600;
const IMAGE_UPLOAD_QUALITY = 0.45;
const MOBILE_BUILD_STAMP = "mobile-ui-2026-02-13b";

const palette = {
  bg: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceSoft: "#F8FAFC",
  line: "#E2E8F0",
  text: "#0F172A",
  muted: "#64748B",
  subtle: "#94A3B8",
  primary: "#0F172A",
  green: "#166534",
  greenSoft: "#DCFCE7",
  amber: "#A16207",
  amberSoft: "#FEF3C7",
  redSoft: "#FEE2E2"
};

const font = {
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semibold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
  display: "Newsreader_700Bold",
  displaySemibold: "Newsreader_600SemiBold"
} as const;

function deriveSubject(email: string): string {
  const local = email.split("@")[0] ?? "";
  const normalized = local.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized ? `mobile-${normalized}` : DEFAULT_SUBJECT;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isValidUsZip(value: string): boolean {
  return /^\d{5}(?:-\d{4})?$/.test(value.trim());
}

function isStrongPassword(value: string): boolean {
  return value.trim().length >= 8;
}

function renderSlideIcon(slide: OnboardingSlide) {
  if (slide.icon === "scale") {
    return <MaterialCommunityIcons name="scale-balance" size={38} color={slide.iconColor} />;
  }
  return <Feather name={slide.icon} size={32} color={slide.iconColor} />;
}

function formatUploadStage(stage: UploadStage, language: AppLanguage = "en"): string {
  if (language === "es") {
    if (stage === "picking") return "Elegir archivo";
    if (stage === "preparing") return "Preparando carga";
    if (stage === "sending") return "Cargando de forma segura";
    if (stage === "processing") return "Generando analisis";
    return "Listo para cargar";
  }
  if (stage === "picking") return "Choose file";
  if (stage === "preparing") return "Preparing upload";
  if (stage === "sending") return "Uploading securely";
  if (stage === "processing") return "Generating insight";
  return "Ready to upload";
}

function casePriorityLevel(row: CaseSummary): "high" | "medium" | "low" {
  if (row.timeSensitive) return "high";
  if (row.earliestDeadline) return "medium";
  return "low";
}

function casePriorityLabel(row: CaseSummary, language: AppLanguage = "en"): "High" | "Medium" | "Low" | "Alta" | "Media" | "Baja" {
  const level = casePriorityLevel(row);
  if (language === "es") {
    if (level === "high") return "Alta";
    if (level === "medium") return "Media";
    return "Baja";
  }
  if (level === "high") return "High";
  if (level === "medium") return "Medium";
  return "Low";
}

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

function buildAutoCaseTitle(rawTitle?: string | null): string {
  const cleaned = (rawTitle ?? "")
    .replace(/\.[^.]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned) return cleaned.slice(0, 120);
  return `Uploaded Document - ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
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

type PacketHistoryEntry = {
  version: number;
  reason: string;
  createdAt: string;
};

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

function askTakeAnotherPhoto(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert("Photo added", "Take another photo?", [
      { text: "Done", onPress: () => resolve(false), style: "cancel" },
      { text: "Take another", onPress: () => resolve(true) }
    ]);
  });
}

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const subtleSpring = { duration: 250, update: { type: "spring" as const, springDamping: 0.85 }, create: { type: "easeInEaseOut" as const, property: "opacity" as const }, delete: { type: "easeInEaseOut" as const, property: "opacity" as const } };

function App() {
  const [fontsLoaded] = useFonts({
    Newsreader_600SemiBold,
    Newsreader_700Bold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold
  });

  const [screen, setScreen] = useState<Screen>("language");
  const [postLanguageScreen, setPostLanguageScreen] = useState<ContentScreen>("onboarding");
  const [authMode, setAuthMode] = useState<AuthMode>("selection");
  const [slide, setSlide] = useState(0);
  const [banner, setBanner] = useState<{ tone: BannerTone; text: string } | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);

  const [apiBase, setApiBase] = useState(DEFAULT_API_BASE ?? "http://127.0.0.1:3001");
  const [apiBaseInput, setApiBaseInput] = useState(DEFAULT_API_BASE ?? "http://127.0.0.1:3001");
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [subjectInput, setSubjectInput] = useState(DEFAULT_SUBJECT);
  const [email, setEmail] = useState(DEFAULT_EMAIL);
  const [emailInput, setEmailInput] = useState(DEFAULT_EMAIL);
  const [connStatus, setConnStatus] = useState<ConnStatus>("unknown");
  const [connMessage, setConnMessage] = useState("Connection not tested yet.");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [uploadSheetOpen, setUploadSheetOpen] = useState(false);
  const [planSheetOpen, setPlanSheetOpen] = useState(false);
  const [startingCheckout, setStartingCheckout] = useState(false);
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
  const [latestContextReuseSourceCaseId, setLatestContextReuseSourceCaseId] = useState<string | null>(null);
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadTargetCaseId, setUploadTargetCaseId] = useState<string | null>(null);
  const [uploadCaseTitle, setUploadCaseTitle] = useState("");
  const [caseContextDraft, setCaseContextDraft] = useState("");
  const [classificationSheetOpen, setClassificationSheetOpen] = useState(false);
  const [classificationDraft, setClassificationDraft] = useState<ManualDocumentType>("unknown_legal_document");
  const [legalReturnScreen, setLegalReturnScreen] = useState<Screen>("home");
  const [legalAidSearch, setLegalAidSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<DraftTemplate | null>(null);

  const [authName, setAuthName] = useState("");
  const [authZip, setAuthZip] = useState("");
  const [authEmail, setAuthEmail] = useState(DEFAULT_EMAIL);
  const [authPassword, setAuthPassword] = useState("");
  const [authIntent, setAuthIntent] = useState<"login" | "signup">("login");
  const [authBusy, setAuthBusy] = useState(false);
  const [authStage, setAuthStage] = useState<"idle" | "account" | "profile" | "workspace">("idle");

  const [me, setMe] = useState<MeResponse | null>(null);
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<CaseDetail | null>(null);
  const [caseAssets, setCaseAssets] = useState<CaseAsset[]>([]);
  const [loadingCaseAssets, setLoadingCaseAssets] = useState(false);
  const [paywallConfig, setPaywallConfig] = useState<PaywallConfigState>({
    plusPriceMonthly: DEFAULT_PLUS_PRICE_MONTHLY,
    paywallVariant: "gold_v1",
    showAlternatePlan: false,
    billingEnabled: true
  });

  const [profileName, setProfileName] = useState("");
  const [profileZip, setProfileZip] = useState("");
  const [newCaseTitle, setNewCaseTitle] = useState("");
  const [caseSearch, setCaseSearch] = useState("");
  const [caseFilter, setCaseFilter] = useState<"all" | "active" | "urgent" | "archived">("all");
  const [planTier, setPlanTier] = useState<PlanTier>("free");
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushQuietHoursEnabled, setPushQuietHoursEnabled] = useState(false);
  const [savingPushPreferences, setSavingPushPreferences] = useState(false);

  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [loadingCase, setLoadingCase] = useState(false);
  const [creatingCase, setCreatingCase] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingCaseContext, setSavingCaseContext] = useState(false);
  const [savingClassification, setSavingClassification] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState<UploadStage>("idle");
  const [refreshing, setRefreshing] = useState(false);
  const [language, setLanguage] = useState<AppLanguage>("en");
  const [savingWatchMode, setSavingWatchMode] = useState(false);
  const [intakeDraft, setIntakeDraft] = useState<IntakeDraft>(emptyIntakeDraft());
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
  const plusEnabled = me?.entitlement?.isPlus ?? false;
  const onboardingSlides = useMemo(() => onboardingSlidesByLanguage[language], [language]);

  const headers = useMemo(() => buildHeaders(subject, email), [subject, email]);
  const selectedCaseSummary = useMemo(
    () => cases.find((row) => row.id === selectedCaseId) ?? null,
    [cases, selectedCaseId]
  );
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
    return fallbackSummaryForDocumentType(activeDocumentType, language);
  }, [selectedCase?.plainEnglishExplanation, activeDocumentType, language]);
  const workspaceNextSteps = useMemo(
    () => buildRecommendedNextSteps(activeDocumentType, activeEarliestDeadline, language),
    [activeDocumentType, activeEarliestDeadline, language]
  );
  const latestCase = useMemo(() => cases[0] ?? null, [cases]);
  const userFirstName = useMemo(() => {
    const fullName = me?.user.fullName?.trim();
    if (fullName) return fullName.split(/\s+/)[0];
    const emailName = email.split("@")[0]?.trim();
    return emailName || "there";
  }, [me, email]);
  const filteredCases = useMemo(() => {
    const q = caseSearch.trim().toLowerCase();
    return cases.filter((row) => {
      const status = (row.status ?? "").toLowerCase();
      const title = (row.title ?? "").toLowerCase();
      const docType = (row.documentType ?? "").toLowerCase();
      const matchesSearch = !q || title.includes(q) || docType.includes(q) || status.includes(q);
      const matchesFilter =
        caseFilter === "all"
          ? true
          : caseFilter === "active"
            ? !status.includes("archived") && !status.includes("closed")
            : caseFilter === "urgent"
              ? row.timeSensitive || Boolean(row.earliestDeadline)
              : status.includes("archived") || status.includes("closed");
      return matchesSearch && matchesFilter;
    });
  }, [cases, caseFilter, caseSearch]);
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
    hapticTap();
    LayoutAnimation.configureNext(subtleSpring);
    setWorkspaceSectionOpen((current) => ({
      ...current,
      [key]: !current[key]
    }));
  }
  useEffect(() => {
    if (screen !== "workspace") return;
    setWorkspaceSectionOpen({
      steps: false,
      watch: false,
      packet: false,
      context: false,
      category: false,
      summary: false,
      plain_meaning: false,
      timeline: false
    });
  }, [screen, selectedCaseId]);
  const completion = useMemo(() => {
    if (!me) return 0;
    const count = [me.user.fullName, me.user.zipCode, me.user.jurisdictionState].filter(Boolean).length;
    return Math.round((count / 3) * 100);
  }, [me]);
  const classificationConfidenceValue = useMemo(
    () => selectedCase?.classificationConfidence ?? selectedCaseSummary?.classificationConfidence ?? null,
    [selectedCase?.classificationConfidence, selectedCaseSummary?.classificationConfidence]
  );
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
  const trackedDateCount = useMemo(() => {
    const uniqueDates = new Set<string>();
    if (activeEarliestDeadline) {
      uniqueDates.add(activeEarliestDeadline.slice(0, 10));
    }
    for (const signal of deadlineSignals) {
      if (signal.dateIso) {
        uniqueDates.add(signal.dateIso.slice(0, 10));
      }
    }
    return uniqueDates.size;
  }, [activeEarliestDeadline, deadlineSignals]);
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
  const timelineTrust = useMemo(
    () => ({
      confidence: confidenceLabel(classificationConfidenceValue),
      receipts: deadlineSignals.length + readinessSnapshots.length,
      uncertainty: topUncertaintyNote
    }),
    [classificationConfidenceValue, deadlineSignals.length, readinessSnapshots.length, topUncertaintyNote]
  );
  const evidenceTrust = useMemo(() => {
    const confidence =
      evidenceCompleteness.score >= 80
        ? "high"
        : evidenceCompleteness.score >= 60
          ? "medium"
          : "low";
    return {
      confidence,
      receipts: evidenceChecklist.length,
      uncertainty: evidenceCompleteness.missing[0] ?? topUncertaintyNote
    };
  }, [evidenceCompleteness, evidenceChecklist.length, topUncertaintyNote]);
  const readinessTrust = useMemo(() => {
    const confidence = readinessSnapshots.length >= 2 ? "high" : readinessSnapshots.length === 1 ? "medium" : "low";
    return {
      confidence,
      receipts: readinessSnapshots.length,
      uncertainty: topUncertaintyNote
    };
  }, [readinessSnapshots.length, topUncertaintyNote]);
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
  const intakeSections = useMemo(
    () => [
      intakeDraft.matterSummary,
      intakeDraft.clientGoals,
      intakeDraft.constraints,
      intakeDraft.timelineNarrative,
      intakeDraft.partiesAndRoles,
      intakeDraft.communicationsLog,
      intakeDraft.financialImpact,
      intakeDraft.questionsForCounsel,
      intakeDraft.desiredOutcome
    ],
    [intakeDraft]
  );
  const intakeCompleteness = useMemo(() => {
    const total = intakeSections.length;
    const completed = intakeSections.filter((row) => row.trim().length >= 8).length;
    return Math.round((completed / total) * 100);
  }, [intakeSections]);
  const costSavingIndicator = useMemo(() => {
    const readinessWeight = readinessTrajectory.end / 100;
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
        ? `Ahorro estimado en preparacion de consulta: ${low}-${high} minutos.`
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
    const confidenceText =
      language === "es"
        ? localizedConfidenceLabel(language, classificationConfidenceValue)
        : localizedConfidenceLabel(language, classificationConfidenceValue);

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
  useEffect(() => {
    assetViewerImagePanRef.current = assetViewerImagePan;
  }, [assetViewerImagePan]);

  useEffect(() => {
    setAssetViewerImagePan((current) => {
      const maxX = ((Math.max(assetViewerImageZoom, 1) - 1) * assetViewerImageBounds.width) / 2;
      const maxY = ((Math.max(assetViewerImageZoom, 1) - 1) * assetViewerImageBounds.height) / 2;
      const next = {
        x: clamp(current.x, -maxX, maxX),
        y: clamp(current.y, -maxY, maxY)
      };
      if (next.x === current.x && next.y === current.y) return current;
      return next;
    });
  }, [assetViewerImageBounds.height, assetViewerImageBounds.width, assetViewerImageZoom]);

  useEffect(() => {
    async function hydrate(): Promise<void> {
      try {
        const [savedBase, savedSubject, savedEmail, savedOnboarded, savedOfflineSession, savedPlanTier, savedLanguage] = await Promise.all([
          AsyncStorage.getItem(STORAGE_API_BASE),
          AsyncStorage.getItem(STORAGE_SUBJECT),
          AsyncStorage.getItem(STORAGE_EMAIL),
          AsyncStorage.getItem(STORAGE_ONBOARDED),
          AsyncStorage.getItem(STORAGE_OFFLINE_SESSION),
          AsyncStorage.getItem(STORAGE_PLAN_TIER),
          AsyncStorage.getItem(STORAGE_LANGUAGE)
        ]);
        const parsedPlanTier = parsePlanTier(savedPlanTier);
        if (parsedPlanTier) {
          setPlanTier(parsedPlanTier);
        }
        const parsedLanguage = parseLanguage(savedLanguage);
        if (parsedLanguage) {
          setLanguage(parsedLanguage);
        }

        let nextBase = DEFAULT_API_BASE;
        if (ENV_API_BASE) {
          nextBase = ENV_API_BASE;
          await AsyncStorage.setItem(STORAGE_API_BASE, ENV_API_BASE);
        } else if (savedBase?.trim()) {
          const trimmedSaved = savedBase.trim();
          if (
            (isPrivateIpv4Host(extractHostFromApiBase(DEFAULT_API_BASE) ?? "") && !isLocalApiBase(trimmedSaved)) ||
            (!isLoopbackApiBase(DEFAULT_API_BASE) && isLoopbackApiBase(trimmedSaved))
          ) {
            nextBase = DEFAULT_API_BASE;
            await AsyncStorage.setItem(STORAGE_API_BASE, DEFAULT_API_BASE);
          } else {
            nextBase = trimmedSaved;
          }
        }
        setApiBase(nextBase);
        setApiBaseInput(nextBase);

        const nextSubject = savedSubject?.trim() || DEFAULT_SUBJECT;
        const nextEmail = savedEmail?.trim() || DEFAULT_EMAIL;
        setSubject(nextSubject);
        setSubjectInput(nextSubject);
        setEmail(nextEmail);
        setEmailInput(nextEmail);
        setAuthEmail(nextEmail);

        const onboardingDone = savedOnboarded === "1";
        const fallbackScreen: ContentScreen = onboardingDone ? "auth" : "onboarding";
        let nextContentScreen: ContentScreen = fallbackScreen;

        const hasSession = Boolean(savedSubject?.trim() && savedEmail?.trim());
        if (hasSession) {
          setOfflineMode(false);
          nextContentScreen = "home";
          void loadDashboard(nextBase, buildHeaders(nextSubject, nextEmail));
        } else if (savedOfflineSession) {
          try {
            const parsed = JSON.parse(savedOfflineSession) as { me: MeResponse; cases: CaseSummary[] };
            if (parsed.me?.user?.email) {
              setMe(parsed.me);
              const restoredCases = parsed.cases?.length ? parsed.cases : [...DEMO_CASES];
              setCases(restoredCases);
              const firstId = restoredCases[0]?.id ?? null;
              setSelectedCaseId(firstId);
              if (firstId && DEMO_CASE_DETAIL_MAP[firstId]) {
                setSelectedCase(DEMO_CASE_DETAIL_MAP[firstId]);
              }
              setProfileName(parsed.me.user.fullName ?? "");
              setProfileZip(parsed.me.user.zipCode ?? "");
              setPlanTier(parsed.me.entitlement?.isPlus ? "plus" : "free");
              setPushEnabled(Boolean(parsed.me.pushPreferences?.enabled));
              setPushQuietHoursEnabled(
                Boolean(parsed.me.pushPreferences?.quietHoursStart && parsed.me.pushPreferences?.quietHoursEnd)
              );
              setOfflineMode(true);
              nextContentScreen = "home";
            }
          } catch {
            nextContentScreen = fallbackScreen;
          }
        }

        if (!parsedLanguage) {
          setPostLanguageScreen(nextContentScreen);
          setScreen("language");
        } else {
          setScreen(nextContentScreen);
        }
      } catch {
        // Keep defaults.
      } finally {
        setIsBootstrapping(false);
      }
    }
    void hydrate();
  }, []);

  useEffect(() => {
    async function upgradeLoopbackBaseForDevice(): Promise<void> {
      if (ENV_API_BASE) return;
      if (Platform.OS === "web") return;
      const metroHost = extractMetroHost();
      if (!metroHost || isLoopbackHost(metroHost)) return;
      const suggestedBase = `http://${metroHost}:3001`;

      setApiBase((current) => (!isLocalApiBase(current) ? suggestedBase : current));
      setApiBaseInput((current) => (!isLocalApiBase(current) ? suggestedBase : current));

      try {
        const savedBase = await AsyncStorage.getItem(STORAGE_API_BASE);
        if (!savedBase || !isLocalApiBase(savedBase)) {
          await AsyncStorage.setItem(STORAGE_API_BASE, suggestedBase);
        }
      } catch {
        // Ignore local storage write failures.
      }
    }
    void upgradeLoopbackBaseForDevice();
  }, []);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 5000);
    return () => clearTimeout(t);
  }, [banner]);

  useEffect(() => {
    if (!selectedCaseId) {
      setSelectedCase(null);
      setCaseAssets([]);
      setPlainMeaningRows([]);
      setPlainMeaningBoundary("");
      return;
    }
    if (offlineMode) {
      const demoDetail = DEMO_CASE_DETAIL_MAP[selectedCaseId] ?? null;
      setSelectedCase(demoDetail);
      setCaseAssets(demoDetail?.assets?.map((a) => ({ ...a, source: a.source ?? "camera", processingStatus: (a.processingStatus ?? "succeeded") as "pending" | "succeeded" | "failed", assetType: a.assetType ?? "image" })) ?? []);
      return;
    }
    void loadCase(selectedCaseId);
    void loadCaseAssetsForSelectedCase(selectedCaseId);
  }, [selectedCaseId, apiBase, headers, offlineMode]);

  useEffect(() => {
    setCaseContextDraft(extractCaseContextFromAuditLogs(selectedCase?.auditLogs));
  }, [selectedCase?.id, selectedCase?.updatedAt]);

  useEffect(() => {
    const selectedType = selectedCase?.documentType ?? selectedCaseSummary?.documentType ?? null;
    if (isManualDocumentType(selectedType)) {
      setClassificationDraft(selectedType);
      return;
    }
    setClassificationDraft("unknown_legal_document");
  }, [selectedCase?.id, selectedCase?.documentType, selectedCaseSummary?.id, selectedCaseSummary?.documentType]);

  useEffect(() => {
    if (!lawyerSummaryOpen || !plusEnabled || !selectedCaseId || offlineMode) return;
    void loadConsultPacketLinks(selectedCaseId);
  }, [lawyerSummaryOpen, plusEnabled, selectedCaseId, offlineMode]);

  useEffect(() => {
    setConsultLinks([]);
    setLatestContextReuseSourceCaseId(null);
    closeAssetViewer();
  }, [selectedCaseId]);

  useEffect(() => {
    async function hydrateCaseLocalState(): Promise<void> {
      if (!selectedCaseId) {
        setIntakeDraft(emptyIntakeDraft());
        setStepProgressMap({});
        return;
      }
      try {
        const [savedIntake, savedProgress] = await Promise.all([
          AsyncStorage.getItem(intakeStorageKey(selectedCaseId)),
          AsyncStorage.getItem(stepStatusStorageKey(selectedCaseId))
        ]);

        if (savedIntake) {
          const parsed = parseIntakeDraft(JSON.parse(savedIntake));
          setIntakeDraft(parsed ?? emptyIntakeDraft());
        } else {
          setIntakeDraft(emptyIntakeDraft());
        }

        if (savedProgress) {
          const parsedRaw = JSON.parse(savedProgress);
          if (parsedRaw && typeof parsedRaw === "object" && !Array.isArray(parsedRaw)) {
            const record = parsedRaw as Record<string, unknown>;
            const next: Record<string, StepProgress> = {};
            for (const [k, v] of Object.entries(record)) {
              const parsed = parseStepProgress(v);
              if (parsed) next[k] = parsed;
            }
            setStepProgressMap(next);
          } else {
            setStepProgressMap({});
          }
        } else {
          setStepProgressMap({});
        }
      } catch {
        setIntakeDraft(emptyIntakeDraft());
        setStepProgressMap({});
      }
    }
    void hydrateCaseLocalState();
  }, [selectedCaseId]);

  useEffect(() => {
    if (!selectedCaseId) return;
    void AsyncStorage.setItem(intakeStorageKey(selectedCaseId), JSON.stringify(intakeDraft));
  }, [intakeDraft, selectedCaseId]);

  useEffect(() => {
    if (!selectedCaseId) return;
    void AsyncStorage.setItem(stepStatusStorageKey(selectedCaseId), JSON.stringify(stepProgressMap));
  }, [stepProgressMap, selectedCaseId]);

  function showBanner(tone: BannerTone, text: string): void {
    if (tone === "good") hapticSuccess();
    setBanner({ tone, text });
  }

  async function sendTrackedEvent(
    event: string,
    source?: string,
    properties?: Record<string, unknown>
  ): Promise<void> {
    if (offlineMode) return;
    try {
      await trackEvent(apiBase, headers, {
        event,
        source,
        locale: language,
        paywallVariant: paywallConfig.paywallVariant,
        properties
      });
    } catch {
      // Tracking is best-effort.
    }
  }

  function openPaywall(triggerSource: string): void {
    setPlanSheetOpen(true);
    void sendTrackedEvent("paywall_viewed", triggerSource);
  }

  function promptPlusUpgrade(feature: PlusFeatureGate): void {
    showBanner("info", plusUpgradeExplainer(language, feature));
    openPaywall(feature === "watch_mode" ? "watch_mode_lock" : "consult_links_lock");
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

  function setStepProgress(stepId: string, next: StepProgress): void {
    setStepProgressMap((current) => ({
      ...current,
      [stepId]: next
    }));
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

  async function startPlusCheckout(triggerSource: string): Promise<void> {
    if (offlineMode) {
      showBanner(
        "info",
        language === "es"
          ? "La facturacion requiere conexion API."
          : "Billing checkout requires API connectivity."
      );
      return;
    }
    if (!paywallConfig.billingEnabled) {
      showBanner(
        "info",
        language === "es"
          ? "La facturacion no esta disponible por ahora."
          : "Billing is not available right now."
      );
      return;
    }

    setStartingCheckout(true);
    try {
      const checkout = await createBillingCheckout(apiBase, headers, {
        plan: "plus_monthly",
        triggerSource,
        locale: language
      });
      setPaywallConfig((current) => ({
        ...current,
        plusPriceMonthly: checkout.plusPriceMonthly || current.plusPriceMonthly,
        paywallVariant: checkout.paywallVariant || current.paywallVariant
      }));
      setPlanSheetOpen(false);
      await Linking.openURL(checkout.checkoutUrl);
      showBanner(
        "info",
        language === "es"
          ? "Se abrio checkout. Puede cancelar desde configuracion de cuenta."
          : "Checkout opened. You can cancel from account settings."
      );
      await loadDashboard();
    } catch (error) {
      showBanner(
        "bad",
        language === "es"
          ? `No se pudo iniciar checkout: ${withNetworkHint(error, apiBase)}`
          : `Could not start checkout: ${withNetworkHint(error, apiBase)}`
      );
    } finally {
      setStartingCheckout(false);
    }
  }

  async function setLanguageWithPersistence(nextLanguage: AppLanguage): Promise<void> {
    setLanguage(nextLanguage);
    try {
      await AsyncStorage.setItem(STORAGE_LANGUAGE, nextLanguage);
    } catch {
      // Ignore storage failures.
    }
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

  async function bootstrapOfflineSession(nextEmail: string, fullName: string, zipCode: string): Promise<void> {
    const now = new Date().toISOString();
    const idSuffix = `${Date.now()}`;
    const offlineMe: MeResponse = {
      user: {
        id: `offline-user-${idSuffix}`,
        authProviderUserId: `offline-${deriveSubject(nextEmail)}`,
        email: nextEmail,
        fullName: fullName || null,
        zipCode: zipCode || null,
        jurisdictionState: null,
        createdAt: now,
        updatedAt: now
      },
      needsProfile: !fullName || !zipCode,
      entitlement: {
        id: `offline-entitlement-${idSuffix}`,
        plan: "plus",
        status: "active",
        source: "manual",
        startAt: now,
        endAt: null,
        isPlus: true,
        viaAllowlistFallback: false
      },
      pushPreferences: {
        enabled: false,
        language,
        quietHoursStart: null,
        quietHoursEnd: null
      },
      pushDevices: {
        activeCount: 0
      }
    };

    const offlineCases: CaseSummary[] = [...DEMO_CASES];

    setMe(offlineMe);
    setCases(offlineCases);
    setSelectedCaseId(offlineCases[0]?.id ?? null);
    setSelectedCase(DEMO_CASE_DETAIL_MAP[offlineCases[0]?.id] ?? null);
    setProfileName(offlineMe.user.fullName ?? "");
    setProfileZip(offlineMe.user.zipCode ?? "");
    setPlanTier("plus");
    setPushEnabled(false);
    setPushQuietHoursEnabled(false);
    setOfflineMode(true);

    try {
      await AsyncStorage.setItem(STORAGE_OFFLINE_SESSION, JSON.stringify({ me: offlineMe, cases: offlineCases }));
      await AsyncStorage.setItem(STORAGE_ONBOARDED, "1");
    } catch {
      // Ignore storage failures.
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

  async function signOut(): Promise<void> {
    setDrawerOpen(false);
    setMe(null);
    setCases([]);
    setSelectedCaseId(null);
    setSelectedCase(null);
    setOfflineMode(false);
    setAuthPassword("");
    setAuthIntent("login");
    setAuthMode("selection");
    setScreen("auth");
    setPlanTier("free");
    setPushEnabled(false);
    setPushQuietHoursEnabled(false);
    setSubject(DEFAULT_SUBJECT);
    setSubjectInput(DEFAULT_SUBJECT);
    setEmail(DEFAULT_EMAIL);
    setEmailInput(DEFAULT_EMAIL);
    setAuthEmail(DEFAULT_EMAIL);
    try {
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_SUBJECT),
        AsyncStorage.removeItem(STORAGE_EMAIL),
        AsyncStorage.removeItem(STORAGE_OFFLINE_SESSION)
      ]);
    } catch {
      // Ignore storage failures.
    }
    showBanner("info", "Signed out.");
  }

  async function persistConnection(nextBase: string, nextSubject: string, nextEmail: string): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.setItem(STORAGE_API_BASE, nextBase),
        AsyncStorage.setItem(STORAGE_SUBJECT, nextSubject),
        AsyncStorage.setItem(STORAGE_EMAIL, nextEmail)
      ]);
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

  async function registerDefaultPushDevice(base: string, auth: AuthHeaders, lang: AppLanguage): Promise<void> {
    if (offlineMode) return;
    try {
      const deviceId = await getOrCreatePushDeviceId();
      // Try to get a real Expo push token; fall back to synthetic token for dev
      const expoPushToken = await requestExpoPushToken().catch(() => null);
      const token = expoPushToken ?? `clearcase-dev-${deviceId}`;
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

  async function applyServerMeState(meData: MeResponse, base: string, auth: AuthHeaders): Promise<void> {
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

    const pushLanguage = meData.pushPreferences?.language === "es" ? "es" : "en";
    void registerDefaultPushDevice(base, auth, pushLanguage);
  }

  async function loadPaywallConfigState(base = apiBase, auth = headers): Promise<void> {
    if (offlineMode) return;
    try {
      const config = await getPaywallConfig(base, auth);
      setPaywallConfig({
        plusPriceMonthly: config.plusPriceMonthly || DEFAULT_PLUS_PRICE_MONTHLY,
        paywallVariant: config.paywallVariant || "gold_v1",
        showAlternatePlan: config.showAlternatePlan === true,
        billingEnabled: config.billingEnabled !== false
      });
    } catch {
      // Keep local defaults when config endpoint is unavailable.
    }
  }

  async function verifyConnection(base = apiBase): Promise<void> {
    try {
      const health = await getHealth(base);
      if (!health.ok) throw new Error("health failed");
      setConnStatus("ok");
      setConnMessage(`Connected to ${base}`);
    } catch (error) {
      setConnStatus("error");
      setConnMessage(`Connection failed: ${withNetworkHint(error, base)}`);
      throw error;
    }
  }

  function detectLanApiBase(): string | null {
    const metroHost = extractMetroHost();
    if (!metroHost || !isPrivateIpv4Host(metroHost)) return null;
    return `http://${metroHost}:3001`;
  }

  async function resolveAuthApiBase(preferredBase: string): Promise<string> {
    const primaryBase = preferredBase.trim();
    if (!primaryBase) return preferredBase;

    try {
      const primaryHealth = await getHealth(primaryBase);
      if (primaryHealth.ok) return primaryBase;
    } catch (primaryError) {
      const lanBase = detectLanApiBase();
      if (lanBase && lanBase !== primaryBase) {
        try {
          const lanHealth = await getHealth(lanBase);
          if (lanHealth.ok) {
            setApiBase(lanBase);
            setApiBaseInput(lanBase);
            setConnStatus("ok");
            setConnMessage(`Connected to ${lanBase}`);
            showBanner("info", "Primary API unavailable. Switched to local network API.");
            return lanBase;
          }
        } catch {
          // Keep the original error path; caller can fallback to offline mode.
        }
      }
      throw primaryError;
    }

    return primaryBase;
  }

  async function loadDashboard(base = apiBase, auth = headers): Promise<void> {
    setLoadingDashboard(true);
    try {
      const [meData, caseData] = await Promise.all([getMe(base, auth), getCases(base, auth)]);
      setConnStatus("ok");
      setConnMessage(`Connected to ${base}`);
      setOfflineMode(false);
      void AsyncStorage.removeItem(STORAGE_OFFLINE_SESSION);
      await applyServerMeState(meData, base, auth);
      await loadPaywallConfigState(base, auth);
      setCases(caseData.cases);
      setSelectedCaseId((cur) => (cur && caseData.cases.some((row) => row.id === cur) ? cur : (caseData.cases[0]?.id ?? null)));
    } catch (error) {
      setConnStatus("error");
      setConnMessage(`Connection failed: ${withNetworkHint(error, base)}`);
      showBanner("bad", `Workspace load failed: ${withNetworkHint(error, base)}`);
    } finally {
      setLoadingDashboard(false);
    }
  }

  async function loadCase(caseId: string, base = apiBase, auth = headers): Promise<void> {
    setLoadingCase(true);
    try {
      setSelectedCase(await getCaseById(base, auth, caseId));
    } catch (error) {
      setSelectedCase(null);
      showBanner("bad", `Case load failed: ${withNetworkHint(error, base)}`);
    } finally {
      setLoadingCase(false);
    }
  }

  async function loadCaseAssetsForSelectedCase(
    caseId: string,
    base = apiBase,
    auth = headers
  ): Promise<void> {
    if (offlineMode) {
      setCaseAssets([]);
      return;
    }
    setLoadingCaseAssets(true);
    try {
      const response = await getCaseAssets(base, auth, caseId);
      setCaseAssets(response.assets);
    } catch {
      setCaseAssets([]);
    } finally {
      setLoadingCaseAssets(false);
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

  async function applyConnection(): Promise<void> {
    const nextBase = apiBaseInput.trim();
    const nextSubject = subjectInput.trim() || DEFAULT_SUBJECT;
    const nextEmail = emailInput.trim() || DEFAULT_EMAIL;
    if (!nextBase) {
      Alert.alert("Missing API URL", "Enter an API base URL first.");
      return;
    }
    setApiBase(nextBase);
    setSubject(nextSubject);
    setEmail(nextEmail);
    await persistConnection(nextBase, nextSubject, nextEmail);
    await loadDashboard(nextBase, buildHeaders(nextSubject, nextEmail));
    showBanner("info", "Connection settings applied.");
  }

  async function refreshWorkspace(): Promise<void> {
    setRefreshing(true);
    if (offlineMode) {
      setRefreshing(false);
      return;
    }
    await loadDashboard();
    if (selectedCaseId) await loadCase(selectedCaseId);
    setRefreshing(false);
  }

  async function reconnectWorkspace(): Promise<void> {
    setRefreshing(true);
    try {
      await verifyConnection(apiBase);
      await loadDashboard(apiBase, headers);
      if (selectedCaseId) {
        await loadCase(selectedCaseId, apiBase, headers);
      }
      showBanner("good", "Connection restored. Uploads are available.");
    } catch (error) {
      const message = withNetworkHint(error, apiBase);
      showBanner("bad", "Still offline: " + message);
      Alert.alert("Still offline", message);
    } finally {
      setRefreshing(false);
    }
  }

  async function createCaseWithTitle(title?: string): Promise<string | null> {
    const clean = buildAutoCaseTitle(title);
    const fallbackTitle = buildAutoCaseTitle(undefined);
    if (offlineMode) {
      const now = new Date().toISOString();
      const offlineCase: CaseSummary = {
        id: `offline-case-${Date.now()}`,
        title: clean,
        documentType: null,
        classificationConfidence: null,
        status: "draft",
        timeSensitive: false,
        earliestDeadline: null,
        plainEnglishExplanation: "Offline mode case. Connect API to process documents.",
        nonLegalAdviceDisclaimer: "For informational context only. Not legal advice.",
        updatedAt: now,
        _count: { assets: 0, extractions: 0, verdicts: 0 }
      };
      const nextCases = [offlineCase, ...cases];
      setCases(nextCases);
      setSelectedCaseId(offlineCase.id);
      try {
        if (me) {
          await AsyncStorage.setItem(STORAGE_OFFLINE_SESSION, JSON.stringify({ me, cases: nextCases }));
        }
      } catch {
        // Ignore storage failures.
      }
      showBanner("info", "Case created in offline mode.");
      return offlineCase.id;
    }
    setCreatingCase(true);
    try {
      const titleCandidates = Array.from(new Set([clean, fallbackTitle]));
      let lastError: unknown = null;

      for (const candidate of titleCandidates) {
        try {
          const created = await createCase(apiBase, headers, candidate);
          setSelectedCaseId(created.id);
          setNewCaseTitle("");
          await loadDashboard();
          showBanner("good", "Case created.");
          return created.id;
        } catch (error) {
          lastError = error;
        }
      }

      const message = withNetworkHint(lastError, apiBase);
      showBanner("bad", `Case creation failed: ${message}`);
      Alert.alert("Case creation failed", message);
      return null;
    } catch (error) {
      const message = withNetworkHint(error, apiBase);
      showBanner("bad", `Case creation failed: ${message}`);
      Alert.alert("Case creation failed", message);
      return null;
    } finally {
      setCreatingCase(false);
    }
  }

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

        if (hasInsight) {
          return found;
        }
      } catch {
        // Keep polling window short; transient fetch failures are handled by caller.
      }

      await sleep(2000);
    }

    return lastSeen;
  }

  async function uploadAssets(
    assets: UploadAssetInput[],
    caseIdArg?: string,
    userDescription?: string,
    preferredCaseTitle?: string
  ): Promise<void> {
    if (offlineMode) {
      Alert.alert("Offline mode", "Uploads need API connectivity.", [
        { text: "Retry connection", onPress: () => void reconnectWorkspace() },
        { text: "Open workspace", onPress: () => setScreen("workspace") },
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
      caseId = await createCaseWithTitle(baseTitle);
    }
    if (!caseId) {
      setUploadStage("idle");
      Alert.alert("Could not start case", "We could not create a case from this upload. Please retry.");
      return;
    }

    setUploading(true);
    void sendTrackedEvent("upload_started", "asset_upload_flow", {
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
      setSelectedCaseId(caseId);
      await Promise.all([loadDashboard(), loadCase(caseId)]);
      await loadCaseAssetsForSelectedCase(caseId);
      setScreen("workspace");
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
      void sendTrackedEvent("upload_completed", "asset_upload_flow", {
        caseId,
        fileCount: uploadedCount,
        reusedCrossCaseMemory: Boolean(crossCaseReuseSource)
      });

      void (async () => {
        try {
          const caseAfterUpload = await waitForCaseInsight(caseId, 12000);
          if (!caseAfterUpload) {
            showBanner("info", "Still processing. Pull to refresh in Workspace in a few seconds.");
            return;
          }

          await Promise.all([loadDashboard(), loadCase(caseId)]);
          await loadCaseAssetsForSelectedCase(caseId);
          if (caseAfterUpload.earliestDeadline) {
            void sendTrackedEvent("first_deadline_detected", "asset_upload_flow", {
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
        openPaywall("free_limit_reached");
        Alert.alert(
          language === "es" ? "Se alcanzo el limite mensual de Free" : "Free monthly limit reached",
          `${baseMessage}\n\n${detail}`,
          [
            {
              text: language === "es" ? "Activar Plus" : "Unlock Plus",
              onPress: () => openPaywall("free_limit_reached")
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
        openPaywall("free_ocr_disabled");
        Alert.alert(language === "es" ? "Se alcanzo el limite mensual de Free" : "Free monthly limit reached", message, [
          { text: language === "es" ? "Activar Plus" : "Unlock Plus", onPress: () => openPaywall("free_ocr_disabled") },
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

  async function uploadFromCamera(
    caseIdArg?: string,
    userDescription?: string,
    preferredCaseTitle?: string
  ): Promise<void> {
    if (offlineMode) {
      Alert.alert("Offline mode", "Uploads need API connectivity.", [
        { text: "Retry connection", onPress: () => void reconnectWorkspace() },
        { text: "Open workspace", onPress: () => setScreen("workspace") },
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

  async function saveProfile(): Promise<void> {
    const fullName = profileName.trim();
    const zipCode = profileZip.trim();
    if (!fullName && !zipCode) {
      Alert.alert("Nothing to save", "Enter full name or ZIP code.");
      return;
    }
    if (offlineMode) {
      if (!me) return;
      const now = new Date().toISOString();
      const updated: MeResponse = {
        ...me,
        user: {
          ...me.user,
          fullName: fullName || me.user.fullName,
          zipCode: zipCode || me.user.zipCode,
          updatedAt: now
        },
        needsProfile: !(fullName || me.user.fullName) || !(zipCode || me.user.zipCode)
      };
      setMe(updated);
      try {
        await AsyncStorage.setItem(STORAGE_OFFLINE_SESSION, JSON.stringify({ me: updated, cases }));
      } catch {
        // Ignore storage failures.
      }
      showBanner("info", "Profile saved in offline mode.");
      return;
    }

    setSavingProfile(true);
    try {
      const payload: { fullName?: string; zipCode?: string } = {};
      if (fullName) payload.fullName = fullName;
      if (zipCode) payload.zipCode = zipCode;
      const updated = await patchMe(apiBase, headers, payload);
      await applyServerMeState(updated, apiBase, headers);
      showBanner("good", "Profile saved.");
    } catch (error) {
      const message = withNetworkHint(error, apiBase);
      showBanner("bad", `Profile save failed: ${message}`);
      Alert.alert("Profile save failed", message);
    } finally {
      setSavingProfile(false);
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
      await setCaseClassification(apiBase, headers, selectedCaseId, classificationDraft);
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

  async function agreeAndContinue(): Promise<void> {
    const trimmedEmail = authEmail.trim();
    if (!trimmedEmail) {
      Alert.alert("Email required", "Enter your email address.");
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      Alert.alert("Invalid email", "Enter a valid email address.");
      return;
    }
    if (!isStrongPassword(authPassword)) {
      Alert.alert("Weak password", "Password must be at least 8 characters.");
      return;
    }
    if (authIntent === "signup" && !authName.trim()) {
      Alert.alert("Name required", "Enter your full name.");
      return;
    }
    if (authIntent === "signup" && authZip.trim() && !isValidUsZip(authZip)) {
      Alert.alert("Invalid ZIP", "Use a valid US ZIP code like 90210.");
      return;
    }

    setAuthBusy(true);
    setAuthStage("account");
    try {
      const baseForAuth = await resolveAuthApiBase(apiBase);
      const nextEmail = trimmedEmail;
      const nextSubject = deriveSubject(nextEmail);
      const nextHeaders = buildHeaders(nextSubject, nextEmail);

      setApiBase(baseForAuth);
      setApiBaseInput(baseForAuth);
      setEmail(nextEmail);
      setEmailInput(nextEmail);
      setSubject(nextSubject);
      setSubjectInput(nextSubject);
      await persistConnection(baseForAuth, nextSubject, nextEmail);

      let meData = await getMe(baseForAuth, nextHeaders);
      if (authIntent === "signup") {
        setAuthStage("profile");
        const payload: { fullName?: string; zipCode?: string } = {};
        if (authName.trim()) payload.fullName = authName.trim();
        if (authZip.trim()) payload.zipCode = authZip.trim();
        if (payload.fullName || payload.zipCode) {
          meData = await patchMe(baseForAuth, nextHeaders, payload);
        }
      }

      await applyServerMeState(meData, baseForAuth, nextHeaders);
      setAuthStage("workspace");
      const caseData = await getCases(baseForAuth, nextHeaders);
      const nextCases = caseData.cases;
      setConnStatus("ok");
      setConnMessage(`Connected to ${baseForAuth}`);
      setOfflineMode(false);
      await AsyncStorage.removeItem(STORAGE_OFFLINE_SESSION);
      setCases(nextCases);
      setSelectedCaseId(nextCases[0]?.id ?? null);
      await AsyncStorage.setItem(STORAGE_ONBOARDED, "1");
      setScreen("home");
      setAuthMode("selection");
      showBanner("good", "Welcome to ClearCase.");
    } catch (error) {
      const message = withNetworkHint(error, apiBase);
      if (isNetworkErrorLike(message)) {
        await bootstrapOfflineSession(trimmedEmail, authName.trim(), authZip.trim());
        setAuthMode("selection");
        setScreen("home");
        showBanner("info", "Connected in offline mode. Some features are limited until API is reachable.");
      } else {
        showBanner("bad", `Could not continue: ${message}`);
        Alert.alert("Could not continue", message);
      }
    } finally {
      setAuthBusy(false);
      setAuthStage("idle");
    }
  }

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

  const uploadStatusText = uploading ? formatUploadStage(uploadStage, language) : language === "es" ? "Listo para cargar" : "Ready to upload";
  const canOpenDrawer =
    screen === "home" || screen === "workspace" || screen === "cases" || screen === "account" || screen === "legal";
  const drawerPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          if (!canOpenDrawer || drawerOpen) return false;
          const startedAtEdge = gestureState.x0 <= 24 || gestureState.moveX <= 24;
          const horizontalSwipe =
            gestureState.dx > 14 &&
            Math.abs(gestureState.dy) < 20 &&
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
          return startedAtEdge && horizontalSwipe;
        },
        onPanResponderRelease: (_, gestureState) => {
          if (!canOpenDrawer || drawerOpen) return;
          if (gestureState.dx > 55) setDrawerOpen(true);
        }
      }),
    [canOpenDrawer, drawerOpen]
  );
  const assetViewerImagePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => assetViewerIsImage && assetViewerImageZoom > 1,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          assetViewerIsImage &&
          assetViewerImageZoom > 1 &&
          (Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3),
        onPanResponderGrant: () => {
          assetViewerImagePanStartRef.current = assetViewerImagePanRef.current;
        },
        onPanResponderMove: (_, gestureState) => {
          const maxX = ((Math.max(assetViewerImageZoom, 1) - 1) * assetViewerImageBounds.width) / 2;
          const maxY = ((Math.max(assetViewerImageZoom, 1) - 1) * assetViewerImageBounds.height) / 2;
          setAssetViewerImagePan({
            x: clamp(assetViewerImagePanStartRef.current.x + gestureState.dx, -maxX, maxX),
            y: clamp(assetViewerImagePanStartRef.current.y + gestureState.dy, -maxY, maxY)
          });
        }
      }),
    [assetViewerImageBounds.height, assetViewerImageBounds.width, assetViewerImageZoom, assetViewerIsImage]
  );

  if (!fontsLoaded || isBootstrapping) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.loading}>
          <ActivityIndicator color={palette.primary} />
          <Text style={styles.loadingText}>Loading app...</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          {...drawerPanResponder.panHandlers}
        >
          {banner ? (
            <View
              style={[
                styles.banner,
                banner.tone === "good" ? styles.bannerGood : null,
                banner.tone === "bad" ? styles.bannerBad : null
              ]}
            >
              <Text style={styles.bannerText}>{banner.text}</Text>
            </View>
          ) : null}

          {screen === "language" ? (
            <View style={styles.screen}>
              <View style={styles.centerWrap}>
                <LinearGradient
                  colors={["#F8FAFC", "#E2E8F0"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.onboardingCard}
                >
                  <View style={[styles.brandPill, { backgroundColor: "#EFF6FF" }]}>
                    <Feather name="globe" size={32} color="#1D4ED8" />
                  </View>
                  <Text style={styles.heroTitle}>Choose app language</Text>
                  <Text style={styles.heroCopy}>English or Espanol. You can change this later in Account settings.</Text>
                  <Pressable style={styles.primaryBtn} onPress={() => void selectInitialLanguage("en")}>
                    <Text style={styles.primaryBtnText}>English</Text>
                  </Pressable>
                  <Pressable style={styles.outlineBtn} onPress={() => void selectInitialLanguage("es")}>
                    <Text style={styles.outlineBtnText}>Espanol</Text>
                  </Pressable>
                  <Text style={styles.subtleCenterText}>Informational guidance only. Not legal advice.</Text>
                </LinearGradient>
              </View>
            </View>
          ) : null}

          {screen === "onboarding" ? (
            <View style={styles.screen}>
              <View style={styles.rowTopRight}>
                <Pressable onPress={() => void completeOnboarding()}>
                  <Text style={styles.skip}>{language === "es" ? "Saltar" : "Skip"}</Text>
                </Pressable>
              </View>
              <View style={styles.centerWrap}>
                <LinearGradient
                  colors={["#F8FAFC", "#E2E8F0"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.onboardingCard}
                >
                  <View style={[styles.brandPill, { backgroundColor: onboardingSlides[slide].iconBg }]}>
                    {renderSlideIcon(onboardingSlides[slide])}
                  </View>
                  <Text style={styles.slideStepper}>
                    {language === "es" ? "Paso" : "Step"} {slide + 1} {language === "es" ? "de" : "of"} {onboardingSlides.length}
                  </Text>
                  <Text style={styles.heroTitle}>{onboardingSlides[slide].title}</Text>
                  <Text style={styles.heroCopy}>{onboardingSlides[slide].description}</Text>
                </LinearGradient>
              </View>
              <View style={styles.bottomNav}>
                <Pressable onPress={() => { hapticTap(); LayoutAnimation.configureNext(subtleSpring); setSlide((s) => Math.max(0, s - 1)); }} style={[styles.circle, slide === 0 ? styles.invisible : null]}>
                  <Feather name="arrow-left" size={20} color={palette.muted} />
                </Pressable>
                <View style={styles.dots}>
                  {onboardingSlides.map((_, i) => (
                    <View key={i} style={[styles.dot, i === slide ? styles.dotActive : null]} />
                  ))}
                </View>
                <Pressable
                  onPress={() => { hapticTap(); LayoutAnimation.configureNext(subtleSpring); slide < onboardingSlides.length - 1 ? setSlide(slide + 1) : void completeOnboarding(); }}
                  style={styles.circleDark}
                >
                  <Feather name="arrow-right" size={20} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>
          ) : null}

          {screen === "auth" ? (
            <>
              {authMode === "selection" ? (
                <View style={styles.screen}>
                  <View style={styles.authSelectionBody}>
                    <LinearGradient
                      colors={["#F8FAFC", "#E2E8F0"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.authSelectionHero}
                    >
                      <Text style={styles.welcomeMuted}>{language === "es" ? "Bienvenida a" : "Welcome to"}</Text>
                      <Pressable style={styles.brandRow}>
                        <View style={styles.brandMark}><MaterialCommunityIcons name="scale-balance" size={24} color="#FFFFFF" /></View>
                        <Text style={styles.brandText}>ClearCase</Text>
                      </Pressable>
                      <Text style={styles.formSubtitle}>
                        {language === "es"
                          ? "Claridad legal para reducir estres de preparacion y pasos omitidos."
                          : "Legal clarity to reduce preparation stress and missed steps."}
                      </Text>
                      <Text style={styles.optionDesc}>
                        {language === "es"
                          ? "Informacion para orientarte, no asesoria legal."
                          : "Informational guidance for clarity, not legal advice."}
                      </Text>
                    </LinearGradient>
                    <View style={styles.authSelectionActions}>
                      <Pressable
                        onPress={() => {
                          setAuthIntent("login");
                          setAuthMode("login");
                        }}
                        style={styles.primaryBtn}
                      >
                        <Text style={styles.primaryBtnText}>{language === "es" ? "Iniciar sesion" : "Log in"}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          setAuthIntent("signup");
                          setAuthMode("signup");
                        }}
                        style={styles.outlineBtn}
                      >
                        <Text style={styles.outlineBtnText}>{language === "es" ? "Crear cuenta" : "Sign up"}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          Alert.alert(
                            language === "es" ? "Soporte" : "Support",
                            language === "es"
                              ? "El chat de soporte estara disponible pronto. Puedes continuar con iniciar sesion o crear cuenta."
                              : "Support chat is coming soon. Continue with Log in or Sign up."
                          );
                        }}
                        style={styles.link}
                      >
                        <Text style={styles.linkText}>{language === "es" ? "Contactar soporte" : "Contact support"}</Text>
                      </Pressable>
                    </View>
                  </View>
                  <View style={styles.authFooter}>
                    <Text style={styles.authFooterLink}>
                      {language === "es" ? "Solo orientacion informativa. No asesoria legal." : "Informational guidance only. Not legal advice."}
                    </Text>
                  </View>
                </View>
              ) : null}

              {authMode === "login" || authMode === "signup" ? (
                <ScrollView style={styles.scrollScreen} contentContainerStyle={styles.scrollBody}>
                  <Pressable onPress={() => setAuthMode("selection")} style={styles.back}><Feather name="chevron-left" size={24} color={palette.muted} /></Pressable>
                  <Text style={styles.formTitle}>
                    {authMode === "signup" ? (language === "es" ? "Unete a ClearCase" : "Join ClearCase") : language === "es" ? "Bienvenida de regreso" : "Welcome back"}
                  </Text>
                  <Text style={styles.formSubtitle}>
                    {authMode === "signup"
                      ? language === "es"
                        ? "Empieza con claridad para preparar tu caso."
                        : "Start with clarity for case preparation."
                      : language === "es"
                        ? "Inicia sesion para ver tus casos guardados."
                        : "Sign in to access your saved cases."}
                  </Text>
                  {authMode === "signup" ? (
                    <>
                      <Text style={styles.fieldLabel}>{language === "es" ? "Nombre completo" : "Full Name"}</Text>
                      <TextInput style={styles.input} placeholder="John Doe" placeholderTextColor={palette.subtle} value={authName} onChangeText={setAuthName} accessibilityLabel={language === "es" ? "Nombre completo" : "Full name"} />
                      <Text style={styles.fieldLabel}>{language === "es" ? "Codigo postal" : "ZIP Code"}</Text>
                      <TextInput style={styles.input} placeholder="90210" placeholderTextColor={palette.subtle} keyboardType="number-pad" value={authZip} onChangeText={setAuthZip} accessibilityLabel={language === "es" ? "Codigo postal" : "ZIP code"} />
                    </>
                  ) : null}
                  <Text style={styles.fieldLabel}>Email</Text>
                  <TextInput style={styles.input} placeholder="john@example.com" placeholderTextColor={palette.subtle} autoCapitalize="none" value={authEmail} onChangeText={setAuthEmail} accessibilityLabel="Email" textContentType="emailAddress" />
                  <Text style={styles.fieldLabel}>{language === "es" ? "Contrasena" : "Password"}</Text>
                  <TextInput style={styles.input} placeholder="********" placeholderTextColor={palette.subtle} secureTextEntry autoCapitalize="none" value={authPassword} onChangeText={setAuthPassword} accessibilityLabel={language === "es" ? "Contrasena" : "Password"} textContentType="password" />
                  <Pressable
                    onPress={() => {
                      const trimmedEmail = authEmail.trim();
                      if (!trimmedEmail) {
                        Alert.alert("Email required", "Enter your email address.");
                        return;
                      }
                      if (!isValidEmail(trimmedEmail)) {
                        Alert.alert("Invalid email", "Enter a valid email address.");
                        return;
                      }
                      if (!isStrongPassword(authPassword)) {
                        Alert.alert("Weak password", "Password must be at least 8 characters.");
                        return;
                      }
                      if (authMode === "signup" && !authName.trim()) {
                        Alert.alert("Name required", "Enter your full name.");
                        return;
                      }
                      if (authMode === "signup" && authZip.trim() && !isValidUsZip(authZip)) {
                        Alert.alert("Invalid ZIP", "Use a valid US ZIP code like 90210.");
                        return;
                      }
                      setAuthIntent(authMode);
                      setAuthMode("disclaimer");
                    }}
                    style={styles.primaryBtn}
                  >
                    <Text style={styles.primaryBtnText}>
                      {authMode === "signup" ? (language === "es" ? "Crear cuenta" : "Create account") : language === "es" ? "Iniciar sesion" : "Sign in"}
                    </Text>
                  </Pressable>
                  <Text style={styles.subtleCenterText}>
                    {language === "es"
                      ? "ClearCase ofrece orientacion informativa y no reemplaza a un abogado con licencia."
                      : "ClearCase provides informational guidance only and does not replace a licensed attorney."}
                  </Text>
                </ScrollView>
              ) : null}

              {authMode === "disclaimer" ? (
                <ScrollView style={styles.disclaimerScreen} contentContainerStyle={styles.scrollBody}>
                  <View style={styles.disclaimerHeaderRow}>
                    <View style={styles.disclaimerShield}>
                      <Feather name="shield" size={20} color={palette.primary} />
                    </View>
                    <Text style={styles.disclaimerTitle}>{language === "es" ? "Antes de continuar" : "Before you continue"}</Text>
                  </View>
                  <Text style={styles.disclaimerP}>
                    {language === "es" ? "ClearCase es un producto informativo y no un despacho legal." : "ClearCase is an informational product and not a law firm."}
                  </Text>
                  <Text style={styles.disclaimerP}>
                    {language === "es"
                      ? "Para asesoria legal sobre una situacion especifica, muchas personas optan por consultar con un abogado con licencia."
                      : "For legal advice on your specific situation, many people choose to consult a licensed attorney."}
                  </Text>
                  <View style={styles.disclaimerCard}>
                    <Text style={styles.cardTitle}>{language === "es" ? "Reconozco y acepto que:" : "I acknowledge and agree that:"}</Text>
                    <View style={styles.disclaimerBulletRow}>
                      <View style={styles.disclaimerBulletDot} />
                      <Text style={styles.cardBody}>
                        {language === "es" ? "Mi informacion y los detalles del caso son confidenciales." : "My information and case details are confidential."}
                      </Text>
                    </View>
                    <View style={styles.disclaimerBulletRow}>
                      <View style={styles.disclaimerBulletDot} />
                      <Text style={styles.cardBody}>
                        {language === "es" ? "Los datos se procesan solo para brindar claridad situacional." : "Data is processed only to provide situational clarity."}
                      </Text>
                    </View>
                    <View style={styles.disclaimerBulletRow}>
                      <View style={styles.disclaimerBulletDot} />
                      <Text style={styles.cardBody}>
                        {language === "es"
                          ? "El uso de esta app no crea una relacion abogado-cliente."
                          : "No attorney-client relationship is created by using this app."}
                      </Text>
                    </View>
                    <Pressable onPress={() => void agreeAndContinue()} style={styles.primaryBtn} disabled={authBusy}>
                      <Text style={styles.primaryBtnText}>
                        {authBusy
                          ? authStage === "account"
                            ? language === "es"
                              ? "Creando cuenta..."
                              : "Creating account..."
                            : authStage === "profile"
                              ? language === "es"
                                ? "Guardando perfil..."
                                : "Saving profile..."
                              : authStage === "workspace"
                                ? language === "es"
                                  ? "Preparando espacio de trabajo..."
                                  : "Setting up workspace..."
                                : language === "es"
                                  ? "Conectando..."
                                  : "Connecting..."
                          : language === "es"
                            ? "Aceptar y continuar a ClearCase"
                            : "Agree and Continue to ClearCase"}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => setAuthMode(authIntent)} style={styles.link}>
                      <Text style={styles.linkText}>{language === "es" ? "Volver" : "Back"}</Text>
                    </Pressable>
                  </View>
                </ScrollView>
              ) : null}
            </>
          ) : null}

          {screen === "home" ? (
            <View style={styles.screenSoft}>
              <ScrollView contentContainerStyle={styles.homeDashboardContent}>
                <View style={styles.homeDashboardHeader}>
                  <Pressable onPress={() => setDrawerOpen(true)} style={styles.info} accessibilityRole="button" accessibilityLabel={language === "es" ? "Abrir menu" : "Open menu"}>
                    <Feather name="menu" size={18} color={palette.subtle} />
                  </Pressable>
                  <View style={styles.homeDashboardTitleWrap}>
                    <Text style={styles.dashboardTitle}>{language === "es" ? "Panel" : "Dashboard"}</Text>
                    <Text style={styles.dashboardSubtitle}>
                      {language === "es" ? `Bienvenida, ${titleize(userFirstName)}.` : `Welcome back, ${titleize(userFirstName)}.`}
                    </Text>
                  </View>
                  <Pressable onPress={() => setScreen("account")} style={styles.avatarButton} accessibilityRole="button" accessibilityLabel={language === "es" ? "Cuenta de usuario" : "User account"}>
                    <Text style={styles.avatarButtonText}>{accountInitials}</Text>
                  </Pressable>
                </View>
                {offlineMode ? <Text style={styles.offlineBadge}>{language === "es" ? "Modo sin conexion" : "Offline mode"}</Text> : null}
                <View style={styles.searchBar}>
                  <Feather name="search" size={16} color={palette.subtle} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder={language === "es" ? "Buscar documentos..." : "Search documents..."}
                    placeholderTextColor={palette.subtle}
                    value={caseSearch}
                    onChangeText={setCaseSearch}
                    accessibilityLabel={language === "es" ? "Buscar documentos" : "Search documents"}
                  />
                </View>

                <LinearGradient
                  colors={["#0F172A", "#1E293B"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.homeHeroCard}
                >
                  <Text style={styles.homeHeroTitle}>
                    {language === "es" ? "Clara preparacion para tu caso" : "Clear preparation for your case"}
                  </Text>
                  <Text style={styles.homeHeroCopy}>
                    {language === "es"
                      ? "Sube un documento o foto legal para reducir pasos omitidos y estres de preparacion."
                      : "Upload a legal document or photo to reduce missed steps and preparation stress."}
                  </Text>
                  <Text style={styles.heroPrivacyText}>
                    {language === "es"
                      ? "Un costo pequeno hoy suele evitar omisiones mas costosas despues."
                      : "A small cost now often helps avoid more expensive misses later."}
                  </Text>
                  <View style={styles.uploadStatusPill}>
                    <View style={[styles.dotStatus, uploading ? styles.dotGood : null]} />
                    <Text style={styles.uploadStatusText}>{uploadStatusText}</Text>
                  </View>
                  <View style={styles.heroPrivacyRow}>
                    <Feather name="lock" size={12} color="#CBD5E1" />
                    <Text style={styles.heroPrivacyText}>
                      {language === "es"
                        ? "Privado por defecto. Se procesa para generar claridad del caso, no asesoria legal."
                        : "Private by default. Processed for case clarity, not legal advice."}
                    </Text>
                  </View>
                  <Pressable onPress={() => void homeUploadFlow()} style={[styles.primaryBtn, styles.heroPrimaryBtn]}>
                    <View style={styles.ctaInline}>
                      <Feather name="upload" size={14} color="#FFFFFF" />
                      <Text style={styles.primaryBtnText}>
                        {uploading ? (language === "es" ? "Subiendo..." : "Uploading...") : language === "es" ? "Subir ahora" : "Upload now"}
                      </Text>
                    </View>
                  </Pressable>
                </LinearGradient>

                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionTitle}>{language === "es" ? "Casos activos" : "Active Cases"}</Text>
                  <Pressable onPress={() => setScreen("cases")}>
                    <Text style={styles.sectionAction}>{language === "es" ? "Ver todo" : "View all"}</Text>
                  </Pressable>
                </View>
                {filteredCases.length === 0 ? (
                  <View style={styles.card}>
                    <Text style={styles.cardBody}>
                      {language === "es" ? "Aun no hay casos. Sube tu primer archivo para crear uno." : "No cases yet. Upload your first file to create one."}
                    </Text>
                  </View>
                ) : (
                  filteredCases.slice(0, 3).map((row) => (
                    <Pressable
                      key={row.id}
                      style={styles.dashboardCaseCard}
                      onPress={() => {
                        setSelectedCaseId(row.id);
                        setScreen("workspace");
                      }}
                    >
                      <View style={styles.dashboardCaseTop}>
                        <View
                          style={[
                            styles.priorityChip,
                            casePriorityLevel(row) === "high"
                              ? styles.priorityChipHigh
                              : casePriorityLevel(row) === "medium"
                                ? styles.priorityChipMedium
                                : styles.priorityChipLow
                          ]}
                        >
                          <Text style={styles.priorityChipText}>{casePriorityLabel(row, language)}</Text>
                        </View>
                        <Text style={styles.caseMetaText}>
                          {row.earliestDeadline
                            ? language === "es"
                              ? `Fecha ${fmtDate(row.earliestDeadline, language)}`
                              : `Deadline ${fmtDate(row.earliestDeadline, language)}`
                            : language === "es"
                              ? "No se detecta fecha"
                              : "No deadline detected"}
                        </Text>
                      </View>
                      <Text style={styles.dashboardCaseTitle}>{row.title ?? (language === "es" ? "Caso sin titulo" : "Untitled case")}</Text>
                      <Text style={styles.dashboardCaseSubtitle}>
                        {row.documentType ? titleize(row.documentType) : language === "es" ? "Deteccion pendiente" : "Pending classification"} |{" "}
                        {localizedCaseStatus(row.status, language)}
                      </Text>
                    </Pressable>
                  ))
                )}

                <View style={styles.tipsGrid}>
                  <Pressable style={styles.tipCard} onPress={() => { hapticTap(); setScreen("legalAid"); }} accessibilityRole="button" accessibilityLabel={language === "es" ? "Buscar ayuda legal" : "Find legal aid"}>
                    <View style={[styles.tipIcon, styles.tipIconAmber]}>
                      <Feather name="heart" size={14} color="#D97706" />
                    </View>
                    <Text style={styles.tipTitle}>{language === "es" ? "Ayuda legal" : "Legal Aid"}</Text>
                    <Text style={styles.tipCopy}>
                      {language === "es"
                        ? "Encuentra recursos y organizaciones de ayuda legal cerca de ti."
                        : "Find legal resources and aid organizations near you."}
                    </Text>
                  </Pressable>
                  <Pressable style={styles.tipCard} onPress={() => { hapticTap(); setScreen("drafting"); }} accessibilityRole="button" accessibilityLabel={language === "es" ? "Asistente de redaccion" : "Drafting assistant"}>
                    <View style={[styles.tipIcon, styles.tipIconBlue]}>
                      <Feather name="edit-3" size={14} color="#2563EB" />
                    </View>
                    <Text style={styles.tipTitle}>{language === "es" ? "Redaccion" : "Drafting"}</Text>
                    <Text style={styles.tipCopy}>
                      {language === "es"
                        ? "Plantillas para responder a avisos de forma profesional."
                        : "Templates to respond to notices professionally."}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.tipsGrid}>
                  <View style={styles.tipCard}>
                    <View style={[styles.tipIcon, styles.tipIconGreen]}>
                      <Feather name="zap" size={14} color="#059669" />
                    </View>
                    <Text style={styles.tipTitle}>{language === "es" ? "Escaneo rapido" : "Fast scan"}</Text>
                    <Text style={styles.tipCopy}>
                      {language === "es"
                        ? "Usar buena iluminacion suele mejorar la limpieza de extraccion."
                        : "Use bright lighting for cleaner extraction results."}
                    </Text>
                  </View>
                  <View style={styles.tipCard}>
                    <View style={[styles.tipIcon, styles.tipIconBlue]}>
                      <Feather name="shield" size={14} color="#2563EB" />
                    </View>
                    <Text style={styles.tipTitle}>{language === "es" ? "Privacidad" : "Privacy"}</Text>
                    <Text style={styles.tipCopy}>
                      {language === "es"
                        ? "Muchas personas prefieren redactar numeros de cuenta antes de subir."
                        : "Redact account numbers before uploading when possible."}
                    </Text>
                  </View>
                </View>
                <Text style={styles.legal}>{language === "es" ? "Solo contexto informativo. No asesoria legal." : "Informational only. Not legal advice."}</Text>
              </ScrollView>
            </View>
          ) : null}

          {screen === "workspace" ? (
            <View style={styles.screenSoft}>
              <View style={styles.verdictHead}>
                <Pressable onPress={() => setScreen("home")} style={styles.back}>
                  <Feather name="chevron-left" size={24} color={palette.muted} />
                </Pressable>
                <View style={styles.workspaceTitleWrap}>
                  <Text style={styles.formTitleSmall}>{language === "es" ? "Espacio de trabajo" : "Workspace"}</Text>
                  <Text style={styles.buildStamp}>{MOBILE_BUILD_STAMP}</Text>
                  {offlineMode ? <Text style={styles.offlinePill}>{language === "es" ? "SIN CONEXION" : "OFFLINE"}</Text> : null}
                </View>
                <Pressable onPress={() => void refreshWorkspace()} style={styles.info}>
                  <Feather name="refresh-cw" size={16} color={palette.subtle} />
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={styles.scrollBody} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refreshWorkspace()} />}>
                <View
                  style={[
                    styles.card,
                    styles.workspacePrimaryCard,
                    workspaceSeverity === "high"
                      ? styles.workspacePrimaryHigh
                      : workspaceSeverity === "medium"
                        ? styles.workspacePrimaryMedium
                        : styles.workspacePrimaryLow
                  ]}
                >
                  <View style={styles.workspacePillRow}>
                    <View style={[styles.priorityChip, styles.priorityChipHigh]}>
                      <Text style={styles.priorityChipText}>
                        {selectedCase?.timeSensitive
                          ? language === "es"
                            ? "Senales sensibles al tiempo"
                            : "Time-sensitive signals"
                          : language === "es"
                            ? "Listo para revisar"
                            : "Ready to review"}
                      </Text>
                    </View>
                    <View style={[styles.priorityChip, styles.priorityChipMedium]}>
                      <Text style={styles.priorityChipText}>
                        {selectedCase?.status
                          ? localizedCaseStatus(selectedCase.status, language)
                          : language === "es"
                            ? "Listo para revisar"
                            : "Ready to review"}
                      </Text>
                    </View>
                  </View>
                  {!selectedCaseId && !latestCase ? (
                    <Text style={styles.cardBody}>
                      {language === "es"
                        ? "Aun no hay analisis. Sube un archivo para generar tu primer resumen del espacio de trabajo."
                        : "No insight yet. Upload a file to generate your first workspace summary."}
                    </Text>
                  ) : null}
                  {selectedCaseId && !selectedCase && loadingCase ? <ActivityIndicator color={palette.primary} /> : null}
                  {selectedCase ? (
                    <>
                      <Text style={styles.workspaceCaseTitle}>{selectedCase.title ?? (language === "es" ? "Caso sin titulo" : "Untitled case")}</Text>
                      <Text style={styles.workspaceCaseMeta}>
                        {language === "es" ? "Tipo" : "Type"}{" "}
                        {selectedCase.documentType
                          ? titleize(selectedCase.documentType)
                          : language === "es"
                            ? "Deteccion pendiente"
                            : "Pending detection"}{" "}
                        | {language === "es" ? "Actualizado" : "Updated"} {fmtDateTime(selectedCase.updatedAt)}
                      </Text>
                      <View style={styles.workspaceMetricsRow}>
                        <View style={styles.workspaceMetricCard}>
                          <Text style={styles.metricLabel}>{language === "es" ? "Proxima fecha" : "Next deadline"}</Text>
                          <Text style={styles.metricValueSm}>{fmtDate(selectedCase.earliestDeadline, language)}</Text>
                        </View>
                        <View style={styles.workspaceMetricCard}>
                          <Text style={styles.metricLabel}>{language === "es" ? "Confianza de extraccion" : "Extraction confidence"}</Text>
                          <Text style={styles.metricValueSm}>
                            {selectedCase.classificationConfidence !== null
                              ? `${Math.round(selectedCase.classificationConfidence * 100)}%`
                              : language === "es"
                                ? "Pendiente"
                                : "Pending"}
                          </Text>
                        </View>
                      </View>
                    </>
                  ) : null}
                  {!selectedCase && selectedCaseSummary ? (
                    <>
                      <Text style={styles.workspaceCaseTitle}>{selectedCaseSummary.title ?? (language === "es" ? "Caso sin titulo" : "Untitled case")}</Text>
                      <Text style={styles.workspaceCaseMeta}>
                        {titleize(selectedCaseSummary.status)} |{" "}
                        {selectedCaseSummary.documentType
                          ? titleize(selectedCaseSummary.documentType)
                          : language === "es"
                            ? "Deteccion pendiente"
                            : "Pending detection"}
                      </Text>
                    </>
                  ) : null}
                  <Pressable onPress={() => void openUploadSheetForCase(selectedCaseId)} style={styles.outlineSoftBtn} disabled={uploading}>
                    <Text style={styles.outlineSoftText}>
                      {uploading
                        ? formatUploadStage(uploadStage, language) + "..."
                        : language === "es"
                          ? "Subir otro documento"
                          : "Upload another document"}
                    </Text>
                  </Pressable>
                </View>

                <Pressable style={styles.workspaceAccordionBar} onPress={() => toggleWorkspaceSection("steps")}>
                  <Text style={styles.workspaceAccordionTitle}>{workspaceSectionMeta.steps.title}</Text>
                  <View style={styles.workspaceAccordionMetaWrap}>
                    <Text style={styles.workspaceAccordionMeta}>{workspaceSectionMeta.steps.summary}</Text>
                    <Feather
                      name={workspaceSectionOpen.steps ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={palette.subtle}
                    />
                  </View>
                </Pressable>
                {workspaceSectionOpen.steps ? (
                  <View
                    style={[
                      styles.card,
                      styles.actionPlanCard,
                      workspaceSeverity === "high"
                        ? styles.actionPlanHigh
                        : workspaceSeverity === "medium"
                          ? styles.actionPlanMedium
                          : styles.actionPlanLow
                    ]}
                  >
                  <View style={styles.sectionTitleRow}>
                    <Text style={styles.sectionTitle}>
                      {language === "es" ? "Pasos recomendados" : "Recommended next steps"}
                    </Text>
                    <View
                      style={[
                        styles.severityBadge,
                        workspaceSeverity === "high"
                          ? styles.severityBadgeHigh
                          : workspaceSeverity === "medium"
                            ? styles.severityBadgeMedium
                            : styles.severityBadgeLow
                      ]}
                    >
                      <Text style={styles.severityBadgeText}>{severityLabel(workspaceSeverity, language)}</Text>
                    </View>
                  </View>
                  <Text style={styles.actionPlanSubhead}>{severitySummary(workspaceSeverity, language)}</Text>
                  {premiumStepSummaryLine ? <Text style={styles.optionDesc}>{premiumStepSummaryLine}</Text> : null}
                  {workspaceChecklistItems.map((step, index) => (
                    <View key={`${selectedCaseId ?? "case"}-step-${step.id}`} style={styles.checklistRow}>
                      <View
                        style={[
                          styles.checklistDot,
                          workspaceSeverity === "high"
                            ? styles.checklistDotHigh
                            : workspaceSeverity === "medium"
                              ? styles.checklistDotMedium
                              : styles.checklistDotLow
                        ]}
                      >
                        <Feather
                          name={index === 0 && activeEarliestDeadline ? "alert-triangle" : "check"}
                          size={12}
                          color={
                            workspaceSeverity === "high"
                              ? "#B91C1C"
                              : workspaceSeverity === "medium"
                                ? "#A16207"
                                : "#166534"
                          }
                        />
                      </View>
                      <Text style={styles.checklistText}>{step.text}</Text>
                    </View>
                  ))}
                  </View>
                ) : null}

                <Pressable style={styles.workspaceAccordionBar} onPress={() => toggleWorkspaceSection("watch")}>
                  <Text style={styles.workspaceAccordionTitle}>{workspaceSectionMeta.watch.title}</Text>
                  <View style={styles.workspaceAccordionMetaWrap}>
                    <Text style={styles.workspaceAccordionMeta}>{workspaceSectionMeta.watch.summary}</Text>
                    <Feather
                      name={workspaceSectionOpen.watch ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={palette.subtle}
                    />
                  </View>
                </Pressable>
                {workspaceSectionOpen.watch ? (
                  <>
                {!plusEnabled ? (
                  <View style={[styles.card, styles.plusPreviewCard]}>
                    <View style={styles.sectionTitleRow}>
                      <Text style={styles.sectionTitle}>
                        {language === "es" ? "Vista previa de ClearCase Plus" : "ClearCase Plus Preview"}
                      </Text>
                      <View style={styles.plusLockedPill}>
                        <Feather name="lock" size={10} color="#334155" />
                        <Text style={styles.plusLockedPillText}>{language === "es" ? "Bloqueado" : "Locked"}</Text>
                      </View>
                    </View>
                    <Text style={styles.cardBody}>
                      {language === "es"
                        ? "Plus mantiene tu caso organizado y monitoreado de forma calmada con el paso del tiempo."
                        : "Plus keeps your case organized and quietly watched over time."}
                    </Text>
                    <Text style={styles.optionDesc}>
                      {language === "es"
                        ? `ClearCase Plus: ${paywallConfig.plusPriceMonthly}`
                        : `ClearCase Plus: ${paywallConfig.plusPriceMonthly}`}
                    </Text>
                    <Text style={styles.optionDesc}>
                      {language === "es"
                        ? "Costo pequeno ahora, menos omisiones costosas despues."
                        : "Small cost now, fewer expensive misses later."}
                    </Text>
                    <View style={styles.plusLockedActionRow}>
                      <Feather name="eye" size={14} color={palette.subtle} />
                      <View style={styles.plusLockedActionTextWrap}>
                        <Text style={styles.plusLockedActionTitle}>
                          {language === "es" ? "Modo seguimiento bloqueado en Free" : "Case Watch Mode locked on Free"}
                        </Text>
                        <Text style={styles.plusLockedActionBody}>
                          {language === "es"
                            ? "Plus mantiene este caso monitoreado y con actividad continua."
                            : "Plus keeps this case monitored with ongoing activity updates."}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.plusLockedActionRow}>
                      <Feather name="link" size={14} color={palette.subtle} />
                      <View style={styles.plusLockedActionTextWrap}>
                        <Text style={styles.plusLockedActionTitle}>
                          {language === "es" ? "Enlaces de paquete bloqueados en Free" : "Packet share links locked on Free"}
                        </Text>
                        <Text style={styles.plusLockedActionBody}>
                          {language === "es"
                            ? "Plus permite crear enlaces por tiempo limitado y desactivar acceso cuando haga falta."
                            : "Plus lets you create time-limited links and disable access when needed."}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.plusFeatureRow}>
                      <Feather name="calendar" size={14} color={palette.muted} />
                      <Text style={styles.plusFeatureText}>
                        {language === "es"
                          ? "Cronologia y memoria para fechas detectadas y actualizaciones."
                          : "Timeline and memory for detected dates and updates."}
                      </Text>
                    </View>
                    <View style={styles.plusFeatureRow}>
                      <Feather name="bell" size={14} color={palette.muted} />
                      <Text style={styles.plusFeatureText}>
                        {language === "es"
                          ? "Recordatorios calmados de fechas con incertidumbre explicita."
                          : "Gentle deadline reminders with explicit uncertainty."}
                      </Text>
                    </View>
                    <View style={styles.plusFeatureRow}>
                      <Feather name="check-square" size={14} color={palette.muted} />
                      <Text style={styles.plusFeatureText}>
                        {language === "es"
                          ? "Seguimiento de integridad de evidencia para documentos que suelen ir juntos."
                          : "Evidence completeness tracking for commonly paired documents."}
                      </Text>
                    </View>
                    <View style={styles.plusFeatureRow}>
                      <Feather name="file-text" size={14} color={palette.muted} />
                      <Text style={styles.plusFeatureText}>
                        {language === "es"
                          ? "Paquete de consulta listo para preparacion de asesoria."
                          : "Lawyer-ready packet for consultation prep."}
                      </Text>
                    </View>
                    <View style={styles.plusFeatureRow}>
                      <Feather name="list" size={14} color={palette.muted} />
                      <Text style={styles.plusFeatureText}>
                        {language === "es"
                          ? "Motor de proximos pasos con consecuencias, comprobantes y confianza."
                          : "Dynamic next-step engine with consequences, receipts, and confidence."}
                      </Text>
                    </View>
                    <View style={styles.plusFeatureRow}>
                      <Feather name="clipboard" size={14} color={palette.muted} />
                      <Text style={styles.plusFeatureText}>
                        {language === "es"
                          ? "Intake formal para reducir tiempo pagado en consulta."
                          : "Formal intake simulation to reduce paid consultation time."}
                      </Text>
                    </View>
                    <Pressable onPress={() => openPaywall("workspace_plus_preview")} style={styles.primaryBtn}>
                      <Text style={styles.primaryBtnText}>{language === "es" ? "Iniciar Plus" : "Start Plus"}</Text>
                    </Pressable>
                  </View>
	                ) : (
		                  <View style={[styles.card, styles.plusActiveCard]}>
		                    <View style={styles.sectionTitleRow}>
		                      <Text style={styles.sectionTitle}>{language === "es" ? "Revision semanal del caso" : "Weekly case check-in"}</Text>
		                    </View>
		                    <View style={styles.plusFeatureRow}>
		                      <Feather name="eye" size={14} color="#166534" />
		                      <Text style={styles.plusFeatureText}>
		                        {language === "es"
		                          ? "Verificamos nuevas fechas, cambios en archivos y progreso del caso."
		                          : "We check for new dates, file changes, and case progress."}
		                      </Text>
		                    </View>
	                    <Pressable
                      style={styles.outlineSoftBtn}
                      onPress={() => void toggleCaseWatchMode()}
                      disabled={savingWatchMode}
                    >
                      <Text style={styles.outlineSoftText}>
                        {savingWatchMode
                          ? language === "es"
                            ? "Guardando..."
                            : "Saving..."
                          : caseWatchEnabled
                            ? language === "es"
                              ? "Desactivar seguimiento"
                              : "Turn watch off"
                            : language === "es"
                              ? "Activar seguimiento"
                              : "Turn watch on"}
                      </Text>
                    </Pressable>
		                    <View style={styles.plusFeatureRow}>
		                      <Feather name="check-circle" size={14} color="#166534" />
		                      <Text style={styles.plusFeatureText}>{weeklyCheckInStatus}</Text>
		                    </View>
		                    {watchMicroEvents.length > 0 ? (
		                      <View style={styles.receiptRow}>
		                        <Text style={styles.receiptTitle}>{language === "es" ? "Que cambio" : "What changed"}</Text>
		                        {watchMicroEvents.slice(0, 2).map((event, index) => (
		                          <Text key={`watch-event-${index}`} style={styles.receiptSub}>
		                            - {event}
		                          </Text>
		                        ))}
		                      </View>
		                    ) : null}
		                    <View style={styles.plusFeatureRow}>
		                      <Feather name="arrow-right-circle" size={14} color="#166534" />
		                      <Text style={styles.plusFeatureText}>{weeklyCheckInAction}</Text>
		                    </View>
		                  </View>
		                )}

	                  </>
	                ) : null}

	                <Pressable style={styles.workspaceAccordionBar} onPress={() => toggleWorkspaceSection("packet")}>
	                  <Text style={styles.workspaceAccordionTitle}>{workspaceSectionMeta.packet.title}</Text>
	                  <View style={styles.workspaceAccordionMetaWrap}>
	                    <Text style={styles.workspaceAccordionMeta}>{workspaceSectionMeta.packet.summary}</Text>
	                    <Feather
	                      name={workspaceSectionOpen.packet ? "chevron-up" : "chevron-down"}
	                      size={16}
	                      color={palette.subtle}
	                    />
	                  </View>
	                </Pressable>
	                {workspaceSectionOpen.packet ? (
	                  <View style={[styles.card, styles.plusActiveCard]}>
	                    <View style={styles.sectionTitleRow}>
	                      <Text style={styles.sectionTitle}>{language === "es" ? "Preparacion para consulta" : "Consult preparation"}</Text>
	                    </View>
	                    <Text style={styles.cardBody}>{packetShareStatusLine}</Text>
	                    <Text style={styles.cardBody}>{costSavingIndicator.message}</Text>
	                    <Pressable style={styles.outlineSoftBtn} onPress={() => setIntakeModalOpen(true)}>
	                      <Text style={styles.outlineSoftText}>
	                        {language === "es"
	                          ? `Abrir intake formal (${intakeCompleteness}% completo)`
	                          : `Open formal intake (${intakeCompleteness}% complete)`}
	                      </Text>
	                    </Pressable>
	                    <Pressable style={styles.outlineSoftBtn} onPress={() => setLawyerSummaryOpen(true)}>
	                      <Text style={styles.outlineSoftText}>{language === "es" ? "Abrir paquete para abogado" : "Open lawyer prep packet"}</Text>
	                    </Pressable>
	                    <Pressable style={styles.outlineSoftBtn} onPress={() => { hapticTap(); setScreen("drafting"); }} accessibilityRole="button" accessibilityLabel={language === "es" ? "Asistente de redaccion" : "Drafting assistant"}>
	                      <Text style={styles.outlineSoftText}>{language === "es" ? "Asistente de redaccion" : "Drafting assistant"}</Text>
	                    </Pressable>
	                  </View>
	                ) : null}

                <Pressable style={styles.workspaceAccordionBar} onPress={() => toggleWorkspaceSection("context")}>
                  <Text style={styles.workspaceAccordionTitle}>{workspaceSectionMeta.context.title}</Text>
                  <View style={styles.workspaceAccordionMetaWrap}>
                    <Text style={styles.workspaceAccordionMeta}>{workspaceSectionMeta.context.summary}</Text>
                    <Feather
                      name={workspaceSectionOpen.context ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={palette.subtle}
                    />
                  </View>
                </Pressable>
                {workspaceSectionOpen.context ? (
                  <View style={styles.card}>
                  <View style={styles.sectionTitleRow}>
                    <Text style={styles.sectionTitle}>{language === "es" ? "Contexto del caso" : "Case context"}</Text>
                    <Text style={styles.caseContextHint}>{language === "es" ? "Ayuda en cargas futuras" : "Helps future uploads"}</Text>
                  </View>
                  <Text style={styles.caseContextHelper}>
                    {language === "es"
                      ? "Agrega lo que no se ve en el documento (que paso, cuando, donde). Esto ayuda a mantener continuidad en cargas futuras."
                      : "Add anything not visible in the document (what happened, when, where). This helps future uploads stay consistent."}
                  </Text>
                  <TextInput
                    style={styles.caseContextInput}
                    multiline
                    value={caseContextDraft}
                    onChangeText={setCaseContextDraft}
                    placeholder={
                      language === "es"
                        ? "Agrega lo que no se ve en el documento (que paso, cuando, donde)."
                        : "Add anything not visible in the document (what happened, when, where)."
                    }
                    placeholderTextColor={palette.subtle}
                  />
                  <Pressable
                    onPress={() => void saveCaseContextForSelectedCase()}
                    style={styles.outlineSoftBtn}
                    disabled={savingCaseContext}
                  >
                    <Text style={styles.outlineSoftText}>
                      {savingCaseContext ? (language === "es" ? "Guardando..." : "Saving...") : language === "es" ? "Guardar contexto del caso" : "Save case context"}
                    </Text>
                  </Pressable>
                  </View>
                ) : null}

                <Pressable style={styles.workspaceAccordionBar} onPress={() => toggleWorkspaceSection("category")}>
                  <Text style={styles.workspaceAccordionTitle}>{workspaceSectionMeta.category.title}</Text>
                  <View style={styles.workspaceAccordionMetaWrap}>
                    <Text style={styles.workspaceAccordionMeta}>{workspaceSectionMeta.category.summary}</Text>
                    <Feather
                      name={workspaceSectionOpen.category ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={palette.subtle}
                    />
                  </View>
                </Pressable>
                {workspaceSectionOpen.category ? (
                  <View style={styles.card}>
                  <View style={styles.sectionTitleRow}>
                    <Text style={styles.sectionTitle}>{language === "es" ? "Categoria del documento" : "Document category"}</Text>
                    <Text style={styles.caseContextHint}>{language === "es" ? "Ajuste manual" : "Manual fallback"}</Text>
                  </View>
                  <Text style={styles.cardBody}>
                    {language === "es" ? "Actual:" : "Current:"}{" "}
                    {manualCategoryLabel(selectedCase?.documentType ?? selectedCaseSummary?.documentType ?? null, language)}
                  </Text>
                  <Pressable
                    onPress={openManualCategoryPicker}
                    style={styles.outlineSoftBtn}
                    disabled={!selectedCaseId || savingClassification}
                  >
                    <Text style={styles.outlineSoftText}>
                      {savingClassification
                        ? language === "es"
                          ? "Guardando..."
                          : "Saving..."
                        : language === "es"
                          ? "Elegir o corregir categoria"
                          : "Choose or correct category"}
                    </Text>
                  </Pressable>
                  </View>
                ) : null}

                <Pressable style={styles.workspaceAccordionBar} onPress={() => toggleWorkspaceSection("summary")}>
                  <Text style={styles.workspaceAccordionTitle}>{workspaceSectionMeta.summary.title}</Text>
                  <View style={styles.workspaceAccordionMetaWrap}>
                    <Text style={styles.workspaceAccordionMeta}>{workspaceSectionMeta.summary.summary}</Text>
                    <Feather
                      name={workspaceSectionOpen.summary ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={palette.subtle}
                    />
                  </View>
                </Pressable>
                {workspaceSectionOpen.summary ? (
                  <View style={styles.card}>
                  <View style={styles.sectionTitleRow}>
                    <Text style={styles.sectionTitle}>{language === "es" ? "Resumen en lenguaje claro" : "Plain-language summary"}</Text>
                    <Text style={styles.autoBadge}>{language === "es" ? "Automatico" : "Automated"}</Text>
                  </View>
                  <Text style={styles.cardBody}>{workspaceSummaryText}</Text>
                  <Text style={styles.legalInline}>
                    {selectedCase?.nonLegalAdviceDisclaimer ??
                      (language === "es" ? "Solo contexto informativo. No asesoria legal." : "For informational context only. Not legal advice.")}
                  </Text>
                  </View>
                ) : null}

                <Pressable style={styles.workspaceAccordionBar} onPress={() => toggleWorkspaceSection("plain_meaning")}>
                  <Text style={styles.workspaceAccordionTitle}>{workspaceSectionMeta.plain_meaning.title}</Text>
                  <View style={styles.workspaceAccordionMetaWrap}>
                    <Text style={styles.workspaceAccordionMeta}>{workspaceSectionMeta.plain_meaning.summary}</Text>
                    <Feather
                      name={workspaceSectionOpen.plain_meaning ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={palette.subtle}
                    />
                  </View>
                </Pressable>
                {workspaceSectionOpen.plain_meaning ? (
                  <View style={styles.card}>
                  <View style={styles.sectionTitleRow}>
                    <Text style={styles.sectionTitle}>
                      {language === "es" ? "Vista de significado simple" : "Plain meaning view"}
                    </Text>
                    {plusEnabled ? (
                      <View style={styles.plusLivePill}>
                        <Text style={styles.plusLivePillText}>{language === "es" ? "Activo" : "Active"}</Text>
                      </View>
                    ) : (
                      <View style={styles.plusLockedPill}>
                        <Feather name="lock" size={10} color="#334155" />
                        <Text style={styles.plusLockedPillText}>{language === "es" ? "Plus" : "Plus"}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardBody}>
                    {language === "es"
                      ? "Compara texto original con significado simple, por que suele importar y elementos que muchas personas preparan para consulta."
                      : "Compare original text with plain meaning, why it often matters, and items many people prepare for consultations."}
                  </Text>
                  <Pressable
                    style={styles.outlineSoftBtn}
                    onPress={() => void openPlainMeaningTranslator()}
                    disabled={loadingPlainMeaning}
                  >
                    <Text style={styles.outlineSoftText}>
                      {loadingPlainMeaning
                        ? language === "es"
                          ? "Cargando..."
                          : "Loading..."
                        : language === "es"
                          ? "Abrir vista de significado simple"
                          : "Open plain meaning view"}
                    </Text>
                  </Pressable>
                  </View>
                ) : null}

                <Pressable style={styles.workspaceAccordionBar} onPress={() => toggleWorkspaceSection("timeline")}>
                  <Text style={styles.workspaceAccordionTitle}>{workspaceSectionMeta.timeline.title}</Text>
                  <View style={styles.workspaceAccordionMetaWrap}>
                    <Text style={styles.workspaceAccordionMeta}>{workspaceSectionMeta.timeline.summary}</Text>
                    <Feather
                      name={workspaceSectionOpen.timeline ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={palette.subtle}
                    />
                  </View>
                </Pressable>
                {workspaceSectionOpen.timeline ? (
                  <View style={styles.card}>
                  <Text style={styles.sectionTitle}>{language === "es" ? "Cronologia del caso" : "Case timeline"}</Text>
                  {selectedCase ? (
                    <>
                      <Text style={styles.optionDesc}>
                        {language === "es" ? "Actualizado:" : "Updated:"} {fmtDateTime(selectedCase.updatedAt)}
                      </Text>
                      <Text style={styles.optionDesc}>
                        {language === "es" ? "Archivos" : "Assets"} {selectedCase.assets.length} |{" "}
                        {language === "es" ? "Extracciones" : "Extractions"} {selectedCase.extractions.length} |{" "}
                        {language === "es" ? "Veredictos" : "Verdicts"} {selectedCase.verdicts.length}
                      </Text>
                      {loadingCaseAssets ? <ActivityIndicator color={palette.primary} /> : null}
                      {caseAssets.length === 0 ? (
                        <Text style={styles.cardBody}>
                          {language === "es"
                            ? "Aun no hay archivos listos para vista en este caso."
                            : "No uploaded assets are ready to view for this case yet."}
                        </Text>
                      ) : (
                        caseAssets.slice(0, 12).map((asset) => (
                          <View key={`case-asset-${asset.id}`} style={styles.receiptRow}>
                            <Text style={styles.receiptTitle}>{asset.fileName}</Text>
                            <Text style={styles.receiptSub}>
                              {language === "es" ? "Tipo" : "Type"}: {asset.mimeType} |{" "}
                              {language === "es" ? "Origen" : "Source"}:{" "}
                              {asset.source === "camera"
                                ? language === "es"
                                  ? "camara"
                                  : "camera"
                                : language === "es"
                                  ? "archivo"
                                  : "file"}
                            </Text>
                            <Text style={styles.receiptSub}>
                              {language === "es" ? "Estado de procesamiento" : "Processing status"}:{" "}
                              {asset.processingStatus === "succeeded"
                                ? language === "es"
                                  ? "completado"
                                  : "succeeded"
                                : asset.processingStatus === "failed"
                                  ? language === "es"
                                    ? "fallido"
                                    : "failed"
                                  : language === "es"
                                    ? "pendiente"
                                    : "pending"}
                              . {language === "es" ? "Cargado" : "Uploaded"}: {fmtDateTime(asset.createdAt)}
                            </Text>
                            <View style={styles.premiumStepActions}>
                              <Pressable
                                style={styles.linkMiniBtn}
                                onPress={() => void openAssetAccess(asset.id, "view")}
                              >
                                <Text style={styles.linkMiniText}>{language === "es" ? "Abrir" : "Open"}</Text>
                              </Pressable>
                              <Pressable
                                style={styles.linkMiniBtn}
                                onPress={() => void openAssetAccess(asset.id, "download")}
                              >
                                <Text style={styles.linkMiniText}>{language === "es" ? "Descargar" : "Download"}</Text>
                              </Pressable>
                            </View>
                          </View>
                        ))
                      )}
                    </>
                  ) : (
                    <Text style={styles.cardBody}>
                      {language === "es" ? "Selecciona un caso para ver eventos detallados de la cronologia." : "Select a case to view detailed timeline events."}
                    </Text>
                  )}
                  </View>
                ) : null}
              </ScrollView>
            </View>
          ) : null}

          {screen === "cases" ? (
            <View style={styles.screenSoft}>
              <ScrollView contentContainerStyle={styles.scrollBody} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refreshWorkspace()} />}>
                <View style={styles.casesHeader}>
                  <View style={styles.casesHeaderLeft}>
                    <Pressable onPress={() => setDrawerOpen(true)} style={styles.info}>
                      <Feather name="menu" size={16} color={palette.subtle} />
                    </Pressable>
                    <Text style={styles.dashboardTitle}>{language === "es" ? "Tus casos" : "Your Cases"}</Text>
                  </View>
                  <Pressable onPress={() => void homeUploadFlow()} style={styles.casesAddBtn}>
                    <Feather name="plus" size={18} color="#FFFFFF" />
                  </Pressable>
                </View>
                <View style={styles.searchBar}>
                  <Feather name="search" size={16} color={palette.subtle} />
                  <TextInput
                    style={styles.searchInput}
                    value={caseSearch}
                    onChangeText={setCaseSearch}
                    placeholder={language === "es" ? "Buscar documentos..." : "Search documents..."}
                    placeholderTextColor={palette.subtle}
                    accessibilityLabel={language === "es" ? "Buscar documentos" : "Search documents"}
                  />
                </View>
                <View style={styles.filterRow}>
                  <Pressable onPress={() => setCaseFilter("all")} style={[styles.filterPill, caseFilter === "all" ? styles.filterPillActive : null]}>
                    <Text style={[styles.filterPillText, caseFilter === "all" ? styles.filterPillTextActive : null]}>
                      {language === "es" ? "Todos" : "All Cases"}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => setCaseFilter("active")} style={[styles.filterPill, caseFilter === "active" ? styles.filterPillActive : null]}>
                    <Text style={[styles.filterPillText, caseFilter === "active" ? styles.filterPillTextActive : null]}>
                      {language === "es" ? "Activos" : "Active"}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => setCaseFilter("urgent")} style={[styles.filterPill, caseFilter === "urgent" ? styles.filterPillActive : null]}>
                    <Text style={[styles.filterPillText, caseFilter === "urgent" ? styles.filterPillTextActive : null]}>
                      {language === "es" ? "Urgentes" : "Urgent"}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => setCaseFilter("archived")} style={[styles.filterPill, caseFilter === "archived" ? styles.filterPillActive : null]}>
                    <Text style={[styles.filterPillText, caseFilter === "archived" ? styles.filterPillTextActive : null]}>
                      {language === "es" ? "Archivados" : "Archived"}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{language === "es" ? "Crear caso manualmente" : "Create case manually"}</Text>
                  <TextInput
                    style={styles.input}
                    value={newCaseTitle}
                    onChangeText={setNewCaseTitle}
                    placeholder={language === "es" ? "Titulo del caso (opcional)" : "Case title (optional)"}
                    placeholderTextColor={palette.subtle}
                  />
                  <Text style={styles.optionDesc}>
                    {language === "es" ? "Puedes dejarlo vacio para usar un titulo neutral." : "Leave blank to use a neutral title."}
                  </Text>
                  <Pressable onPress={() => { hapticTap(); void createCaseWithTitle(newCaseTitle); }} style={styles.primaryBtn} disabled={creatingCase}>
                    <Text style={styles.primaryBtnText}>
                      {creatingCase ? (language === "es" ? "Creando..." : "Creating...") : language === "es" ? "Crear caso" : "Create case"}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{language === "es" ? "Todos los casos" : "All cases"}</Text>
                  {loadingDashboard ? <ActivityIndicator color={palette.primary} /> : null}
                  {filteredCases.length === 0 ? (
                    <Text style={styles.cardBody}>
                      {language === "es" ? "Aun no hay casos. Al subir un archivo se creara tu primer caso." : "No cases yet. Uploading a file will create your first case."}
                    </Text>
                  ) : (
                    filteredCases.map((row) => (
                      <Pressable
                        key={row.id}
                        style={[styles.dashboardCaseCard, selectedCaseId === row.id ? styles.caseRowActive : null]}
                        onPress={() => {
                          setSelectedCaseId(row.id);
                          setScreen("workspace");
                        }}
                      >
                        <View style={styles.dashboardCaseTop}>
                        <View
                          style={[
                            styles.priorityChip,
                            casePriorityLevel(row) === "high"
                              ? styles.priorityChipHigh
                              : casePriorityLevel(row) === "medium"
                                ? styles.priorityChipMedium
                                : styles.priorityChipLow
                          ]}
                        >
                            <Text style={styles.priorityChipText}>{casePriorityLabel(row, language)}</Text>
                        </View>
                          <Text style={styles.caseMetaText}>{fmtDate(row.earliestDeadline, language)}</Text>
                        </View>
                        <Text style={styles.dashboardCaseTitle}>{row.title ?? (language === "es" ? "Caso sin titulo" : "Untitled case")}</Text>
                        <Text style={styles.dashboardCaseSubtitle}>
                          {localizedCaseStatus(row.status, language)} |{" "}
                          {row.documentType ? titleize(row.documentType) : language === "es" ? "Deteccion pendiente" : "Pending detection"}
                        </Text>
                      </Pressable>
                    ))
                  )}
                </View>
              </ScrollView>
            </View>
          ) : null}

          {screen === "account" ? (
            <View style={styles.screenSoft}>
              <ScrollView contentContainerStyle={styles.scrollBody} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refreshWorkspace()} />}>
                <View style={styles.accountHeaderCard}>
                  <View style={styles.accountHeaderTop}>
                    <View style={styles.accountHeaderLeft}>
                      <Pressable onPress={() => setDrawerOpen(true)} style={styles.info}>
                        <Feather name="menu" size={16} color={palette.subtle} />
                      </Pressable>
                      <Text style={styles.dashboardTitle}>Account</Text>
                    </View>
                  </View>
                  <View style={styles.accountProfileRow}>
                    <View style={styles.accountAvatar}>
                      <Text style={styles.accountAvatarText}>{accountInitials}</Text>
                    </View>
                    <View style={styles.accountIdentity}>
                      <Text style={styles.accountName}>{me?.user.fullName ?? "Complete your profile"}</Text>
                      <Text style={styles.accountMeta}>{email}</Text>
                      <Text style={styles.accountMeta}>
                        {me?.user.jurisdictionState ?? "Jurisdiction pending"} | {completion}% complete
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={[styles.card, styles.accountPlanCard]}>
                  <Text style={styles.planLabel}>ClearCase Plus</Text>
                  <View style={styles.planTitleRow}>
                    <Text style={styles.planTitle}>
                      {plusEnabled
                        ? language === "es"
                          ? "Activo"
                          : "Active"
                        : language === "es"
                          ? "No activo"
                          : "Not active"}
                    </Text>
                    <View style={styles.planTierPill}>
                      <Text style={styles.planTierPillText}>
                        {plusEnabled
                          ? language === "es"
                            ? "Plus"
                            : "Plus"
                          : language === "es"
                            ? "Free"
                            : "Free"}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.planBody}>
                    {language === "es"
                      ? "Recordatorios, memoria de cronologia, traduccion simple y herramientas de paquete de consulta en un solo plan."
                      : "Reminders, timeline memory, plain-meaning translation, and consultation packet tools in one plan."}
                  </Text>
                  <Text style={styles.planBodyMuted}>{paywallConfig.plusPriceMonthly}</Text>
                  <Text style={styles.planBodyMuted}>
                    {language === "es"
                      ? "ClearCase ofrece claridad legal, no asesoria legal."
                      : "ClearCase provides legal clarity, not legal advice."}
                  </Text>
                  <Pressable style={styles.accountUpgradeBtn} onPress={() => openPaywall("account_billing_card")}>
                    <Text style={styles.accountUpgradeBtnText}>
                      {plusEnabled
                        ? language === "es"
                          ? "Administrar cobro"
                          : "Manage billing"
                        : language === "es"
                          ? "Iniciar Plus"
                          : "Start Plus"}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Profile</Text>
                  <TextInput
                    style={styles.input}
                    value={profileName}
                    onChangeText={setProfileName}
                    placeholder="Full name"
                    placeholderTextColor={palette.subtle}
                    accessibilityLabel="Full name"
                  />
                  <TextInput
                    style={styles.input}
                    value={profileZip}
                    onChangeText={setProfileZip}
                    placeholder="ZIP code"
                    placeholderTextColor={palette.subtle}
                    keyboardType="number-pad"
                    accessibilityLabel="ZIP code"
                  />
                  <Pressable onPress={() => { hapticTap(); void saveProfile(); }} style={styles.primaryBtn} disabled={savingProfile}>
                    <Text style={styles.primaryBtnText}>{savingProfile ? "Saving..." : "Save profile"}</Text>
                  </Pressable>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{language === "es" ? "Configuracion personal" : "Personal settings"}</Text>
                  <View style={styles.settingRow}>
                    <Feather name="globe" size={16} color={palette.subtle} />
                    <Text style={styles.settingText}>{language === "es" ? "Idioma" : "Language"}</Text>
                    <Text style={styles.optionDesc}>{languageLabel(language)}</Text>
                  </View>
                  <View style={styles.languageToggleRow}>
                    <Pressable
                      style={[styles.languageTogglePill, language === "en" ? styles.languageTogglePillActive : null]}
                      onPress={() => void applyLanguageFromSettings("en")}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: language === "en" }}
                      accessibilityLabel="English"
                    >
                      <Text
                        style={[
                          styles.languageToggleText,
                          language === "en" ? styles.languageToggleTextActive : null
                        ]}
                      >
                        English
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.languageTogglePill, language === "es" ? styles.languageTogglePillActive : null]}
                      onPress={() => void applyLanguageFromSettings("es")}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: language === "es" }}
                      accessibilityLabel="Espanol"
                    >
                      <Text
                        style={[
                          styles.languageToggleText,
                          language === "es" ? styles.languageToggleTextActive : null
                        ]}
                      >
                        Espanol
                      </Text>
                    </Pressable>
                  </View>
                  <Pressable style={styles.settingRow} onPress={() => void togglePushNotifications()} disabled={savingPushPreferences} accessibilityRole="switch" accessibilityState={{ checked: pushEnabled }} accessibilityLabel={language === "es" ? "Notificaciones push" : "Push notifications"}>
                    <Feather name="bell" size={16} color={palette.subtle} />
                    <Text style={styles.settingText}>{language === "es" ? "Notificaciones" : "Notifications"}</Text>
                    <Text style={styles.optionDesc}>
                      {pushEnabled
                        ? language === "es"
                          ? "Activadas"
                          : "Enabled"
                        : language === "es"
                          ? "Desactivadas"
                          : "Disabled"}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.settingRow}
                    onPress={() => void togglePushQuietHours()}
                    disabled={savingPushPreferences}
                  >
                    <Feather name="moon" size={16} color={palette.subtle} />
                    <Text style={styles.settingText}>{language === "es" ? "Horas de silencio" : "Quiet hours"}</Text>
                    <Text style={styles.optionDesc}>
                      {pushQuietHoursEnabled
                        ? language === "es"
                          ? "22:00-07:00 UTC"
                          : "10pm-7am UTC"
                        : language === "es"
                          ? "Sin horario"
                          : "No schedule"}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.settingRow}
                    onPress={() => {
                      Alert.alert(
                        language === "es" ? "Dispositivos push" : "Push Devices",
                        language === "es"
                          ? `Tienes ${me?.pushDevices?.activeCount ?? 0} dispositivo(s) registrado(s). Para eliminar un dispositivo, desactiva las notificaciones y vuelve a activarlas.`
                          : `You have ${me?.pushDevices?.activeCount ?? 0} registered device(s). To remove a device, disable notifications and re-enable them.`,
                        [{ text: "OK" }]
                      );
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={language === "es" ? "Dispositivos push" : "Push devices"}
                  >
                    <Feather name="smartphone" size={16} color={palette.subtle} />
                    <Text style={styles.settingText}>{language === "es" ? "Dispositivos push" : "Push devices"}</Text>
                    <Text style={styles.optionDesc}>
                      {me?.pushDevices?.activeCount ?? 0}
                    </Text>
                  </Pressable>
                  <Pressable style={styles.settingRow} onPress={() => openPaywall("account_settings_billing")} accessibilityRole="button" accessibilityLabel={language === "es" ? "Facturacion y planes" : "Billing and plans"}>
                    <Feather name="credit-card" size={16} color={palette.subtle} />
                    <Text style={styles.settingText}>{language === "es" ? "Facturacion y planes" : "Billing and plans"}</Text>
                    <Feather name="chevron-right" size={14} color={palette.subtle} />
                  </Pressable>
                  <Pressable
                    style={styles.settingRow}
                    accessibilityRole="button"
                    accessibilityLabel={language === "es" ? "Seguridad" : "Security"}
                    onPress={() => {
                      Alert.alert(
                        language === "es" ? "Seguridad" : "Security",
                        language === "es"
                          ? "Bloqueo biometrico: Usa Face ID o huella dactilar para proteger la app.\n\nEsta funcion estara disponible en una proxima actualizacion."
                          : "Biometric Lock: Use Face ID or fingerprint to protect the app.\n\nThis feature will be available in an upcoming update.",
                        [{ text: "OK" }]
                      );
                    }}
                  >
                    <Feather name="shield" size={16} color={palette.subtle} />
                    <Text style={styles.settingText}>{language === "es" ? "Seguridad" : "Security"}</Text>
                    <Feather name="chevron-right" size={14} color={palette.subtle} />
                  </Pressable>
                  <Pressable
                    style={styles.settingRow}
                    accessibilityRole="button"
                    accessibilityLabel={language === "es" ? "Aviso legal y privacidad" : "Legal and privacy"}
                    onPress={() => { setLegalReturnScreen("account"); setScreen("legal"); }}
                  >
                    <Feather name="file-text" size={16} color={palette.subtle} />
                    <Text style={styles.settingText}>{language === "es" ? "Legal y privacidad" : "Legal & Privacy"}</Text>
                    <Feather name="chevron-right" size={14} color={palette.subtle} />
                  </Pressable>
                </View>

                <Pressable onPress={() => void signOut()} style={[styles.outlineSoftBtn, styles.accountSignOutBtn]} accessibilityRole="button" accessibilityLabel={language === "es" ? "Cerrar sesion" : "Sign out"}>
                  <Text style={styles.outlineSoftText}>{language === "es" ? "Cerrar sesion" : "Sign out"}</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    Alert.alert(
                      language === "es" ? "Eliminar cuenta" : "Delete Account",
                      language === "es"
                        ? "Esta accion eliminara permanentemente tu cuenta, todos tus casos y documentos. Esta accion no se puede deshacer."
                        : "This will permanently delete your account, all your cases, and documents. This action cannot be undone.",
                      [
                        { text: language === "es" ? "Cancelar" : "Cancel", style: "cancel" },
                        {
                          text: language === "es" ? "Eliminar cuenta" : "Delete Account",
                          style: "destructive",
                          onPress: () => {
                            Alert.alert(
                              language === "es" ? "Confirmar eliminacion" : "Confirm Deletion",
                              language === "es"
                                ? "Escribe ELIMINAR para confirmar."
                                : "Are you absolutely sure? This is irreversible.",
                              [
                                { text: language === "es" ? "Cancelar" : "Cancel", style: "cancel" },
                                {
                                  text: language === "es" ? "Si, eliminar todo" : "Yes, delete everything",
                                  style: "destructive",
                                  onPress: async () => {
                                    try {
                                      if (!offlineMode) {
                                        await fetch(`${apiBase}/me`, { method: "DELETE", headers: { ...headers, "Content-Type": "application/json" } });
                                      }
                                    } catch { /* best effort */ }
                                    await AsyncStorage.clear();
                                    setMe(null);
                                    setCases([]);
                                    setSelectedCaseId(null);
                                    setSelectedCase(null);
                                    setEmail("");
                                    setSubject("");
                                    setPlanTier("free");
                                    setScreen("onboarding");
                                    showBanner("info", language === "es" ? "Cuenta eliminada." : "Account deleted.");
                                  }
                                }
                              ]
                            );
                          }
                        }
                      ]
                    );
                  }}
                  style={[styles.outlineSoftBtn, { borderColor: "#FCA5A5", marginBottom: 32 }]}
                  accessibilityRole="button"
                  accessibilityLabel={language === "es" ? "Eliminar cuenta" : "Delete account"}
                >
                  <Text style={[styles.outlineSoftText, { color: "#DC2626" }]}>{language === "es" ? "Eliminar cuenta" : "Delete Account"}</Text>
                </Pressable>
              </ScrollView>
            </View>
          ) : null}

          {screen === "legal" ? (
            <View style={styles.screenSoft}>
              <View style={styles.verdictHead}>
                <Pressable onPress={() => setScreen(legalReturnScreen)} style={styles.back} accessibilityRole="button" accessibilityLabel="Go back">
                  <Feather name="chevron-left" size={24} color={palette.muted} />
                </Pressable>
                <Text style={styles.formTitleSmall}>{language === "es" ? "Aviso legal y privacidad" : "Legal & Privacy"}</Text>
                <View style={styles.spacer} />
              </View>
              <ScrollView contentContainerStyle={styles.scrollBody}>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{language === "es" ? "Terminos de servicio" : "Terms of Service"}</Text>
                  <Text style={[styles.cardBody, { fontFamily: font.semibold, marginBottom: 4 }]}>
                    {language === "es" ? "1. Naturaleza del servicio" : "1. Nature of Service"}
                  </Text>
                  <Text style={styles.cardBody}>
                    {language === "es"
                      ? "ClearCase es una herramienta informativa. No es un bufete de abogados y no proporciona asesoramiento legal. Los resultados son de contexto general y pueden estar incompletos."
                      : "ClearCase is an informational tool. It is not a law firm and does not provide legal advice. Results are for general context and may be incomplete."}
                  </Text>
                  <Text style={[styles.cardBody, { fontFamily: font.semibold, marginBottom: 4, marginTop: 8 }]}>
                    {language === "es" ? "2. Sin relacion abogado-cliente" : "2. No Attorney-Client Relationship"}
                  </Text>
                  <Text style={styles.cardBody}>
                    {language === "es"
                      ? "El uso de ClearCase no crea una relacion abogado-cliente. Para asesoria especifica de su situacion, consulte con un abogado con licencia en su jurisdiccion."
                      : "Using ClearCase does not create an attorney-client relationship. For advice specific to your situation, consult a licensed attorney in your jurisdiction."}
                  </Text>
                  <Text style={[styles.cardBody, { fontFamily: font.semibold, marginBottom: 4, marginTop: 8 }]}>
                    {language === "es" ? "3. Uso aceptable" : "3. Acceptable Use"}
                  </Text>
                  <Text style={styles.cardBody}>
                    {language === "es"
                      ? "Usted acepta usar ClearCase solo para fines legales y personales. No debe cargar contenido que viole leyes aplicables o derechos de terceros."
                      : "You agree to use ClearCase only for lawful, personal purposes. You must not upload content that violates applicable laws or third-party rights."}
                  </Text>
                  <Text style={[styles.cardBody, { fontFamily: font.semibold, marginBottom: 4, marginTop: 8 }]}>
                    {language === "es" ? "4. Limitacion de responsabilidad" : "4. Limitation of Liability"}
                  </Text>
                  <Text style={styles.cardBody}>
                    {language === "es"
                      ? "ClearCase se proporciona \"tal cual\" sin garantias de ninguna clase. No somos responsables por decisiones tomadas basandose en los resultados de la aplicacion."
                      : "ClearCase is provided \"as is\" without warranties of any kind. We are not liable for decisions made based on the application's output."}
                  </Text>
                  <Text style={[styles.cardBody, { fontFamily: font.semibold, marginBottom: 4, marginTop: 8 }]}>
                    {language === "es" ? "5. Cambios en los terminos" : "5. Changes to Terms"}
                  </Text>
                  <Text style={styles.cardBody}>
                    {language === "es"
                      ? "Podemos actualizar estos terminos en cualquier momento. El uso continuado de la aplicacion constituye aceptacion de los terminos actualizados."
                      : "We may update these terms at any time. Continued use of the application constitutes acceptance of the updated terms."}
                  </Text>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{language === "es" ? "Politica de privacidad" : "Privacy Policy"}</Text>
                  <Text style={[styles.cardBody, { fontFamily: font.semibold, marginBottom: 4 }]}>
                    {language === "es" ? "Datos que recopilamos" : "Data We Collect"}
                  </Text>
                  <Text style={styles.cardBody}>
                    {language === "es"
                      ? "Recopilamos la informacion de cuenta que usted proporciona (nombre, correo electronico, idioma) y los documentos que carga para su analisis."
                      : "We collect the account information you provide (name, email, language preference) and the documents you upload for analysis."}
                  </Text>
                  <Text style={[styles.cardBody, { fontFamily: font.semibold, marginBottom: 4, marginTop: 8 }]}>
                    {language === "es" ? "Como usamos sus datos" : "How We Use Your Data"}
                  </Text>
                  <Text style={styles.cardBody}>
                    {language === "es"
                      ? "Sus documentos se procesan exclusivamente para generar analisis de documentos, senales de cronologia y claridad situacional. No vendemos sus datos a terceros."
                      : "Your documents are processed exclusively to generate document insights, timeline signals, and situational clarity. We do not sell your data to third parties."}
                  </Text>
                  <Text style={[styles.cardBody, { fontFamily: font.semibold, marginBottom: 4, marginTop: 8 }]}>
                    {language === "es" ? "Almacenamiento y seguridad" : "Storage & Security"}
                  </Text>
                  <Text style={styles.cardBody}>
                    {language === "es"
                      ? "Los documentos se almacenan de forma cifrada en servidores seguros. Utilizamos HTTPS para todas las transmisiones y controles de acceso para proteger su informacion."
                      : "Documents are stored encrypted on secure servers. We use HTTPS for all transmissions and access controls to protect your information."}
                  </Text>
                  <Text style={[styles.cardBody, { fontFamily: font.semibold, marginBottom: 4, marginTop: 8 }]}>
                    {language === "es" ? "Retencion de datos" : "Data Retention"}
                  </Text>
                  <Text style={styles.cardBody}>
                    {language === "es"
                      ? "Puede solicitar la eliminacion de su cuenta y datos asociados en cualquier momento contactandonos a support@clearcase.com."
                      : "You may request deletion of your account and associated data at any time by contacting us at support@clearcase.com."}
                  </Text>
                  <Text style={[styles.cardBody, { fontFamily: font.semibold, marginBottom: 4, marginTop: 8 }]}>
                    {language === "es" ? "Notificaciones push" : "Push Notifications"}
                  </Text>
                  <Text style={styles.cardBody}>
                    {language === "es"
                      ? "Si habilita notificaciones push, almacenamos un token de dispositivo para enviar recordatorios de plazos. Puede desactivar las notificaciones en cualquier momento."
                      : "If you enable push notifications, we store a device token to deliver deadline reminders. You can disable notifications at any time."}
                  </Text>
                  <Text style={[styles.cardBody, { fontFamily: font.semibold, marginBottom: 4, marginTop: 8 }]}>
                    {language === "es" ? "Contacto" : "Contact"}
                  </Text>
                  <Text style={styles.cardBody}>
                    {language === "es"
                      ? "Para preguntas sobre privacidad, contactenos en support@clearcase.com."
                      : "For privacy questions, contact us at support@clearcase.com."}
                  </Text>
                </View>

                <Pressable onPress={() => setScreen(legalReturnScreen)} style={styles.primaryBtn} accessibilityRole="button" accessibilityLabel={language === "es" ? "Regresar a la app" : "Back to app"}>
                  <Text style={styles.primaryBtnText}>{language === "es" ? "Regresar a la app" : "Back to app"}</Text>
                </Pressable>
              </ScrollView>
            </View>
          ) : null}

          {screen === "legalAid" ? (
            <View style={styles.screenSoft}>
              <View style={styles.verdictHead}>
                <Pressable onPress={() => setScreen("home")} style={styles.back} accessibilityRole="button" accessibilityLabel="Go back">
                  <Feather name="chevron-left" size={24} color={palette.muted} />
                </Pressable>
                <View>
                  <Text style={styles.formTitleSmall}>{language === "es" ? "Recursos Legales" : "Legal Resources"}</Text>
                  <Text style={{ fontFamily: font.regular, fontSize: 11, color: palette.muted }}>{language === "es" ? "Encuentra ayuda cerca" : "Find help near you"}</Text>
                </View>
                <View style={styles.spacer} />
              </View>
              <ScrollView contentContainerStyle={styles.scrollBody}>
                <View style={styles.searchBar}>
                  <Feather name="search" size={16} color={palette.subtle} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder={language === "es" ? "Buscar por tema..." : "Search by topic..."}
                    placeholderTextColor={palette.subtle}
                    value={legalAidSearch}
                    onChangeText={setLegalAidSearch}
                    accessibilityLabel={language === "es" ? "Buscar recursos legales" : "Search legal resources"}
                  />
                </View>

                <Text style={[styles.sectionLabel, { marginTop: 16, marginBottom: 8 }]}>
                  {language === "es" ? "Recomendados para ti" : "Recommended for you"}
                </Text>

                {LEGAL_AID_RESOURCES
                  .filter((r) => {
                    if (!legalAidSearch.trim()) return true;
                    const q = legalAidSearch.toLowerCase();
                    const searchable = language === "es"
                      ? `${r.nameEs} ${r.typeEs} ${r.descriptionEs}`
                      : `${r.name} ${r.type} ${r.description}`;
                    return searchable.toLowerCase().includes(q);
                  })
                  .map((res, i) => (
                    <View key={i} style={[styles.card, { marginBottom: 12 }]}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <View style={{ flex: 1 }}>
                          <View style={{ backgroundColor: "#EFF6FF", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, alignSelf: "flex-start", marginBottom: 6 }}>
                            <Text style={{ fontFamily: font.semibold, fontSize: 9, color: "#2563EB", textTransform: "uppercase", letterSpacing: 1 }}>
                              {language === "es" ? res.typeEs : res.type}
                            </Text>
                          </View>
                          <Text style={{ fontFamily: font.bold, fontSize: 16, color: palette.text }}>
                            {language === "es" ? res.nameEs : res.name}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.cardBody, { marginBottom: 12 }]}>
                        {language === "es" ? res.descriptionEs : res.description}
                      </Text>
                      <View style={{ flexDirection: "row", gap: 10 }}>
                        <Pressable
                          onPress={() => Linking.openURL(`tel:${res.phone.replace(/[^0-9+]/g, "")}`)}
                          style={[styles.outlineSoftBtn, { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10 }]}
                          accessibilityRole="button"
                          accessibilityLabel={`${language === "es" ? "Llamar" : "Call"} ${language === "es" ? res.nameEs : res.name}`}
                        >
                          <Feather name="phone" size={14} color={palette.muted} />
                          <Text style={styles.outlineSoftText}>{language === "es" ? "Llamar" : "Call"}</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => Linking.openURL(res.website)}
                          style={[styles.outlineSoftBtn, { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10 }]}
                          accessibilityRole="link"
                          accessibilityLabel={`${language === "es" ? "Sitio web de" : "Website for"} ${language === "es" ? res.nameEs : res.name}`}
                        >
                          <Feather name="globe" size={14} color={palette.muted} />
                          <Text style={styles.outlineSoftText}>{language === "es" ? "Sitio web" : "Website"}</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}

                <View style={[styles.card, { backgroundColor: palette.primary, marginTop: 8 }]}>
                  <Text style={{ fontFamily: font.bold, fontSize: 18, color: "#FFFFFF", marginBottom: 4 }}>
                    {language === "es" ? "Necesita un abogado?" : "Need a lawyer?"}
                  </Text>
                  <Text style={{ fontFamily: font.regular, fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 19, marginBottom: 16 }}>
                    {language === "es"
                      ? "Podemos ayudarle a compartir su expediente directamente con un profesional."
                      : "We can help you share your case file and summaries directly with a professional."}
                  </Text>
                  {selectedCaseId ? (
                    <Pressable
                      onPress={() => { setLawyerSummaryOpen(true); setScreen("workspace"); }}
                      style={{ backgroundColor: "#FFFFFF", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, alignSelf: "flex-start" }}
                      accessibilityRole="button"
                      accessibilityLabel={language === "es" ? "Compartir expediente" : "Share case file"}
                    >
                      <Text style={{ fontFamily: font.bold, fontSize: 12, color: palette.primary }}>
                        {language === "es" ? "Compartir expediente" : "Share Case File"}
                      </Text>
                    </Pressable>
                  ) : (
                    <Text style={{ fontFamily: font.regular, fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                      {language === "es" ? "Crea un caso primero para compartir." : "Create a case first to share."}
                    </Text>
                  )}
                </View>
              </ScrollView>
            </View>
          ) : null}

          {screen === "drafting" ? (
            <View style={styles.screenSoft}>
              <View style={styles.verdictHead}>
                <Pressable onPress={() => { setSelectedTemplate(null); setScreen("workspace"); }} style={styles.back} accessibilityRole="button" accessibilityLabel="Go back">
                  <Feather name="chevron-left" size={24} color={palette.muted} />
                </Pressable>
                <View>
                  <Text style={styles.formTitleSmall}>{language === "es" ? "Asistente de Redaccion" : "Drafting Assistant"}</Text>
                  <Text style={{ fontFamily: font.regular, fontSize: 11, color: palette.muted }}>
                    {language === "es" ? "Plantillas de respuesta" : "Response templates"}
                  </Text>
                </View>
                <View style={styles.spacer} />
              </View>
              <ScrollView contentContainerStyle={styles.scrollBody}>
                {!selectedTemplate ? (
                  <>
                    <View style={{ backgroundColor: "#EFF6FF", padding: 16, borderRadius: 14, borderWidth: 1, borderColor: "#DBEAFE", marginBottom: 16 }}>
                      <Text style={{ fontFamily: font.bold, fontSize: 14, color: "#1E3A5F", marginBottom: 4 }}>
                        {language === "es" ? "Elija un punto de partida" : "Pick a starting point"}
                      </Text>
                      <Text style={{ fontFamily: font.regular, fontSize: 13, color: "rgba(30,58,95,0.7)", lineHeight: 19 }}>
                        {language === "es"
                          ? "Elija una plantilla. Estan escritas en lenguaje sencillo para mantener las cosas profesionales y claras."
                          : "Choose a template below. We've written these in plain English to keep things professional and clear."}
                      </Text>
                    </View>

                    {DRAFT_TEMPLATES.map((t) => (
                      <Pressable
                        key={t.id}
                        onPress={() => { hapticTap(); setSelectedTemplate(t); }}
                        style={[styles.card, { marginBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}
                        accessibilityRole="button"
                        accessibilityLabel={language === "es" ? t.titleEs : t.title}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: font.bold, fontSize: 15, color: palette.text, marginBottom: 2 }}>
                            {language === "es" ? t.titleEs : t.title}
                          </Text>
                          <Text style={{ fontFamily: font.regular, fontSize: 12, color: palette.muted }}>
                            {language === "es" ? t.descriptionEs : t.description}
                          </Text>
                        </View>
                        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: palette.surfaceSoft, alignItems: "center", justifyContent: "center" }}>
                          <Feather name="send" size={14} color={palette.subtle} />
                        </View>
                      </Pressable>
                    ))}
                  </>
                ) : (
                  <>
                    <Pressable onPress={() => setSelectedTemplate(null)} style={{ marginBottom: 12 }} accessibilityRole="button" accessibilityLabel={language === "es" ? "Regresar a la lista" : "Back to list"}>
                      <Text style={{ fontFamily: font.bold, fontSize: 12, color: "#2563EB", textTransform: "uppercase", letterSpacing: 1 }}>
                        {language === "es" ? "← Regresar a la lista" : "← Back to list"}
                      </Text>
                    </Pressable>

                    <View style={[styles.card, { padding: 0, overflow: "hidden" }]}>
                      <View style={{ backgroundColor: palette.surfaceSoft, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.line }}>
                        <Text style={{ fontFamily: font.bold, fontSize: 9, color: palette.subtle, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                          {language === "es" ? "Asunto" : "Subject"}
                        </Text>
                        <Text style={{ fontFamily: font.medium, fontSize: 14, color: palette.text }}>
                          {language === "es" ? selectedTemplate.subjectEs : selectedTemplate.subject}
                        </Text>
                      </View>
                      <View style={{ padding: 16 }}>
                        <Text style={{ fontFamily: font.bold, fontSize: 9, color: palette.subtle, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                          {language === "es" ? "Cuerpo del mensaje" : "Message Body"}
                        </Text>
                        <View style={{ backgroundColor: "rgba(248,250,252,0.5)", padding: 12, borderRadius: 10, borderWidth: 1, borderColor: palette.surfaceSoft }}>
                          <Text style={{ fontFamily: font.regular, fontSize: 13, color: "#334155", lineHeight: 20 }}>
                            {language === "es" ? selectedTemplate.bodyEs : selectedTemplate.body}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <Pressable
                      onPress={() => {
                        const text = language === "es" ? selectedTemplate.bodyEs : selectedTemplate.body;
                        Share.share({ message: text });
                      }}
                      style={[styles.primaryBtn, { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12 }]}
                      accessibilityRole="button"
                      accessibilityLabel={language === "es" ? "Copiar y compartir" : "Copy and share"}
                    >
                      <Feather name="copy" size={16} color="#FFFFFF" />
                      <Text style={styles.primaryBtnText}>{language === "es" ? "Copiar y compartir" : "Copy & Share"}</Text>
                    </Pressable>

                    <View style={{ backgroundColor: "#FEF3C7", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#FDE68A", flexDirection: "row", gap: 10, marginTop: 12, alignItems: "flex-start" }}>
                      <Feather name="alert-circle" size={16} color="#A16207" style={{ marginTop: 2 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: font.bold, fontSize: 12, color: "#78350F", marginBottom: 2 }}>
                          {language === "es" ? "Tip: Edite el texto entre corchetes" : "Tip: Edit bracketed text"}
                        </Text>
                        <Text style={{ fontFamily: font.regular, fontSize: 11, color: "rgba(120,53,15,0.7)", lineHeight: 16 }}>
                          {language === "es"
                            ? "Asegurese de reemplazar cosas como [Nombre del Arrendador] con los datos reales antes de enviar."
                            : "Make sure to replace things like [Landlord Name] with the actual details before sending."}
                        </Text>
                      </View>
                    </View>
                  </>
                )}

                <View style={{ marginTop: 16, paddingVertical: 12 }}>
                  <Text style={{ fontFamily: font.regular, fontSize: 10, color: palette.subtle, textAlign: "center", lineHeight: 15 }}>
                    {language === "es"
                      ? "Estas plantillas son solo orientativas y no constituyen asesoria legal."
                      : "These templates are for guidance only and do not constitute legal advice."}
                  </Text>
                </View>
              </ScrollView>
            </View>
          ) : null}

          {(screen === "home" || screen === "workspace" || screen === "cases" || screen === "account") ? (
            <View style={styles.bottomTabs} accessibilityRole="tablist">
              <Pressable onPress={() => { hapticTap(); LayoutAnimation.configureNext(subtleSpring); setScreen("home"); }} style={styles.bottomTabItem} accessibilityRole="tab" accessibilityState={{ selected: screen === "home" }} accessibilityLabel={language === "es" ? "Inicio" : "Home"}>
                <Feather name="home" size={20} color={screen === "home" ? palette.text : palette.subtle} />
                <Text style={[styles.bottomTabLabel, screen === "home" ? styles.bottomTabLabelActive : null]}>
                  {language === "es" ? "Inicio" : "Home"}
                </Text>
                {screen === "home" ? <View style={styles.bottomDot} /> : null}
              </Pressable>
              <Pressable onPress={() => { hapticTap(); LayoutAnimation.configureNext(subtleSpring); setScreen("cases"); }} style={styles.bottomTabItem} accessibilityRole="tab" accessibilityState={{ selected: screen === "cases" }} accessibilityLabel={language === "es" ? "Casos" : "Cases"}>
                <Feather name="briefcase" size={20} color={screen === "cases" ? palette.text : palette.subtle} />
                <Text style={[styles.bottomTabLabel, screen === "cases" ? styles.bottomTabLabelActive : null]}>
                  {language === "es" ? "Casos" : "Cases"}
                </Text>
                {screen === "cases" ? <View style={styles.bottomDot} /> : null}
              </Pressable>
              <Pressable onPress={() => { hapticTap(); void homeUploadFlow(); }} style={styles.bottomUploadFab} accessibilityRole="button" accessibilityLabel={language === "es" ? "Subir documento" : "Upload document"}>
                <Feather name="plus-circle" size={26} color="#FFFFFF" />
              </Pressable>
              <Pressable onPress={() => { hapticTap(); LayoutAnimation.configureNext(subtleSpring); setScreen("account"); }} style={styles.bottomTabItem} accessibilityRole="tab" accessibilityState={{ selected: screen === "account" }} accessibilityLabel={language === "es" ? "Cuenta" : "Account"}>
                <Feather name="user" size={20} color={screen === "account" ? palette.text : palette.subtle} />
                <Text style={[styles.bottomTabLabel, screen === "account" ? styles.bottomTabLabelActive : null]}>
                  {language === "es" ? "Cuenta" : "Account"}
                </Text>
                {screen === "account" ? <View style={styles.bottomDot} /> : null}
              </Pressable>
            </View>
          ) : null}

          <Modal
            visible={lawyerSummaryOpen}
            transparent
            animationType="slide"
            onRequestClose={() => setLawyerSummaryOpen(false)}
          >
            <View style={styles.sheetOverlay}>
              <Pressable style={styles.sheetBackdrop} onPress={() => setLawyerSummaryOpen(false)} accessibilityRole="button" accessibilityLabel="Close" />
              <View style={[styles.sheetCard, styles.summarySheetCard]}>
                <Text style={styles.sheetTitle}>{language === "es" ? "Paquete de consulta" : "Lawyer-ready packet"}</Text>
                <Text style={styles.sheetSub}>
                  {language === "es"
                    ? "Preparacion de consulta con hechos, fechas, materiales y preguntas abiertas en tono neutral."
                    : "Consultation prep with neutral facts, dates, materials, and open questions."}
                </Text>
                <ScrollView style={styles.summaryScroll} contentContainerStyle={styles.summaryScrollBody}>
                  <Text style={styles.summaryCaseTitle}>{lawyerReadySummary.caseTitle}</Text>

                  <Text style={styles.summarySectionTitle}>{language === "es" ? "Resumen en lenguaje claro" : "Plain-language summary"}</Text>
                  <Text style={styles.summaryBody}>{lawyerReadySummary.summary}</Text>

                  <Text style={styles.summarySectionTitle}>{language === "es" ? "Hechos clave" : "Key facts"}</Text>
                  {lawyerReadySummary.facts.map((item, index) => (
                    <View key={`summary-fact-${index}`} style={styles.summaryBulletRow}>
                      <Text style={styles.summaryBulletDot}>-</Text>
                      <Text style={styles.summaryBulletText}>{item}</Text>
                    </View>
                  ))}

                  <Text style={styles.summarySectionTitle}>{language === "es" ? "Fechas detectadas" : "Detected dates"}</Text>
                  {lawyerReadySummary.dates.map((item, index) => (
                    <View key={`summary-date-${index}`} style={styles.summaryBulletRow}>
                      <Text style={styles.summaryBulletDot}>-</Text>
                      <Text style={styles.summaryBulletText}>{item}</Text>
                    </View>
                  ))}

                  <Text style={styles.summarySectionTitle}>{language === "es" ? "Partes y jurisdiccion" : "Parties and jurisdiction"}</Text>
                  {lawyerReadySummary.parties.map((item, index) => (
                    <View key={`summary-party-${index}`} style={styles.summaryBulletRow}>
                      <Text style={styles.summaryBulletDot}>-</Text>
                      <Text style={styles.summaryBulletText}>{item}</Text>
                    </View>
                  ))}

                  <Text style={styles.summarySectionTitle}>{language === "es" ? "Resumen de intake formal" : "Formal intake snapshot"}</Text>
                  {lawyerReadySummary.intakeOverview.map((item, index) => (
                    <View key={`summary-intake-${index}`} style={styles.summaryBulletRow}>
                      <Text style={styles.summaryBulletDot}>-</Text>
                      <Text style={styles.summaryBulletText}>{item}</Text>
                    </View>
                  ))}

                  <Text style={styles.summarySectionTitle}>{language === "es" ? "Registro de comunicaciones" : "Communications log"}</Text>
                  <Text style={styles.summaryBody}>{lawyerReadySummary.communicationsLog}</Text>

                  <Text style={styles.summarySectionTitle}>{language === "es" ? "Impacto financiero" : "Financial impact"}</Text>
                  <Text style={styles.summaryBody}>{lawyerReadySummary.financialImpact}</Text>

                  <Text style={styles.summarySectionTitle}>{language === "es" ? "Resultado deseado" : "Desired outcome"}</Text>
                  <Text style={styles.summaryBody}>{lawyerReadySummary.desiredOutcome}</Text>

                  <Text style={styles.summarySectionTitle}>{language === "es" ? "Lista de evidencia" : "Evidence checklist"}</Text>
                  {lawyerReadySummary.evidence.map((item, index) => (
                    <View key={`summary-evidence-${index}`} style={styles.summaryBulletRow}>
                      <Text style={styles.summaryBulletDot}>-</Text>
                      <Text style={styles.summaryBulletText}>{item}</Text>
                    </View>
                  ))}

                  <Text style={styles.summarySectionTitle}>{language === "es" ? "Preguntas abiertas" : "Open questions"}</Text>
                  {lawyerReadySummary.openQuestions.map((item, index) => (
                    <View key={`summary-question-${index}`} style={styles.summaryBulletRow}>
                      <Text style={styles.summaryBulletDot}>-</Text>
                      <Text style={styles.summaryBulletText}>{item}</Text>
                    </View>
                  ))}

                  <Text style={styles.summarySectionTitle}>{language === "es" ? "Agenda sugerida para consulta" : "Suggested consult agenda"}</Text>
                  {lawyerReadySummary.consultAgenda.map((item, index) => (
                    <View key={`summary-agenda-${index}`} style={styles.summaryBulletRow}>
                      <Text style={styles.summaryBulletDot}>-</Text>
                      <Text style={styles.summaryBulletText}>{item}</Text>
                    </View>
                  ))}

                  <Text style={styles.summarySectionTitle}>
                    {language === "es" ? "Pasos que algunas personas consideran utiles" : "Steps people often find useful"}
                  </Text>
                  {lawyerReadySummary.nextSteps.map((item, index) => (
                    <View key={`summary-step-${index}`} style={styles.summaryBulletRow}>
                      <Text style={styles.summaryBulletDot}>-</Text>
                      <Text style={styles.summaryBulletText}>{item}</Text>
                    </View>
                  ))}

                  <Text style={styles.summarySectionTitle}>{language === "es" ? "Control de acceso" : "Access controls"}</Text>
                  <Text style={styles.summaryBody}>
                    {language === "es"
                      ? "El enlace para compartir esta activo por 7 dias. Puedes desactivar el acceso en cualquier momento."
                      : "Share link active for 7 days. You can disable access at any time."}
                  </Text>
                  <Text style={styles.summaryBody}>{packetShareStatusLine}</Text>
                  <Text style={styles.summarySectionTitle}>{language === "es" ? "Indicador de ahorro de costos" : "Cost-saving indicator"}</Text>
                  <Text style={styles.summaryBody}>{costSavingIndicator.message}</Text>
                  <Text style={styles.summaryBody}>{costSavingIndicator.assumptions}</Text>
                  <Text style={styles.summarySectionTitle}>{language === "es" ? "Historial de paquetes" : "Packet history"}</Text>
                  {packetHistoryEntries.length === 0 ? (
                    <Text style={styles.summaryBody}>
                      {language === "es" ? "Aun no hay versiones de paquete para este caso." : "No packet versions are available for this case yet."}
                    </Text>
                  ) : (
                    packetHistoryEntries.map((entry) => (
                      <View key={`packet-history-${entry.version}-${entry.createdAt}`} style={styles.receiptRow}>
                        <Text style={styles.receiptTitle}>
                          {language === "es" ? `Paquete v${entry.version}` : `Packet v${entry.version}`} - {entry.reason}
                        </Text>
                        <Text style={styles.receiptSub}>
                          {language === "es" ? "Actualizado" : "Updated"}: {fmtDateTime(entry.createdAt)}
                        </Text>
                      </View>
                    ))
                  )}
                  {loadingConsultLinks ? <ActivityIndicator color={palette.primary} style={styles.summaryLoader} /> : null}
                  {consultLinks.length === 0 ? (
                    <Text style={styles.summaryBody}>
                      {language === "es" ? "Aun no hay enlaces para compartir en este caso." : "No share links have been created for this case yet."}
                    </Text>
                  ) : (
                    consultLinks.map((link) => (
                      <View key={`consult-link-${link.id}`} style={styles.consultLinkRow}>
                        <View style={styles.consultLinkMain}>
                          <Text style={styles.consultLinkTitle}>ID {link.id}</Text>
                          <Text style={styles.consultLinkMeta}>
                            {language === "es" ? "Estado" : "Status"}: {titleize(link.status)} |{" "}
                            {language === "es" ? "Expira" : "Expires"} {fmtDateTime(link.expiresAt)} |{" "}
                            {language === "es" ? "Vista de token" : "Token preview"} {link.tokenPreview}
                          </Text>
                        </View>
                        <View style={styles.consultLinkActions}>
                          {link.status === "active" ? (
                            <Pressable
                              style={styles.linkMiniBtn}
                              onPress={() => void disableConsultPacketShareLink(link.id)}
                              disabled={disablingConsultToken === link.id}
                            >
                              <Text style={styles.linkMiniText}>
                                {disablingConsultToken === link.id ? "..." : language === "es" ? "Desactivar" : "Disable"}
                              </Text>
                            </Pressable>
                          ) : null}
                        </View>
                      </View>
                    ))
                  )}

                  <Text style={styles.summaryDisclaimer}>{lawyerReadySummary.disclaimer}</Text>
                </ScrollView>
                <Pressable onPress={() => void createConsultPacketShareLink()} style={styles.sheetActionBtn} disabled={creatingConsultLink}>
                  <Feather name="link" size={16} color={palette.text} />
                  <Text style={styles.sheetActionText}>
                    {creatingConsultLink
                      ? language === "es"
                        ? "Creando enlace..."
                        : "Creating link..."
                      : language === "es"
                        ? "Crear enlace de 7 dias"
                        : "Create 7-day share link"}
                  </Text>
                </Pressable>
                <Pressable onPress={() => void emailLawyerReadySummary()} style={styles.sheetActionBtn}>
                  <Feather name="mail" size={16} color={palette.text} />
                  <Text style={styles.sheetActionText}>{language === "es" ? "Borrador de correo" : "Email draft"}</Text>
                </Pressable>
                <Pressable onPress={() => void shareLawyerReadySummary()} style={styles.sheetActionBtn}>
                  <Feather name="share-2" size={16} color={palette.text} />
                  <Text style={styles.sheetActionText}>{language === "es" ? "Compartir / guardar paquete" : "Share / save packet"}</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setLawyerSummaryOpen(false);
                    setIntakeModalOpen(true);
                  }}
                  style={styles.sheetActionBtn}
                >
                  <Feather name="clipboard" size={16} color={palette.text} />
                  <Text style={styles.sheetActionText}>
                    {language === "es"
                      ? `Editar intake formal (${intakeCompleteness}% completo)`
                      : `Edit formal intake (${intakeCompleteness}% complete)`}
                  </Text>
                </Pressable>
                <Pressable onPress={() => setLawyerSummaryOpen(false)} style={styles.sheetCancelBtn}>
                  <Text style={styles.sheetCancelText}>{language === "es" ? "Cerrar" : "Close"}</Text>
                </Pressable>
              </View>
            </View>
          </Modal>

          <Modal
            visible={plainMeaningOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setPlainMeaningOpen(false)}
          >
            <View style={styles.sheetOverlay}>
              <Pressable style={styles.sheetBackdrop} onPress={() => setPlainMeaningOpen(false)} accessibilityRole="button" accessibilityLabel="Close" />
              <View style={[styles.sheetCard, styles.summarySheetCard]}>
                <Text style={styles.sheetTitle}>
                  {language === "es" ? "Vista de significado simple" : "Plain meaning view"}
                </Text>
                <Text style={styles.sheetSub}>
                  {language === "es"
                    ? "Lectura comparativa con referencias de origen para preparacion de consulta."
                    : "Side-by-side interpretation with source references for consultation prep."}
                </Text>
                <ScrollView style={styles.summaryScroll} contentContainerStyle={styles.summaryScrollBody}>
                  {plainMeaningRows.length === 0 ? (
                    <Text style={styles.summaryBody}>
                      {language === "es"
                        ? "Aun no hay filas de significado simple para este caso."
                        : "No plain meaning rows are available for this case yet."}
                    </Text>
                  ) : (
                    plainMeaningRows.map((row) => (
                      <View key={`plain-meaning-${row.id}`} style={styles.receiptRow}>
                        <Text style={styles.summarySectionTitle}>
                          {language === "es" ? "Texto original" : "Original text"}
                        </Text>
                        <Text style={styles.summaryBody}>{row.originalText}</Text>
                        <Text style={styles.summarySectionTitle}>
                          {language === "es" ? "Significado simple" : "Plain meaning"}
                        </Text>
                        <Text style={styles.summaryBody}>{row.plainMeaning}</Text>
                        <Text style={styles.summarySectionTitle}>
                          {language === "es" ? "Por que suele importar" : "Why this often matters"}
                        </Text>
                        <Text style={styles.summaryBody}>{row.whyThisOftenMatters}</Text>
                        <Text style={styles.summarySectionTitle}>
                          {language === "es" ? "Elementos que muchas personas preparan" : "Commonly prepared items"}
                        </Text>
                        {row.commonlyPreparedItems.map((item, index) => (
                          <Text key={`${row.id}-item-${index}`} style={styles.summaryBulletText}>
                            - {item}
                          </Text>
                        ))}
                        {row.receipts.map((receipt, index) => (
                          <Text key={`${row.id}-receipt-${index}`} style={styles.receiptSub}>
                            {language === "es" ? "Referencia" : "Receipt"}: {receipt.fileName} |{" "}
                            {language === "es" ? "Confianza" : "Confidence"}:{" "}
                            {language === "es"
                              ? receipt.confidence === "high"
                                ? "alta"
                                : receipt.confidence === "medium"
                                  ? "media"
                                  : "baja"
                              : receipt.confidence}
                            . {receipt.snippet}
                          </Text>
                        ))}
                        <Text style={styles.receiptSub}>
                          {language === "es" ? "Incertidumbre" : "Uncertainty"}: {row.uncertainty}
                        </Text>
                      </View>
                    ))
                  )}
                  <Text style={styles.summaryDisclaimer}>
                    {plainMeaningBoundary ||
                      (language === "es"
                        ? "Interpretacion informativa para preparacion de consulta. No es asesoria legal."
                        : "Informational interpretation for consultation preparation. Not legal advice.")}
                  </Text>
                </ScrollView>
                <Pressable onPress={() => setPlainMeaningOpen(false)} style={styles.sheetCancelBtn}>
                  <Text style={styles.sheetCancelText}>{language === "es" ? "Cerrar" : "Close"}</Text>
                </Pressable>
              </View>
            </View>
          </Modal>

          <Modal
            visible={assetViewerOpen}
            transparent
            animationType="fade"
            onRequestClose={closeAssetViewer}
          >
            <View style={styles.sheetOverlay}>
              <Pressable style={styles.sheetBackdrop} onPress={closeAssetViewer} accessibilityRole="button" accessibilityLabel="Close" />
              <View style={[styles.sheetCard, styles.summarySheetCard]}>
                <Text style={styles.sheetTitle}>
                  {language === "es" ? "Visor de documentos" : "Case document viewer"}
                </Text>
                <Text style={styles.sheetSub}>
                  {assetViewerAsset?.fileName ??
                    (language === "es" ? "Archivo seleccionado" : "Selected file")}
                </Text>
                <Text style={styles.sheetModeHint}>
                  {assetViewerAsset
                    ? `${assetViewerAsset.mimeType} | ${language === "es" ? "cargado" : "uploaded"} ${fmtDateTime(assetViewerAsset.createdAt)}`
                    : ""}
                </Text>
                {assetViewerIsPdf ? (
                  <View style={styles.premiumStepActions}>
                    <Pressable
                      style={styles.linkMiniBtn}
                      onPress={() => setAssetViewerPdfPage((value) => Math.max(1, value - 1))}
                    >
                      <Text style={styles.linkMiniText}>{language === "es" ? "Pagina -" : "Page -"}</Text>
                    </Pressable>
                    <Text style={styles.optionDesc}>
                      {language === "es" ? "Pagina" : "Page"} {assetViewerPdfPage}
                    </Text>
                    <Pressable
                      style={styles.linkMiniBtn}
                      onPress={() => setAssetViewerPdfPage((value) => value + 1)}
                    >
                      <Text style={styles.linkMiniText}>{language === "es" ? "Pagina +" : "Page +"}</Text>
                    </Pressable>
                    <Pressable
                      style={styles.linkMiniBtn}
                      onPress={() => setAssetViewerPdfZoom((value) => Math.max(50, value - 25))}
                    >
                      <Text style={styles.linkMiniText}>{language === "es" ? "Zoom -" : "Zoom -"}</Text>
                    </Pressable>
                    <Text style={styles.optionDesc}>{assetViewerPdfZoom}%</Text>
                    <Pressable
                      style={styles.linkMiniBtn}
                      onPress={() => setAssetViewerPdfZoom((value) => Math.min(300, value + 25))}
                    >
                      <Text style={styles.linkMiniText}>{language === "es" ? "Zoom +" : "Zoom +"}</Text>
                    </Pressable>
                  </View>
                ) : assetViewerIsImage ? (
                  <View style={styles.premiumStepActions}>
                    <Pressable
                      style={styles.linkMiniBtn}
                      onPress={() => setAssetViewerImageZoom((value) => clamp(value - 0.25, 1, 4))}
                    >
                      <Text style={styles.linkMiniText}>{language === "es" ? "Zoom -" : "Zoom -"}</Text>
                    </Pressable>
                    <Text style={styles.optionDesc}>{Math.round(assetViewerImageZoom * 100)}%</Text>
                    <Pressable
                      style={styles.linkMiniBtn}
                      onPress={() => setAssetViewerImageZoom((value) => clamp(value + 0.25, 1, 4))}
                    >
                      <Text style={styles.linkMiniText}>{language === "es" ? "Zoom +" : "Zoom +"}</Text>
                    </Pressable>
                    <Pressable
                      style={styles.linkMiniBtn}
                      onPress={() => {
                        setAssetViewerImageZoom(1);
                        setAssetViewerImagePan({ x: 0, y: 0 });
                      }}
                    >
                      <Text style={styles.linkMiniText}>{language === "es" ? "Reiniciar vista" : "Reset view"}</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Text style={styles.optionDesc}>
                    {language === "es"
                      ? "Este formato se abre en el visor web integrado."
                      : "This format opens in the embedded web viewer."}
                  </Text>
                )}
                {assetViewerIsImage ? (
                  <View
                    style={styles.viewerWebWrap}
                    onLayout={(event) => {
                      const nextWidth = Math.max(event.nativeEvent.layout.width, 1);
                      const nextHeight = Math.max(event.nativeEvent.layout.height, 1);
                      setAssetViewerImageBounds((current) => {
                        if (
                          Math.round(current.width) === Math.round(nextWidth) &&
                          Math.round(current.height) === Math.round(nextHeight)
                        ) {
                          return current;
                        }
                        return { width: nextWidth, height: nextHeight };
                      });
                    }}
                    {...assetViewerImagePanResponder.panHandlers}
                  >
                    {assetViewerRenderUrl ? (
                      <View style={styles.viewerImageStage}>
                        <Image
                          source={{ uri: assetViewerRenderUrl }}
                          onLoadStart={() => setAssetViewerLoading(true)}
                          onLoadEnd={() => setAssetViewerLoading(false)}
                          style={[
                            styles.viewerImage,
                            {
                              transform: [
                                { translateX: assetViewerImagePan.x },
                                { translateY: assetViewerImagePan.y },
                                { scale: assetViewerImageZoom }
                              ]
                            }
                          ]}
                          resizeMode="contain"
                        />
                      </View>
                    ) : (
                      <View style={styles.viewerFallbackWrap}>
                        <Text style={styles.summaryBody}>
                          {language === "es"
                            ? "No hay URL de vista disponible para este archivo."
                            : "No viewer URL is available for this file."}
                        </Text>
                      </View>
                    )}
                    {assetViewerLoading ? (
                      <View style={styles.viewerLoaderOverlay}>
                        <ActivityIndicator color={palette.primary} />
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <View style={styles.viewerWebWrap}>
                    {assetViewerRenderUrl ? (
                      <WebView
                        source={{ uri: assetViewerRenderUrl }}
                        onLoadStart={() => setAssetViewerLoading(true)}
                        onLoadEnd={() => setAssetViewerLoading(false)}
                        setBuiltInZoomControls
                        setDisplayZoomControls={false}
                        scalesPageToFit
                      />
                    ) : (
                      <View style={styles.viewerFallbackWrap}>
                        <Text style={styles.summaryBody}>
                          {language === "es"
                            ? "No hay URL de vista disponible para este archivo."
                            : "No viewer URL is available for this file."}
                        </Text>
                      </View>
                    )}
                    {assetViewerLoading ? (
                      <View style={styles.viewerLoaderOverlay}>
                        <ActivityIndicator color={palette.primary} />
                      </View>
                    ) : null}
                  </View>
                )}
                <Text style={styles.sheetModeHint}>
                  {assetViewerIsImage
                    ? language === "es"
                      ? "Zoom y desplazamiento estan disponibles dentro de la app. Si falla la carga, usa abrir externo."
                      : "Zoom and pan are available in-app. If loading fails, use open external."
                    : language === "es"
                      ? "Si su dispositivo no puede renderizar PDF en esta vista, use abrir externo."
                      : "If your device cannot render PDF in this view, use open external."}
                </Text>
                <Pressable onPress={() => void openViewerUrlExternally()} style={styles.sheetActionBtn}>
                  <Feather name="external-link" size={16} color={palette.text} />
                  <Text style={styles.sheetActionText}>
                    {language === "es" ? "Abrir externo (respaldo)" : "Open external (fallback)"}
                  </Text>
                </Pressable>
                <Pressable onPress={closeAssetViewer} style={styles.sheetCancelBtn}>
                  <Text style={styles.sheetCancelText}>{language === "es" ? "Cerrar" : "Close"}</Text>
                </Pressable>
              </View>
            </View>
          </Modal>

          <Modal
            visible={intakeModalOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setIntakeModalOpen(false)}
          >
            <View style={styles.sheetOverlay}>
              <Pressable style={styles.sheetBackdrop} onPress={() => setIntakeModalOpen(false)} accessibilityRole="button" accessibilityLabel="Close" />
              <View style={[styles.sheetCard, styles.summarySheetCard]}>
                <Text style={styles.sheetTitle}>{language === "es" ? "Intake formal de consulta" : "Formal Consultation Intake"}</Text>
                <Text style={styles.sheetSub}>
                  {language === "es"
                    ? "Simula intake profesional para reducir tiempo pagado en consulta."
                    : "Simulate formal intake to reduce paid consultation time."}
                </Text>
                <Text style={styles.sheetModeHint}>
                  {language === "es" ? "Completitud actual" : "Current completeness"}: {intakeCompleteness}% |{" "}
                  {language === "es" ? "Ahorro estimado" : "Estimated savings"}: {costSavingIndicator.low}-{costSavingIndicator.high}m
                </Text>
                <ScrollView style={styles.summaryScroll} contentContainerStyle={styles.summaryScrollBody}>
                  {(
                    [
                      "matterSummary",
                      "clientGoals",
                      "constraints",
                      "timelineNarrative",
                      "partiesAndRoles",
                      "communicationsLog",
                      "financialImpact",
                      "questionsForCounsel",
                      "desiredOutcome"
                    ] as Array<keyof IntakeDraft>
                  ).map((fieldKey) => (
                    <View key={`intake-field-${fieldKey}`} style={styles.intakeFieldBlock}>
                      <Text style={styles.summarySectionTitle}>{intakeSectionLabel(fieldKey)}</Text>
                      <TextInput
                        style={styles.caseContextInput}
                        multiline
                        value={intakeDraft[fieldKey]}
                        onChangeText={(value) =>
                          setIntakeDraft((current) => ({
                            ...current,
                            [fieldKey]: value
                          }))
                        }
                        placeholder={intakePlaceholder(fieldKey)}
                        placeholderTextColor={palette.subtle}
                      />
                    </View>
                  ))}
                </ScrollView>
                <Pressable onPress={() => setIntakeModalOpen(false)} style={styles.sheetActionBtn}>
                  <Feather name="check-circle" size={16} color={palette.text} />
                  <Text style={styles.sheetActionText}>
                    {language === "es" ? "Guardar y volver al caso" : "Save and return to case"}
                  </Text>
                </Pressable>
                <Pressable onPress={() => setIntakeModalOpen(false)} style={styles.sheetCancelBtn}>
                  <Text style={styles.sheetCancelText}>{language === "es" ? "Cerrar" : "Close"}</Text>
                </Pressable>
              </View>
            </View>
          </Modal>

          <Modal
            visible={planSheetOpen}
            transparent
            animationType="slide"
            onRequestClose={() => setPlanSheetOpen(false)}
          >
            <View style={styles.sheetOverlay}>
              <Pressable style={styles.sheetBackdrop} onPress={() => setPlanSheetOpen(false)} accessibilityRole="button" accessibilityLabel="Close" />
              <View style={styles.sheetCard}>
                <Text style={styles.sheetTitle}>
                  {language === "es" ? "Iniciar ClearCase Plus" : "Start ClearCase Plus"}
                </Text>
                <Text style={styles.sheetSub}>
                  {language === "es"
                    ? "Un plan para continuidad: seguir fechas, mantener memoria del caso, entender lenguaje legal y preparar consultas con menos friccion."
                    : "One plan for continuity: track dates, keep case memory, understand legal wording, and prepare faster for consultations."}
                </Text>
                <View style={styles.plusFeatureRow}>
                  <Feather name="calendar" size={14} color={palette.muted} />
                  <Text style={styles.plusFeatureText}>
                    {language === "es" ? "Recordatorios para fechas detectadas" : "Deadline reminders for detected dates"}
                  </Text>
                </View>
                <View style={styles.plusFeatureRow}>
                  <Feather name="clock" size={14} color={palette.muted} />
                  <Text style={styles.plusFeatureText}>
                    {language === "es" ? "Memoria del caso entre cargas" : "Case memory timeline across uploads"}
                  </Text>
                </View>
                <View style={styles.plusFeatureRow}>
                  <Feather name="book-open" size={14} color={palette.muted} />
                  <Text style={styles.plusFeatureText}>
                    {language === "es" ? "Traduccion a significado simple" : "Plain-meaning translation for legal wording"}
                  </Text>
                </View>
                <View style={styles.plusFeatureRow}>
                  <Feather name="file-text" size={14} color={palette.muted} />
                  <Text style={styles.plusFeatureText}>
                    {language === "es"
                      ? "Paquete listo para consulta con referencias"
                      : "Consultation-ready packet with source references"}
                  </Text>
                </View>
                <Text style={styles.plusPlanPrice}>ClearCase Plus: {paywallConfig.plusPriceMonthly}</Text>
                <Text style={styles.sheetModeHint}>
                  {language === "es"
                    ? "ClearCase ofrece claridad legal, no asesoria legal."
                    : "ClearCase provides legal clarity, not legal advice."}
                </Text>
                {plusEnabled ? (
                  <Text style={styles.sheetModeHint}>
                    {language === "es" ? "Plus esta activo." : "Plus is active."}
                  </Text>
                ) : null}
                <Pressable
                  style={styles.sheetActionBtn}
                  onPress={() => void startPlusCheckout("plan_sheet")}
                  disabled={startingCheckout || !paywallConfig.billingEnabled}
                >
                  <Feather name="credit-card" size={16} color={palette.text} />
                  <Text style={styles.sheetActionText}>
                    {startingCheckout
                      ? language === "es"
                        ? "Iniciando..."
                        : "Starting..."
                      : language === "es"
                        ? "Suscribirse"
                        : "Subscribe"}
                  </Text>
                </Pressable>
                <Pressable onPress={() => setPlanSheetOpen(false)} style={styles.sheetCancelBtn}>
                  <Text style={styles.sheetCancelText}>{language === "es" ? "Ahora no" : "Back"}</Text>
                </Pressable>
              </View>
            </View>
          </Modal>

          <Modal
            visible={uploadSheetOpen}
            transparent
            animationType="slide"
            onRequestClose={() => {
              setUploadSheetOpen(false);
              setUploadDescription("");
              setUploadCaseTitle("");
              setUploadTargetCaseId(null);
            }}
          >
            <View style={styles.sheetOverlay}>
              <Pressable
                style={styles.sheetBackdrop}
                onPress={() => {
                  setUploadSheetOpen(false);
                  setUploadDescription("");
                  setUploadCaseTitle("");
                  setUploadTargetCaseId(null);
                }}
              />
              <View style={styles.sheetCard}>
                <Text style={styles.sheetTitle}>Add to case</Text>
                <Text style={styles.sheetSub}>Choose how you want to add documents or photos.</Text>
                <Text style={styles.sheetModeHint}>
                  {uploadTargetCaseId ? "Adding to selected case." : "A new case will be created from this upload."}
                </Text>
                <View style={styles.sheetPrivacyRow}>
                  <Feather name="lock" size={12} color={palette.subtle} />
                  <Text style={styles.sheetPrivacyText}>Private by default. Uploads are processed only for your case insights.</Text>
                </View>
                {!uploadTargetCaseId ? (
                  <TextInput
                    style={styles.sheetCaseNameInput}
                    value={uploadCaseTitle}
                    onChangeText={setUploadCaseTitle}
                    placeholder="Optional case title (rename anytime)"
                    placeholderTextColor={palette.subtle}
                    accessibilityLabel="Case title"
                  />
                ) : null}
                <TextInput
                  style={styles.sheetInput}
                  multiline
                  value={uploadDescription}
                  onChangeText={setUploadDescription}
                  placeholder="Optional: add anything not visible in the document (what happened, when, where)."
                  placeholderTextColor={palette.subtle}
                  accessibilityLabel="Document context description"
                />
                <Pressable onPress={() => void beginFileUpload()} style={styles.sheetActionBtn} accessibilityRole="button" accessibilityLabel="Upload file or image">
                  <Feather name="upload" size={16} color={palette.text} />
                  <Text style={styles.sheetActionText}>Upload file or image</Text>
                </Pressable>
                <Pressable onPress={() => void beginCameraUpload()} style={styles.sheetActionBtn} accessibilityRole="button" accessibilityLabel="Take photos">
                  <Feather name="camera" size={16} color={palette.text} />
                  <Text style={styles.sheetActionText}>Take photos (multi-page)</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setUploadSheetOpen(false);
                    setUploadDescription("");
                    setUploadCaseTitle("");
                    setUploadTargetCaseId(null);
                  }}
                  style={styles.sheetCancelBtn}
                >
                  <Text style={styles.sheetCancelText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </Modal>

          <Modal
            visible={classificationSheetOpen}
            transparent
            animationType="slide"
            onRequestClose={() => setClassificationSheetOpen(false)}
          >
            <View style={styles.sheetOverlay}>
              <Pressable style={styles.sheetBackdrop} onPress={() => setClassificationSheetOpen(false)} accessibilityRole="button" accessibilityLabel="Close" />
              <View style={[styles.sheetCard, styles.categorySheetCard]}>
                <Text style={styles.sheetTitle}>Select category</Text>
                <Text style={styles.sheetSub}>
                  Pick the best match when auto-detection is unclear.
                </Text>
                <ScrollView
                  style={styles.categoryList}
                  contentContainerStyle={styles.categoryListBody}
                  showsVerticalScrollIndicator={false}
                >
                  {manualCategoryOptions.map((option) => {
                    const active = option.value === classificationDraft;
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => setClassificationDraft(option.value)}
                        style={[styles.categoryOption, active ? styles.categoryOptionActive : null]}
                      >
                        <Text style={[styles.categoryOptionText, active ? styles.categoryOptionTextActive : null]}>
                          {option.label}
                        </Text>
                        {active ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <Pressable
                  onPress={() => void saveManualCategoryForSelectedCase()}
                  style={styles.primaryBtn}
                  disabled={savingClassification}
                >
                  <Text style={styles.primaryBtnText}>
                    {savingClassification ? "Saving..." : "Save category"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setClassificationSheetOpen(false)}
                  style={styles.sheetCancelBtn}
                  disabled={savingClassification}
                >
                  <Text style={styles.sheetCancelText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </Modal>

          {drawerOpen ? (
            <View style={styles.drawerOverlay}>
              <Pressable style={styles.drawerBackdrop} onPress={() => setDrawerOpen(false)} />
              <View style={styles.drawerPanel}>
                <View style={styles.drawerHeader}>
                  <View style={styles.brandTinyRow}>
                    <View style={styles.brandTiny}><MaterialCommunityIcons name="scale-balance" size={16} color="#FFFFFF" /></View>
                    <View>
                      <Text style={styles.homeBrand}>ClearCase</Text>
                      <Text style={styles.drawerBrandSub}>{language === "es" ? "Claridad legal" : "Legal Clarity"}</Text>
                    </View>
                  </View>
                  <Pressable onPress={() => setDrawerOpen(false)} style={styles.info}>
                    <Feather name="x" size={16} color={palette.subtle} />
                  </Pressable>
                </View>
                <Text style={styles.drawerSectionTitle}>{language === "es" ? "Evaluaciones" : "Assessments"}</Text>
                <Pressable onPress={() => { setScreen("home"); setDrawerOpen(false); }} style={styles.drawerItem}><Text style={styles.drawerItemText}>{language === "es" ? "Panel" : "Dashboard"}</Text></Pressable>
                <Pressable onPress={() => { setScreen("cases"); setDrawerOpen(false); }} style={styles.drawerItem}><Text style={styles.drawerItemText}>{language === "es" ? "Casos activos" : "Active Cases"}</Text></Pressable>
                <Pressable onPress={() => { setScreen("workspace"); setDrawerOpen(false); }} style={styles.drawerItem}><Text style={styles.drawerItemText}>{language === "es" ? "Espacio de trabajo" : "Workspace"}</Text></Pressable>
                <Text style={styles.drawerSectionTitle}>{language === "es" ? "Herramientas" : "Tools"}</Text>
                <Pressable onPress={() => { setScreen("legalAid"); setDrawerOpen(false); }} style={styles.drawerItem}><Text style={styles.drawerItemText}>{language === "es" ? "Buscar ayuda legal" : "Find Legal Aid"}</Text></Pressable>
                <Pressable onPress={() => { setSelectedTemplate(null); setScreen("drafting"); setDrawerOpen(false); }} style={styles.drawerItem}><Text style={styles.drawerItemText}>{language === "es" ? "Asistente de redaccion" : "Drafting Assistant"}</Text></Pressable>
                <Text style={styles.drawerSectionTitle}>{language === "es" ? "Cuenta" : "Account"}</Text>
                <Pressable onPress={() => { setScreen("account"); setDrawerOpen(false); }} style={styles.drawerItem}><Text style={styles.drawerItemText}>{language === "es" ? "Configuracion" : "Settings"}</Text></Pressable>
                <Pressable
                  onPress={() => {
                    setLegalReturnScreen(screen);
                    setDrawerOpen(false);
                    setScreen("legal");
                  }}
                  style={styles.drawerItem}
                >
                  <Text style={styles.drawerItemText}>{language === "es" ? "Aviso legal" : "Legal notice"}</Text>
                </Pressable>
                <Text style={styles.drawerSectionTitle}>{language === "es" ? "Casos recientes" : "Recent Cases"}</Text>
                {(cases.slice(0, 2).length ? cases.slice(0, 2) : [latestCase].filter(Boolean)).map((row) => (
                  <Pressable
                    key={row ? row.id : "no-case"}
                    onPress={() => {
                      if (!row) return;
                      setSelectedCaseId(row.id);
                      setScreen("workspace");
                      setDrawerOpen(false);
                    }}
                    style={styles.drawerItem}
                  >
                    <Text style={styles.drawerItemText}>
                      {row ? row.title ?? (language === "es" ? "Caso sin titulo" : "Untitled case") : language === "es" ? "Aun no hay casos" : "No cases yet"}
                    </Text>
                  </Pressable>
                ))}
                <View style={styles.drawerBottom}>
                  <Pressable
                    onPress={() => {
                      setDrawerOpen(false);
                      void openUploadSheetForCase(null);
                    }}
                    style={styles.drawerItem}
                  >
                    <Text style={styles.drawerItemText}>{language === "es" ? "Subir ahora" : "Upload now"}</Text>
                  </Pressable>
                  <Pressable onPress={() => { setDrawerOpen(false); void signOut(); }} style={styles.drawerItem}>
                    <Text style={styles.drawerDangerText}>{language === "es" ? "Cerrar sesion" : "Sign out"}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  fill: { flex: 1 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: palette.bg },
  loadingText: { marginTop: 8, color: palette.muted, fontFamily: font.medium },
  banner: { marginHorizontal: 16, marginTop: 10, marginBottom: 2, borderWidth: 1, borderColor: palette.line, borderRadius: 16, backgroundColor: palette.surfaceSoft, padding: 12 },
  bannerGood: { backgroundColor: palette.greenSoft, borderColor: "#BBF7D0" },
  bannerBad: { backgroundColor: palette.redSoft, borderColor: "#FECACA" },
  bannerText: { color: palette.text, fontFamily: font.medium, fontSize: 12 },
  screen: { flex: 1, backgroundColor: palette.bg, paddingHorizontal: 20, paddingTop: 8 },
  screenSoft: { flex: 1, backgroundColor: palette.surfaceSoft },
  rowTopRight: { alignItems: "flex-end", marginTop: 8 },
  rowTopLeft: { alignItems: "flex-start", marginTop: 4 },
  skip: { color: palette.subtle, fontFamily: font.semibold, fontSize: 13 },
  centerWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  onboardingCard: { width: "100%", borderRadius: 32, borderWidth: 1, borderColor: palette.line, paddingVertical: 32, paddingHorizontal: 24, shadowColor: "#0F172A", shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  slideStepper: { color: palette.subtle, fontFamily: font.bold, fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 },
  centerWrapSmall: { alignItems: "center", marginBottom: 8 },
  brandPill: { width: 96, height: 96, borderRadius: 32, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  heroTitle: { color: palette.text, fontFamily: font.bold, fontSize: 28, textAlign: "center", lineHeight: 34, marginBottom: 8, letterSpacing: -0.5 },
  heroCopy: { color: palette.muted, fontFamily: font.regular, fontSize: 16, lineHeight: 24, textAlign: "center", paddingHorizontal: 16 },
  bottomNav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 18 },
  circle: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: palette.line, alignItems: "center", justifyContent: "center" },
  invisible: { opacity: 0 },
  circleDark: { width: 46, height: 46, borderRadius: 23, backgroundColor: palette.primary, alignItems: "center", justifyContent: "center" },
  dots: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#CBD5E1" },
  dotActive: { width: 24, backgroundColor: palette.primary },
  brandRow: { flexDirection: "row", alignItems: "center", marginBottom: 30 },
  brandMark: { width: 44, height: 44, borderRadius: 14, backgroundColor: palette.primary, alignItems: "center", justifyContent: "center", marginRight: 10 },
  brandText: { color: palette.text, fontFamily: font.bold, fontSize: 38 },
  welcomeMuted: { color: palette.subtle, fontFamily: font.medium, fontSize: 20, marginBottom: 8 },
  authSelectionBody: { flex: 1, justifyContent: "center", alignItems: "center", width: "100%" },
  authSelectionHero: { width: "100%", borderRadius: 32, borderWidth: 1, borderColor: palette.line, paddingVertical: 32, paddingHorizontal: 24, marginBottom: 16, alignItems: "center", shadowColor: "#0F172A", shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  authSelectionActions: { width: "100%", maxWidth: 320 },
  authFooter: {
    paddingTop: 14,
    paddingBottom: 20,
    alignItems: "center"
  },
  authFooterBrand: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  authFooterBrandText: { color: "#A6B0C1", fontFamily: font.bold, fontSize: 10, letterSpacing: 1.8, marginLeft: 6 },
  authFooterLinks: { flexDirection: "row", alignItems: "center" },
  authFooterLink: { color: palette.subtle, fontFamily: font.medium, fontSize: 12 },
  authFooterDivider: { color: "#CBD5E1", marginHorizontal: 10 },
  scrollScreen: { flex: 1, backgroundColor: palette.bg },
  scrollBody: { paddingHorizontal: 20, paddingBottom: 20 },
  back: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  formTitle: { color: palette.text, fontFamily: font.bold, fontSize: 34, marginBottom: 8 },
  formSubtitle: { color: palette.muted, fontFamily: font.regular, fontSize: 15, lineHeight: 21, marginBottom: 14 },
  subtleCenterText: { color: palette.subtle, fontFamily: font.regular, fontSize: 12, lineHeight: 17, textAlign: "center", marginTop: 8, marginBottom: 2 },
  formTitleSmall: { color: palette.text, fontFamily: font.bold, fontSize: 20 },
  workspaceTitleWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  buildStamp: {
    color: palette.subtle,
    fontFamily: font.regular,
    fontSize: 10
  },
  devBadge: {
    color: "#0369A1",
    backgroundColor: "#E0F2FE",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    fontFamily: font.bold,
    fontSize: 10
  },
  offlinePill: {
    color: "#B45309",
    backgroundColor: "#FEF3C7",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    fontFamily: font.bold,
    fontSize: 10
  },
  sub: { color: palette.muted, fontFamily: font.regular, fontSize: 13, marginBottom: 10, paddingHorizontal: 20 },
  accountTypeRow: { flexDirection: "row", gap: 22, marginBottom: 16, paddingHorizontal: 2 },
  accountTypeItem: { flexDirection: "row", alignItems: "center" },
  accountTypeMuted: { opacity: 0.45 },
  accountTypeText: { color: palette.muted, fontFamily: font.medium, fontSize: 13, marginLeft: 8 },
  radioActiveOuter: { width: 18, height: 18, borderRadius: 10, borderWidth: 2, borderColor: "#CBD5E1", alignItems: "center", justifyContent: "center" },
  radioActiveInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.primary },
  radioInactiveOuter: { width: 18, height: 18, borderRadius: 10, borderWidth: 2, borderColor: "#CBD5E1" },
  fieldLabel: { color: palette.subtle, fontFamily: font.bold, fontSize: 10, letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 4 },
  input: { borderWidth: 1, borderColor: palette.line, borderRadius: 20, backgroundColor: palette.surfaceSoft, paddingHorizontal: 16, paddingVertical: 14, color: palette.text, fontFamily: font.regular, fontSize: 14, marginBottom: 8 },
  primaryBtn: { borderRadius: 24, backgroundColor: palette.primary, paddingVertical: 16, alignItems: "center", justifyContent: "center", marginTop: 4, shadowColor: "#0F172A", shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  primaryBtnText: { color: "#FFFFFF", fontFamily: font.bold, fontSize: 15 },
  outlineBtn: { borderRadius: 24, borderWidth: 2, borderColor: palette.primary, paddingVertical: 16, alignItems: "center", justifyContent: "center", marginTop: 8, width: "100%" },
  outlineBtnText: { color: palette.primary, fontFamily: font.bold, fontSize: 15 },
  disclaimerScreen: { flex: 1, backgroundColor: palette.bg },
  disclaimerHeaderRow: { flexDirection: "row", alignItems: "center", marginBottom: 12, marginTop: 8 },
  disclaimerShield: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#E2E8F0", alignItems: "center", justifyContent: "center", marginRight: 10 },
  disclaimerTitle: { color: palette.text, fontFamily: font.bold, fontSize: 30, marginBottom: 0, flex: 1, lineHeight: 34 },
  disclaimerP: { color: palette.muted, fontFamily: font.regular, fontSize: 14, lineHeight: 20, marginBottom: 8 },
  disclaimerCard: { backgroundColor: palette.surface, borderRadius: 24, borderWidth: 1, borderColor: palette.line, padding: 20, marginTop: 10 },
  disclaimerBulletRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 6 },
  disclaimerBulletDot: { width: 6, height: 6, borderRadius: 4, backgroundColor: "#94A3B8", marginTop: 7, marginRight: 8 },
  disclaimerBackText: { color: "#CBD5E1", fontFamily: font.medium, fontSize: 13 },
  card: { backgroundColor: palette.surface, borderRadius: 24, borderWidth: 1, borderColor: "#F1F5F9", padding: 18, marginBottom: 12, shadowColor: "#0F172A", shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  cardTitle: { color: palette.text, fontFamily: font.bold, fontSize: 16, marginBottom: 6 },
  cardTitleBig: { color: palette.text, fontFamily: font.bold, fontSize: 26, textAlign: "center", lineHeight: 31 },
  cardBody: { color: palette.muted, fontFamily: font.regular, fontSize: 13, lineHeight: 19, marginBottom: 4 },
  miniLabel: { color: palette.subtle, fontFamily: font.bold, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 6 },
  link: { alignItems: "center", marginTop: 8 },
  linkText: { color: palette.primary, fontFamily: font.medium, fontSize: 13 },
  homeHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  homeHeadCenter: { flex: 1, marginHorizontal: 8 },
  brandTinyRow: { flexDirection: "row", alignItems: "center" },
  brandTiny: { width: 28, height: 28, borderRadius: 9, backgroundColor: palette.primary, alignItems: "center", justifyContent: "center", marginRight: 8 },
  homeBrand: { color: palette.text, fontFamily: font.bold, fontSize: 22 },
  homeTagline: { color: palette.muted, fontFamily: font.regular, fontSize: 12, marginTop: 2 },
  offlineBadge: {
    marginTop: 5,
    alignSelf: "flex-start",
    color: "#B45309",
    backgroundColor: "#FEF3C7",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontFamily: font.bold,
    fontSize: 10
  },
  info: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" },
  homeBody: { paddingBottom: 20, flexGrow: 1 },
  homeHeroCard: { borderRadius: 32, padding: 24, marginBottom: 12, shadowColor: "#0F172A", shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  miniLabelLight: { color: "#CBD5E1", fontFamily: font.bold, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 6 },
  homeHeroTitle: { color: "#FFFFFF", fontFamily: font.bold, fontSize: 31, lineHeight: 36, marginBottom: 8 },
  homeHeroCopy: { color: "#E2E8F0", fontFamily: font.regular, fontSize: 14, lineHeight: 20 },
  uploadStatusPill: { marginTop: 12, marginBottom: 10, alignSelf: "flex-start", borderRadius: 999, borderWidth: 1, borderColor: "#334155", backgroundColor: "#0B1220", paddingHorizontal: 10, paddingVertical: 5, flexDirection: "row", alignItems: "center" },
  uploadStatusText: { color: "#E2E8F0", fontFamily: font.medium, fontSize: 12 },
  heroPrivacyRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  heroPrivacyText: { flex: 1, color: "#CBD5E1", fontFamily: font.regular, fontSize: 11, lineHeight: 15 },
  heroPrimaryBtn: { marginTop: 2, backgroundColor: "#111827" },
  homeTitle: { color: "#334155", fontFamily: font.regular, fontSize: 34, lineHeight: 40, marginBottom: 14 },
  homeStrong: { color: palette.text, fontFamily: font.semibold },
  imageWrap: { width: "100%", aspectRatio: 16 / 9, borderRadius: 24, overflow: "hidden", marginBottom: 12, borderWidth: 1, borderColor: palette.line },
  image: { width: "100%", height: "100%" },
  ctaInline: { flexDirection: "row", alignItems: "center", gap: 8 },
  outlineSoftBtn: { borderRadius: 24, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, paddingVertical: 14, alignItems: "center", justifyContent: "center", marginTop: 8 },
  outlineSoftText: { color: palette.muted, fontFamily: font.bold, fontSize: 14 },
  legal: { color: palette.subtle, fontFamily: font.regular, fontSize: 11, lineHeight: 16, textAlign: "center", marginTop: 10 },
  legalInline: { color: palette.subtle, fontFamily: font.regular, fontSize: 11, lineHeight: 16, marginTop: 4 },
  uploadStateRow: { flexDirection: "row", alignItems: "center", marginTop: 4, marginBottom: 6 },
  subtleNote: { color: palette.subtle, fontFamily: font.regular, fontSize: 12, lineHeight: 17, marginTop: 7 },
  intakeTitle: { color: palette.text, fontFamily: font.medium, fontSize: 33, marginBottom: 6, marginLeft: 4 },
  intakeSub: { color: palette.muted, fontFamily: font.regular, fontSize: 14, marginBottom: 12, marginLeft: 4 },
  intakeList: { paddingHorizontal: 4, paddingBottom: 10 },
  intakeFooter: { paddingVertical: 16, alignItems: "center" },
  intakeFooterText: { color: palette.subtle, fontFamily: font.regular, fontSize: 12, fontStyle: "italic" },
  option: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    backgroundColor: palette.surface,
    padding: 18,
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
    shadowColor: "#0F172A",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
  },
  optionIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: palette.surfaceSoft, alignItems: "center", justifyContent: "center", marginRight: 12 },
  optionText: { flex: 1 },
  optionTitle: { color: palette.text, fontFamily: font.semibold, fontSize: 15, marginBottom: 2 },
  optionDesc: { color: palette.muted, fontFamily: font.regular, fontSize: 12, lineHeight: 17 },
  verdictHead: { backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  verdictTopLabel: { color: palette.subtle, fontFamily: font.medium, fontSize: 12 },
  verdictBody: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  spacer: { width: 34 },
  resultIcon: { width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  resultWarn: { backgroundColor: palette.amberSoft },
  resultGood: { backgroundColor: palette.greenSoft },
  metricRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  metricCard: { flex: 1, borderWidth: 1, borderRadius: 20, padding: 12 },
  metricRiskHigh: { backgroundColor: "#FEE2E2", borderColor: "#FECACA" },
  metricRiskMedium: { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" },
  metricRiskLow: { backgroundColor: "#DCFCE7", borderColor: "#BBF7D0" },
  metricCardNeutral: { flex: 1, borderWidth: 1, borderColor: palette.line, borderRadius: 20, padding: 12, backgroundColor: palette.surfaceSoft },
  metricLabel: { color: palette.subtle, fontFamily: font.bold, fontSize: 9, textTransform: "uppercase", letterSpacing: 1.05, marginBottom: 4 },
  metricValue: { color: palette.text, fontFamily: font.semibold, fontSize: 18 },
  metricTimeRow: { flexDirection: "row", alignItems: "center" },
  metricTimeText: { color: palette.muted, fontFamily: font.semibold, fontSize: 11, marginLeft: 5, flex: 1 },
  stepRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  stepDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center", marginRight: 10, marginTop: 2 },
  stepDotText: { color: palette.muted, fontFamily: font.bold, fontSize: 10 },
  stepText: { color: palette.muted, fontFamily: font.regular, fontSize: 13, lineHeight: 19, flex: 1 },
  verdictFooter: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 6 },
  verdictFooterText: { color: palette.subtle, fontFamily: font.medium, fontSize: 10, marginRight: 5 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  row: { flexDirection: "row", alignItems: "center" },
  dotStatus: { width: 9, height: 9, borderRadius: 99, backgroundColor: "#CBD5E1", marginRight: 6 },
  dotGood: { backgroundColor: palette.green },
  dotBad: { backgroundColor: "#B91C1C" },
  caseRow: { borderRadius: 20, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, padding: 14, marginTop: 8 },
  caseRowActive: { borderColor: "#64748B", backgroundColor: "#F1F5F9" },
  bottomTabs: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: palette.line,
    backgroundColor: palette.surface
  },
  bottomTabItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, paddingVertical: 4 },
  bottomTabLabel: { color: palette.subtle, fontFamily: font.bold, fontSize: 10 },
  bottomTabLabelActive: { color: palette.text },
  bottomUploadFab: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -20,
    borderWidth: 4,
    borderColor: palette.surface,
    shadowColor: "#0F172A",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end"
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.55)"
  },
  sheetCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    gap: 10,
    shadowColor: "#0F172A",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 8
  },
  sheetTitle: {
    color: palette.text,
    fontFamily: font.bold,
    fontSize: 20
  },
  sheetSub: {
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 12,
    marginBottom: 6
  },
  sheetModeHint: {
    color: "#334155",
    fontFamily: font.medium,
    fontSize: 12,
    marginBottom: 2
  },
  sheetPrivacyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6
  },
  sheetPrivacyText: {
    flex: 1,
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 16
  },
  sheetCaseNameInput: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: palette.text,
    fontFamily: font.medium,
    fontSize: 14
  },
  sheetInput: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 76,
    color: palette.text,
    fontFamily: font.regular,
    fontSize: 14,
    textAlignVertical: "top"
  },
  sheetActionBtn: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  sheetActionText: {
    color: palette.text,
    fontFamily: font.semibold,
    fontSize: 14
  },
  sheetCancelBtn: {
    marginTop: 6,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    paddingVertical: 14,
    alignItems: "center"
  },
  sheetCancelText: {
    color: palette.muted,
    fontFamily: font.semibold,
    fontSize: 13
  },
  categorySheetCard: {
    maxHeight: "78%"
  },
  summarySheetCard: {
    maxHeight: "88%"
  },
  summaryScroll: {
    maxHeight: 360
  },
  summaryScrollBody: {
    paddingBottom: 8
  },
  viewerWebWrap: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    minHeight: 340,
    overflow: "hidden"
  },
  viewerImageStage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  viewerImage: {
    width: "100%",
    height: "100%"
  },
  viewerFallbackWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16
  },
  viewerLoaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.7)"
  },
  summaryCaseTitle: {
    color: palette.text,
    fontFamily: font.semibold,
    fontSize: 16,
    marginBottom: 6
  },
  summarySectionTitle: {
    color: palette.text,
    fontFamily: font.bold,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 10,
    marginBottom: 4
  },
  summaryBody: {
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 18
  },
  summaryBulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginBottom: 4
  },
  summaryBulletDot: {
    color: palette.subtle,
    fontFamily: font.bold,
    fontSize: 12,
    width: 10,
    marginTop: 1
  },
  summaryBulletText: {
    flex: 1,
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 17
  },
  summaryDisclaimer: {
    marginTop: 10,
    color: palette.subtle,
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 16
  },
  summaryLoader: {
    marginVertical: 8
  },
  consultLinkRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    padding: 10,
    marginTop: 6
  },
  consultLinkMain: {
    marginBottom: 6
  },
  consultLinkTitle: {
    color: palette.text,
    fontFamily: font.semibold,
    fontSize: 12
  },
  consultLinkMeta: {
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 11,
    marginTop: 2
  },
  consultLinkActions: {
    flexDirection: "row",
    gap: 8
  },
  linkMiniBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  linkMiniText: {
    color: "#334155",
    fontFamily: font.semibold,
    fontSize: 11
  },
  categoryList: {
    maxHeight: 340
  },
  categoryListBody: {
    paddingBottom: 8
  },
  categoryOption: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  categoryOptionActive: {
    borderColor: "#0F172A",
    backgroundColor: "#0F172A"
  },
  categoryOptionText: {
    color: palette.text,
    fontFamily: font.medium,
    fontSize: 13
  },
  categoryOptionTextActive: {
    color: "#FFFFFF",
    fontFamily: font.semibold
  },
  drawerOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    justifyContent: "flex-start"
  },
  drawerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.45)"
  },
  drawerPanel: {
    width: "82%",
    height: "100%",
    backgroundColor: palette.surface,
    paddingTop: 20,
    paddingHorizontal: 16,
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
    shadowColor: "#0F172A",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 4, height: 0 },
    elevation: 8
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14
  },
  drawerItem: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 6
  },
  drawerItemText: {
    color: palette.text,
    fontFamily: font.semibold,
    fontSize: 14
  },
  drawerBrandSub: {
    color: palette.subtle,
    fontFamily: font.bold,
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1.2
  },
  drawerSectionTitle: {
    color: palette.subtle,
    fontFamily: font.bold,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    marginTop: 6,
    marginBottom: 6
  },
  drawerBottom: {
    marginTop: "auto"
  },
  drawerDangerText: {
    color: "#B91C1C",
    fontFamily: font.semibold,
    fontSize: 14
  },
  proPromptCard: {
    marginTop: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    padding: 14,
    flexDirection: "row",
    gap: 10
  },
  proPromptIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center"
  },
  proPromptBody: {
    flex: 1
  },
  proPromptTitle: {
    color: palette.text,
    fontFamily: font.semibold,
    fontSize: 13,
    marginBottom: 2
  },
  proPromptCopy: {
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 6
  },
  proPromptLink: {
    color: "#2563EB",
    fontFamily: font.bold,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.9
  },
  waitlistHeader: {
    marginBottom: 10
  },
  waitlistIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10
  },
  waitlistTitle: {
    color: palette.text,
    fontFamily: font.display,
    fontSize: 34,
    lineHeight: 38,
    marginBottom: 6
  },
  waitlistCopy: {
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8
  },
  waitlistBtn: {
    marginTop: 10
  },
  waitlistSuccess: {
    marginTop: 12,
    backgroundColor: "#F0FDF4",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#DCFCE7",
    padding: 16
  },
  waitlistSuccessIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8
  },
  waitlistSuccessTitle: {
    color: "#14532D",
    fontFamily: font.bold,
    fontSize: 17,
    marginBottom: 4
  },
  waitlistSuccessCopy: {
    color: "#166534",
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10
  },
  homeDashboardContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20
  },
  homeDashboardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10
  },
  homeDashboardTitleWrap: {
    flex: 1,
    marginHorizontal: 10
  },
  dashboardTitle: {
    color: palette.text,
    fontFamily: font.displaySemibold,
    fontSize: 32,
    lineHeight: 36
  },
  dashboardSubtitle: {
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 13
  },
  avatarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center"
  },
  avatarButtonText: {
    color: palette.muted,
    fontFamily: font.bold,
    fontSize: 11
  },
  searchBar: {
    marginTop: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  searchInput: {
    flex: 1,
    color: palette.text,
    fontFamily: font.regular,
    fontSize: 13
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 8
  },
  sectionTitle: {
    color: palette.text,
    fontFamily: font.bold,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.2
  },
  sectionAction: {
    color: palette.subtle,
    fontFamily: font.bold,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.1
  },
  caseContextHint: {
    color: palette.subtle,
    fontFamily: font.bold,
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1
  },
  caseContextHelper: {
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8
  },
  caseContextInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 80,
    color: palette.text,
    fontFamily: font.regular,
    fontSize: 13,
    textAlignVertical: "top"
  },
  dashboardCaseCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 24,
    padding: 18,
    marginBottom: 10,
    shadowColor: "#0F172A",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
  },
  dashboardCaseTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8
  },
  caseMetaText: {
    color: palette.subtle,
    fontFamily: font.bold,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.2
  },
  priorityChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4
  },
  priorityChipHigh: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA"
  },
  priorityChipMedium: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FDE68A"
  },
  priorityChipLow: {
    backgroundColor: "#ECFDF5",
    borderColor: "#BBF7D0"
  },
  priorityChipText: {
    color: palette.text,
    fontFamily: font.bold,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.9
  },
  dashboardCaseTitle: {
    color: palette.text,
    fontFamily: font.semibold,
    fontSize: 18,
    lineHeight: 22,
    marginBottom: 2
  },
  dashboardCaseSubtitle: {
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 12
  },
  tipsGrid: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6
  },
  tipCard: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    padding: 16,
    shadowColor: "#0F172A",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
  },
  tipIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8
  },
  tipIconGreen: {
    backgroundColor: "#ECFDF5"
  },
  tipIconBlue: {
    backgroundColor: "#EFF6FF"
  },
  tipIconAmber: {
    backgroundColor: "#FEF3C7"
  },
  tipTitle: {
    color: palette.text,
    fontFamily: font.semibold,
    fontSize: 12,
    marginBottom: 2
  },
  tipCopy: {
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 14
  },
  workspacePrimaryCard: {
    borderLeftWidth: 4
  },
  workspacePrimaryHigh: {
    borderLeftColor: "#DC2626"
  },
  workspacePrimaryMedium: {
    borderLeftColor: "#D97706"
  },
  workspacePrimaryLow: {
    borderLeftColor: "#16A34A"
  },
  workspacePillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8
  },
  workspaceCaseTitle: {
    color: palette.text,
    fontFamily: font.semibold,
    fontSize: 22,
    lineHeight: 28,
    marginBottom: 4
  },
  workspaceCaseMeta: {
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 12,
    marginBottom: 8
  },
  workspaceMetricsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10
  },
  workspaceMetricCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 10
  },
  metricValueSm: {
    color: palette.text,
    fontFamily: font.semibold,
    fontSize: 14
  },
  autoBadge: {
    color: "#047857",
    backgroundColor: "#ECFDF5",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontFamily: font.bold,
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1
  },
  actionPlanCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14
  },
  workspaceAccordionBar: {
    borderWidth: 2,
    borderColor: "#93C5FD",
    backgroundColor: "#EFF6FF",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10
  },
  workspaceAccordionTitle: {
    color: palette.text,
    fontFamily: font.bold,
    fontSize: 15
  },
  workspaceAccordionMetaWrap: {
    flexDirection: "row",
    alignItems: "center"
  },
  workspaceAccordionMeta: {
    color: "#1E3A8A",
    fontFamily: font.medium,
    fontSize: 12,
    letterSpacing: 0.3,
    marginRight: 6
  },
  actionPlanHigh: {
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2"
  },
  actionPlanMedium: {
    borderColor: "#FDE68A",
    backgroundColor: "#FFFBEB"
  },
  actionPlanLow: {
    borderColor: "#BBF7D0",
    backgroundColor: "#F0FDF4"
  },
  actionPlanSubhead: {
    color: "#334155",
    fontFamily: font.medium,
    fontSize: 12,
    marginBottom: 8
  },
  plusPreviewCard: {
    borderColor: "#BFDBFE",
    backgroundColor: "#F8FAFC"
  },
  plusActiveCard: {
    borderColor: "#BBF7D0",
    backgroundColor: "#F0FDF4"
  },
  plusLockedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "#E2E8F0"
  },
  plusLockedPillText: {
    color: "#334155",
    fontFamily: font.bold,
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  plusLivePill: {
    borderRadius: 999,
    backgroundColor: "#166534",
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  plusLivePillText: {
    color: "#FFFFFF",
    fontFamily: font.bold,
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  plusFeatureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 6
  },
  plusFeatureText: {
    flex: 1,
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 17
  },
  plusLockedActionRow: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    padding: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8
  },
  plusLockedActionTextWrap: {
    flex: 1
  },
  plusLockedActionTitle: {
    color: palette.text,
    fontFamily: font.semibold,
    fontSize: 12,
    marginBottom: 2
  },
  plusLockedActionBody: {
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 16
  },
  premiumStepRow: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DCFCE7",
    backgroundColor: "#F8FFF8",
    padding: 10
  },
  premiumStepTitle: {
    color: palette.text,
    fontFamily: font.semibold,
    fontSize: 12,
    marginBottom: 3
  },
  premiumStepBody: {
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 16
  },
  premiumStepActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8
  },
  intakeFieldBlock: {
    marginBottom: 8
  },
  receiptRow: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    backgroundColor: "#FFFFFF",
    padding: 10
  },
  receiptTitle: {
    color: palette.text,
    fontFamily: font.semibold,
    fontSize: 12,
    marginBottom: 2
  },
  receiptSub: {
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 16
  },
  severityBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  severityBadgeHigh: {
    backgroundColor: "#DC2626"
  },
  severityBadgeMedium: {
    backgroundColor: "#D97706"
  },
  severityBadgeLow: {
    backgroundColor: "#16A34A"
  },
  severityBadgeText: {
    color: "#FFFFFF",
    fontFamily: font.bold,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  checklistRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 8,
    width: "100%"
  },
  checklistDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1
  },
  checklistDotHigh: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FCA5A5"
  },
  checklistDotMedium: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FCD34D"
  },
  checklistDotLow: {
    backgroundColor: "#DCFCE7",
    borderColor: "#86EFAC"
  },
  checklistText: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    color: palette.text,
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 19
  },
  casesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    marginTop: 2
  },
  casesHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  casesHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  casesAddBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    marginBottom: 10
  },
  filterPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  filterPillActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary
  },
  filterPillText: {
    color: palette.muted,
    fontFamily: font.bold,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1
  },
  filterPillTextActive: {
    color: "#FFFFFF"
  },
  accountHeaderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    marginBottom: 10
  },
  accountHeaderTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12
  },
  accountHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  accountProfileRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  accountAvatar: {
    width: 80,
    height: 80,
    borderRadius: 28,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14
  },
  accountAvatarText: {
    color: "#FFFFFF",
    fontFamily: font.bold,
    fontSize: 24
  },
  accountIdentity: {
    flex: 1
  },
  accountName: {
    color: palette.text,
    fontFamily: font.semibold,
    fontSize: 18,
    marginBottom: 2
  },
  accountMeta: {
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 12
  },
  accountPlanCard: {
    backgroundColor: palette.primary,
    borderColor: palette.primary
  },
  planLabel: {
    color: "#94A3B8",
    fontFamily: font.bold,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.1
  },
  planTitle: {
    color: "#FFFFFF",
    fontFamily: font.bold,
    fontSize: 18,
    marginBottom: 8
  },
  planTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8
  },
  planTierPill: {
    borderRadius: 999,
    backgroundColor: "#334155",
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  planTierPillText: {
    color: "#E2E8F0",
    fontFamily: font.bold,
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  planBody: {
    color: "#E2E8F0",
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 6
  },
  planBodyMuted: {
    color: "#CBD5E1",
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 4
  },
  accountUpgradeBtn: {
    alignSelf: "flex-start",
    borderRadius: 10,
    backgroundColor: "#334155",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  accountUpgradeBtnText: {
    color: "#FFFFFF",
    fontFamily: font.semibold,
    fontSize: 11
  },
  plusPlanOption: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    padding: 12,
    marginBottom: 6
  },
  plusPlanTitle: {
    color: palette.text,
    fontFamily: font.semibold,
    fontSize: 14
  },
  plusPlanPrice: {
    color: "#166534",
    fontFamily: font.bold,
    fontSize: 12,
    marginTop: 2
  },
  plusPlanCopy: {
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
    marginBottom: 8
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F1F5F9",
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 6,
    gap: 10
  },
  languageToggleRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 6
  },
  languageTogglePill: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8
  },
  languageTogglePillActive: {
    borderColor: palette.primary,
    backgroundColor: palette.primary
  },
  languageToggleText: {
    color: palette.muted,
    fontFamily: font.semibold,
    fontSize: 12
  },
  languageToggleTextActive: {
    color: "#FFFFFF"
  },
  settingText: {
    flex: 1,
    color: palette.text,
    fontFamily: font.semibold,
    fontSize: 13
  },
  proCard: {
    borderColor: "#BFDBFE",
    backgroundColor: "#F8FAFC"
  },
  accountSignOutBtn: {
    marginBottom: 24
  },
  bottomDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.primary,
    marginTop: 2
  }
});

export default SENTRY_DSN ? Sentry.wrap(App) : App;
