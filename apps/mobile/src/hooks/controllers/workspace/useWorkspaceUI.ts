import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { LayoutAnimation, Platform } from "react-native";
import { manualCategoryLabel } from "../../../utils/case-logic";
import { titleize, clamp } from "../../../utils/formatting";
import { emptyIntakeDraft } from "../../../utils/parsing";
import { onboardingSlidesByLanguage } from "../../../data/onboarding-slides";
import type { IntakeDraft, PremiumStepGroup, StepProgress } from "../../../types";

export function useWorkspaceUI(ui: any, cases: any) {
  const language = ui.language;
  const plusEnabled = cases.me?.entitlement?.isPlus ?? false;
  const onboardingSlides = useMemo(() => onboardingSlidesByLanguage[ui.language as keyof typeof onboardingSlidesByLanguage], [ui.language]);

  const [workspaceSectionOpen, setWorkspaceSectionOpen] = useState<Record<string, boolean>>({
    steps: false, watch: false, packet: false, context: false, category: false, summary: false, plain_meaning: false, timeline: false
  });

  const workspaceSectionMeta = useMemo(() => {
    return {
      steps: {
        title: language === "es" ? "Pasos recomendados" : "Recommended next steps",
        summary: language === "es" ? "Checklist dinamico" : "Dynamic checklist"
      },
      watch: {
        title: language === "es" ? "Revision semanal del caso" : "Weekly case check-in",
        summary: plusEnabled ? (language === "es" ? "Plus activo" : "Plus active") : (language === "es" ? "Vista previa" : "Preview")
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
        summary: cases.selectedCase ? `${cases.selectedCase.assets.length} ${language === "es" ? "archivos" : "assets"}` : (language === "es" ? "Sin caso" : "No case")
      }
    } as const;
  }, [language, plusEnabled, cases.selectedCase?.assets.length, cases.selectedCase?.documentType, cases.selectedCaseSummary?.documentType]);

  const subtleSpring = { duration: 250, update: { type: "spring" as const, springDamping: 0.85 }, create: { type: "easeInEaseOut" as const, property: "opacity" as const }, delete: { type: "easeInEaseOut" as const, property: "opacity" as const } };

  const toggleWorkspaceSection = useCallback((key: string): void => {
    ui.hapticTap();
    LayoutAnimation.configureNext(subtleSpring);
    setWorkspaceSectionOpen((current) => ({
      ...current,
      [key]: !current[key]
    }));
  }, [ui.hapticTap]);

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
  const [assetViewerImageBounds, setAssetViewerImageBounds] = useState({ width: 320, height: 340 });
  const [assetViewerLoading, setAssetViewerLoading] = useState(false);
  const assetViewerImagePanRef = useRef({ x: 0, y: 0 });
  const assetViewerImagePanStartRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    assetViewerImagePanRef.current = assetViewerImagePan;
  }, [assetViewerImagePan]);

  useEffect(() => {
    setAssetViewerImagePan((current) => {
      const maxX = ((Math.max(assetViewerImageZoom, 1) - 1) * assetViewerImageBounds.width) / 2;
      const maxY = ((Math.max(assetViewerImageZoom, 1) - 1) * assetViewerImageBounds.height) / 2;
      const next = {
        x: clamp(current.x, -maxX, maxX),
        y: clamp(current.y, -maxY, maxY)
      };
      if (next.x === current.x && next.y === current.y) return current;
      return next;
    });
  }, [assetViewerImageBounds.height, assetViewerImageBounds.width, assetViewerImageZoom]);

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

  const setStepProgress = useCallback((stepId: string, next: StepProgress): void => {
    setStepProgressMap((current) => ({
      ...current,
      [stepId]: next
    }));
  }, []);

  const localizedCaseStatus = useCallback((value: string | null | undefined, lang: any = "en"): string => {
    const normalized = (value ?? "").trim().toLowerCase();
    if (!normalized) return lang === "es" ? "Abierto" : "Open";
    if (lang === "es") {
      if (normalized === "open") return "Abierto";
      if (normalized === "closed") return "Cerrado";
      if (normalized === "archived") return "Archivado";
      if (normalized === "pending") return "Pendiente";
      if (normalized === "in_progress") return "En progreso";
    }
    return titleize(normalized);
  }, []);

  const stepGroupLabel = useCallback((group: PremiumStepGroup): string => {
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
  }, [language]);

  const intakeSectionLabel = useCallback((key: keyof IntakeDraft): string => {
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
  }, [language]);

  const intakePlaceholder = useCallback((key: keyof IntakeDraft): string => {
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
  }, [language]);

  const accountInitials = useMemo(() => {
    const source = cases.me?.user.fullName?.trim() || ui.email.split("@")[0] || "CC";
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
    return (parts[0]?.slice(0, 2) ?? "CC").toUpperCase();
  }, [cases.me, ui.email]);

  const assetViewerIsPdf = useMemo(
    () => Boolean(assetViewerAsset?.mimeType?.toLowerCase().includes("pdf")),
    [assetViewerAsset?.mimeType]
  );
  const assetViewerIsImage = useMemo(
    () => Boolean(assetViewerAsset?.mimeType?.toLowerCase().includes("image") || assetViewerAsset?.assetType === "image"),
    [assetViewerAsset?.mimeType, assetViewerAsset?.assetType]
  );

  const buildViewerUrlWithPdfControls = useCallback((url: string, p: number, z: number) => {
    if (!url.includes(".pdf")) return url;
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}page=${p}&zoom=${z}`;
  }, []);

  const assetViewerRenderUrl = useMemo(() => {
    if (!assetViewerUrl) return null;
    if (!assetViewerIsPdf) return assetViewerUrl;
    return buildViewerUrlWithPdfControls(assetViewerUrl, assetViewerPdfPage, assetViewerPdfZoom);
  }, [assetViewerUrl, assetViewerIsPdf, assetViewerPdfPage, assetViewerPdfZoom, buildViewerUrlWithPdfControls]);

  const closeAssetViewer = useCallback(() => setAssetViewerOpen(false), []);

  const casePriorityLevel = useCallback((row: any): "high" | "medium" | "low" => {
    if (row.timeSensitive) return "high";
    if (row.earliestDeadline) return "medium";
    return "low";
  }, []);

  const casePriorityLabel = useCallback((row: any, lang: any = "en"): string => {
    const level = casePriorityLevel(row);
    if (lang === "es") {
      if (level === "high") return "Alta";
      if (level === "medium") return "Media";
      return "Baja";
    }
    if (level === "high") return "High";
    if (level === "medium") return "Medium";
    return "Low";
  }, [casePriorityLevel]);

  return useMemo(() => ({
    plusEnabled, onboardingSlides,
    workspaceSectionOpen, setWorkspaceSectionOpen,
    workspaceSectionMeta, toggleWorkspaceSection,
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
    stepProgressMap, setStepProgressMap, setStepProgress,
    intakeModalOpen, setIntakeModalOpen,
    consultLinks, setConsultLinks,
    loadingConsultLinks, setLoadingConsultLinks,
    creatingConsultLink, setCreatingConsultLink,
    disablingConsultToken, setDisablingConsultToken,
    legalReturnScreen: ui.legalReturnScreen, setLegalReturnScreen: ui.setLegalReturnScreen,
    legalAidSearch: ui.legalAidSearch, setLegalAidSearch: ui.setLegalAidSearch,
    selectedTemplate: ui.selectedTemplate, setSelectedTemplate: ui.setSelectedTemplate,
    pushEnabled: ui.pushEnabled, setPushEnabled: ui.setPushEnabled,
    pushQuietHoursEnabled: ui.pushQuietHoursEnabled, setPushQuietHoursEnabled: ui.setPushQuietHoursEnabled,
    savingPushPreferences: ui.savingPushPreferences, setSavingPushPreferences: ui.setSavingPushPreferences,
    localizedCaseStatus, stepGroupLabel, intakeSectionLabel, intakePlaceholder,
    accountInitials, assetViewerIsPdf, assetViewerIsImage, assetViewerRenderUrl,
    closeAssetViewer, buildViewerUrlWithPdfControls,
    casePriorityLevel, casePriorityLabel
  }), [
    plusEnabled, onboardingSlides, workspaceSectionOpen, workspaceSectionMeta, toggleWorkspaceSection,
    caseContextDraft, classificationDraft, classificationSheetOpen, savingClassification,
    savingCaseContext, savingWatchMode, assetViewerOpen, assetViewerAsset, assetViewerUrl,
    assetViewerPdfPage, assetViewerPdfZoom, assetViewerImageZoom, assetViewerImagePan,
    assetViewerImageBounds, assetViewerLoading, plainMeaningOpen, loadingPlainMeaning,
    plainMeaningRows, plainMeaningBoundary, intakeDraft, stepProgressMap, setStepProgress, intakeModalOpen,
    consultLinks, loadingConsultLinks, creatingConsultLink, disablingConsultToken,
    ui.legalReturnScreen, ui.legalAidSearch, ui.selectedTemplate, ui.pushEnabled, 
    ui.pushQuietHoursEnabled, ui.savingPushPreferences,
    localizedCaseStatus, stepGroupLabel, intakeSectionLabel, intakePlaceholder,
    accountInitials, assetViewerIsPdf, assetViewerIsImage, assetViewerRenderUrl,
    closeAssetViewer, buildViewerUrlWithPdfControls,
    casePriorityLevel, casePriorityLabel
  ]);
}
