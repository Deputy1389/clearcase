import { useRef, useState, useMemo } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthHeaders, CaseAsset, CaseDetail, CaseSummary, MeResponse } from "../api";
import { createCase, getCaseById, getCaseAssets, getCases, getMe, patchMe } from "../api";
import { STORAGE_OFFLINE_SESSION } from "../constants";
import { withNetworkHint } from "../utils/error-helpers";
import type { AppLanguage, BannerTone, ConnStatus } from "../types";

// ---------------------------------------------------------------------------
// buildAutoCaseTitle — local helper
// ---------------------------------------------------------------------------
function buildAutoCaseTitle(rawTitle?: string | null): string {
  const cleaned = (rawTitle ?? "")
    .replace(/\.[^.]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned) return cleaned.slice(0, 120);
  return `Uploaded Document - ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

// ---------------------------------------------------------------------------
// useCases — case data, CRUD, dashboard loading
// ---------------------------------------------------------------------------

export interface UseCasesCallbacks {
  applyServerMeState: (meData: MeResponse, base: string, auth: AuthHeaders) => Promise<void>;
  loadPaywallConfigState: (base?: string, auth?: AuthHeaders) => Promise<void>;
}

export function useCases(deps: {
  apiBase: string;
  headers: AuthHeaders;
  language: AppLanguage;
  offlineMode: boolean;
  showBanner: (tone: BannerTone, text: string) => void;
  verifyConnection: (base: string) => Promise<void>;
  setConnStatus: React.Dispatch<React.SetStateAction<ConnStatus>>;
  setConnMessage: React.Dispatch<React.SetStateAction<string>>;
  setOfflineMode: React.Dispatch<React.SetStateAction<boolean>>;
  email: string;
}) {
  const {
    apiBase, headers, language, offlineMode, showBanner,
    verifyConnection, setConnStatus, setConnMessage, setOfflineMode, email
  } = deps;

  // Ref for callbacks that depend on App.tsx state (breaks circular deps).
  const callbacks = useRef<UseCasesCallbacks>({
    applyServerMeState: async () => {},
    loadPaywallConfigState: async () => {}
  });

  // ---- state ----
  const [me, setMe] = useState<MeResponse | null>(null);
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<CaseDetail | null>(null);
  const [caseAssets, setCaseAssets] = useState<CaseAsset[]>([]);
  const [loadingCaseAssets, setLoadingCaseAssets] = useState(false);

  const [profileName, setProfileName] = useState("");
  const [profileZip, setProfileZip] = useState("");
  const [newCaseTitle, setNewCaseTitle] = useState("");
  const [caseSearch, setCaseSearch] = useState("");
  const [caseFilter, setCaseFilter] = useState<"all" | "active" | "urgent" | "archived">("all");

  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [loadingCase, setLoadingCase] = useState(false);
  const [creatingCase, setCreatingCase] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ---- derived values ----
  const selectedCaseSummary = useMemo(
    () => cases.find((row) => row.id === selectedCaseId) ?? null,
    [cases, selectedCaseId]
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

  // ---- async operations ----

  async function loadDashboard(base = apiBase, auth = headers): Promise<void> {
    setLoadingDashboard(true);
    try {
      const [meData, caseData] = await Promise.all([getMe(base, auth), getCases(base, auth)]);
      setConnStatus("ok");
      setConnMessage(`Connected to ${base}`);
      setOfflineMode(false);
      void AsyncStorage.removeItem(STORAGE_OFFLINE_SESSION);
      await callbacks.current.applyServerMeState(meData, base, auth);
      await callbacks.current.loadPaywallConfigState(base, auth);
      setCases(caseData.cases);
      setSelectedCaseId((cur) =>
        cur && caseData.cases.some((row) => row.id === cur) ? cur : (caseData.cases[0]?.id ?? null)
      );
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
          await AsyncStorage.setItem(
            STORAGE_OFFLINE_SESSION,
            JSON.stringify({ me, cases: nextCases })
          );
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
        await AsyncStorage.setItem(
          STORAGE_OFFLINE_SESSION,
          JSON.stringify({ me: updated, cases })
        );
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
      await callbacks.current.applyServerMeState(updated, apiBase, headers);
      showBanner("good", "Profile saved.");
    } catch (error) {
      const message = withNetworkHint(error, apiBase);
      showBanner("bad", `Profile save failed: ${message}`);
      Alert.alert("Profile save failed", message);
    } finally {
      setSavingProfile(false);
    }
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

  return {
    // state
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
    // derived
    selectedCaseSummary,
    latestCase,
    userFirstName,
    filteredCases,
    // operations
    loadDashboard,
    loadCase,
    loadCaseAssetsForSelectedCase,
    createCaseWithTitle,
    saveProfile,
    refreshWorkspace,
    reconnectWorkspace,
    /** Wire up callbacks that depend on App.tsx state (breaks circular deps). */
    callbacks
  };
}
