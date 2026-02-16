import { useState, useCallback, useMemo } from "react";
import { useLanguage } from "../useLanguage";
import { useNavigation } from "../useNavigation";
import { useConnection } from "../useConnection";
import { usePaywall } from "../usePaywall";
import * as Haptics from "expo-haptics";
import { patchNotificationPreferences } from "../../api";
import { withNetworkHint } from "../../utils/error-helpers";

export function useUiController() {
  const { language, setLanguage, setLanguageWithPersistence, loadPersistedLanguage } = useLanguage();
  const { screen, setScreen, postLanguageScreen, setPostLanguageScreen, goBack } = useNavigation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [legalReturnScreen, setLegalReturnScreen] = useState<string>("home");
  
  const [legalAidSearch, setLegalAidSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushQuietHoursEnabled, setPushQuietHoursEnabled] = useState(false);
  const [savingPushPreferences, setSavingPushPreferences] = useState(false);

  const hapticTap = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

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

  const updatePushPreferences = useCallback(async (input: {
    enabled?: boolean;
    quietHoursStart?: string | null;
    quietHoursEnd?: string | null;
    language?: any;
  }, setMe: (fn: (curr: any) => any) => void): Promise<void> => {
    if (offlineMode) {
      showBanner("info", language === "es" ? "Las preferencias de notificaciones necesitan conexion API." : "Notification preferences need API connectivity.");
      return;
    }
    setSavingPushPreferences(true);
    try {
      const response = await patchNotificationPreferences(apiBase, headers, input);
      setPushEnabled(response.pushPreferences.enabled);
      setPushQuietHoursEnabled(Boolean(response.pushPreferences.quietHoursStart && response.pushPreferences.quietHoursEnd));
      setMe((current: any) => current ? { ...current, pushPreferences: response.pushPreferences } : current);
      showBanner("good", language === "es" ? "Preferencias de notificaciones guardadas." : "Notification preferences saved.");
    } catch (error) {
      showBanner("bad", language === "es" ? `No se pudieron guardar las notificaciones: ${withNetworkHint(error, apiBase)}` : `Could not save notifications: ${withNetworkHint(error, apiBase)}`);
    } finally {
      setSavingPushPreferences(false);
    }
  }, [offlineMode, apiBase, headers, language, showBanner]);

  const togglePushNotifications = useCallback(async (setMe: any) => {
    await updatePushPreferences({ enabled: !pushEnabled, language }, setMe);
  }, [pushEnabled, language, updatePushPreferences]);

  const togglePushQuietHours = useCallback(async (setMe: any) => {
    if (!pushEnabled) {
      showBanner("info", language === "es" ? "Activa notificaciones antes de configurar horas de silencio." : "Enable notifications before setting quiet hours.");
      return;
    }
    if (pushQuietHoursEnabled) {
      await updatePushPreferences({ quietHoursStart: null, quietHoursEnd: null }, setMe);
    } else {
      await updatePushPreferences({ quietHoursStart: "22:00", quietHoursEnd: "07:00" }, setMe);
    }
  }, [pushEnabled, pushQuietHoursEnabled, language, showBanner, updatePushPreferences]);

  const applyLanguageFromSettings = useCallback(async (nextLanguage: any, setMe: any): Promise<void> => {
    if (nextLanguage === language) return;
    await setLanguageWithPersistence(nextLanguage);
    if (!offlineMode) {
      try {
        const updated = await patchNotificationPreferences(apiBase, headers, { language: nextLanguage });
        setPushEnabled(updated.pushPreferences.enabled);
        setPushQuietHoursEnabled(Boolean(updated.pushPreferences.quietHoursStart && updated.pushPreferences.quietHoursEnd));
        setMe((current: any) => current ? { ...current, pushPreferences: updated.pushPreferences } : current);
      } catch { /* best effort */ }
    }
  }, [language, setLanguageWithPersistence, offlineMode, apiBase, headers]);

  return useMemo(() => ({
    language, setLanguage, setLanguageWithPersistence, loadPersistedLanguage,
    screen, setScreen, postLanguageScreen, setPostLanguageScreen, goBack,
    drawerOpen, setDrawerOpen,
    legalReturnScreen, setLegalReturnScreen,
    legalAidSearch, setLegalAidSearch,
    selectedTemplate, setSelectedTemplate,
    pushEnabled, setPushEnabled,
    pushQuietHoursEnabled, setPushQuietHoursEnabled,
    savingPushPreferences, setSavingPushPreferences,
    hapticTap,
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
    paywallCallbacks,
    updatePushPreferences,
    togglePushNotifications,
    togglePushQuietHours,
    applyLanguageFromSettings
  }), [
    language, screen, drawerOpen, legalReturnScreen, legalAidSearch,
    selectedTemplate, pushEnabled, pushQuietHoursEnabled, savingPushPreferences,
    hapticTap, apiBase, apiBaseInput, connStatus, connMessage, offlineMode,
    banner, subject, subjectInput, email, emailInput, headers,
    showBanner, verifyConnection, detectLanApiBase, persistConnection,
    applyConnection, paywallConfig, planTier, startingCheckout, planSheetOpen,
    loadPaywallConfigState, startPlusCheckout, openPaywall, promptPlusUpgrade,
    updatePushPreferences, togglePushNotifications, togglePushQuietHours,
    applyLanguageFromSettings
  ]);
}
