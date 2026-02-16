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
  computeActionInstructions,
  normalizeExtractedFields,
} from "../src/hooks/controllers/workspace/workspaceDerived";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

// ─── Case 11: Extracted-field normalizer ────────────────────────────

const ef1 = normalizeExtractedFields(null);
assert(Object.keys(ef1).length === 0, "normalizer: null → empty object");

const ef2 = normalizeExtractedFields({
  issuingParty: "Smith Law",
  contactEmail: "info@smith.com",
  courtName: "LA Superior Court",
  caseNumber: "BC-123",
  junk: 42,
});
assert(ef2.senderName === "Smith Law", "normalizer: issuingParty → senderName");
assert(ef2.senderEmail === "info@smith.com", "normalizer: contactEmail → senderEmail");
assert(ef2.courtName === "LA Superior Court", "normalizer: courtName preserved");
assert(ef2.caseNumber === "BC-123", "normalizer: caseNumber preserved");

const ef3 = normalizeExtractedFields({ senderName: "  ", from: "Agency X" });
assert(ef3.senderName === "Agency X", "normalizer: blank senderName skipped, from used");

// ─── Case 12: Action instructions — subpoena (template match) ──────

const ai1 = computeActionInstructions({
  language: "en",
  activeDocumentType: "subpoena",
  activeEarliestDeadlineISO: null,
  activeTimeSensitive: false,
  extracted: null,
});
assert(ai1.length === 1, "subpoena → 1 action instruction");
assert(ai1[0].id === "subpoena-respond", "subpoena → template id");
assert(ai1[0].steps.length === 5, "subpoena → 5 steps");
assert(ai1[0].contact === undefined, "subpoena no contact → contact undefined");
assert(ai1[0].deadlineISO === undefined, "subpoena no deadline → deadlineISO undefined");
assert(ai1[0].confidence === 40, "subpoena no contact/deadline → confidence 40");
assert(ai1[0].missingInfo !== undefined && ai1[0].missingInfo.length === 2, "subpoena no fields → 2 missing info lines");

// ─── Case 13: Subpoena with deadline + email (high confidence) ─────

const ai2 = computeActionInstructions({
  language: "en",
  activeDocumentType: "civil_subpoena",
  activeEarliestDeadlineISO: "2026-03-15",
  activeTimeSensitive: true,
  extracted: {
    issuingParty: "Smith & Associates",
    contactEmail: "filing@smith.com",
    courtName: "Superior Court of LA",
    caseNumber: "BC-2026-1234",
  },
});
assert(ai2.length === 1, "subpoena with fields → 1 instruction");
assert(ai2[0].deadlineISO === "2026-03-15", "subpoena deadline → deadlineISO present");
assert(ai2[0].contact !== undefined, "subpoena with email → contact present");
assert(ai2[0].contact!.email === "filing@smith.com", "subpoena → contact.email");
assert(ai2[0].contact!.name === "Smith & Associates", "subpoena → contact.name");
assert(ai2[0].court !== undefined, "subpoena with court → court present");
assert(ai2[0].court!.name === "Superior Court of LA", "subpoena → court.name");
assert(ai2[0].court!.caseNumber === "BC-2026-1234", "subpoena → court.caseNumber");
assert(ai2[0].confidence === 80, "subpoena deadline+issuer → confidence 80");
assert(ai2[0].missingInfo === undefined, "subpoena with all fields → no missing info");
assert(ai2[0].steps[2].includes("Smith & Associates"), "subpoena → step 3 includes issuing party");

// ─── Case 14: Subpoena Spanish ─────────────────────────────────────

const ai3 = computeActionInstructions({
  language: "es",
  activeDocumentType: "subpoena",
  activeEarliestDeadlineISO: "2026-04-01",
  extracted: { issuingParty: "Oficina Legal" },
});
assert(ai3.length === 1, "subpoena es → 1 instruction");
assert(ai3[0].title === "Responder a la citacion", "subpoena es → Spanish title");
assert(ai3[0].deadlineLabel === "Responder antes de", "subpoena es → Spanish deadline label");
assert(ai3[0].confidence === 80, "subpoena es deadline+issuer → confidence 80");

// ─── Case 15: Summons template match ────────────────────────────────

const ai4 = computeActionInstructions({
  language: "en",
  activeDocumentType: "summons",
  activeEarliestDeadlineISO: "2026-03-01",
  extracted: { issuingParty: "County Court" },
});
assert(ai4.length === 1, "summons → 1 instruction");
assert(ai4[0].id === "summons-respond", "summons → template id");
assert(ai4[0].confidence === 80, "summons deadline+issuer → confidence 80");

// ─── Case 16: Demand letter template match ──────────────────────────

const ai5 = computeActionInstructions({
  language: "en",
  activeDocumentType: "demand_letter",
  activeEarliestDeadlineISO: null,
  extracted: null,
});
assert(ai5.length === 1, "demand letter → 1 instruction");
assert(ai5[0].id === "demand-letter-respond", "demand letter → template id");
assert(ai5[0].confidence === 40, "demand letter no fields → confidence 40");

// ─── Case 17: Generic fallback — unknown doc type ───────────────────

const ai6 = computeActionInstructions({
  language: "en",
  activeDocumentType: "eviction_notice",
  activeEarliestDeadlineISO: "2026-03-01",
  extracted: null,
});
assert(ai6.length === 1, "unknown docType → generic fallback (1 instruction)");
assert(ai6[0].id === "generic-respond", "unknown docType → generic id");
assert(ai6[0].steps.length === 5, "generic → 5 steps");
assert(ai6[0].confidence === 60, "generic with deadline only → confidence 60");
assert(ai6[0].missingInfo !== undefined && ai6[0].missingInfo.length === 1, "generic deadline-only → 1 missing (sender)");

// ─── Case 18: Generic fallback — null doc type ─────────────────────

const ai7 = computeActionInstructions({
  language: "en",
  activeDocumentType: null,
  extracted: null,
});
assert(ai7.length === 1, "null docType → generic fallback (always present)");
assert(ai7[0].id === "generic-respond", "null docType → generic id");
assert(ai7[0].confidence === 40, "null docType no fields → confidence 40");
assert(ai7[0].missingInfo !== undefined && ai7[0].missingInfo.length === 2, "null docType no fields → 2 missing");

// ─── Case 19: Generic fallback Spanish ──────────────────────────────

const ai8 = computeActionInstructions({
  language: "es",
  activeDocumentType: "unknown_type",
  extracted: { senderName: "Abogado Garcia" },
});
assert(ai8[0].title === "Como responder", "generic es → Spanish title");
assert(ai8[0].steps[1].includes("Abogado Garcia"), "generic es → step 2 includes sender name");
assert(ai8[0].missingInfo !== undefined && ai8[0].missingInfo.length === 1, "generic es sender-only → 1 missing (deadline)");

// ─── Case 20: Generic with both fields → no missing info ───────────

const ai9 = computeActionInstructions({
  language: "en",
  activeDocumentType: null,
  activeEarliestDeadlineISO: "2026-05-01",
  extracted: { issuingParty: "Office of ABC" },
});
assert(ai9[0].confidence === 80, "generic deadline+issuer → confidence 80");
assert(ai9[0].missingInfo === undefined, "generic both fields → no missing info");

console.log("\nAll tests passed.");
