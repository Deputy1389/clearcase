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
  computeDocumentFamily,
  computeResponseSignals,
  computeResponsePlan,
  computeTimeSensitivity,
} from "../src/hooks/controllers/workspace/workspaceDerived";
import { VERDICT_FIXTURES } from "../src/data/verdict-fixtures";

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
assert(ai1[0].steps.length === 6, "subpoena → 6 steps (template + plan)");
assert(ai1[0].contact === undefined, "subpoena no contact → contact undefined");
assert(ai1[0].deadlineISO === undefined, "subpoena no deadline → deadlineISO undefined");
assert(ai1[0].confidence === 40, "subpoena no contact/deadline → confidence 40");
assert(ai1[0].missingInfo !== undefined && ai1[0].missingInfo.length === 3, "subpoena no fields → 3 missing info lines");

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
assert(ai2[0].steps.length === 6, "subpoena → 6 steps");
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
assert(ai4[0].steps.length === 5, "summons → 5 steps (plan respond added no step)");

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
assert(ai5[0].steps.length === 6, "demand letter → 6 steps");

// ─── Case 17: Generic fallback — unknown doc type ───────────────────

const ai6 = computeActionInstructions({
  language: "en",
  activeDocumentType: "legal_notice",
  activeEarliestDeadlineISO: "2026-03-01",
  extracted: null,
});
assert(ai6.length === 1, "unknown docType → generic fallback (1 instruction)");
assert(ai6[0].id === "generic-respond", "unknown docType → generic id");
assert(ai6[0].steps.length === 5, "generic → 5 steps");
assert(ai6[0].confidence === 60, "generic with deadline only → confidence 60");
assert(ai6[0].missingInfo !== undefined && ai6[0].missingInfo.length === 2, "generic deadline-only → 2 missing (sender, court)");

// ─── Case 18: Generic fallback — null doc type ─────────────────────

const ai7 = computeActionInstructions({
  language: "en",
  activeDocumentType: null,
  extracted: null,
});
assert(ai7.length === 1, "null docType → generic fallback (always present)");
assert(ai7[0].id === "generic-respond", "null docType → generic id");
assert(ai7[0].confidence === 40, "null docType no fields → confidence 40");
assert(ai7[0].missingInfo !== undefined && ai7[0].missingInfo.length === 3, "null docType no fields → 3 missing");

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

// ─── Fixture-based normalizer tests ─────────────────────────────────

console.log("\n--- Fixture normalizer tests ---");

// All fixtures must normalize without throwing
for (const fixture of VERDICT_FIXTURES) {
  const fields = normalizeExtractedFields(fixture.data);
  assert(typeof fields === "object" && fields !== null, `fixture ${fixture.name}: normalizes without crash`);
  // Every field must be string | string[] | undefined — never null, never number
  for (const [key, val] of Object.entries(fields)) {
    if (val === undefined) continue;
    if (Array.isArray(val)) {
      assert(val.every((v) => typeof v === "string"), `fixture ${fixture.name}: ${key} array contains only strings`);
    } else {
      assert(typeof val === "string", `fixture ${fixture.name}: ${key} is string (got ${typeof val})`);
      assert(val.trim().length > 0, `fixture ${fixture.name}: ${key} is non-blank`);
    }
  }
}

// summons-full: all contact + court fields present
const sfFields = normalizeExtractedFields(VERDICT_FIXTURES.find((f) => f.name === "summons-full")!.data);
assert(sfFields.senderName === "Law Offices of Martinez & Chen", "fixture summons-full: senderName");
assert(sfFields.senderEmail === "service@martinezchen.law", "fixture summons-full: senderEmail");
assert(sfFields.senderPhone === "(213) 555-0142", "fixture summons-full: senderPhone");
assert(sfFields.senderAddress === "1200 Main St, Suite 400, Los Angeles, CA 90012", "fixture summons-full: senderAddress");
assert(sfFields.courtName === "Superior Court of California, County of Los Angeles", "fixture summons-full: courtName");
assert(sfFields.courtAddress === "111 N Hill St, Los Angeles, CA 90012", "fixture summons-full: courtAddress");
assert(sfFields.courtWebsite === "https://www.lacourt.org", "fixture summons-full: courtWebsite");
assert(sfFields.caseNumber === "23STCV-04821", "fixture summons-full: caseNumber");
assert(sfFields.sources !== undefined && sfFields.sources.length === 2, "fixture summons-full: 2 sources");

