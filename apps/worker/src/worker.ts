import "dotenv/config";
import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
  type Message
} from "@aws-sdk/client-sqs";
import { AuditEventType, Prisma } from "@prisma/client";
import { prisma } from "../../../packages/db/src/client.ts";
import { createOcrProvider } from "./lib/ocr.ts";
import { buildTruthLayerResult } from "./lib/truth-layer.ts";
import { createCaseFormatter } from "./lib/formatter.ts";

type WorkerConfig = {
  region: string;
  queueUrl: string;
  waitTimeSeconds: number;
  visibilityTimeoutSeconds: number;
};

const DEFAULT_WAIT_TIME_SECONDS = 20;
const DEFAULT_VISIBILITY_TIMEOUT_SECONDS = 30;
const ocrProvider = createOcrProvider();
const formatter = createCaseFormatter();
const TRUTH_CONFIDENCE_EPSILON = 0.0001;

type WorkerMessagePayload = {
  type?: string;
  caseId?: string;
  assetId?: string;
  forceFail?: boolean;
  [key: string]: unknown;
};

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function readNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid numeric env var: ${name}=${raw}`);
  }
  return parsed;
}

function loadConfig(): WorkerConfig {
  return {
    region: readRequiredEnv("AWS_REGION"),
    queueUrl: readRequiredEnv("SQS_QUEUE_URL"),
    waitTimeSeconds: readNumberEnv("SQS_WAIT_TIME_SECONDS", DEFAULT_WAIT_TIME_SECONDS),
    visibilityTimeoutSeconds: readNumberEnv(
      "SQS_VISIBILITY_TIMEOUT_SECONDS",
      DEFAULT_VISIBILITY_TIMEOUT_SECONDS
    )
  };
}

function minDate(left: Date | null, right: Date | null): Date | null {
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }
  return left <= right ? left : right;
}

function shouldReplaceClassification(
  currentConfidence: number | null,
  incomingConfidence: number
): boolean {
  if (currentConfidence === null) {
    return true;
  }
  return incomingConfidence + TRUTH_CONFIDENCE_EPSILON >= currentConfidence;
}

async function handleMessage(message: Message): Promise<void> {
  const id = message.MessageId ?? "unknown";
  const receipt = message.ReceiptHandle ? "present" : "missing";
  const body = message.Body ?? "";
  let parsedBody: unknown = body;

  if (body) {
    try {
      parsedBody = JSON.parse(body);
    } catch {
      parsedBody = body;
    }
  }

  if (!parsedBody || typeof parsedBody !== "object") {
    throw new Error("Message body must be a JSON object.");
  }

  const payload = parsedBody as WorkerMessagePayload;
  if (
    "forceFail" in payload &&
    payload.forceFail === true
  ) {
    throw new Error("Forced message failure (forceFail=true).");
  }

  if (payload.type === "asset_uploaded") {
    if (!payload.caseId || !payload.assetId) {
      throw new Error("asset_uploaded message must include caseId and assetId.");
    }

    const asset = await prisma.asset.findFirst({
      where: {
        id: payload.assetId,
        caseId: payload.caseId
      }
    });
    if (!asset) {
      throw new Error(`Asset not found for caseId='${payload.caseId}' assetId='${payload.assetId}'.`);
    }

    const ocr = await ocrProvider.run({
      caseId: asset.caseId,
      assetId: asset.id,
      s3Key: asset.s3Key,
      fileName: asset.fileName,
      mimeType: asset.mimeType
    });

    const extraction = await prisma.extraction.create({
      data: {
        caseId: asset.caseId,
        assetId: asset.id,
        engine: ocr.engine,
        engineVersion: ocr.engineVersion,
        rawText: ocr.rawText,
        structuredFacts: ocr.structuredFacts as Prisma.InputJsonValue
      }
    });

    await prisma.auditLog.create({
      data: {
        caseId: asset.caseId,
        assetId: asset.id,
        extractionId: extraction.id,
        eventType: AuditEventType.OCR_RUN,
        actorType: "worker",
        payload: {
          queueMessageId: id,
          provider: ocr.engine
        } as Prisma.InputJsonValue
      }
    });

    const truthLayer = buildTruthLayerResult({
      caseId: asset.caseId,
      assetId: asset.id,
      extractionId: extraction.id,
      extractionEngine: extraction.engine,
      extractionCreatedAt: extraction.createdAt,
      rawText: extraction.rawText,
      structuredFacts: extraction.structuredFacts
    });

    const truthDeadlineDate = truthLayer.earliestDeadlineIso
      ? new Date(`${truthLayer.earliestDeadlineIso}T00:00:00.000Z`)
      : null;

    const truthUpdate = await prisma.$transaction(async (tx) => {
      const existingCase = await tx.case.findUnique({
        where: { id: asset.caseId },
        select: {
          documentType: true,
          classificationConfidence: true,
          timeSensitive: true,
          earliestDeadline: true
        }
      });

      if (!existingCase) {
        throw new Error(`Case not found for truth-layer update: caseId='${asset.caseId}'.`);
      }

      const replaceClassification = shouldReplaceClassification(
        existingCase.classificationConfidence,
        truthLayer.classificationConfidence
      );

      const nextDocumentType = replaceClassification
        ? truthLayer.documentType
        : existingCase.documentType;
      const nextClassificationConfidence = replaceClassification
        ? truthLayer.classificationConfidence
        : existingCase.classificationConfidence;
      const nextTimeSensitive = existingCase.timeSensitive || truthLayer.timeSensitive;
      const nextEarliestDeadline = minDate(existingCase.earliestDeadline, truthDeadlineDate);

      const updatedCase = await tx.case.update({
        where: { id: asset.caseId },
        data: {
          documentType: nextDocumentType,
          classificationConfidence: nextClassificationConfidence,
          timeSensitive: nextTimeSensitive,
          earliestDeadline: nextEarliestDeadline
        },
        select: {
          documentType: true,
          classificationConfidence: true,
          timeSensitive: true,
          earliestDeadline: true
        }
      });

      await tx.auditLog.create({
        data: {
          caseId: asset.caseId,
          assetId: asset.id,
          extractionId: extraction.id,
          eventType: AuditEventType.TRUTH_LAYER_RUN,
          actorType: "worker",
          payload: {
            queueMessageId: id,
            truthLayer: truthLayer.facts,
            appliedCaseUpdate: {
              documentType: updatedCase.documentType,
              classificationConfidence: updatedCase.classificationConfidence,
              timeSensitive: updatedCase.timeSensitive,
              earliestDeadline: updatedCase.earliestDeadline?.toISOString() ?? null,
              replacedClassification: replaceClassification
            }
          } as Prisma.InputJsonValue
        }
      });

      return {
        documentType: updatedCase.documentType,
        classificationConfidence: updatedCase.classificationConfidence,
        timeSensitive: updatedCase.timeSensitive,
        earliestDeadline: updatedCase.earliestDeadline
      };
    });

    const formatted = await formatter.format({
      caseId: asset.caseId,
      extractionId: extraction.id,
      truth: truthLayer
    });

    const verdict = await prisma.$transaction(async (tx) => {
      const createdVerdict = await tx.verdict.create({
        data: {
          caseId: asset.caseId,
          extractionId: extraction.id,
          llmModel: formatted.llmModel,
          inputHash: formatted.inputHash,
          outputJson: formatted.outputJson as Prisma.InputJsonValue
        },
        select: {
          id: true,
          llmModel: true,
          inputHash: true
        }
      });

      await tx.case.update({
        where: { id: asset.caseId },
        data: {
          plainEnglishExplanation: formatted.plainEnglishExplanation,
          nonLegalAdviceDisclaimer: formatted.nonLegalAdviceDisclaimer
        }
      });

      await tx.auditLog.create({
        data: {
          caseId: asset.caseId,
          assetId: asset.id,
          extractionId: extraction.id,
          verdictId: createdVerdict.id,
          eventType: AuditEventType.LLM_FORMAT_RUN,
          actorType: "worker",
          payload: {
            queueMessageId: id,
            llmModel: createdVerdict.llmModel,
            inputHash: createdVerdict.inputHash,
            source: "structured_truth_layer_only",
            receipts: {
              extractionId: extraction.id,
              documentType: truthLayer.documentType,
              matchedKeywords: truthLayer.matchedKeywords,
              deadlineSignalCount: truthLayer.deadlineSignals.length
            }
          } as Prisma.InputJsonValue
        }
      });

      return createdVerdict;
    });

    console.log(
      JSON.stringify({
        level: "info",
        msg: "worker_asset_processed",
        caseId: asset.caseId,
        assetId: asset.id,
        extractionId: extraction.id,
        truthLayer: {
          documentType: truthUpdate.documentType,
          classificationConfidence: truthUpdate.classificationConfidence,
          timeSensitive: truthUpdate.timeSensitive,
          earliestDeadline: truthUpdate.earliestDeadline?.toISOString() ?? null
        },
        verdictId: verdict.id,
        llmModel: verdict.llmModel
      })
    );

    return;
  }

  // Phase 4 skeleton: consume and acknowledge; domain handling comes in later phases.
  console.log(
    JSON.stringify({
      level: "info",
      msg: "worker_message_received",
      messageId: id,
      receiptHandle: receipt,
      payload: parsedBody
    })
  );
}

async function pollOnce(client: SQSClient, config: WorkerConfig): Promise<void> {
  const receiveResult = await client.send(
    new ReceiveMessageCommand({
      QueueUrl: config.queueUrl,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: config.waitTimeSeconds,
      VisibilityTimeout: config.visibilityTimeoutSeconds
    })
  );

  const message = receiveResult.Messages?.[0];
  if (!message) {
    return;
  }

  const messageId = message.MessageId ?? "unknown";
  try {
    await handleMessage(message);

    if (!message.ReceiptHandle) {
      throw new Error("Missing ReceiptHandle on message.");
    }

    await client.send(
      new DeleteMessageCommand({
        QueueUrl: config.queueUrl,
        ReceiptHandle: message.ReceiptHandle
      })
    );

    console.log(
      JSON.stringify({
        level: "info",
        msg: "worker_message_acked",
        messageId
      })
    );
  } catch (error) {
    // Retry behavior: keep message in queue by not deleting it.
    console.error(
      JSON.stringify({
        level: "error",
        msg: "worker_message_failed",
        messageId,
        error: error instanceof Error ? error.message : String(error)
      })
    );
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  const client = new SQSClient({ region: config.region });

  let keepRunning = true;
  const stop = () => {
    keepRunning = false;
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  console.log(
    JSON.stringify({
      level: "info",
      msg: "worker_started",
      queueUrl: config.queueUrl,
      waitTimeSeconds: config.waitTimeSeconds,
      visibilityTimeoutSeconds: config.visibilityTimeoutSeconds
    })
  );

  while (keepRunning) {
    await pollOnce(client, config);
  }

  console.log(
    JSON.stringify({
      level: "info",
      msg: "worker_stopped"
    })
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      level: "error",
      msg: "worker_crash",
      error: error instanceof Error ? error.message : String(error)
    })
  );
  process.exit(1);
});
