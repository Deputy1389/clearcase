import { useMemo } from "react";
import { asRecord, asStringArray } from "../../../utils/parsing";
import { fmtDate, fmtDateTime } from "../../../utils/formatting";

export function useWorkspaceTimeline(ui: any, cases: any, summary: any) {
  const language = ui.language;

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
    // Note: depends on caseContextDraft, but we'll use cases.selectedCase context if available or pass from UI
    // For now, let's assume we might need to pass caseContextDraft if it's not in cases.selectedCase
    const hasContext = Boolean(cases.selectedCase?.auditLogs?.some((l: any) => asRecord(l.payload)?.subtype === "case_context_set"));
    const hasDeadline = Boolean(summary.activeEarliestDeadline);
    const hasStrongClassification = (summary.classificationConfidenceValue ?? 0) >= 0.6;
    const checks = [assetsCount >= 1, assetsCount >= 2, hasContext, hasDeadline || hasStrongClassification];
    const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
    return { score, status: score >= 70 ? "Sufficient" : "Incomplete", missing: [] };
  }, [cases.selectedCase?.assets.length, cases.selectedCaseSummary?._count?.assets, cases.selectedCase?.auditLogs, summary.activeEarliestDeadline, summary.classificationConfidenceValue]);

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
    groupedPremiumSteps,
    workspaceChecklistItems,
    premiumStepSummaryLine
  }), [
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
    groupedPremiumSteps,
    workspaceChecklistItems,
    premiumStepSummaryLine
  ]);
}