// summons-minimal: only senderName from senderName field
const smFields = normalizeExtractedFields(VERDICT_FIXTURES.find((f) => f.name === "summons-minimal")!.data);
assert(smFields.senderName === "County Clerk", "fixture summons-minimal: senderName from senderName");
assert(smFields.senderEmail === undefined, "fixture summons-minimal: no email");
assert(smFields.courtName === undefined, "fixture summons-minimal: no court");

// demand-letter-full: attorneyName maps to senderName, address maps to senderAddress
const dfFields = normalizeExtractedFields(VERDICT_FIXTURES.find((f) => f.name === "demand-letter-full")!.data);
assert(dfFields.senderName === "Rebecca Torres, Esq.", "fixture demand-letter-full: senderName from attorneyName");
assert(dfFields.senderEmail === "rtorres@torreslaw.com", "fixture demand-letter-full: senderEmail");
assert(dfFields.senderAddress === "500 California St, Suite 1200, San Francisco, CA 94104", "fixture demand-letter-full: senderAddress from address");

// demand-letter-sparse: from field maps to senderName
const dsFields = normalizeExtractedFields(VERDICT_FIXTURES.find((f) => f.name === "demand-letter-sparse")!.data);
assert(dsFields.senderName === "Unknown Attorney Office", "fixture demand-letter-sparse: senderName from from");
assert(dsFields.senderEmail === undefined, "fixture demand-letter-sparse: no email");
assert(dsFields.senderPhone === undefined, "fixture demand-letter-sparse: no phone");

// subpoena-records: issuingParty → senderName, phone (not contactPhone) → senderPhone
const srFields = normalizeExtractedFields(VERDICT_FIXTURES.find((f) => f.name === "subpoena-records")!.data);
assert(srFields.senderName === "District Attorney, County of Riverside", "fixture subpoena-records: senderName from issuingParty");
assert(srFields.senderEmail === "civilsubpoena@rivco.da.gov", "fixture subpoena-records: senderEmail");
assert(srFields.senderPhone === "(951) 555-0177", "fixture subpoena-records: senderPhone from phone");
assert(srFields.courtName === "Riverside County Superior Court", "fixture subpoena-records: courtName");
assert(srFields.caseNumber === "RIC-2026-00312", "fixture subpoena-records: caseNumber");

// debt-collection: senderName field, website present, no court
const dcFields = normalizeExtractedFields(VERDICT_FIXTURES.find((f) => f.name === "debt-collection")!.data);
assert(dcFields.senderName === "National Recovery Associates", "fixture debt-collection: senderName");
assert(dcFields.senderPhone === "(800) 555-0234", "fixture debt-collection: senderPhone");
assert(dcFields.senderAddress === "PO Box 4400, Dallas, TX 75208", "fixture debt-collection: senderAddress from address");
assert(dcFields.website === "https://www.nra-collections.example.com", "fixture debt-collection: website");
assert(dcFields.courtName === undefined, "fixture debt-collection: no court");

// agency-notice: issuingParty, contactEmail, contactAddress, phone
const anFields = normalizeExtractedFields(VERDICT_FIXTURES.find((f) => f.name === "agency-notice")!.data);
assert(anFields.senderName === "State Department of Labor", "fixture agency-notice: senderName from issuingParty");
assert(anFields.senderEmail === "compliance@labor.state.example.gov", "fixture agency-notice: senderEmail");
assert(anFields.senderAddress === "200 Constitution Ave, Sacramento, CA 95814", "fixture agency-notice: senderAddress from contactAddress");
assert(anFields.senderPhone === "(916) 555-0300", "fixture agency-notice: senderPhone from phone");
assert(anFields.caseNumber === "DOL-ENF-2026-0088", "fixture agency-notice: caseNumber");

