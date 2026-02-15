import { useState } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthHeaders, MeResponse, CaseSummary } from "../api";
import { getMe, getCases, patchMe, getHealth } from "../api";
import {
  DEFAULT_SUBJECT, DEFAULT_EMAIL,
  STORAGE_SUBJECT, STORAGE_EMAIL, STORAGE_ONBOARDED, STORAGE_OFFLINE_SESSION
} from "../constants";
import { buildHeaders } from "../utils/network";
import { isValidEmail, isValidUsZip, isStrongPassword } from "../utils/auth-helpers";
import { withNetworkHint, isNetworkErrorLike } from "../utils/error-helpers";
import { deriveSubject } from "./useConnection";
import type { AuthMode, ConnStatus, BannerTone } from "../types";
import { DEMO_CASES } from "../data/demo-cases";

type SS = React.Dispatch<React.SetStateAction<string>>;
type SB = React.Dispatch<React.SetStateAction<boolean>>;

export interface UseAuthConnectionDeps {
  apiBase: string; setApiBase: SS; apiBaseInput: string; setApiBaseInput: SS;
  email: string; setEmail: SS; setEmailInput: SS;
  subject: string; setSubject: SS; setSubjectInput: SS;
  headers: AuthHeaders; offlineMode: boolean; setOfflineMode: SB;
  setConnStatus: React.Dispatch<React.SetStateAction<ConnStatus>>;
  setConnMessage: SS;
  showBanner: (tone: BannerTone, text: string) => void;
  detectLanApiBase: () => string | null;
  persistConnection: (base: string, sub: string, em: string) => Promise<void>;
}

export interface UseAuthCallbacks {
  resetAppState: () => void;
  applyOfflineSession: (me: MeResponse, cases: CaseSummary[], firstCaseId: string | null) => void;
  applyServerMeState: (meData: MeResponse, base: string, auth: AuthHeaders) => Promise<void>;
  applyAuthSuccess: (cases: CaseSummary[], firstCaseId: string | null) => void;
  applyOfflineFallback: () => void;
  language: "en" | "es";
}

