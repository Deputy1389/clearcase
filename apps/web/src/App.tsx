import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  createCase,
  createCaseAsset,
  getCaseById,
  getCases,
  getMe,
  patchMe,
  uploadToPresignedUrl,
  type ApiError,
  type CaseDetail,
  type CaseSummary,
  type MeResponse
} from "./lib/api.ts";

type Notice = {
  tone: "success" | "error" | "info";
  text: string;
};

const AUTH_SUBJECT_KEY = "clearcase-web-auth-subject";
const AUTH_EMAIL_KEY = "clearcase-web-auth-email";
const DEFAULT_AUTH_SUBJECT = "dev-subject-0001";
const DEFAULT_AUTH_EMAIL = "dev+dev-subject-0001@clearcase.local";

function readLocalStorageOrDefault(key: string, fallback: string): string {
  if (typeof window === "undefined") {
    return fallback;
  }
  const stored = window.localStorage.getItem(key);
  return stored?.trim() ? stored.trim() : fallback;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) {
    return "Not available";
  }
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return iso;
  }
  return parsed.toLocaleString();
}

function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) {
    return "None detected";
  }
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return iso;
  }
  return parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function titleCase(value: string): string {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((segment) => segment[0]?.toUpperCase() + segment.slice(1).toLowerCase())
    .join(" ");
}

function summarizeApiError(error: unknown): string {
  if (!error) {
    return "Unknown error";
  }
  if (error instanceof Error) {
    const maybeApi = error as ApiError;
    if (maybeApi.data && typeof maybeApi.data === "object") {
      const maybeErrorCode = (maybeApi.data as Record<string, unknown>).error;
      if (typeof maybeErrorCode === "string") {
        return `${error.message} (${maybeErrorCode})`;
      }
    }
    return error.message;
  }
  return String(error);
}

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function latestByCreatedAt<T extends { createdAt: string }>(rows: T[]): T | null {
  if (rows.length === 0) {
    return null;
  }
  const sorted = [...rows].sort((a, b) => (a.createdAt > b.createdAt ? -1 : a.createdAt < b.createdAt ? 1 : 0));
  return sorted[0];
}

