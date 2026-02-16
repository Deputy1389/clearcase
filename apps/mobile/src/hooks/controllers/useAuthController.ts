import { useState, useMemo, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../useAuth";
import { STORAGE_ONBOARDED } from "../../constants";

export function useAuthController(ui: any) {
  const [slide, setSlide] = useState(0);
  const authCallbacks = useRef<any>({
    resetAppState: () => {},
    applyOfflineSession: () => {},
    applyServerMeState: async () => {},
    applyAuthSuccess: () => {},
    applyOfflineFallback: () => {},
    language: ui.language
  });

  const {
    authMode, setAuthMode,
    authName, setAuthName,
    authZip, setAuthZip,
    authEmail, setAuthEmail,
    authPassword, setAuthPassword,
    authIntent, setAuthIntent,
    authBusy, setAuthBusy,
    authStage, setAuthStage,
    isBootstrapping, setIsBootstrapping,
    signOut,
    bootstrapOfflineSession,
    agreeAndContinue,
    resolveAuthApiBase
  } = useAuth({
    apiBase: ui.apiBase,
    setApiBase: ui.setApiBase,
    apiBaseInput: ui.apiBaseInput,
    setApiBaseInput: ui.setApiBaseInput,
    email: ui.email,
    setEmail: ui.setEmail,
    setEmailInput: ui.setEmailInput,
    subject: ui.subject,
    setSubject: ui.setSubject,
    setSubjectInput: ui.setSubjectInput,
    headers: ui.headers,
    offlineMode: ui.offlineMode,
    setOfflineMode: ui.setOfflineMode,
    setConnStatus: ui.setConnStatus,
    setConnMessage: ui.setConnMessage,
    showBanner: ui.showBanner,
    detectLanApiBase: ui.detectLanApiBase,
    persistConnection: ui.persistConnection
  }, {
    resetAppState: () => authCallbacks.current.resetAppState(),
    applyOfflineSession: (...args: any[]) => authCallbacks.current.applyOfflineSession(...args),
    applyServerMeState: (...args: any[]) => authCallbacks.current.applyServerMeState(...args),
    applyAuthSuccess: (...args: any[]) => authCallbacks.current.applyAuthSuccess(...args),
    applyOfflineFallback: () => authCallbacks.current.applyOfflineFallback(),
    language: ui.language
  });

  const completeOnboarding = useCallback(async () => {
    setSlide(0);
    ui.setScreen("auth");
    try {
      await AsyncStorage.setItem(STORAGE_ONBOARDED, "1");
    } catch {}
  }, [ui.setScreen]);

  return useMemo(() => ({
    authMode, setAuthMode,
    authName, setAuthName,
    authZip, setAuthZip,
    authEmail, setAuthEmail,
    authPassword, setAuthPassword,
    authIntent, setAuthIntent,
    authBusy, setAuthBusy,
    authStage, setAuthStage,
    isBootstrapping, setIsBootstrapping,
    signOut,
    bootstrapOfflineSession,
    agreeAndContinue,
    resolveAuthApiBase,
    slide, setSlide,
    completeOnboarding,
    authCallbacks
  }), [
    authMode, authName, authZip, authEmail, authPassword,
    authIntent, authBusy, authStage, isBootstrapping, slide,
    signOut, bootstrapOfflineSession, agreeAndContinue, resolveAuthApiBase,
    completeOnboarding
  ]);
}