// eviction-3day: issuingParty, contactPhone, courtName, caseNumber
const e3Fields = normalizeExtractedFields(VERDICT_FIXTURES.find((f) => f.name === "eviction-3day")!.data);
assert(e3Fields.senderName === "Pacific Property Management", "fixture eviction-3day: senderName");
assert(e3Fields.senderPhone === "(310) 555-0411", "fixture eviction-3day: senderPhone from contactPhone");
assert(e3Fields.senderAddress === "8900 Wilshire Blvd, Beverly Hills, CA 90211", "fixture eviction-3day: senderAddress from contactAddress");
assert(e3Fields.courtName === "Los Angeles County Superior Court", "fixture eviction-3day: courtName");
assert(e3Fields.senderEmail === undefined, "fixture eviction-3day: no email");

// unknown-other: no useful fields
const uoFields = normalizeExtractedFields(VERDICT_FIXTURES.find((f) => f.name === "unknown-other")!.data);
assert(uoFields.senderName === undefined, "fixture unknown-other: no senderName");
assert(uoFields.senderEmail === undefined, "fixture unknown-other: no email");
assert(uoFields.courtName === undefined, "fixture unknown-other: no court");
assert(uoFields.caseNumber === undefined, "fixture unknown-other: no caseNumber");

// cease-desist: attorneyName, email (not contactEmail)
const cdFields = normalizeExtractedFields(VERDICT_FIXTURES.find((f) => f.name === "cease-desist")!.data);
assert(cdFields.senderName === "Johnson & Park LLP", "fixture cease-desist: senderName from attorneyName");
assert(cdFields.senderEmail === "jpark@johnsonpark.law", "fixture cease-desist: senderEmail from email");
assert(cdFields.senderAddress === "350 S Grand Ave, Suite 3100, Los Angeles, CA 90071", "fixture cease-desist: senderAddress from contactAddress");
assert(cdFields.sources !== undefined && cdFields.sources.length === 2, "fixture cease-desist: 2 sources");

// ─── Case 21: DocumentFamily classification — fixture docTypes ──────

console.log("\n--- DocumentFamily classification tests ---");

const familyTests: [string, string][] = [
  ["summons", "summons"],
  ["complaint_and_summons", "summons"],
  ["demand_letter", "demand_letter"],
  ["legal_notice", "other"],
  ["subpoena_duces_tecum", "subpoena"],
  ["debt_collection_notice", "debt_collection"],
  ["government_agency_notice", "agency_notice"],
  ["eviction_notice_3day", "eviction"],
  ["unknown", "other"],
  ["cease_and_desist", "cease_and_desist"],
];

for (const [docType, expectedFamily] of familyTests) {
  const family = computeDocumentFamily({ docType });
  assert(family === expectedFamily, `family: "${docType}" → "${expectedFamily}" (got "${family}")`);
}

// Anti-misclassification: eviction must NOT match summons
assert(
  computeDocumentFamily({ docType: "eviction_notice_3day" }) === "eviction",
  "anti-misclassify: eviction_notice_3day → eviction, NOT summons"
);

// Edge cases
assert(computeDocumentFamily({ docType: null }) === "other", "family: null → other");
assert(computeDocumentFamily({ docType: "" }) === "other", "family: empty → other");
assert(computeDocumentFamily({ docType: "  " }) === "other", "family: whitespace → other");
assert(computeDocumentFamily({ docType: "SUBPOENA" }) === "subpoena", "family: case-insensitive SUBPOENA → subpoena");
assert(computeDocumentFamily({ docType: "Unlawful Detainer" }) === "eviction", "family: unlawful detainer → eviction");
assert(computeDocumentFamily({ docType: "pay or quit notice" }) === "eviction", "family: pay or quit → eviction");
assert(computeDocumentFamily({ docType: "notice to quit" }) === "eviction", "family: notice to quit → eviction");
assert(computeDocumentFamily({ docType: "lien" }) === "lien", "family: lien → lien");
assert(computeDocumentFamily({ docType: "petition" }) === "summons", "family: petition → summons");
assert(computeDocumentFamily({ docType: "administrative_hearing" }) === "agency_notice", "family: administrative → agency_notice");

