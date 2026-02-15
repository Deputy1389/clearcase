import React from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View, Share } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { hapticTap } from "../utils/haptics";
import { titleize, fmtDate, fmtDateTime } from "../utils/formatting";
import { severityLabel, severitySummary, manualCategoryLabel } from "../utils/case-logic";
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
    timelineRows
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
        <Pressable style={styles.workspaceAccordionBar} onPress={() => toggleWorkspaceSection("steps")}>
          <Text style={styles.workspaceAccordionTitle}>{workspaceSectionMeta.steps.title}</Text>
          <View style={styles.workspaceAccordionMetaWrap}>
            <Text style={styles.workspaceAccordionMeta}>{workspaceSectionMeta.steps.summary}</Text>
            <Feather
              name={workspaceSectionOpen.steps ? "chevron-up" : "chevron-down"}
              size={16}
              color={palette.subtle}
            />
          </View>
        </Pressable>
        {workspaceSectionOpen.steps ? (
          <View
            style={[
              styles.card,
              styles.actionPlanCard,
              workspaceSeverity === "high"
                ? styles.actionPlanHigh
                : workspaceSeverity === "medium"
                  ? styles.actionPlanMedium
                  : styles.actionPlanLow
            ]}
          >
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>
                {language === "es" ? "Pasos recomendados" : "Recommended next steps"}
              </Text>
              <View
                style={[
                  styles.severityBadge,
                  workspaceSeverity === "high"
                    ? styles.severityBadgeHigh
                    : workspaceSeverity === "medium"
                      ? styles.severityBadgeMedium
                      : styles.severityBadgeLow
                ]}
              >
                <Text style={styles.severityBadgeText}>{severityLabel(workspaceSeverity, language)}</Text>
              </View>
            </View>
            <Text style={styles.actionPlanSubhead}>{severitySummary(workspaceSeverity, language)}</Text>
            {premiumStepSummaryLine ? <Text style={styles.optionDesc}>{premiumStepSummaryLine}</Text> : null}
            {workspaceChecklistItems.map((step, index) => (
              <View key={`${selectedCaseId ?? "case"}-step-${step.id}`} style={styles.checklistRow}>
                <View
                  style={[
                    styles.checklistDot,
                    workspaceSeverity === "high"
                      ? styles.checklistDotHigh
                      : workspaceSeverity === "medium"
                        ? styles.checklistDotMedium
                        : styles.checklistDotLow
                  ]}
                >
                  <Feather
                    name={index === 0 && selectedCase?.earliestDeadline ? "alert-triangle" : "check"}
                    size={12}
                    color={
                      workspaceSeverity === "high"
                        ? "#B91C1C"
                        : workspaceSeverity === "medium"
                          ? "#A16207"
                          : "#166534"
                    }
                  />
                </View>
                <Text style={styles.checklistText}>{step.text}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Watch Section */}
        <Pressable style={styles.workspaceAccordionBar} onPress={() => toggleWorkspaceSection("watch")}>
          <Text style={styles.workspaceAccordionTitle}>{workspaceSectionMeta.watch.title}</Text>
          <View style={styles.workspaceAccordionMetaWrap}>
            <Text style={styles.workspaceAccordionMeta}>{workspaceSectionMeta.watch.summary}</Text>
            <Feather
              name={workspaceSectionOpen.watch ? "chevron-up" : "chevron-down"}
              size={16}
              color={palette.subtle}
            />
          </View>
        </Pressable>
        {workspaceSectionOpen.watch ? (
          <>
            {!plusEnabled ? (
              <View style={[styles.card, styles.plusPreviewCard]}>
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionTitle}>
                    {language === "es" ? "Vista previa de ClearCase Plus" : "ClearCase Plus Preview"}
                  </Text>
                  <View style={styles.plusLockedPill}>
                    <Feather name="lock" size={10} color="#334155" />
                    <Text style={styles.plusLockedPillText}>{language === "es" ? "Bloqueado" : "Locked"}</Text>
                  </View>
                </View>
                <Text style={styles.cardBody}>
                  {language === "es"
                    ? "Plus mantiene tu caso organizado y monitoreado de forma calmada con el paso del tiempo."
                    : "Plus keeps your case organized and quietly watched over time."}
                </Text>
                <Text style={styles.optionDesc}>
                  {language === "es"
                    ? `ClearCase Plus: ${paywallConfig.plusPriceMonthly}`
                    : `ClearCase Plus: ${paywallConfig.plusPriceMonthly}`}
                </Text>
                <Text style={styles.optionDesc}>
                  {language === "es"
                    ? "Costo pequeno ahora, menos omisiones costosas despues."
                    : "Small cost now, fewer expensive misses later."}
                </Text>
                <View style={styles.plusLockedActionRow}>
                  <Feather name="eye" size={14} color={palette.subtle} />
                  <View style={styles.plusLockedActionTextWrap}>
                    <Text style={styles.plusLockedActionTitle}>
                      {language === "es" ? "Modo seguimiento bloqueado en Free" : "Case Watch Mode locked on Free"}
                    </Text>
                    <Text style={styles.plusLockedActionBody}>
                      {language === "es"
                        ? "Plus mantiene este caso monitoreado y con actividad continua."
                        : "Plus keeps this case monitored with ongoing activity updates."}
                    </Text>
                  </View>
                </View>
                <View style={styles.plusLockedActionRow}>
                  <Feather name="link" size={14} color={palette.subtle} />
                  <View style={styles.plusLockedActionTextWrap}>
                    <Text style={styles.plusLockedActionTitle}>
                      {language === "es" ? "Enlaces de paquete bloqueados en Free" : "Packet share links locked on Free"}
                    </Text>
                    <Text style={styles.plusLockedActionBody}>
                      {language === "es"
                        ? "Plus permite crear enlaces por tiempo limitado y desactivar acceso cuando haga falta."
                        : "Plus lets you create time-limited links and disable access when needed."}
                    </Text>
                  </View>
                </View>
                <View style={styles.plusFeatureRow}>
                  <Feather name="calendar" size={14} color={palette.muted} />
                  <Text style={styles.plusFeatureText}>
                    {language === "es"
                      ? "Cronologia y memoria para fechas detectadas y actualizaciones."
                      : "Timeline and memory for detected dates and updates."}
                  </Text>
                </View>
                <View style={styles.plusFeatureRow}>
                  <Feather name="bell" size={14} color={palette.muted} />
                  <Text style={styles.plusFeatureText}>
                    {language === "es"
                      ? "Recordatorios calmados de fechas con incertidumbre explicita."
                      : "Gentle deadline reminders with explicit uncertainty."}
                  </Text>
                </View>
                <View style={styles.plusFeatureRow}>
                  <Feather name="check-square" size={14} color={palette.muted} />
                  <Text style={styles.plusFeatureText}>
                    {language === "es"
                      ? "Seguimiento de integridad de evidencia para documentos que suelen ir juntos."
                      : "Evidence completeness tracking for commonly paired documents."}
                  </Text>
                </View>
                <View style={styles.plusFeatureRow}>
                  <Feather name="file-text" size={14} color={palette.muted} />
                  <Text style={styles.plusFeatureText}>
                    {language === "es"
                      ? "Paquete de consulta listo para preparacion de asesoria."
                      : "Lawyer-ready packet for consultation prep."}
                  </Text>
                </View>
                <View style={styles.plusFeatureRow}>
                  <Feather name="list" size={14} color={palette.muted} />
                  <Text style={styles.plusFeatureText}>
                    {language === "es"
                      ? "Motor de proximos pasos con consecuencias, comprobantes y confianza."
                      : "Dynamic next-step engine with consequences, receipts, and confidence."}
                  </Text>
                </View>
                <View style={styles.plusFeatureRow}>
                  <Feather name="clipboard" size={14} color={palette.muted} />
                  <Text style={styles.plusFeatureText}>
                    {language === "es"
                      ? "Intake formal para reducir tiempo pagado en consulta."
                      : "Formal intake simulation to reduce paid consultation time."}
                  </Text>
                </View>
                <Pressable onPress={() => openPaywall("workspace_plus_preview")} style={styles.primaryBtn}>
                  <Text style={styles.primaryBtnText}>{language === "es" ? "Iniciar Plus" : "Start Plus"}</Text>
                </Pressable>
              </View>
            ) : (
              <View style={[styles.card, styles.plusActiveCard]}>
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionTitle}>{language === "es" ? "Revision semanal del caso" : "Weekly case check-in"}</Text>
                </View>
                <View style={styles.plusFeatureRow}>
                  <Feather name="eye" size={14} color="#166534" />
                  <Text style={styles.plusFeatureText}>
                    {language === "es"
                      ? "Verificamos nuevas fechas, cambios en archivos y progreso del caso."
                      : "We check for new dates, file changes, and case progress."}
                  </Text>
                </View>
                <Pressable
                  style={styles.outlineSoftBtn}
                  onPress={() => void toggleCaseWatchMode()}
                  disabled={savingWatchMode}
                >
                  <Text style={styles.outlineSoftText}>
                    {savingWatchMode
                      ? language === "es"
                        ? "Guardando..."
                        : "Saving..."
                      : caseWatchEnabled
                        ? language === "es"
                          ? "Desactivar seguimiento"
                          : "Turn watch off"
                        : language === "es"
                          ? "Activar seguimiento"
                          : "Turn watch on"}
                  </Text>
                </Pressable>
                <View style={styles.plusFeatureRow}>
                  <Feather name="check-circle" size={14} color="#166534" />
                  <Text style={styles.plusFeatureText}>{weeklyCheckInStatus}</Text>
                </View>
                {watchMicroEvents.length > 0 ? (
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptTitle}>{language === "es" ? "Que cambio" : "What changed"}</Text>
                    {watchMicroEvents.slice(0, 2).map((event, index) => (
                      <Text key={`watch-event-${index}`} style={styles.receiptSub}>
                        - {event}
                      </Text>
                    ))}
                  </View>
                ) : null}
                <View style={styles.plusFeatureRow}>
                  <Feather name="arrow-right-circle" size={14} color="#166534" />
                  <Text style={styles.plusFeatureText}>{weeklyCheckInAction}</Text>
                </View>
              </View>
            )}
          </>
        ) : null}

        {/* Packet Section */}
        <Pressable style={styles.workspaceAccordionBar} onPress={() => toggleWorkspaceSection("packet")}>
          <Text style={styles.workspaceAccordionTitle}>{workspaceSectionMeta.packet.title}</Text>
          <View style={styles.workspaceAccordionMetaWrap}>
            <Text style={styles.workspaceAccordionMeta}>{workspaceSectionMeta.packet.summary}</Text>
            <Feather
              name={workspaceSectionOpen.packet ? "chevron-up" : "chevron-down"}
              size={16}
              color={palette.subtle}
            />
          </View>
        </Pressable>
        {workspaceSectionOpen.packet ? (
          <View style={[styles.card, styles.plusActiveCard]}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>{language === "es" ? "Preparacion para consulta" : "Consult preparation"}</Text>
            </View>
            <Text style={styles.cardBody}>{packetShareStatusLine}</Text>
            <Text style={styles.cardBody}>{costSavingIndicator.message}</Text>
            <Pressable style={styles.outlineSoftBtn} onPress={() => setIntakeModalOpen(true)}>
              <Text style={styles.outlineSoftText}>
                {language === "es"
                  ? `Abrir intake formal (${intakeCompleteness}% completo)`
                  : `Open formal intake (${intakeCompleteness}% complete)`}
              </Text>
            </Pressable>
            <Pressable style={styles.outlineSoftBtn} onPress={() => setLawyerSummaryOpen(true)}>
              <Text style={styles.outlineSoftText}>{language === "es" ? "Abrir paquete para abogado" : "Open lawyer prep packet"}</Text>
            </Pressable>
            <Pressable style={styles.outlineSoftBtn} onPress={() => { haptic(); setScreen("drafting"); }} accessibilityRole="button" accessibilityLabel={language === "es" ? "Asistente de redaccion" : "Drafting assistant"}>
              <Text style={styles.outlineSoftText}>{language === "es" ? "Asistente de redaccion" : "Drafting assistant"}</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Context Section */}
        <Pressable style={styles.workspaceAccordionBar} onPress={() => toggleWorkspaceSection("context")}>
          <Text style={styles.workspaceAccordionTitle}>{workspaceSectionMeta.context.title}</Text>
          <View style={styles.workspaceAccordionMetaWrap}>
            <Text style={styles.workspaceAccordionMeta}>{workspaceSectionMeta.context.summary}</Text>
            <Feather
              name={workspaceSectionOpen.context ? "chevron-up" : "chevron-down"}
              size={16}
              color={palette.subtle}
            />
          </View>
        </Pressable>
        {workspaceSectionOpen.context ? (
          <View style={styles.card}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>{language === "es" ? "Contexto del caso" : "Case context"}</Text>
              <Text style={styles.caseContextHint}>{language === "es" ? "Ayuda en cargas futuras" : "Helps future uploads"}</Text>
            </View>
            <Text style={styles.caseContextHelper}>
              {language === "es"
                ? "Agrega lo que no se ve en el documento (que paso, cuando, donde). Esto ayuda a mantener continuidad en cargas futuras."
                : "Add anything not visible in the document (what happened, when, where). This helps future uploads stay consistent."}
            </Text>
            <TextInput
              style={styles.caseContextInput}
              multiline
              value={caseContextDraft}
              onChangeText={setCaseContextDraft}
              placeholder={
                language === "es"
                  ? "Agrega lo que no se ve en el documento (que paso, cuando, donde)."
                  : "Add anything not visible in the document (what happened, when, where)."
              }
              placeholderTextColor={palette.subtle}
            />
            <Pressable
              onPress={() => void saveCaseContextForSelectedCase()}
              style={styles.outlineSoftBtn}
              disabled={savingCaseContext}
            >
              <Text style={styles.outlineSoftText}>
                {savingCaseContext ? (language === "es" ? "Guardando..." : "Saving...") : language === "es" ? "Guardar contexto del caso" : "Save case context"}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Category Section */}
        <Pressable style={styles.workspaceAccordionBar} onPress={() => toggleWorkspaceSection("category")}>
          <Text style={styles.workspaceAccordionTitle}>{workspaceSectionMeta.category.title}</Text>
          <View style={styles.workspaceAccordionMetaWrap}>
            <Text style={styles.workspaceAccordionMeta}>{workspaceSectionMeta.category.summary}</Text>
            <Feather
              name={workspaceSectionOpen.category ? "chevron-up" : "chevron-down"}
              size={16}
              color={palette.subtle}
            />
          </View>
        </Pressable>
        {workspaceSectionOpen.category ? (
          <View style={styles.card}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>{language === "es" ? "Categoria del documento" : "Document category"}</Text>
              <Text style={styles.caseContextHint}>{language === "es" ? "Ajuste manual" : "Manual fallback"}</Text>
            </View>
            <Text style={styles.cardBody}>
              {language === "es" ? "Actual:" : "Current:"}{" "}
              {manualCategoryLabel(selectedCase?.documentType ?? selectedCaseSummary?.documentType ?? null, language)}
            </Text>
            <Pressable
              onPress={openManualCategoryPicker}
              style={styles.outlineSoftBtn}
              disabled={!selectedCaseId || savingClassification}
            >
              <Text style={styles.outlineSoftText}>
                {savingClassification
                  ? language === "es"
                    ? "Guardando..."
                    : "Saving..."
                  : language === "es"
                    ? "Elegir o corregir categoria"
                    : "Choose or correct category"}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Summary Section */}
        <Pressable style={styles.workspaceAccordionBar} onPress={() => toggleWorkspaceSection("summary")}>
          <Text style={styles.workspaceAccordionTitle}>{workspaceSectionMeta.summary.title}</Text>
          <View style={styles.workspaceAccordionMetaWrap}>
            <Text style={styles.workspaceAccordionMeta}>{workspaceSectionMeta.summary.summary}</Text>
            <Feather
              name={workspaceSectionOpen.summary ? "chevron-up" : "chevron-down"}
              size={16}
              color={palette.subtle}
            />
          </View>
        </Pressable>
        {workspaceSectionOpen.summary ? (
          <View style={styles.card}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>{language === "es" ? "Resumen en lenguaje claro" : "Plain-language summary"}</Text>
              <Text style={styles.autoBadge}>{language === "es" ? "Automatico" : "Automated"}</Text>
            </View>
            <Text style={styles.cardBody}>{workspaceSummaryText}</Text>
            <Text style={styles.legalInline}>
              {selectedCase?.nonLegalAdviceDisclaimer ??
                (language === "es" ? "Solo contexto informativo. No asesoria legal." : "For informational context only. Not legal advice.")}
            </Text>
          </View>
        ) : null}

        {/* Deadline Candidates */}
        {timelineRows && timelineRows.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{language === "es" ? "Posibles plazos" : "Deadline candidates"}</Text>
            {timelineRows.slice(0, 3).map((row, i) => {
              const label = row.label ?? (language === "es" ? "Plazo" : "Deadline");
              const dateText = row.dateIso ? fmtDate(row.dateIso, language) : (language === "es" ? "Fecha desconocida" : "Unknown date");
              const days = row.daysRemaining;
              const daysText = days !== null
                ? ` · ${days === 0
                    ? (language === "es" ? "hoy" : "today")
                    : days === 1
                      ? (language === "es" ? "manana" : "tomorrow")
                      : days > 0
                        ? (language === "es" ? `en ${days} dias` : `in ${days} days`)
                        : (language === "es" ? `${Math.abs(days)} dias vencido` : `${Math.abs(days)} days overdue`)}`
                : "";
              return (
                <View key={`deadline-${i}`} style={styles.deadlineCandidateRow}>
                  <View style={styles.deadlineCandidateDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.deadlineCandidateLabel}>{label}</Text>
                    <Text style={styles.deadlineCandidateMeta}>{dateText}{daysText}</Text>
                    {Number.isFinite(row.confidence) && row.confidence !== null ? (
                      <Text style={styles.optionDesc}>
                        {language === "es" ? "Confianza" : "Confidence"}: {Math.round(row.confidence * 100)}%
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Plain Meaning Section */}
        <Pressable style={styles.workspaceAccordionBar} onPress={() => toggleWorkspaceSection("plain_meaning")}>
          <Text style={styles.workspaceAccordionTitle}>{workspaceSectionMeta.plain_meaning.title}</Text>
          <View style={styles.workspaceAccordionMetaWrap}>
            <Text style={styles.workspaceAccordionMeta}>{workspaceSectionMeta.plain_meaning.summary}</Text>
            <Feather
              name={workspaceSectionOpen.plain_meaning ? "chevron-up" : "chevron-down"}
              size={16}
              color={palette.subtle}
            />
          </View>
        </Pressable>
        {workspaceSectionOpen.plain_meaning ? (
          <View style={styles.card}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>
                {language === "es" ? "Vista de significado simple" : "Plain meaning view"}
              </Text>
              {plusEnabled ? (
                <View style={styles.plusLivePill}>
                  <Text style={styles.plusLivePillText}>{language === "es" ? "Activo" : "Active"}</Text>
                </View>
              ) : (
                <View style={styles.plusLockedPill}>
                  <Feather name="lock" size={10} color="#334155" />
                  <Text style={styles.plusLockedPillText}>{language === "es" ? "Plus" : "Plus"}</Text>
                </View>
              )}
            </View>
            <Text style={styles.cardBody}>
              {language === "es"
                ? "Compara texto original con significado simple, por que suele importar y elementos que muchas personas preparan para consulta."
                : "Compare original text with plain meaning, why it often matters, and items many people prepare for consultations."}
            </Text>
            <Pressable
              style={styles.outlineSoftBtn}
              onPress={() => void openPlainMeaningTranslator()}
              disabled={loadingPlainMeaning}
            >
              <Text style={styles.outlineSoftText}>
                {loadingPlainMeaning
                  ? language === "es"
                    ? "Cargando..."
                    : "Loading..."
                  : language === "es"
                    ? "Abrir vista de significado simple"
                    : "Open plain meaning view"}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Timeline Section */}
        <Pressable style={styles.workspaceAccordionBar} onPress={() => toggleWorkspaceSection("timeline")}>
          <Text style={styles.workspaceAccordionTitle}>{workspaceSectionMeta.timeline.title}</Text>
          <View style={styles.workspaceAccordionMetaWrap}>
            <Text style={styles.workspaceAccordionMeta}>{workspaceSectionMeta.timeline.summary}</Text>
            <Feather
              name={workspaceSectionOpen.timeline ? "chevron-up" : "chevron-down"}
              size={16}
              color={palette.subtle}
            />
          </View>
        </Pressable>
        {workspaceSectionOpen.timeline ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{language === "es" ? "Cronologia del caso" : "Case timeline"}</Text>
            {selectedCase ? (
              <>
                <Text style={styles.optionDesc}>
                  {language === "es" ? "Actualizado:" : "Updated:"} {fmtDateTime(selectedCase.updatedAt)}
                </Text>
                <Text style={styles.optionDesc}>
                  {language === "es" ? "Archivos" : "Assets"} {selectedCase.assets.length} |{" "}
                  {language === "es" ? "Extracciones" : "Extractions"} {selectedCase.extractions.length} |{" "}
                  {language === "es" ? "Veredictos" : "Verdicts"} {selectedCase.verdicts.length}
                </Text>
                {loadingCaseAssets ? <ActivityIndicator color={palette.primary} /> : null}
                {caseAssets.length === 0 ? (
                  <Text style={styles.cardBody}>
                    {language === "es"
                      ? "Aun no hay archivos listos para vista en este caso."
                      : "No uploaded assets are ready to view for this case yet."}
                  </Text>
                ) : (
                  caseAssets.slice(0, 12).map((asset) => (
                    <View key={`case-asset-${asset.id}`} style={styles.receiptRow}>
                      <Text style={styles.receiptTitle}>{asset.fileName}</Text>
                      <Text style={styles.receiptSub}>
                        {language === "es" ? "Tipo" : "Type"}: {asset.mimeType} |{" "}
                        {language === "es" ? "Origen" : "Source"}:{" "}
                        {asset.source === "camera"
                          ? language === "es"
                            ? "camara"
                            : "camera"
                          : language === "es"
                            ? "archivo"
                            : "file"}
                      </Text>
                      <Text style={styles.receiptSub}>
                        {language === "es" ? "Estado de procesamiento" : "Processing status"}:{" "}
                        {asset.processingStatus === "succeeded"
                          ? language === "es"
                            ? "completado"
                            : "succeeded"
                          : asset.processingStatus === "failed"
                            ? language === "es"
                              ? "fallido"
                              : "failed"
                            : language === "es"
                              ? "pendiente"
                              : "pending"}
                        . {language === "es" ? "Cargado" : "Uploaded"}: {fmtDateTime(asset.createdAt)}
                      </Text>
                      <View style={styles.premiumStepActions}>
                        <Pressable
                          style={styles.linkMiniBtn}
                          onPress={() => void openAssetAccess(asset.id, "view")}
                        >
                          <Text style={styles.linkMiniText}>{language === "es" ? "Abrir" : "Open"}</Text>
                        </Pressable>
                        <Pressable
                          style={styles.linkMiniBtn}
                          onPress={() => void openAssetAccess(asset.id, "download")}
                        >
                          <Text style={styles.linkMiniText}>{language === "es" ? "Descargar" : "Download"}</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))
                )}
              </>
            ) : (
              <Text style={styles.cardBody}>
                {language === "es" ? "Selecciona un caso para ver eventos detallados de la cronologia." : "Select a case to view detailed timeline events."}
              </Text>
            )}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
