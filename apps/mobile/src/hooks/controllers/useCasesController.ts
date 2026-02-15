import { useMemo, useState } from "react";
import { useCases } from "../useCases";

export function useCasesController(ui: any) {
  const {
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
    selectedCaseSummary,
    latestCase,
    userFirstName,
    filteredCases,
    loadDashboard,
    loadCase,
    loadCaseAssetsForSelectedCase,
    createCaseWithTitle,
    saveProfile,
    refreshWorkspace,
    reconnectWorkspace,
    callbacks: casesCallbacks
  } = useCases({
    apiBase: ui.apiBase,
    headers: ui.headers,
    language: ui.language,
    offlineMode: ui.offlineMode,
    showBanner: ui.showBanner,
    verifyConnection: ui.verifyConnection,
    setConnStatus: ui.setConnStatus,
    setConnMessage: ui.setConnMessage,
    setOfflineMode: ui.setOfflineMode,
    email: ui.email
  });

  const completion = useMemo(() => {
    if (!me) return 0;
    const count = [me.user.fullName, me.user.zipCode, me.user.jurisdictionState].filter(Boolean).length;
    return Math.round((count / 3) * 100);
  }, [me]);

  const [lawyerSummaryOpen, setLawyerSummaryOpen] = useState(false);

  return useMemo(() => ({
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
    selectedCaseSummary,
    latestCase,
    userFirstName,
    filteredCases,
    loadDashboard,
    loadCase,
    loadCaseAssetsForSelectedCase,
    createCaseWithTitle,
    saveProfile,
    refreshWorkspace,
    reconnectWorkspace,
    casesCallbacks,
    completion,
    lawyerSummaryOpen, setLawyerSummaryOpen
  }), [
    me, cases, selectedCaseId, selectedCase, caseAssets, loadingCaseAssets,
    profileName, profileZip, newCaseTitle, caseSearch, caseFilter,
    loadingDashboard, loadingCase, creatingCase, savingProfile, refreshing,
    selectedCaseSummary, latestCase, userFirstName, filteredCases,
    loadDashboard, loadCase, loadCaseAssetsForSelectedCase,
    createCaseWithTitle, saveProfile, refreshWorkspace, reconnectWorkspace,
    casesCallbacks, completion, lawyerSummaryOpen
  ]);
}
