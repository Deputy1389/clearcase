import { useMemo } from "react";
import { asRecord, asStringArray } from "../../../utils/parsing";
import { fmtDate, fmtDateTime, localizedConfidenceLabel } from "../../../utils/formatting";
import type { AppLanguage, PacketHistoryEntry, PremiumActionStep, PremiumStepGroup } from "../../../types";

function extractCaseWatchModeFromAuditLogs(auditLogs: Array<{ payload: unknown }> | undefined): boolean {
  if (!auditLogs || auditLogs.length === 0) return false;
  for (const row of auditLogs) {
    if (!row.payload || typeof row.payload !== "object" || Array.isArray(row.payload)) {
      continue;
    }
    const payload = row.payload as Record<string, unknown>;
    if (payload.subtype !== "case_watch_mode_set") continue;
    if (typeof payload.enabled === "boolean") {
      return payload.enabled;
    }
  }
  return false;
}

function buildPacketHistoryEntries(
  auditLogs: Array<{ eventType: string; createdAt: string; payload: unknown }> | undefined,
  language: AppLanguage
): PacketHistoryEntry[] {
  if (!auditLogs || auditLogs.length === 0) return [];

  const rows = [...auditLogs].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const history: PacketHistoryEntry[] = [];

  for (const row of rows) {
    const payload = asRecord(row.payload);
    const subtype = typeof payload?.subtype === "string" ? payload.subtype : "";

    if (subtype === "asset_uploaded_enqueued") {
      history.push({
        version: history.length + 1,
        reason:
          history.length === 0
            ? language === "es"
              ? "carga inicial"
              : "initial upload"
            : language === "es"
              ? "despues de nueva carga"
              : "after new upload",
        createdAt: row.createdAt
      });
      continue;
    }

    if (subtype === "case_context_set") {
      history.push({
        version: history.length + 1,
        reason: language === "es" ? "despues de agregar contexto" : "after context added",
        createdAt: row.createdAt
      });
      continue;
    }

    if (subtype === "manual_document_type_set") {
      history.push({
        version: history.length + 1,
        reason: language === "es" ? "despues de actualizar categoria" : "after category update",
        createdAt: row.createdAt
      });
    }
  }

  return history.slice(-8);
}

