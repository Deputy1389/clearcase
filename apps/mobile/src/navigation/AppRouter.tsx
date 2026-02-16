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

import {
  clamp,
  fmtDate,
  fmtDateTime,
  titleize
} from "../utils/formatting";
import {
  casePriorityLevel,
  casePriorityLabel,
  manualCategoryLabel
} from "../utils/case-logic";
import { hapticTap } from "../utils/haptics";
import { MANUAL_DOCUMENT_TYPES } from "../api";
import type { IntakeDraft } from "../types";

// Helper for router selection logic
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

  const assetViewerImagePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => controller.assetViewerIsImage && controller.assetViewerImageZoom > 1,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          controller.assetViewerIsImage &&
          controller.assetViewerImageZoom > 1 &&
          (Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3),
        onPanResponderGrant: () => {
          controller.assetViewerImagePanStartRef.current = controller.assetViewerImagePanRef.current;
        },
        onPanResponderMove: (_, gestureState) => {
          const maxX = ((Math.max(controller.assetViewerImageZoom, 1) - 1) * controller.assetViewerImageBounds.width) / 2;
          const maxY = ((Math.max(controller.assetViewerImageZoom, 1) - 1) * controller.assetViewerImageBounds.height) / 2;
          controller.setAssetViewerImagePan({
            x: clamp(controller.assetViewerImagePanStartRef.current.x + gestureState.dx, -maxX, maxX),
            y: clamp(controller.assetViewerImagePanStartRef.current.y + gestureState.dy, -maxY, maxY)
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

  const isTabScreen = TAB_SCREENS.includes(controller.screen) && controller.me;
  console.log("AppRouter render", controller.screen, "isTabScreen:", isTabScreen, "hasHomeUploadFlow:", !!controller.homeUploadFlow, "uploadSheetOpen:", controller.uploadSheetOpen);

  const renderContent = () => {
    // 1. Auth Flow
    if (!controller.me || AUTH_SCREENS.includes(controller.screen)) {
      return <AuthRoutes controller={controller} />;
    }

    // 2. Workspace Flow
    if (controller.screen === "workspace") {
      return (
        <WorkspaceRoutes
          controller={controller}
          assetViewerImagePanResponder={assetViewerImagePanResponder}
          uploadStatusText={uploadStatusText}
          localizedCaseStatus={localizedCaseStatus}
          fmtDate={fmtDate}
          fmtDateTime={fmtDateTime}
          casePriorityLevel={casePriorityLevel}
          casePriorityLabel={casePriorityLabel}
        />
      );
    }

    // 3. Settings Flow
    if (SETTINGS_SCREENS.includes(controller.screen)) {
      return <SettingsRoutes controller={controller} />;
    }

    // 4. Main Home/Tab Flow
    return (
      <HomeRoutes
        controller={controller}
        uploadStatusText={uploadStatusText}
        localizedCaseStatus={localizedCaseStatus}
        fmtDate={fmtDate}
        fmtDateTime={fmtDateTime}
        casePriorityLevel={casePriorityLevel}
        casePriorityLabel={casePriorityLabel}
      />
    );
  };

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

          <View style={styles.fill}>
            {renderContent()}
          </View>

          {isTabScreen && (
            <View style={styles.bottomTabs} accessibilityRole="tablist">
              <Pressable onPress={() => { hapticTap(); LayoutAnimation.configureNext(subtleSpring); controller.setScreen("home"); }} style={styles.bottomTabItem} accessibilityRole="tab" accessibilityState={{ selected: controller.screen === "home" }} accessibilityLabel={controller.language === "es" ? "Inicio" : "Home"}>
                <Feather name="home" size={20} color={controller.screen === "home" ? palette.primary : palette.subtle} />
                <Text style={[styles.bottomTabLabel, controller.screen === "home" ? styles.bottomTabLabelActive : null]}>
                  {controller.language === "es" ? "Inicio" : "Home"}
                </Text>
                {controller.screen === "home" ? <View style={styles.bottomDot} /> : null}
              </Pressable>
              <Pressable onPress={() => { hapticTap(); LayoutAnimation.configureNext(subtleSpring); controller.setScreen("cases"); }} style={styles.bottomTabItem} accessibilityRole="tab" accessibilityState={{ selected: controller.screen === "cases" }} accessibilityLabel={controller.language === "es" ? "Casos" : "Cases"}>
                <Feather name="briefcase" size={20} color={controller.screen === "cases" ? palette.primary : palette.subtle} />
                <Text style={[styles.bottomTabLabel, controller.screen === "cases" ? styles.bottomTabLabelActive : null]}>
                  {controller.language === "es" ? "Casos" : "Cases"}
                </Text>
                {controller.screen === "cases" ? <View style={styles.bottomDot} /> : null}
              </Pressable>
              <Pressable onPress={() => { console.log("Upload button pressed"); hapticTap(); void controller.homeUploadFlow(); }} style={styles.bottomUploadFab} accessibilityRole="button" accessibilityLabel={controller.language === "es" ? "Subir documento" : "Upload document"}>
                <Feather name="plus-circle" size={26} color="#FFFFFF" />
              </Pressable>
              <Pressable onPress={() => { hapticTap(); LayoutAnimation.configureNext(subtleSpring); controller.setScreen("account"); }} style={styles.bottomTabItem} accessibilityRole="tab" accessibilityState={{ selected: controller.screen === "account" }} accessibilityLabel={controller.language === "es" ? "Cuenta" : "Account"}>
                <Feather name="user" size={20} color={controller.screen === "account" ? palette.primary : palette.subtle} />
                <Text style={[styles.bottomTabLabel, controller.screen === "account" ? styles.bottomTabLabelActive : null]}>
                  {controller.language === "es" ? "Cuenta" : "Account"}
                </Text>
                {controller.screen === "account" ? <View style={styles.bottomDot} /> : null}
              </Pressable>
            </View>
          )}

                    {/* Global Modals */}

                    <Modal

                      visible={controller.planSheetOpen}

                      transparent

                      animationType="slide"

                      onRequestClose={() => controller.setPlanSheetOpen(false)}

                    >

                      <View style={styles.sheetOverlay}>

                        <Pressable style={styles.sheetBackdrop} onPress={() => controller.setPlanSheetOpen(false)} accessibilityRole="button" accessibilityLabel="Close" />

                        <View style={[styles.sheetCard, styles.planSheet]}>

                          <View style={styles.sheetHeaderLine} />

                          <View style={styles.planSheetHeader}>

                            <Text style={styles.sheetTitle}>ClearCase Plus</Text>

                            <Text style={styles.planSheetPrice}>{controller.paywallConfig.plusPriceMonthly}</Text>

                          </View>

                          <Text style={styles.sheetSub}>

                            {controller.language === "es"

                              ? "Desbloquea el monitoreo continuo, recordatorios y herramientas de preparacion profesional."

                              : "Unlock continuous monitoring, reminders, and professional prep tools."}

                          </Text>

          

                          <ScrollView style={styles.planBenefitsScroll}>

                            <View style={styles.benefitRow}>

                              <View style={styles.benefitIcon}><Feather name="activity" size={18} color={palette.primary} /></View>

                              <View style={styles.benefitTextGroup}>

                                <Text style={styles.benefitTitle}>{controller.language === "es" ? "Monitoreo continuo" : "Continuous Monitoring"}</Text>

                                <Text style={styles.benefitDesc}>{controller.language === "es" ? "Revision semanal de cambios urgentes y recordatorios de fechas." : "Weekly check-ins for urgent changes and deadline reminders."}</Text>

                              </View>

                            </View>

                            <View style={styles.benefitRow}>

                              <View style={styles.benefitIcon}><Feather name="file-text" size={18} color={palette.primary} /></View>

                              <View style={styles.benefitTextGroup}>

                                <Text style={styles.benefitTitle}>{controller.language === "es" ? "Paquete para abogado" : "Lawyer-Ready Packet"}</Text>

                                <Text style={styles.benefitDesc}>{controller.language === "es" ? "Exporta un resumen profesional optimizado para consultas pagadas." : "Export a professional summary optimized for paid consultations."}</Text>

                              </View>

                            </View>

                            <View style={styles.benefitRow}>

                              <View style={styles.benefitIcon}><Feather name="message-circle" size={18} color={palette.primary} /></View>

                              <View style={styles.benefitTextGroup}>

                                <Text style={styles.benefitTitle}>{controller.language === "es" ? "Significado simple" : "Plain Meaning Translation"}</Text>

                                <Text style={styles.benefitDesc}>{controller.language === "es" ? "Traduccion linea por linea de terminos legales complejos." : "Line-by-line translation of complex legal terminology."}</Text>

                              </View>

                            </View>

                            <View style={styles.benefitRow}>

                              <View style={styles.benefitIcon}><Feather name="clock" size={18} color={palette.primary} /></View>

                              <View style={styles.benefitTextGroup}>

                                <Text style={styles.benefitTitle}>{controller.language === "es" ? "Cronologia extendida" : "Extended Timeline"}</Text>

                                <Text style={styles.benefitDesc}>{controller.language === "es" ? "Historial de integridad de evidencia y cambios detectados." : "History of evidence completeness and detected changes."}</Text>

                              </View>

                            </View>

                          </ScrollView>

          

                          <View style={styles.planSheetFooter}>

                            <Pressable

                              style={[styles.primaryBtn, controller.startingCheckout ? styles.btnDisabled : null]}

                              onPress={() => void controller.startPlusCheckout("plan_sheet")}

                              disabled={controller.startingCheckout}

                            >

                              <Text style={styles.primaryBtnText}>{controller.startingCheckout ? (controller.language === "es" ? "Iniciando..." : "Starting...") : (controller.language === "es" ? "Suscribirse ahora" : "Subscribe Now")}</Text>

                            </Pressable>

                            <Text style={styles.planSheetTerms}>

                              {controller.language === "es" ? "Cancela en cualquier momento. Se aplican terminos de uso." : "Cancel anytime. Terms of use apply."}

                            </Text>

                          </View>

                        </View>

                      </View>

                    </Modal>

          

                    <Modal visible={controller.lawyerSummaryOpen}

           transparent animationType="slide" onRequestClose={() => controller.setLawyerSummaryOpen(false)}>
            <View style={styles.sheetOverlay}>
              <Pressable style={styles.sheetBackdrop} onPress={() => controller.setLawyerSummaryOpen(false)} accessibilityRole="button" accessibilityLabel="Close" />
              <View style={[styles.sheetCard, styles.summarySheetCard]}>
                <Text style={styles.sheetTitle}>{controller.language === "es" ? "Paquete de consulta" : "Lawyer-ready packet"}</Text>
                <Text style={styles.sheetSub}>{controller.language === "es" ? "Preparacion de consulta con hechos, fechas, materiales y preguntas abiertas." : "Consultation prep with facts, dates, materials, and open questions."}</Text>
                <ScrollView style={styles.summaryScroll} contentContainerStyle={styles.summaryScrollBody}>
                  <Text style={styles.summaryCaseTitle}>{controller.lawyerReadySummary?.caseTitle}</Text>

                  <Text style={styles.summarySectionTitle}>{controller.language === "es" ? "Resumen en lenguaje claro" : "Plain-language summary"}</Text>
                  <Text style={styles.summaryBody}>{controller.lawyerReadySummary?.summary}</Text>

                  <Text style={styles.summarySectionTitle}>{controller.language === "es" ? "Hechos clave" : "Key facts"}</Text>
                  {controller.lawyerReadySummary?.facts.map((item: string, index: number) => (
                    <View key={`summary-fact-${index}`} style={styles.summaryBulletRow}>
                      <Text style={styles.summaryBulletDot}>-</Text>
                      <Text style={styles.summaryBulletText}>{item}</Text>
                    </View>
                  ))}

                  <Text style={styles.summarySectionTitle}>{controller.language === "es" ? "Fechas detectadas" : "Detected dates"}</Text>
                  {controller.lawyerReadySummary?.dates.map((item: string, index: number) => (
                    <View key={`summary-date-${index}`} style={styles.summaryBulletRow}>
                      <Text style={styles.summaryBulletDot}>-</Text>
                      <Text style={styles.summaryBulletText}>{item}</Text>
                    </View>
                  ))}

                  <Text style={styles.summarySectionTitle}>{controller.language === "es" ? "Partes y jurisdiccion" : "Parties and jurisdiction"}</Text>
                  {controller.lawyerReadySummary?.parties.map((item: string, index: number) => (
                    <View key={`summary-party-${index}`} style={styles.summaryBulletRow}>
                      <Text style={styles.summaryBulletDot}>-</Text>
                      <Text style={styles.summaryBulletText}>{item}</Text>
                    </View>
                  ))}

                  <Text style={styles.summarySectionTitle}>{controller.language === "es" ? "Resumen de intake formal" : "Formal intake snapshot"}</Text>
                  {controller.lawyerReadySummary?.intakeOverview.map((item: string, index: number) => (
                    <View key={`summary-intake-${index}`} style={styles.summaryBulletRow}>
                      <Text style={styles.summaryBulletDot}>-</Text>
                      <Text style={styles.summaryBulletText}>{item}</Text>
                    </View>
                  ))}

                  <Text style={styles.summarySectionTitle}>{controller.language === "es" ? "Registro de comunicaciones" : "Communications log"}</Text>
                  <Text style={styles.summaryBody}>{controller.lawyerReadySummary?.communicationsLog}</Text>

                  <Text style={styles.summarySectionTitle}>{controller.language === "es" ? "Impacto financiero" : "Financial impact"}</Text>
                  <Text style={styles.summaryBody}>{controller.lawyerReadySummary?.financialImpact}</Text>

                  <Text style={styles.summarySectionTitle}>{controller.language === "es" ? "Resultado deseado" : "Desired outcome"}</Text>
                  <Text style={styles.summaryBody}>{controller.lawyerReadySummary?.desiredOutcome}</Text>

                  <Text style={styles.summarySectionTitle}>{controller.language === "es" ? "Lista de evidencia" : "Evidence checklist"}</Text>
                  {controller.lawyerReadySummary?.evidence.map((item: string, index: number) => (
                    <View key={`summary-evidence-${index}`} style={styles.summaryBulletRow}>
                      <Text style={styles.summaryBulletDot}>-</Text>
                      <Text style={styles.summaryBulletText}>{item}</Text>
                    </View>
                  ))}

                  <Text style={styles.summarySectionTitle}>{controller.language === "es" ? "Preguntas abiertas" : "Open questions"}</Text>
                  {controller.lawyerReadySummary?.openQuestions.map((item: string, index: number) => (
                    <View key={`summary-question-${index}`} style={styles.summaryBulletRow}>
                      <Text style={styles.summaryBulletDot}>-</Text>
                      <Text style={styles.summaryBulletText}>{item}</Text>
                    </View>
                  ))}

                  <Text style={styles.summarySectionTitle}>{controller.language === "es" ? "Agenda sugerida para consulta" : "Suggested consult agenda"}</Text>
                  {controller.lawyerReadySummary?.consultAgenda.map((item: string, index: number) => (
                    <View key={`summary-agenda-${index}`} style={styles.summaryBulletRow}>
                      <Text style={styles.summaryBulletDot}>-</Text>
                      <Text style={styles.summaryBulletText}>{item}</Text>
                    </View>
                  ))}

                  <Text style={styles.summarySectionTitle}>
                    {controller.language === "es" ? "Pasos que algunas personas consideran utiles" : "Steps people often find useful"}
                  </Text>
                  {controller.lawyerReadySummary?.nextSteps.map((item: string, index: number) => (
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
                  <Text style={styles.summaryBody}>{controller.costSavingIndicator?.message}</Text>
                  <Text style={styles.summaryBody}>{controller.costSavingIndicator?.assumptions}</Text>
                  <Text style={styles.summarySectionTitle}>{controller.language === "es" ? "Historial de paquetes" : "Packet history"}</Text>
                  {controller.packetHistoryEntries?.length === 0 ? (
                    <Text style={styles.summaryBody}>
                      {controller.language === "es" ? "Aun no hay versiones de paquete para este caso." : "No packet versions are available for this case yet."}
                    </Text>
                  ) : (
                    controller.packetHistoryEntries?.map((entry: any) => (
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
                  {controller.consultLinks?.length === 0 ? (
                    <Text style={styles.summaryBody}>
                      {controller.language === "es" ? "Aun no hay enlaces para compartir en este caso." : "No share links have been created for this case yet."}
                    </Text>
                  ) : (
                    controller.consultLinks?.map((link: any) => (
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

                  <Text style={styles.summaryDisclaimer}>{controller.lawyerReadySummary?.disclaimer}</Text>
                </ScrollView>
                <View style={styles.summaryActions}>
                  <Pressable style={styles.summaryActionBtn} onPress={() => void controller.shareLawyerReadySummary()}>
                    <Feather name="share-2" size={16} color={palette.primary} />
                    <Text style={styles.summaryActionBtnText}>{controller.language === "es" ? "Compartir" : "Share"}</Text>
                  </Pressable>
                  <Pressable style={styles.summaryActionBtn} onPress={() => void controller.emailLawyerReadySummary()}>
                    <Feather name="mail" size={16} color={palette.primary} />
                    <Text style={styles.summaryActionBtnText}>{controller.language === "es" ? "Email" : "Email"}</Text>
                  </Pressable>
                </View>
                <Pressable style={styles.sheetCloseBtn} onPress={() => controller.setLawyerSummaryOpen(false)}>
                  <Text style={styles.sheetCloseBtnText}>{controller.language === "es" ? "Cerrar" : "Close"}</Text>
                </Pressable>
              </View>
            </View>
          </Modal>

          <Modal visible={controller.assetViewerOpen} transparent animationType="fade" onRequestClose={controller.closeAssetViewer}>
            <View style={styles.viewerOverlay}>
              <SafeAreaView style={styles.viewerContent}>
                <View style={styles.viewerHeader}>
                  <Pressable style={styles.viewerClose} onPress={controller.closeAssetViewer}><Feather name="x" size={24} color="#FFFFFF" /></Pressable>
                  <View style={styles.viewerTitleGroup}>
                    <Text style={styles.viewerTitle} numberOfLines={1}>{controller.assetViewerAsset?.fileName || "Document"}</Text>
                    <Text style={styles.viewerSub}>{controller.assetViewerAsset?.assetType === "pdf" ? "PDF Document" : "Image"}</Text>
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
                {controller.assetViewerIsPdf && (
                  <View style={styles.viewerControls}>
                    <View style={styles.viewerControlRow}>
                      <Pressable style={styles.viewerControlBtn} onPress={() => controller.setAssetViewerPdfPage((v: number) => Math.max(1, v - 1))}><Feather name="chevron-left" size={20} color="#FFFFFF" /></Pressable>
                      <Text style={styles.viewerControlText}>Page {controller.assetViewerPdfPage}</Text>
                      <Pressable style={styles.viewerControlBtn} onPress={() => controller.setAssetViewerPdfPage((v: number) => v + 1)}><Feather name="chevron-right" size={20} color="#FFFFFF" /></Pressable>
                    </View>
                  </View>
                )}
                {controller.assetViewerIsImage && (
                  <View style={styles.viewerControls}>
                    <View style={styles.viewerControlRow}>
                      <Pressable style={styles.viewerControlBtn} onPress={() => controller.setAssetViewerImageZoom((v: number) => clamp(v - 0.25, 1, 4))}><Feather name="zoom-out" size={20} color="#FFFFFF" /></Pressable>
                      <Text style={styles.viewerControlText}>{Math.round(controller.assetViewerImageZoom * 100)}%</Text>
                      <Pressable style={styles.viewerControlBtn} onPress={() => controller.setAssetViewerImageZoom((v: number) => clamp(v + 0.25, 1, 4))}><Feather name="zoom-in" size={20} color="#FFFFFF" /></Pressable>
                    </View>
                  </View>
                )}
              </SafeAreaView>
            </View>
          </Modal>

          <Modal visible={controller.uploadSheetOpen} transparent animationType="slide" onRequestClose={() => controller.setUploadSheetOpen(false)}>
            <View style={styles.sheetOverlay}>
              <Pressable style={styles.sheetBackdrop} onPress={() => controller.setUploadSheetOpen(false)} accessibilityRole="button" accessibilityLabel="Close" />
              <View style={[styles.sheetCard, styles.uploadSheet]}>
                <View style={styles.sheetHeaderLine} />
                <Text style={styles.sheetTitle}>{controller.language === "es" ? "Subir documento" : "Upload Document"}</Text>
                <Text style={styles.sheetSub}>{controller.language === "es" ? "Agrega un archivo o toma una foto." : "Add a file or take a photo."}</Text>
                <View style={styles.uploadOptions}>
                  <Pressable style={styles.uploadOptionBtn} onPress={() => void controller.beginCameraUpload()}>
                    <View style={styles.uploadOptionIcon}><Feather name="camera" size={24} color={palette.primary} /></View>
                    <Text style={styles.uploadOptionText}>{controller.language === "es" ? "Camara" : "Camera"}</Text>
                  </Pressable>
                  <Pressable style={styles.uploadOptionBtn} onPress={() => void controller.beginFileUpload()}>
                    <View style={styles.uploadOptionIcon}><Feather name="file" size={24} color={palette.primary} /></View>
                    <Text style={styles.uploadOptionText}>{controller.language === "es" ? "Archivo" : "File"}</Text>
                  </Pressable>
                </View>
                {controller.uploading && (
                  <View style={styles.uploadProgress}>
                    <ActivityIndicator color={palette.primary} />
                    <Text style={styles.uploadProgressText}>{uploadStatusText}</Text>
                  </View>
                )}
                <Pressable style={styles.sheetCloseBtn} onPress={() => controller.setUploadSheetOpen(false)}>
                  <Text style={styles.sheetCloseBtnText}>{controller.language === "es" ? "Cerrar" : "Close"}</Text>
                </Pressable>
              </View>
            </View>
          </Modal>

          <Modal visible={controller.classificationSheetOpen} transparent animationType="slide" onRequestClose={() => controller.setClassificationSheetOpen(false)}>
            <View style={styles.sheetOverlay}>
              <Pressable style={styles.sheetBackdrop} onPress={() => controller.setClassificationSheetOpen(false)} accessibilityRole="button" accessibilityLabel="Close" />
              <View style={[styles.sheetCard, styles.classificationSheet]}>
                <View style={styles.sheetHeaderLine} />
                <Text style={styles.sheetTitle}>{controller.language === "es" ? "Categoria" : "Category"}</Text>
                <ScrollView style={styles.classificationScroll}>
                  {MANUAL_DOCUMENT_TYPES.map((type: any) => (
                    <Pressable key={`cat-${type}`} style={[styles.classificationItem, controller.classificationDraft === type ? styles.classificationItemActive : null]} onPress={() => controller.setClassificationDraft(type)}>
                      <Text style={[styles.classificationItemText, controller.classificationDraft === type ? styles.classificationItemTextActive : null]}>{manualCategoryLabel(type, controller.language)}</Text>
                      {controller.classificationDraft === type && <Feather name="check" size={16} color={palette.primary} />}
                    </Pressable>
                  ))}
                </ScrollView>
                <Pressable style={styles.primaryBtn} onPress={() => void controller.saveManualCategoryForSelectedCase()} disabled={controller.savingClassification}>
                  <Text style={styles.primaryBtnText}>{controller.savingClassification ? "..." : (controller.language === "es" ? "Guardar" : "Save")}</Text>
                </Pressable>
              </View>
            </View>
          </Modal>

          <Modal visible={controller.drawerOpen} transparent animationType="none" onRequestClose={() => controller.setDrawerOpen(false)}>
            <View style={styles.drawerOverlay}>
              <Pressable style={styles.drawerBackdrop} onPress={() => controller.setDrawerOpen(false)} accessibilityRole="button" accessibilityLabel="Close" />
              <Animated.View style={styles.drawerCard}>
                <SafeAreaView style={styles.fill}>
                  <View style={styles.drawerHeader}>
                    <View>
                      <Text style={styles.drawerBrand}>ClearCase</Text>
                      <Text style={styles.drawerBrandSub}>{controller.language === "es" ? "Claridad Legal" : "Legal Clarity"}</Text>
                    </View>
                    <Pressable onPress={() => controller.setDrawerOpen(false)} style={styles.drawerClose}><Feather name="x" size={20} color={palette.subtle} /></Pressable>
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
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
