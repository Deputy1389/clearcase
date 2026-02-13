export type AuthHeaders = {
  "x-auth-subject": string;
  "x-user-email": string;
};

export type PublicUser = {
  id: string;
  authProviderUserId: string;
  email: string;
  fullName: string | null;
  zipCode: string | null;
  jurisdictionState: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MeResponse = {
  user: PublicUser;
  needsProfile: boolean;
  entitlement: {
    id: string;
    plan: "free" | "plus";
    status: "active" | "revoked" | "trial";
    source: "manual" | "billing";
    startAt: string | null;
    endAt: string | null;
    isPlus: boolean;
    viaAllowlistFallback: boolean;
  };
  pushPreferences: {
    enabled: boolean;
    language: "en" | "es";
    quietHoursStart: string | null;
    quietHoursEnd: string | null;
  };
  pushDevices: {
    activeCount: number;
  };
};

export type CaseSummary = {
  id: string;
  title: string | null;
  documentType: string | null;
  classificationConfidence: number | null;
  status: string;
  timeSensitive: boolean;
  earliestDeadline: string | null;
  plainEnglishExplanation: string | null;
  nonLegalAdviceDisclaimer: string | null;
  updatedAt: string;
  _count?: {
    assets: number;
    extractions: number;
    verdicts: number;
  };
};

export type Asset = {
  id: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  createdAt: string;
  source?: "camera" | "file";
  processingStatus?: "pending" | "succeeded" | "failed";
  assetType?: string;
};

export type CaseAsset = {
  id: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  createdAt: string;
  source: "camera" | "file";
  processingStatus: "pending" | "succeeded" | "failed";
  assetType: string;
};

export type CaseAssetsResponse = {
  caseId: string;
  assets: CaseAsset[];
};

export type AssetAccessResponse = {
  caseId: string;
  assetId: string;
  action: "view" | "download";
  accessUrl: string;
  expiresInSeconds: number;
};

export type PlainMeaningRow = {
  id: string;
  originalText: string;
  plainMeaning: string;
  whyThisOftenMatters: string;
  commonlyPreparedItems: string[];
  receipts: Array<{
    assetId: string;
    fileName: string;
    pageHint: string | null;
    snippet: string;
    confidence: "high" | "medium" | "low";
  }>;
  uncertainty: string;
};

export type PlainMeaningResponse = {
  caseId: string;
  language: "en" | "es";
  rows: PlainMeaningRow[];
  boundary: string;
};

export type PaywallConfigResponse = {
  plusPriceMonthly: string;
  paywallVariant: string;
  showAlternatePlan: boolean;
  billingEnabled: boolean;
};

export type BillingCheckoutResponse = {
  provider: "internal_stub" | "stripe";
  sessionId: string;
  checkoutUrl: string;
  plusPriceMonthly: string;
  paywallVariant: string;
};

export type Extraction = {
  id: string;
  assetId: string;
  engine: string;
  structuredFacts: unknown;
  status: string;
  createdAt: string;
};

export type Verdict = {
  id: string;
  extractionId: string | null;
  llmModel: string;
  outputJson: unknown;
  status: string;
  createdAt: string;
};

export type AuditLog = {
  id: string;
  eventType: string;
  payload: unknown;
  createdAt: string;
};

export type CaseDetail = CaseSummary & {
  assets: Asset[];
  extractions: Extraction[];
  verdicts: Verdict[];
  auditLogs: AuditLog[];
};

export type CasesResponse = {
  cases: CaseSummary[];
};

export type UploadInitResponse = {
  assetId: string;
  caseId: string;
  uploadUrl: string;
  uploadMethod: "PUT";
  uploadHeaders: Record<string, string>;
};

export type UploadFinalizeResponse = {
  queued: boolean;
  messageId: string | null;
  caseId: string;
  assetId: string;
  contextReuse?: {
    reused: boolean;
    sourceCaseId: string | null;
  };
};

export type SaveCaseContextResponse = {
  saved: boolean;
  caseId: string;
  description: string;
};

export type ConsultPacketLink = {
  id: string;
  tokenPreview: string;
  createdAt: string;
  expiresAt: string;
  disabledAt: string | null;
  status: "active" | "expired" | "disabled";
  statusReason: "active" | "expired" | "disabled";
};

export type ConsultPacketLinksResponse = {
  caseId: string;
  links: ConsultPacketLink[];
};

export type CreateConsultPacketLinkResponse = {
  caseId: string;
  id: string;
  tokenPreview: string;
  shareUrl: string;
  createdAt: string;
  expiresAt: string;
  status: "active";
  statusReason: "active";
};

export type DisableConsultPacketLinkResponse = {
  caseId: string;
  id: string;
  disabled: boolean;
  status: "disabled";
  statusReason: "disabled";
};

export const MANUAL_DOCUMENT_TYPES = [
  "protective_order_notice",
  "family_court_notice",
  "small_claims_complaint",
  "summons_complaint",
  "subpoena_notice",
  "judgment_notice",
  "court_hearing_notice",
  "demand_letter",
  "eviction_notice",
  "foreclosure_default_notice",
  "repossession_notice",
  "landlord_security_deposit_notice",
  "lease_violation_notice",
  "debt_collection_notice",
  "wage_garnishment_notice",
  "tax_notice",
  "unemployment_benefits_denial",
  "workers_comp_denial_notice",
  "benefits_overpayment_notice",
  "insurance_denial_letter",
  "insurance_subrogation_notice",
  "incident_evidence_photo",
  "utility_shutoff_notice",
  "license_suspension_notice",
  "citation_ticket",
  "general_legal_notice",
  "non_legal_or_unclear_image",
  "unknown_legal_document"
] as const;

export type ManualDocumentType = (typeof MANUAL_DOCUMENT_TYPES)[number];

export type SetCaseClassificationResponse = {
  saved: boolean;
  case: CaseSummary;
};

export type SetCaseWatchModeResponse = {
  saved: boolean;
  caseId: string;
  enabled: boolean;
};

export type ApiError = Error & {
  status?: number;
  data?: unknown;
};

export type HealthResponse = {
  ok: boolean;
};

const DEFAULT_REQUEST_TIMEOUT_MS = 10000;
const HEALTH_REQUEST_TIMEOUT_MS = 5000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  if (init.signal) {
    if (init.signal.aborted) {
      controller.abort();
    } else {
      init.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if (controller.signal.aborted) {
      const timeoutError = new Error(`Request timed out after ${timeoutMs}ms`) as ApiError;
      timeoutError.data = { error: "TIMEOUT" };
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function requestJson<T>(
  apiBase: string,
  path: string,
  init: RequestInit,
  authHeaders: AuthHeaders
): Promise<T> {
  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${apiBase.replace(/\/+$/, "")}${path}`,
      {
        ...init,
        headers: {
          Accept: "application/json",
          ...authHeaders,
          ...(init.headers ?? {})
        }
      },
      DEFAULT_REQUEST_TIMEOUT_MS
    );
  } catch (error) {
    const networkError = new Error(`Network error contacting API at ${apiBase}`) as ApiError;
    networkError.data =
      error instanceof Error
        ? { error: "NETWORK_ERROR", detail: error.message }
        : { error: "NETWORK_ERROR", detail: String(error) };
    throw networkError;
  }

  const text = await response.text();
  let maybeJson: unknown = null;
  if (text) {
    try {
      maybeJson = JSON.parse(text) as unknown;
    } catch {
      maybeJson = text;
    }
  }

  if (!response.ok) {
    const error = new Error(`API ${response.status}`) as ApiError;
    error.status = response.status;
    error.data = maybeJson;
    throw error;
  }

  return maybeJson as T;
}

export async function getMe(apiBase: string, authHeaders: AuthHeaders): Promise<MeResponse> {
  return requestJson<MeResponse>(apiBase, "/me", { method: "GET" }, authHeaders);
}

export async function getHealth(apiBase: string): Promise<HealthResponse> {
  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${apiBase.replace(/\/+$/, "")}/health`,
      {
        method: "GET",
        headers: {
          Accept: "application/json"
        }
      },
      HEALTH_REQUEST_TIMEOUT_MS
    );
  } catch (error) {
    const networkError = new Error(`Health check failed for ${apiBase}`) as ApiError;
    networkError.data =
      error instanceof Error
        ? { error: "NETWORK_ERROR", detail: error.message }
        : { error: "NETWORK_ERROR", detail: String(error) };
    throw networkError;
  }

  if (!response.ok) {
    const error = new Error(`Health check failed (${response.status})`) as ApiError;
    error.status = response.status;
    throw error;
  }

  const body = (await response.json()) as HealthResponse;
  return body;
}

export async function patchMe(
  apiBase: string,
  authHeaders: AuthHeaders,
  input: { fullName?: string; zipCode?: string }
): Promise<MeResponse> {
  return requestJson<MeResponse>(
    apiBase,
    "/me",
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    },
    authHeaders
  );
}

export async function getNotificationPreferences(
  apiBase: string,
  authHeaders: AuthHeaders
): Promise<{
  pushPreferences: {
    enabled: boolean;
    language: "en" | "es";
    quietHoursStart: string | null;
    quietHoursEnd: string | null;
  };
}> {
  return requestJson(apiBase, "/me/notification-preferences", { method: "GET" }, authHeaders);
}

export async function patchNotificationPreferences(
  apiBase: string,
  authHeaders: AuthHeaders,
  input: {
    enabled?: boolean;
    language?: "en" | "es";
    quietHoursStart?: string | null;
    quietHoursEnd?: string | null;
  }
): Promise<{
  pushPreferences: {
    enabled: boolean;
    language: "en" | "es";
    quietHoursStart: string | null;
    quietHoursEnd: string | null;
  };
}> {
  return requestJson(
    apiBase,
    "/me/notification-preferences",
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    },
    authHeaders
  );
}

