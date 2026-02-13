import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createGoogleVisionOcrProvider, createOcrProvider } from "./ocr.ts";

function fixturePath(name: string): string {
  return path.resolve(process.cwd(), "testdocs", "highanxiety", name);
}

test("createOcrProvider defaults to stub", async () => {
  const provider = createOcrProvider({ provider: "stub" });
  const result = await provider.run({
    caseId: "case-ocr-1",
    assetId: "asset-ocr-1",
    s3Key: "cases/case-ocr-1/assets/file.jpg",
    fileName: "deadline-2026-03-01.jpg",
    mimeType: "image/jpeg"
  });

  assert.equal(result.engine, "stub-deterministic-ocr");
  assert.equal(result.engineVersion, "v1");
  assert.equal(result.rawText.includes("deadline-2026-03-01.jpg"), true);
  assert.equal(typeof result.structuredFacts.source, "string");
});

test("createOcrProvider supports google_vision provider selection via factory", async () => {
  let called = 0;
  const provider = createOcrProvider({
    provider: "google_vision",
    googleVisionFactory: () => {
      called += 1;
      return {
        async run() {
          return {
            engine: "google-vision-document-ocr",
            engineVersion: "test-v1",
            rawText: "sample",
            structuredFacts: {}
          };
        }
      };
    }
  });

  assert.equal(called, 1);
  const result = await provider.run({
    caseId: "case-ocr-2",
    assetId: "asset-ocr-2",
    s3Key: "cases/case-ocr-2/assets/file.pdf",
    fileName: "sample.pdf",
    mimeType: "application/pdf"
  });
  assert.equal(result.engine, "google-vision-document-ocr");
});

test("createOcrProvider rejects unsupported provider values", () => {
  assert.throws(
    () => createOcrProvider({ provider: "unsupported-provider" }),
    /Unsupported OCR_PROVIDER/
  );
});

test("google vision provider uses PDF direct text path when embedded text is meaningful", async () => {
  const bytes = readFileSync(fixturePath("sample-digital-text.pdf"));
  let visionCalls = 0;

  const provider = createGoogleVisionOcrProvider({
    bucket: "unit-test-bucket",
    engineVersion: "unit-v1",
    fetchS3Object: async ({ bucket, key }) => {
      return {
        bytes: new Uint8Array(bytes),
        sourceMetadata: {
          bucket,
          s3Key: key,
          contentLength: bytes.byteLength,
          etag: "etag-1",
          lastModified: "2026-02-12T00:00:00.000Z"
        }
      };
    },
    runGoogleVision: async () => {
      visionCalls += 1;
      return {
        fullTextAnnotation: {
          text: "VISION SHOULD NOT RUN"
        }
      };
    }
  });

  const result = await provider.run({
    caseId: "case-ocr-pdf-direct",
    assetId: "asset-ocr-pdf-direct",
    s3Key: "cases/case-ocr-pdf-direct/assets/sample-digital-text.pdf",
    fileName: "sample-digital-text.pdf",
    mimeType: "application/pdf"
  });

  assert.equal(visionCalls, 0);
  assert.equal(result.engine, "pdf-text-direct");
  assert.equal(result.providerMetadata?.processingPath, "pdf_text_direct");
  assert.equal(result.providerMetadata?.pageCount, 2);
  assert.equal(result.providerMetadata?.pageUnitEstimate, 2);
  assert.equal(result.rawText.includes("NOTICE OF HEARING"), true);
});

test("google vision provider falls back to OCR when PDF has no embedded text", async () => {
  const bytes = readFileSync(fixturePath("sample-scanned-page.pdf"));
  let visionCalls = 0;

  const provider = createGoogleVisionOcrProvider({
    bucket: "unit-test-bucket",
    engineVersion: "unit-v1",
    fetchS3Object: async ({ bucket, key }) => {
      return {
        bytes: new Uint8Array(bytes),
        sourceMetadata: {
          bucket,
          s3Key: key,
          contentLength: bytes.byteLength,
          etag: "etag-scan",
          lastModified: "2026-02-12T00:00:00.000Z"
        }
      };
    },
    runGoogleVision: async () => {
      visionCalls += 1;
      return {
        fullTextAnnotation: {
          text: "SCANNED LEGAL NOTICE",
          pages: [
            {
              width: 1000,
              height: 1400,
              confidence: 0.92,
              blocks: []
            }
          ]
        }
      };
    }
  });

  const result = await provider.run({
    caseId: "case-ocr-pdf-fallback",
    assetId: "asset-ocr-pdf-fallback",
    s3Key: "cases/case-ocr-pdf-fallback/assets/sample-scanned-page.pdf",
    fileName: "sample-scanned-page.pdf",
    mimeType: "application/pdf"
  });

  assert.equal(visionCalls, 1);
  assert.equal(result.engine, "google-vision-document-ocr");
  assert.equal(result.providerMetadata?.processingPath, "google_vision");
  assert.equal((result.providerMetadata?.pdfTextProbe as Record<string, unknown>)?.meaningfulTextDetected, false);
  assert.equal(
    (result.providerMetadata?.pdfTextProbe as Record<string, unknown>)?.scannedPageOnlyOcrApplied,
    false
  );
});

test("google vision provider supports deterministic cache hit reuse before OCR call", async () => {
  const bytes = readFileSync(fixturePath("sample-digital-text.pdf"));
  let visionCalls = 0;

  const provider = createGoogleVisionOcrProvider({
    bucket: "unit-test-bucket",
    engineVersion: "unit-v1",
    fetchS3Object: async ({ bucket, key }) => {
      return {
        bytes: new Uint8Array(bytes),
        sourceMetadata: {
          bucket,
          s3Key: key,
          contentLength: bytes.byteLength,
          etag: "etag-cache",
          lastModified: "2026-02-12T00:00:00.000Z"
        }
      };
    },
    runGoogleVision: async () => {
      visionCalls += 1;
      return {
        fullTextAnnotation: {
          text: "VISION SHOULD NOT RUN ON CACHE HIT"
        }
      };
    }
  });

  const result = await provider.run({
    caseId: "case-ocr-cache",
    assetId: "asset-ocr-cache",
    s3Key: "cases/case-ocr-cache/assets/sample-digital-text.pdf",
    fileName: "sample-digital-text.pdf",
    mimeType: "application/pdf",
    cacheLookup: async () => ({
      sourceExtractionId: "ext-cache-123",
      engine: "google-vision-document-ocr",
      engineVersion: "unit-v1",
      rawText: "CACHED OCR TEXT",
      structuredFacts: {
        source: "cached_extraction"
      },
      pageUnitEstimate: 2
    })
  });

  assert.equal(visionCalls, 0);
  assert.equal(result.rawText, "CACHED OCR TEXT");
  assert.equal(result.providerMetadata?.processingPath, "cache_reuse");
  assert.equal(
    (result.providerMetadata?.cache as Record<string, unknown>)?.sourceExtractionId,
    "ext-cache-123"
  );
  assert.equal((result.providerMetadata?.cache as Record<string, unknown>)?.hit, true);
});
