/**
 * Minimal test harness for workspace derived pure functions.
 * Run: npx tsx scripts/test-workspace-derived.ts
 */

import {
  computeTimelineRows,
  computeWorkspaceSeverity,
  computeWorkspaceSummaryText,
  computeWorkspaceNextSteps,
  computeUploadStatusText,
  computeDeadlineGuardReminders,
  computeLatestVerdictOutput,
} from "../src/hooks/controllers/workspace/workspaceDerived";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function buildVerdictWithSignals(signals: Record<string, unknown>[]) {
  return { deadlines: { signals } };
}

// ─── Case 1: No verdict ──────────────────────────────────────────────

const rows1 = computeTimelineRows(null);
assert(rows1.length === 0, "no verdict → empty timelineRows");

const severity1 = computeWorkspaceSeverity(null, false, null);
assert(severity1 === "medium", "no verdict → severity is 'medium' (default)");

// ─── Case 2: Future deadline (5 days) ────────────────────────────────

const futureDate = isoDate(5);
const verdict2 = buildVerdictWithSignals([
  { dateIso: futureDate, sourceText: "Court hearing", kind: "hearing", confidence: 0.9 },
]);
const rows2 = computeTimelineRows(verdict2);
assert(rows2.length === 1, "future deadline → 1 row");
assert(rows2[0].daysRemaining === 5, "future deadline → daysRemaining === 5");
assert(rows2[0].label === "Court hearing", "future deadline → label from sourceText");
assert(rows2[0].confidence === 0.9, "future deadline → confidence preserved");

// ─── Case 3: Overdue deadline (3 days ago) ───────────────────────────

const pastDate = isoDate(-3);
const verdict3 = buildVerdictWithSignals([
  { dateIso: pastDate, sourceText: "Response deadline", kind: "deadline" },
]);
const rows3 = computeTimelineRows(verdict3);
assert(rows3.length === 1, "overdue deadline → 1 row");
assert(rows3[0].daysRemaining === -3, "overdue deadline → daysRemaining === -3");

// ─── Case 4: Missing optional fields ────────────────────────────────

const verdict4 = buildVerdictWithSignals([
  { dateIso: futureDate },
  {},
  { dateIso: "not-a-date" },
  { dateIso: futureDate, confidence: NaN },
  { dateIso: futureDate, confidence: Infinity },
]);
const rows4 = computeTimelineRows(verdict4);

// Row with missing sourceText/label should get fallback
const firstRow = rows4.find((r) => r.dateIso !== null);
assert(firstRow !== undefined, "missing fields → row with valid date still included");
assert(firstRow!.label === "Deadline", "missing sourceText → label fallback to 'Deadline'");
assert(firstRow!.confidence === null, "missing confidence → null");

// Invalid date row should be excluded (dateIso becomes null)
const invalidDateRow = rows4.find((r) => r.dateIso === "not-a-date");
assert(invalidDateRow === undefined, "invalid ISO date → excluded from dateIso");

// NaN confidence
const nanRow = rows4.find((r) => r.confidence !== null && !Number.isFinite(r.confidence));
assert(nanRow === undefined, "NaN/Infinity confidence → filtered to null");

// Empty object row should still not crash
assert(rows4.length >= 1, "missing fields → no crash, returns results");

// ─── Case 5: Upload status text ──────────────────────────────────────

assert(computeUploadStatusText(false, "idle", "en") === "Ready to upload", "not uploading → ready text (en)");
assert(computeUploadStatusText(true, "sending", "en") === "Uploading securely", "sending → upload text (en)");
assert(computeUploadStatusText(true, "processing", "es") === "Generando analisis", "processing → upload text (es)");

// ─── Case 6: Summary text fallback ──────────────────────────────────

const summary1 = computeWorkspaceSummaryText("A plain explanation", null, "en");
assert(summary1 === "A plain explanation", "en with explanation → returns it");

const summary2 = computeWorkspaceSummaryText(null, null, "en");
assert(typeof summary2 === "string" && summary2.length > 0, "null explanation → fallback string");

// ─── Case 7: Next steps ─────────────────────────────────────────────

const steps = computeWorkspaceNextSteps(null, null, "en");
assert(Array.isArray(steps), "next steps → returns array");

// ─── Case 8: Deadline guard reminders ────────────────────────────────

const reminders1 = computeDeadlineGuardReminders(null);
assert(reminders1.length === 0, "null verdict → empty reminders");

const reminders2 = computeDeadlineGuardReminders({
  deadlineGuard: {
    reminders: [
      { label: "File response", reminderDateIso: "2026-03-01" },
      { label: "Missing date" },
      {},
    ],
  },
});
assert(reminders2.length === 1, "only reminder with valid date included");
assert(reminders2[0].label === "File response", "reminder label preserved");

// ─── Case 9: Today deadline ─────────────────────────────────────────

const todayDate = isoDate(0);
const verdict9 = buildVerdictWithSignals([
  { dateIso: todayDate, sourceText: "Today item" },
]);
const rows9 = computeTimelineRows(verdict9);
assert(rows9.length === 1, "today deadline → 1 row");
assert(rows9[0].daysRemaining === 0, "today deadline → daysRemaining === 0");

// ─── Case 10: Sorting ───────────────────────────────────────────────

const verdict10 = buildVerdictWithSignals([
  { dateIso: isoDate(10), sourceText: "Later" },
  { dateIso: isoDate(2), sourceText: "Sooner" },
  { sourceText: "No date" },
]);
const rows10 = computeTimelineRows(verdict10);
assert(rows10[0].label === "Sooner", "sorting → earliest date first");
assert(rows10[rows10.length - 1].dateIso === null, "sorting → null dates last");

console.log("\nAll tests passed.");
