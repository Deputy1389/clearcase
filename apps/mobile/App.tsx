
import { StatusBar } from "expo-status-bar";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
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
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  NativeModules,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import {
  type ApiError,
  type AuthHeaders,
  type CaseDetail,
  type CaseSummary,
  type ManualDocumentType,
  type MeResponse,
  MANUAL_DOCUMENT_TYPES,
  createAssetUploadPlan,
  createCase,
  finalizeAssetUpload,
  getCaseById,
  getCases,
  getHealth,
  getMe,
  patchMe,
  setCaseClassification,
  saveCaseContext
} from "./src/api";

type Screen = "onboarding" | "auth" | "home" | "workspace" | "cases" | "account" | "legal";
type AuthMode = "selection" | "login" | "signup" | "disclaimer" | "waitlist";
type BannerTone = "info" | "good" | "bad";
type ConnStatus = "unknown" | "ok" | "error";
type UploadStage = "idle" | "picking" | "preparing" | "sending" | "processing";
type CaseSeverity = "high" | "medium" | "low";

type OnboardingSlide = {
  title: string;
  description: string;
  icon: "scale" | "search" | "book-open" | "shield";
  iconColor: string;
  iconBg: string;
};

const DEFAULT_SUBJECT = "dev-subject-0001";
const DEFAULT_EMAIL = "dev+dev-subject-0001@clearcase.local";
const ENV_API_BASE = process.env.EXPO_PUBLIC_API_BASE?.trim() || null;