export async function registerPushDevice(
  apiBase: string,
  authHeaders: AuthHeaders,
  input: {
    deviceId: string;
    platform: "ios" | "android" | "web";
    token: string;
    language?: "en" | "es";
  }
): Promise<{
  registered: boolean;
  deviceId: string;
  platform: "ios" | "android" | "web";
  language: "en" | "es";
}> {
  return requestJson(
    apiBase,
    "/me/push-devices/register",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    },
    authHeaders
  );
}

export async function getCases(apiBase: string, authHeaders: AuthHeaders): Promise<CasesResponse> {
  try {
    return await requestJson<CasesResponse>(apiBase, "/cases", { method: "GET" }, authHeaders);
  } catch (error) {
    const apiError = error as ApiError;
    if (apiError?.status === 404) {
      return { cases: [] };
    }
    throw error;
  }
}

export async function createCase(
  apiBase: string,
  authHeaders: AuthHeaders,
  title: string
): Promise<CaseSummary> {
  return requestJson<CaseSummary>(
    apiBase,
    "/cases",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ title })
    },
    authHeaders
  );
}

export async function getCaseById(
  apiBase: string,
  authHeaders: AuthHeaders,
  caseId: string
): Promise<CaseDetail> {
  return requestJson<CaseDetail>(apiBase, `/cases/${caseId}`, { method: "GET" }, authHeaders);
}

