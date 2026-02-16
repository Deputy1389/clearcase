export type Screen = "language" | "onboarding" | "auth" | "home" | "workspace" | "cases" | "account" | "legal" | "legalAid" | "drafting";
export type ContentScreen = Exclude<Screen, "language">;
export type AuthMode = "selection" | "login" | "signup" | "disclaimer";
export type BannerTone = "info" | "good" | "bad";
export type ConnStatus = "unknown" | "ok" | "error";
export type UploadStage = "idle" | "picking" | "preparing" | "sending" | "processing";
export type CaseSeverity = "high" | "medium" | "low";
export type PlanTier = "free" | "plus";
export type AppLanguage = "en" | "es";
export type PlusFeatureGate = "watch_mode" | "consult_links";
export type StepProgress = "not_started" | "in_progress" | "done" | "deferred";
export type PremiumStepGroup = "now" | "this_week" | "before_consult" | "after_upload";

export type PremiumActionStep = {
  id: string;
  group: PremiumStepGroup;
  title: string;
  detail: string;
  consequenceIfIgnored: string;
  effort: string;
  confidence: "high" | "medium" | "low";
  receipts: string[];
};

export type UploadAssetInput = {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
};

export type WorkspaceAccordionKey =
  | "steps"
  | "watch"
  | "packet"
  | "context"
  | "category"
  | "summary"
  | "plain_meaning"
  | "timeline";

export type IntakeDraft = {
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

export type PaywallConfigState = {
  plusPriceMonthly: string;
  paywallVariant: string;
  showAlternatePlan: boolean;
  billingEnabled: boolean;
};

export type OnboardingSlide = {
  title: string;
  description: string;
  icon: "scale" | "search" | "book-open" | "shield" | "upload" | "edit-3" | "credit-card" | "clock";
  iconColor: string;
  iconBg: string;
};

export type ExtractedFields = {
  senderName?: string;
  senderEmail?: string;
  senderPhone?: string;
  senderAddress?: string;
  courtName?: string;
  courtAddress?: string;
  courtWebsite?: string;
  caseNumber?: string;
  website?: string;
  sources?: string[];
};

export type ManualCategoryOption = {
  value: string;
  label: string;
  labelEs: string;
};

export type PacketHistoryEntry = {
  version: number;
  reason: string;
  createdAt: string;
};
