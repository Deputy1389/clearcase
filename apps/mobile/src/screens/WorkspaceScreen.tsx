import React from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View, Share } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { hapticTap } from "../utils/haptics";
import { titleize, fmtDate, fmtDateTime } from "../utils/formatting";
import { severityLabel, severitySummary, manualCategoryLabel } from "../utils/case-logic";
import ActionLayerCard from "./workspace/components/ActionLayerCard";
import type { WorkspaceScreenProps } from "./types";

const MOBILE_BUILD_STAMP = "mobile-ui-2026-02-13b";

export default function WorkspaceScreen({
  navigation,
  cases,
  upload,
  paywall,
  ui,
  auth,
  workspace,
  push,
  legal,
  helpers,
}: WorkspaceScreenProps) {
  const { setScreen, setDrawerOpen } = navigation;
  const { 
    selectedCase, 
    selectedCaseId, 
    selectedCaseSummary, 
    latestCase, 
    loadingCase,
    caseAssets,
    loadingCaseAssets,
    refreshing,
    refreshWorkspace
  } = cases;
  const { uploading, uploadStage, openUploadSheetForCase } = upload;
  const { plusEnabled, paywallConfig, openPaywall } = paywall;
  const { offlineMode, language, styles, palette, hapticTap: haptic } = ui;
  const { email } = auth;
  const { 
    workspaceSeverity,
    workspaceSummaryText,
    workspaceSectionMeta,
    workspaceSectionOpen,
    toggleWorkspaceSection,
    workspaceChecklistItems,
    premiumStepSummaryLine,
    caseWatchEnabled,
    savingWatchMode,
    toggleCaseWatchMode,
    weeklyCheckInStatus,
    weeklyCheckInAction,
    watchMicroEvents,
    packetShareStatusLine,
    caseContextDraft,
    setCaseContextDraft,
    savingCaseContext,
    saveCaseContextForSelectedCase,
    classificationSheetOpen,
    setClassificationSheetOpen,
    classificationDraft,
    setClassificationDraft,
    savingClassification,
    openManualCategoryPicker,
    saveManualCategoryForSelectedCase,
    loadingPlainMeaning,
    openPlainMeaningTranslator,
    lawyerSummaryOpen,
    setLawyerSummaryOpen,
    lawyerReadySummary,
    shareLawyerReadySummary,
    emailLawyerReadySummary,
    intakeModalOpen,
    setIntakeModalOpen,
    intakeDraft,
    setIntakeDraft,
    intakeCompleteness,
    stepProgressMap,
    setStepProgress,
    intakeSectionLabel,
    intakePlaceholder,
    stepGroupLabel,
    premiumActionSteps,
    groupedPremiumSteps,
    evidenceCompleteness,
    costSavingIndicator,
    consultLinks,
    loadingConsultLinks,
    creatingConsultLink,
    disablingConsultToken,
    createConsultPacketShareLink,
    disableConsultPacketShareLink,
    assetViewerOpen,
    setAssetViewerOpen,
    assetViewerAsset,
    assetViewerLoading,
    assetViewerIsPdf,
    assetViewerIsImage,
    assetViewerRenderUrl,
    assetViewerPdfPage,
    setAssetViewerPdfPage,
    assetViewerPdfZoom,
    setAssetViewerPdfZoom,
    assetViewerImageZoom,
    setAssetViewerImageZoom,
    assetViewerImagePan,
    setAssetViewerImagePan,
    openAssetAccess,
    closeAssetViewer,
    openViewerUrlExternally,
    timelineRows,
    actionInstructions,
    responseSignals
  } = workspace;
  const { localizedCaseStatus, formatUploadStage, manualCategoryLabel: manualLabel } = helpers;

  return (
    <View style={styles.screenSoft}>
      <View style={styles.verdictHead}>
        <Pressable onPress={() => setScreen("home")} style={styles.back}>
          <Feather name="chevron-left" size={24} color={palette.muted} />
        </Pressable>
        <View style={styles.workspaceTitleWrap}>
          <Text style={styles.formTitleSmall}>{language === "es" ? "Espacio de trabajo" : "Workspace"}</Text>
          <Text style={styles.buildStamp}>{MOBILE_BUILD_STAMP}</Text>
          {offlineMode ? <Text style={styles.offlinePill}>{language === "es" ? "SIN CONEXION" : "OFFLINE"}</Text> : null}
        </View>
        <Pressable onPress={() => void refreshWorkspace()} style={styles.info}>
          <Feather name="refresh-cw" size={16} color={palette.subtle} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.scrollBody} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refreshWorkspace()} />}>
        <View
          style={[
            styles.card,
            styles.workspacePrimaryCard,
            workspaceSeverity === "high"
              ? styles.workspacePrimaryHigh
              : workspaceSeverity === "medium"
                ? styles.workspacePrimaryMedium
                : styles.workspacePrimaryLow
          ]}
        >
          <View style={styles.workspacePillRow}>
            <View style={[styles.priorityChip, styles.priorityChipHigh]}>
              <Text style={styles.priorityChipText}>
                {selectedCase?.timeSensitive
                  ? language === "es"
                    ? "Senales sensibles al tiempo"
                    : "Time-sensitive signals"
                  : language === "es"
                    ? "Listo para revisar"
                    : "Ready to review"}
              </Text>
            </View>
            <View style={[styles.priorityChip, styles.priorityChipMedium]}>
              <Text style={styles.priorityChipText}>
                {selectedCase?.status
                  ? localizedCaseStatus(selectedCase.status, language)
                  : language === "es"
                    ? "Listo para revisar"
                    : "Ready to review"}
              </Text>
            </View>
          </View>
          {!selectedCaseId && !latestCase ? (
            <Text style={styles.cardBody}>
              {language === "es"
                ? "Aun no hay analisis. Sube un archivo para generar tu primer resumen del espacio de trabajo."
                : "No insight yet. Upload a file to generate your first workspace summary."}
            </Text>
          ) : null}
          {selectedCaseId && !selectedCase && loadingCase ? <ActivityIndicator color={palette.primary} /> : null}
          {selectedCase ? (
            <>
              <Text style={styles.workspaceCaseTitle}>{selectedCase.title ?? (language === "es" ? "Caso sin titulo" : "Untitled case")}</Text>
              <Text style={styles.workspaceCaseMeta}>
                {language === "es" ? "Tipo" : "Type"}{" "}
                {selectedCase.documentType
                  ? titleize(selectedCase.documentType)
                  : language === "es"
                    ? "Deteccion pendiente"
                    : "Pending detection"}{" "}
                | {language === "es" ? "Actualizado" : "Updated"} {fmtDateTime(selectedCase.updatedAt)}
              </Text>
              <View style={styles.workspaceMetricsRow}>
                <View style={styles.workspaceMetricCard}>
                  <Text style={styles.metricLabel}>{language === "es" ? "Proxima fecha" : "Next deadline"}</Text>
                  <Text style={styles.metricValueSm}>{fmtDate(selectedCase.earliestDeadline, language)}</Text>
                </View>
                <View style={styles.workspaceMetricCard}>
                  <Text style={styles.metricLabel}>{language === "es" ? "Confianza de extraccion" : "Extraction confidence"}</Text>
                  <Text style={styles.metricValueSm}>
                    {selectedCase.classificationConfidence !== null
                      ? `${Math.round(selectedCase.classificationConfidence * 100)}%`
                      : language === "es"
                        ? "Pendiente"
                        : "Pending"}
                  </Text>
                </View>
              </View>
            </>
          ) : null}
          {!selectedCase && selectedCaseSummary ? (
            <>
              <Text style={styles.workspaceCaseTitle}>{selectedCaseSummary.title ?? (language === "es" ? "Caso sin titulo" : "Untitled case")}</Text>
              <Text style={styles.workspaceCaseMeta}>
                {titleize(selectedCaseSummary.status)} |{" "}
                {selectedCaseSummary.documentType
                  ? titleize(selectedCaseSummary.documentType)
                  : language === "es"
                    ? "Deteccion pendiente"
                    : "Pending detection"}
              </Text>
            </>
          ) : null}
          <Pressable onPress={() => void openUploadSheetForCase(selectedCaseId)} style={styles.outlineSoftBtn} disabled={uploading}>
            <Text style={styles.outlineSoftText}>
              {uploading
                ? formatUploadStage(uploadStage, language) + "..."
                : language === "es"
                  ? "Subir otro documento"
                  : "Upload another document"}
            </Text>
          </Pressable>
        </View>

        {/* Steps Section */}
        <View style={styles.fill}>
          <Pressable 
            style={[styles.workspaceAccordionBar, workspaceSectionOpen.steps ? styles.workspaceAccordionBarOpen : null]} 
            onPress={() => toggleWorkspaceSection("steps")}
          >
            <Text style={styles.workspaceAccordionTitle}>{workspaceSectionMeta.steps.title}</Text>
            <View style={styles.workspaceAccordionMetaWrap}>
              <Text style={styles.workspaceAccordionMeta}>{workspaceSectionMeta.steps.summary}</Text>
              <Feather name={workspaceSectionOpen.steps ? "chevron-up" : "chevron-down"} size={16} color={palette.subtle} />
            </View>
          </Pressable>
          {workspaceSectionOpen.steps && (
            <View style={[styles.card, styles.accordionContentCard, workspaceSeverity === "high" ? styles.actionPlanHigh : workspaceSeverity === "medium" ? styles.actionPlanMedium : styles.actionPlanLow]}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>{language === "es" ? "Pasos recomendados" : "Recommended next steps"}</Text>
                <View style={[styles.severityBadge, workspaceSeverity === "high" ? styles.severityBadgeHigh : workspaceSeverity === "medium" ? styles.severityBadgeMedium : styles.severityBadgeLow]}>
                  <Text style={styles.severityBadgeText}>{severityLabel(workspaceSeverity, language)}</Text>
                </View>
              </View>
              <Text style={styles.actionPlanSubhead}>{severitySummary(workspaceSeverity, language)}</Text>
              {premiumStepSummaryLine ? <Text style={styles.optionDesc}>{premiumStepSummaryLine}</Text> : null}
              {workspaceChecklistItems.map((step, index) => (
                <View key={`${selectedCaseId ?? "case"}-step-${step.id}`} style={styles.checklistRow}>
                  <View style={[styles.checklistDot, workspaceSeverity === "high" ? styles.checklistDotHigh : workspaceSeverity === "medium" ? styles.checklistDotMedium : styles.checklistDotLow]}>
                    <Feather name={index === 0 && selectedCase?.earliestDeadline ? "alert-triangle" : "check"} size={12} color={workspaceSeverity === "high" ? "#B91C1C" : workspaceSeverity === "medium" ? "#A16207" : "#166534"} />
                  </View>
                  <Text style={styles.checklistText}>{step.text}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Action Instructions Section */}
        {actionInstructions && actionInstructions.length > 0 ? (
          <>
            <ActionLayerCard instruction={actionInstructions[0]} language={language} styles={styles} palette={palette} />
            {responseSignals ? (
              <View style={styles.actionContactCard}>
                <Text style={styles.miniLabel}>{language === "es" ? "DETALLES DE RESPUESTA" : "RESPONSE DETAILS"}</Text>
                <Text style={styles.actionContactLine}>
                  {language === "es" ? "Destino: " : "Destination: "}
                  {responseSignals.responseDestination === "court"
                    ? (language === "es" ? "Tribunal" : "Court")
                    : responseSignals.responseDestination === "sender"
                      ? (language === "es" ? "Remitente" : "Sender")
                      : responseSignals.responseDestination === "agency"
                        ? (language === "es" ? "Agencia" : "Agency")
                        : (language === "es" ? "Desconocido" : "Unknown")}
                </Text>
                {responseSignals.responseChannels.length > 0 ? (
                  <Text style={styles.actionContactLine}>
                    {language === "es" ? "Metodos: " : "Methods: "}
                    {responseSignals.responseChannels.map((ch) => {
                      if (ch === "email") return language === "es" ? "Correo" : "Email";
                      if (ch === "phone") return language === "es" ? "Telefono" : "Phone";
                      if (ch === "mail") return language === "es" ? "Correo postal" : "Mail";
                      if (ch === "portal") return "Portal";
                      if (ch === "in_person") return language === "es" ? "En persona" : "In person";
                      return ch;
                    }).join(", ")}
                  </Text>
                ) : null}
                {responseSignals.responseDeadlineISO ? (
                  <View style={styles.actionDeadlineRow}>
                    <Feather name="clock" size={13} color={palette.primary} />
                    <Text style={styles.actionDeadlineText}>
                      {language === "es" ? "Responder antes de" : "Respond by"}: {fmtDate(responseSignals.responseDeadlineISO, language)}
                    </Text>
                  </View>
                ) : null}
                {responseSignals.responseDeadlineISO && responseSignals.timeSensitivity !== "none" ? (
                  <Text style={[styles.actionContactLine, { color: responseSignals.timeSensitivity === "critical" ? "#B91C1C" : responseSignals.timeSensitivity === "urgent" ? "#B45309" : palette.text }]}>
                    {language === "es" ? "Urgencia: " : "Urgency: "}
                    {responseSignals.timeSensitivity === "critical" ? (language === "es" ? "Critica" : "Critical")
                      : responseSignals.timeSensitivity === "urgent" ? (language === "es" ? "Urgente" : "Urgent")
                      : (language === "es" ? "Moderada" : "Moderate")}
                  </Text>
                ) : null}
                {responseSignals.jurisdictionState ? (
                  <Text style={styles.actionContactLine}>
                    {language === "es" ? "Jurisdiccion: " : "Jurisdiction: "}
                    {responseSignals.jurisdictionState}
                  </Text>
                ) : null}
                {responseSignals.missing.channel ? (
                  <Text style={[styles.cardBody, { fontStyle: "italic", marginTop: 4, marginBottom: 0 }]}>
                    {language === "es"
                      ? "No se encontro metodo de respuesta en este documento aun."
                      : "No response method found in this document yet."}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}

        {/* Watch Section */}
        <View style={styles.fill}>
          <Pressable 
            style={[styles.workspaceAccordionBar, workspaceSectionOpen.watch ? styles.workspaceAccordionBarOpen : null]} 
            onPress={() => toggleWorkspaceSection("watch")}
          >
            <Text style={styles.workspaceAccordionTitle}>{workspaceSectionMeta.watch.title}</Text>
            <View style={styles.workspaceAccordionMetaWrap}>
              <Text style={styles.workspaceAccordionMeta}>{workspaceSectionMeta.watch.summary}</Text>
              <Feather name={workspaceSectionOpen.watch ? "chevron-up" : "chevron-down"} size={16} color={palette.subtle} />
            </View>
          </Pressable>
          {workspaceSectionOpen.watch && (
            <View style={[styles.card, styles.accordionContentCard]}>
              {!plusEnabled ? (
                <View style={styles.plusPreviewCard}>
                  <View style={styles.sectionTitleRow}>
                    <Text style={styles.sectionTitle}>{language === "es" ? "ClearCase Plus" : "ClearCase Plus"}</Text>
                    <View style={styles.plusLockedPill}>
                      <Feather name="lock" size={10} color="#334155" />
                      <Text style={styles.plusLockedPillText}>{language === "es" ? "Bloqueado" : "Locked"}</Text>
                    </View>
                  </View>
                  <Text style={styles.cardBody}>{language === "es" ? "Plus mantiene tu caso organizado y monitoreado." : "Plus keeps your case organized and quietly watched."}</Text>
                  <Pressable onPress={() => openPaywall("workspace_plus_preview")} style={styles.primaryBtn}>
                    <Text style={styles.primaryBtnText}>{language === "es" ? "Iniciar Plus" : "Start Plus"}</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.plusActiveCard}>
                  <View style={styles.sectionTitleRow}><Text style={styles.sectionTitle}>{language === "es" ? "Revision semanal" : "Weekly check-in"}</Text></View>
                  <Pressable style={styles.outlineSoftBtn} onPress={() => void toggleCaseWatchMode()} disabled={savingWatchMode}>
                    <Text style={styles.outlineSoftText}>{savingWatchMode ? "..." : (caseWatchEnabled ? (language === "es" ? "Desactivar" : "Turn off") : (language === "es" ? "Activar" : "Turn on"))}</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Packet Section */}
        <View style={styles.fill}>
          <Pressable 
            style={[styles.workspaceAccordionBar, workspaceSectionOpen.packet ? styles.workspaceAccordionBarOpen : null]} 
            onPress={() => toggleWorkspaceSection("packet")}
          >
            <Text style={styles.workspaceAccordionTitle}>{workspaceSectionMeta.packet.title}</Text>
            <View style={styles.workspaceAccordionMetaWrap}>
              <Text style={styles.workspaceAccordionMeta}>{workspaceSectionMeta.packet.summary}</Text>
              <Feather name={workspaceSectionOpen.packet ? "chevron-up" : "chevron-down"} size={16} color={palette.subtle} />
            </View>
          </Pressable>
          {workspaceSectionOpen.packet && (
            <View style={[styles.card, styles.accordionContentCard]}>
              <Text style={styles.cardBody}>{packetShareStatusLine}</Text>
              <Pressable style={styles.outlineSoftBtn} onPress={() => setIntakeModalOpen(true)}><Text style={styles.outlineSoftText}>{language === "es" ? "Intake formal" : "Formal intake"}</Text></Pressable>
              <Pressable style={styles.outlineSoftBtn} onPress={() => setLawyerSummaryOpen(true)}><Text style={styles.outlineSoftText}>{language === "es" ? "Paquete para abogado" : "Lawyer-ready packet"}</Text></Pressable>
            </View>
          )}
        </View>

        {/* Context Section */}
        <View style={styles.fill}>
          <Pressable 
            style={[styles.workspaceAccordionBar, workspaceSectionOpen.context ? styles.workspaceAccordionBarOpen : null]} 
            onPress={() => toggleWorkspaceSection("context")}
          >
            <Text style={styles.workspaceAccordionTitle}>{workspaceSectionMeta.context.title}</Text>
            <View style={styles.workspaceAccordionMetaWrap}>
              <Text style={styles.workspaceAccordionMeta}>{workspaceSectionMeta.context.summary}</Text>
              <Feather name={workspaceSectionOpen.context ? "chevron-up" : "chevron-down"} size={16} color={palette.subtle} />
            </View>
          </Pressable>
          {workspaceSectionOpen.context && (
            <View style={[styles.card, styles.accordionContentCard]}>
              <TextInput style={styles.caseContextInput} multiline value={caseContextDraft} onChangeText={setCaseContextDraft} placeholder={language === "es" ? "Agrega el que paso, cuando, donde..." : "Add what happened, when, where..."} placeholderTextColor={palette.subtle} />
              <Pressable onPress={() => void saveCaseContextForSelectedCase()} style={styles.outlineSoftBtn} disabled={savingCaseContext}><Text style={styles.outlineSoftText}>{savingCaseContext ? "..." : (language === "es" ? "Guardar contexto" : "Save context")}</Text></Pressable>
            </View>
          )}
        </View>

        {/* Category Section */}
        <View style={styles.fill}>
          <Pressable 
            style={[styles.workspaceAccordionBar, workspaceSectionOpen.category ? styles.workspaceAccordionBarOpen : null]} 
            onPress={() => toggleWorkspaceSection("category")}
          >
            <Text style={styles.workspaceAccordionTitle}>{workspaceSectionMeta.category.title}</Text>
            <View style={styles.workspaceAccordionMetaWrap}>
              <Text style={styles.workspaceAccordionMeta}>{workspaceSectionMeta.category.summary}</Text>
              <Feather name={workspaceSectionOpen.category ? "chevron-up" : "chevron-down"} size={16} color={palette.subtle} />
            </View>
          </Pressable>
          {workspaceSectionOpen.category && (
            <View style={[styles.card, styles.accordionContentCard]}>
              <Text style={styles.cardBody}>{language === "es" ? "Actual:" : "Current:"} {manualCategoryLabel(selectedCase?.documentType ?? selectedCaseSummary?.documentType ?? null, language)}</Text>
              <Pressable onPress={openManualCategoryPicker} style={styles.outlineSoftBtn} disabled={!selectedCaseId || savingClassification}><Text style={styles.outlineSoftText}>{language === "es" ? "Cambiar categoria" : "Change category"}</Text></Pressable>
            </View>
          )}
        </View>

        {/* Summary Section */}
        <View style={styles.fill}>
          <Pressable 
            style={[styles.workspaceAccordionBar, workspaceSectionOpen.summary ? styles.workspaceAccordionBarOpen : null]} 
            onPress={() => toggleWorkspaceSection("summary")}
          >
            <Text style={styles.workspaceAccordionTitle}>{workspaceSectionMeta.summary.title}</Text>
            <View style={styles.workspaceAccordionMetaWrap}>
              <Text style={styles.workspaceAccordionMeta}>{workspaceSectionMeta.summary.summary}</Text>
              <Feather name={workspaceSectionOpen.summary ? "chevron-up" : "chevron-down"} size={16} color={palette.subtle} />
            </View>
          </Pressable>
          {workspaceSectionOpen.summary && (
            <View style={[styles.card, styles.accordionContentCard]}>
              <Text style={styles.cardBody}>{workspaceSummaryText}</Text>
            </View>
          )}
        </View>

        {/* Plain Meaning Section */}
        <View style={styles.fill}>
          <Pressable 
            style={[styles.workspaceAccordionBar, workspaceSectionOpen.plain_meaning ? styles.workspaceAccordionBarOpen : null]} 
            onPress={() => toggleWorkspaceSection("plain_meaning")}
          >
            <Text style={styles.workspaceAccordionTitle}>{workspaceSectionMeta.plain_meaning.title}</Text>
            <View style={styles.workspaceAccordionMetaWrap}>
              <Text style={styles.workspaceAccordionMeta}>{workspaceSectionMeta.plain_meaning.summary}</Text>
              <Feather name={workspaceSectionOpen.plain_meaning ? "chevron-up" : "chevron-down"} size={16} color={palette.subtle} />
            </View>
          </Pressable>
          {workspaceSectionOpen.plain_meaning && (
            <View style={[styles.card, styles.accordionContentCard]}>
              <Text style={styles.cardBody}>{language === "es" ? "Compara texto original con significado simple." : "Compare original text with plain meaning."}</Text>
              <Pressable style={styles.outlineSoftBtn} onPress={() => void openPlainMeaningTranslator()} disabled={loadingPlainMeaning}><Text style={styles.outlineSoftText}>{loadingPlainMeaning ? "..." : (language === "es" ? "Abrir vista" : "Open view")}</Text></Pressable>
            </View>
          )}
        </View>

        {/* Timeline Section */}
        <View style={styles.fill}>
          <Pressable 
            style={[styles.workspaceAccordionBar, workspaceSectionOpen.timeline ? styles.workspaceAccordionBarOpen : null]} 
            onPress={() => toggleWorkspaceSection("timeline")}
          >
            <Text style={styles.workspaceAccordionTitle}>{workspaceSectionMeta.timeline.title}</Text>
            <View style={styles.workspaceAccordionMetaWrap}>
              <Text style={styles.workspaceAccordionMeta}>{workspaceSectionMeta.timeline.summary}</Text>
              <Feather name={workspaceSectionOpen.timeline ? "chevron-up" : "chevron-down"} size={16} color={palette.subtle} />
            </View>
          </Pressable>
          {workspaceSectionOpen.timeline && (
            <View style={[styles.card, styles.accordionContentCard]}>
              {selectedCase ? (
                caseAssets.slice(0, 5).map((asset) => (
                  <View key={`case-asset-${asset.id}`} style={styles.receiptRow}>
                    <Text style={styles.receiptTitle}>{asset.fileName}</Text>
                    <Pressable onPress={() => void openAssetAccess(asset.id, "view")}><Text style={styles.linkText}>{language === "es" ? "Abrir" : "Open"}</Text></Pressable>
                  </View>
                ))
              ) : <Text style={styles.cardBody}>{language === "es" ? "Sin caso" : "No case"}</Text>}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
