/**
 * Evaluation harness for the Action Layer.
 * Processes all fixtures and prints a summary table.
 * Run: npx tsx scripts/eval-action-layer.ts
 */

import {
  normalizeExtractedFields,
  computeDocumentFamily,
  computeActionInstructions,
  computeResponseSignals,
} from "../src/hooks/controllers/workspace/workspaceDerived";
import { VERDICT_FIXTURES } from "../src/data/verdict-fixtures";

function pad(str: string, length: number): string {
  return str.substring(0, length).padEnd(length);
}

console.log(
  [
    pad("Fixture", 20),
    pad("DocType", 25),
    pad("Family", 15),
    pad("Template", 25),
    pad("Conf", 5),
    pad("Dest", 10),
    pad("Channels", 25),
    pad("DL", 5),
    pad("Missing", 15),
  ].join(" | ")
);
console.log("-".repeat(160));

for (const fixture of VERDICT_FIXTURES) {
  const data = fixture.data;
  const docType = (data.documentType as string) || "null";
  
  // In real app, earliestDeadline is on the case object, usually promoted from signals
  let deadline = (data.earliestDeadline as string) || null;
  if (!deadline && data.deadlines) {
    const signals = (data.deadlines as any).signals || [];
    const dls = signals
      .map((s: any) => s.dateIso)
      .filter(Boolean)
      .sort();
    if (dls.length > 0) deadline = dls[0];
  }

  const extracted = normalizeExtractedFields(data);
  const family = computeDocumentFamily({ docType, extracted });
  const signals = computeResponseSignals({
    family,
    extracted,
    activeEarliestDeadlineISO: deadline,
  });

  const instructionsEn = computeActionInstructions({
    language: "en",
    activeDocumentType: docType,
    activeEarliestDeadlineISO: deadline,
    extracted: data,
  });

  const ai = instructionsEn[0];
  const templateId = ai.id;
  const confidence = ai.confidence || 0;
  const destination = signals.responseDestination;
  const channels = signals.responseChannels.join(",");
  const hasDeadline = !!deadline ? "YES" : "NO";

  const missingFlags = [];
  if (signals.missing.deadline) missingFlags.push("DL");
  if (signals.missing.sender) missingFlags.push("SND");
  if (signals.missing.court) missingFlags.push("CRT");
  if (signals.missing.channel) missingFlags.push("CH");
  const missingStr = missingFlags.join(",");

  console.log(
    [
      pad(fixture.name, 20),
      pad(docType, 25),
      pad(family, 15),
      pad(templateId, 25),
      pad(confidence.toString(), 5),
      pad(destination, 10),
      pad(channels, 25),
      pad(hasDeadline, 5),
      pad(missingStr, 15),
    ].join(" | ")
  );
}
