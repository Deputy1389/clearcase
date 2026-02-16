import React, { useMemo, useRef } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
  Modal,
  Pressable,
  ScrollView,
  Animated,
  PanResponder,
  Image,
  TextInput,
  LayoutAnimation
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Newsreader_600SemiBold, Newsreader_700Bold } from "@expo-google-fonts/newsreader";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold
} from "@expo-google-fonts/plus-jakarta-sans";
import { WebView } from "react-native-webview";

import { AuthRoutes } from "./routes/AuthRoutes";
import { HomeRoutes } from "./routes/HomeRoutes";
import { WorkspaceRoutes } from "./routes/WorkspaceRoutes";
import { SettingsRoutes } from "./routes/SettingsRoutes";
import { styles } from "./routes/styleUtils";
import { palette } from "../theme";

import { clamp, fmtDate, fmtDateTime, titleize } from "../utils/formatting";
import { casePriorityLevel, casePriorityLabel, manualCategoryLabel } from "../utils/case-logic";
import { hapticTap } from "../utils/haptics";
import { MANUAL_DOCUMENT_TYPES } from "../api";
import type { IntakeDraft } from "../types";

const AUTH_SCREENS = ["auth", "onboarding", "language"];
const SETTINGS_SCREENS = ["account", "legal", "legalAid"];
const TAB_SCREENS = ["home", "cases", "drafting", "account"];