export function useAuth(conn: UseAuthConnectionDeps, cb: UseAuthCallbacks) {
  const [authMode, setAuthMode] = useState<AuthMode>("selection");
  const [authName, setAuthName] = useState("");
  const [authZip, setAuthZip] = useState("");
  const [authEmail, setAuthEmail] = useState(DEFAULT_EMAIL);
  const [authPassword, setAuthPassword] = useState("");
  const [authIntent, setAuthIntent] = useState<"login" | "signup">("login");
  const [authBusy, setAuthBusy] = useState(false);
  const [authStage, setAuthStage] = useState<"idle" | "account" | "profile" | "workspace">("idle");
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  async function resolveAuthApiBase(preferredBase: string): Promise<string> {
    const primaryBase = preferredBase.trim();
    if (!primaryBase) return preferredBase;
    try {
      const h = await getHealth(primaryBase);
      if (h.ok) return primaryBase;
    } catch (primaryError) {
      const lanBase = conn.detectLanApiBase();
      if (lanBase && lanBase !== primaryBase) {
        try {
          const lh = await getHealth(lanBase);
          if (lh.ok) {
            conn.setApiBase(lanBase);
            conn.setApiBaseInput(lanBase);
            conn.setConnStatus("ok");
            conn.setConnMessage(`Connected to ${lanBase}`);
            conn.showBanner("info", "Primary API unavailable. Switched to local network API.");
            return lanBase;
          }
        } catch { /* keep original error path */ }
      }
      throw primaryError;
    }
    return primaryBase;
  }

  async function bootstrapOfflineSession(nextEmail: string, fullName: string, zipCode: string): Promise<void> {
    const now = new Date().toISOString();
    const id = `${Date.now()}`;
    const offlineMe: MeResponse = {
      user: {
        id: `offline-user-${id}`, authProviderUserId: `offline-${deriveSubject(nextEmail)}`,
        email: nextEmail, fullName: fullName || null, zipCode: zipCode || null,
        jurisdictionState: null, createdAt: now, updatedAt: now
      },
      needsProfile: !fullName || !zipCode,
      entitlement: {
        id: `offline-entitlement-${id}`, plan: "plus", status: "active", source: "manual",
        startAt: now, endAt: null, isPlus: true, viaAllowlistFallback: false
      },
      pushPreferences: { enabled: false, language: cb.language, quietHoursStart: null, quietHoursEnd: null },
      pushDevices: { activeCount: 0 }
    };
    const offlineCases: CaseSummary[] = [...DEMO_CASES];
    cb.applyOfflineSession(offlineMe, offlineCases, offlineCases[0]?.id ?? null);
    conn.setOfflineMode(true);
    try {
      await AsyncStorage.setItem(STORAGE_OFFLINE_SESSION, JSON.stringify({ me: offlineMe, cases: offlineCases }));
      await AsyncStorage.setItem(STORAGE_ONBOARDED, "1");
    } catch { /* ignore */ }
  }

  async function signOut(): Promise<void> {
    cb.resetAppState();
    conn.setOfflineMode(false);
    setAuthPassword("");
    setAuthIntent("login");
    setAuthMode("selection");
    conn.setSubject(DEFAULT_SUBJECT);
    conn.setSubjectInput(DEFAULT_SUBJECT);
    conn.setEmail(DEFAULT_EMAIL);
    conn.setEmailInput(DEFAULT_EMAIL);
    setAuthEmail(DEFAULT_EMAIL);
    try {
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_SUBJECT),
        AsyncStorage.removeItem(STORAGE_EMAIL),
        AsyncStorage.removeItem(STORAGE_OFFLINE_SESSION)
      ]);
    } catch { /* ignore */ }
    conn.showBanner("info", "Signed out.");
  }

  async function agreeAndContinue(): Promise<void> {
    const trimmedEmail = authEmail.trim();
    if (!trimmedEmail) { Alert.alert("Email required", "Enter your email address."); return; }
    if (!isValidEmail(trimmedEmail)) { Alert.alert("Invalid email", "Enter a valid email address."); return; }
    if (!isStrongPassword(authPassword)) { Alert.alert("Weak password", "Password must be at least 8 characters."); return; }
    if (authIntent === "signup" && !authName.trim()) { Alert.alert("Name required", "Enter your full name."); return; }
    if (authIntent === "signup" && authZip.trim() && !isValidUsZip(authZip)) { Alert.alert("Invalid ZIP", "Use a valid US ZIP code like 90210."); return; }

    setAuthBusy(true);
    setAuthStage("account");
    try {
      const baseForAuth = await resolveAuthApiBase(conn.apiBase);
      const nextEmail = trimmedEmail;
      const nextSubject = deriveSubject(nextEmail);
      const nextHeaders = buildHeaders(nextSubject, nextEmail);

      conn.setApiBase(baseForAuth);
      conn.setApiBaseInput(baseForAuth);
      conn.setEmail(nextEmail);
      conn.setEmailInput(nextEmail);
      conn.setSubject(nextSubject);
      conn.setSubjectInput(nextSubject);
      await conn.persistConnection(baseForAuth, nextSubject, nextEmail);

      let meData = await getMe(baseForAuth, nextHeaders);
      if (authIntent === "signup") {
        setAuthStage("profile");
        const payload: { fullName?: string; zipCode?: string } = {};
        if (authName.trim()) payload.fullName = authName.trim();
        if (authZip.trim()) payload.zipCode = authZip.trim();
        if (payload.fullName || payload.zipCode) meData = await patchMe(baseForAuth, nextHeaders, payload);
      }

      await cb.applyServerMeState(meData, baseForAuth, nextHeaders);
      setAuthStage("workspace");
      const caseData = await getCases(baseForAuth, nextHeaders);
      const nextCases = caseData.cases;
      conn.setConnStatus("ok");
      conn.setConnMessage(`Connected to ${baseForAuth}`);
      conn.setOfflineMode(false);
      await AsyncStorage.removeItem(STORAGE_OFFLINE_SESSION);
      cb.applyAuthSuccess(nextCases, nextCases[0]?.id ?? null);
      await AsyncStorage.setItem(STORAGE_ONBOARDED, "1");
      setAuthMode("selection");
      conn.showBanner("good", "Welcome to ClearCase.");
    } catch (error) {
      const message = withNetworkHint(error, conn.apiBase);
      if (isNetworkErrorLike(message)) {
        await bootstrapOfflineSession(trimmedEmail, authName.trim(), authZip.trim());
        setAuthMode("selection");
        cb.applyOfflineFallback();
        conn.showBanner("info", "Connected in offline mode. Some features are limited until API is reachable.");
      } else {
        conn.showBanner("bad", `Could not continue: ${message}`);
        Alert.alert("Could not continue", message);
      }
    } finally {
      setAuthBusy(false);
      setAuthStage("idle");
    }
  }

  return {
    authMode, setAuthMode,
    authName, setAuthName,
    authZip, setAuthZip,
    authEmail, setAuthEmail,
    authPassword, setAuthPassword,
    authIntent, setAuthIntent,
    authBusy, setAuthBusy,
    authStage, setAuthStage,
    isBootstrapping, setIsBootstrapping,
    signOut, bootstrapOfflineSession, agreeAndContinue, resolveAuthApiBase
  };
}