function extractMetroHost(): string | null {
  const scriptUrl = (NativeModules as { SourceCode?: { scriptURL?: string } }).SourceCode?.scriptURL;
  if (!scriptUrl) return null;
  const match = scriptUrl.match(/^https?:\/\/([^/:]+)(?::\d+)?\//i);
  return match?.[1] ?? null;
}

function isLoopbackHost(host: string): boolean {
  return host === "127.0.0.1" || host === "localhost" || host === "10.0.2.2";
}

function isPrivateIpv4Host(host: string): boolean {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return false;
  const parts = host.split(".").map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false;
  if (parts[0] === 10) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  return false;
}

function isLoopbackApiBase(base: string): boolean {
  return /:\/\/(127\.0\.0\.1|localhost|10\.0\.2\.2)(:\d+)?$/i.test(base.trim());
}

function extractHostFromApiBase(base: string): string | null {
  const match = base.trim().match(/^https?:\/\/([^/:?#]+)(?::\d+)?/i);
  return match?.[1] ?? null;
}

function isLocalApiBase(base: string): boolean {
  const host = extractHostFromApiBase(base);
  if (!host) return false;
  return isLoopbackHost(host) || isPrivateIpv4Host(host);
}

function resolveDefaultApiBase(): string {
  if (ENV_API_BASE) return ENV_API_BASE;
  const metroHost = extractMetroHost();
  if (metroHost && isPrivateIpv4Host(metroHost)) {
    return `http://${metroHost}:3001`;
  }
  return (
    Platform.select({
      android: "http://10.0.2.2:3001",
      ios: "http://127.0.0.1:3001",
      default: "http://127.0.0.1:3001"
    }) ?? "http://127.0.0.1:3001"
  );
}

const DEFAULT_API_BASE = resolveDefaultApiBase();

const STORAGE_API_BASE = "clearcase.mobile.apiBase";
const STORAGE_SUBJECT = "clearcase.mobile.subject";
const STORAGE_EMAIL = "clearcase.mobile.email";
const STORAGE_ONBOARDED = "clearcase.mobile.onboarded";
const STORAGE_OFFLINE_SESSION = "clearcase.mobile.offlineSession";

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

const onboardingSlides: OnboardingSlide[] = [
  {
    title: "Start with your file.",
    description: "Upload a photo or PDF first. ClearCase works best when we can see your document.",
    icon: "scale",
    iconColor: "#475569",
    iconBg: "#F1F5F9"
  },
  {
    title: "Get structured signals fast.",
    description: "We auto-detect likely document type, risk cues, and potential time-sensitive items.",
    icon: "search",
    iconColor: "#2563EB",
    iconBg: "#EFF6FF"
  },
  {
    title: "Move forward confidently.",
    description: "See plain-language summaries and practical next steps you can evaluate.",
    icon: "book-open",
    iconColor: "#059669",
    iconBg: "#ECFDF5"
  },
  {
    title: "Information, not legal advice.",
    description: "ClearCase provides informational guidance only. For legal advice, talk to a licensed attorney.",
    icon: "shield",
    iconColor: "#4F46E5",
    iconBg: "#EEF2FF"
  }
];

type ManualCategoryOption = {
  value: ManualDocumentType;
  label: string;
};

const manualCategoryOptions: ManualCategoryOption[] = [
  { value: "summons_complaint", label: "Summons / Complaint" },
  { value: "court_hearing_notice", label: "Court Hearing Notice" },
  { value: "subpoena_notice", label: "Subpoena Notice" },
  { value: "judgment_notice", label: "Judgment Notice" },
  { value: "small_claims_complaint", label: "Small Claims Complaint" },
  { value: "family_court_notice", label: "Family Court Notice" },
  { value: "protective_order_notice", label: "Protective Order Notice" },
  { value: "eviction_notice", label: "Eviction Notice" },
  { value: "foreclosure_default_notice", label: "Foreclosure / Default Notice" },
  { value: "repossession_notice", label: "Repossession Notice" },
  { value: "landlord_security_deposit_notice", label: "Security Deposit Notice" },
  { value: "lease_violation_notice", label: "Lease Violation Notice" },
  { value: "debt_collection_notice", label: "Debt Collection Notice" },
  { value: "wage_garnishment_notice", label: "Wage Garnishment Notice" },
  { value: "tax_notice", label: "Tax Notice" },
  { value: "insurance_denial_letter", label: "Insurance Denial Letter" },
  { value: "insurance_subrogation_notice", label: "Insurance Subrogation Notice" },
  { value: "workers_comp_denial_notice", label: "Workers' Comp Denial Notice" },
  { value: "unemployment_benefits_denial", label: "Unemployment Benefits Denial" },
  { value: "benefits_overpayment_notice", label: "Benefits Overpayment Notice" },
  { value: "utility_shutoff_notice", label: "Utility Shutoff Notice" },
  { value: "license_suspension_notice", label: "License Suspension Notice" },
  { value: "citation_ticket", label: "Citation / Ticket" },
  { value: "demand_letter", label: "Demand Letter" },
  { value: "incident_evidence_photo", label: "Incident Evidence Photo" },
  { value: "general_legal_notice", label: "General Legal Notice" },
  { value: "non_legal_or_unclear_image", label: "Not Legal / Unclear Image" },
  { value: "unknown_legal_document", label: "Unknown Legal Document" }
];

function buildHeaders(subject: string, email: string): AuthHeaders {
  return { "x-auth-subject": subject.trim() || DEFAULT_SUBJECT, "x-user-email": email.trim() || DEFAULT_EMAIL };
}

function summarizeError(error: unknown): string {
  if (error instanceof Error) {
    const apiError = error as ApiError;
    if (apiError.data && typeof apiError.data === "object") {
      const code = (apiError.data as Record<string, unknown>).error;
      if (typeof code === "string") return `${apiError.message} (${code})`;
    }
    return apiError.message;
  }
  return String(error);
}

function withNetworkHint(error: unknown, apiBase: string): string {
  const message = summarizeError(error);
  const m = message.toLowerCase();
  const isNetworkFailure =
    m.includes("network request failed") ||
    m.includes("failed to fetch") ||
    m.includes("network error contacting api") ||
    m.includes("timed out") ||
    m.includes("health check failed (502)") ||
    m.includes("health check failed (503)") ||
    m.includes("health check failed (504)") ||
    m.includes("health check failed (") ||
    m.includes("api 502") ||
    m.includes("api 503") ||
    m.includes("api 504") ||
    m.includes("api 5");
  if (!isNetworkFailure) return message;
  return `${message}. Cannot reach API at ${apiBase}. Use your computer LAN IP (example: http://192.168.x.x:3001).`;
}

function isNetworkErrorLike(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("network error contacting api") ||
    m.includes("network request failed") ||
    m.includes("failed to fetch") ||
    m.includes("timed out") ||
    m.includes("cannot reach api") ||
    m.includes("health check failed (502)") ||
    m.includes("health check failed (503)") ||
    m.includes("health check failed (504)") ||
    m.includes("health check failed (") ||
    m.includes("api 502") ||
    m.includes("api 503") ||
    m.includes("api 504") ||
    m.includes("api 5")
  );
}

function titleize(value: string): string {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function isManualDocumentType(value: string | null | undefined): value is ManualDocumentType {
  return Boolean(value && MANUAL_DOCUMENT_TYPES.includes(value as ManualDocumentType));
}

function manualCategoryLabel(value: string | null | undefined): string {
  if (!value) return "Pending detection";
  const found = manualCategoryOptions.find((row) => row.value === value);
  return found?.label ?? titleize(value);
}

function fallbackSummaryForDocumentType(documentType: string | null | undefined): string {
  if (!documentType) {
    return "Upload is complete. We are still determining the best category. Add context and more pages for a better result.";
  }

  if (documentType === "incident_evidence_photo") {
    return "This appears to be incident evidence (photo-based context) rather than a formal legal notice. Add details about what happened and upload supporting documents for stronger guidance.";
  }

  if (documentType === "non_legal_or_unclear_image") {
    return "This file does not look like a legal document yet. Upload a clearer legal notice or add incident details to continue case building.";
  }

  if (documentType === "unknown_legal_document") {
    return "This appears legal but is not confidently classified. Review category selection and upload more readable pages so deadlines and obligations can be extracted.";
  }

  return `This appears to be ${manualCategoryLabel(documentType)}. Review the checklist below and speak with a licensed attorney for advice specific to your situation.`;
}

function buildRecommendedNextSteps(
  documentType: string | null | undefined,
  earliestDeadline: string | null | undefined
): string[] {
  const generic: string[] = [
    "Confirm the selected category matches your file.",
    "Add case context describing what happened and what outcome you want.",
    "If this may affect your legal rights, talk to a licensed attorney in your state."
  ];

  let steps = generic;

  if (
    documentType === "summons_complaint" ||
    documentType === "court_hearing_notice" ||
    documentType === "subpoena_notice" ||
    documentType === "judgment_notice" ||
    documentType === "small_claims_complaint" ||
    documentType === "family_court_notice" ||
    documentType === "protective_order_notice"
  ) {
    steps = [
      "Do not ignore this notice. Gather all related pages and envelopes.",
      "Call a litigation or family-law attorney immediately for response strategy.",
      "Prepare a simple timeline of events and key names before speaking with counsel."
    ];
  } else if (
    documentType === "eviction_notice" ||
    documentType === "foreclosure_default_notice" ||
    documentType === "repossession_notice" ||
    documentType === "lease_violation_notice" ||
    documentType === "landlord_security_deposit_notice"
  ) {
    steps = [
      "Collect your lease, payment records, and communication history.",
      "Contact a housing attorney or legal aid clinic quickly.",
      "Document property condition with timestamped photos and notes."
    ];
  } else if (
    documentType === "debt_collection_notice" ||
    documentType === "wage_garnishment_notice" ||
    documentType === "tax_notice" ||
    documentType === "benefits_overpayment_notice"
  ) {
    steps = [
      "Gather account statements and all prior letters.",
      "Check whether the notice provides dispute/appeal instructions.",
      "Consult a consumer-law or tax attorney before responding if possible."
    ];
  } else if (
    documentType === "insurance_denial_letter" ||
    documentType === "insurance_subrogation_notice" ||
    documentType === "workers_comp_denial_notice" ||
    documentType === "unemployment_benefits_denial"
  ) {
    steps = [
      "Save the full denial letter and policy/claim records.",
      "Identify appeal deadlines and required supporting records.",
      "Consider speaking with an attorney focused on insurance or benefits appeals."
    ];
  } else if (documentType === "incident_evidence_photo") {
    steps = [
      "Add context: what happened, when, where, and who was involved.",
      "Upload supporting records (police report, medical notes, estimates, messages).",
      "If there are injuries or major losses, consult a personal-injury attorney."
    ];
  } else if (documentType === "non_legal_or_unclear_image") {
    steps = [
      "Upload a clearer image or a formal notice if available.",
      "Use case context to explain why this image matters.",
      "If you expected a legal notice, contact the sender or a lawyer to verify urgency."
    ];
  }

  if (earliestDeadline) {
    const label = fmtDate(earliestDeadline);
    return [`Calendar the deadline immediately: ${label}.`, ...steps];
  }

  return steps;
}

function daysUntil(value: string): number | null {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const now = Date.now();
  return Math.ceil((d.getTime() - now) / (1000 * 60 * 60 * 24));
}

function deriveCaseSeverity(
  documentType: string | null | undefined,
  timeSensitive: boolean | null | undefined,
  earliestDeadline: string | null | undefined
): CaseSeverity {
  if (timeSensitive) return "high";

  const urgentDocTypes = new Set<string>([
    "summons_complaint",
    "court_hearing_notice",
    "subpoena_notice",
    "judgment_notice",
    "small_claims_complaint",
    "protective_order_notice",
    "family_court_notice",
    "eviction_notice",
    "foreclosure_default_notice",
    "repossession_notice",
    "wage_garnishment_notice"
  ]);

  if (documentType && urgentDocTypes.has(documentType)) return "high";

  if (earliestDeadline) {
    const days = daysUntil(earliestDeadline);
    if (days !== null && days <= 7) return "high";
    return "medium";
  }

  if (documentType === "non_legal_or_unclear_image") return "low";
  if (documentType === "incident_evidence_photo") return "medium";
  if (documentType === "unknown_legal_document") return "medium";
  if (!documentType) return "medium";

  return "medium";
}

function severityLabel(level: CaseSeverity): string {
  if (level === "high") return "High priority";
  if (level === "medium") return "Medium priority";
  return "Low priority";
}

function severitySummary(level: CaseSeverity): string {
  if (level === "high") return "Time-sensitive or high-risk signals detected. Review immediately.";
  if (level === "medium") return "Review needed. Follow the steps below to reduce risk.";
  return "No immediate legal signal detected. Keep documenting and monitor updates.";
}

function fmtDate(value: string | null): string {
  if (!value) return "None";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString();
}

function fmtDateTime(value: string | null): string {
  if (!value) return "Unknown";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function formatUploadStage(stage: UploadStage): string {
  if (stage === "picking") return "Choose file";
  if (stage === "preparing") return "Preparing upload";
  if (stage === "sending") return "Uploading securely";
  if (stage === "processing") return "Generating insight";
  return "Ready to upload";
}

function casePriorityLabel(row: CaseSummary): "High" | "Medium" | "Low" {
  if (row.timeSensitive) return "High";
  if (row.earliestDeadline) return "Medium";
  return "Low";
}

function buildAutoCaseTitle(rawTitle?: string | null): string {
  const cleaned = (rawTitle ?? "")
    .replace(/\.[^.]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned) return cleaned.slice(0, 120);
  return `New case ${new Date().toLocaleDateString()}`;
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

function askTakeAnotherPhoto(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert("Photo added", "Take another photo?", [
      { text: "Done", onPress: () => resolve(false), style: "cancel" },
      { text: "Take another", onPress: () => resolve(true) }
    ]);
  });
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Newsreader_600SemiBold,
    Newsreader_700Bold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold
  });

  const [screen, setScreen] = useState<Screen>("onboarding");
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
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadTargetCaseId, setUploadTargetCaseId] = useState<string | null>(null);
  const [uploadCaseTitle, setUploadCaseTitle] = useState("");
  const [caseContextDraft, setCaseContextDraft] = useState("");
  const [classificationSheetOpen, setClassificationSheetOpen] = useState(false);
  const [classificationDraft, setClassificationDraft] = useState<ManualDocumentType>("unknown_legal_document");
  const [legalReturnScreen, setLegalReturnScreen] = useState<Screen>("home");

  const [authName, setAuthName] = useState("");
  const [authZip, setAuthZip] = useState("");
  const [authEmail, setAuthEmail] = useState(DEFAULT_EMAIL);
  const [authPassword, setAuthPassword] = useState("");
  const [authIntent, setAuthIntent] = useState<"login" | "signup">("login");
  const [authBusy, setAuthBusy] = useState(false);
  const [authStage, setAuthStage] = useState<"idle" | "account" | "profile" | "workspace">("idle");
  const [authProFirm, setAuthProFirm] = useState("");
  const [authProEmail, setAuthProEmail] = useState("");
  const [authProSubmitted, setAuthProSubmitted] = useState(false);

  const [me, setMe] = useState<MeResponse | null>(null);
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<CaseDetail | null>(null);

  const [profileName, setProfileName] = useState("");
  const [profileZip, setProfileZip] = useState("");
  const [newCaseTitle, setNewCaseTitle] = useState("");
  const [caseSearch, setCaseSearch] = useState("");
  const [caseFilter, setCaseFilter] = useState<"all" | "active" | "urgent" | "archived">("all");
  const [showAccountProWaitlist, setShowAccountProWaitlist] = useState(false);
  const [accountProFirm, setAccountProFirm] = useState("");
  const [accountProPractice, setAccountProPractice] = useState("");
  const [accountProSubmitted, setAccountProSubmitted] = useState(false);

  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [loadingCase, setLoadingCase] = useState(false);
  const [creatingCase, setCreatingCase] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingCaseContext, setSavingCaseContext] = useState(false);
  const [savingClassification, setSavingClassification] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState<UploadStage>("idle");
  const [refreshing, setRefreshing] = useState(false);

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
    return value || fallbackSummaryForDocumentType(activeDocumentType);
  }, [selectedCase?.plainEnglishExplanation, activeDocumentType]);
  const workspaceNextSteps = useMemo(
    () => buildRecommendedNextSteps(activeDocumentType, activeEarliestDeadline),
    [activeDocumentType, activeEarliestDeadline]
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
  const completion = useMemo(() => {
    if (!me) return 0;
    const count = [me.user.fullName, me.user.zipCode, me.user.jurisdictionState].filter(Boolean).length;
    return Math.round((count / 3) * 100);
  }, [me]);
  const accountInitials = useMemo(() => {
    const source = me?.user.fullName?.trim() || email.split("@")[0] || "CC";
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
    return (parts[0]?.slice(0, 2) ?? "CC").toUpperCase();
  }, [me, email]);

  useEffect(() => {
    async function hydrate(): Promise<void> {
      try {
        const [savedBase, savedSubject, savedEmail, savedOnboarded, savedOfflineSession] = await Promise.all([
          AsyncStorage.getItem(STORAGE_API_BASE),
          AsyncStorage.getItem(STORAGE_SUBJECT),
          AsyncStorage.getItem(STORAGE_EMAIL),
          AsyncStorage.getItem(STORAGE_ONBOARDED),
          AsyncStorage.getItem(STORAGE_OFFLINE_SESSION)
        ]);

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
        const hasSession = Boolean(savedSubject?.trim() && savedEmail?.trim());
        if (hasSession) {
          setOfflineMode(false);
          setScreen("home");
          void loadDashboard(nextBase, buildHeaders(nextSubject, nextEmail));
        } else if (savedOfflineSession) {
          try {
            const parsed = JSON.parse(savedOfflineSession) as { me: MeResponse; cases: CaseSummary[] };
            if (parsed.me?.user?.email) {
              setMe(parsed.me);
              setCases(parsed.cases ?? []);
              setProfileName(parsed.me.user.fullName ?? "");
              setProfileZip(parsed.me.user.zipCode ?? "");
              setOfflineMode(true);
              setScreen("home");
            } else {
              setScreen(onboardingDone ? "auth" : "onboarding");
            }
          } catch {
            setScreen(onboardingDone ? "auth" : "onboarding");
          }
        } else {
          setScreen(onboardingDone ? "auth" : "onboarding");
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
      return;
    }
    if (offlineMode) {
      setSelectedCase(null);
      return;
    }
    void loadCase(selectedCaseId);
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

  function showBanner(tone: BannerTone, text: string): void {
    setBanner({ tone, text });
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
      needsProfile: !fullName || !zipCode
    };

    const offlineCases: CaseSummary[] = [];

    setMe(offlineMe);
    setCases(offlineCases);
    setSelectedCaseId(null);
    setSelectedCase(null);
    setProfileName(offlineMe.user.fullName ?? "");
    setProfileZip(offlineMe.user.zipCode ?? "");
    setOfflineMode(true);

    try {
      await AsyncStorage.setItem(STORAGE_OFFLINE_SESSION, JSON.stringify({ me: offlineMe, cases: offlineCases }));
      await AsyncStorage.setItem(STORAGE_ONBOARDED, "1");
    } catch {
      // Ignore storage failures.
    }
  }

  async function completeOnboarding(): Promise<void> {
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
      setMe(meData);
      setCases(caseData.cases);
      setProfileName(meData.user.fullName ?? "");
      setProfileZip(meData.user.zipCode ?? "");
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

  async function createCaseWithTitle(title: string): Promise<string | null> {
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
    assets: Array<{ uri: string; name: string; mimeType?: string | null; size?: number | null }>,
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
      const baseTitle = buildAutoCaseTitle(preferredCaseTitle || assets[0]?.name);
      caseId = await createCaseWithTitle(baseTitle);
    }
    if (!caseId) {
      setUploadStage("idle");
      Alert.alert("Could not start case", "We could not create a case from this upload. Please retry.");
      return;
    }

    setUploading(true);
    try {
      let uploadedCount = 0;
      for (const file of assets) {
        setUploadStage("preparing");
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
        await finalizeAssetUpload(apiBase, headers, caseId, plan.assetId, {
          userDescription: userDescription?.trim() || undefined
        });
        uploadedCount += 1;
      }

      setUploadStage("processing");
      setSelectedCaseId(caseId);
      await Promise.all([loadDashboard(), loadCase(caseId)]);
      setScreen("workspace");
      const uploadedCountText = uploadedCount > 1 ? `${uploadedCount} files uploaded.` : "Upload complete.";
      showBanner("info", `${uploadedCountText} Processing started in workspace.`);

      void (async () => {
        try {
          const caseAfterUpload = await waitForCaseInsight(caseId, 12000);
          if (!caseAfterUpload) {
            showBanner("info", "Still processing. Pull to refresh in Workspace in a few seconds.");
            return;
          }

          await Promise.all([loadDashboard(), loadCase(caseId)]);
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
        quality: 0.55
      });
      if (shot.canceled || shot.assets.length === 0) break;

      const image = shot.assets[0];
      const generatedName = image.fileName ?? `camera-${Date.now()}-${captured.length + 1}.jpg`;
      captured.push({
        uri: image.uri,
        name: generatedName,
        mimeType: image.mimeType ?? "image/jpeg",
        size: image.fileSize
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
      setMe(updated);
      setProfileName(updated.user.fullName ?? "");
      setProfileZip(updated.user.zipCode ?? "");
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
        await finalizeAssetUpload(apiBase, headers, selectedCaseId, latestAssetId, {
          userDescription: description
        });
        showBanner("info", "Case context saved. Reprocessing latest upload with this context...");
        await waitForCaseInsight(selectedCaseId, 12000);
      }
      await Promise.all([loadDashboard(), loadCase(selectedCaseId)]);
      showBanner("good", "Case context saved.");
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
      showBanner("good", `Category updated to ${manualCategoryLabel(classificationDraft)}.`);
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

      setMe(meData);
      setProfileName(meData.user.fullName ?? "");
      setProfileZip(meData.user.zipCode ?? "");
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

  const uploadStatusText = uploading ? formatUploadStage(uploadStage) : "Ready to upload";
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

          {screen === "onboarding" ? (
            <View style={styles.screen}>
              <View style={styles.rowTopRight}>
                <Pressable onPress={() => void completeOnboarding()}><Text style={styles.skip}>Skip</Text></Pressable>
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
                  <Text style={styles.slideStepper}>Step {slide + 1} of {onboardingSlides.length}</Text>
                  <Text style={styles.heroTitle}>{onboardingSlides[slide].title}</Text>
                  <Text style={styles.heroCopy}>{onboardingSlides[slide].description}</Text>
                </LinearGradient>
              </View>
              <View style={styles.bottomNav}>
                <Pressable onPress={() => setSlide((s) => Math.max(0, s - 1))} style={[styles.circle, slide === 0 ? styles.invisible : null]}>
                  <Feather name="arrow-left" size={20} color={palette.muted} />
                </Pressable>
                <View style={styles.dots}>{[0, 1, 2, 3].map((i) => <View key={i} style={[styles.dot, i === slide ? styles.dotActive : null]} />)}</View>
                <Pressable onPress={() => (slide < 3 ? setSlide(slide + 1) : void completeOnboarding())} style={styles.circleDark}>
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
                      <Text style={styles.welcomeMuted}>Welcome to</Text>
                      <Pressable style={styles.brandRow}>
                        <View style={styles.brandMark}><MaterialCommunityIcons name="scale-balance" size={24} color="#FFFFFF" /></View>
                        <Text style={styles.brandText}>ClearCase</Text>
                      </Pressable>
                      <Text style={styles.formSubtitle}>Upload-first legal clarity from your first screen.</Text>
                    </LinearGradient>
                    <View style={styles.authSelectionActions}>
                      <Pressable
                        onPress={() => {
                          setAuthIntent("login");
                          setAuthMode("login");
                        }}
                        style={styles.primaryBtn}
                      >
                        <Text style={styles.primaryBtnText}>Log in</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          setAuthIntent("signup");
                          setAuthMode("signup");
                        }}
                        style={styles.outlineBtn}
                      >
                        <Text style={styles.outlineBtnText}>Sign up</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          Alert.alert("Support", "Support chat is coming soon. Continue with Log in or Sign up.");
                        }}
                        style={styles.link}
                      >
                        <Text style={styles.linkText}>Contact support</Text>
                      </Pressable>
                    </View>
                  </View>
                  <View style={styles.authFooter}>
                    <Text style={styles.authFooterLink}>Informational guidance only. Not legal advice.</Text>
                  </View>
                </View>
              ) : null}

              {authMode === "login" || authMode === "signup" ? (
                <ScrollView style={styles.scrollScreen} contentContainerStyle={styles.scrollBody}>
                  <Pressable onPress={() => setAuthMode("selection")} style={styles.back}><Feather name="chevron-left" size={24} color={palette.muted} /></Pressable>
                  <Text style={styles.formTitle}>{authMode === "signup" ? "Join ClearCase" : "Welcome back"}</Text>
                  <Text style={styles.formSubtitle}>
                    {authMode === "signup"
                      ? "Start your journey toward legal clarity."
                      : "Sign in to access your saved cases."}
                  </Text>
                  {authMode === "signup" ? (
                    <>
                      <Text style={styles.fieldLabel}>Full Name</Text>
                      <TextInput style={styles.input} placeholder="John Doe" placeholderTextColor={palette.subtle} value={authName} onChangeText={setAuthName} />
                      <Text style={styles.fieldLabel}>ZIP Code</Text>
                      <TextInput style={styles.input} placeholder="90210" placeholderTextColor={palette.subtle} keyboardType="number-pad" value={authZip} onChangeText={setAuthZip} />
                    </>
                  ) : null}
                  <Text style={styles.fieldLabel}>Email</Text>
                  <TextInput style={styles.input} placeholder="john@example.com" placeholderTextColor={palette.subtle} autoCapitalize="none" value={authEmail} onChangeText={setAuthEmail} />
                  <Text style={styles.fieldLabel}>Password</Text>
                  <TextInput style={styles.input} placeholder="********" placeholderTextColor={palette.subtle} secureTextEntry autoCapitalize="none" value={authPassword} onChangeText={setAuthPassword} />
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
                    <Text style={styles.primaryBtnText}>{authMode === "signup" ? "Create account" : "Sign in"}</Text>
                  </Pressable>
                  {authMode === "signup" ? (
                    <View style={styles.proPromptCard}>
                      <View style={styles.proPromptIconWrap}>
                        <Feather name="briefcase" size={16} color="#2563EB" />
                      </View>
                      <View style={styles.proPromptBody}>
                        <Text style={styles.proPromptTitle}>Are you a professional?</Text>
                        <Text style={styles.proPromptCopy}>
                          Interested in ClearCase for your firm or legal team? Join our professional waitlist.
                        </Text>
                        <Pressable
                          onPress={() => {
                            setAuthProFirm("");
                            setAuthProEmail(authEmail.trim());
                            setAuthProSubmitted(false);
                            setAuthMode("waitlist");
                          }}
                        >
                          <Text style={styles.proPromptLink}>Request access</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : null}
                  <Text style={styles.subtleCenterText}>
                    ClearCase provides informational guidance only and does not replace a licensed attorney.
                  </Text>
                </ScrollView>
              ) : null}

              {authMode === "waitlist" ? (
                <ScrollView style={styles.scrollScreen} contentContainerStyle={styles.scrollBody}>
                  <Pressable
                    onPress={() => {
                      setAuthMode("signup");
                      setAuthProSubmitted(false);
                    }}
                    style={styles.back}
                  >
                    <Feather name="chevron-left" size={24} color={palette.muted} />
                  </Pressable>
                  <View style={styles.waitlistHeader}>
                    <View style={styles.waitlistIcon}>
                      <Feather name="briefcase" size={22} color="#2563EB" />
                    </View>
                    <Text style={styles.waitlistTitle}>Professional access</Text>
                    <Text style={styles.waitlistCopy}>
                      Join the waitlist for ClearCase Pro tools designed for law firms and legal teams.
                    </Text>
                  </View>
                  {!authProSubmitted ? (
                    <>
                      <Text style={styles.fieldLabel}>Firm Name</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Lexington Law Group"
                        placeholderTextColor={palette.subtle}
                        value={authProFirm}
                        onChangeText={setAuthProFirm}
                      />
                      <Text style={styles.fieldLabel}>Professional Email</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="partner@firm.com"
                        placeholderTextColor={palette.subtle}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        value={authProEmail}
                        onChangeText={setAuthProEmail}
                      />
                      <Pressable
                        onPress={() => {
                          if (!authProFirm.trim()) {
                            Alert.alert("Firm required", "Enter your firm or company name.");
                            return;
                          }
                          if (!isValidEmail(authProEmail)) {
                            Alert.alert("Invalid email", "Enter a valid professional email.");
                            return;
                          }
                          setAuthProSubmitted(true);
                        }}
                        style={[styles.primaryBtn, styles.waitlistBtn]}
                      >
                        <Text style={styles.primaryBtnText}>Request access</Text>
                      </Pressable>
                    </>
                  ) : (
                    <View style={styles.waitlistSuccess}>
                      <View style={styles.waitlistSuccessIcon}>
                        <Feather name="check-circle" size={26} color="#15803D" />
                      </View>
                      <Text style={styles.waitlistSuccessTitle}>Request received</Text>
                      <Text style={styles.waitlistSuccessCopy}>
                        Thanks for your interest. We will reach out when professional onboarding opens.
                      </Text>
                      <Pressable
                        onPress={() => {
                          setAuthMode("signup");
                          setAuthProSubmitted(false);
                        }}
                        style={styles.outlineSoftBtn}
                      >
                        <Text style={styles.outlineSoftText}>Return to sign up</Text>
                      </Pressable>
                    </View>
                  )}
                </ScrollView>
              ) : null}

              {authMode === "disclaimer" ? (
                <ScrollView style={styles.disclaimerScreen} contentContainerStyle={styles.scrollBody}>
                  <View style={styles.disclaimerHeaderRow}>
                    <View style={styles.disclaimerShield}>
                      <Feather name="shield" size={20} color={palette.primary} />
                    </View>
                    <Text style={styles.disclaimerTitle}>Before you continue</Text>
                  </View>
                  <Text style={styles.disclaimerP}>ClearCase is an informational product and not a law firm.</Text>
                  <Text style={styles.disclaimerP}>For legal advice on your specific situation, consult a licensed attorney.</Text>
                  <View style={styles.disclaimerCard}>
                    <Text style={styles.cardTitle}>I acknowledge and agree that:</Text>
                    <View style={styles.disclaimerBulletRow}>
                      <View style={styles.disclaimerBulletDot} />
                      <Text style={styles.cardBody}>My information and case details are confidential.</Text>
                    </View>
                    <View style={styles.disclaimerBulletRow}>
                      <View style={styles.disclaimerBulletDot} />
                      <Text style={styles.cardBody}>Data is processed only to provide situational clarity.</Text>
                    </View>
                    <View style={styles.disclaimerBulletRow}>
                      <View style={styles.disclaimerBulletDot} />
                      <Text style={styles.cardBody}>No attorney-client relationship is created by using this app.</Text>
                    </View>
                    <Pressable onPress={() => void agreeAndContinue()} style={styles.primaryBtn} disabled={authBusy}>
                      <Text style={styles.primaryBtnText}>
                        {authBusy
                          ? authStage === "account"
                            ? "Creating account..."
                            : authStage === "profile"
                              ? "Saving profile..."
                              : authStage === "workspace"
                                ? "Setting up workspace..."
                                : "Connecting..."
                          : "Agree and Continue to ClearCase"}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => setAuthMode(authIntent)} style={styles.link}>
                      <Text style={styles.linkText}>Back</Text>
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
                  <Pressable onPress={() => setDrawerOpen(true)} style={styles.info}>
                    <Feather name="menu" size={18} color={palette.subtle} />
                  </Pressable>
                  <View style={styles.homeDashboardTitleWrap}>
                    <Text style={styles.dashboardTitle}>Dashboard</Text>
                    <Text style={styles.dashboardSubtitle}>Welcome back, {titleize(userFirstName)}.</Text>
                  </View>
                  <Pressable onPress={() => setScreen("account")} style={styles.avatarButton}>
                    <Text style={styles.avatarButtonText}>{accountInitials}</Text>
                  </Pressable>
                </View>
                {offlineMode ? <Text style={styles.offlineBadge}>Offline mode</Text> : null}
                <View style={styles.searchBar}>
                  <Feather name="search" size={16} color={palette.subtle} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search documents..."
                    placeholderTextColor={palette.subtle}
                    value={caseSearch}
                    onChangeText={setCaseSearch}
                  />
                </View>

                <LinearGradient
                  colors={["#0F172A", "#1E293B"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.homeHeroCard}
                >
                  <Text style={styles.homeHeroTitle}>Something happened?</Text>
                  <Text style={styles.homeHeroCopy}>
                    Upload any legal document or photo and we will route it into your workspace automatically.
                  </Text>
                  <View style={styles.uploadStatusPill}>
                    <View style={[styles.dotStatus, uploading ? styles.dotGood : null]} />
                    <Text style={styles.uploadStatusText}>{uploadStatusText}</Text>
                  </View>
                  <Pressable onPress={() => void homeUploadFlow()} style={[styles.primaryBtn, styles.heroPrimaryBtn]}>
                    <View style={styles.ctaInline}>
                      <Feather name="upload" size={14} color="#FFFFFF" />
                      <Text style={styles.primaryBtnText}>{uploading ? "Uploading..." : "Upload now"}</Text>
                    </View>
                  </Pressable>
                </LinearGradient>

                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionTitle}>Active Cases</Text>
                  <Pressable onPress={() => setScreen("cases")}>
                    <Text style={styles.sectionAction}>View all</Text>
                  </Pressable>
                </View>
                {filteredCases.length === 0 ? (
                  <View style={styles.card}>
                    <Text style={styles.cardBody}>No cases yet. Upload your first file to create one.</Text>
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
                            casePriorityLabel(row) === "High"
                              ? styles.priorityChipHigh
                              : casePriorityLabel(row) === "Medium"
                                ? styles.priorityChipMedium
                                : styles.priorityChipLow
                          ]}
                        >
                          <Text style={styles.priorityChipText}>{casePriorityLabel(row)}</Text>
                        </View>
                        <Text style={styles.caseMetaText}>
                          {row.earliestDeadline ? `Deadline ${fmtDate(row.earliestDeadline)}` : "No deadline"}
                        </Text>
                      </View>
                      <Text style={styles.dashboardCaseTitle}>{row.title ?? "Untitled case"}</Text>
                      <Text style={styles.dashboardCaseSubtitle}>
                        {row.documentType ? titleize(row.documentType) : "Pending classification"} |{" "}
                        {titleize(row.status)}
                      </Text>
                    </Pressable>
                  ))
                )}

                <View style={styles.tipsGrid}>
                  <View style={styles.tipCard}>
                    <View style={[styles.tipIcon, styles.tipIconGreen]}>
                      <Feather name="zap" size={14} color="#059669" />
                    </View>
                    <Text style={styles.tipTitle}>Fast scan</Text>
                    <Text style={styles.tipCopy}>Use bright lighting for cleaner extraction results.</Text>
                  </View>
                  <View style={styles.tipCard}>
                    <View style={[styles.tipIcon, styles.tipIconBlue]}>
                      <Feather name="shield" size={14} color="#2563EB" />
                    </View>
                    <Text style={styles.tipTitle}>Privacy</Text>
                    <Text style={styles.tipCopy}>Redact account numbers before uploading when possible.</Text>
                  </View>
                </View>
                <Text style={styles.legal}>Informational only. Not legal advice.</Text>
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
                  <Text style={styles.formTitleSmall}>Workspace</Text>
                  {offlineMode ? <Text style={styles.offlinePill}>OFFLINE</Text> : null}
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
                        {selectedCase?.timeSensitive ? "High Sensitivity" : "Review Ready"}
                      </Text>
                    </View>
                    <View style={[styles.priorityChip, styles.priorityChipMedium]}>
                      <Text style={styles.priorityChipText}>
                        {selectedCase?.status ? titleize(selectedCase.status) : "Needs Review"}
                      </Text>
                    </View>
                  </View>
                  {!selectedCaseId && !latestCase ? (
                    <Text style={styles.cardBody}>No insight yet. Upload a file to generate your first workspace summary.</Text>
                  ) : null}
                  {selectedCaseId && !selectedCase && loadingCase ? <ActivityIndicator color={palette.primary} /> : null}
                  {selectedCase ? (
                    <>
                      <Text style={styles.workspaceCaseTitle}>{selectedCase.title ?? "Untitled case"}</Text>
                      <Text style={styles.workspaceCaseMeta}>
                        Type {selectedCase.documentType ? titleize(selectedCase.documentType) : "Pending detection"} | Updated{" "}
                        {fmtDateTime(selectedCase.updatedAt)}
                      </Text>
                      <View style={styles.workspaceMetricsRow}>
                        <View style={styles.workspaceMetricCard}>
                          <Text style={styles.metricLabel}>Next Deadline</Text>
                          <Text style={styles.metricValueSm}>{fmtDate(selectedCase.earliestDeadline)}</Text>
                        </View>
                        <View style={styles.workspaceMetricCard}>
                          <Text style={styles.metricLabel}>Analysis</Text>
                          <Text style={styles.metricValueSm}>
                            {selectedCase.classificationConfidence ? `${Math.round(selectedCase.classificationConfidence * 100)}%` : "Pending"}
                          </Text>
                        </View>
                      </View>
                    </>
                  ) : null}
                  {!selectedCase && selectedCaseSummary ? (
                    <>
                      <Text style={styles.workspaceCaseTitle}>{selectedCaseSummary.title ?? "Untitled case"}</Text>
                      <Text style={styles.workspaceCaseMeta}>
                        {titleize(selectedCaseSummary.status)} |{" "}
                        {selectedCaseSummary.documentType ? titleize(selectedCaseSummary.documentType) : "Pending detection"}
                      </Text>
                    </>
                  ) : null}
                  <Pressable onPress={() => void openUploadSheetForCase(selectedCaseId)} style={styles.outlineSoftBtn} disabled={uploading}>
                    <Text style={styles.outlineSoftText}>{uploading ? formatUploadStage(uploadStage) + "..." : "Upload another document"}</Text>
                  </Pressable>
                </View>

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
                    <Text style={styles.sectionTitle}>Recommended Next Steps</Text>
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
                      <Text style={styles.severityBadgeText}>{severityLabel(workspaceSeverity)}</Text>
                    </View>
                  </View>
                  <Text style={styles.actionPlanSubhead}>{severitySummary(workspaceSeverity)}</Text>
                  {workspaceNextSteps.map((step, index) => (
                    <View key={`${selectedCaseId ?? "case"}-step-${index}`} style={styles.checklistRow}>
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
                      <Text style={styles.checklistText}>{step}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.card}>
                  <View style={styles.sectionTitleRow}>
                    <Text style={styles.sectionTitle}>Case context</Text>
                    <Text style={styles.caseContextHint}>Used for future uploads</Text>
                  </View>
                  <TextInput
                    style={styles.caseContextInput}
                    multiline
                    value={caseContextDraft}
                    onChangeText={setCaseContextDraft}
                    placeholder="Add context (e.g., rear-ended at stop light, photo shows rear bumper damage)."
                    placeholderTextColor={palette.subtle}
                  />
                  <Pressable
                    onPress={() => void saveCaseContextForSelectedCase()}
                    style={styles.outlineSoftBtn}
                    disabled={savingCaseContext}
                  >
                    <Text style={styles.outlineSoftText}>{savingCaseContext ? "Saving..." : "Save case context"}</Text>
                  </Pressable>
                </View>

                <View style={styles.card}>
                  <View style={styles.sectionTitleRow}>
                    <Text style={styles.sectionTitle}>Document category</Text>
                    <Text style={styles.caseContextHint}>Manual fallback</Text>
                  </View>
                  <Text style={styles.cardBody}>
                    Current: {manualCategoryLabel(selectedCase?.documentType ?? selectedCaseSummary?.documentType ?? null)}
                  </Text>
                  <Pressable
                    onPress={openManualCategoryPicker}
                    style={styles.outlineSoftBtn}
                    disabled={!selectedCaseId || savingClassification}
                  >
                    <Text style={styles.outlineSoftText}>
                      {savingClassification ? "Saving..." : "Choose or correct category"}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.card}>
                  <View style={styles.sectionTitleRow}>
                    <Text style={styles.sectionTitle}>Plain language summary</Text>
                    <Text style={styles.autoBadge}>Automated</Text>
                  </View>
                  <Text style={styles.cardBody}>{workspaceSummaryText}</Text>
                  <Text style={styles.legalInline}>
                    {selectedCase?.nonLegalAdviceDisclaimer ?? "For informational context only. Not legal advice."}
                  </Text>
                </View>

                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Case timeline</Text>
                  {selectedCase ? (
                    <>
                      <Text style={styles.optionDesc}>Updated: {fmtDateTime(selectedCase.updatedAt)}</Text>
                      <Text style={styles.optionDesc}>
                        Assets {selectedCase.assets.length} | Extractions {selectedCase.extractions.length} | Verdicts {selectedCase.verdicts.length}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.cardBody}>Select a case to view detailed timeline events.</Text>
                  )}
                </View>
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
                    <Text style={styles.dashboardTitle}>Your Cases</Text>
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
                    placeholder="Search documents..."
                    placeholderTextColor={palette.subtle}
                  />
                </View>
                <View style={styles.filterRow}>
                  <Pressable onPress={() => setCaseFilter("all")} style={[styles.filterPill, caseFilter === "all" ? styles.filterPillActive : null]}>
                    <Text style={[styles.filterPillText, caseFilter === "all" ? styles.filterPillTextActive : null]}>All Cases</Text>
                  </Pressable>
                  <Pressable onPress={() => setCaseFilter("active")} style={[styles.filterPill, caseFilter === "active" ? styles.filterPillActive : null]}>
                    <Text style={[styles.filterPillText, caseFilter === "active" ? styles.filterPillTextActive : null]}>Active</Text>
                  </Pressable>
                  <Pressable onPress={() => setCaseFilter("urgent")} style={[styles.filterPill, caseFilter === "urgent" ? styles.filterPillActive : null]}>
                    <Text style={[styles.filterPillText, caseFilter === "urgent" ? styles.filterPillTextActive : null]}>Urgent</Text>
                  </Pressable>
                  <Pressable onPress={() => setCaseFilter("archived")} style={[styles.filterPill, caseFilter === "archived" ? styles.filterPillActive : null]}>
                    <Text style={[styles.filterPillText, caseFilter === "archived" ? styles.filterPillTextActive : null]}>Archived</Text>
                  </Pressable>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Create case manually</Text>
                  <TextInput
                    style={styles.input}
                    value={newCaseTitle}
                    onChangeText={setNewCaseTitle}
                    placeholder="New case title"
                    placeholderTextColor={palette.subtle}
                  />
                  <Pressable onPress={() => void createCaseWithTitle(newCaseTitle)} style={styles.primaryBtn} disabled={creatingCase}>
                    <Text style={styles.primaryBtnText}>{creatingCase ? "Creating..." : "Create case"}</Text>
                  </Pressable>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>All cases</Text>
                  {loadingDashboard ? <ActivityIndicator color={palette.primary} /> : null}
                  {filteredCases.length === 0 ? (
                    <Text style={styles.cardBody}>No cases yet. Uploading a file will create your first case.</Text>
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
                              casePriorityLabel(row) === "High"
                                ? styles.priorityChipHigh
                                : casePriorityLabel(row) === "Medium"
                                  ? styles.priorityChipMedium
                                  : styles.priorityChipLow
                            ]}
                          >
                            <Text style={styles.priorityChipText}>{casePriorityLabel(row)}</Text>
                          </View>
                          <Text style={styles.caseMetaText}>{fmtDate(row.earliestDeadline)}</Text>
                        </View>
                        <Text style={styles.dashboardCaseTitle}>{row.title ?? "Untitled case"}</Text>
                        <Text style={styles.dashboardCaseSubtitle}>
                          {titleize(row.status)} | {row.documentType ? titleize(row.documentType) : "Pending detection"}
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
                  <Text style={styles.planLabel}>Current plan</Text>
                  <Text style={styles.planTitle}>ClearCase Basic</Text>
                  <Pressable style={styles.accountUpgradeBtn}>
                    <Text style={styles.accountUpgradeBtnText}>Upgrade</Text>
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
                  />
                  <TextInput
                    style={styles.input}
                    value={profileZip}
                    onChangeText={setProfileZip}
                    placeholder="ZIP code"
                    placeholderTextColor={palette.subtle}
                    keyboardType="number-pad"
                  />
                  <Pressable onPress={() => void saveProfile()} style={styles.primaryBtn} disabled={savingProfile}>
                    <Text style={styles.primaryBtnText}>{savingProfile ? "Saving..." : "Save profile"}</Text>
                  </Pressable>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Personal settings</Text>
                  <Pressable style={styles.settingRow}>
                    <Feather name="bell" size={16} color={palette.subtle} />
                    <Text style={styles.settingText}>Notifications</Text>
                    <Feather name="chevron-right" size={14} color={palette.subtle} />
                  </Pressable>
                  <Pressable style={styles.settingRow}>
                    <Feather name="credit-card" size={16} color={palette.subtle} />
                    <Text style={styles.settingText}>Billing and plans</Text>
                    <Feather name="chevron-right" size={14} color={palette.subtle} />
                  </Pressable>
                  <Pressable style={styles.settingRow}>
                    <Feather name="shield" size={16} color={palette.subtle} />
                    <Text style={styles.settingText}>Security</Text>
                    <Feather name="chevron-right" size={14} color={palette.subtle} />
                  </Pressable>
                </View>

                <View style={[styles.card, styles.proCard]}>
                  <Text style={styles.cardTitle}>Professional access</Text>
                  {!showAccountProWaitlist ? (
                    <>
                      <Text style={styles.cardBody}>
                        ClearCase Pro for law firms is in private beta. Join the professional waitlist.
                      </Text>
                      <Pressable
                        onPress={() => {
                          setShowAccountProWaitlist(true);
                          setAccountProSubmitted(false);
                        }}
                        style={styles.outlineSoftBtn}
                      >
                        <Text style={styles.outlineSoftText}>Join waitlist</Text>
                      </Pressable>
                    </>
                  ) : !accountProSubmitted ? (
                    <>
                      <TextInput
                        style={styles.input}
                        placeholder="Firm or company name"
                        placeholderTextColor={palette.subtle}
                        value={accountProFirm}
                        onChangeText={setAccountProFirm}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Practice area"
                        placeholderTextColor={palette.subtle}
                        value={accountProPractice}
                        onChangeText={setAccountProPractice}
                      />
                      <Pressable
                        onPress={() => {
                          if (!accountProFirm.trim()) {
                            Alert.alert("Firm required", "Enter your firm or company name.");
                            return;
                          }
                          setAccountProSubmitted(true);
                        }}
                        style={styles.primaryBtn}
                      >
                        <Text style={styles.primaryBtnText}>Submit request</Text>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Text style={styles.cardBody}>Application sent. We will follow up as professional seats open.</Text>
                      <Pressable
                        onPress={() => {
                          setShowAccountProWaitlist(false);
                          setAccountProSubmitted(false);
                        }}
                        style={styles.outlineSoftBtn}
                      >
                        <Text style={styles.outlineSoftText}>Done</Text>
                      </Pressable>
                    </>
                  )}
                </View>

                <Pressable onPress={() => void signOut()} style={[styles.outlineSoftBtn, styles.accountSignOutBtn]}>
                  <Text style={styles.outlineSoftText}>Sign out</Text>
                </Pressable>
              </ScrollView>
            </View>
          ) : null}

          {screen === "legal" ? (
            <View style={styles.screenSoft}>
              <View style={styles.verdictHead}>
                <Pressable onPress={() => setScreen(legalReturnScreen)} style={styles.back}>
                  <Feather name="chevron-left" size={24} color={palette.muted} />
                </Pressable>
                <Text style={styles.formTitleSmall}>Legal Notice</Text>
                <View style={styles.spacer} />
              </View>
              <ScrollView contentContainerStyle={styles.scrollBody}>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Disclaimer and Terms</Text>
                  <Text style={styles.cardBody}>
                    ClearCase is an informational tool and not a law firm. Results are for general context and may be
                    incomplete.
                  </Text>
                  <Text style={styles.cardBody}>
                    ClearCase does not provide legal advice and does not create an attorney-client relationship.
                  </Text>
                  <Text style={styles.cardBody}>
                    For advice specific to your situation, consult a licensed attorney in your jurisdiction.
                  </Text>
                </View>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Privacy and Data Use</Text>
                  <Text style={styles.cardBody}>Your uploaded files are processed to generate document insights and timeline signals.</Text>
                  <Text style={styles.cardBody}>Avoid uploading unnecessary sensitive information when possible.</Text>
                </View>
                <Pressable onPress={() => setScreen(legalReturnScreen)} style={styles.primaryBtn}>
                  <Text style={styles.primaryBtnText}>Back to app</Text>
                </Pressable>
              </ScrollView>
            </View>
          ) : null}

          {(screen === "home" || screen === "workspace" || screen === "cases" || screen === "account") ? (
            <View style={styles.bottomTabs}>
              <Pressable onPress={() => setScreen("home")} style={styles.bottomTabItem}>
                <Feather name="home" size={20} color={screen === "home" ? palette.text : palette.subtle} />
                <Text style={[styles.bottomTabLabel, screen === "home" ? styles.bottomTabLabelActive : null]}>Home</Text>
                {screen === "home" ? <View style={styles.bottomDot} /> : null}
              </Pressable>
              <Pressable onPress={() => setScreen("cases")} style={styles.bottomTabItem}>
                <Feather name="briefcase" size={20} color={screen === "cases" ? palette.text : palette.subtle} />
                <Text style={[styles.bottomTabLabel, screen === "cases" ? styles.bottomTabLabelActive : null]}>Cases</Text>
                {screen === "cases" ? <View style={styles.bottomDot} /> : null}
              </Pressable>
              <Pressable onPress={() => void homeUploadFlow()} style={styles.bottomUploadFab}>
                <Feather name="plus-circle" size={26} color="#FFFFFF" />
              </Pressable>
              <Pressable onPress={() => setScreen("account")} style={styles.bottomTabItem}>
                <Feather name="user" size={20} color={screen === "account" ? palette.text : palette.subtle} />
                <Text style={[styles.bottomTabLabel, screen === "account" ? styles.bottomTabLabelActive : null]}>Account</Text>
                {screen === "account" ? <View style={styles.bottomDot} /> : null}
              </Pressable>
            </View>
          ) : null}

          <Modal
            visible={uploadSheetOpen}
            transparent
            animationType="fade"
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
                {!uploadTargetCaseId ? (
                  <TextInput
                    style={styles.sheetCaseNameInput}
                    value={uploadCaseTitle}
                    onChangeText={setUploadCaseTitle}
                    placeholder="Case name (optional)"
                    placeholderTextColor={palette.subtle}
                  />
                ) : null}
                <TextInput
                  style={styles.sheetInput}
                  multiline
                  value={uploadDescription}
                  onChangeText={setUploadDescription}
                  placeholder="Optional: add context (e.g., rear-end collision damage on driver side)."
                  placeholderTextColor={palette.subtle}
                />
                <Pressable onPress={() => void beginFileUpload()} style={styles.sheetActionBtn}>
                  <Feather name="upload" size={16} color={palette.text} />
                  <Text style={styles.sheetActionText}>Upload file or image</Text>
                </Pressable>
                <Pressable onPress={() => void beginCameraUpload()} style={styles.sheetActionBtn}>
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
            animationType="fade"
            onRequestClose={() => setClassificationSheetOpen(false)}
          >
            <View style={styles.sheetOverlay}>
              <Pressable style={styles.sheetBackdrop} onPress={() => setClassificationSheetOpen(false)} />
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
                      <Text style={styles.drawerBrandSub}>Legal Clarity</Text>
                    </View>
                  </View>
                  <Pressable onPress={() => setDrawerOpen(false)} style={styles.info}>
                    <Feather name="x" size={16} color={palette.subtle} />
                  </Pressable>
                </View>
                <Text style={styles.drawerSectionTitle}>Assessments</Text>
                <Pressable onPress={() => { setScreen("home"); setDrawerOpen(false); }} style={styles.drawerItem}><Text style={styles.drawerItemText}>Dashboard</Text></Pressable>
                <Pressable onPress={() => { setScreen("cases"); setDrawerOpen(false); }} style={styles.drawerItem}><Text style={styles.drawerItemText}>Active Cases</Text></Pressable>
                <Pressable onPress={() => { setScreen("workspace"); setDrawerOpen(false); }} style={styles.drawerItem}><Text style={styles.drawerItemText}>Workspace</Text></Pressable>
                <Text style={styles.drawerSectionTitle}>Account</Text>
                <Pressable onPress={() => { setScreen("account"); setDrawerOpen(false); }} style={styles.drawerItem}><Text style={styles.drawerItemText}>Settings</Text></Pressable>
                <Pressable
                  onPress={() => {
                    setLegalReturnScreen(screen);
                    setDrawerOpen(false);
                    setScreen("legal");
                  }}
                  style={styles.drawerItem}
                >
                  <Text style={styles.drawerItemText}>Legal notice</Text>
                </Pressable>
                <Text style={styles.drawerSectionTitle}>Recent Cases</Text>
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
                    <Text style={styles.drawerItemText}>{row ? row.title ?? "Untitled case" : "No cases yet"}</Text>
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
                    <Text style={styles.drawerItemText}>Upload now</Text>
                  </Pressable>
                  <Pressable onPress={() => { setDrawerOpen(false); void signOut(); }} style={styles.drawerItem}>
                    <Text style={styles.drawerDangerText}>Sign out</Text>
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
  banner: { marginHorizontal: 16, marginTop: 10, marginBottom: 2, borderWidth: 1, borderColor: palette.line, borderRadius: 12, backgroundColor: palette.surfaceSoft, padding: 10 },
  bannerGood: { backgroundColor: palette.greenSoft, borderColor: "#BBF7D0" },
  bannerBad: { backgroundColor: palette.redSoft, borderColor: "#FECACA" },
  bannerText: { color: palette.text, fontFamily: font.medium, fontSize: 12 },
  screen: { flex: 1, backgroundColor: palette.bg, paddingHorizontal: 20, paddingTop: 8 },
  screenSoft: { flex: 1, backgroundColor: palette.surfaceSoft },
  rowTopRight: { alignItems: "flex-end", marginTop: 8 },
  rowTopLeft: { alignItems: "flex-start", marginTop: 4 },
  skip: { color: palette.subtle, fontFamily: font.semibold, fontSize: 13 },
  centerWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  onboardingCard: { width: "100%", borderRadius: 28, borderWidth: 1, borderColor: palette.line, paddingVertical: 30, paddingHorizontal: 20 },
  slideStepper: { color: palette.subtle, fontFamily: font.bold, fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 },
  centerWrapSmall: { alignItems: "center", marginBottom: 8 },
  brandPill: { width: 90, height: 90, borderRadius: 28, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  heroTitle: { color: palette.text, fontFamily: font.bold, fontSize: 28, textAlign: "center", lineHeight: 34, marginBottom: 8 },
  heroCopy: { color: palette.muted, fontFamily: font.regular, fontSize: 15, lineHeight: 22, textAlign: "center", paddingHorizontal: 20 },
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
  authSelectionHero: { width: "100%", borderRadius: 28, borderWidth: 1, borderColor: palette.line, paddingVertical: 28, paddingHorizontal: 20, marginBottom: 16, alignItems: "center" },
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
  formTitleSmall: { color: palette.text, fontFamily: font.semibold, fontSize: 18 },
  workspaceTitleWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
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
  input: { borderWidth: 1, borderColor: palette.line, borderRadius: 14, backgroundColor: palette.surfaceSoft, paddingHorizontal: 12, paddingVertical: 12, color: palette.text, fontFamily: font.regular, fontSize: 14, marginBottom: 8 },
  primaryBtn: { borderRadius: 16, backgroundColor: palette.primary, paddingVertical: 14, alignItems: "center", justifyContent: "center", marginTop: 4 },
  primaryBtnText: { color: "#FFFFFF", fontFamily: font.semibold, fontSize: 14 },
  outlineBtn: { borderRadius: 16, borderWidth: 2, borderColor: palette.primary, paddingVertical: 14, alignItems: "center", justifyContent: "center", marginTop: 8, width: "100%" },
  outlineBtnText: { color: palette.primary, fontFamily: font.semibold, fontSize: 14 },
  disclaimerScreen: { flex: 1, backgroundColor: palette.bg },
  disclaimerHeaderRow: { flexDirection: "row", alignItems: "center", marginBottom: 12, marginTop: 8 },
  disclaimerShield: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#E2E8F0", alignItems: "center", justifyContent: "center", marginRight: 10 },
  disclaimerTitle: { color: palette.text, fontFamily: font.bold, fontSize: 30, marginBottom: 0, flex: 1, lineHeight: 34 },
  disclaimerP: { color: palette.muted, fontFamily: font.regular, fontSize: 14, lineHeight: 20, marginBottom: 8 },
  disclaimerCard: { backgroundColor: palette.surface, borderRadius: 24, borderWidth: 1, borderColor: palette.line, padding: 16, marginTop: 8 },
  disclaimerBulletRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 6 },
  disclaimerBulletDot: { width: 6, height: 6, borderRadius: 4, backgroundColor: "#94A3B8", marginTop: 7, marginRight: 8 },
  disclaimerBackText: { color: "#CBD5E1", fontFamily: font.medium, fontSize: 13 },
  card: { backgroundColor: palette.surface, borderRadius: 20, borderWidth: 1, borderColor: "#F1F5F9", padding: 14, marginBottom: 10 },
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
  homeBrand: { color: palette.text, fontFamily: font.semibold, fontSize: 21 },
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
  homeHeroCard: { borderRadius: 24, padding: 18, marginBottom: 10 },
  miniLabelLight: { color: "#CBD5E1", fontFamily: font.bold, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 6 },
  homeHeroTitle: { color: "#FFFFFF", fontFamily: font.bold, fontSize: 31, lineHeight: 36, marginBottom: 8 },
  homeHeroCopy: { color: "#E2E8F0", fontFamily: font.regular, fontSize: 14, lineHeight: 20 },
  uploadStatusPill: { marginTop: 12, marginBottom: 10, alignSelf: "flex-start", borderRadius: 999, borderWidth: 1, borderColor: "#334155", backgroundColor: "#0B1220", paddingHorizontal: 10, paddingVertical: 5, flexDirection: "row", alignItems: "center" },
  uploadStatusText: { color: "#E2E8F0", fontFamily: font.medium, fontSize: 12 },
  heroPrimaryBtn: { marginTop: 2, backgroundColor: "#111827" },
  homeTitle: { color: "#334155", fontFamily: font.regular, fontSize: 34, lineHeight: 40, marginBottom: 14 },
  homeStrong: { color: palette.text, fontFamily: font.semibold },
  imageWrap: { width: "100%", aspectRatio: 16 / 9, borderRadius: 22, overflow: "hidden", marginBottom: 12, borderWidth: 1, borderColor: palette.line },
  image: { width: "100%", height: "100%" },
  ctaInline: { flexDirection: "row", alignItems: "center", gap: 8 },
  outlineSoftBtn: { borderRadius: 16, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, paddingVertical: 14, alignItems: "center", justifyContent: "center", marginTop: 8 },
  outlineSoftText: { color: palette.muted, fontFamily: font.semibold, fontSize: 14 },
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
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    backgroundColor: palette.surface,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
  },
  optionIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: palette.surfaceSoft, alignItems: "center", justifyContent: "center", marginRight: 10 },
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
  metricCard: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 10 },
  metricRiskHigh: { backgroundColor: "#FEE2E2", borderColor: "#FECACA" },
  metricRiskMedium: { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" },
  metricRiskLow: { backgroundColor: "#DCFCE7", borderColor: "#BBF7D0" },
  metricCardNeutral: { flex: 1, borderWidth: 1, borderColor: palette.line, borderRadius: 14, padding: 10, backgroundColor: palette.surfaceSoft },
  metricLabel: { color: palette.subtle, fontFamily: font.bold, fontSize: 9, textTransform: "uppercase", letterSpacing: 1.05, marginBottom: 4 },
  metricValue: { color: palette.text, fontFamily: font.semibold, fontSize: 18 },
  metricTimeRow: { flexDirection: "row", alignItems: "center" },
  metricTimeText: { color: palette.muted, fontFamily: font.semibold, fontSize: 11, marginLeft: 5, flex: 1 },
  stepRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  stepDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center", marginRight: 8, marginTop: 2 },
  stepDotText: { color: palette.muted, fontFamily: font.bold, fontSize: 9 },
  stepText: { color: palette.muted, fontFamily: font.regular, fontSize: 13, lineHeight: 19, flex: 1 },
  verdictFooter: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 6 },
  verdictFooterText: { color: palette.subtle, fontFamily: font.medium, fontSize: 10, marginRight: 5 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  row: { flexDirection: "row", alignItems: "center" },
  dotStatus: { width: 9, height: 9, borderRadius: 99, backgroundColor: "#CBD5E1", marginRight: 6 },
  dotGood: { backgroundColor: palette.green },
  dotBad: { backgroundColor: "#B91C1C" },
  caseRow: { borderRadius: 14, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, padding: 10, marginTop: 8 },
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
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -18,
    borderWidth: 3,
    borderColor: palette.surface
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end"
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.45)"
  },
  sheetCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    gap: 8
  },
  sheetTitle: {
    color: palette.text,
    fontFamily: font.semibold,
    fontSize: 18
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
  sheetCaseNameInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: palette.text,
    fontFamily: font.medium,
    fontSize: 13
  },
  sheetInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 76,
    color: palette.text,
    fontFamily: font.regular,
    fontSize: 13,
    textAlignVertical: "top"
  },
  sheetActionBtn: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  sheetActionText: {
    color: palette.text,
    fontFamily: font.semibold,
    fontSize: 14
  },
  sheetCancelBtn: {
    marginTop: 4,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    paddingVertical: 12,
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
  categoryList: {
    maxHeight: 340
  },
  categoryListBody: {
    paddingBottom: 8
  },
  categoryOption: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 12,
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
    paddingHorizontal: 14,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    borderRightWidth: 1,
    borderColor: palette.line
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14
  },
  drawerItem: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8
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
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
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
    borderRadius: 22,
    padding: 14,
    marginBottom: 8
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
    letterSpacing: 1
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
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    padding: 14
  },
  tipIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
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
    borderWidth: 1
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
    width: 74,
    height: 74,
    borderRadius: 24,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12
  },
  accountAvatarText: {
    color: "#FFFFFF",
    fontFamily: font.bold,
    fontSize: 22
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
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F1F5F9",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 6,
    gap: 8
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
