import React from "react";
import { View, Pressable, Text, LayoutAnimation, UIManager, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { styles } from "./styleUtils";
import { palette } from "../../theme";
import HomeScreen from "../../screens/HomeScreen";
import CasesScreen from "../../screens/CasesScreen";
import DraftingScreen from "../../screens/DraftingScreen";
import { hapticTap } from "../../utils/haptics";

const subtleSpring = {
  duration: 250,
  update: { type: "spring" as const, springDamping: 0.85 },
  create: { type: "easeInEaseOut" as const, property: "opacity" as const },
  delete: { type: "easeInEaseOut" as const, property: "opacity" as const }
};

export function HomeRoutes({ controller, uploadStatusText, localizedCaseStatus, fmtDate, fmtDateTime, casePriorityLevel, casePriorityLabel }: { controller: any, uploadStatusText: string, localizedCaseStatus: any, fmtDate: any, fmtDateTime: any, casePriorityLevel: any, casePriorityLabel: any }) {
  const isTabScreen = controller.screen === "home" || controller.screen === "cases" || controller.screen === "drafting" || controller.screen === "account";

  return (
    <>
      {controller.screen === "home" ? (
        <HomeScreen
          navigation={{ screen: controller.screen, setScreen: controller.setScreen, goBack: controller.goBack, postLanguageScreen: controller.postLanguageScreen, setPostLanguageScreen: controller.setPostLanguageScreen, setDrawerOpen: controller.setDrawerOpen }}
          cases={{ cases: controller.cases, setCases: controller.setCases, selectedCaseId: controller.selectedCaseId, setSelectedCaseId: controller.setSelectedCaseId, selectedCase: controller.selectedCase, setSelectedCase: controller.setSelectedCase, selectedCaseSummary: controller.selectedCaseSummary, latestCase: controller.latestCase, filteredCases: controller.filteredCases, caseSearch: controller.caseSearch, setCaseSearch: controller.setCaseSearch, caseFilter: controller.caseFilter, setCaseFilter: controller.setCaseFilter, caseAssets: controller.caseAssets, setCaseAssets: controller.setCaseAssets, loadingCaseAssets: controller.loadingCaseAssets, setLoadingCaseAssets: controller.setLoadingCaseAssets, loadingDashboard: controller.loadingDashboard, loadingCase: controller.loadingCase, creatingCase: controller.creatingCase, savingProfile: controller.savingProfile, refreshing: controller.refreshing, userFirstName: controller.userFirstName, me: controller.me, setMe: controller.setMe, profileName: controller.profileName, setProfileName: controller.setProfileName, profileZip: controller.profileZip, setProfileZip: controller.setProfileZip, newCaseTitle: controller.newCaseTitle, setNewCaseTitle: controller.setNewCaseTitle, loadDashboard: controller.loadDashboard, loadCase: controller.loadCase, loadCaseAssetsForSelectedCase: controller.loadCaseAssetsForSelectedCase, createCaseWithTitle: controller.createCaseWithTitle, saveProfile: controller.saveProfile, refreshWorkspace: controller.refreshWorkspace, reconnectWorkspace: controller.reconnectWorkspace }}
          upload={{ uploading: controller.uploading, setUploading: controller.setUploading, uploadStage: controller.uploadStage, setUploadStage: controller.setUploadStage, uploadDescription: controller.uploadDescription, setUploadDescription: controller.setUploadDescription, uploadTargetCaseId: controller.uploadTargetCaseId, setUploadTargetCaseId: controller.setUploadTargetCaseId, uploadCaseTitle: controller.uploadCaseTitle, setUploadCaseTitle: controller.setUploadCaseTitle, uploadSheetOpen: controller.uploadSheetOpen, setUploadSheetOpen: controller.setUploadSheetOpen, latestContextReuseSourceCaseId: controller.latestContextReuseSourceCaseId, setLatestContextReuseSourceCaseId: controller.setLatestContextReuseSourceCaseId, uploadStatusText, uploadAssets: controller.uploadAssets, uploadDocument: controller.uploadDocument, uploadFromCamera: controller.uploadFromCamera, beginFileUpload: controller.beginFileUpload, beginCameraUpload: controller.beginCameraUpload, homeUploadFlow: controller.homeUploadFlow, openUploadSheetForCase: controller.openUploadSheetForCase, waitForCaseInsight: controller.waitForCaseInsight }}
          paywall={{ paywallConfig: controller.paywallConfig, planTier: controller.planTier, setPlanTier: controller.setPlanTier, plusEnabled: controller.plusEnabled, startingCheckout: controller.startingCheckout, planSheetOpen: controller.planSheetOpen, setPlanSheetOpen: controller.setPlanSheetOpen, startPlusCheckout: controller.startPlusCheckout as any, openPaywall: controller.openPaywall as any, promptPlusUpgrade: controller.promptPlusUpgrade as any, loadPaywallConfigState: controller.loadPaywallConfigState }}
          ui={{ language: controller.language, setLanguage: controller.setLanguage, applyLanguageFromSettings: controller.applyLanguageFromSettings, styles, palette, offlineMode: controller.offlineMode, showBanner: controller.showBanner, hapticTap }}
          auth={{ email: controller.email, accountInitials: controller.accountInitials, completion: controller.completion, signOut: controller.signOut }}
          helpers={{ localizedCaseStatus: localizedCaseStatus as any, formatUploadStage: (s: any, l: any) => uploadStatusText, titleize: (s: string) => s, fmtDate: fmtDate as any, fmtDateTime: fmtDateTime as any, manualCategoryLabel: (t: any, l: any) => t, severityLabel: (s: any) => s, severitySummary: (s: any) => s, casePriorityLevel, casePriorityLabel }}
        />
      ) : null}

      {controller.screen === "cases" ? (
        <CasesScreen
          language={controller.language}
          cases={controller.cases}
          filteredCases={controller.filteredCases}
          caseSearch={controller.caseSearch}
          setCaseSearch={controller.setCaseSearch}
          caseFilter={controller.caseFilter}
          setCaseFilter={controller.setCaseFilter as any}
          loadingDashboard={controller.loadingDashboard}
          refreshing={controller.refreshing}
          refreshWorkspace={controller.refreshWorkspace}
          newCaseTitle={controller.newCaseTitle}
          setNewCaseTitle={controller.setNewCaseTitle}
          creatingCase={controller.creatingCase}
          createCaseWithTitle={controller.createCaseWithTitle as any}
          selectedCaseId={controller.selectedCaseId}
          setSelectedCaseId={controller.setSelectedCaseId}
          setScreen={controller.setScreen}
          setDrawerOpen={controller.setDrawerOpen}
          homeUploadFlow={controller.homeUploadFlow}
          localizedCaseStatus={localizedCaseStatus}
          styles={styles}
        />
      ) : null}

      {controller.screen === "drafting" ? (
        <DraftingScreen
          language={controller.language}
          selectedTemplate={controller.selectedTemplate}
          setSelectedTemplate={controller.setSelectedTemplate as any}
          setScreen={controller.setScreen}
          styles={styles}
        />
      ) : null}

      {isTabScreen && (
        <View style={styles.bottomTabs} accessibilityRole="tablist">
          <Pressable onPress={() => { hapticTap(); LayoutAnimation.configureNext(subtleSpring); controller.setScreen("home"); }} style={styles.bottomTabItem} accessibilityRole="tab" accessibilityState={{ selected: controller.screen === "home" }} accessibilityLabel={controller.language === "es" ? "Inicio" : "Home"}>
            <Feather name="home" size={20} color={controller.screen === "home" ? palette.text : palette.subtle} />
            <Text style={[styles.bottomTabLabel, controller.screen === "home" ? styles.bottomTabLabelActive : null]}>
              {controller.language === "es" ? "Inicio" : "Home"}
            </Text>
            {controller.screen === "home" ? <View style={styles.bottomDot} /> : null}
          </Pressable>
          <Pressable onPress={() => { hapticTap(); LayoutAnimation.configureNext(subtleSpring); controller.setScreen("cases"); }} style={styles.bottomTabItem} accessibilityRole="tab" accessibilityState={{ selected: controller.screen === "cases" }} accessibilityLabel={controller.language === "es" ? "Casos" : "Cases"}>
            <Feather name="briefcase" size={20} color={controller.screen === "cases" ? palette.text : palette.subtle} />
            <Text style={[styles.bottomTabLabel, controller.screen === "cases" ? styles.bottomTabLabelActive : null]}>
              {controller.language === "es" ? "Casos" : "Cases"}
            </Text>
            {controller.screen === "cases" ? <View style={styles.bottomDot} /> : null}
          </Pressable>
          <Pressable onPress={() => { hapticTap(); void controller.homeUploadFlow(); }} style={styles.bottomUploadFab} accessibilityRole="button" accessibilityLabel={controller.language === "es" ? "Subir documento" : "Upload document"}>
            <Feather name="plus-circle" size={26} color="#FFFFFF" />
          </Pressable>
          <Pressable onPress={() => { hapticTap(); LayoutAnimation.configureNext(subtleSpring); controller.setScreen("account"); }} style={styles.bottomTabItem} accessibilityRole="tab" accessibilityState={{ selected: controller.screen === "account" }} accessibilityLabel={controller.language === "es" ? "Cuenta" : "Account"}>
            <Feather name="user" size={20} color={controller.screen === "account" ? palette.text : palette.subtle} />
            <Text style={[styles.bottomTabLabel, controller.screen === "account" ? styles.bottomTabLabelActive : null]}>
              {controller.language === "es" ? "Cuenta" : "Account"}
            </Text>
            {controller.screen === "account" ? <View style={styles.bottomDot} /> : null}
          </Pressable>
        </View>
      )}
    </>
  );
}