// ─── Case 22: Debt collection template match (fixture-driven) ───────

console.log("\n--- Template match tests (new families) ---");

const dcFixture = VERDICT_FIXTURES.find((f) => f.name === "debt-collection")!;
const dcInstr = computeActionInstructions({
  language: "en",
  activeDocumentType: dcFixture.data.documentType as string,
  activeEarliestDeadlineISO: "2026-04-15",
  extracted: dcFixture.data,
});
assert(dcInstr.length === 1, "debt-collection fixture → 1 instruction");
assert(dcInstr[0].id === "debt-collection-respond", "debt-collection → template id (not generic)");
assert(dcInstr[0].title === "Respond to the debt collection notice", "debt-collection → correct title");
assert(dcInstr[0].steps.length === 5, "debt-collection → 5 steps (plan dispute deduped)");
assert(dcInstr[0].deadlineISO === "2026-04-15", "debt-collection → deadline passed through");
assert(dcInstr[0].contact !== undefined, "debt-collection → contact present");
assert(dcInstr[0].contact!.name === "National Recovery Associates", "debt-collection → contact.name");
assert(dcInstr[0].contact!.phone === "(800) 555-0234", "debt-collection → contact.phone");
assert(dcInstr[0].court === undefined, "debt-collection → no court");
assert(dcInstr[0].confidence === 80, "debt-collection deadline+sender → confidence 80");

// Spanish
const dcInstrEs = computeActionInstructions({
  language: "es",
  activeDocumentType: dcFixture.data.documentType as string,
  activeEarliestDeadlineISO: "2026-04-15",
  extracted: dcFixture.data,
});
assert(dcInstrEs[0].title === "Responder al aviso de cobro de deuda", "debt-collection es → Spanish title");

// ─── Case 23: Agency notice template match (fixture-driven) ─────────

const anFixture = VERDICT_FIXTURES.find((f) => f.name === "agency-notice")!;
const anInstr = computeActionInstructions({
  language: "en",
  activeDocumentType: anFixture.data.documentType as string,
  activeEarliestDeadlineISO: null,
  extracted: anFixture.data,
});
assert(anInstr[0].id === "agency-notice-respond", "agency-notice → template id (not generic)");
assert(anInstr[0].title === "Respond to the government notice", "agency-notice → correct title");
assert(anInstr[0].steps.length === 5, "agency-notice → 5 steps");
assert(anInstr[0].contact !== undefined, "agency-notice → contact present");
assert(anInstr[0].contact!.name === "State Department of Labor", "agency-notice → contact.name");
assert(anInstr[0].contact!.email === "compliance@labor.state.example.gov", "agency-notice → contact.email");
assert(anInstr[0].deadlineISO === undefined, "agency-notice no deadline passed → deadlineISO absent");
assert(anInstr[0].confidence === 60, "agency-notice sender-only → confidence 60");
assert(anInstr[0].missingInfo !== undefined && anInstr[0].missingInfo.length === 1, "agency-notice no deadline → 1 missing info");

// ─── Case 24: Eviction template match (fixture-driven) ──────────────

