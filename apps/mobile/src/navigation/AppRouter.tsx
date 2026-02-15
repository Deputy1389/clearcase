import React, { useMemo, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  LayoutAnimation,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { Newsreader_600SemiBold, Newsreader_700Bold } from "@expo-google-fonts/newsreader";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold
} from "@expo-google-fonts/plus-jakarta-sans";

import {
  MANUAL_DOCUMENT_TYPES,
  type CaseSummary
} from "../api";
import {
  languageLabel
} from "../utils/parsing";
import {
  clamp,
  titleize,
  fmtDate,
  fmtDateTime
} from "../utils/formatting";
import {
  manualCategoryOptions,
  manualCategoryLabel,
  casePriorityLevel,
  casePriorityLabel,
  severityLabel,
  severitySummary
} from "../utils/case-logic";
import {
  hapticTap
} from "../utils/haptics";
import { palette, font } from "../theme";

import LanguageScreen from "../screens/LanguageScreen";
import OnboardingScreen from "../screens/OnboardingScreen";
import LegalScreen from "../screens/LegalScreen";
import LegalAidScreen from "../screens/LegalAidScreen";
import DraftingScreen from "../screens/DraftingScreen";
import CasesScreen from "../screens/CasesScreen";
import AuthScreen from "../screens/AuthScreen";
import HomeScreen from "../screens/HomeScreen";
import WorkspaceScreen from "../screens/WorkspaceScreen";

import type {
  OnboardingSlide,
  UploadStage,
  AppLanguage,
  IntakeDraft
} from "../types";

function renderSlideIcon(slide: OnboardingSlide) {
  if (slide.icon === "scale") {
    return <MaterialCommunityIcons name="scale-balance" size={38} color={slide.iconColor} />;
  }
  return <Feather name={slide.icon} size={32} color={slide.iconColor} />;
}

function formatUploadStage(stage: UploadStage, language: AppLanguage = "en"): string {
  if (language === "es") {
    if (stage === "picking") return "Elegir archivo";
    if (stage === "preparing") return "Preparando carga";
    if (stage === "sending") return "Cargando de forma segura";
    if (stage === "processing") return "Generando analisis";
    return "Listo para cargar";
  }
  if (stage === "picking") return "Choose file";
  if (stage === "preparing") return "Preparing upload";
  if (stage === "sending") return "Uploading securely";
  if (stage === "processing") return "Generating insight";
  return "Ready to upload";
}

function localizedCaseStatus(value: string | null | undefined, language: AppLanguage = "en"): string {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) return language === "es" ? "Abierto" : "Open";

  if (language === "es") {
    if (normalized === "open") return "Abierto";
    if (normalized === "closed") return "Cerrado";
    if (normalized === "archived") return "Archivado";
    if (normalized === "pending") return "Pendiente";
    if (normalized === "in_progress") return "En progreso";
  }

  return titleize(normalized);
}

const subtleSpring = {
  duration: 250,
  update: { type: "spring" as const, springDamping: 0.85 },
  create: { type: "easeInEaseOut" as const, property: "opacity" as const },
  delete: { type: "easeInEaseOut" as const, property: "opacity" as const }
};

