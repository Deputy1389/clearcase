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
  userId: string;
  title: string | null;
  documentType: string | null;
  classificationConfidence: number | null;
  status: string;
  timeSensitive: boolean;
  earliestDeadline: string | null;
  jurisdictionZip: string | null;
  jurisdictionState: string | null;
  jurisdictionCounty: string | null;
  plainEnglishExplanation: string | null;
  nonLegalAdviceDisclaimer: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    assets: number;
    extractions: number;
    verdicts: number;
  };
};

export type Asset = {
  id: string;
  caseId: string;
  uploaderUserId: string;
  assetType: string;
  s3Key: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  createdAt: string;
};

export type Extraction = {
  id: string;
  caseId: string;
  assetId: string;
  engine: string;
  engineVersion: string | null;
  rawText: string;
  structuredFacts: unknown;
  status: string;
  createdAt: string;
};

export type Verdict = {
  id: string;
  caseId: string;
  extractionId: string | null;
  llmModel: string;
  inputHash: string;
  outputJson: unknown;
  status: string;
  createdAt: string;
};

export type AuditLog = {
  id: string;
  caseId: string | null;
  assetId: string | null;
  extractionId: string | null;
  verdictId: string | null;
  eventType: string;
  actorType: string;
  actorId: string | null;
  requestId: string | null;
  payload: unknown;
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  sessionId: string;
  sender: string;
  body: string;
  createdAt: string;
};

export type ChatSession = {
  id: string;
  caseId: string;
  userId: string;
  startedAt: string;
  closedAt: string | null;
  messages: ChatMessage[];
};

export type CaseDetail = CaseSummary & {
  assets: Asset[];
  extractions: Extraction[];
  verdicts: Verdict[];
  auditLogs: AuditLog[];
  chatSessions: ChatSession[];
};

export type CasesResponse = {
  cases: CaseSummary[];
};

export type CreateAssetResponse = {
  assetId: string;
  caseId: string;
  s3Key: string;
  uploadUrl: string;
  uploadMethod: "PUT";
  uploadHeaders: Record<string, string>;
  expiresInSeconds: number;
};

export type ApiError = Error & {
  status?: number;
  data?: unknown;
};

const apiBase = (import.meta.env.VITE_API_BASE ?? "/api").replace(/\/+$/, "");

async function requestJson<T>(
  path: string,
  init: RequestInit,
  authHeaders: Record<string, string>
): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...authHeaders,
      ...(init.headers ?? {})
    }
  });

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
    const err = new Error(`API ${response.status}`) as ApiError;
    err.status = response.status;
    err.data = maybeJson;
    throw err;
  }

  return maybeJson as T;
}

export async function getMe(authHeaders: Record<string, string>): Promise<MeResponse> {
  return requestJson<MeResponse>("/me", { method: "GET" }, authHeaders);
}

export async function patchMe(
  input: {
    fullName?: string;
    zipCode?: string;
  },
  authHeaders: Record<string, string>
): Promise<MeResponse> {
  return requestJson<MeResponse>(
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

export async function getCases(authHeaders: Record<string, string>): Promise<CasesResponse> {
  return requestJson<CasesResponse>("/cases", { method: "GET" }, authHeaders);
}

export async function createCase(
  title: string,
  authHeaders: Record<string, string>
): Promise<CaseSummary> {
  return requestJson<CaseSummary>(
    "/cases",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ title: title.trim() })
    },
    authHeaders
  );
}

export async function getCaseById(
  caseId: string,
  authHeaders: Record<string, string>
): Promise<CaseDetail> {
  return requestJson<CaseDetail>(`/cases/${caseId}`, { method: "GET" }, authHeaders);
}

export async function createCaseAsset(
  caseId: string,
  file: File,
  authHeaders: Record<string, string>
): Promise<CreateAssetResponse> {
  return requestJson<CreateAssetResponse>(
    `/cases/${caseId}/assets`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        byteSize: file.size
      })
    },
    authHeaders
  );
}

export async function uploadToPresignedUrl(
  file: File,
  uploadUrl: string,
  uploadMethod: string,
  uploadHeaders: Record<string, string>
): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: uploadMethod,
    headers: uploadHeaders,
    body: file
  });

  if (!response.ok) {
    const err = new Error(`Upload failed with ${response.status}`) as ApiError;
    err.status = response.status;
    throw err;
  }
}