const evFixture = VERDICT_FIXTURES.find((f) => f.name === "eviction-3day")!;
const evInstr = computeActionInstructions({
  language: "en",
  activeDocumentType: evFixture.data.documentType as string,
  activeEarliestDeadlineISO: "2026-02-20",
  extracted: evFixture.data,
});
assert(evInstr[0].id === "eviction-respond", "eviction → template id (not generic)");
assert(evInstr[0].title === "Respond to the eviction notice", "eviction → correct title");
assert(evInstr[0].steps.length === 6, "eviction → 6 steps");
assert(evInstr[0].steps[0].includes("3-day"), "eviction → first step mentions notice types");
assert(evInstr[0].contact !== undefined, "eviction → contact present");
assert(evInstr[0].contact!.name === "Pacific Property Management", "eviction → contact.name");
assert(evInstr[0].court !== undefined, "eviction → court present (fixture has court)");
assert(evInstr[0].court!.name === "Los Angeles County Superior Court", "eviction → court.name");
assert(evInstr[0].deadlineISO === "2026-02-20", "eviction → deadline passed through");
assert(evInstr[0].confidence === 80, "eviction deadline+sender → confidence 80");

// Spanish
const evInstrEs = computeActionInstructions({
  language: "es",
  activeDocumentType: evFixture.data.documentType as string,
  activeEarliestDeadlineISO: "2026-02-20",
  extracted: evFixture.data,
});
assert(evInstrEs[0].title === "Responder al aviso de desalojo", "eviction es → Spanish title");
assert(evInstrEs[0].steps[0].includes("3 dias"), "eviction es → first step mentions notice types in Spanish");

// ─── Case 25: Cease-and-desist template match (fixture-driven) ──────

const cdFixture = VERDICT_FIXTURES.find((f) => f.name === "cease-desist")!;
const cdInstr = computeActionInstructions({
  language: "en",
  activeDocumentType: cdFixture.data.documentType as string,
  activeEarliestDeadlineISO: null,
  extracted: cdFixture.data,
});
assert(cdInstr[0].id === "cease-desist-respond", "cease-desist → template id (not generic)");
assert(cdInstr[0].title === "Review the cease and desist letter", "cease-desist → correct title");
assert(cdInstr[0].steps.length === 5, "cease-desist → 5 steps");
assert(cdInstr[0].contact !== undefined, "cease-desist → contact present");
assert(cdInstr[0].contact!.name === "Johnson & Park LLP", "cease-desist → contact.name");
assert(cdInstr[0].court === undefined, "cease-desist → no court (fixture has none)");
assert(cdInstr[0].confidence === 60, "cease-desist sender-only no deadline → confidence 60");

// No sender, no deadline → confidence 40
const cdInstrBare = computeActionInstructions({
  language: "en",
  activeDocumentType: "cease_and_desist",
  activeEarliestDeadlineISO: null,
  extracted: null,
});
assert(cdInstrBare[0].id === "cease-desist-respond", "cease-desist bare → still template match");
assert(cdInstrBare[0].confidence === 40, "cease-desist bare → confidence 40");
assert(cdInstrBare[0].missingInfo !== undefined && cdInstrBare[0].missingInfo.length === 3, "cease-desist bare → 3 missing info");

// ─── Case 26: Unknown-other fixture → generic fallback ──────────────

const uoFixture = VERDICT_FIXTURES.find((f) => f.name === "unknown-other")!;
const uoInstr = computeActionInstructions({
  language: "en",
  activeDocumentType: uoFixture.data.documentType as string,
  activeEarliestDeadlineISO: null,
  extracted: uoFixture.data,
});
assert(uoInstr[0].id === "generic-respond", "unknown-other → generic fallback");
assert(uoInstr[0].confidence === 40, "unknown-other no fields → confidence 40");

// ─── Case 27: demand-letter-sparse (legal_notice) → generic ─────────

const dsFixture = VERDICT_FIXTURES.find((f) => f.name === "demand-letter-sparse")!;
const dsInstr = computeActionInstructions({
  language: "en",
  activeDocumentType: dsFixture.data.documentType as string,
  activeEarliestDeadlineISO: null,
  extracted: dsFixture.data,
});
assert(dsInstr[0].id === "generic-respond", "demand-letter-sparse (legal_notice) → generic fallback");
assert(dsInstr[0].contact !== undefined, "demand-letter-sparse → contact present (from field)");
assert(dsInstr[0].confidence === 60, "demand-letter-sparse sender-only → confidence 60");

