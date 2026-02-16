import { useMemo, useCallback } from "react";
import { useAuthController } from "./controllers/useAuthController";
import { useCasesController } from "./controllers/useCasesController";
import { useUploadController } from "./controllers/useUploadController";
import { useUiController } from "./controllers/useUiController";
import { useWorkspaceController } from "./controllers/useWorkspaceController";
import { useAppBootstrap } from "./controllers/useAppBootstrap";
import { DEMO_CASE_DETAIL_MAP } from "../data/demo-cases";

export function useAppController() {
  const ui = useUiController();
  const cases = useCasesController(ui);
  const upload = useUploadController(ui, cases);
  const auth = useAuthController(ui);
  const workspace = useWorkspaceController(ui, cases, upload);

  useAppBootstrap(ui, auth, cases);

  // Wire auth callbacks
  auth.authCallbacks.current = {
    resetAppState: () => {
      ui.setDrawerOpen(false);
      cases.setMe(null);
      cases.setCases([]);
      cases.setSelectedCaseId(null);
      cases.setSelectedCase(null);
      ui.setScreen("auth");
      ui.setPlanTier("free");
      ui.setPushEnabled(false);
      ui.setPushQuietHoursEnabled(false);
    },
    applyOfflineSession: (offMe: any, offCases: any[], firstId: string | null) => {
      cases.setMe(offMe);
      cases.setCases(offCases);
      cases.setSelectedCaseId(firstId);
      cases.setSelectedCase(firstId ? (DEMO_CASE_DETAIL_MAP[firstId as keyof typeof DEMO_CASE_DETAIL_MAP] ?? null) : null);
      cases.setProfileName(offMe.user.fullName ?? "");
      cases.setProfileZip(offMe.user.zipCode ?? "");
      ui.setPlanTier("plus");
      ui.setPushEnabled(false);
      ui.setPushQuietHoursEnabled(false);
    },
    applyServerMeState: async (meData: any) => {
      cases.setMe(meData);
      cases.setProfileName(meData.user.fullName ?? "");
      cases.setProfileZip(meData.user.zipCode ?? "");
      const resolvedTier = meData.entitlement?.isPlus ? "plus" : "free";
      ui.setPlanTier(resolvedTier);
      ui.setPushEnabled(Boolean(meData.pushPreferences?.enabled));
      ui.setPushQuietHoursEnabled(Boolean(meData.pushPreferences?.quietHoursStart && meData.pushPreferences?.quietHoursEnd));
    },
    applyAuthSuccess: (nextCases: any[], firstId: string | null) => {
      cases.setCases(nextCases);
      cases.setSelectedCaseId(firstId);
      ui.setScreen("home");
    },
    applyOfflineFallback: () => {
      ui.setScreen("home");
    },
    language: ui.language
  };

  // Wire upload callbacks
  upload.uploadCallbacks.current = {
    createCaseWithTitle: cases.createCaseWithTitle,
    loadCase: cases.loadCase,
    loadDashboard: cases.loadDashboard,
    loadCaseAssetsForSelectedCase: cases.loadCaseAssetsForSelectedCase,
    setCases: cases.setCases,
    setSelectedCaseId: cases.setSelectedCaseId,
    setSelectedCase: cases.setSelectedCase,
    setScreen: ui.setScreen,
    sendTrackedEvent: async () => {}, // TODO
    reconnectWorkspace: cases.refreshWorkspace,
    openPaywall: ui.openPaywall
  };

  const togglePushNotifications = useCallback(() => ui.togglePushNotifications(cases.setMe), [ui.togglePushNotifications, cases.setMe]);
  const togglePushQuietHours = useCallback(() => ui.togglePushQuietHours(cases.setMe), [ui.togglePushQuietHours, cases.setMe]);
  const applyLanguageFromSettings = useCallback((lang: any) => ui.applyLanguageFromSettings(lang, cases.setMe), [ui.applyLanguageFromSettings, cases.setMe]);

  return useMemo(() => ({
    ...ui,
    ...auth,
    ...cases,
    ...upload,
    ...workspace,
    togglePushNotifications,
    togglePushQuietHours,
    applyLanguageFromSettings
  }), [ui, auth, cases, upload, workspace, togglePushNotifications, togglePushQuietHours, applyLanguageFromSettings]);
}