export async function createAssetUploadPlan(
  apiBase: string,
  authHeaders: AuthHeaders,
  caseId: string,
  input: {
    fileName: string;
    mimeType: string;
    byteSize: number;
  }
): Promise<UploadInitResponse> {
  return requestJson<UploadInitResponse>(
    apiBase,
    `/cases/${caseId}/assets`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    },
    authHeaders
  );
}

export async function finalizeAssetUpload(
  apiBase: string,
  authHeaders: AuthHeaders,
  caseId: string,
  assetId: string,
  input?: {
    userDescription?: string;
  }
): Promise<UploadFinalizeResponse> {
  return requestJson<UploadFinalizeResponse>(
    apiBase,
    `/cases/${caseId}/assets/${assetId}/finalize`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input ?? {})
    },
    authHeaders
  );
}

export async function saveCaseContext(
  apiBase: string,
  authHeaders: AuthHeaders,
  caseId: string,
  description: string
): Promise<SaveCaseContextResponse> {
  return requestJson<SaveCaseContextResponse>(
    apiBase,
    `/cases/${caseId}/context`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ description })
    },
    authHeaders
  );
}

export async function setCaseClassification(
  apiBase: string,
  authHeaders: AuthHeaders,
  caseId: string,
  documentType: ManualDocumentType
): Promise<SetCaseClassificationResponse> {
  return requestJson<SetCaseClassificationResponse>(
    apiBase,
    `/cases/${caseId}/classification`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ documentType })
    },
    authHeaders
  );
}