// ─── Case 28: Response signals — summons-full (court destination) ────

console.log("\n--- Response signals tests ---");

const rsSummonsFull = computeResponseSignals({
  family: "summons",
  extracted: sfFields,
  activeEarliestDeadlineISO: "2026-03-15",
});
assert(rsSummonsFull.responseDestination === "court", "signals summons-full: destination → court");
assert(rsSummonsFull.responseDeadlineISO === "2026-03-15", "signals summons-full: deadline passed through");
assert(rsSummonsFull.responseChannels.includes("portal"), "signals summons-full: portal channel (courtWebsite)");
assert(rsSummonsFull.responseChannels.includes("email"), "signals summons-full: email channel");
assert(rsSummonsFull.responseChannels.includes("phone"), "signals summons-full: phone channel");
assert(rsSummonsFull.responseChannels.includes("mail"), "signals summons-full: mail channel");
assert(rsSummonsFull.missing.deadline === false, "signals summons-full: deadline not missing");
assert(rsSummonsFull.missing.sender === false, "signals summons-full: sender not missing");
assert(rsSummonsFull.missing.court === false, "signals summons-full: court not missing");
assert(rsSummonsFull.missing.channel === false, "signals summons-full: channel not missing");

// ─── Case 29: Response signals — demand-letter-full (sender destination) ─

const rsDemandFull = computeResponseSignals({
  family: "demand_letter",
  extracted: dfFields,
  activeEarliestDeadlineISO: null,
});
assert(rsDemandFull.responseDestination === "sender", "signals demand-letter-full: destination → sender");
assert(rsDemandFull.responseDeadlineISO === undefined, "signals demand-letter-full: no deadline → undefined");
assert(rsDemandFull.responseChannels.includes("email"), "signals demand-letter-full: email channel");
assert(rsDemandFull.responseChannels.includes("phone"), "signals demand-letter-full: phone channel");
assert(rsDemandFull.responseChannels.includes("mail"), "signals demand-letter-full: mail channel");
assert(!rsDemandFull.responseChannels.includes("portal"), "signals demand-letter-full: no portal (no courtWebsite)");
assert(rsDemandFull.missing.deadline === true, "signals demand-letter-full: deadline missing");
assert(rsDemandFull.missing.court === true, "signals demand-letter-full: court missing");
assert(rsDemandFull.missing.channel === false, "signals demand-letter-full: channel not missing");

// ─── Case 30: Response signals — unknown-other (all missing) ────────

const rsUnknown = computeResponseSignals({
  family: "other",
  extracted: uoFields,
  activeEarliestDeadlineISO: null,
});
assert(rsUnknown.responseDestination === "unknown", "signals unknown-other: destination → unknown");
assert(rsUnknown.responseDeadlineISO === undefined, "signals unknown-other: no deadline");
assert(rsUnknown.responseChannels.length === 0, "signals unknown-other: no channels");
assert(rsUnknown.missing.deadline === true, "signals unknown-other: deadline missing");
assert(rsUnknown.missing.sender === true, "signals unknown-other: sender missing");
assert(rsUnknown.missing.court === true, "signals unknown-other: court missing");
assert(rsUnknown.missing.channel === true, "signals unknown-other: channel missing");

// ─── Case 31: Response signals — agency-notice (agency fallback) ────

const rsAgencyBare = computeResponseSignals({
  family: "agency_notice",
  extracted: {},
  activeEarliestDeadlineISO: null,
});
assert(rsAgencyBare.responseDestination === "agency", "signals agency bare: destination → agency (family fallback)");
assert(rsAgencyBare.missing.sender === true, "signals agency bare: sender missing");