export function AppRouter({ controller }: { controller: any }) {
  const [fontsLoaded] = useFonts({
    Newsreader_600SemiBold,
    Newsreader_700Bold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold
  });

  const uploadStatusText = controller.uploading
    ? formatUploadStage(controller.uploadStage, controller.language)
    : controller.language === "es" ? "Listo para cargar" : "Ready to upload";

  const canOpenDrawer =
    controller.screen === "home" ||
    controller.screen === "workspace" ||
    controller.screen === "cases" ||
    controller.screen === "account" ||
    controller.screen === "legal";

  const drawerPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          if (!canOpenDrawer || controller.drawerOpen) return false;
          const startedAtEdge = gestureState.x0 <= 24 || gestureState.moveX <= 24;
          const horizontalSwipe =
            gestureState.dx > 14 &&
            Math.abs(gestureState.dy) < 20 &&
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
          return startedAtEdge && horizontalSwipe;
        },
        onPanResponderRelease: (_, gestureState) => {
          if (!canOpenDrawer || controller.drawerOpen) return;
          if (gestureState.dx > 55) controller.setDrawerOpen(true);
        }
      }),
    [canOpenDrawer, controller.drawerOpen]
  );

  const assetViewerImagePanStartRef = useRef({ x: 0, y: 0 });

  const assetViewerImagePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => controller.assetViewerIsImage && controller.assetViewerImageZoom > 1,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          controller.assetViewerIsImage &&
          controller.assetViewerImageZoom > 1 &&
          (Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3),
        onPanResponderGrant: () => {
          assetViewerImagePanStartRef.current = controller.assetViewerImagePanRef.current;
        },
        onPanResponderMove: (_, gestureState) => {
          const maxX = ((Math.max(controller.assetViewerImageZoom, 1) - 1) * controller.assetViewerImageBounds.width) / 2;
          const maxY = ((Math.max(controller.assetViewerImageZoom, 1) - 1) * controller.assetViewerImageBounds.height) / 2;
          controller.setAssetViewerImagePan({
            x: clamp(assetViewerImagePanStartRef.current.x + gestureState.dx, -maxX, maxX),
            y: clamp(assetViewerImagePanStartRef.current.y + gestureState.dy, -maxY, maxY)
          });
        }
      }),
    [controller.assetViewerImageBounds.height, controller.assetViewerImageBounds.width, controller.assetViewerImageZoom, controller.assetViewerIsImage]
  );

  if (!fontsLoaded || controller.isBootstrapping) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.loading}>
          <ActivityIndicator color={palette.primary} />
          <Text style={styles.loadingText}>Loading app...</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          {...drawerPanResponder.panHandlers}
        >
          {controller.banner ? (
            <View
              style={[
                styles.banner,
                controller.banner.tone === "good" ? styles.bannerGood : null,
                controller.banner.tone === "bad" ? styles.bannerBad : null
              ]}
            >
              <Text style={styles.bannerText}>{controller.banner.text}</Text>
            </View>
          ) : null}

          {controller.screen === "language" ? <LanguageScreen selectInitialLanguage={controller.selectInitialLanguage} styles={styles} /> : null}

          {controller.screen === "onboarding" ? <OnboardingScreen language={controller.language} slide={controller.slide} setSlide={controller.setSlide} onboardingSlides={controller.onboardingSlides} completeOnboarding={controller.completeOnboarding} renderSlideIcon={renderSlideIcon} styles={styles} /> : null}

          {controller.screen === "auth" ? (
            <AuthScreen
              language={controller.language}
              authMode={controller.authMode}
              setAuthMode={controller.setAuthMode}
              authName={controller.authName}
              setAuthName={controller.setAuthName}
              authZip={controller.authZip}
              setAuthZip={controller.setAuthZip}
              authEmail={controller.authEmail}
              setAuthEmail={controller.setAuthEmail}
              authPassword={controller.authPassword}
              setAuthPassword={controller.setAuthPassword}
              authBusy={controller.authBusy}
              authStage={controller.authStage}
              authIntent={controller.authIntent}
              setAuthIntent={controller.setAuthIntent}
              agreeAndContinue={controller.agreeAndContinue}
              styles={styles}
              palette={palette}
            />
          ) : null}

          {controller.screen === "home" ? (
            <HomeScreen
              navigation={{ screen: controller.screen, setScreen: controller.setScreen, goBack: controller.goBack, postLanguageScreen: controller.postLanguageScreen, setPostLanguageScreen: controller.setPostLanguageScreen, setDrawerOpen: controller.setDrawerOpen }}
              cases={{ cases: controller.cases, setCases: controller.setCases, selectedCaseId: controller.selectedCaseId, setSelectedCaseId: controller.setSelectedCaseId, selectedCase: controller.selectedCase, setSelectedCase: controller.setSelectedCase, selectedCaseSummary: controller.selectedCaseSummary, latestCase: controller.latestCase, filteredCases: controller.filteredCases, caseSearch: controller.caseSearch, setCaseSearch: controller.setCaseSearch, caseFilter: controller.caseFilter, setCaseFilter: controller.setCaseFilter, caseAssets: controller.caseAssets, setCaseAssets: controller.setCaseAssets, loadingCaseAssets: controller.loadingCaseAssets, setLoadingCaseAssets: controller.setLoadingCaseAssets, loadingDashboard: controller.loadingDashboard, loadingCase: controller.loadingCase, creatingCase: controller.creatingCase, savingProfile: controller.savingProfile, refreshing: controller.refreshing, userFirstName: controller.userFirstName, me: controller.me, setMe: controller.setMe, profileName: controller.profileName, setProfileName: controller.setProfileName, profileZip: controller.profileZip, setProfileZip: controller.setProfileZip, newCaseTitle: controller.newCaseTitle, setNewCaseTitle: controller.setNewCaseTitle, loadDashboard: controller.loadDashboard, loadCase: controller.loadCase, loadCaseAssetsForSelectedCase: controller.loadCaseAssetsForSelectedCase, createCaseWithTitle: controller.createCaseWithTitle, saveProfile: controller.saveProfile, refreshWorkspace: controller.refreshWorkspace, reconnectWorkspace: controller.reconnectWorkspace }}
              upload={{ uploading: controller.uploading, setUploading: controller.setUploading, uploadStage: controller.uploadStage, setUploadStage: controller.setUploadStage, uploadDescription: controller.uploadDescription, setUploadDescription: controller.setUploadDescription, uploadTargetCaseId: controller.uploadTargetCaseId, setUploadTargetCaseId: controller.setUploadTargetCaseId, uploadCaseTitle: controller.uploadCaseTitle, setUploadCaseTitle: controller.setUploadCaseTitle, uploadSheetOpen: controller.uploadSheetOpen, setUploadSheetOpen: controller.setUploadSheetOpen, latestContextReuseSourceCaseId: controller.latestContextReuseSourceCaseId, setLatestContextReuseSourceCaseId: controller.setLatestContextReuseSourceCaseId, uploadStatusText, uploadAssets: controller.uploadAssets, uploadDocument: controller.uploadDocument, uploadFromCamera: controller.uploadFromCamera, beginFileUpload: controller.beginFileUpload, beginCameraUpload: controller.beginCameraUpload, homeUploadFlow: controller.homeUploadFlow, openUploadSheetForCase: controller.openUploadSheetForCase, waitForCaseInsight: controller.waitForCaseInsight }}
              paywall={{ paywallConfig: controller.paywallConfig, planTier: controller.planTier, setPlanTier: controller.setPlanTier, plusEnabled: controller.plusEnabled, startingCheckout: controller.startingCheckout, planSheetOpen: controller.planSheetOpen, setPlanSheetOpen: controller.setPlanSheetOpen, startPlusCheckout: controller.startPlusCheckout as any, openPaywall: controller.openPaywall as any, promptPlusUpgrade: controller.promptPlusUpgrade as any, loadPaywallConfigState: controller.loadPaywallConfigState }}
              ui={{ language: controller.language, setLanguage: controller.setLanguage, applyLanguageFromSettings: controller.applyLanguageFromSettings, styles, palette, offlineMode: controller.offlineMode, showBanner: controller.showBanner, hapticTap }}
              auth={{ email: controller.email, accountInitials: controller.accountInitials, completion: controller.completion, signOut: controller.signOut }}
              helpers={{ localizedCaseStatus, formatUploadStage, titleize, fmtDate: fmtDate as any, fmtDateTime: fmtDateTime as any, manualCategoryLabel, casePriorityLevel, casePriorityLabel, severityLabel, severitySummary }}
            />
          ) : null}

          {controller.screen === "workspace" ? (
            <WorkspaceScreen
              navigation={{ screen: controller.screen, setScreen: controller.setScreen, goBack: controller.goBack, postLanguageScreen: controller.postLanguageScreen, setPostLanguageScreen: controller.setPostLanguageScreen, setDrawerOpen: controller.setDrawerOpen }}
              cases={{ cases: controller.cases, setCases: controller.setCases, selectedCaseId: controller.selectedCaseId, setSelectedCaseId: controller.setSelectedCaseId, selectedCase: controller.selectedCase, setSelectedCase: controller.setSelectedCase, selectedCaseSummary: controller.selectedCaseSummary, latestCase: controller.latestCase, filteredCases: controller.filteredCases, caseSearch: controller.caseSearch, setCaseSearch: controller.setCaseSearch, caseFilter: controller.caseFilter, setCaseFilter: controller.setCaseFilter, caseAssets: controller.caseAssets, setCaseAssets: controller.setCaseAssets, loadingCaseAssets: controller.loadingCaseAssets, setLoadingCaseAssets: controller.setLoadingCaseAssets, loadingDashboard: controller.loadingDashboard, loadingCase: controller.loadingCase, creatingCase: controller.creatingCase, savingProfile: controller.savingProfile, refreshing: controller.refreshing, userFirstName: controller.userFirstName, me: controller.me, setMe: controller.setMe, profileName: controller.profileName, setProfileName: controller.setProfileName, profileZip: controller.profileZip, setProfileZip: controller.setProfileZip, newCaseTitle: controller.newCaseTitle, setNewCaseTitle: controller.setNewCaseTitle, loadDashboard: controller.loadDashboard, loadCase: controller.loadCase, loadCaseAssetsForSelectedCase: controller.loadCaseAssetsForSelectedCase, createCaseWithTitle: controller.createCaseWithTitle, saveProfile: controller.saveProfile, refreshWorkspace: controller.refreshWorkspace, reconnectWorkspace: controller.reconnectWorkspace }}
              upload={{ uploading: controller.uploading, setUploading: controller.setUploading, uploadStage: controller.uploadStage, setUploadStage: controller.setUploadStage, uploadDescription: controller.uploadDescription, setUploadDescription: controller.setUploadDescription, uploadTargetCaseId: controller.uploadTargetCaseId, setUploadTargetCaseId: controller.setUploadTargetCaseId, uploadCaseTitle: controller.uploadCaseTitle, setUploadCaseTitle: controller.setUploadCaseTitle, uploadSheetOpen: controller.uploadSheetOpen, setUploadSheetOpen: controller.setUploadSheetOpen, latestContextReuseSourceCaseId: controller.latestContextReuseSourceCaseId, setLatestContextReuseSourceCaseId: controller.setLatestContextReuseSourceCaseId, uploadStatusText, uploadAssets: controller.uploadAssets, uploadDocument: controller.uploadDocument, uploadFromCamera: controller.uploadFromCamera, beginFileUpload: controller.beginFileUpload, beginCameraUpload: controller.beginCameraUpload, homeUploadFlow: controller.homeUploadFlow, openUploadSheetForCase: controller.openUploadSheetForCase, waitForCaseInsight: controller.waitForCaseInsight }}
              paywall={{ paywallConfig: controller.paywallConfig, planTier: controller.planTier, setPlanTier: controller.setPlanTier, plusEnabled: controller.plusEnabled, startingCheckout: controller.startingCheckout, planSheetOpen: controller.planSheetOpen, setPlanSheetOpen: controller.setPlanSheetOpen, startPlusCheckout: controller.startPlusCheckout as any, openPaywall: controller.openPaywall as any, promptPlusUpgrade: controller.promptPlusUpgrade as any, loadPaywallConfigState: controller.loadPaywallConfigState }}
              ui={{ language: controller.language, setLanguage: controller.setLanguage, applyLanguageFromSettings: controller.applyLanguageFromSettings, styles, palette, offlineMode: controller.offlineMode, showBanner: controller.showBanner, hapticTap }}
              auth={{ email: controller.email, accountInitials: controller.accountInitials, completion: controller.completion, signOut: controller.signOut }}
              workspace={{ workspaceSeverity: controller.workspaceSeverity, workspaceSummaryText: controller.workspaceSummaryText, workspaceSectionMeta: controller.workspaceSectionMeta, workspaceSectionOpen: controller.workspaceSectionOpen, toggleWorkspaceSection: controller.toggleWorkspaceSection, workspaceChecklistItems: controller.workspaceChecklistItems, premiumStepSummaryLine: controller.premiumStepSummaryLine, caseWatchEnabled: controller.caseWatchEnabled, savingWatchMode: controller.savingWatchMode, toggleCaseWatchMode: controller.toggleCaseWatchMode, weeklyCheckInStatus: controller.weeklyCheckInStatus, weeklyCheckInAction: controller.weeklyCheckInAction, watchMicroEvents: controller.watchMicroEvents, packetShareStatusLine: controller.packetShareStatusLine, caseContextDraft: controller.caseContextDraft, setCaseContextDraft: controller.setCaseContextDraft, savingCaseContext: controller.savingCaseContext, saveCaseContextForSelectedCase: controller.saveCaseContextForSelectedCase, classificationSheetOpen: controller.classificationSheetOpen, setClassificationSheetOpen: controller.setClassificationSheetOpen, classificationDraft: controller.classificationDraft as any, setClassificationDraft: controller.setClassificationDraft as any, savingClassification: controller.savingClassification, openManualCategoryPicker: controller.openManualCategoryPicker, saveManualCategoryForSelectedCase: controller.saveManualCategoryForSelectedCase, loadingPlainMeaning: controller.loadingPlainMeaning, openPlainMeaningTranslator: controller.openPlainMeaningTranslator, lawyerSummaryOpen: controller.lawyerSummaryOpen, setLawyerSummaryOpen: controller.setLawyerSummaryOpen, lawyerReadySummary: controller.lawyerReadySummary, shareLawyerReadySummary: controller.shareLawyerReadySummary, emailLawyerReadySummary: controller.emailLawyerReadySummary, intakeModalOpen: controller.intakeModalOpen, setIntakeModalOpen: controller.setIntakeModalOpen, intakeDraft: controller.intakeDraft, setIntakeDraft: controller.setIntakeDraft, intakeCompleteness: controller.intakeCompleteness, stepProgressMap: controller.stepProgressMap, setStepProgress: controller.setStepProgressMap as any, intakeSectionLabel: controller.intakeSectionLabel, intakePlaceholder: controller.intakePlaceholder, stepGroupLabel: controller.stepGroupLabel as any, premiumActionSteps: controller.premiumActionSteps, groupedPremiumSteps: controller.groupedPremiumSteps, evidenceCompleteness: controller.evidenceCompleteness, costSavingIndicator: controller.costSavingIndicator, consultLinks: controller.consultLinks, loadingConsultLinks: controller.loadingConsultLinks, creatingConsultLink: controller.creatingConsultLink, disablingConsultToken: controller.disablingConsultToken, createConsultPacketShareLink: controller.createConsultPacketShareLink, disableConsultPacketShareLink: controller.disableConsultPacketShareLink, assetViewerOpen: controller.assetViewerOpen, setAssetViewerOpen: controller.setAssetViewerOpen, assetViewerAsset: controller.assetViewerAsset, assetViewerUrl: controller.assetViewerUrl, assetViewerLoading: controller.assetViewerLoading, assetViewerIsPdf: controller.assetViewerIsPdf, assetViewerIsImage: controller.assetViewerIsImage, assetViewerRenderUrl: controller.assetViewerRenderUrl, assetViewerPdfPage: controller.assetViewerPdfPage, setAssetViewerPdfPage: controller.setAssetViewerPdfPage, assetViewerPdfZoom: controller.assetViewerPdfZoom, setAssetViewerPdfZoom: controller.setAssetViewerPdfZoom, assetViewerImageZoom: controller.assetViewerImageZoom, setAssetViewerImageZoom: controller.setAssetViewerImageZoom, assetViewerImagePan: controller.assetViewerImagePan, setAssetViewerImagePan: controller.setAssetViewerImagePan, openAssetAccess: controller.openAssetAccess, closeAssetViewer: controller.closeAssetViewer, openViewerUrlExternally: controller.openViewerUrlExternally }}
              push={{ pushEnabled: controller.pushEnabled, pushQuietHoursEnabled: controller.pushQuietHoursEnabled, savingPushPreferences: controller.savingPushPreferences, togglePushNotifications: controller.togglePushNotifications, togglePushQuietHours: controller.togglePushQuietHours }}
              legal={{ legalReturnScreen: controller.legalReturnScreen, setLegalReturnScreen: controller.setLegalReturnScreen }}
              helpers={{ localizedCaseStatus, formatUploadStage, titleize, fmtDate: fmtDate as any, fmtDateTime: fmtDateTime as any, manualCategoryLabel, casePriorityLevel, casePriorityLabel, severityLabel, severitySummary }}
            />
          ) : null}

          {controller.screen === "cases" ? <CasesScreen language={controller.language} cases={controller.cases} filteredCases={controller.filteredCases} caseSearch={controller.caseSearch} setCaseSearch={controller.setCaseSearch} caseFilter={controller.caseFilter} setCaseFilter={controller.setCaseFilter as any} loadingDashboard={controller.loadingDashboard} refreshing={controller.refreshing} refreshWorkspace={controller.refreshWorkspace} newCaseTitle={controller.newCaseTitle} setNewCaseTitle={controller.setNewCaseTitle} creatingCase={controller.creatingCase} createCaseWithTitle={controller.createCaseWithTitle as any} selectedCaseId={controller.selectedCaseId} setSelectedCaseId={controller.setSelectedCaseId} setScreen={controller.setScreen} setDrawerOpen={controller.setDrawerOpen} homeUploadFlow={controller.homeUploadFlow} localizedCaseStatus={localizedCaseStatus} styles={styles} /> : null}

          {controller.screen === "account" ? (
            <>
              <View style={styles.screenSoft}>
                <ScrollView contentContainerStyle={styles.scrollBody} refreshControl={<RefreshControl refreshing={controller.refreshing} onRefresh={() => void controller.refreshWorkspace()} />}>
                  <View style={styles.accountHeaderCard}>
                    <View style={styles.accountHeaderTop}>
                      <View style={styles.accountHeaderLeft}>
                        <Pressable onPress={() => controller.setDrawerOpen(true)} style={styles.info}>
                          <Feather name="menu" size={16} color={palette.subtle} />
                        </Pressable>
                        <Text style={styles.dashboardTitle}>Account</Text>
                      </View>
                    </View>
                    <View style={styles.accountProfileRow}>
                      <View style={styles.accountAvatar}>
                        <Text style={styles.accountAvatarText}>{controller.accountInitials}</Text>
                      </View>
                      <View style={styles.accountIdentity}>
                        <Text style={styles.accountName}>{controller.me?.user.fullName ?? "Complete your profile"}</Text>
                        <Text style={styles.accountMeta}>{controller.email}</Text>
                        <Text style={styles.accountMeta}>
                          {controller.me?.user.jurisdictionState ?? "Jurisdiction pending"} | {controller.completion}% complete
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={[styles.card, styles.accountPlanCard]}>
                    <Text style={styles.planLabel}>ClearCase Plus</Text>
                    <View style={styles.planTitleRow}>
                      <Text style={styles.planTitle}>
                        {controller.plusEnabled
                          ? controller.language === "es"
                            ? "Activo"
                            : "Active"
                          : controller.language === "es"
                            ? "No activo"
                            : "Not active"}
                      </Text>
                      <View style={styles.planTierPill}>
                        <Text style={styles.planTierPillText}>
                          {controller.plusEnabled
                            ? controller.language === "es"
                              ? "Plus"
                              : "Plus"
                            : controller.language === "es"
                              ? "Free"
                              : "Free"}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.planBody}>
                      {controller.language === "es"
                        ? "Recordatorios, memoria de cronologia, traduccion simple y herramientas de paquete de consulta en un solo plan."
                        : "Reminders, timeline memory, plain-meaning translation, and consultation packet tools in one plan."}
                    </Text>
                    <Text style={styles.planBodyMuted}>{controller.paywallConfig.plusPriceMonthly}</Text>
                    <Text style={styles.planBodyMuted}>
                      {controller.language === "es"
                        ? "ClearCase ofrece claridad legal, no asesoria legal."
                        : "ClearCase provides legal clarity, not legal advice."}
                    </Text>
                    <Pressable style={styles.accountUpgradeBtn} onPress={() => controller.openPaywall("account_billing_card")}>
                      <Text style={styles.accountUpgradeBtnText}>
                        {controller.plusEnabled
                          ? controller.language === "es"
                            ? "Administrar cobro"
                            : "Manage billing"
                          : controller.language === "es"
                            ? "Iniciar Plus"
                            : "Start Plus"}
                      </Text>
                    </Pressable>
                  </View>

                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Profile</Text>
                    <TextInput
                      style={styles.input}
                      value={controller.profileName}
                      onChangeText={controller.setProfileName}
                      placeholder="Full name"
                      placeholderTextColor={palette.subtle}
                      accessibilityLabel="Full name"
                    />
                    <TextInput
                      style={styles.input}
                      value={controller.profileZip}
                      onChangeText={controller.setProfileZip}
                      placeholder="ZIP code"
                      placeholderTextColor={palette.subtle}
                      keyboardType="number-pad"
                      accessibilityLabel="ZIP code"
                    />
                    <Pressable onPress={() => { hapticTap(); void controller.saveProfile(); }} style={styles.primaryBtn} disabled={controller.savingProfile}>
                      <Text style={styles.primaryBtnText}>{controller.savingProfile ? "Saving..." : "Save profile"}</Text>
                    </Pressable>
                  </View>

                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>{controller.language === "es" ? "Configuracion personal" : "Personal settings"}</Text>
                    <View style={styles.settingRow}>
                      <Feather name="globe" size={16} color={palette.subtle} />
                      <Text style={styles.settingText}>{controller.language === "es" ? "Idioma" : "Language"}</Text>
                      <Text style={styles.optionDesc}>{languageLabel(controller.language)}</Text>
                    </View>
                    <View style={styles.languageToggleRow}>
                      <Pressable
                        style={[styles.languageTogglePill, controller.language === "en" ? styles.languageTogglePillActive : null]}
                        onPress={() => void controller.applyLanguageFromSettings("en")}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: controller.language === "en" }}
                        accessibilityLabel="English"
                      >
                        <Text
                          style={[
                            styles.languageToggleText,
                            controller.language === "en" ? styles.languageToggleTextActive : null
                          ]}
                        >
                          English
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[styles.languageTogglePill, controller.language === "es" ? styles.languageTogglePillActive : null]}
                        onPress={() => void controller.applyLanguageFromSettings("es")}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: controller.language === "es" }}
                        accessibilityLabel="Espanol"
                      >
                        <Text
                          style={[
                            styles.languageToggleText,
                            controller.language === "es" ? styles.languageToggleTextActive : null
                          ]}
                        >
                          Espanol
                        </Text>
                      </Pressable>
                    </View>
                    <Pressable style={styles.settingRow} onPress={() => void controller.togglePushNotifications()} disabled={controller.savingPushPreferences} accessibilityRole="switch" accessibilityState={{ checked: controller.pushEnabled }} accessibilityLabel={controller.language === "es" ? "Notificaciones push" : "Push notifications"}>
                      <Feather name="bell" size={16} color={palette.subtle} />
                      <Text style={styles.settingText}>{controller.language === "es" ? "Notificaciones" : "Notifications"}</Text>
                      <Text style={styles.optionDesc}>
                        {controller.pushEnabled
                          ? controller.language === "es"
                            ? "Activadas"
                            : "Enabled"
                          : controller.language === "es"
                            ? "Desactivadas"
                            : "Disabled"}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.settingRow}
                      onPress={() => void controller.togglePushQuietHours()}
                      disabled={controller.savingPushPreferences}
                    >
                      <Feather name="moon" size={16} color={palette.subtle} />
                      <Text style={styles.settingText}>{controller.language === "es" ? "Horas de silencio" : "Quiet hours"}</Text>
                      <Text style={styles.optionDesc}>
                        {controller.pushQuietHoursEnabled
                          ? controller.language === "es"
                            ? "22:00-07:00 UTC"
                            : "10pm-7am UTC"
                          : controller.language === "es"
                            ? "Sin horario"
                            : "No schedule"}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.settingRow}
                      onPress={() => {
                        Alert.alert(
                          controller.language === "es" ? "Dispositivos push" : "Push Devices",
                          controller.language === "es"
                            ? `Tienes ${controller.me?.pushDevices?.activeCount ?? 0} dispositivo(s) registrado(s). Para eliminar un dispositivo, desactiva las notificaciones y vuelve a activarlas.`
                            : `You have ${controller.me?.pushDevices?.activeCount ?? 0} registered device(s). To remove a device, disable notifications and re-enable them.`,
                          [{ text: "OK" }]
                        );
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={controller.language === "es" ? "Dispositivos push" : "Push devices"}
                    >
                      <Feather name="smartphone" size={16} color={palette.subtle} />
                      <Text style={styles.settingText}>{controller.language === "es" ? "Dispositivos push" : "Push devices"}</Text>
                      <Text style={styles.optionDesc}>
                        {controller.me?.pushDevices?.activeCount ?? 0}
                      </Text>
                    </Pressable>
                    <Pressable style={styles.settingRow} onPress={() => controller.openPaywall("account_settings_billing")} accessibilityRole="button" accessibilityLabel={controller.language === "es" ? "Facturacion y planes" : "Billing and plans"}>
                      <Feather name="credit-card" size={16} color={palette.subtle} />
                      <Text style={styles.settingText}>{controller.language === "es" ? "Facturacion y planes" : "Billing and plans"}</Text>
                      <Feather name="chevron-right" size={14} color={palette.subtle} />
                    </Pressable>
                    <Pressable
                      style={styles.settingRow}
                      accessibilityRole="button"
                      accessibilityLabel={controller.language === "es" ? "Seguridad" : "Security"}
                      onPress={() => {
                        Alert.alert(
                          controller.language === "es" ? "Seguridad" : "Security",
                          controller.language === "es"
                            ? "Bloqueo biometrico: Usa Face ID o huella dactilar para proteger la app.\n\nEsta funcion estara disponible en una proxima actualizacion."
                            : "Biometric Lock: Use Face ID or fingerprint to protect the app.\n\nThis feature will be available in an upcoming update.",
                          [{ text: "OK" }]
                        );
                      }}
                    >
                      <Feather name="shield" size={16} color={palette.subtle} />
                      <Text style={styles.settingText}>{controller.language === "es" ? "Seguridad" : "Security"}</Text>
                      <Feather name="chevron-right" size={14} color={palette.subtle} />
                    </Pressable>
                    <Pressable
                      style={styles.settingRow}
                      accessibilityRole="button"
                      accessibilityLabel={controller.language === "es" ? "Aviso legal y privacidad" : "Legal and privacy"}
                      onPress={() => { controller.setLegalReturnScreen("account"); controller.setScreen("legal"); }}
                    >
                      <Feather name="file-text" size={16} color={palette.subtle} />
                      <Text style={styles.settingText}>{controller.language === "es" ? "Legal y privacidad" : "Legal & Privacy"}</Text>
                      <Feather name="chevron-right" size={14} color={palette.subtle} />
                    </Pressable>
                  </View>

                  <Pressable onPress={() => void controller.signOut()} style={[styles.outlineSoftBtn, styles.accountSignOutBtn]} accessibilityRole="button" accessibilityLabel={controller.language === "es" ? "Cerrar sesion" : "Sign out"}>
                    <Text style={styles.outlineSoftText}>{controller.language === "es" ? "Cerrar sesion" : "Sign out"}</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      Alert.alert(
                        controller.language === "es" ? "Eliminar cuenta" : "Delete Account",
                        controller.language === "es"
                          ? "Esta accion eliminara permanentemente tu cuenta, todos tus casos y documentos. Esta accion no se puede deshacer."
                          : "This will permanently delete your account, all your cases, and documents. This action cannot be undone.",
                        [
                          { text: controller.language === "es" ? "Cancelar" : "Cancel", style: "cancel" },
                          {
                            text: controller.language === "es" ? "Eliminar cuenta" : "Delete Account",
                            style: "destructive",
                            onPress: () => {
                              Alert.alert(
                                controller.language === "es" ? "Confirmar eliminacion" : "Confirm Deletion",
                                controller.language === "es"
                                  ? "Escribe ELIMINAR para confirmar."
                                  : "Are you absolutely sure? This is irreversible.",
                                [
                                  { text: controller.language === "es" ? "Cancelar" : "Cancel", style: "cancel" },
                                  {
                                    text: controller.language === "es" ? "Si, eliminar todo" : "Yes, delete everything",
                                    style: "destructive",
                                    onPress: async () => {
                                      try {
                                        if (!controller.offlineMode) {
                                          await fetch(`${controller.apiBase}/me`, { method: "DELETE", headers: { ...controller.headers, "Content-Type": "application/json" } });
                                        }
                                      } catch { /* best effort */ }
                                      await AsyncStorage.clear();
                                      controller.setMe(null);
                                      controller.setCases([]);
                                      controller.setSelectedCaseId(null);
                                      controller.setSelectedCase(null);
                                      controller.setEmail("");
                                      controller.setSubject("");
                                      controller.setPlanTier("free");
                                      controller.setScreen("onboarding");
                                      controller.showBanner("info", controller.language === "es" ? "Account deleted." : "Account deleted.");
                                    }
                                  }
                                ]
                              );
                            }
                          }
                        ]
                      );
                    }}
                    style={[styles.outlineSoftBtn, { borderColor: "#FCA5A5", marginBottom: 32 }]}
                    accessibilityRole="button"
                    accessibilityLabel={controller.language === "es" ? "Eliminar cuenta" : "Delete account"}
                  >
                    <Text style={[styles.outlineSoftText, { color: "#DC2626" }]}>{controller.language === "es" ? "Eliminar cuenta" : "Delete Account"}</Text>
                  </Pressable>
                </ScrollView>
              </View>
            </>
          ) : null}

          {controller.screen === "legal" ? <LegalScreen language={controller.language} setScreen={controller.setScreen} legalReturnScreen={controller.legalReturnScreen} styles={styles} /> : null}

          {controller.screen === "legalAid" ? <LegalAidScreen language={controller.language} legalAidSearch={controller.legalAidSearch} setLegalAidSearch={controller.setLegalAidSearch} selectedCaseId={controller.selectedCaseId} setLawyerSummaryOpen={controller.setLawyerSummaryOpen} setScreen={controller.setScreen} styles={styles} /> : null}

          {controller.screen === "drafting" ? <DraftingScreen language={controller.language} selectedTemplate={controller.selectedTemplate} setSelectedTemplate={controller.setSelectedTemplate as any} setScreen={controller.setScreen} styles={styles} /> : null}

          {(controller.screen === "home" || controller.screen === "workspace" || controller.screen === "cases" || controller.screen === "account") ? (
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
          ) : null}

          <Modal
            visible={controller.lawyerSummaryOpen}
            transparent
            animationType="slide"
            onRequestClose={() => controller.setLawyerSummaryOpen(false)}
          >
            <View style={styles.sheetOverlay}>
              <Pressable style={styles.sheetBackdrop} onPress={() => controller.setLawyerSummaryOpen(false)} accessibilityRole="button" accessibilityLabel="Close" />
              <View style={[styles.sheetCard, styles.summarySheetCard]}>
                <Text style={styles.sheetTitle}>{controller.language === "es" ? "Paquete de consulta" : "Lawyer-ready packet"}</Text>
                <Text style={styles.sheetSub}>
                  {controller.language === "es"
                    ? "Preparacion de consulta con hechos, fechas, materiales y preguntas abiertas en tono neutral."
                    : "Consultation prep with neutral facts, dates, materials, and open questions."}
                </Text>
                <ScrollView style={styles.summaryScroll} contentContainerStyle={styles.summaryScrollBody}>
                  <Text style={styles.summaryCaseTitle}>{controller.lawyerReadySummary.caseTitle}</Text>

                  <Text style={styles.summarySectionTitle}>{controller.language === "es" ? "Resumen en lenguaje claro" : "Plain-language summary"}</Text>
                  <Text style={styles.summaryBody}>{controller.lawyerReadySummary.summary}</Text>

                  <Text style={styles.summarySectionTitle}>{controller.language === "es" ? "Hechos clave" : "Key facts"}</Text>
                  {controller.lawyerReadySummary.facts.map((item: string, index: number) => (
                    <View key={`summary-fact-${index}`} style={styles.summaryBulletRow}>
                      <Text style={styles.summaryBulletDot}>-</Text>
                      <Text style={styles.summaryBulletText}>{item}</Text>
                    </View>
                  ))}

                  <Text style={styles.summarySectionTitle}>{controller.language === "es" ? "Fechas detectadas" : "Detected dates"}</Text>
                  {controller.lawyerReadySummary.dates.map((item: string, index: number) => (
                    <View key={`summary-date-${index}`} style={styles.summaryBulletRow}>
                      <Text style={styles.summaryBulletDot}>-</Text>
                      <Text style={styles.summaryBulletText}>{item}</Text>
                    </View>
                  ))}

                  <Text style={styles.summarySectionTitle}>{controller.language === "es" ? "Partes y jurisdiccion" : "Parties and jurisdiction"}</Text>
                  {controller.lawyerReadySummary.parties.map((item: string, index: number) => (
                    <View key={`summary-party-${index}`} style={styles.summaryBulletRow}>
                      <Text style={styles.summaryBulletDot}>-</Text>
                      <Text style={styles.summaryBulletText}>{item}</Text>
                    </View>
                  ))}

                  <Text style={styles.summarySectionTitle}>{controller.language === "es" ? "Resumen de intake formal" : "Formal intake snapshot"}</Text>
                  {controller.lawyerReadySummary.intakeOverview.map((item: string, index: number) => (
                    <View key={`summary-intake-${index}`} style={styles.summaryBulletRow}>
                      <Text style={styles.summaryBulletDot}>-</Text>
                      <Text style={styles.summaryBulletText}>{item}</Text>
                    </View>
                  ))}

                  <Text style={styles.summarySectionTitle}>{controller.language === "es" ? "Registro de comunicaciones" : "Communications log"}</Text>
                  <Text style={styles.summaryBody}>{controller.lawyerReadySummary.communicationsLog}</Text>

                  <Text style={styles.summarySectionTitle}>{controller.language === "es" ? "Impacto financiero" : "Financial impact"}</Text>
                  <Text style={styles.summaryBody}>{controller.lawyerReadySummary.financialImpact}</Text>

                  <Text style={styles.summarySectionTitle}>{controller.language === "es" ? "Resultado deseado" : "Desired outcome"}</Text>
                  <Text style={styles.summaryBody}>{controller.lawyerReadySummary.desiredOutcome}</Text>

                  <Text style={styles.summarySectionTitle}>{controller.language === "es" ? "Lista de evidencia" : "Evidence checklist"}</Text>
                  {controller.lawyerReadySummary.evidence.map((item: string, index: number) => (
                    <View key={`summary-evidence-${index}`} style={styles.summaryBulletRow}>
                      <Text style={styles.summaryBulletDot}>-</Text>
                      <Text style={styles.summaryBulletText}>{item}</Text>
                    </View>
                  ))}

                  <Text style={styles.summarySectionTitle}>{controller.language === "es" ? "Preguntas abiertas" : "Open questions"}</Text>
                  {controller.lawyerReadySummary.openQuestions.map((item: string, index: number) => (
                    <View key={`summary-question-${index}`} style={styles.summaryBulletRow}>
                      <Text style={styles.summaryBulletDot}>-</Text>
                      <Text style={styles.summaryBulletText}>{item}</Text>
                    </View>
                  ))}

                  <Text style={styles.summarySectionTitle}>{controller.language === "es" ? "Agenda sugerida para consulta" : "Suggested consult agenda"}</Text>
                  {controller.lawyerReadySummary.consultAgenda.map((item: string, index: number) => (
                    <View key={`summary-agenda-${index}`} style={styles.summaryBulletRow}>
                      <Text style={styles.summaryBulletDot}>-</Text>
                      <Text style={styles.summaryBulletText}>{item}</Text>
                    </View>
                  ))}

                  <Text style={styles.summarySectionTitle}>
                    {controller.language === "es" ? "Pasos que algunas personas consideran utiles" : "Steps people often find useful"}
                  </Text>
                  {controller.lawyerReadySummary.nextSteps.map((item: string, index: number) => (
                    <View key={`summary-step-${index}`} style={styles.summaryBulletRow}>
                      <Text style={styles.summaryBulletDot}>-</Text>
                      <Text style={styles.summaryBulletText}>{item}</Text>
                    </View>
                  ))}

                  <Text style={styles.summarySectionTitle}>{controller.language === "es" ? "Control de acceso" : "Access controls"}</Text>
                  <Text style={styles.summaryBody}>
                    {controller.language === "es"
                      ? "El enlace para compartir esta activo por 7 dias. Puedes desactivar el acceso en cualquier momento."
                      : "Share link active for 7 days. You can disable access at any time."}
                  </Text>
                  <Text style={styles.summaryBody}>{controller.packetShareStatusLine}</Text>
                  <Text style={styles.summarySectionTitle}>{controller.language === "es" ? "Indicador de ahorro de costos" : "Cost-saving indicator"}</Text>
                  <Text style={styles.summaryBody}>{controller.costSavingIndicator.message}</Text>
                  <Text style={styles.summaryBody}>{controller.costSavingIndicator.assumptions}</Text>
                  <Text style={styles.summarySectionTitle}>{controller.language === "es" ? "Historial de paquetes" : "Packet history"}</Text>
                  {controller.packetHistoryEntries.length === 0 ? (
                    <Text style={styles.summaryBody}>
                      {controller.language === "es" ? "Aun no hay versiones de paquete para este caso." : "No packet versions are available for this case yet."}
                    </Text>
                  ) : (
                    controller.packetHistoryEntries.map((entry: any) => (
                      <View key={`packet-history-${entry.version}-${entry.createdAt}`} style={styles.receiptRow}>
                        <Text style={styles.receiptTitle}>
                          {controller.language === "es" ? `Paquete v${entry.version}` : `Packet v${entry.version}`} - {entry.reason}
                        </Text>
                        <Text style={styles.receiptSub}>
                          {controller.language === "es" ? "Actualizado" : "Updated"}: {fmtDateTime(entry.createdAt)}
                        </Text>
                      </View>
                    ))
                  )}
                  {controller.loadingConsultLinks ? <ActivityIndicator color={palette.primary} style={styles.summaryLoader} /> : null}
                  {controller.consultLinks.length === 0 ? (
                    <Text style={styles.summaryBody}>
                      {controller.language === "es" ? "Aun no hay enlaces para compartir en este caso." : "No share links have been created for this case yet."}
                    </Text>
                  ) : (
                    controller.consultLinks.map((link: any) => (
                      <View key={`consult-link-${link.id}`} style={styles.consultLinkRow}>
                        <View style={styles.consultLinkMain}>
                          <Text style={styles.consultLinkTitle}>ID {link.id}</Text>
                          <Text style={styles.consultLinkMeta}>
                            {controller.language === "es" ? "Estado" : "Status"}: {titleize(link.status)} |{" "}
                            {controller.language === "es" ? "Expira" : "Expires"} {fmtDateTime(link.expiresAt)} |{" "}
                            {controller.language === "es" ? "Vista de token" : "Token preview"} {link.tokenPreview}
                          </Text>
                        </View>
                        <View style={styles.consultLinkActions}>
                          {link.status === "active" ? (
                            <Pressable
                              style={styles.linkMiniBtn}
                              onPress={() => void controller.disableConsultPacketShareLink(link.id)}
                              disabled={controller.disablingConsultToken === link.id}
                            >
                              <Text style={styles.linkMiniText}>
                                {controller.disablingConsultToken === link.id ? "..." : controller.language === "es" ? "Desactivar" : "Disable"}
                              </Text>
                            </Pressable>
                          ) : null}
                        </View>
                      </View>
                    ))
                  )}

                  <Text style={styles.summaryDisclaimer}>{controller.lawyerReadySummary.disclaimer}</Text>
                </ScrollView>
                <Pressable onPress={() => void controller.createConsultPacketShareLink()} style={styles.sheetActionBtn} disabled={controller.creatingConsultLink}>
                  <Feather name="link" size={16} color={palette.text} />
                  <Text style={styles.sheetActionText}>
                    {controller.creatingConsultLink
                      ? controller.language === "es"
                        ? "Creando enlace..."
                        : "Creating link..."
                      : controller.language === "es"
                        ? "Crear enlace de 7 dias"
                        : "Create 7-day share link"}
                  </Text>
                </Pressable>
                <Pressable onPress={() => void controller.emailLawyerReadySummary()} style={styles.sheetActionBtn}>
                  <Feather name="mail" size={16} color={palette.text} />
                  <Text style={styles.sheetActionText}>{controller.language === "es" ? "Borrador de correo" : "Email draft"}</Text>
                </Pressable>
                <Pressable onPress={() => void controller.shareLawyerReadySummary()} style={styles.sheetActionBtn}>
                  <Feather name="share-2" size={16} color={palette.text} />
                  <Text style={styles.sheetActionText}>{controller.language === "es" ? "Compartir / guardar paquete" : "Share / save packet"}</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    controller.setLawyerSummaryOpen(false);
                    controller.setIntakeModalOpen(true);
                  }}
                  style={styles.sheetActionBtn}
                >
                  <Feather name="clipboard" size={16} color={palette.text} />
                  <Text style={styles.sheetActionText}>
                    {controller.language === "es"
                      ? `Editar intake formal (${controller.intakeCompleteness}% completo)`
                      : `Edit formal intake (${controller.intakeCompleteness}% complete)`}
                  </Text>
                </Pressable>
                <Pressable onPress={() => controller.setLawyerSummaryOpen(false)} style={styles.sheetCancelBtn}>
                  <Text style={styles.sheetCancelText}>{controller.language === "es" ? "Cerrar" : "Close"}</Text>
                </Pressable>
              </View>
            </View>
          </Modal>

          <Modal
            visible={controller.plainMeaningOpen}
            transparent
            animationType="fade"
            onRequestClose={() => controller.setPlainMeaningOpen(false)}
          >
            <View style={styles.sheetOverlay}>
              <Pressable style={styles.sheetBackdrop} onPress={() => controller.setPlainMeaningOpen(false)} accessibilityRole="button" accessibilityLabel="Close" />
              <View style={[styles.sheetCard, styles.summarySheetCard]}>
                <Text style={styles.sheetTitle}>
                  {controller.language === "es" ? "Vista de significado simple" : "Plain meaning view"}
                </Text>
                <Text style={styles.sheetSub}>
                  {controller.language === "es"
                    ? "Lectura comparativa con referencias de origen para preparacion de consulta."
                    : "Side-by-side interpretation with source references for consultation prep."}
                </Text>
                <ScrollView style={styles.summaryScroll} contentContainerStyle={styles.summaryScrollBody}>
                  {controller.plainMeaningRows.length === 0 ? (
                    <Text style={styles.summaryBody}>
                      {controller.language === "es"
                        ? "Aun no hay filas de significado simple para este caso."
                        : "No plain meaning rows are available for this case yet."}
                    </Text>
                  ) : (
                    controller.plainMeaningRows.map((row: any) => (
                      <View key={`plain-meaning-${row.id}`} style={styles.receiptRow}>
                        <Text style={styles.summarySectionTitle}>
                          {controller.language === "es" ? "Texto original" : "Original text"}
                        </Text>
                        <Text style={styles.summaryBody}>{row.originalText}</Text>
                        <Text style={styles.summarySectionTitle}>
                          {controller.language === "es" ? "Significado simple" : "Plain meaning"}
                        </Text>
                        <Text style={styles.summaryBody}>{row.plainMeaning}</Text>
                        <Text style={styles.summarySectionTitle}>
                          {controller.language === "es" ? "Por que suele importar" : "Why this often matters"}
                        </Text>
                        <Text style={styles.summaryBody}>{row.whyThisOftenMatters}</Text>
                        <Text style={styles.summarySectionTitle}>
                          {controller.language === "es" ? "Elementos que muchas personas preparan" : "Commonly prepared items"}
                        </Text>
                        {row.commonlyPreparedItems.map((item: string, index: number) => (
                          <Text key={`${row.id}-item-${index}`} style={styles.summaryBulletText}>
                            - {item}
                          </Text>
                        ))}
                        {row.receipts.map((receipt: any, index: number) => (
                          <Text key={`${row.id}-receipt-${index}`} style={styles.receiptSub}>
                            {controller.language === "es" ? "Referencia" : "Receipt"}: {receipt.fileName} |{" "}
                            {controller.language === "es" ? "Confianza" : "Confidence"}:{" "}
                            {controller.language === "es"
                              ? receipt.confidence === "high"
                                ? "alta"
                                : receipt.confidence === "medium"
                                  ? "media"
                                  : "baja"
                              : receipt.confidence}
                            . {receipt.snippet}
                          </Text>
                        ))}
                        <Text style={styles.receiptSub}>
                          {controller.language === "es" ? "Incertidumbre" : "Uncertainty"}: {row.uncertainty}
                        </Text>
                      </View>
                    ))
                  )}
                  <Text style={styles.summaryDisclaimer}>
                    {controller.plainMeaningBoundary ||
                      (controller.language === "es"
                        ? "Interpretacion informativa para preparacion de consulta. No es asesoria legal."
                        : "Informational interpretation for consultation preparation. Not legal advice.")}
                  </Text>
                </ScrollView>
                <Pressable onPress={() => controller.setPlainMeaningOpen(false)} style={styles.sheetCancelBtn}>
                  <Text style={styles.sheetCancelText}>{controller.language === "es" ? "Cerrar" : "Close"}</Text>
                </Pressable>
              </View>
            </View>
          </Modal>

          <Modal
            visible={controller.assetViewerOpen}
            transparent
            animationType="fade"
            onRequestClose={controller.closeAssetViewer}
          >
            <View style={styles.sheetOverlay}>
              <Pressable style={styles.sheetBackdrop} onPress={controller.closeAssetViewer} accessibilityRole="button" accessibilityLabel="Close" />
              <View style={[styles.sheetCard, styles.summarySheetCard]}>
                <Text style={styles.sheetTitle}>
                  {controller.language === "es" ? "Visor de documentos" : "Case document viewer"}
                </Text>
                <Text style={styles.sheetSub}>
                  {controller.assetViewerAsset?.fileName ??
                    (controller.language === "es" ? "Archivo seleccionado" : "Selected file")}
                </Text>
                <Text style={styles.sheetModeHint}>
                  {controller.assetViewerAsset
                    ? `${controller.assetViewerAsset.mimeType} | ${controller.language === "es" ? "cargado" : "uploaded"} ${fmtDateTime(controller.assetViewerAsset.createdAt)}`
                    : ""}
                </Text>
                {controller.assetViewerIsPdf ? (
                  <View style={styles.premiumStepActions}>
                    <Pressable
                      style={styles.linkMiniBtn}
                      onPress={() => controller.setAssetViewerPdfPage((value: number) => Math.max(1, value - 1))}
                    >
                      <Text style={styles.linkMiniText}>{controller.language === "es" ? "Pagina -" : "Page -"}</Text>
                    </Pressable>
                    <Text style={styles.optionDesc}>
                      {controller.language === "es" ? "Pagina" : "Page"} {controller.assetViewerPdfPage}
                    </Text>
                    <Pressable
                      style={styles.linkMiniBtn}
                      onPress={() => controller.setAssetViewerPdfPage((value: number) => value + 1)}
                    >
                      <Text style={styles.linkMiniText}>{controller.language === "es" ? "Pagina +" : "Page +"}</Text>
                    </Pressable>
                    <Pressable
                      style={styles.linkMiniBtn}
                      onPress={() => controller.setAssetViewerPdfZoom((value: number) => Math.max(50, value - 25))}
                    >
                      <Text style={styles.linkMiniText}>{controller.language === "es" ? "Zoom -" : "Zoom -"}</Text>
                    </Pressable>
                    <Text style={styles.optionDesc}>{controller.assetViewerPdfZoom}%</Text>
                    <Pressable
                      style={styles.linkMiniBtn}
                      onPress={() => controller.setAssetViewerPdfZoom((value: number) => Math.min(300, value + 25))}
                    >
                      <Text style={styles.linkMiniText}>{controller.language === "es" ? "Zoom +" : "Zoom +"}</Text>
                    </Pressable>
                  </View>
                ) : controller.assetViewerIsImage ? (
                  <View style={styles.premiumStepActions}>
                    <Pressable
                      style={styles.linkMiniBtn}
                      onPress={() => controller.setAssetViewerImageZoom((value: number) => clamp(value - 0.25, 1, 4))}
                    >
                      <Text style={styles.linkMiniText}>{controller.language === "es" ? "Zoom -" : "Zoom -"}</Text>
                    </Pressable>
                    <Text style={styles.optionDesc}>{Math.round(controller.assetViewerImageZoom * 100)}%</Text>
                    <Pressable
                      style={styles.linkMiniBtn}
                      onPress={() => controller.setAssetViewerImageZoom((value: number) => clamp(value + 0.25, 1, 4))}
                    >
                      <Text style={styles.linkMiniText}>{controller.language === "es" ? "Zoom +" : "Zoom +"}</Text>
                    </Pressable>
                    <Pressable
                      style={styles.linkMiniBtn}
                      onPress={() => {
                        controller.setAssetViewerImageZoom(1);
                        controller.setAssetViewerImagePan({ x: 0, y: 0 });
                      }}
                    >
                      <Text style={styles.linkMiniText}>{controller.language === "es" ? "Reiniciar vista" : "Reset view"}</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Text style={styles.optionDesc}>
                    {controller.language === "es"
                      ? "Este formato se abre en el visor web integrado."
                      : "This format opens in the embedded web viewer."}
                  </Text>
                )}
                {controller.assetViewerIsImage ? (
                  <View
                    style={styles.viewerWebWrap}
                    onLayout={(event) => {
                      const nextWidth = Math.max(event.nativeEvent.layout.width, 1);
                      const nextHeight = Math.max(event.nativeEvent.layout.height, 1);
                      controller.setAssetViewerImageBounds((current: any) => {
                        if (
                          Math.round(current.width) === Math.round(nextWidth) &&
                          Math.round(current.height) === Math.round(nextHeight)
                        ) {
                          return current;
                        }
                        return { width: nextWidth, height: nextHeight };
                      });
                    }}
                    {...assetViewerImagePanResponder.panHandlers}
                  >
                    {controller.assetViewerRenderUrl ? (
                      <View style={styles.viewerImageStage}>
                        <Image
                          source={{ uri: controller.assetViewerRenderUrl }}
                          onLoadStart={() => controller.setAssetViewerLoading(true)}
                          onLoadEnd={() => controller.setAssetViewerLoading(false)}
                          style={[
                            styles.viewerImage,
                            {
                              transform: [
                                { translateX: controller.assetViewerImagePan.x },
                                { translateY: controller.assetViewerImagePan.y },
                                { scale: controller.assetViewerImageZoom }
                              ]
                            }
                          ]}
                          resizeMode="contain"
                        />
                      </View>
                    ) : (
                      <View style={styles.viewerFallbackWrap}>
                        <Text style={styles.summaryBody}>
                          {controller.language === "es"
                            ? "No hay URL de vista disponible para este archivo."
                            : "No viewer URL is available for this file."}
                        </Text>
                      </View>
                    )}
                    {controller.assetViewerLoading ? (
                      <View style={styles.viewerLoaderOverlay}>
                        <ActivityIndicator color={palette.primary} />
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <View style={styles.viewerWebWrap}>
                    {controller.assetViewerRenderUrl ? (
                      <WebView
                        source={{ uri: controller.assetViewerRenderUrl }}
                        onLoadStart={() => controller.setAssetViewerLoading(true)}
                        onLoadEnd={() => controller.setAssetViewerLoading(false)}
                        setBuiltInZoomControls
                        setDisplayZoomControls={false}
                        scalesPageToFit
                      />
                    ) : (
                      <View style={styles.viewerFallbackWrap}>
                        <Text style={styles.summaryBody}>
                          {controller.language === "es"
                            ? "No hay URL de vista disponible para este archivo."
                            : "No viewer URL is available for this file."}
                        </Text>
                      </View>
                    )}
                    {controller.assetViewerLoading ? (
                      <View style={styles.viewerLoaderOverlay}>
                        <ActivityIndicator color={palette.primary} />
                      </View>
                    ) : null}
                  </View>
                )}
                <Text style={styles.sheetModeHint}>
                  {controller.assetViewerIsImage
                    ? controller.language === "es"
                      ? "Zoom y desplazamiento estan disponibles dentro de la app. Si falla la carga, usa abrir externo."
                      : "Zoom and pan are available in-app. If loading fails, use open external."
                    : controller.language === "es"
                      ? "Si su dispositivo no puede renderizar PDF en esta vista, use abrir externo."
                      : "If your device cannot render PDF in this view, use open external."}
                </Text>
                <Pressable onPress={() => void controller.openViewerUrlExternally()} style={styles.sheetActionBtn}>
                  <Feather name="external-link" size={16} color={palette.text} />
                  <Text style={styles.sheetActionText}>
                    {controller.language === "es" ? "Abrir externo (respaldo)" : "Open external (fallback)"}
                  </Text>
                </Pressable>
                <Pressable onPress={controller.closeAssetViewer} style={styles.sheetCancelBtn}>
                  <Text style={styles.sheetCancelText}>{controller.language === "es" ? "Cerrar" : "Close"}</Text>
                </Pressable>
              </View>
            </View>
          </Modal>

          <Modal
            visible={controller.intakeModalOpen}
            transparent
            animationType="fade"
            onRequestClose={() => controller.setIntakeModalOpen(false)}
          >
            <View style={styles.sheetOverlay}>
              <Pressable style={styles.sheetBackdrop} onPress={() => controller.setIntakeModalOpen(false)} accessibilityRole="button" accessibilityLabel="Close" />
              <View style={[styles.sheetCard, styles.summarySheetCard]}>
                <Text style={styles.sheetTitle}>{controller.language === "es" ? "Intake formal de consulta" : "Formal Consultation Intake"}</Text>
                <Text style={styles.sheetSub}>
                  {controller.language === "es"
                    ? "Simula intake profesional para reducir tiempo pagado en consulta."
                    : "Simulate formal intake to reduce paid consultation time."}
                </Text>
                <Text style={styles.sheetModeHint}>
                  {controller.language === "es" ? "Completitud actual" : "Current completeness"}: {controller.intakeCompleteness}% |{" "}
                  {controller.language === "es" ? "Ahorro estimado" : "Estimated savings"}: {controller.costSavingIndicator.low}-{controller.costSavingIndicator.high}m
                </Text>
                <ScrollView style={styles.summaryScroll} contentContainerStyle={styles.summaryScrollBody}>
                  {(
                    [
                      "matterSummary",
                      "clientGoals",
                      "constraints",
                      "timelineNarrative",
                      "partiesAndRoles",
                      "communicationsLog",
                      "financialImpact",
                      "questionsForCounsel",
                      "desiredOutcome"
                    ] as Array<keyof IntakeDraft>
                  ).map((fieldKey) => (
                    <View key={`intake-field-${String(fieldKey)}`} style={styles.intakeFieldBlock}>
                      <Text style={styles.summarySectionTitle}>{controller.intakeSectionLabel(fieldKey)}</Text>
                      <TextInput
                        style={styles.caseContextInput}
                        multiline
                        value={controller.intakeDraft[fieldKey]}
                        onChangeText={(value) =>
                          controller.setIntakeDraft((current: any) => ({
                            ...current,
                            [fieldKey]: value
                          }))
                        }
                        placeholder={controller.intakePlaceholder(fieldKey)}
                        placeholderTextColor={palette.subtle}
                      />
                    </View>
                  ))}
                </ScrollView>
                <Pressable onPress={() => controller.setIntakeModalOpen(false)} style={styles.sheetActionBtn}>
                  <Feather name="check-circle" size={16} color={palette.text} />
                  <Text style={styles.sheetActionText}>
                    {controller.language === "es" ? "Guardar y volver al caso" : "Save and return to case"}
                  </Text>
                </Pressable>
                <Pressable onPress={() => controller.setIntakeModalOpen(false)} style={styles.sheetCancelBtn}>
                  <Text style={styles.sheetCancelText}>{controller.language === "es" ? "Cerrar" : "Close"}</Text>
                </Pressable>
              </View>
            </View>
          </Modal>

          <Modal
            visible={controller.planSheetOpen}
            transparent
            animationType="slide"
            onRequestClose={() => controller.setPlanSheetOpen(false)}
          >
            <View style={styles.sheetOverlay}>
              <Pressable style={styles.sheetBackdrop} onPress={() => controller.setPlanSheetOpen(false)} accessibilityRole="button" accessibilityLabel="Close" />
              <View style={styles.sheetCard}>
                <Text style={styles.sheetTitle}>
                  {controller.language === "es" ? "Iniciar ClearCase Plus" : "Start ClearCase Plus"}
                </Text>
                <Text style={styles.sheetSub}>
                  {controller.language === "es"
                    ? "Un plan para continuidad: seguir fechas, mantener memoria del caso, entender lenguaje legal y preparar consultas con menos friccion."
                    : "One plan for continuity: track dates, keep case memory, understand legal wording, and prepare faster for consultations."}
                </Text>
                <View style={styles.plusFeatureRow}>
                  <Feather name="calendar" size={14} color={palette.muted} />
                  <Text style={styles.plusFeatureText}>
                    {controller.language === "es" ? "Recordatorios para fechas detectadas" : "Deadline reminders for detected dates"}
                  </Text>
                </View>
                <View style={styles.plusFeatureRow}>
                  <Feather name="clock" size={14} color={palette.muted} />
                  <Text style={styles.plusFeatureText}>
                    {controller.language === "es" ? "Memoria del caso entre cargas" : "Case memory timeline across uploads"}
                  </Text>
                </View>
                <View style={styles.plusFeatureRow}>
                  <Feather name="book-open" size={14} color={palette.muted} />
                  <Text style={styles.plusFeatureText}>
                    {controller.language === "es" ? "Traduccion a significado simple" : "Plain-meaning translation for legal wording"}
                  </Text>
                </View>
                <View style={styles.plusFeatureRow}>
                  <Feather name="file-text" size={14} color={palette.muted} />
                  <Text style={styles.plusFeatureText}>
                    {controller.language === "es"
                      ? "Paquete listo para consulta con referencias"
                      : "Consultation-ready packet with source references"}
                  </Text>
                </View>
                <Text style={styles.plusPlanPrice}>ClearCase Plus: {controller.paywallConfig.plusPriceMonthly}</Text>
                <Text style={styles.sheetModeHint}>
                  {controller.language === "es"
                    ? "ClearCase ofrece claridad legal, no asesoria legal."
                    : "ClearCase provides legal clarity, not legal advice."}
                </Text>
                {controller.plusEnabled ? (
                  <Text style={styles.sheetModeHint}>
                    {controller.language === "es" ? "Plus esta activo." : "Plus is active."}
                  </Text>
                ) : null}
                <Pressable
                  style={styles.sheetActionBtn}
                  onPress={() => void controller.startPlusCheckout("plan_sheet")}
                  disabled={controller.startingCheckout || !controller.paywallConfig.billingEnabled}
                >
                  <Feather name="credit-card" size={16} color={palette.text} />
                  <Text style={styles.sheetActionText}>
                    {controller.startingCheckout
                      ? controller.language === "es"
                        ? "Iniciando..."
                        : "Starting..."
                      : controller.language === "es"
                        ? "Suscribirse"
                        : "Subscribe"}
                  </Text>
                </Pressable>
                <Pressable onPress={() => controller.setPlanSheetOpen(false)} style={styles.sheetCancelBtn}>
                  <Text style={styles.sheetCancelText}>{controller.language === "es" ? "Ahora no" : "Back"}</Text>
                </Pressable>
              </View>
            </View>
          </Modal>

          <Modal
            visible={controller.uploadSheetOpen}
            transparent
            animationType="slide"
            onRequestClose={() => {
              controller.setUploadSheetOpen(false);
              controller.setUploadDescription("");
              controller.setUploadCaseTitle("");
              controller.setUploadTargetCaseId(null);
            }}
          >
            <View style={styles.sheetOverlay}>
              <Pressable
                style={styles.sheetBackdrop}
                onPress={() => {
                  controller.setUploadSheetOpen(false);
                  controller.setUploadDescription("");
                  controller.setUploadCaseTitle("");
                  controller.setUploadTargetCaseId(null);
                }}
              />
              <View style={styles.sheetCard}>
                <Text style={styles.sheetTitle}>Add to case</Text>
                <Text style={styles.sheetSub}>Choose how you want to add documents or photos.</Text>
                <Text style={styles.sheetModeHint}>
                  {controller.uploadTargetCaseId ? "Adding to selected case." : "A new case will be created from this upload."}
                </Text>
                <View style={styles.sheetPrivacyRow}>
                  <Feather name="lock" size={12} color={palette.subtle} />
                  <Text style={styles.sheetPrivacyText}>Private by default. Uploads are processed only for your case insights.</Text>
                </View>
                {!controller.uploadTargetCaseId ? (
                  <TextInput
                    style={styles.sheetCaseNameInput}
                    value={controller.uploadCaseTitle}
                    onChangeText={controller.setUploadCaseTitle}
                    placeholder="Optional case title (rename anytime)"
                    placeholderTextColor={palette.subtle}
                    accessibilityLabel="Case title"
                  />
                ) : null}
                <TextInput
                  style={styles.sheetInput}
                  multiline
                  value={controller.uploadDescription}
                  onChangeText={controller.setUploadDescription}
                  placeholder="Optional: add anything not visible in the document (what happened, when, where)."
                  placeholderTextColor={palette.subtle}
                  accessibilityLabel="Document context description"
                />
                <Pressable onPress={() => void controller.beginFileUpload()} style={styles.sheetActionBtn} accessibilityRole="button" accessibilityLabel="Upload file or image">
                  <Feather name="upload" size={16} color={palette.text} />
                  <Text style={styles.sheetActionText}>Upload file or image</Text>
                </Pressable>
                <Pressable onPress={() => void controller.beginCameraUpload()} style={styles.sheetActionBtn} accessibilityRole="button" accessibilityLabel="Take photos">
                  <Feather name="camera" size={16} color={palette.text} />
                  <Text style={styles.sheetActionText}>Take photos (multi-page)</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    controller.setUploadSheetOpen(false);
                    controller.setUploadDescription("");
                    controller.setUploadCaseTitle("");
                    controller.setUploadTargetCaseId(null);
                  }}
                  style={styles.sheetCancelBtn}
                >
                  <Text style={styles.sheetCancelText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </Modal>

          <Modal
            visible={controller.classificationSheetOpen}
            transparent
            animationType="slide"
            onRequestClose={() => controller.setClassificationSheetOpen(false)}
          >
            <View style={styles.sheetOverlay}>
              <Pressable style={styles.sheetBackdrop} onPress={() => controller.setClassificationSheetOpen(false)} accessibilityRole="button" accessibilityLabel="Close" />
              <View style={[styles.sheetCard, styles.classificationSheet]}>
                <View style={styles.sheetHeaderLine} />
                <Text style={styles.sheetTitle}>{controller.language === "es" ? "Categoria del documento" : "Document Category"}</Text>
                <Text style={styles.sheetSub}>
                  {controller.language === "es"
                    ? "Selecciona la categoria que mejor describe este documento."
                    : "Select the category that best describes this document."}
                </Text>

                <ScrollView style={styles.classificationScroll}>
                  {MANUAL_DOCUMENT_TYPES.map((type: any) => (
                    <Pressable
                      key={`cat-${type}`}
                      style={[
                        styles.classificationItem,
                        controller.classificationDraft === type ? styles.classificationItemActive : null
                      ]}
                      onPress={() => controller.setClassificationDraft(type)}
                    >
                      <Text style={[
                        styles.classificationItemText,
                        controller.classificationDraft === type ? styles.classificationItemTextActive : null
                      ]}>
                        {manualCategoryLabel(type, controller.language)}
                      </Text>
                      {controller.classificationDraft === type ? <Feather name="check" size={16} color={palette.primary} /> : null}
                    </Pressable>
                  ))}
                </ScrollView>

                <View style={styles.classificationFooter}>
                  <Pressable
                    style={[styles.primaryBtn, controller.savingClassification ? styles.btnDisabled : null]}
                    onPress={() => void controller.saveManualCategoryForSelectedCase()}
                    disabled={controller.savingClassification}
                  >
                    <Text style={styles.primaryBtnText}>{controller.savingClassification ? (controller.language === "es" ? "Guardando..." : "Saving...") : (controller.language === "es" ? "Actualizar categoria" : "Update Category")}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>

          <Modal
            visible={controller.drawerOpen}
            transparent
            animationType="none"
            onRequestClose={() => controller.setDrawerOpen(false)}
          >
            <View style={styles.drawerOverlay}>
              <Pressable style={styles.drawerBackdrop} onPress={() => controller.setDrawerOpen(false)} accessibilityRole="button" accessibilityLabel="Close" />
              <Animated.View style={styles.drawerCard}>
                <SafeAreaView style={styles.fill}>
                  <View style={styles.drawerHeader}>
                    <Text style={styles.drawerBrand}>ClearCase</Text>
                    <Pressable onPress={() => controller.setDrawerOpen(false)} style={styles.drawerClose}>
                      <Feather name="x" size={20} color={palette.subtle} />
                    </Pressable>
                  </View>

                  <ScrollView style={styles.drawerBody}>
                    <Pressable
                      style={[styles.drawerItem, controller.screen === "home" ? styles.drawerItemActive : null]}
                      onPress={() => { controller.setDrawerOpen(false); controller.setScreen("home"); }}
                    >
                      <Feather name="home" size={18} color={controller.screen === "home" ? palette.primary : palette.subtle} />
                      <Text style={[styles.drawerItemText, controller.screen === "home" ? styles.drawerItemTextActive : null]}>{controller.language === "es" ? "Inicio" : "Home"}</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.drawerItem, controller.screen === "cases" ? styles.drawerItemActive : null]}
                      onPress={() => { controller.setDrawerOpen(false); controller.setScreen("cases"); }}
                    >
                      <Feather name="briefcase" size={18} color={controller.screen === "cases" ? palette.primary : palette.subtle} />
                      <Text style={[styles.drawerItemText, controller.screen === "cases" ? styles.drawerItemTextActive : null]}>{controller.language === "es" ? "Casos" : "Cases"}</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.drawerItem, controller.screen === "account" ? styles.drawerItemActive : null]}
                      onPress={() => { controller.setDrawerOpen(false); controller.setScreen("account"); }}
                    >
                      <Feather name="user" size={18} color={controller.screen === "account" ? palette.primary : palette.subtle} />
                      <Text style={[styles.drawerItemText, controller.screen === "account" ? styles.drawerItemTextActive : null]}>{controller.language === "es" ? "Cuenta" : "Account"}</Text>
                    </Pressable>

                    <View style={styles.drawerDivider} />

                    <Pressable
                      style={styles.drawerItem}
                      onPress={() => { controller.setDrawerOpen(false); controller.openPaywall("drawer_plus_link"); }}
                    >
                      <Feather name="star" size={18} color="#EAB308" />
                      <Text style={styles.drawerItemText}>ClearCase Plus</Text>
                    </Pressable>
                    <Pressable
                      style={styles.drawerItem}
                      onPress={() => { controller.setDrawerOpen(false); controller.setLegalReturnScreen(controller.screen); controller.setScreen("legal"); }}
                    >
                      <Feather name="file-text" size={18} color={palette.subtle} />
                      <Text style={styles.drawerItemText}>{controller.language === "es" ? "Legal y privacidad" : "Legal & Privacy"}</Text>
                    </Pressable>
                  </ScrollView>

                  <View style={styles.drawerFooter}>
                    <Pressable style={styles.drawerSignOut} onPress={() => { controller.setDrawerOpen(false); void controller.signOut(); }}>
                      <Feather name="log-out" size={16} color={palette.subtle} />
                      <Text style={styles.drawerSignOutText}>{controller.language === "es" ? "Cerrar sesion" : "Sign out"}</Text>
                    </Pressable>
                    <Text style={styles.drawerVersion}>v1.0.0-mvp</Text>
                  </View>
                </SafeAreaView>
              </Animated.View>
            </View>
          </Modal>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  fill: { flex: 1 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: palette.bg },
  loadingText: { marginTop: 8, color: palette.muted, fontFamily: font.medium },
  banner: { marginHorizontal: 16, marginTop: 10, marginBottom: 2, borderWidth: 1, borderColor: palette.line, borderRadius: 16, backgroundColor: palette.surfaceSoft, padding: 12 },
  bannerGood: { backgroundColor: palette.greenSoft, borderColor: "#BBF7D0" },
  bannerBad: { backgroundColor: palette.redSoft, borderColor: "#FECACA" },
  bannerText: { color: palette.text, fontFamily: font.medium, fontSize: 12 },
  screen: { flex: 1, backgroundColor: palette.bg, paddingHorizontal: 20, paddingTop: 8 },
  screenSoft: { flex: 1, backgroundColor: palette.surfaceSoft },
  rowTopRight: { alignItems: "flex-end", marginTop: 8 },
  rowTopLeft: { alignItems: "flex-start", marginTop: 4 },
  skip: { color: palette.subtle, fontFamily: font.semibold, fontSize: 13 },
  centerWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  onboardingCard: { width: "100%", borderRadius: 32, borderWidth: 1, borderColor: palette.line, paddingVertical: 32, paddingHorizontal: 24, shadowColor: "#0F172A", shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  slideStepper: { color: palette.subtle, fontFamily: font.bold, fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 },
  centerWrapSmall: { alignItems: "center", marginBottom: 8 },
  brandPill: { width: 96, height: 96, borderRadius: 32, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  heroTitle: { color: palette.text, fontFamily: font.bold, fontSize: 28, textAlign: "center", lineHeight: 34, marginBottom: 8, letterSpacing: -0.5 },
  heroCopy: { color: palette.muted, fontFamily: font.regular, fontSize: 16, lineHeight: 24, textAlign: "center", paddingHorizontal: 16 },
  bottomNav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 18 },
  circle: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: palette.line, alignItems: "center", justifyContent: "center" },
  invisible: { opacity: 0 },
  circleDark: { width: 46, height: 46, borderRadius: 23, backgroundColor: palette.primary, alignItems: "center", justifyContent: "center" },
  dots: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#CBD5E1" },
  dotActive: { width: 24, backgroundColor: palette.primary },
  brandRow: { flexDirection: "row", alignItems: "center", marginBottom: 30 },
  brandMark: { width: 44, height: 44, borderRadius: 14, backgroundColor: palette.primary, alignItems: "center", justifyContent: "center", marginRight: 10 },
  brandText: { color: palette.text, fontFamily: font.bold, fontSize: 38 },
  welcomeMuted: { color: palette.subtle, fontFamily: font.medium, fontSize: 20, marginBottom: 8 },
  authSelectionBody: { flex: 1, justifyContent: "center", alignItems: "center", width: "100%" },
  authSelectionHero: { width: "100%", borderRadius: 32, borderWidth: 1, borderColor: palette.line, paddingVertical: 32, paddingHorizontal: 24, marginBottom: 16, alignItems: "center", shadowColor: "#0F172A", shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  authSelectionActions: { width: "100%", maxWidth: 320 },
  authFooter: {
    paddingTop: 14,
    paddingBottom: 20,
    alignItems: "center"
  },
  authFooterBrand: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  authFooterBrandText: { color: "#A6B0C1", fontFamily: font.bold, fontSize: 10, letterSpacing: 1.8, marginLeft: 6 },
  authFooterLinks: { flexDirection: "row", alignItems: "center" },
  authFooterLink: { color: palette.subtle, fontFamily: font.medium, fontSize: 12 },
  authFooterDivider: { color: "#CBD5E1", marginHorizontal: 10 },
  scrollScreen: { flex: 1, backgroundColor: palette.bg },
  scrollBody: { paddingHorizontal: 20, paddingBottom: 20 },
  back: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  formTitle: { color: palette.text, fontFamily: font.bold, fontSize: 34, marginBottom: 8 },
  formSubtitle: { color: palette.muted, fontFamily: font.regular, fontSize: 15, lineHeight: 21, marginBottom: 14 },
  subtleCenterText: { color: palette.subtle, fontFamily: font.regular, fontSize: 12, lineHeight: 17, textAlign: "center", marginTop: 8, marginBottom: 2 },
  formTitleSmall: { color: palette.text, fontFamily: font.bold, fontSize: 20 },
  workspaceTitleWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  buildStamp: {
    color: palette.subtle,
    fontFamily: font.regular,
    fontSize: 10
  },
  devBadge: {
    color: "#0369A1",
    backgroundColor: "#E0F2FE",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    fontFamily: font.bold,
    fontSize: 10
  },
  offlinePill: {
    color: "#B45309",
    backgroundColor: "#FEF3C7",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    fontFamily: font.bold,
    fontSize: 10
  },
  sub: { color: palette.muted, fontFamily: font.regular, fontSize: 13, marginBottom: 10, paddingHorizontal: 20 },
  accountTypeRow: { flexDirection: "row", gap: 22, marginBottom: 16, paddingHorizontal: 2 },
  accountTypeItem: { flexDirection: "row", alignItems: "center" },
  accountTypeMuted: { opacity: 0.45 },
  accountTypeText: { color: palette.muted, fontFamily: font.medium, fontSize: 13, marginLeft: 8 },
  radioActiveOuter: { width: 18, height: 18, borderRadius: 10, borderWidth: 2, borderColor: "#CBD5E1", alignItems: "center", justifyContent: "center" },
  radioActiveInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.primary },
  radioInactiveOuter: { width: 18, height: 18, borderRadius: 10, borderWidth: 2, borderColor: "#CBD5E1" },
  fieldLabel: { color: palette.subtle, fontFamily: font.bold, fontSize: 10, letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 4 },
  input: { borderWidth: 1, borderColor: palette.line, borderRadius: 20, backgroundColor: palette.surfaceSoft, paddingHorizontal: 16, paddingVertical: 14, color: palette.text, fontFamily: font.regular, fontSize: 14, marginBottom: 8 },
  primaryBtn: { borderRadius: 24, backgroundColor: palette.primary, paddingVertical: 16, alignItems: "center", justifyContent: "center", marginTop: 4, shadowColor: "#0F172A", shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  primaryBtnText: { color: "#FFFFFF", fontFamily: font.bold, fontSize: 15 },
  outlineBtn: { borderRadius: 24, borderWidth: 2, borderColor: palette.primary, paddingVertical: 16, alignItems: "center", justifyContent: "center", marginTop: 8, width: "100%" },
  outlineBtnText: { color: palette.primary, fontFamily: font.bold, fontSize: 15 },
  disclaimerScreen: { flex: 1, backgroundColor: palette.bg },
  disclaimerHeaderRow: { flexDirection: "row", alignItems: "center", marginBottom: 12, marginTop: 8 },
  disclaimerShield: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#E2E8F0", alignItems: "center", justifyContent: "center", marginRight: 10 },
  disclaimerTitle: { color: palette.text, fontFamily: font.bold, fontSize: 30, marginBottom: 0, flex: 1, lineHeight: 34 },
  disclaimerP: { color: palette.muted, fontFamily: font.regular, fontSize: 14, lineHeight: 20, marginBottom: 8 },
  disclaimerCard: { backgroundColor: palette.surface, borderRadius: 24, borderWidth: 1, borderColor: palette.line, padding: 20, marginTop: 10 },
  disclaimerBulletRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 6 },
  disclaimerBulletDot: { width: 6, height: 6, borderRadius: 4, backgroundColor: "#94A3B8", marginTop: 7, marginRight: 8 },
  disclaimerBackText: { color: "#CBD5E1", fontFamily: font.medium, fontSize: 13 },
  card: { backgroundColor: palette.surface, borderRadius: 24, borderWidth: 1, borderColor: "#F1F5F9", padding: 18, marginBottom: 12, shadowColor: "#0F172A", shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  cardTitle: { color: palette.text, fontFamily: font.bold, fontSize: 16, marginBottom: 6 },
  cardTitleBig: { color: palette.text, fontFamily: font.bold, fontSize: 26, textAlign: "center", lineHeight: 31 },
  cardBody: { color: palette.muted, fontFamily: font.regular, fontSize: 13, lineHeight: 19, marginBottom: 4 },
  miniLabel: { color: palette.subtle, fontFamily: font.bold, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 6 },
  link: { alignItems: "center", marginTop: 8 },
  linkText: { color: palette.primary, fontFamily: font.medium, fontSize: 13 },
  homeHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  homeHeadCenter: { flex: 1, marginHorizontal: 8 },
  brandTinyRow: { flexDirection: "row", alignItems: "center" },
  brandTiny: { width: 28, height: 28, borderRadius: 9, backgroundColor: palette.primary, alignItems: "center", justifyContent: "center", marginRight: 8 },
  homeBrand: { color: palette.text, fontFamily: font.bold, fontSize: 22 },
  homeTagline: { color: palette.muted, fontFamily: font.regular, fontSize: 12, marginTop: 2 },
  offlineBadge: {
    marginTop: 5,
    alignSelf: "flex-start",
    color: "#B45309",
    backgroundColor: "#FEF3C7",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontFamily: font.bold,
    fontSize: 10
  },
  info: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" },
  homeBody: { paddingBottom: 20, flexGrow: 1 },
  homeHeroCard: { borderRadius: 32, padding: 24, marginBottom: 12, shadowColor: "#0F172A", shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  miniLabelLight: { color: "#CBD5E1", fontFamily: font.bold, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 6 },
  homeHeroTitle: { color: "#FFFFFF", fontFamily: font.bold, fontSize: 31, lineHeight: 36, marginBottom: 8 },
  homeHeroCopy: { color: "#E2E8F0", fontFamily: font.regular, fontSize: 14, lineHeight: 20 },
  uploadStatusPill: { marginTop: 12, marginBottom: 10, alignSelf: "flex-start", borderRadius: 999, borderWidth: 1, borderColor: "#334155", backgroundColor: "#0B1220", paddingHorizontal: 10, paddingVertical: 5, flexDirection: "row", alignItems: "center" },
  uploadStatusText: { color: "#E2E8F0", fontFamily: font.medium, fontSize: 12 },
  heroPrivacyRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  heroPrivacyText: { flex: 1, color: "#CBD5E1", fontFamily: font.regular, fontSize: 11, lineHeight: 15 },
  heroPrimaryBtn: { marginTop: 2, backgroundColor: "#111827" },
  homeTitle: { color: "#334155", fontFamily: font.regular, fontSize: 34, lineHeight: 40, marginBottom: 14 },
  homeStrong: { color: palette.text, fontFamily: font.semibold },
  imageWrap: { width: "100%", aspectRatio: 16 / 9, borderRadius: 24, overflow: "hidden", marginBottom: 12, borderWidth: 1, borderColor: palette.line },
  image: { width: "100%", height: "100%" },
  ctaInline: { flexDirection: "row", alignItems: "center", gap: 8 },
  outlineSoftBtn: { borderRadius: 24, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, paddingVertical: 14, alignItems: "center", justifyContent: "center", marginTop: 8 },
  outlineSoftText: { color: palette.muted, fontFamily: font.bold, fontSize: 14 },
  legal: { color: palette.subtle, fontFamily: font.regular, fontSize: 11, lineHeight: 16, textAlign: "center", marginTop: 10 },
  legalInline: { color: palette.subtle, fontFamily: font.regular, fontSize: 11, lineHeight: 16, marginTop: 4 },
  uploadStateRow: { flexDirection: "row", alignItems: "center", marginTop: 4, marginBottom: 6 },
  subtleNote: { color: palette.subtle, fontFamily: font.regular, fontSize: 12, lineHeight: 17, marginTop: 7 },
  intakeTitle: { color: palette.text, fontFamily: font.medium, fontSize: 33, marginBottom: 6, marginLeft: 4 },
  intakeSub: { color: palette.muted, fontFamily: font.regular, fontSize: 14, marginBottom: 12, marginLeft: 4 },
  intakeList: { paddingHorizontal: 4, paddingBottom: 10 },
  intakeFooter: { paddingVertical: 16, alignItems: "center" },
  intakeFooterText: { color: palette.subtle, fontFamily: font.regular, fontSize: 12, fontStyle: "italic" },
  option: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    backgroundColor: palette.surface,
    padding: 18,
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
    shadowColor: "#0F172A",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
  },
  optionIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: palette.surfaceSoft, alignItems: "center", justifyContent: "center", marginRight: 12 },
  optionText: { flex: 1 },
  optionTitle: { color: palette.text, fontFamily: font.semibold, fontSize: 15, marginBottom: 2 },
  optionDesc: { color: palette.muted, fontFamily: font.regular, fontSize: 12, lineHeight: 17 },
  verdictHead: { backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  verdictTopLabel: { color: palette.subtle, fontFamily: font.medium, fontSize: 12 },
  verdictBody: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  spacer: { width: 34 },
  resultIcon: { width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  resultWarn: { backgroundColor: palette.amberSoft },
  resultGood: { backgroundColor: palette.greenSoft },
  metricRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  metricCard: { flex: 1, borderWidth: 1, borderRadius: 20, padding: 12 },
  metricRiskHigh: { backgroundColor: "#FEE2E2", borderColor: "#FECACA" },
  metricRiskMedium: { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" },
  metricRiskLow: { backgroundColor: "#DCFCE7", borderColor: "#BBF7D0" },
  metricCardNeutral: { flex: 1, borderWidth: 1, borderColor: palette.line, borderRadius: 20, padding: 12, backgroundColor: palette.surfaceSoft },
  metricLabel: { color: palette.subtle, fontFamily: font.bold, fontSize: 9, textTransform: "uppercase", letterSpacing: 1.05, marginBottom: 4 },
  metricValue: { color: palette.text, fontFamily: font.semibold, fontSize: 18 },
  metricTimeRow: { flexDirection: "row", alignItems: "center" },
  metricTimeText: { color: palette.muted, fontFamily: font.semibold, fontSize: 11, marginLeft: 5, flex: 1 },
  stepRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  stepDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center", marginRight: 10, marginTop: 2 },
  stepDotText: { color: palette.muted, fontFamily: font.bold, fontSize: 10 },
  stepText: { color: palette.muted, fontFamily: font.regular, fontSize: 13, lineHeight: 19, flex: 1 },
  verdictFooter: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 6 },
  verdictFooterText: { color: palette.subtle, fontFamily: font.medium, fontSize: 10, marginRight: 5 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  row: { flexDirection: "row", alignItems: "center" },
  dotStatus: { width: 9, height: 9, borderRadius: 99, backgroundColor: "#CBD5E1", marginRight: 6 },
  dotGood: { backgroundColor: palette.green },
  dotBad: { backgroundColor: "#B91C1C" },
  caseRow: { borderRadius: 20, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, padding: 14, marginTop: 8 },
  caseRowActive: { borderColor: "#64748B", backgroundColor: "#F1F5F9" },
  bottomTabs: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: palette.line,
    backgroundColor: palette.surface
  },
  bottomTabItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, paddingVertical: 4 },
  bottomTabLabel: { color: palette.subtle, fontFamily: font.bold, fontSize: 10 },
  bottomTabLabelActive: { color: palette.text },
  bottomUploadFab: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -20,
    borderWidth: 4,
    borderColor: palette.surface,
    shadowColor: "#0F172A",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end"
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.55)"
  },
  sheetCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    gap: 10,
    shadowColor: "#0F172A",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 8
  },
  sheetTitle: {
    color: palette.text,
    fontFamily: font.bold,
    fontSize: 20
  },
  sheetSub: {
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 12,
    marginBottom: 6
  },
  sheetModeHint: {
    color: "#334155",
    fontFamily: font.medium,
    fontSize: 12,
    marginBottom: 2
  },
  sheetPrivacyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6
  },
  sheetPrivacyText: {
    flex: 1,
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 16
  },
  sheetCaseNameInput: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: palette.text,
    fontFamily: font.medium,
    fontSize: 14
  },
  sheetInput: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 76,
    color: palette.text,
    fontFamily: font.regular,
    fontSize: 14,
    textAlignVertical: "top"
  },
  sheetActionBtn: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  sheetActionText: {
    color: palette.text,
    fontFamily: font.semibold,
    fontSize: 14
  },
  sheetCancelBtn: {
    marginTop: 6,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    paddingVertical: 14,
    alignItems: "center"
  },
  sheetCancelText: {
    color: palette.muted,
    fontFamily: font.semibold,
    fontSize: 13
  },
  classificationSheet: {
    maxHeight: "78%"
  },
  sheetHeaderLine: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E2E8F0",
    alignSelf: "center",
    marginBottom: 16
  },
  classificationScroll: {
    maxHeight: 340
  },
  classificationItem: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  classificationItemActive: {
    borderColor: "#0F172A",
    backgroundColor: "#0F172A"
  },
  classificationItemText: {
    color: palette.text,
    fontFamily: font.medium,
    fontSize: 13
  },
  classificationItemTextActive: {
    color: "#FFFFFF",
    fontFamily: font.semibold
  },
  classificationFooter: {
    marginTop: 12
  },
  btnDisabled: {
    opacity: 0.5
  },
  drawerCard: {
    width: "82%",
    height: "100%",
    backgroundColor: palette.surface,
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
    shadowColor: "#0F172A",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 4, height: 0 },
    elevation: 8
  },
  drawerBrand: {
    color: palette.text,
    fontFamily: font.bold,
    fontSize: 22
  },
  drawerClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center"
  },
  drawerBody: {
    paddingTop: 14
  },
  drawerItemActive: {
    borderColor: palette.primary,
    backgroundColor: "#EFF6FF"
  },
  drawerItemTextActive: {
    color: palette.primary
  },
  drawerDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 14
  },
  drawerFooter: {
    marginTop: "auto",
    paddingBottom: 20
  },
  drawerSignOut: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14
  },
  drawerSignOutText: {
    color: palette.muted,
    fontFamily: font.bold,
    fontSize: 14
  },
  drawerVersion: {
    color: palette.subtle,
    fontFamily: font.regular,
    fontSize: 10,
    textAlign: "center",
    marginTop: 8
  },
  categorySheetCard: {
    maxHeight: "78%"
  },
  summarySheetCard: {
    maxHeight: "88%"
  },
  summaryScroll: {
    maxHeight: 360
  },
  summaryScrollBody: {
    paddingBottom: 8
  },
  viewerWebWrap: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    minHeight: 340,
    overflow: "hidden"
  },
  viewerImageStage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  viewerImage: {
    width: "100%",
    height: "100%"
  },
  viewerFallbackWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16
  },
  viewerLoaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.7)"
  },
  summaryCaseTitle: {
    color: palette.text,
    fontFamily: font.semibold,
    fontSize: 16,
    marginBottom: 6
  },
  summarySectionTitle: {
    color: palette.text,
    fontFamily: font.bold,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 10,
    marginBottom: 4
  },
  summaryBody: {
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 18
  },
  summaryBulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginBottom: 4
  },
  summaryBulletDot: {
    color: palette.subtle,
    fontFamily: font.bold,
    fontSize: 12,
    width: 10,
    marginTop: 1
  },
  summaryBulletText: {
    flex: 1,
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 17
  },
  summaryDisclaimer: {
    marginTop: 10,
    color: palette.subtle,
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 16
  },
  summaryLoader: {
    marginVertical: 8
  },
  consultLinkRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    padding: 10,
    marginTop: 6
  },
  consultLinkMain: {
    marginBottom: 6
  },
  consultLinkTitle: {
    color: palette.text,
    fontFamily: font.semibold,
    fontSize: 12
  },
  consultLinkMeta: {
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 11,
    marginTop: 2
  },
  consultLinkActions: {
    flexDirection: "row",
    gap: 8
  },
  linkMiniBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  linkMiniText: {
    color: "#334155",
    fontFamily: font.semibold,
    fontSize: 11
  },
  categoryList: {
    maxHeight: 340
  },
  categoryListBody: {
    paddingBottom: 8
  },
  categoryOption: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  categoryOptionActive: {
    borderColor: "#0F172A",
    backgroundColor: "#0F172A"
  },
  categoryOptionText: {
    color: palette.text,
    fontFamily: font.medium,
    fontSize: 13
  },
  categoryOptionTextActive: {
    color: "#FFFFFF",
    fontFamily: font.semibold
  },
  drawerOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    justifyContent: "flex-start"
  },
  drawerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.45)"
  },
  drawerPanel: {
    width: "82%",
    height: "100%",
    backgroundColor: palette.surface,
    paddingTop: 20,
    paddingHorizontal: 16,
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
    shadowColor: "#0F172A",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 4, height: 0 },
    elevation: 8
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14
  },
  drawerItem: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 6
  },
  drawerItemText: {
    color: palette.text,
    fontFamily: font.semibold,
    fontSize: 14
  },
  drawerBrandSub: {
    color: palette.subtle,
    fontFamily: font.bold,
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1.2
  },
  drawerSectionTitle: {
    color: palette.subtle,
    fontFamily: font.bold,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    marginTop: 6,
    marginBottom: 6
  },
  drawerBottom: {
    marginTop: "auto"
  },
  drawerDangerText: {
    color: "#B91C1C",
    fontFamily: font.semibold,
    fontSize: 14
  },
  proPromptCard: {
    marginTop: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    padding: 14,
    flexDirection: "row",
    gap: 10
  },
  proPromptIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center"
  },
  proPromptBody: {
    flex: 1
  },
  proPromptTitle: {
    color: palette.text,
    fontFamily: font.semibold,
    fontSize: 13,
    marginBottom: 2
  },
  proPromptCopy: {
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 6
  },
  proPromptLink: {
    color: "#2563EB",
    fontFamily: font.bold,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.9
  },
  waitlistHeader: {
    marginBottom: 10
  },
  waitlistIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10
  },
  waitlistTitle: {
    color: palette.text,
    fontFamily: font.display,
    fontSize: 34,
    lineHeight: 38,
    marginBottom: 6
  },
  waitlistCopy: {
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8
  },
  waitlistBtn: {
    marginTop: 10
  },
  waitlistSuccess: {
    marginTop: 12,
    backgroundColor: "#F0FDF4",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#DCFCE7",
    padding: 16
  },
  waitlistSuccessIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8
  },
  waitlistSuccessTitle: {
    color: "#14532D",
    fontFamily: font.bold,
    fontSize: 17,
    marginBottom: 4
  },
  waitlistSuccessCopy: {
    color: "#166534",
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10
  },
  homeDashboardContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20
  },
  homeDashboardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10
  },
  homeDashboardTitleWrap: {
    flex: 1,
    marginHorizontal: 10
  },
  dashboardTitle: {
    color: palette.text,
    fontFamily: font.displaySemibold,
    fontSize: 32,
    lineHeight: 36
  },
  dashboardSubtitle: {
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 13
  },
  avatarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center"
  },
  avatarButtonText: {
    color: palette.muted,
    fontFamily: font.bold,
    fontSize: 11
  },
  searchBar: {
    marginTop: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  searchInput: {
    flex: 1,
    color: palette.text,
    fontFamily: font.regular,
    fontSize: 13
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 8
  },
  sectionTitle: {
    color: palette.text,
    fontFamily: font.bold,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.2
  },
  sectionAction: {
    color: palette.subtle,
    fontFamily: font.bold,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.1
  },
  caseContextHint: {
    color: palette.subtle,
    fontFamily: font.bold,
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1
  },
  caseContextHelper: {
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8
  },
  caseContextInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 80,
    color: palette.text,
    fontFamily: font.regular,
    fontSize: 13,
    textAlignVertical: "top"
  },
  dashboardCaseCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 24,
    padding: 18,
    marginBottom: 10,
    shadowColor: "#0F172A",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
  },
  dashboardCaseTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8
  },
  caseMetaText: {
    color: palette.subtle,
    fontFamily: font.bold,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.2
  },
  priorityChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4
  },
  priorityChipHigh: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA"
  },
  priorityChipMedium: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FDE68A"
  },
  priorityChipLow: {
    backgroundColor: "#ECFDF5",
    borderColor: "#BBF7D0"
  },
  priorityChipText: {
    color: palette.text,
    fontFamily: font.bold,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.9
  },
  dashboardCaseTitle: {
    color: palette.text,
    fontFamily: font.semibold,
    fontSize: 18,
    lineHeight: 22,
    marginBottom: 2
  },
  dashboardCaseSubtitle: {
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 12
  },
  tipsGrid: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6
  },
  tipCard: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    padding: 16,
    shadowColor: "#0F172A",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
  },
  tipIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8
  },
  tipIconGreen: {
    backgroundColor: "#ECFDF5"
  },
  tipIconBlue: {
    backgroundColor: "#EFF6FF"
  },
  tipIconAmber: {
    backgroundColor: "#FEF3C7"
  },
  tipTitle: {
    color: palette.text,
    fontFamily: font.semibold,
    fontSize: 12,
    marginBottom: 2
  },
  tipCopy: {
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 14
  },
  workspacePrimaryCard: {
    borderLeftWidth: 4
  },
  workspacePrimaryHigh: {
    borderLeftColor: "#DC2626"
  },
  workspacePrimaryMedium: {
    borderLeftColor: "#D97706"
  },
  workspacePrimaryLow: {
    borderLeftColor: "#16A34A"
  },
  workspacePillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8
  },
  workspaceCaseTitle: {
    color: palette.text,
    fontFamily: font.semibold,
    fontSize: 22,
    lineHeight: 28,
    marginBottom: 4
  },
  workspaceCaseMeta: {
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 12,
    marginBottom: 8
  },
  workspaceMetricsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10
  },
  workspaceMetricCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 10
  },
  metricValueSm: {
    color: palette.text,
    fontFamily: font.semibold,
    fontSize: 14
  },
  autoBadge: {
    color: "#047857",
    backgroundColor: "#ECFDF5",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontFamily: font.bold,
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1
  },
  actionPlanCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14
  },
  workspaceAccordionBar: {
    borderWidth: 2,
    borderColor: "#93C5FD",
    backgroundColor: "#EFF6FF",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10
  },
  workspaceAccordionTitle: {
    color: palette.text,
    fontFamily: font.bold,
    fontSize: 15
  },
  workspaceAccordionMetaWrap: {
    flexDirection: "row",
    alignItems: "center"
  },
  workspaceAccordionMeta: {
    color: "#1E3A8A",
    fontFamily: font.medium,
    fontSize: 12,
    letterSpacing: 0.3,
    marginRight: 6
  },
  actionPlanHigh: {
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2"
  },
  actionPlanMedium: {
    borderColor: "#FDE68A",
    backgroundColor: "#FFFBEB"
  },
  actionPlanLow: {
    borderColor: "#BBF7D0",
    backgroundColor: "#F0FDF4"
  },
  actionPlanSubhead: {
    color: "#334155",
    fontFamily: font.medium,
    fontSize: 12,
    marginBottom: 8
  },
  plusPreviewCard: {
    borderColor: "#BFDBFE",
    backgroundColor: "#F8FAFC"
  },
  plusActiveCard: {
    borderColor: "#BBF7D0",
    backgroundColor: "#F0FDF4"
  },
  plusLockedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "#E2E8F0"
  },
  plusLockedPillText: {
    color: "#334155",
    fontFamily: font.bold,
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  plusLivePill: {
    borderRadius: 999,
    backgroundColor: "#166534",
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  plusLivePillText: {
    color: "#FFFFFF",
    fontFamily: font.bold,
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  plusFeatureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 6
  },
  plusFeatureText: {
    flex: 1,
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 17
  },
  plusLockedActionRow: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    padding: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8
  },
  plusLockedActionTextWrap: {
    flex: 1
  },
  plusLockedActionTitle: {
    color: palette.text,
    fontFamily: font.semibold,
    fontSize: 12,
    marginBottom: 2
  },
  plusLockedActionBody: {
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 16
  },
  premiumStepRow: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DCFCE7",
    backgroundColor: "#F8FFF8",
    padding: 10
  },
  premiumStepTitle: {
    color: palette.text,
    fontFamily: font.semibold,
    fontSize: 12,
    marginBottom: 3
  },
  premiumStepBody: {
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 16
  },
  premiumStepActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8
  },
  intakeFieldBlock: {
    marginBottom: 8
  },
  receiptRow: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    backgroundColor: "#FFFFFF",
    padding: 10
  },
  receiptTitle: {
    color: palette.text,
    fontFamily: font.semibold,
    fontSize: 12,
    marginBottom: 2
  },
  receiptSub: {
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 16
  },
  severityBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  severityBadgeHigh: {
    backgroundColor: "#DC2626"
  },
  severityBadgeMedium: {
    backgroundColor: "#D97706"
  },
  severityBadgeLow: {
    backgroundColor: "#16A34A"
  },
  severityBadgeText: {
    color: "#FFFFFF",
    fontFamily: font.bold,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  checklistRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 8,
    width: "100%"
  },
  checklistDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1
  },
  checklistDotHigh: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FCA5A5"
  },
  checklistDotMedium: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FCD34D"
  },
  checklistDotLow: {
    backgroundColor: "#DCFCE7",
    borderColor: "#86EFAC"
  },
  checklistText: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    color: palette.text,
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 19
  },
  casesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    marginTop: 2
  },
  casesHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  casesHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  casesAddBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    marginBottom: 10
  },
  filterPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  filterPillActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary
  },
  filterPillText: {
    color: palette.muted,
    fontFamily: font.bold,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1
  },
  filterPillTextActive: {
    color: "#FFFFFF"
  },
  accountHeaderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    marginBottom: 10
  },
  accountHeaderTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12
  },
  accountHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  accountProfileRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  accountAvatar: {
    width: 80,
    height: 80,
    borderRadius: 28,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14
  },
  accountAvatarText: {
    color: "#FFFFFF",
    fontFamily: font.bold,
    fontSize: 24
  },
  accountIdentity: {
    flex: 1
  },
  accountName: {
    color: palette.text,
    fontFamily: font.semibold,
    fontSize: 18,
    marginBottom: 2
  },
  accountMeta: {
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 12
  },
  accountPlanCard: {
    backgroundColor: palette.primary,
    borderColor: palette.primary
  },
  planLabel: {
    color: "#94A3B8",
    fontFamily: font.bold,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.1
  },
  planTitle: {
    color: "#FFFFFF",
    fontFamily: font.bold,
    fontSize: 18,
    marginBottom: 8
  },
  planTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8
  },
  planTierPill: {
    borderRadius: 999,
    backgroundColor: "#334155",
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  planTierPillText: {
    color: "#E2E8F0",
    fontFamily: font.bold,
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  planBody: {
    color: "#E2E8F0",
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 6
  },
  planBodyMuted: {
    color: "#CBD5E1",
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 4
  },
  accountUpgradeBtn: {
    alignSelf: "flex-start",
    borderRadius: 10,
    backgroundColor: "#334155",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  accountUpgradeBtnText: {
    color: "#FFFFFF",
    fontFamily: font.semibold,
    fontSize: 11
  },
  plusPlanOption: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    padding: 12,
    marginBottom: 6
  },
  plusPlanTitle: {
    color: palette.text,
    fontFamily: font.semibold,
    fontSize: 14
  },
  plusPlanPrice: {
    color: "#166534",
    fontFamily: font.bold,
    fontSize: 12,
    marginTop: 2
  },
  plusPlanCopy: {
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
    marginBottom: 8
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F1F5F9",
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 6,
    gap: 10
  },
  languageToggleRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 6
  },
  languageTogglePill: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8
  },
  languageTogglePillActive: {
    borderColor: palette.primary,
    backgroundColor: palette.primary
  },
  languageToggleText: {
    color: palette.muted,
    fontFamily: font.semibold,
    fontSize: 12
  },
  languageToggleTextActive: {
    color: "#FFFFFF"
  },
  settingText: {
    flex: 1,
    color: palette.text,
    fontFamily: font.semibold,
    fontSize: 13
  },
  proCard: {
    borderColor: "#BFDBFE",
    backgroundColor: "#F8FAFC"
  },
  accountSignOutBtn: {
    marginBottom: 24
  },
  bottomDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.primary,
    marginTop: 2
  }
});
