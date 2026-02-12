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
};

export type SaveCaseContextResponse = {
  saved: boolean;
  caseId: string;
  description: string;
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
