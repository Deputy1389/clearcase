export type OcrInput = {
  assetId: string;
  caseId: string;
  s3Key: string;
  fileName: string;
  mimeType: string;
};

export type OcrResult = {
  engine: string;
  engineVersion?: string;
  rawText: string;
  structuredFacts: Record<string, unknown>;
};

export interface OcrProvider {
  run(input: OcrInput): Promise<OcrResult>;
}

class DeterministicStubOcrProvider implements OcrProvider {
  async run(input: OcrInput): Promise<OcrResult> {
    const rawText = [
      "CLEARCASE OCR STUB OUTPUT",
      `CASE: ${input.caseId}`,
      `ASSET: ${input.assetId}`,
      `FILE: ${input.fileName}`,
      `MIME: ${input.mimeType}`,
      `S3: ${input.s3Key}`
    ].join("\n");

    return {
      engine: "stub-deterministic-ocr",
      engineVersion: "v1",
      rawText,
      structuredFacts: {
        source: "deterministic_stub",
        fileName: input.fileName,
        mimeType: input.mimeType,
        s3Key: input.s3Key
      }
    };
  }
}

export function createOcrProvider(): OcrProvider {
  const provider = process.env.OCR_PROVIDER?.trim() ?? "stub";

  if (provider === "stub") {
    return new DeterministicStubOcrProvider();
  }

  throw new Error(
    `Unsupported OCR_PROVIDER='${provider}'. Only OCR_PROVIDER=stub is currently implemented.`
  );
}