// Agency with contact info → sender takes priority over agency fallback
const rsAgencyFull = computeResponseSignals({
  family: "agency_notice",
  extracted: anFields,
  activeEarliestDeadlineISO: "2026-04-01",
});
assert(rsAgencyFull.responseDestination === "sender", "signals agency-notice full: destination → sender (contact overrides agency)");
assert(rsAgencyFull.responseChannels.includes("email"), "signals agency-notice full: email channel");
assert(rsAgencyFull.missing.deadline === false, "signals agency-notice full: deadline not missing");

// ─── Case 32: Response signals — eviction-3day (court w/ phone+mail) ─

const rsEviction = computeResponseSignals({
  family: "eviction",
  extracted: e3Fields,
  activeEarliestDeadlineISO: "2026-02-20",
});
assert(rsEviction.responseDestination === "court", "signals eviction-3day: destination → court");
assert(rsEviction.responseChannels.includes("phone"), "signals eviction-3day: phone channel");
assert(rsEviction.responseChannels.includes("mail"), "signals eviction-3day: mail channel");
assert(!rsEviction.responseChannels.includes("email"), "signals eviction-3day: no email (fixture has none)");
assert(rsEviction.missing.court === false, "signals eviction-3day: court not missing");

// ─── Case 33: Response signals — summons-minimal (sender-only, sparse) ─

const rsMinimal = computeResponseSignals({
  family: "summons",
  extracted: smFields,
  activeEarliestDeadlineISO: null,
});
assert(rsMinimal.responseDestination === "unknown", "signals summons-minimal: destination → unknown (name only, no contact)");
assert(rsMinimal.responseChannels.length === 0, "signals summons-minimal: no channels");
assert(rsMinimal.missing.sender === false, "signals summons-minimal: sender not missing (has senderName)");
assert(rsMinimal.missing.channel === true, "signals summons-minimal: channel missing");
assert(rsMinimal.missing.court === true, "signals summons-minimal: court missing");

// ─── Case 34: Confidence integrity tests ───────────────────────────

console.log("\n--- Confidence integrity tests ---");

for (const fixture of VERDICT_FIXTURES) {
  const instr = computeActionInstructions({
    language: "en",
    activeDocumentType: fixture.data.documentType as string,
    extracted: fixture.data,
  });
  const conf = instr[0].confidence || 0;
  assert(conf >= 0 && conf <= 100, `fixture ${fixture.name}: confidence ${conf} is in [0, 100]`);
  assert([40, 60, 80].includes(conf), `fixture ${fixture.name}: confidence ${conf} matches allowed tiers`);
}

// Generic fallback returns confidence <= template match for same signals
// For same fields (issuer + deadline), generic should be 80, template should be 80.
// Let's test a case where we have issuer and deadline.
const fieldsWithBoth = { issuingParty: "Some Corp", deadlines: { signals: [{ dateIso: "2026-01-01" }] } };
const aiTemplate = computeActionInstructions({
  language: "en",
  activeDocumentType: "summons",
  activeEarliestDeadlineISO: "2026-01-01",
  extracted: fieldsWithBoth,
});
const aiGeneric = computeActionInstructions({
  language: "en",
  activeDocumentType: "unknown",
  activeEarliestDeadlineISO: "2026-01-01",
  extracted: fieldsWithBoth,
});
assert(aiGeneric[0].confidence! <= aiTemplate[0].confidence!, "generic confidence <= template confidence for same signals");
assert(aiGeneric[0].confidence === 80, "generic both fields -> 80");
assert(aiTemplate[0].confidence === 80, "template both fields -> 80");

// ─── Case 35: ResponsePlan tests ───────────────────────────────────

console.log("\n--- ResponsePlan tests ---");

// 1. summons-full
const sfData = VERDICT_FIXTURES.find((f) => f.name === "summons-full")!.data;
const sfExtracted = normalizeExtractedFields(sfData);
const sfSignals = computeResponseSignals({ family: "summons", extracted: sfExtracted, activeEarliestDeadlineISO: "2026-03-20" });
const sfPlan = computeResponsePlan({ family: "summons", extracted: sfExtracted, signals: sfSignals });

