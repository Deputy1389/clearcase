import { useState, useMemo } from "react";
import { useLanguage } from "../useLanguage";
import { useNavigation } from "../useNavigation";
import { useConnection } from "../useConnection";
import { usePaywall } from "../usePaywall";

export function useUiController() {
  const { language, setLanguage, setLanguageWithPersistence, loadPersistedLanguage } = useLanguage();
  const { screen, setScreen, postLanguageScreen, setPostLanguageScreen, goBack } = useNavigation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [legalReturnScreen, setLegalReturnScreen] = useState<string>("home");

  const {
    apiBase, setApiBase,
    apiBaseInput, setApiBaseInput,
    connStatus, setConnStatus,
    connMessage, setConnMessage,
    offlineMode, setOfflineMode,
    banner, setBanner,
    subject, setSubject,
    subjectInput, setSubjectInput,
    email, setEmail,
    emailInput, setEmailInput,
    headers,
    showBanner,
    verifyConnection,
    detectLanApiBase,
    persistConnection,
    applyConnection
  } = useConnection();

  const {
    paywallConfig, setPaywallConfig,
    planTier, setPlanTier,
    startingCheckout,
    planSheetOpen, setPlanSheetOpen,
    loadPaywallConfigState,
    startPlusCheckout,
    openPaywall,
    promptPlusUpgrade,
    callbacks: paywallCallbacks
  } = usePaywall({ apiBase, headers, language, offlineMode, showBanner });

  return useMemo(() => ({
    language, setLanguage, setLanguageWithPersistence, loadPersistedLanguage,
    screen, setScreen, postLanguageScreen, setPostLanguageScreen, goBack,
    drawerOpen, setDrawerOpen,
    legalReturnScreen, setLegalReturnScreen,
    apiBase, setApiBase,
    apiBaseInput, setApiBaseInput,
    connStatus, setConnStatus,
    connMessage, setConnMessage,
    offlineMode, setOfflineMode,
    banner, setBanner,
    subject, setSubject,
    subjectInput, setSubjectInput,
    email, setEmail,
    emailInput, setEmailInput,
    headers,
    showBanner,
    verifyConnection,
    detectLanApiBase,
    persistConnection,
    applyConnection,
    paywallConfig, setPaywallConfig,
    planTier, setPlanTier,
    startingCheckout,
    planSheetOpen, setPlanSheetOpen,
    loadPaywallConfigState,
    startPlusCheckout,
    openPaywall,
    promptPlusUpgrade,
    paywallCallbacks
  }), [
    language, screen, postLanguageScreen, drawerOpen, legalReturnScreen,
    apiBase, apiBaseInput, connStatus, connMessage, offlineMode, banner,
    subject, subjectInput, email, emailInput, headers,
    showBanner, verifyConnection, detectLanApiBase, persistConnection, applyConnection,
    setLanguageWithPersistence, loadPersistedLanguage, goBack,
    paywallConfig, planTier, startingCheckout, planSheetOpen,
    loadPaywallConfigState, startPlusCheckout, openPaywall, promptPlusUpgrade, paywallCallbacks
  ]);
}
