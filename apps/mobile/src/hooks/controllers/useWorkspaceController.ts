import { useMemo, useState, useRef } from "react";
import { Alert, LayoutAnimation, Share, Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { 
  getCaseAssetAccess, 
  getConsultPacketLinks, 
  getPlainMeaning, 
  saveCaseContext, 
  setCaseClassification, 
  setCaseWatchMode,
  createConsultPacketLink,
  disableConsultPacketLink,
  finalizeAssetUpload
} from "../../api";
import { 
  deriveCaseSeverity, 
  fallbackSummaryForDocumentType, 
  buildRecommendedNextSteps, 
  manualCategoryLabel,
  isManualDocumentType 
} from "../../utils/case-logic";
import { 
  clamp, 
  fmtDate, 
  fmtDateTime, 
  localizedConfidenceLabel, 
  titleize,
  confidenceLabel 
} from "../../utils/formatting";
import { 
  asRecord, 
  asStringArray, 
  emptyIntakeDraft, 
  intakeStorageKey, 
  parseIntakeDraft, 
  parseStepProgress, 
  stepStatusStorageKey 
} from "../../utils/parsing";
import { 
  withNetworkHint, 
  isPlusRequiredApiError, 
  parseFreeLimitApiError, 
  isFreeOcrDisabledApiError, 
  formatLimitResetAt 
} from "../../utils/error-helpers";
import type { IntakeDraft, PacketHistoryEntry, PremiumStepGroup, StepProgress } from "../../types";
import { onboardingSlidesByLanguage } from "../../data/onboarding-slides";

export function useWorkspaceController(ui: any, cases: any) {
  const { language, plusEnabled, onboardingSlides } = useMemo(() => ({
    language: ui.language,
    plusEnabled: cases.me?.entitlement?.isPlus ?? false,
    onboardingSlides: onboardingSlidesByLanguage[ui.language as keyof typeof onboardingSlidesByLanguage]
  }), [ui.language, cases.me?.entitlement?.isPlus]);

  const activeDocumentType = useMemo(
    () => cases.selectedCase?.documentType ?? cases.selectedCaseSummary?.documentType ?? null,
    [cases.selectedCase?.documentType, cases.selectedCaseSummary?.documentType]
  );
  const activeEarliestDeadline = useMemo(
    () => cases.selectedCase?.earliestDeadline ?? cases.selectedCaseSummary?.earliestDeadline ?? null,
    [cases.selectedCase?.earliestDeadline, cases.selectedCaseSummary?.earliestDeadline]
  );
  const activeTimeSensitive = useMemo(
    () => cases.selectedCase?.timeSensitive ?? cases.selectedCaseSummary?.timeSensitive ?? false,
    [cases.selectedCase?.timeSensitive, cases.selectedCaseSummary?.timeSensitive]
  );
  const workspaceSeverity = useMemo(
    () => deriveCaseSeverity(activeDocumentType, activeTimeSensitive, activeEarliestDeadline),
    [activeDocumentType, activeTimeSensitive, activeEarliestDeadline]
  );
  const workspaceSummaryText = useMemo(() => {
    const value = cases.selectedCase?.plainEnglishExplanation?.trim();
    if (language === "en" && value) return value;
    return fallbackSummaryForDocumentType(activeDocumentType, language);
  }, [cases.selectedCase?.plainEnglishExplanation, activeDocumentType, language]);
  const workspaceNextSteps = useMemo(
    () => buildRecommendedNextSteps(activeDocumentType, activeEarliestDeadline, language),
    [activeDocumentType, activeEarliestDeadline, language]
  );

  const [workspaceSectionOpen, setWorkspaceSectionOpen] = useState<Record<string, boolean>>({
    steps: false,
    watch: false,
    packet: false,
    context: false,
    category: false,
    summary: false,
    plain_meaning: false,
    timeline: false
  });

  const workspaceSectionMeta = useMemo(() => {
    return {
      steps: {
        title: language === "es" ? "Pasos recomendados" : "Recommended next steps",
        summary: language === "es" ? "Checklist dinamico" : "Dynamic checklist"
      },
      watch: {
        title: language === "es" ? "Revision semanal del caso" : "Weekly case check-in",
        summary: plusEnabled
          ? (language === "es" ? "Plus activo" : "Plus active")
          : (language === "es" ? "Vista previa" : "Preview")
      },
      context: {
        title: language === "es" ? "Contexto del caso" : "Case context",
        summary: language === "es" ? "Ayuda en cargas futuras" : "Helps future uploads"
      },
      packet: {
        title: language === "es" ? "Paquete para consulta con abogado" : "Lawyer prep packet",
        summary: language === "es" ? "Intake + paquete" : "Intake + packet"
      },
      category: {
        title: language === "es" ? "Categoria del documento" : "Document category",
        summary: manualCategoryLabel(cases.selectedCase?.documentType ?? cases.selectedCaseSummary?.documentType ?? null, language)
      },
      summary: {
        title: language === "es" ? "Resumen en lenguaje claro" : "Plain-language summary",
        summary: language === "es" ? "Automatico" : "Automated"
      },
      plain_meaning: {
        title: language === "es" ? "Vista de significado simple" : "Plain meaning view",
        summary: plusEnabled ? (language === "es" ? "Plus activo" : "Plus active") : "Plus"
      },
      timeline: {
        title: language === "es" ? "Cronologia del caso" : "Case timeline",
        summary: cases.selectedCase
          ? `${cases.selectedCase.assets.length} ${language === "es" ? "archivos" : "assets"}`
          : (language === "es" ? "Sin caso" : "No case")
      }
    } as const;
  }, [language, plusEnabled, cases.selectedCase?.assets.length, cases.selectedCase?.documentType, cases.selectedCaseSummary?.documentType]);

  const subtleSpring = { duration: 250, update: { type: "spring" as const, springDamping: 0.85 }, create: { type: "easeInEaseOut" as const, property: "opacity" as const }, delete: { type: "easeInEaseOut" as const, property: "opacity" as const } };

  function toggleWorkspaceSection(key: string): void {
    ui.hapticTap();
    LayoutAnimation.configureNext(subtleSpring);
    setWorkspaceSectionOpen((current) => ({
      ...current,
      [key]: !current[key]
    }));
  }

  const classificationConfidenceValue = useMemo(
    () => cases.selectedCase?.classificationConfidence ?? cases.selectedCaseSummary?.classificationConfidence ?? null,
    [cases.selectedCase?.classificationConfidence, cases.selectedCaseSummary?.classificationConfidence]
  );

  const [caseContextDraft, setCaseContextDraft] = useState("");
  const [classificationDraft, setClassificationDraft] = useState<string>("unknown_legal_document");
  const [classificationSheetOpen, setClassificationSheetOpen] = useState(false);
  const [savingClassification, setSavingClassification] = useState(false);
  const [savingCaseContext, setSavingCaseContext] = useState(false);
  const [savingWatchMode, setSavingWatchMode] = useState(false);

  // Asset Viewer
  const [assetViewerOpen, setAssetViewerOpen] = useState(false);
  const [assetViewerAsset, setAssetViewerAsset] = useState<any>(null);
  const [assetViewerUrl, setAssetViewerUrl] = useState<string | null>(null);
  const [assetViewerPdfPage, setAssetViewerPdfPage] = useState(1);
  const [assetViewerPdfZoom, setAssetViewerPdfZoom] = useState(100);
  const [assetViewerImageZoom, setAssetViewerImageZoom] = useState(1);
  const [assetViewerImagePan, setAssetViewerImagePan] = useState({ x: 0, y: 0 });
  const [assetViewerImageBounds, setAssetViewerImageBounds] = useState({ width: 1, height: 1 });
  const [assetViewerLoading, setAssetViewerLoading] = useState(false);
  const assetViewerImagePanRef = useRef({ x: 0, y: 0 });
  const assetViewerImagePanStartRef = useRef({ x: 0, y: 0 });

  // Plain Meaning
  const [plainMeaningOpen, setPlainMeaningOpen] = useState(false);
  const [loadingPlainMeaning, setLoadingPlainMeaning] = useState(false);
  const [plainMeaningRows, setPlainMeaningRows] = useState<any[]>([]);
  const [plainMeaningBoundary, setPlainMeaningBoundary] = useState("");

  // Intake / Step Progress
  const [intakeDraft, setIntakeDraft] = useState<IntakeDraft>(emptyIntakeDraft());
  const [stepProgressMap, setStepProgressMap] = useState<Record<string, StepProgress>>({});
  const [intakeModalOpen, setIntakeModalOpen] = useState(false);

  // Consult Links
  const [consultLinks, setConsultLinks] = useState<any[]>([]);
  const [loadingConsultLinks, setLoadingConsultLinks] = useState(false);
  const [creatingConsultLink, setCreatingConsultLink] = useState(false);
  const [disablingConsultToken, setDisablingConsultToken] = useState<string | null>(null);

  // Helpers moved from useAppController
  function localizedCaseStatus(value: string | null | undefined, language: any = "en"): string {
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

  function stepGroupLabel(group: PremiumStepGroup): string {
    if (language === "es") {
      if (group === "now") return "Ahora";
      if (group === "this_week") return "Esta semana";
      if (group === "before_consult") return "Antes de consulta";
      return "Despues de nueva carga";
    }
    if (group === "now") return "Now";
    if (group === "this_week") return "This week";
    if (group === "before_consult") return "Before consult";
    return "After new upload";
  }

  function intakeSectionLabel(key: keyof IntakeDraft): string {
    const labelsEn: Record<keyof IntakeDraft, string> = {
      matterSummary: "Matter Summary", clientGoals: "Client Goals", constraints: "Constraints",
      timelineNarrative: "Timeline Narrative", partiesAndRoles: "Parties and Roles",
      communicationsLog: "Communications Log", financialImpact: "Financial Impact",
      questionsForCounsel: "Questions for Counsel", desiredOutcome: "Desired Outcome"
    };
    const labelsEs: Record<keyof IntakeDraft, string> = {
      matterSummary: "Resumen del asunto", clientGoals: "Objetivos de la persona", constraints: "Restricciones",
      timelineNarrative: "Cronologia narrativa", partiesAndRoles: "Partes y roles",
      communicationsLog: "Registro de comunicaciones", financialImpact: "Impacto financiero",
      questionsForCounsel: "Preguntas para asesoria", desiredOutcome: "Resultado deseado"
    };
    return language === "es" ? labelsEs[key] : labelsEn[key];
  }

  function intakePlaceholder(key: keyof IntakeDraft): string {
    if (language === "es") {
      const labelsEs: Record<keyof IntakeDraft, string> = {
        matterSummary: "Describe el asunto en 3-5 lineas y su estado actual.",
        clientGoals: "Que resultado te gustaria obtener en consulta.",
        constraints: "Tiempo, presupuesto, idioma, disponibilidad u otras limitaciones.",
        timelineNarrative: "Linea de tiempo breve (eventos y fechas aproximadas).",
        partiesAndRoles: "Quien esta involucrado y que relacion tiene con el caso.",
        communicationsLog: "Mensajes o llamadas importantes y fechas aproximadas.",
        financialImpact: "Costos, perdidas, cobros o montos discutidos.",
        questionsForCounsel: "Preguntas que te gustaria cubrir durante la consulta.",
        desiredOutcome: "Como se veria un resultada razonable para ti."
      };
      return labelsEs[key];
    }
    const labelsEn: Record<keyof IntakeDraft, string> = {
      matterSummary: "Describe the matter in 3-5 lines and current state.",
      clientGoals: "What outcome would you like from consultation.",
      constraints: "Time, budget, language, availability, or other limits.",
      timelineNarrative: "Short timeline narrative (events and approximate dates).",
      partiesAndRoles: "Who is involved and each role in the matter.",
      communicationsLog: "Important messages/calls and approximate dates.",
      financialImpact: "Costs, losses, claims, or amounts in dispute.",
      questionsForCounsel: "Questions you want to cover during consultation.",
      desiredOutcome: "What a reasonable outcome would look like for you."
    };
    return labelsEn[key];
  }

  // Derived Workspace Values
  const latestVerdictOutput = useMemo(
    () => asRecord(cases.selectedCase?.verdicts?.[0]?.outputJson),
    [cases.selectedCase?.verdicts]
  );

  const deadlineSignals = useMemo(() => {
    const deadlines = asRecord(latestVerdictOutput?.deadlines);
    const signalRows = Array.isArray(deadlines?.signals) ? deadlines?.signals : [];
    return signalRows
      .map((row) => asRecord(row))
      .filter((row): row is Record<string, unknown> => Boolean(row))
      .map((row) => ({
        kind: typeof row.kind === "string" ? row.kind : "signal",
        sourceText: typeof row.sourceText === "string" ? row.sourceText : "Detected signal",
        confidence: typeof row.confidence === "number" ? row.confidence : null,
        dateIso: typeof row.dateIso === "string" ? row.dateIso : null
      }));
  }, [latestVerdictOutput]);

  const uncertaintyNotes = useMemo(() => {
    const uncertainty = asRecord(latestVerdictOutput?.uncertainty);
    return asStringArray(uncertainty?.notes);
  }, [latestVerdictOutput]);

  const topUncertaintyNote = useMemo(
    () => uncertaintyNotes[0] ?? (language === "es" ? "No se detectaron senales de incertidumbre importantes." : "No major uncertainty flags detected."),
    [uncertaintyNotes, language]
  );

  const deadlineGuardReminders = useMemo(() => {
    const deadlineGuard = asRecord(latestVerdictOutput?.deadlineGuard);
    const reminders = Array.isArray(deadlineGuard?.reminders) ? deadlineGuard?.reminders : [];
    return reminders
      .map((row) => asRecord(row))
      .filter((row): row is Record<string, unknown> => Boolean(row))
      .map((row) => ({
        label: typeof row.label === "string" ? row.label : "Reminder",
        reminderDateIso: typeof row.reminderDateIso === "string" ? row.reminderDateIso : null
      }))
      .filter((row) => Boolean(row.reminderDateIso));
  }, [latestVerdictOutput]);

  const reminderScheduleLine = useMemo(() => {
    if (deadlineGuardReminders.length === 0) return language === "es" ? "Sin calendario de recordatorios." : "No reminder schedule.";
    return language === "es" ? `Calendario activo con ${deadlineGuardReminders.length} hitos.` : `Reminder schedule active with ${deadlineGuardReminders.length} milestones.`;
  }, [deadlineGuardReminders.length, language]);

  const evidenceChecklist = useMemo(() => asStringArray(latestVerdictOutput?.evidenceToGather), [latestVerdictOutput]);

  const evidenceCompleteness = useMemo(() => {
    const assetsCount = cases.selectedCase?.assets.length ?? cases.selectedCaseSummary?._count?.assets ?? 0;
    const hasContext = Boolean(caseContextDraft.trim());
    const hasDeadline = Boolean(activeEarliestDeadline);
    const hasStrongClassification = (cases.selectedCase?.classificationConfidence ?? cases.selectedCaseSummary?.classificationConfidence ?? 0) >= 0.6;
    const checks = [assetsCount >= 1, assetsCount >= 2, hasContext, hasDeadline || hasStrongClassification];
    const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
    return { score, status: score >= 70 ? "Sufficient" : "Incomplete", missing: [] };
  }, [cases.selectedCase?.assets.length, cases.selectedCaseSummary?._count?.assets, caseContextDraft, activeEarliestDeadline]);

  const lawyerReadySummary = useMemo(() => {
    return {
      caseTitle: cases.selectedCase?.title ?? "Untitled",
      summary: workspaceSummaryText,
      facts: [],
      dates: [],
      parties: [],
      openQuestions: [],
      evidence: [],
      intakeOverview: [],
      communicationsLog: intakeDraft.communicationsLog,
      financialImpact: intakeDraft.financialImpact,
      desiredOutcome: intakeDraft.desiredOutcome,
      consultAgenda: [],
      nextSteps: workspaceNextSteps,
      disclaimer: "Informational only."
    };
  }, [cases.selectedCase?.title, workspaceSummaryText, workspaceNextSteps, intakeDraft]);

  const readinessSnapshots = useMemo(() => {
    const rows = cases.selectedCase?.auditLogs ?? [];
    return rows.map((r: any) => ({ createdAt: r.createdAt, score: 0 })).filter(Boolean);
  }, [cases.selectedCase?.auditLogs]);

  const readinessTrajectory = useMemo(() => ({ start: 0, end: 0, delta: 0, days: 0, message: "" }), []);
  const weeklyAssuranceData = useMemo(() => ({ message: "No changes.", receiptCount: 0, confidence: "low", uncertainty: "" }), []);
  const caseWatchEnabled = useMemo(() => false, []);
  const packetHistoryEntries = useMemo(() => [], []);
  const watchMicroEvents = useMemo(() => [], []);
  const watchStatusLine = useMemo(() => "", []);
  const weeklyCheckInStatus = useMemo(() => "", []);
  const weeklyCheckInAction = useMemo(() => "", []);
  const packetShareStatusLine = useMemo(() => "", []);
  const intakeCompleteness = useMemo(() => 0, []);
  const costSavingIndicator = useMemo(() => ({ low: 0, high: 0, confidence: "low", message: "", assumptions: "" }), []);
  const groupedPremiumSteps = useMemo(() => ({ now: [], this_week: [], before_consult: [], after_upload: [] }), []);
  const workspaceChecklistItems = useMemo(() => [], []);
  const premiumStepSummaryLine = useMemo(() => "", []);
  const accountInitials = useMemo(() => "CC", []);
  const assetViewerIsPdf = useMemo(() => false, []);
  const assetViewerIsImage = useMemo(() => false, []);
  const assetViewerRenderUrl = useMemo(() => null, []);

  // Methods
  async function toggleCaseWatchMode() { ui.promptPlusUpgrade("watch_mode"); }
  async function loadConsultPacketLinks(id: string) {}
  async function createConsultPacketShareLink() {}
  async function disableConsultPacketShareLink(id: string) {}
  function buildLawyerReadySummaryText() { return ""; }
  async function shareLawyerReadySummary() {}
  async function emailLawyerReadySummary() {}
  function closeAssetViewer() { setAssetViewerOpen(false); }
  function buildViewerUrlWithPdfControls(url: string, p: number, z: number) { return url; }
  async function openViewerUrlExternally() {}
  async function openAssetAccess(id: string, action: string) {}
  async function openPlainMeaningTranslator() {}
  async function saveCaseContextForSelectedCase() {}
  function openManualCategoryPicker() { setClassificationSheetOpen(true); }
  async function saveManualCategoryForSelectedCase() {}

  return {
    workspaceSeverity, workspaceSummaryText, workspaceNextSteps,
    workspaceSectionOpen, setWorkspaceSectionOpen,
    workspaceSectionMeta, toggleWorkspaceSection,
    classificationConfidenceValue,
    caseContextDraft, setCaseContextDraft,
    classificationDraft, setClassificationDraft,
    classificationSheetOpen, setClassificationSheetOpen,
    savingClassification, setSavingClassification,
    savingCaseContext, setSavingCaseContext,
    savingWatchMode, setSavingWatchMode,
    assetViewerOpen, setAssetViewerOpen,
    assetViewerAsset, setAssetViewerAsset,
    assetViewerUrl, setAssetViewerUrl,
    assetViewerPdfPage, setAssetViewerPdfPage,
    assetViewerPdfZoom, setAssetViewerPdfZoom,
    assetViewerImageZoom, setAssetViewerImageZoom,
    assetViewerImagePan, setAssetViewerImagePan,
    assetViewerImageBounds, setAssetViewerImageBounds,
    assetViewerLoading, setAssetViewerLoading,
    assetViewerImagePanRef, assetViewerImagePanStartRef,
    plainMeaningOpen, setPlainMeaningOpen,
    loadingPlainMeaning, setLoadingPlainMeaning,
    plainMeaningRows, setPlainMeaningRows,
    plainMeaningBoundary, setPlainMeaningBoundary,
    intakeDraft, setIntakeDraft,
    stepProgressMap, setStepProgressMap,
    intakeModalOpen, setIntakeModalOpen,
    consultLinks, setConsultLinks,
    loadingConsultLinks, setLoadingConsultLinks,
    creatingConsultLink, setCreatingConsultLink,
    disablingConsultToken, setDisablingConsultToken,
    localizedCaseStatus, stepGroupLabel, intakeSectionLabel, intakePlaceholder,
    plusEnabled, onboardingSlides, activeDocumentType, activeEarliestDeadline,
    activeTimeSensitive, lawyerReadySummary, latestVerdictOutput,
    deadlineSignals, uncertaintyNotes, deadlineGuardReminders,
    reminderScheduleLine, evidenceChecklist, evidenceCompleteness,
    readinessSnapshots, readinessTrajectory, weeklyAssuranceData,
    topUncertaintyNote, caseWatchEnabled, packetHistoryEntries,
    watchMicroEvents, watchStatusLine, weeklyCheckInStatus,
    weeklyCheckInAction, packetShareStatusLine, intakeCompleteness,
    costSavingIndicator, premiumActionSteps: [], // TODO: map from steps
    groupedPremiumSteps, workspaceChecklistItems,
    premiumStepSummaryLine, accountInitials, assetViewerIsPdf,
    assetViewerIsImage, assetViewerRenderUrl,
    toggleCaseWatchMode, loadConsultPacketLinks, createConsultPacketShareLink,
    disableConsultPacketShareLink, buildLawyerReadySummaryText,
    shareLawyerReadySummary, emailLawyerReadySummary, closeAssetViewer,
    buildViewerUrlWithPdfControls, openViewerUrlExternally,
    openAssetAccess, openPlainMeaningTranslator,
    saveCaseContextForSelectedCase, openManualCategoryPicker,
    saveManualCategoryForSelectedCase
  };
}