function formatUploadStage(stage: string, language: string = "en"): string {
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

function localizedCaseStatus(value: string | null | undefined, language: string = "en"): string {
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
    Newsreader_600SemiBold, Newsreader_700Bold,
    PlusJakartaSans_400Regular, PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold
  });

  const uploadStatusText = controller.uploading
    ? formatUploadStage(controller.uploadStage, controller.language)
    : controller.language === "es" ? "Listo para cargar" : "Ready to upload";

  const canOpenDrawer = TAB_SCREENS.includes(controller.screen) || controller.screen === "workspace" || controller.screen === "legal";

  const drawerPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gs) => {
      if (!canOpenDrawer || controller.drawerOpen) return false;
      return (gs.x0 <= 24 || gs.moveX <= 24) && gs.dx > 14 && Math.abs(gs.dy) < 20;
    },
    onPanResponderRelease: (_, gs) => {
      if (!canOpenDrawer || controller.drawerOpen) return;
      if (gs.dx > 55) controller.setDrawerOpen(true);
    }
  }), [canOpenDrawer, controller.drawerOpen]);

  const assetViewerImagePanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => controller.assetViewerIsImage && controller.assetViewerImageZoom > 1,
    onMoveShouldSetPanResponder: (_, gs) => controller.assetViewerIsImage && controller.assetViewerImageZoom > 1 && (Math.abs(gs.dx) > 3 || Math.abs(gs.dy) > 3),
    onPanResponderGrant: () => { controller.assetViewerImagePanStartRef.current = controller.assetViewerImagePanRef.current; },
    onPanResponderMove: (_, gs) => {
      const maxX = ((Math.max(controller.assetViewerImageZoom, 1) - 1) * controller.assetViewerImageBounds.width) / 2;
      const maxY = ((Math.max(controller.assetViewerImageZoom, 1) - 1) * controller.assetViewerImageBounds.height) / 2;
      controller.setAssetViewerImagePan({
        x: clamp(controller.assetViewerImagePanStartRef.current.x + gs.dx, -maxX, maxX),
        y: clamp(controller.assetViewerImagePanStartRef.current.y + gs.dy, -maxY, maxY)
      });
    }
  }), [controller.assetViewerImageBounds, controller.assetViewerImageZoom, controller.assetViewerIsImage]);

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

  const isTabScreen = TAB_SCREENS.includes(controller.screen) && controller.me;
  console.log("AppRouter render screen:", controller.screen, "paywallOpen:", controller.planSheetOpen);

  const renderContent = () => {
    if (!controller.me || AUTH_SCREENS.includes(controller.screen)) return <AuthRoutes controller={controller} />;
    if (controller.screen === "workspace") return <WorkspaceRoutes controller={controller} assetViewerImagePanResponder={assetViewerImagePanResponder} uploadStatusText={uploadStatusText} localizedCaseStatus={localizedCaseStatus} fmtDate={fmtDate} fmtDateTime={fmtDateTime} casePriorityLevel={casePriorityLevel} casePriorityLabel={casePriorityLabel} />;
    if (SETTINGS_SCREENS.includes(controller.screen)) return <SettingsRoutes controller={controller} />;
    return <HomeRoutes controller={controller} uploadStatusText={uploadStatusText} localizedCaseStatus={localizedCaseStatus} fmtDate={fmtDate} fmtDateTime={fmtDateTime} casePriorityLevel={casePriorityLevel} casePriorityLabel={casePriorityLabel} />;
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined} {...drawerPanResponder.panHandlers}>
          
          <View style={styles.fill}>{renderContent()}</View>

          {isTabScreen && (
            <View style={styles.bottomTabs} accessibilityRole="tablist">
              <Pressable onPress={() => { hapticTap(); LayoutAnimation.configureNext(subtleSpring); controller.setScreen("home"); }} style={styles.bottomTabItem} accessibilityRole="tab" accessibilityState={{ selected: controller.screen === "home" }} accessibilityLabel={controller.language === "es" ? "Inicio" : "Home"}>
                <Feather name="home" size={20} color={controller.screen === "home" ? palette.primary : palette.subtle} />
                <Text style={[styles.bottomTabLabel, controller.screen === "home" ? styles.bottomTabLabelActive : null]}>{controller.language === "es" ? "Inicio" : "Home"}</Text>
                {controller.screen === "home" && <View style={styles.bottomDot} />}
              </Pressable>
              <Pressable onPress={() => { hapticTap(); LayoutAnimation.configureNext(subtleSpring); controller.setScreen("cases"); }} style={styles.bottomTabItem} accessibilityRole="tab" accessibilityState={{ selected: controller.screen === "cases" }} accessibilityLabel={controller.language === "es" ? "Casos" : "Cases"}>
                <Feather name="briefcase" size={20} color={controller.screen === "cases" ? palette.primary : palette.subtle} />
                <Text style={[styles.bottomTabLabel, controller.screen === "cases" ? styles.bottomTabLabelActive : null]}>{controller.language === "es" ? "Casos" : "Cases"}</Text>
                {controller.screen === "cases" && <View style={styles.bottomDot} />}
              </Pressable>
              <Pressable onPress={() => { hapticTap(); void controller.homeUploadFlow(); }} style={styles.bottomUploadFab} accessibilityRole="button" accessibilityLabel={controller.language === "es" ? "Subir" : "Upload"}>
                <Feather name="plus-circle" size={26} color="#FFFFFF" />
              </Pressable>
              <Pressable onPress={() => { hapticTap(); LayoutAnimation.configureNext(subtleSpring); controller.setScreen("account"); }} style={styles.bottomTabItem} accessibilityRole="tab" accessibilityState={{ selected: controller.screen === "account" }} accessibilityLabel={controller.language === "es" ? "Cuenta" : "Account"}>
                <Feather name="user" size={20} color={controller.screen === "account" ? palette.primary : palette.subtle} />
                <Text style={[styles.bottomTabLabel, controller.screen === "account" ? styles.bottomTabLabelActive : null]}>{controller.language === "es" ? "Cuenta" : "Account"}</Text>
                {controller.screen === "account" && <View style={styles.bottomDot} />}
              </Pressable>
            </View>
          )}
        </KeyboardAvoidingView>

        {/* Global Modals outside KeyboardAvoidingView for better positioning */}
        
        {/* Paywall */}
        <Modal visible={!!controller.planSheetOpen} transparent animationType="slide" onRequestClose={() => controller.setPlanSheetOpen(false)}>
          <View style={styles.sheetOverlay}>
            <Pressable style={styles.sheetBackdrop} onPress={() => controller.setPlanSheetOpen(false)} accessibilityRole="button" accessibilityLabel="Close" />
            <View style={[styles.sheetCard, styles.planSheet]}>
              <View style={styles.sheetHeaderLine} />
              <View style={styles.planSheetHeader}>
                <Text style={styles.sheetTitle}>ClearCase Plus</Text>
                {controller.plusEnabled ? (
                  <View style={styles.plusLivePill}><Text style={styles.plusLivePillText}>{controller.language === "es" ? "Activo" : "Active"}</Text></View>
                ) : (
                  <Text style={styles.planSheetPrice}>{controller.paywallConfig?.plusPriceMonthly}</Text>
                )}
              </View>
              <Text style={styles.sheetSub}>
                {controller.plusEnabled 
                  ? (controller.language === "es" ? "Tu suscripcion esta activa. Tienes acceso total a todas las herramientas." : "Your subscription is active. You have full access to all tools.")
                  : (controller.language === "es" ? "Monitoreo continuo y herramientas profesionales." : "Continuous monitoring and professional tools.")}
              </Text>
              <ScrollView style={styles.planBenefitsScroll}>
                <View style={styles.benefitRow}><View style={styles.benefitIcon}><Feather name="activity" size={18} color={palette.primary} /></View><View style={styles.benefitTextGroup}><Text style={styles.benefitTitle}>{controller.language === "es" ? "Monitoreo" : "Monitoring"}</Text><Text style={styles.benefitDesc}>{controller.language === "es" ? "Revision semanal de cambios." : "Weekly check-ins for changes."}</Text></View></View>
                <View style={styles.benefitRow}><View style={styles.benefitIcon}><Feather name="file-text" size={18} color={palette.primary} /></View><View style={styles.benefitTextGroup}><Text style={styles.benefitTitle}>{controller.language === "es" ? "Paquete" : "Packet"}</Text><Text style={styles.benefitDesc}>{controller.language === "es" ? "Resumen para abogados." : "Lawyer-ready summary."}</Text></View></View>
                <View style={styles.benefitRow}><View style={styles.benefitIcon}><Feather name="message-circle" size={18} color={palette.primary} /></View><View style={styles.benefitTextGroup}><Text style={styles.benefitTitle}>{controller.language === "es" ? "Traduccion" : "Translation"}</Text><Text style={styles.benefitDesc}>{controller.language === "es" ? "Significado simple." : "Plain meaning view."}</Text></View></View>
              </ScrollView>
                              <View style={styles.planSheetFooter}>
                                {controller.plusEnabled ? (
                                  <Pressable style={styles.outlineBtn} onPress={() => void controller.startPlusCheckout("plan_sheet_manage")}>
                                    <Text style={styles.outlineBtnText}>{controller.language === "es" ? "Gestionar suscripcion" : "Manage Subscription"}</Text>
                                  </Pressable>
                                ) : (
                                  <Pressable style={[styles.primaryBtn, controller.startingCheckout ? styles.btnDisabled : null]} onPress={() => void controller.startPlusCheckout("plan_sheet")} disabled={controller.startingCheckout}>
                                    <Text style={styles.primaryBtnText}>{controller.startingCheckout ? "..." : (controller.language === "es" ? "Suscribirse" : "Subscribe")}</Text>
                                  </Pressable>
                                )}
                                <Text style={styles.planSheetTerms}>{controller.language === "es" ? "Se aplican terminos." : "Terms apply."}</Text>
                              </View>
              
            </View>
          </View>
        </Modal>

        {/* Lawyer Summary */}
        <Modal visible={!!controller.lawyerSummaryOpen} transparent animationType="slide" onRequestClose={() => controller.setLawyerSummaryOpen(false)}>
          <View style={styles.sheetOverlay}>
            <Pressable style={styles.sheetBackdrop} onPress={() => controller.setLawyerSummaryOpen(false)} accessibilityRole="button" accessibilityLabel="Close" />
            <View style={[styles.sheetCard, styles.summarySheetCard]}>
              <Text style={styles.sheetTitle}>{controller.language === "es" ? "Paquete de consulta" : "Lawyer packet"}</Text>
              <ScrollView style={styles.summaryScroll} contentContainerStyle={styles.summaryScrollBody}>
                <Text style={styles.summaryCaseTitle}>{controller.lawyerReadySummary?.caseTitle}</Text>
                <Text style={styles.summarySectionTitle}>{controller.language === "es" ? "Resumen" : "Summary"}</Text>
                <Text style={styles.summaryBody}>{controller.lawyerReadySummary?.summary}</Text>
                {controller.lawyerReadySummary?.facts.map((f: string, i: number) => <View key={i} style={styles.summaryBulletRow}><Text style={styles.summaryBulletDot}>-</Text><Text style={styles.summaryBulletText}>{f}</Text></View>)}
              </ScrollView>
              <View style={styles.summaryActions}>
                <Pressable style={styles.summaryActionBtn} onPress={() => void controller.shareLawyerReadySummary()}><Feather name="share-2" size={16} color={palette.primary} /><Text style={styles.summaryActionBtnText}>{controller.language === "es" ? "Compartir" : "Share"}</Text></Pressable>
                <Pressable style={styles.summaryActionBtn} onPress={() => void controller.emailLawyerReadySummary()}><Feather name="mail" size={16} color={palette.primary} /><Text style={styles.summaryActionBtnText}>{controller.language === "es" ? "Email" : "Email"}</Text></Pressable>
              </View>
              <Pressable style={styles.sheetCloseBtn} onPress={() => controller.setLawyerSummaryOpen(false)}><Text style={styles.sheetCloseBtnText}>{controller.language === "es" ? "Cerrar" : "Close"}</Text></Pressable>
            </View>
          </View>
        </Modal>

        {/* Asset Viewer */}
        <Modal visible={!!controller.assetViewerOpen} transparent animationType="fade" onRequestClose={controller.closeAssetViewer}>
          <View style={styles.viewerOverlay}>
            <SafeAreaView style={styles.viewerContent}>
              <View style={styles.viewerHeader}>
                <Pressable style={styles.viewerClose} onPress={controller.closeAssetViewer}><Feather name="x" size={24} color="#FFFFFF" /></Pressable>
                <View style={styles.viewerTitleGroup}>
                  <Text style={styles.viewerTitle} numberOfLines={1}>{controller.assetViewerAsset?.fileName || "Document"}</Text>
                  <Text style={styles.viewerSub}>{controller.assetViewerAsset?.assetType === "pdf" ? "PDF" : "Image"}</Text>
                </View>
                <Pressable style={styles.viewerAction} onPress={() => void controller.openViewerUrlExternally()}><Feather name="external-link" size={20} color="#FFFFFF" /></Pressable>
              </View>
              <View style={styles.viewerBody}>
                {controller.assetViewerLoading && <View style={styles.viewerLoader}><ActivityIndicator color="#FFFFFF" /></View>}
                {controller.assetViewerIsPdf && controller.assetViewerRenderUrl ? (
                  <WebView source={{ uri: controller.assetViewerRenderUrl }} style={styles.webview} onLoadStart={() => controller.setAssetViewerLoading(true)} onLoadEnd={() => controller.setAssetViewerLoading(false)} />
                ) : controller.assetViewerIsImage && controller.assetViewerUrl ? (
                  <View style={styles.imageContainer} {...assetViewerImagePanResponder.panHandlers}>
                    <Image source={{ uri: controller.assetViewerUrl }} style={[styles.viewerImage, { transform: [{ translateX: controller.assetViewerImagePan.x }, { translateY: controller.assetViewerImagePan.y }, { scale: controller.assetViewerImageZoom }] }]} resizeMode="contain" onLoadStart={() => controller.setAssetViewerLoading(true)} onLoadEnd={() => controller.setAssetViewerLoading(false)} />
                  </View>
                ) : null}
              </View>
            </SafeAreaView>
          </View>
        </Modal>

        {/* Upload */}
        <Modal visible={!!controller.uploadSheetOpen} transparent animationType="slide" onRequestClose={() => controller.setUploadSheetOpen(false)}>
          <View style={styles.sheetOverlay}>
            <Pressable style={styles.sheetBackdrop} onPress={() => controller.setUploadSheetOpen(false)} accessibilityRole="button" accessibilityLabel="Close" />
            <View style={[styles.sheetCard, styles.uploadSheet]}>
              <View style={styles.sheetHeaderLine} />
              <Text style={styles.sheetTitle}>{controller.language === "es" ? "Subir documento" : "Upload Document"}</Text>
              <View style={styles.uploadOptions}>
                <Pressable style={styles.uploadOptionBtn} onPress={() => void controller.beginCameraUpload()}><View style={styles.uploadOptionIcon}><Feather name="camera" size={24} color={palette.primary} /></View><Text style={styles.uploadOptionText}>{controller.language === "es" ? "Camara" : "Camera"}</Text></Pressable>
                <Pressable style={styles.uploadOptionBtn} onPress={() => void controller.beginFileUpload()}><View style={styles.uploadOptionIcon}><Feather name="file" size={24} color={palette.primary} /></View><Text style={styles.uploadOptionText}>{controller.language === "es" ? "Archivo" : "File"}</Text></Pressable>
              </View>
              {controller.uploading && <View style={styles.uploadProgress}><ActivityIndicator color={palette.primary} /><Text style={styles.uploadProgressText}>{uploadStatusText}</Text></View>}
              <Pressable style={styles.sheetCloseBtn} onPress={() => controller.setUploadSheetOpen(false)}><Text style={styles.sheetCloseBtnText}>{controller.language === "es" ? "Cerrar" : "Close"}</Text></Pressable>
            </View>
          </View>
        </Modal>

        {/* Drawer */}
        <Modal visible={!!controller.drawerOpen} transparent animationType="none" onRequestClose={() => controller.setDrawerOpen(false)}>
          <View style={styles.drawerOverlay}>
            <Pressable style={styles.sheetBackdrop} onPress={() => controller.setDrawerOpen(false)} accessibilityRole="button" accessibilityLabel="Close" />
            <Animated.View style={styles.drawerCard}>
              <SafeAreaView style={styles.fill}>
                <View style={styles.drawerHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.drawerBrand}>ClearCase</Text>
                    <Text style={styles.drawerBrandSub}>{controller.language === "es" ? "Claridad Legal" : "Legal Clarity"}</Text>
                  </View>
                  <Pressable onPress={() => controller.setDrawerOpen(false)} style={styles.drawerClose}><Feather name="x" size={20} color={palette.subtle} /></Pressable>
                </View>
                
                <View style={styles.drawerUserSection}>
                  <View style={styles.drawerUserRow}>
                    <View style={styles.drawerAvatar}>
                      <Text style={styles.drawerAvatarText}>{controller.accountInitials}</Text>
                    </View>
                    <View style={styles.drawerUserMeta}>
                      <Text style={styles.drawerUserName} numberOfLines={1}>{controller.me?.user.fullName || "User"}</Text>
                      <Text style={styles.drawerUserEmail} numberOfLines={1}>{controller.email}</Text>
                    </View>
                  </View>
                </View>

                <ScrollView style={styles.drawerBody} contentContainerStyle={{ paddingHorizontal: 16 }}>
                  <Text style={styles.drawerSectionTitle}>{controller.language === "es" ? "PRINCIPAL" : "MAIN"}</Text>
                  <Pressable style={[styles.drawerItem, controller.screen === "home" ? styles.drawerItemActive : null]} onPress={() => { controller.setDrawerOpen(false); controller.setScreen("home"); }}><Feather name="home" size={18} color={controller.screen === "home" ? palette.primary : palette.subtle} /><Text style={[styles.drawerItemText, controller.screen === "home" ? styles.drawerItemTextActive : null]}>{controller.language === "es" ? "Inicio" : "Home"}</Text></Pressable>
                  <Pressable style={[styles.drawerItem, controller.screen === "cases" ? styles.drawerItemActive : null]} onPress={() => { controller.setDrawerOpen(false); controller.setScreen("cases"); }}><Feather name="briefcase" size={18} color={controller.screen === "cases" ? palette.primary : palette.subtle} /><Text style={[styles.drawerItemText, controller.screen === "cases" ? styles.drawerItemTextActive : null]}>{controller.language === "es" ? "Casos" : "Cases"}</Text></Pressable>
                  <Pressable style={[styles.drawerItem, controller.screen === "account" ? styles.drawerItemActive : null]} onPress={() => { controller.setDrawerOpen(false); controller.setScreen("account"); }}><Feather name="user" size={18} color={controller.screen === "account" ? palette.primary : palette.subtle} /><Text style={[styles.drawerItemText, controller.screen === "account" ? styles.drawerItemTextActive : null]}>{controller.language === "es" ? "Cuenta" : "Account"}</Text></Pressable>
                  <View style={{ height: 12 }} />
                  <Text style={styles.drawerSectionTitle}>{controller.language === "es" ? "SOPORTE" : "SUPPORT"}</Text>
                  <Pressable style={styles.drawerItem} onPress={() => { controller.setDrawerOpen(false); controller.openPaywall("drawer_plus_link"); }}><Feather name="star" size={18} color="#EAB308" /><Text style={styles.drawerItemText}>ClearCase Plus</Text></Pressable>
                  <Pressable style={styles.drawerItem} onPress={() => { controller.setDrawerOpen(false); controller.setLegalReturnScreen(controller.screen); controller.setScreen("legal"); }}><Feather name="file-text" size={18} color={palette.subtle} /><Text style={styles.drawerItemText}>{controller.language === "es" ? "Legal" : "Legal"}</Text></Pressable>
                </ScrollView>
                <View style={styles.drawerFooter}>
                  <Pressable style={styles.drawerSignOut} onPress={() => { controller.setDrawerOpen(false); void controller.signOut(); }}><Feather name="log-out" size={16} color="#B91C1C" /><Text style={[styles.drawerItemText, { color: "#B91C1C" }]}>{controller.language === "es" ? "Cerrar sesion" : "Sign out"}</Text></Pressable>
                  <Text style={styles.drawerVersion}>v1.0.0-mvp</Text>
                </View>
              </SafeAreaView>
            </Animated.View>
          </View>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
