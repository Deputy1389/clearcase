import type { CaseSummary, CaseDetail, CaseAsset, MeResponse, ConsultPacketLink, PlainMeaningRow, ManualDocumentType } from "../api";
import type { AppLanguage, BannerTone, ConnStatus, PlanTier, Screen, ContentScreen, UploadStage, CaseSeverity, WorkspaceAccordionKey, StepProgress, PremiumActionStep, IntakeDraft, PaywallConfigState } from "../types";
import type { TimelineRow } from "../hooks/controllers/workspace/workspaceDerived";

// Navigation bundle
export interface NavigationBundle {
  screen: Screen;
  setScreen: (s: Screen) => void;
  goBack: () => void;
  postLanguageScreen: ContentScreen;
  setPostLanguageScreen: (s: ContentScreen) => void;
  setDrawerOpen: (open: boolean) => void;
}

// Cases bundle
export interface CasesBundle {
  cases: CaseSummary[];
  setCases: React.Dispatch<React.SetStateAction<CaseSummary[]>>;
  selectedCaseId: string | null;
  setSelectedCaseId: (id: string | null) => void;
  selectedCase: CaseDetail | null;
  setSelectedCase: React.Dispatch<React.SetStateAction<CaseDetail | null>>;
  selectedCaseSummary: CaseSummary | null;
  latestCase: CaseSummary | null;
  filteredCases: CaseSummary[];
  caseSearch: string;
  setCaseSearch: (value: string) => void;
  caseFilter: "all" | "active" | "urgent" | "archived";
  setCaseFilter: (value: any) => void;
  caseAssets: CaseAsset[];
  setCaseAssets: React.Dispatch<React.SetStateAction<CaseAsset[]>>;
  loadingCaseAssets: boolean;
  setLoadingCaseAssets: React.Dispatch<React.SetStateAction<boolean>>;
  loadingDashboard: boolean;
  loadingCase: boolean;
  creatingCase: boolean;
  savingProfile: boolean;
  refreshing: boolean;
  userFirstName: string;
  me: MeResponse | null;
  setMe: React.Dispatch<React.SetStateAction<MeResponse | null>>;
  profileName: string;
  setProfileName: (value: string) => void;
  profileZip: string;
  setProfileZip: (value: string) => void;
  newCaseTitle: string;
  setNewCaseTitle: (value: string) => void;
  // Actions
  loadDashboard: (base?: string, auth?: any) => Promise<void>;
  loadCase: (caseId: string, base?: string, auth?: any) => Promise<void>;
  loadCaseAssetsForSelectedCase: (caseId: string, base?: string, auth?: any) => Promise<void>;
  createCaseWithTitle: (title?: string) => Promise<string | null | void>;
  saveProfile: () => Promise<void>;
  refreshWorkspace: () => Promise<void>;
  reconnectWorkspace: () => Promise<void>;
}

// Upload bundle
export interface UploadBundle {
  uploading: boolean;
  setUploading?: React.Dispatch<React.SetStateAction<boolean>>;
  uploadStage: UploadStage;
  setUploadStage?: React.Dispatch<React.SetStateAction<UploadStage>>;
  uploadDescription: string;
  setUploadDescription: (value: string) => void;
  uploadTargetCaseId: string | null;
  setUploadTargetCaseId: React.Dispatch<React.SetStateAction<string | null>>;
  uploadCaseTitle: string;
  setUploadCaseTitle: (value: string) => void;
  uploadSheetOpen: boolean;
  setUploadSheetOpen: React.Dispatch<React.SetStateAction<boolean>>;
  latestContextReuseSourceCaseId: string | null;
  setLatestContextReuseSourceCaseId: React.Dispatch<React.SetStateAction<string | null>>;
  uploadStatusText: string;
  // Actions
  uploadAssets: (assets: any[], caseIdArg?: string, userDescription?: string, preferredCaseTitle?: string) => Promise<void>;
  uploadDocument: (caseIdArg?: string, userDescription?: string, preferredCaseTitle?: string) => Promise<void>;
  uploadFromCamera: (caseIdArg?: string, userDescription?: string, preferredCaseTitle?: string) => Promise<void>;
  beginFileUpload: () => Promise<void>;
  beginCameraUpload: () => Promise<void>;
  homeUploadFlow: () => Promise<void>;
  openUploadSheetForCase: (caseId: string | null) => Promise<void>;
  waitForCaseInsight: (caseId: string, maxWaitMs?: number) => Promise<CaseDetail | null>;
}

