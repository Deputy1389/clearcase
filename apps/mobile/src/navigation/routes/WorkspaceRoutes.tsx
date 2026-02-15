import React from "react";
import { View, ScrollView, Pressable, Text, Modal, ActivityIndicator, Image, KeyboardAvoidingView, Platform, LayoutAnimation, UIManager, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { hapticTap } from "../../utils/haptics";
import { Feather } from "@expo/vector-icons";
import { styles } from "./styleUtils";
import { palette } from "../../theme";
import { titleize, fmtDate, fmtDateTime, clamp } from "../../utils/formatting";
import { manualCategoryLabel, casePriorityLevel, casePriorityLabel, severityLabel, severitySummary } from "../../utils/case-logic";
import WorkspaceScreen from "../../screens/WorkspaceScreen";
import { WebView } from "react-native-webview";
import type { IntakeDraft } from "../../types";
import { MANUAL_DOCUMENT_TYPES } from "../../api";

export function WorkspaceRoutes({ controller, assetViewerImagePanResponder, uploadStatusText, localizedCaseStatus, fmtDate, fmtDateTime, casePriorityLevel, casePriorityLabel }: { controller: any, assetViewerImagePanResponder: any, uploadStatusText: string, localizedCaseStatus: any, fmtDate: any, fmtDateTime: any, casePriorityLevel: any, casePriorityLabel: any }) {
  if (controller.screen !== "workspace") return null;

  return (
    <>
      <WorkspaceScreen
        navigation={{ screen: controller.screen, setScreen: controller.setScreen, goBack: controller.goBack, postLanguageScreen: controller.postLanguageScreen, setPostLanguageScreen: controller.setPostLanguageScreen, setDrawerOpen: controller.setDrawerOpen }}
        cases={{ cases: controller.cases, setCases: controller.setCases, selectedCaseId: controller.selectedCaseId, setSelectedCaseId: controller.setSelectedCaseId, selectedCase: controller.selectedCase, setSelectedCase: controller.setSelectedCase, selectedCaseSummary: controller.selectedCaseSummary, latestCase: controller.latestCase, filteredCases: controller.filteredCases, caseSearch: controller.caseSearch, setCaseSearch: controller.setCaseSearch, caseFilter: controller.caseFilter, setCaseFilter: controller.setCaseFilter, caseAssets: controller.caseAssets, setCaseAssets: controller.setCaseAssets, loadingCaseAssets: controller.loadingCaseAssets, setLoadingCaseAssets: controller.setLoadingCaseAssets, loadingDashboard: controller.loadingDashboard, loadingCase: controller.loadingCase, creatingCase: controller.creatingCase, savingProfile: controller.savingProfile, refreshing: controller.refreshing, userFirstName: controller.userFirstName, me: controller.me, setMe: controller.setMe, profileName: controller.profileName, setProfileName: controller.setProfileName, profileZip: controller.profileZip, setProfileZip: controller.setProfileZip, newCaseTitle: controller.newCaseTitle, setNewCaseTitle: controller.setNewCaseTitle, loadDashboard: controller.loadDashboard, loadCase: controller.loadCase, loadCaseAssetsForSelectedCase: controller.loadCaseAssetsForSelectedCase, createCaseWithTitle: controller.createCaseWithTitle, saveProfile: controller.saveProfile, refreshWorkspace: controller.refreshWorkspace, reconnectWorkspace: controller.reconnectWorkspace }}
        upload={{ uploading: controller.uploading, setUploading: controller.setUploading, uploadStage: controller.uploadStage, setUploadStage: controller.setUploadStage, uploadDescription: controller.uploadDescription, setUploadDescription: controller.setUploadDescription, uploadTargetCaseId: controller.uploadTargetCaseId, setUploadTargetCaseId: controller.setUploadTargetCaseId, uploadCaseTitle: controller.uploadCaseTitle, setUploadCaseTitle: controller.setUploadCaseTitle, uploadSheetOpen: controller.uploadSheetOpen, setUploadSheetOpen: controller.setUploadSheetOpen, latestContextReuseSourceCaseId: controller.latestContextReuseSourceCaseId, setLatestContextReuseSourceCaseId: controller.setLatestContextReuseSourceCaseId, uploadStatusText, uploadAssets: controller.uploadAssets, uploadDocument: controller.uploadDocument, uploadFromCamera: controller.uploadFromCamera, beginFileUpload: controller.beginFileUpload, beginCameraUpload: controller.beginCameraUpload, homeUploadFlow: controller.homeUploadFlow, openUploadSheetForCase: controller.openUploadSheetForCase, waitForCaseInsight: controller.waitForCaseInsight }}
        paywall={{ paywallConfig: controller.paywallConfig, planTier: controller.planTier, setPlanTier: controller.setPlanTier, plusEnabled: controller.plusEnabled, startingCheckout: controller.startingCheckout, planSheetOpen: controller.planSheetOpen, setPlanSheetOpen: controller.setPlanSheetOpen, startPlusCheckout: controller.startPlusCheckout as any, openPaywall: controller.openPaywall as any, promptPlusUpgrade: controller.promptPlusUpgrade as any, loadPaywallConfigState: controller.loadPaywallConfigState }}
        ui={{ language: controller.language, setLanguage: controller.setLanguage, applyLanguageFromSettings: controller.applyLanguageFromSettings, styles, palette, offlineMode: controller.offlineMode, showBanner: controller.showBanner, hapticTap }}
        auth={{ email: controller.email, accountInitials: controller.accountInitials, completion: controller.completion, signOut: controller.signOut }}
        workspace={{ workspaceSeverity: controller.workspaceSeverity, workspaceSummaryText: controller.workspaceSummaryText, workspaceSectionMeta: controller.workspaceSectionMeta, workspaceSectionOpen: controller.workspaceSectionOpen, toggleWorkspaceSection: controller.toggleWorkspaceSection, workspaceChecklistItems: controller.workspaceChecklistItems, premiumStepSummaryLine: controller.premiumStepSummaryLine, caseWatchEnabled: controller.caseWatchEnabled, savingWatchMode: controller.savingWatchMode, toggleCaseWatchMode: controller.toggleCaseWatchMode, weeklyCheckInStatus: controller.weeklyCheckInStatus, weeklyCheckInAction: controller.weeklyCheckInAction, watchMicroEvents: controller.watchMicroEvents, packetShareStatusLine: controller.packetShareStatusLine, caseContextDraft: controller.caseContextDraft, setCaseContextDraft: controller.setCaseContextDraft, savingCaseContext: controller.savingCaseContext, saveCaseContextForSelectedCase: controller.saveCaseContextForSelectedCase, classificationSheetOpen: controller.classificationSheetOpen, setClassificationSheetOpen: controller.setClassificationSheetOpen, classificationDraft: controller.classificationDraft as any, setClassificationDraft: controller.setClassificationDraft as any, savingClassification: controller.savingClassification, openManualCategoryPicker: controller.openManualCategoryPicker, saveManualCategoryForSelectedCase: controller.saveManualCategoryForSelectedCase, loadingPlainMeaning: controller.loadingPlainMeaning, openPlainMeaningTranslator: controller.openPlainMeaningTranslator, lawyerSummaryOpen: controller.lawyerSummaryOpen, setLawyerSummaryOpen: controller.setLawyerSummaryOpen, lawyerReadySummary: controller.lawyerReadySummary, shareLawyerReadySummary: controller.shareLawyerReadySummary, emailLawyerReadySummary: controller.emailLawyerReadySummary, intakeModalOpen: controller.intakeModalOpen, setIntakeModalOpen: controller.setIntakeModalOpen, intakeDraft: controller.intakeDraft, setIntakeDraft: controller.setIntakeDraft, intakeCompleteness: controller.intakeCompleteness, stepProgressMap: controller.stepProgressMap, setStepProgress: controller.setStepProgressMap as any, intakeSectionLabel: controller.intakeSectionLabel, intakePlaceholder: controller.intakePlaceholder, stepGroupLabel: controller.stepGroupLabel as any, premiumActionSteps: controller.premiumActionSteps, groupedPremiumSteps: controller.groupedPremiumSteps, timelineRows: controller.timelineRows, evidenceCompleteness: controller.evidenceCompleteness, costSavingIndicator: controller.costSavingIndicator, consultLinks: controller.consultLinks, loadingConsultLinks: controller.loadingConsultLinks, creatingConsultLink: controller.creatingConsultLink, disablingConsultToken: controller.disablingConsultToken, createConsultPacketShareLink: controller.createConsultPacketShareLink, disableConsultPacketShareLink: controller.disableConsultPacketShareLink, assetViewerOpen: controller.assetViewerOpen, setAssetViewerOpen: controller.setAssetViewerOpen, assetViewerAsset: controller.assetViewerAsset, assetViewerUrl: controller.assetViewerUrl, assetViewerLoading: controller.assetViewerLoading, assetViewerIsPdf: controller.assetViewerIsPdf, assetViewerIsImage: controller.assetViewerIsImage, assetViewerRenderUrl: controller.assetViewerRenderUrl, assetViewerPdfPage: controller.assetViewerPdfPage, setAssetViewerPdfPage: controller.setAssetViewerPdfPage, assetViewerPdfZoom: controller.assetViewerPdfZoom, setAssetViewerPdfZoom: controller.setAssetViewerPdfZoom, assetViewerImageZoom: controller.assetViewerImageZoom, setAssetViewerImageZoom: controller.setAssetViewerImageZoom, assetViewerImagePan: controller.assetViewerImagePan, setAssetViewerImagePan: controller.setAssetViewerImagePan, openAssetAccess: controller.openAssetAccess, closeAssetViewer: controller.closeAssetViewer, openViewerUrlExternally: controller.openViewerUrlExternally }}
        push={{ pushEnabled: controller.pushEnabled, pushQuietHoursEnabled: controller.pushQuietHoursEnabled, savingPushPreferences: controller.savingPushPreferences, togglePushNotifications: controller.togglePushNotifications, togglePushQuietHours: controller.togglePushQuietHours }}
        legal={{ legalReturnScreen: controller.legalReturnScreen, setLegalReturnScreen: controller.setLegalReturnScreen }}
        helpers={{ localizedCaseStatus: localizedCaseStatus as any, formatUploadStage: (s: any, l: any) => uploadStatusText, titleize: (s: string) => s, fmtDate: fmtDate as any, fmtDateTime: fmtDateTime as any, manualCategoryLabel: (t: any, l: any) => t, severityLabel: (s: any) => s, severitySummary: (s: any) => s, casePriorityLevel, casePriorityLabel }}
      />

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

      <Modal
        visible={controller.assetViewerOpen}
        transparent
        animationType="fade"
        onRequestClose={controller.closeAssetViewer}
      >
        <View style={styles.viewerOverlay}>
          <SafeAreaView style={styles.viewerContent}>
            <View style={styles.viewerHeader}>
              <Pressable style={styles.viewerClose} onPress={controller.closeAssetViewer}>
                <Feather name="x" size={24} color="#FFFFFF" />
              </Pressable>
              <View style={styles.viewerTitleGroup}>
                <Text style={styles.viewerTitle} numberOfLines={1}>{controller.assetViewerAsset?.fileName || "Document"}</Text>
                <Text style={styles.viewerSub}>{controller.assetViewerAsset?.assetType === "pdf" ? "PDF Document" : "Image"}</Text>
              </View>
              <Pressable style={styles.viewerAction} onPress={() => void controller.openViewerUrlExternally()}>
                <Feather name="external-link" size={20} color="#FFFFFF" />
              </Pressable>
            </View>

            <View style={styles.viewerBody}>
              {controller.assetViewerLoading ? (
                <View style={styles.viewerLoader}>
                  <ActivityIndicator color="#FFFFFF" />
                </View>
              ) : null}

              {controller.assetViewerIsPdf && controller.assetViewerRenderUrl ? (
                <WebView
                  source={{ uri: controller.assetViewerRenderUrl }}
                  style={styles.webview}
                  onLoadStart={() => controller.setAssetViewerLoading(true)}
                  onLoadEnd={() => controller.setAssetViewerLoading(false)}
                />
              ) : null}

              {controller.assetViewerIsImage && controller.assetViewerUrl ? (
                <View style={styles.imageContainer} {...assetViewerImagePanResponder.panHandlers}>
                  <Image
                    source={{ uri: controller.assetViewerUrl }}
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
                    onLoadStart={() => controller.setAssetViewerLoading(true)}
                    onLoadEnd={() => controller.setAssetViewerLoading(false)}
                  />
                </View>
              ) : null}
            </View>

            {controller.assetViewerIsPdf ? (
              <View style={styles.viewerControls}>
                <View style={styles.viewerControlRow}>
                  <Pressable
                    style={styles.viewerControlBtn}
                    onPress={() => controller.setAssetViewerPdfPage((value: number) => Math.max(1, value - 1))}
                  >
                    <Feather name="chevron-left" size={20} color="#FFFFFF" />
                  </Pressable>
                  <Text style={styles.viewerControlText}>Page {controller.assetViewerPdfPage}</Text>
                  <Pressable
                    style={styles.viewerControlBtn}
                    onPress={() => controller.setAssetViewerPdfPage((value: number) => value + 1)}
                  >
                    <Feather name="chevron-right" size={20} color="#FFFFFF" />
                  </Pressable>
                </View>
                <View style={styles.viewerControlRow}>
                  <Pressable
                    style={styles.viewerControlBtn}
                    onPress={() => controller.setAssetViewerPdfZoom((value: number) => Math.max(50, value - 25))}
                  >
                    <Feather name="zoom-out" size={20} color="#FFFFFF" />
                  </Pressable>
                  <Text style={styles.viewerControlText}>{controller.assetViewerPdfZoom}%</Text>
                  <Pressable
                    style={styles.viewerControlBtn}
                    onPress={() => controller.setAssetViewerPdfZoom((value: number) => Math.min(300, value + 25))}
                  >
                    <Feather name="zoom-in" size={20} color="#FFFFFF" />
                  </Pressable>
                </View>
              </View>
            ) : null}

            {controller.assetViewerIsImage ? (
              <View style={styles.viewerControls}>
                <View style={styles.viewerControlRow}>
                  <Pressable
                    style={styles.viewerControlBtn}
                    onPress={() => controller.setAssetViewerImageZoom((value: number) => clamp(value - 0.25, 1, 4))}
                  >
                    <Feather name="zoom-out" size={20} color="#FFFFFF" />
                  </Pressable>
                  <Text style={styles.viewerControlText}>{Math.round(controller.assetViewerImageZoom * 100)}%</Text>
                  <Pressable
                    style={styles.viewerControlBtn}
                    onPress={() => controller.setAssetViewerImageZoom((value: number) => clamp(value + 0.25, 1, 4))}
                  >
                    <Feather name="zoom-in" size={20} color="#FFFFFF" />
                  </Pressable>
                  <Pressable
                    style={[styles.viewerControlBtn, { marginLeft: 16 }]}
                    onPress={() => { controller.setAssetViewerImageZoom(1); controller.setAssetViewerImagePan({ x: 0, y: 0 }); }}
                  >
                    <Feather name="refresh-cw" size={18} color="#FFFFFF" />
                  </Pressable>
                </View>
              </View>
            ) : null}
          </SafeAreaView>
        </View>
      </Modal>

      <Modal
        visible={controller.plainMeaningOpen}
        transparent
        animationType="slide"
        onRequestClose={() => controller.setPlainMeaningOpen(false)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.sheetBackdrop} onPress={() => controller.setPlainMeaningOpen(false)} accessibilityRole="button" accessibilityLabel="Close" />
          <View style={[styles.sheetCard, styles.plainMeaningSheet]}>
            <View style={styles.sheetHeaderLine} />
            <Text style={styles.sheetTitle}>{controller.language === "es" ? "Vista de significado simple" : "Plain meaning view"}</Text>
            <Text style={styles.sheetSub}>
              {controller.language === "es"
                ? "Explicacion linea por linea de los terminos legales detectados en este documento."
                : "Line-by-line explanation of legal terms detected in this document."}
            </Text>

            <ScrollView style={styles.plainMeaningScroll}>
              {controller.plainMeaningRows.map((row: any, index: number) => (
                <View key={`pm-row-${index}`} style={styles.plainMeaningRow}>
                  <View style={styles.pmOriginalBox}>
                    <Text style={styles.pmLabel}>{controller.language === "es" ? "Texto original" : "Original text"}</Text>
                    <Text style={styles.pmOriginalText}>{row.original}</Text>
                  </View>
                  <View style={styles.pmMeaningBox}>
                    <Text style={styles.pmLabel}>{controller.language === "es" ? "Significado simple" : "Plain meaning"}</Text>
                    <Text style={styles.pmMeaningText}>{row.meaning}</Text>
                  </View>
                </View>
              ))}
              {controller.plainMeaningRows.length === 0 ? (
                <Text style={styles.pmEmpty}>
                  {controller.language === "es" ? "No hay filas disponibles para este documento." : "No rows available for this document."}
                </Text>
              ) : null}
              <View style={styles.pmBoundaryBox}>
                <Text style={styles.pmLabel}>{controller.language === "es" ? "Contexto de extraccion" : "Extraction boundary"}</Text>
                <Text style={styles.pmBoundaryText}>{controller.plainMeaningBoundary || "Full document context"}</Text>
              </View>
            </ScrollView>

            <Pressable style={styles.sheetCloseBtn} onPress={() => controller.setPlainMeaningOpen(false)}>
              <Text style={styles.sheetCloseBtnText}>{controller.language === "es" ? "Cerrar" : "Close"}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={controller.intakeModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => controller.setIntakeModalOpen(false)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.sheetBackdrop} onPress={() => controller.setIntakeModalOpen(false)} accessibilityRole="button" accessibilityLabel="Close" />
          <View style={[styles.sheetCard, styles.intakeSheet]}>
            <View style={styles.sheetHeaderLine} />
            <Text style={styles.sheetTitle}>{controller.language === "es" ? "Intake formal" : "Formal intake"}</Text>
            <Text style={styles.sheetSub}>
              {controller.language === "es"
                ? "Completa estos detalles para preparar mejor tu consulta con un abogado."
                : "Complete these details to better prepare your consultation with a lawyer."}
            </Text>

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.fill}>
              <ScrollView style={styles.intakeScroll}>
                {(Object.keys(controller.intakeDraft) as Array<keyof IntakeDraft>).map((key) => (
                  <View key={`intake-field-${String(key)}`} style={styles.intakeField}>
                    <Text style={styles.intakeLabel}>{controller.intakeSectionLabel(key)}</Text>
                    <TextInput
                      style={styles.intakeInput}
                      multiline
                      value={controller.intakeDraft[key]}
                      onChangeText={(val) => controller.setIntakeDraft((prev: any) => ({ ...prev, [key]: val }))}
                      placeholder={controller.intakePlaceholder(key)}
                      placeholderTextColor={palette.subtle}
                    />
                  </View>
                ))}
                <View style={{ height: 40 }} />
              </ScrollView>
            </KeyboardAvoidingView>

            <Pressable style={styles.sheetCloseBtn} onPress={() => controller.setIntakeModalOpen(false)}>
              <Text style={styles.sheetCloseBtnText}>{controller.language === "es" ? "Guardar y cerrar" : "Save and close"}</Text>
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
                onPress={() => void controller.startPlusCheckout()}
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

      <Modal
        visible={controller.uploadSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => controller.setUploadSheetOpen(false)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.sheetBackdrop} onPress={() => controller.setUploadSheetOpen(false)} accessibilityRole="button" accessibilityLabel="Close" />
          <View style={[styles.sheetCard, styles.uploadSheet]}>
            <View style={styles.sheetHeaderLine} />
            <Text style={styles.sheetTitle}>{controller.language === "es" ? "Subir documento" : "Upload Document"}</Text>
            <Text style={styles.sheetSub}>
              {controller.language === "es"
                ? "Agrega un archivo o toma una foto para iniciar el procesamiento."
                : "Add a file or take a photo to start processing."}
            </Text>

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

            {controller.uploading ? (
              <View style={styles.uploadProgress}>
                <ActivityIndicator color={palette.primary} />
                <Text style={styles.uploadProgressText}>{uploadStatusText}</Text>
              </View>
            ) : null}

            <Pressable style={styles.sheetCloseBtn} onPress={() => controller.setUploadSheetOpen(false)}>
              <Text style={styles.sheetCloseBtnText}>{controller.language === "es" ? "Cerrar" : "Close"}</Text>
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
    </>
  );
}