export function useWorkspaceTimeline(ui: any, cases: any, summary: any, uiState: any) {
  const language = ui.language;
  const plusEnabled = uiState.plusEnabled;

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
    const hasContext = Boolean(uiState.caseContextDraft.trim());
    const hasDeadline = Boolean(summary.activeEarliestDeadline);
    const hasStrongClassification = (summary.classificationConfidenceValue ?? 0) >= 0.6;
    const checks = [assetsCount >= 1, assetsCount >= 2, hasContext, hasDeadline || hasStrongClassification];
    const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
    return { score, status: score >= 70 ? "Sufficient" : "Incomplete", missing: [] };
  }, [cases.selectedCase?.assets.length, cases.selectedCaseSummary?._count?.assets, uiState.caseContextDraft, summary.activeEarliestDeadline, summary.classificationConfidenceValue]);

  const readinessSnapshots = useMemo(() => {
    const rows = cases.selectedCase?.auditLogs ?? [];
    return rows.map((r: any) => ({ createdAt: r.createdAt, score: 0 })).filter(Boolean);
  }, [cases.selectedCase?.auditLogs]);

  const readinessTrajectory = useMemo(() => {
    if (readinessSnapshots.length === 0) {
      return {
        start: evidenceCompleteness.score,
        end: evidenceCompleteness.score,
        delta: 0,
        days: 0,
        message: language === "es" ? "La linea base de preparacion del caso esta disponible." : "Case readiness baseline is available."
      };
    }
    const first = readinessSnapshots[0];
    const last = readinessSnapshots[readinessSnapshots.length - 1];
    return {
      start: first.score,
      end: last.score,
      delta: last.score - first.score,
      days: 0,
      message: language === "es" ? "Historial de progreso disponible." : "Progress history available."
    };
  }, [readinessSnapshots, evidenceCompleteness.score, language]);

  const caseWatchEnabled = useMemo(
    () => extractCaseWatchModeFromAuditLogs(cases.selectedCase?.auditLogs),
    [cases.selectedCase?.auditLogs]
  );

  const packetHistoryEntries = useMemo(
    () => buildPacketHistoryEntries(cases.selectedCase?.auditLogs, language),
    [cases.selectedCase?.auditLogs, language]
  );

  const watchMicroEvents = useMemo(() => {
    if (!caseWatchEnabled) return [];
    const events: string[] = [];
    events.push(
      language === "es"
        ? `Cronologia actualizada: ${fmtDateTime(cases.selectedCase?.updatedAt ?? new Date().toISOString())}.`
        : `Timeline updated: ${fmtDateTime(cases.selectedCase?.updatedAt ?? new Date().toISOString())}.`
    );
    return events;
  }, [caseWatchEnabled, cases.selectedCase?.updatedAt, language]);

  const watchStatusLine = useMemo(() => {
    if (!caseWatchEnabled) return language === "es" ? "Revision semanal desactivada." : "Weekly check-in disabled.";
    return language === "es" ? "Revision semanal activa. Se notificara ante cambios." : "Weekly check-in active. You will be notified of changes.";
  }, [caseWatchEnabled, language]);

  const packetShareStatusLine = useMemo(() => {
    return language === "es" ? "Listo para compartir con asesoria legal." : "Ready to share with legal counsel.";
  }, [language]);

  const intakeSections = useMemo(() => [
    uiState.intakeDraft.matterSummary,
    uiState.intakeDraft.clientGoals,
    uiState.intakeDraft.constraints,
    uiState.intakeDraft.timelineNarrative,
    uiState.intakeDraft.partiesAndRoles,
    uiState.intakeDraft.communicationsLog,
    uiState.intakeDraft.financialImpact,
    uiState.intakeDraft.questionsForCounsel,
    uiState.intakeDraft.desiredOutcome
  ], [uiState.intakeDraft]);

  const intakeCompleteness = useMemo(() => {
    const total = intakeSections.length;
    const completed = intakeSections.filter((row) => row.trim().length >= 8).length;
    return Math.round((completed / total) * 100);
  }, [intakeSections]);

  const costSavingIndicator = useMemo(() => {
    const readinessWeight = readinessTrajectory.end / 100;
    const intakeWeight = intakeCompleteness / 100;
    const evidenceWeight = evidenceCompleteness.score / 100;
    const stepsDoneWeight = Object.values(uiState.stepProgressMap).length > 0 ? Object.values(uiState.stepProgressMap).filter((v) => v === "done").length / Math.max(1, Object.keys(uiState.stepProgressMap).length) : 0;
    const minutesSaved = Math.round(12 + readinessWeight * 18 + intakeWeight * 22 + evidenceWeight * 15 + stepsDoneWeight * 14);
    const low = Math.max(8, minutesSaved - 8);
    const high = Math.min(95, minutesSaved + 12);
    const confidence = intakeCompleteness >= 75 && evidenceCompleteness.score >= 70 ? "high" : intakeCompleteness >= 45 ? "medium" : "low";
    const message = language === "es" ? `Ahorro estimado en preparacion de consulta: ${low}-${high} minutos.` : `Estimated consultation prep time saved: ${low}-${high} minutes.`;
    const assumptions = language === "es" ? "Basado en integridad de evidencia, completitud de intake y continuidad de cronologia." : "Based on evidence completeness, intake completeness, and timeline continuity.";
    return { low, high, confidence, message, assumptions };
  }, [readinessTrajectory.end, intakeCompleteness, evidenceCompleteness.score, uiState.stepProgressMap, language]);

  const premiumActionSteps = useMemo((): PremiumActionStep[] => {
    const steps: PremiumActionStep[] = [];
    const caseIdReceipt = cases.selectedCase?.id ?? cases.selectedCaseSummary?.id ?? "case";

    if (summary.activeEarliestDeadline) {
      steps.push({
        id: "now-calendar-deadline",
        group: "now",
        title: language === "es" ? "Guarda esta fecha en tu calendario" : "Add this date to your calendar",
        detail: language === "es" ? `Agregar la fecha ${fmtDate(summary.activeEarliestDeadline, language)} al calendario ayuda a mantener continuidad.` : `Adding ${fmtDate(summary.activeEarliestDeadline, language)} to your calendar helps maintain continuity.`,
        consequenceIfIgnored: language === "es" ? "Si se pospone, muchas personas observan menos margen para organizar documentos antes de responder." : "If delayed, many people see less time to organize records before responding.",
        effort: language === "es" ? "Bajo" : "Low",
        receipts: [`${caseIdReceipt}-cal`],
        confidence: "high"
      });
    }
    return steps;
  }, [cases.selectedCase?.id, cases.selectedCaseSummary?.id, language, summary.activeEarliestDeadline]);

  const groupedPremiumSteps = useMemo(() => {
    const groups: Record<PremiumStepGroup, PremiumActionStep[]> = {
      now: [],
      this_week: [],
      before_consult: [],
      after_upload: []
    };
    for (const step of premiumActionSteps) {
      groups[step.group].push(step);
    }
    return groups;
  }, [premiumActionSteps]);

  const premiumStepSummaryLine = useMemo(() => {
    if (!plusEnabled) return null;
    if (language === "es") {
      return `${premiumActionSteps.length} pasos dinamicos disponibles con consecuencias, comprobantes y confianza.`;
    }
    return `${premiumActionSteps.length} dynamic steps available with consequences, receipts, and confidence.`;
  }, [plusEnabled, language, premiumActionSteps.length]);

  const weeklyAssuranceData = useMemo(() => ({ message: "No changes.", receiptCount: 0, confidence: "low" as const, uncertainty: "" }), []);
  const weeklyCheckInStatus = useMemo(() => "", []);
  const weeklyCheckInAction = useMemo(() => "", []);
  const workspaceChecklistItems = useMemo(() => [], []);

  return useMemo(() => ({
    latestVerdictOutput,
    deadlineSignals,
    uncertaintyNotes,
    topUncertaintyNote,
    deadlineGuardReminders,
    reminderScheduleLine,
    evidenceChecklist,
    evidenceCompleteness,
    readinessSnapshots,
    readinessTrajectory,
    weeklyAssuranceData,
    caseWatchEnabled,
    packetHistoryEntries,
    watchMicroEvents,
    watchStatusLine,
    weeklyCheckInStatus,
    weeklyCheckInAction,
    packetShareStatusLine,
    intakeCompleteness,
    costSavingIndicator,
    premiumActionSteps,
    groupedPremiumSteps,
    workspaceChecklistItems,
    premiumStepSummaryLine
  }), [
    latestVerdictOutput, deadlineSignals, uncertaintyNotes, topUncertaintyNote,
    deadlineGuardReminders, reminderScheduleLine, evidenceChecklist,
    evidenceCompleteness, readinessSnapshots, readinessTrajectory,
    weeklyAssuranceData, caseWatchEnabled, packetHistoryEntries,
    watchMicroEvents, watchStatusLine, weeklyCheckInStatus,
    weeklyCheckInAction, packetShareStatusLine, intakeCompleteness,
    costSavingIndicator, premiumActionSteps, groupedPremiumSteps,
    workspaceChecklistItems, premiumStepSummaryLine
  ]);
}
