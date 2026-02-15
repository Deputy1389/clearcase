import { useState, useMemo } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthHeaders } from "../api";
import { getHealth } from "../api";
import {
  DEFAULT_SUBJECT,
  DEFAULT_EMAIL,
  STORAGE_API_BASE,
  STORAGE_SUBJECT,
  STORAGE_EMAIL
} from "../constants";
import {
  DEFAULT_API_BASE,
  extractMetroHost,
  isPrivateIpv4Host,
  buildHeaders
} from "../utils/network";
import { withNetworkHint } from "../utils/error-helpers";
import { hapticSuccess } from "../utils/haptics";
import type { BannerTone, ConnStatus } from "../types";

// ---------------------------------------------------------------------------
// deriveSubject — pure helper to derive an auth subject key from an email
// ---------------------------------------------------------------------------
export function deriveSubject(email: string): string {
  const local = email.split("@")[0] ?? "";
  const normalized = local.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized ? `mobile-${normalized}` : DEFAULT_SUBJECT;
}

// ---------------------------------------------------------------------------
// useConnection hook
// ---------------------------------------------------------------------------

export interface UseConnectionReturn {
  // state
  apiBase: string;
  setApiBase: React.Dispatch<React.SetStateAction<string>>;
  apiBaseInput: string;
  setApiBaseInput: React.Dispatch<React.SetStateAction<string>>;
  connStatus: ConnStatus;
  setConnStatus: React.Dispatch<React.SetStateAction<ConnStatus>>;
  connMessage: string;
  setConnMessage: React.Dispatch<React.SetStateAction<string>>;
  offlineMode: boolean;
  setOfflineMode: React.Dispatch<React.SetStateAction<boolean>>;
  banner: { tone: BannerTone; text: string } | null;
  setBanner: React.Dispatch<React.SetStateAction<{ tone: BannerTone; text: string } | null>>;
  subject: string;
  setSubject: React.Dispatch<React.SetStateAction<string>>;
  subjectInput: string;
  setSubjectInput: React.Dispatch<React.SetStateAction<string>>;
  email: string;
  setEmail: React.Dispatch<React.SetStateAction<string>>;
  emailInput: string;
  setEmailInput: React.Dispatch<React.SetStateAction<string>>;

  // derived
  headers: AuthHeaders;

  // functions
  showBanner: (tone: BannerTone, text: string) => void;
  verifyConnection: (base?: string) => Promise<void>;
  detectLanApiBase: () => string | null;
  persistConnection: (nextBase: string, nextSubject: string, nextEmail: string) => Promise<void>;
  applyConnection: (loadDashboard: (base: string, auth: AuthHeaders) => Promise<void>) => Promise<void>;
  deriveSubject: (email: string) => string;
}

export function useConnection(): UseConnectionReturn {
  const [apiBase, setApiBase] = useState(DEFAULT_API_BASE ?? "http://127.0.0.1:3001");
  const [apiBaseInput, setApiBaseInput] = useState(DEFAULT_API_BASE ?? "http://127.0.0.1:3001");
  const [connStatus, setConnStatus] = useState<ConnStatus>("unknown");
  const [connMessage, setConnMessage] = useState("Connection not tested yet.");
  const [offlineMode, setOfflineMode] = useState(false);
  const [banner, setBanner] = useState<{ tone: BannerTone; text: string } | null>(null);
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [subjectInput, setSubjectInput] = useState(DEFAULT_SUBJECT);
  const [email, setEmail] = useState(DEFAULT_EMAIL);
  const [emailInput, setEmailInput] = useState(DEFAULT_EMAIL);

  const headers = useMemo(() => buildHeaders(subject, email), [subject, email]);

  function showBanner(tone: BannerTone, text: string): void {
    if (tone === "good") hapticSuccess();
    setBanner({ tone, text });
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

  async function applyConnection(loadDashboard: (base: string, auth: AuthHeaders) => Promise<void>): Promise<void> {
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

  return {
    apiBase,
    setApiBase,
    apiBaseInput,
    setApiBaseInput,
    connStatus,
    setConnStatus,
    connMessage,
    setConnMessage,
    offlineMode,
    setOfflineMode,
    banner,
    setBanner,
    subject,
    setSubject,
    subjectInput,
    setSubjectInput,
    email,
    setEmail,
    emailInput,
    setEmailInput,
    headers,
    showBanner,
    verifyConnection,
    detectLanApiBase,
    persistConnection,
    applyConnection,
    deriveSubject
  };
}
