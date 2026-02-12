import assert from "node:assert/strict";
import test from "node:test";
import { createCaseFormatter } from "./formatter.ts";
import { createOcrProvider } from "./ocr.ts";
import { buildTruthLayerResult } from "./truth-layer.ts";

test("ocr stub excludes storage metadata and keeps deadline extraction document-driven", async () => {
  const previousProvider = process.env.OCR_PROVIDER;
  process.env.OCR_PROVIDER = "stub";

  try {
    const provider = createOcrProvider();
    const ocrResult = await provider.run({
      caseId: "case-regression-1",
      assetId: "asset-regression-1",
      fileName: "eviction-notice-deadline-2026-02-26.jpg",
      mimeType: "image/jpeg",
      s3Key: "cases/case-regression-1/assets/2026-02-12/file.jpg"
    });

    assert.equal(ocrResult.rawText.includes("S3:"), false);
    assert.equal("s3Key" in ocrResult.structuredFacts, false);

    const truth = buildTruthLayerResult({
      caseId: "case-regression-1",
      assetId: "asset-regression-1",
      extractionId: "ext-regression-1",
      extractionEngine: ocrResult.engine,
      extractionCreatedAt: new Date("2026-02-12T00:00:00.000Z"),
      rawText: ocrResult.rawText,
      structuredFacts: ocrResult.structuredFacts
    });

    assert.equal(truth.earliestDeadlineIso, "2026-02-26");
    assert.equal(truth.documentType, "eviction_notice");
  } finally {
    if (previousProvider === undefined) {
      delete process.env.OCR_PROVIDER;
    } else {
      process.env.OCR_PROVIDER = previousProvider;
    }
  }
});

test("formatter output is deterministic for identical truth inputs", async () => {
  const previousProvider = process.env.LLM_PROVIDER;
  process.env.LLM_PROVIDER = "stub";

  try {
    const formatter = createCaseFormatter();
    const truth = buildTruthLayerResult({
      caseId: "case-regression-2",
      assetId: "asset-regression-2",
      extractionId: "ext-regression-2",
      extractionEngine: "stub-deterministic-ocr",
      extractionCreatedAt: new Date("2026-02-12T00:00:00.000Z"),
      rawText: "SUMMONS COMPLAINT. Respond by 2026-03-01.",
      structuredFacts: {
        source: "deterministic_stub",
        fileName: "summons-deadline-2026-03-01.jpg",
        mimeType: "image/jpeg"
      }
    });

    const first = await formatter.format({
      caseId: "case-regression-2",
      extractionId: "ext-regression-2",
      truth
    });
    const second = await formatter.format({
      caseId: "case-regression-2",
      extractionId: "ext-regression-2",
      truth
    });

    assert.equal(first.inputHash, second.inputHash);
    assert.deepEqual(first.outputJson, second.outputJson);
    assert.equal(first.plainEnglishExplanation, second.plainEnglishExplanation);
    assert.equal(first.nonLegalAdviceDisclaimer, second.nonLegalAdviceDisclaimer);
  } finally {
    if (previousProvider === undefined) {
      delete process.env.LLM_PROVIDER;
    } else {
      process.env.LLM_PROVIDER = previousProvider;
    }
  }
});