function App() {
  const [authSubject, setAuthSubject] = useState<string>(() =>
    readLocalStorageOrDefault(AUTH_SUBJECT_KEY, DEFAULT_AUTH_SUBJECT)
  );
  const [authEmail, setAuthEmail] = useState<string>(() =>
    readLocalStorageOrDefault(AUTH_EMAIL_KEY, DEFAULT_AUTH_EMAIL)
  );
  const [me, setMe] = useState<MeResponse | null>(null);
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<CaseDetail | null>(null);
  const [profileNameInput, setProfileNameInput] = useState("");
  const [profileZipInput, setProfileZipInput] = useState("");
  const [newCaseTitle, setNewCaseTitle] = useState("");
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isLoadingCore, setIsLoadingCore] = useState(false);
  const [isLoadingCase, setIsLoadingCase] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isCreatingCase, setIsCreatingCase] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const authHeaders = useMemo(
    () => ({
      "x-auth-subject": authSubject.trim() || DEFAULT_AUTH_SUBJECT,
      "x-user-email": authEmail.trim() || DEFAULT_AUTH_EMAIL
    }),
    [authEmail, authSubject]
  );

  useEffect(() => {
    window.localStorage.setItem(AUTH_SUBJECT_KEY, authSubject);
  }, [authSubject]);

  useEffect(() => {
    window.localStorage.setItem(AUTH_EMAIL_KEY, authEmail);
  }, [authEmail]);

  useEffect(() => {
    let isCancelled = false;
    async function loadCoreData(): Promise<void> {
      setIsLoadingCore(true);
      setNotice(null);
      try {
        const [meData, caseData] = await Promise.all([getMe(authHeaders), getCases(authHeaders)]);
        if (isCancelled) {
          return;
        }
        setMe(meData);
        setCases(caseData.cases);
        setProfileNameInput(meData.user.fullName ?? "");
        setProfileZipInput(meData.user.zipCode ?? "");

        setSelectedCaseId((current) => {
          const validCurrent = current && caseData.cases.some((item) => item.id === current);
          return validCurrent ? current : (caseData.cases[0]?.id ?? null);
        });
      } catch (error) {
        if (isCancelled) {
          return;
        }
        setNotice({ tone: "error", text: `Failed to load dashboard: ${summarizeApiError(error)}` });
      } finally {
        if (!isCancelled) {
          setIsLoadingCore(false);
        }
      }
    }

    void loadCoreData();

    return () => {
      isCancelled = true;
    };
  }, [authHeaders]);

  useEffect(() => {
    if (!selectedCaseId) {
      setSelectedCase(null);
      return;
    }
    const caseId = selectedCaseId;

    let isCancelled = false;
    async function loadCaseDetail(): Promise<void> {
      setIsLoadingCase(true);
      try {
        const found = await getCaseById(caseId, authHeaders);
        if (!isCancelled) {
          setSelectedCase(found);
        }
      } catch (error) {
        if (!isCancelled) {
          setSelectedCase(null);
          setNotice({ tone: "error", text: `Failed to load case detail: ${summarizeApiError(error)}` });
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingCase(false);
        }
      }
    }

    void loadCaseDetail();

    return () => {
      isCancelled = true;
    };
  }, [authHeaders, selectedCaseId]);

  const latestExtraction = selectedCase ? latestByCreatedAt(selectedCase.extractions) : null;
  const latestVerdict = selectedCase ? latestByCreatedAt(selectedCase.verdicts) : null;

  const pipelineSteps = selectedCase
    ? [
        { label: "Asset Uploaded", done: selectedCase.assets.length > 0 },
        { label: "OCR Extracted", done: selectedCase.extractions.length > 0 },
        {
          label: "Truth Layer",
          done:
            selectedCase.documentType !== null ||
            selectedCase.classificationConfidence !== null ||
            selectedCase.earliestDeadline !== null
        },
        { label: "Formatter Verdict", done: selectedCase.verdicts.length > 0 }
      ]
    : [];

  async function handleProfileSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSavingProfile(true);
    setNotice(null);
    try {
      const payload: { fullName?: string; zipCode?: string } = {};
      const normalizedName = profileNameInput.trim();
      const normalizedZip = profileZipInput.trim();
      if (normalizedName) {
        payload.fullName = normalizedName;
      }
      if (normalizedZip) {
        payload.zipCode = normalizedZip;
      }
      const updated = await patchMe(payload, authHeaders);
      setMe(updated);
      setNotice({ tone: "success", text: "Profile updated." });
    } catch (error) {
      setNotice({ tone: "error", text: `Profile update failed: ${summarizeApiError(error)}` });
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleCreateCase(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmed = newCaseTitle.trim();
    if (!trimmed) {
      setNotice({ tone: "info", text: "Enter a case title first." });
      return;
    }

    setIsCreatingCase(true);
    setNotice(null);
    try {
      const created = await createCase(trimmed, authHeaders);
      setNewCaseTitle("");
      const refreshed = await getCases(authHeaders);
      setCases(refreshed.cases);
      setSelectedCaseId(created.id);
      setNotice({ tone: "success", text: "Case created." });
    } catch (error) {
      setNotice({ tone: "error", text: `Case creation failed: ${summarizeApiError(error)}` });
    } finally {
      setIsCreatingCase(false);
    }
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedCaseId) {
      setNotice({ tone: "info", text: "Create or select a case first." });
      return;
    }
    if (!selectedUploadFile) {
      setNotice({ tone: "info", text: "Choose a file to upload." });
      return;
    }

    setIsUploading(true);
    setNotice(null);
    try {
      const plan = await createCaseAsset(selectedCaseId, selectedUploadFile, authHeaders);
      await uploadToPresignedUrl(selectedUploadFile, plan.uploadUrl, plan.uploadMethod, plan.uploadHeaders);

      const [refreshedList, refreshedCase] = await Promise.all([
        getCases(authHeaders),
        getCaseById(selectedCaseId, authHeaders)
      ]);
      setCases(refreshedList.cases);
      setSelectedCase(refreshedCase);
      setSelectedUploadFile(null);
      setNotice({
        tone: "success",
        text: "Upload complete. Worker processing will appear as extractions and verdicts."
      });
    } catch (error) {
      setNotice({ tone: "error", text: `Upload failed: ${summarizeApiError(error)}` });
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="app-shell">
      <div className="bg-aura" />
      <div className="bg-grid" />
      <header className="hero panel">
        <div className="hero-headline">
          <p className="eyebrow">ClearCase</p>
          <h1>Legal clarity workflow</h1>
          <p className="subtle">
            Upload a legal document, track extraction and deadline signals, and get a plain-language summary with
            receipts.
          </p>
        </div>
        <form className="auth-form" onSubmit={(event) => event.preventDefault()}>
          <label>
            Subject
            <input
              value={authSubject}
              onChange={(event) => setAuthSubject(event.target.value)}
              placeholder={DEFAULT_AUTH_SUBJECT}
            />
          </label>
          <label>
            Email
            <input
              value={authEmail}
              onChange={(event) => setAuthEmail(event.target.value)}
              placeholder={DEFAULT_AUTH_EMAIL}
              type="email"
            />
          </label>
          <p className="hint">Dev auth headers are sent with each API request.</p>
        </form>
      </header>

      {notice ? <div className={`notice notice-${notice.tone}`}>{notice.text}</div> : null}

      <div className="workspace">
        <aside className="panel side-panel">
          <section className="stacked-card">
            <div className="section-title-row">
              <h2>Profile</h2>
              {me?.needsProfile ? <span className="pill pill-warn">Needs setup</span> : <span className="pill">Ready</span>}
            </div>
            <form onSubmit={handleProfileSave} className="form-grid">
              <label>
                Full name
                <input
                  value={profileNameInput}
                  onChange={(event) => setProfileNameInput(event.target.value)}
                  placeholder="Jane Doe"
                />
              </label>
              <label>
                ZIP
                <input value={profileZipInput} onChange={(event) => setProfileZipInput(event.target.value)} placeholder="94103" />
              </label>
              <button type="submit" disabled={isSavingProfile}>
                {isSavingProfile ? "Saving..." : "Save profile"}
              </button>
            </form>
            <p className="meta">
              Jurisdiction state: <strong>{me?.user.jurisdictionState ?? "Unknown"}</strong>
            </p>
          </section>

          <section className="stacked-card">
            <h2>Create case</h2>
            <form onSubmit={handleCreateCase} className="form-grid">
              <label>
                Case title
                <input
                  value={newCaseTitle}
                  onChange={(event) => setNewCaseTitle(event.target.value)}
                  placeholder="Eviction notice from landlord"
                />
              </label>
              <button type="submit" disabled={isCreatingCase}>
                {isCreatingCase ? "Creating..." : "Create case"}
              </button>
            </form>
          </section>

          <section className="stacked-card case-list-card">
            <div className="section-title-row">
              <h2>Cases</h2>
              <span className="pill">{cases.length}</span>
            </div>
            {isLoadingCore ? <p className="meta">Refreshing cases...</p> : null}
            <div className="case-list">
              {cases.map((item) => {
                const isActive = item.id === selectedCaseId;
                return (
                  <button
                    key={item.id}
                    className={`case-row ${isActive ? "active" : ""}`}
                    onClick={() => setSelectedCaseId(item.id)}
                    type="button"
                  >
                    <span className="case-row-title">{item.title ?? "Untitled case"}</span>
                    <span className="case-row-meta">
                      {titleCase(item.status)} | {item._count?.assets ?? 0} files
                    </span>
                  </button>
                );
              })}
              {cases.length === 0 ? <p className="meta">No cases yet. Create your first case above.</p> : null}
            </div>
          </section>
        </aside>

        <main className="panel detail-panel">
          {!selectedCaseId ? (
            <div className="empty-state">
              <h2>No case selected</h2>
              <p>Create a case to start uploads and pipeline processing.</p>
            </div>
          ) : isLoadingCase ? (
            <div className="empty-state">
              <h2>Loading case</h2>
              <p>Pulling latest assets, extraction, truth layer, and verdicts.</p>
            </div>
          ) : !selectedCase ? (
            <div className="empty-state">
              <h2>Case not available</h2>
              <p>Try reloading or selecting another case from the sidebar.</p>
            </div>
          ) : (
            <>
              <section className="detail-headline">
                <div>
                  <p className="eyebrow">Case detail</p>
                  <h2>{selectedCase.title ?? "Untitled case"}</h2>
                  <p className="meta">Updated {formatDateTime(selectedCase.updatedAt)}</p>
                </div>
                <span className={`status-chip status-${selectedCase.timeSensitive ? "hot" : "calm"}`}>
                  {selectedCase.timeSensitive ? "Time sensitive" : "Not flagged urgent"}
                </span>
              </section>

              <section className="metric-grid">
                <article className="metric-card">
                  <p>Document type</p>
                  <h3>{selectedCase.documentType ? titleCase(selectedCase.documentType) : "Unknown"}</h3>
                </article>
                <article className="metric-card">
                  <p>Earliest deadline</p>
                  <h3>{formatDateOnly(selectedCase.earliestDeadline)}</h3>
                </article>
                <article className="metric-card">
                  <p>Confidence</p>
                  <h3>
                    {selectedCase.classificationConfidence !== null
                      ? `${Math.round(selectedCase.classificationConfidence * 100)}%`
                      : "None"}
                  </h3>
                </article>
                <article className="metric-card">
                  <p>Pipeline</p>
                  <h3>{selectedCase.verdicts.length > 0 ? "Ready" : "Processing"}</h3>
                </article>
              </section>

              <section className="stacked-card">
                <h2>Upload document</h2>
                <form onSubmit={handleUpload} className="upload-row">
                  <label className="file-picker">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(event) => setSelectedUploadFile(event.target.files?.[0] ?? null)}
                    />
                    <span>{selectedUploadFile ? selectedUploadFile.name : "Choose image or PDF"}</span>
                  </label>
                  <button type="submit" disabled={isUploading}>
                    {isUploading ? "Uploading..." : "Upload"}
                  </button>
                </form>
                <p className="hint">Upload creates an asset record and sends to worker pipeline via SQS.</p>
              </section>

              <section className="stacked-card">
                <h2>Pipeline status</h2>
                <div className="pipeline">
                  {pipelineSteps.map((step, index) => (
                    <div className={`pipeline-step ${step.done ? "done" : "pending"}`} key={step.label}>
                      <span className="dot">{index + 1}</span>
                      <div>
                        <strong>{step.label}</strong>
                        <p>{step.done ? "Complete" : "Waiting"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="stacked-card">
                <h2>Plain-English summary</h2>
                <p className="explanation">
                  {selectedCase.plainEnglishExplanation ??
                    "No explanation yet. It will populate after extraction and formatter stages complete."}
                </p>
                <p className="disclaimer">
                  {selectedCase.nonLegalAdviceDisclaimer ?? "For informational purposes only; not legal advice."}
                </p>
              </section>

              <section className="stacked-card">
                <h2>Receipts and evidence</h2>
                <div className="receipt-grid">
                  <article>
                    <h3>Assets ({selectedCase.assets.length})</h3>
                    <ul>
                      {selectedCase.assets.map((asset) => (
                        <li key={asset.id}>
                          <strong>{asset.fileName}</strong>
                          <span>{formatDateTime(asset.createdAt)}</span>
                        </li>
                      ))}
                    </ul>
                  </article>

                  <article>
                    <h3>Latest extraction</h3>
                    {latestExtraction ? (
                      <details open>
                        <summary>
                          {latestExtraction.engine} ({titleCase(latestExtraction.status)})
                        </summary>
                        <pre>{prettyJson(latestExtraction.structuredFacts)}</pre>
                      </details>
                    ) : (
                      <p className="meta">No extraction yet.</p>
                    )}
                  </article>

                  <article>
                    <h3>Latest verdict</h3>
                    {latestVerdict ? (
                      <details open>
                        <summary>
                          {latestVerdict.llmModel} ({titleCase(latestVerdict.status)})
                        </summary>
                        <pre>{prettyJson(latestVerdict.outputJson)}</pre>
                      </details>
                    ) : (
                      <p className="meta">No verdict yet.</p>
                    )}
                  </article>
                </div>
              </section>

              <section className="stacked-card">
                <h2>Audit timeline ({selectedCase.auditLogs.length})</h2>
                <div className="audit-list">
                  {selectedCase.auditLogs
                    .slice()
                    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))
                    .slice(0, 8)
                    .map((row) => (
                      <details key={row.id}>
                        <summary>
                          <span>{titleCase(row.eventType)}</span>
                          <span>{formatDateTime(row.createdAt)}</span>
                        </summary>
                        <pre>{prettyJson(row.payload)}</pre>
                      </details>
                    ))}
                  {selectedCase.auditLogs.length === 0 ? <p className="meta">No audit logs yet.</p> : null}
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