assert(sfPlan.requiredActions.includes("file_answer"), "summons-full: requiredActions includes file_answer");
assert(sfPlan.destination === "court", "summons-full: destination is court");
assert(sfPlan.deadlineISO === "2026-03-20", "summons-full: deadline passthrough");

// 2. subpoena-records
const srData = VERDICT_FIXTURES.find((f) => f.name === "subpoena-records")!.data;
const srExtracted = normalizeExtractedFields(srData);
const srSignals = computeResponseSignals({ family: "subpoena", extracted: srExtracted });
const srPlan = computeResponsePlan({ family: "subpoena", extracted: srExtracted, signals: srSignals });

assert(srPlan.requiredActions.includes("produce_documents"), "subpoena-records: requiredActions includes produce_documents");
assert(srPlan.channels.includes("email"), "subpoena-records: channels include email");

// 3. debt-collection
const dcData = VERDICT_FIXTURES.find((f) => f.name === "debt-collection")!.data;
const dcExtracted = normalizeExtractedFields(dcData);
const dcSignals = computeResponseSignals({ family: "debt_collection", extracted: dcExtracted });
const dcPlan = computeResponsePlan({ family: "debt_collection", extracted: dcExtracted, signals: dcSignals });

assert(dcPlan.requiredActions.includes("dispute"), "debt-collection: requiredActions includes dispute");
assert(dcPlan.requiredActions.includes("respond"), "debt-collection: requiredActions includes respond");
assert(dcPlan.destination === "sender", "debt-collection: destination is sender");

// ActionInstructions still match prior behavior (check key fields)
const sfInstr = computeActionInstructions({ language: "en", extracted: sfData, activeEarliestDeadlineISO: "2026-03-20", activeDocumentType: "summons" });
assert(sfInstr[0].id === "summons-respond", "summons-full: still matches summons-respond template");
assert(sfInstr[0].steps.some(s => s.toLowerCase().includes("response")), "summons-full: steps include response instructions");

// ─── Case 36: Time sensitivity and Jurisdiction tests ─────────────

console.log("\n--- Time sensitivity and Jurisdiction tests ---");

const now = new Date("2026-02-15");

// Critical: 0-2 days
assert(computeTimeSensitivity({ deadlineISO: "2026-02-15", now }) === "critical", "today -> critical");
assert(computeTimeSensitivity({ deadlineISO: "2026-02-17", now }) === "critical", "2 days -> critical");
assert(computeTimeSensitivity({ deadlineISO: "2026-02-10", now }) === "critical", "past -> critical");

// Urgent: 3-6 days
assert(computeTimeSensitivity({ deadlineISO: "2026-02-18", now }) === "urgent", "3 days -> urgent");
assert(computeTimeSensitivity({ deadlineISO: "2026-02-21", now }) === "urgent", "6 days -> urgent");

// Moderate: 7-14 days
assert(computeTimeSensitivity({ deadlineISO: "2026-02-22", now }) === "moderate", "7 days -> moderate");
assert(computeTimeSensitivity({ deadlineISO: "2026-03-01", now }) === "moderate", "14 days -> moderate");

// None: >14 days or no deadline
assert(computeTimeSensitivity({ deadlineISO: "2026-03-02", now }) === "none", "15 days -> none");
assert(computeTimeSensitivity({ deadlineISO: null, now }) === "none", "null -> none");

// Jurisdiction
const srData2 = VERDICT_FIXTURES.find((f) => f.name === "summons-full")!.data;
const srExtracted2 = normalizeExtractedFields(srData2);
const srSignals2 = computeResponseSignals({ family: "summons", extracted: srExtracted2 });
assert(srSignals2.jurisdictionState === "CA", "summons-full jurisdiction -> CA");

const dcSignals2 = computeResponseSignals({ family: "debt_collection", extracted: { courtAddress: "New York, NY 10013" } });
assert(dcSignals2.jurisdictionState === "NY", "manual address jurisdiction -> NY");

console.log("\nAll tests passed.");