export async function setCaseWatchMode(
  apiBase: string,
  authHeaders: AuthHeaders,
  caseId: string,
  enabled: boolean
): Promise<SetCaseWatchModeResponse> {
  return requestJson<SetCaseWatchModeResponse>(
    apiBase,
    `/cases/${caseId}/watch-mode`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ enabled })
    },
    authHeaders
  );
}

export async function getConsultPacketLinks(
  apiBase: string,
  authHeaders: AuthHeaders,
  caseId: string
): Promise<ConsultPacketLinksResponse> {
  return requestJson<ConsultPacketLinksResponse>(
    apiBase,
    `/cases/${caseId}/consult-packet-links`,
    { method: "GET" },
    authHeaders
  );
}

export async function createConsultPacketLink(
  apiBase: string,
  authHeaders: AuthHeaders,
  caseId: string,
  input?: { expiresInDays?: number }
): Promise<CreateConsultPacketLinkResponse> {
  return requestJson<CreateConsultPacketLinkResponse>(
    apiBase,
    `/cases/${caseId}/consult-packet-links`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input ?? {})
    },
    authHeaders
  );
}

export async function disableConsultPacketLink(
  apiBase: string,
  authHeaders: AuthHeaders,
  caseId: string,
  token: string
): Promise<DisableConsultPacketLinkResponse> {
  return requestJson<DisableConsultPacketLinkResponse>(
    apiBase,
    `/cases/${caseId}/consult-packet-links/${token}/disable`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: "{}"
    },
    authHeaders
  );
}

export async function getCaseAssets(
  apiBase: string,
  authHeaders: AuthHeaders,
  caseId: string
): Promise<CaseAssetsResponse> {
  return requestJson<CaseAssetsResponse>(
    apiBase,
    `/cases/${caseId}/assets`,
    { method: "GET" },
    authHeaders
  );
}

export async function getCaseAssetAccess(
  apiBase: string,
  authHeaders: AuthHeaders,
  caseId: string,
  assetId: string,
  action: "view" | "download"
): Promise<AssetAccessResponse> {
  return requestJson<AssetAccessResponse>(
    apiBase,
    `/cases/${caseId}/assets/${assetId}/access?action=${encodeURIComponent(action)}`,
    { method: "GET" },
    authHeaders
  );
}

export async function getPlainMeaning(
  apiBase: string,
  authHeaders: AuthHeaders,
  caseId: string,
  language: "en" | "es"
): Promise<PlainMeaningResponse> {
  return requestJson<PlainMeaningResponse>(
    apiBase,
    `/cases/${caseId}/plain-meaning?language=${encodeURIComponent(language)}`,
    { method: "GET" },
    authHeaders
  );
}

export async function getPaywallConfig(
  apiBase: string,
  authHeaders: AuthHeaders
): Promise<PaywallConfigResponse> {
  return requestJson<PaywallConfigResponse>(
    apiBase,
    "/config/paywall",
    { method: "GET" },
    authHeaders
  );
}

export async function trackEvent(
  apiBase: string,
  authHeaders: AuthHeaders,
  input: {
    event: string;
    source?: string;
    locale?: "en" | "es";
    paywallVariant?: string;
    properties?: Record<string, unknown>;
  }
): Promise<{ tracked: boolean }> {
  return requestJson<{ tracked: boolean }>(
    apiBase,
    "/events/track",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    },
    authHeaders
  );
}

export async function createBillingCheckout(
  apiBase: string,
  authHeaders: AuthHeaders,
  input: {
    plan?: "plus_monthly";
    successUrl?: string;
    cancelUrl?: string;
    triggerSource?: string;
    locale?: "en" | "es";
  }
): Promise<BillingCheckoutResponse> {
  return requestJson<BillingCheckoutResponse>(
    apiBase,
    "/billing/checkout",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    },
    authHeaders
  );
}