// Paywall bundle
export interface PaywallBundle {
  paywallConfig: PaywallConfigState;
  planTier: PlanTier;
  setPlanTier: React.Dispatch<React.SetStateAction<PlanTier>>;
  plusEnabled: boolean;
  startingCheckout: boolean;
  planSheetOpen: boolean;
  setPlanSheetOpen: React.Dispatch<React.SetStateAction<boolean>>;
  // Actions
  startPlusCheckout: (source?: string) => Promise<void>;
  openPaywall: (triggerSource?: string) => void;
  promptPlusUpgrade: (feature?: string) => void;
  loadPaywallConfigState: (base?: string, auth?: any) => Promise<void>;
}

// UI bundle
export interface UiBundle {
  language: AppLanguage;
  setLanguage: React.Dispatch<React.SetStateAction<AppLanguage>>;
  applyLanguageFromSettings: (lang: AppLanguage) => Promise<void>;
  styles: any;
  palette: any;
  offlineMode: boolean;
  showBanner: (tone: BannerTone, text: string) => void;
  hapticTap: () => void;
}

// Auth bundle
export interface AuthBundle {
  email: string;
  accountInitials: string;
  completion: number;
  signOut: () => Promise<void>;
}

// Workspace bundle (workspace-specific state)
export interface WorkspaceBundle {
  // Workspace state
  workspaceSeverity: CaseSeverity;
  workspaceSummaryText: string;
  workspaceNextSteps?: string[];
  workspaceSectionMeta: Record<WorkspaceAccordionKey, { title: string; summary: string }>;
  workspaceSectionOpen: Record<WorkspaceAccordionKey, boolean>;
  toggleWorkspaceSection: (key: WorkspaceAccordionKey) => void;
  workspaceChecklistItems: { id: string; text: string }[];
  premiumStepSummaryLine: string | null;
  // Case watch
  caseWatchEnabled: boolean;
  savingWatchMode: boolean;
  toggleCaseWatchMode: () => Promise<void>;
  weeklyCheckInStatus: string;
  weeklyCheckInAction: string;
  watchMicroEvents: string[];
  // Consult links
  consultLinks: ConsultPacketLink[];
  loadingConsultLinks: boolean;
  creatingConsultLink: boolean;
  disablingConsultToken: string | null;
  loadConsultPacketLinks?: (caseId: string) => Promise<void>;
  createConsultPacketShareLink: () => Promise<void>;
  disableConsultPacketShareLink: (linkId: string) => Promise<void>;
  packetShareStatusLine: string;
  packetHistoryEntries?: { version: number; reason: string; createdAt: string }[];
  // Case context
  caseContextDraft: string;
  setCaseContextDraft: (value: string) => void;
  savingCaseContext: boolean;
  saveCaseContextForSelectedCase: () => Promise<void>;
  // Classification
  classificationSheetOpen: boolean;
  setClassificationSheetOpen: React.Dispatch<React.SetStateAction<boolean>>;
  classificationDraft: ManualDocumentType;
  setClassificationDraft: React.Dispatch<React.SetStateAction<ManualDocumentType>>;
  savingClassification: boolean;
  openManualCategoryPicker: () => void;
  saveManualCategoryForSelectedCase: () => Promise<void>;
  // Plain meaning
  plainMeaningOpen?: boolean;
  setPlainMeaningOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  plainMeaningRows?: PlainMeaningRow[];
  plainMeaningBoundary?: string;
  loadingPlainMeaning: boolean;
  openPlainMeaningTranslator: () => Promise<void>;
  // Lawyer summary
  lawyerSummaryOpen: boolean;
  setLawyerSummaryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  lawyerReadySummary: {
    caseTitle: string;
    summary: string;
    facts: string[];
    dates: string[];
    parties: string[];
    openQuestions: string[];
    evidence: string[];
    intakeOverview: string[];
    communicationsLog: string;
    financialImpact: string;
    desiredOutcome: string;
    consultAgenda: string[];
    nextSteps: string[];
    disclaimer: string;
  };
  shareLawyerReadySummary: () => Promise<void>;
  emailLawyerReadySummary: () => Promise<void>;
  // Intake
  intakeModalOpen: boolean;
  setIntakeModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  intakeDraft: IntakeDraft;
  setIntakeDraft: React.Dispatch<React.SetStateAction<IntakeDraft>>;
  intakeCompleteness: number;
  stepProgressMap: Record<string, StepProgress>;
  setStepProgress: (stepId: string, next: StepProgress) => void;
  intakeSectionLabel: (key: keyof IntakeDraft) => string;
  intakePlaceholder: (key: keyof IntakeDraft) => string;
  stepGroupLabel: (group: any) => string;
  // Premium steps
  premiumActionSteps: PremiumActionStep[];
  groupedPremiumSteps: Record<string, PremiumActionStep[]>;
  // Timeline rows (deadline candidates)
  timelineRows?: TimelineRow[];
  // Evidence
  evidenceCompleteness: { score: number; status: string; missing: string[] };
  // Cost saving
  costSavingIndicator: { low: number; high: number; confidence: string; message: string; assumptions: string };
  // Asset viewer
  assetViewerOpen: boolean;
  setAssetViewerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  assetViewerAsset: CaseAsset | null;
  assetViewerUrl: string | null;
  assetViewerLoading: boolean;
  assetViewerIsPdf?: boolean;
  assetViewerIsImage?: boolean;
  assetViewerRenderUrl: string | null;
  assetViewerPdfPage: number;
  setAssetViewerPdfPage: React.Dispatch<React.SetStateAction<number>>;
  assetViewerPdfZoom: number;
  setAssetViewerPdfZoom: React.Dispatch<React.SetStateAction<number>>;
  assetViewerImageZoom: number;
  setAssetViewerImageZoom: React.Dispatch<React.SetStateAction<number>>;
  assetViewerImagePan: { x: number; y: number };
  setAssetViewerImagePan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  openAssetAccess: (assetId: string, action: "view" | "download") => Promise<void>;
  closeAssetViewer: () => void;
  openViewerUrlExternally: () => Promise<void>;
}

// Push notifications bundle
export interface PushBundle {
  pushEnabled: boolean;
  pushQuietHoursEnabled: boolean;
  savingPushPreferences: boolean;
  togglePushNotifications: () => Promise<void>;
  togglePushQuietHours: () => Promise<void>;
}

// Legal bundle
export interface LegalBundle {
  legalReturnScreen: Screen;
  setLegalReturnScreen: (s: Screen) => void;
}

// Helper functions bundle
export interface HelpersBundle {
  localizedCaseStatus: (value: string | null | undefined, language?: AppLanguage) => string;
  formatUploadStage: (stage: UploadStage, language?: AppLanguage) => string;
  titleize: (str: string) => string;
  fmtDate: (date: string | null | undefined, language?: AppLanguage) => string;
  fmtDateTime: (date: string | null | undefined) => string;
  manualCategoryLabel: (type: string | null, language?: AppLanguage) => string;
  casePriorityLevel: (row: CaseSummary) => "high" | "medium" | "low";
  casePriorityLabel: (row: CaseSummary, language?: AppLanguage) => string;
  severityLabel: (severity: CaseSeverity, language?: AppLanguage) => string;
  severitySummary: (severity: CaseSeverity, language?: AppLanguage) => string;
}

// Complete screen props
export interface HomeScreenProps {
  navigation: NavigationBundle;
  cases: CasesBundle;
  upload: UploadBundle;
  paywall: PaywallBundle;
  ui: UiBundle;
  auth: AuthBundle;
  helpers: HelpersBundle;
}

export interface WorkspaceScreenProps {
  navigation: NavigationBundle;
  cases: CasesBundle;
  upload: UploadBundle;
  paywall: PaywallBundle;
  ui: UiBundle;
  auth: AuthBundle;
  workspace: WorkspaceBundle;
  push: PushBundle;
  legal: LegalBundle;
  helpers: HelpersBundle;
}

export interface CasesScreenProps {
  navigation: NavigationBundle;
  cases: CasesBundle;
  upload: UploadBundle;
  ui: UiBundle;
  helpers: HelpersBundle;
}
