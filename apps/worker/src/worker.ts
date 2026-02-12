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
  userDescription?: string;
  forceFail?: boolean;
  [key: string]: unknown;
};

type ProcessingStage =
  | "parse_message"
  | "validate_message"
  | "load_asset"
  | "idempotency_check"
  | "ocr_stage"
  | "truth_stage"
  | "formatter_stage"
  | "delete_message"
  | "unknown";

type ProcessingContext = {
  queueMessageId: string;
  stage: ProcessingStage;
  caseId?: string;
  assetId?: string;
  extractionId?: string;
  verdictId?: string;
  payloadType?: string;
};

type StageOutcome = {
  extractionId: string;
  truthDocumentType: string;
  truthClassificationConfidence: number;
  truthTimeSensitive: boolean;
  truthEarliestDeadlineIso: string | null;
  verdictId: string | null;
  llmModel: string | null;
  replayMode: "fresh" | "resume_from_extraction" | "already_completed";
};

class WorkerProcessingError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly context: ProcessingContext;

  constructor(params: {
    code: string;
    message: string;
    retryable: boolean;
    context: ProcessingContext;
    cause?: unknown;
  }) {
    super(params.message);
    this.name = "WorkerProcessingError";
    this.code = params.code;
    this.retryable = params.retryable;
    this.context = params.context;
    if (params.cause !== undefined) {
      Object.defineProperty(this, "cause", { value: params.cause, enumerable: false });
    }
  }
}

const NON_RETRYABLE_PRISMA_CODES = new Set(["P2002", "P2025"]);

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

function makeWorkerError(params: {
  code: string;
  message: string;
  retryable: boolean;
  context: ProcessingContext;
  cause?: unknown;
}): WorkerProcessingError {
  return new WorkerProcessingError(params);
}

function normalizeWorkerError(
  error: unknown,
  fallbackContext: ProcessingContext
): WorkerProcessingError {
  if (error instanceof WorkerProcessingError) {
    return new WorkerProcessingError({
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      context: {
        ...fallbackContext,
        ...error.context
      },
      cause: (error as { cause?: unknown }).cause
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return new WorkerProcessingError({
      code: `PRISMA_${error.code}`,
      message: error.message,
      retryable: !NON_RETRYABLE_PRISMA_CODES.has(error.code),
      context: fallbackContext,
      cause: error
    });
  }

  if (error instanceof Error) {
    return new WorkerProcessingError({
      code: "UNHANDLED_ERROR",
      message: error.message,
      retryable: true,
      context: fallbackContext,
      cause: error
    });
  }

  return new WorkerProcessingError({
    code: "UNHANDLED_NON_ERROR_THROW",
    message: String(error),
    retryable: true,
    context: fallbackContext
  });
}

function getErrorDiagnostics(error: WorkerProcessingError): Record<string, unknown> {
  const cause = (error as { cause?: unknown }).cause;
  const causeInfo =
    cause instanceof Error
      ? {
          name: cause.name,
          message: cause.message,
          stack: cause.stack ?? null
        }
      : cause === undefined
        ? null
        : {
            value: String(cause)
          };

  return {
    code: error.code,
    retryable: error.retryable,
    message: error.message,
    name: error.name,
    stack: error.stack ?? null,
    cause: causeInfo
  };
}

function parsePayload(message: Message): WorkerMessagePayload {
  const messageId = message.MessageId ?? "unknown";
  const body = message.Body ?? "";

  let parsedBody: unknown = body;
  if (body) {
    try {
      parsedBody = JSON.parse(body);
    } catch {
      throw makeWorkerError({
        code: "INVALID_MESSAGE_JSON",
        message: "Message body is not valid JSON.",
        retryable: false,
        context: {
          queueMessageId: messageId,
          stage: "parse_message"
        }
      });
    }
  }

  if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
    throw makeWorkerError({
      code: "INVALID_MESSAGE_BODY",
      message: "Message body must be a JSON object.",
      retryable: false,
      context: {
        queueMessageId: messageId,
        stage: "parse_message"
      }
    });
  }

  return parsedBody as WorkerMessagePayload;
}

async function writeFailureAudit(error: WorkerProcessingError): Promise<void> {
  if (!error.context.caseId && !error.context.assetId) {
    return;
  }

  try {
    await prisma.auditLog.create({
      data: {
        caseId: error.context.caseId ?? null,
        assetId: error.context.assetId ?? null,
        extractionId: error.context.extractionId ?? null,
        verdictId: error.context.verdictId ?? null,
        eventType: AuditEventType.CASE_UPDATED,
        actorType: "worker",
        payload: {
          subtype: "worker_failure",
          queueMessageId: error.context.queueMessageId,
          stage: error.context.stage,
          payloadType: error.context.payloadType ?? null,
          diagnostics: getErrorDiagnostics(error)
        } as Prisma.InputJsonValue
      }
    });
  } catch (auditError) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "worker_failure_audit_write_failed",
        queueMessageId: error.context.queueMessageId,
        auditError:
          auditError instanceof Error
            ? { name: auditError.name, message: auditError.message }
            : { value: String(auditError) }
      })
    );
  }
}

async function writeReplayAudit(params: {
  queueMessageId: string;
  caseId: string;
  assetId: string;
  extractionId: string;
  verdictId: string;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      caseId: params.caseId,
      assetId: params.assetId,
      extractionId: params.extractionId,
      verdictId: params.verdictId,
      eventType: AuditEventType.CASE_UPDATED,
      actorType: "worker",
      payload: {
        subtype: "worker_replay_skipped",
        queueMessageId: params.queueMessageId,
        reason: "asset_already_completed"
      } as Prisma.InputJsonValue
    }
  });
}

async function processAssetUploadedMessage(
  queueMessageId: string,
  payload: WorkerMessagePayload
): Promise<StageOutcome> {
  const context: ProcessingContext = {
    queueMessageId,
    stage: "validate_message",
    payloadType: payload.type
  };

  try {
    if (!payload.caseId || !payload.assetId) {
      throw makeWorkerError({
        code: "INVALID_ASSET_UPLOADED_PAYLOAD",
        message: "asset_uploaded message must include caseId and assetId.",
        retryable: false,
        context
      });
    }

    context.caseId = payload.caseId;
    context.assetId = payload.assetId;
    const userDescriptionRaw =
      typeof payload.userDescription === "string" ? payload.userDescription.trim() : "";
    const hasUserDescription = Boolean(userDescriptionRaw);
    const userDescription = hasUserDescription ? userDescriptionRaw : undefined;

    context.stage = "load_asset";
    const asset = await prisma.asset.findFirst({
      where: {
        id: payload.assetId,
        caseId: payload.caseId
      }
    });
    if (!asset) {
      throw makeWorkerError({
        code: "ASSET_NOT_FOUND",
        message: `Asset not found for caseId='${payload.caseId}' assetId='${payload.assetId}'.`,
        retryable: false,
        context
      });
    }

    context.stage = "idempotency_check";
    const completedExtraction = await prisma.extraction.findFirst({
      where: {
        assetId: asset.id,
        verdicts: {
          some: {}
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      select: {
        id: true,
        caseId: true,
        assetId: true,
        verdicts: {
          orderBy: {
            createdAt: "desc"
          },
          take: 1,
          select: {
            id: true,
            llmModel: true
          }
        }
      }
    });

    if (completedExtraction && completedExtraction.verdicts.length > 0 && !hasUserDescription) {
      const verdict = completedExtraction.verdicts[0];
      context.extractionId = completedExtraction.id;
      context.verdictId = verdict.id;
      await writeReplayAudit({
        queueMessageId,
        caseId: completedExtraction.caseId,
        assetId: completedExtraction.assetId,
        extractionId: completedExtraction.id,
        verdictId: verdict.id
      });

      return {
        extractionId: completedExtraction.id,
        truthDocumentType: "already_computed",
        truthClassificationConfidence: 0,
        truthTimeSensitive: false,
        truthEarliestDeadlineIso: null,
        verdictId: verdict.id,
        llmModel: verdict.llmModel,
        replayMode: "already_completed"
      };
    }

    const existingExtraction = hasUserDescription
      ? null
      : await prisma.extraction.findFirst({
          where: {
            assetId: asset.id
          },
          orderBy: {
            createdAt: "desc"
          },
          select: {
            id: true,
            caseId: true,
            assetId: true,
            engine: true,
            engineVersion: true,
            rawText: true,
            structuredFacts: true,
            createdAt: true
          }
        });

    const extraction =
      existingExtraction ??
      (await (async () => {
        context.stage = "ocr_stage";
        const ocr = await ocrProvider.run({
          caseId: asset.caseId,
          assetId: asset.id,
          s3Key: asset.s3Key,
          fileName: asset.fileName,
          mimeType: asset.mimeType,
          userDescription
        });

        const createdExtraction = await prisma.$transaction(async (tx) => {
          const created = await tx.extraction.create({
            data: {
              caseId: asset.caseId,
              assetId: asset.id,
              engine: ocr.engine,
              engineVersion: ocr.engineVersion,
              rawText: ocr.rawText,
              structuredFacts: ocr.structuredFacts as Prisma.InputJsonValue
            },
            select: {
              id: true,
              caseId: true,
              assetId: true,
              engine: true,
              engineVersion: true,
              rawText: true,
              structuredFacts: true,
              createdAt: true
            }
          });

          await tx.auditLog.create({
            data: {
              caseId: asset.caseId,
              assetId: asset.id,
              extractionId: created.id,
              eventType: AuditEventType.OCR_RUN,
              actorType: "worker",
              payload: {
                queueMessageId,
                provider: ocr.engine,
                status: "succeeded",
                replayMode: "fresh",
                hasUserDescription: Boolean(userDescription)
              } as Prisma.InputJsonValue
            }
          });

          return created;
        });

        return createdExtraction;
      })());

    context.extractionId = extraction.id;

    const truthLayer = buildTruthLayerResult({
      caseId: extraction.caseId,
      assetId: extraction.assetId,
      extractionId: extraction.id,
      extractionEngine: extraction.engine,
      extractionCreatedAt: extraction.createdAt,
      rawText: extraction.rawText,
      structuredFacts: extraction.structuredFacts
    });

    context.stage = "truth_stage";
    const truthDeadlineDate = truthLayer.earliestDeadlineIso
      ? new Date(`${truthLayer.earliestDeadlineIso}T00:00:00.000Z`)
      : null;

    const existingTruthAudit = await prisma.auditLog.findFirst({
      where: {
        eventType: AuditEventType.TRUTH_LAYER_RUN,
        extractionId: extraction.id
      },
      select: {
        id: true
      }
    });

    const truthUpdate = existingTruthAudit
      ? await prisma.case.findUnique({
          where: { id: extraction.caseId },
          select: {
            documentType: true,
            classificationConfidence: true,
            timeSensitive: true,
            earliestDeadline: true
          }
        })
      : await prisma.$transaction(async (tx) => {
          const existingCase = await tx.case.findUnique({
            where: { id: extraction.caseId },
            select: {
              documentType: true,
              classificationConfidence: true,
              timeSensitive: true,
              earliestDeadline: true
            }
          });

          if (!existingCase) {
            throw makeWorkerError({
              code: "CASE_NOT_FOUND_FOR_TRUTH_LAYER",
              message: `Case not found for truth-layer update: caseId='${extraction.caseId}'.`,
              retryable: false,
              context
            });
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
            where: { id: extraction.caseId },
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
              caseId: extraction.caseId,
              assetId: extraction.assetId,
              extractionId: extraction.id,
              eventType: AuditEventType.TRUTH_LAYER_RUN,
              actorType: "worker",
              payload: {
                queueMessageId,
                status: "succeeded",
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

          return updatedCase;
        });

    if (!truthUpdate) {
      throw makeWorkerError({
        code: "CASE_NOT_FOUND_AFTER_TRUTH_LAYER",
        message: `Case not found when reading truth state: caseId='${extraction.caseId}'.`,
        retryable: false,
        context
      });
    }

    context.stage = "formatter_stage";
    const existingVerdict = await prisma.verdict.findFirst({
      where: {
        extractionId: extraction.id
      },
      orderBy: {
        createdAt: "desc"
      },
      select: {
        id: true,
        llmModel: true,
        inputHash: true
      }
    });

    const verdict =
      existingVerdict ??
      (await (async () => {
        const formatted = await formatter.format({
          caseId: extraction.caseId,
          extractionId: extraction.id,
          truth: truthLayer
        });

        return prisma.$transaction(async (tx) => {
          const createdVerdict = await tx.verdict.create({
            data: {
              caseId: extraction.caseId,
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
            where: { id: extraction.caseId },
            data: {
              plainEnglishExplanation: formatted.plainEnglishExplanation,
              nonLegalAdviceDisclaimer: formatted.nonLegalAdviceDisclaimer
            }
          });

          await tx.auditLog.create({
            data: {
              caseId: extraction.caseId,
              assetId: extraction.assetId,
              extractionId: extraction.id,
              verdictId: createdVerdict.id,
              eventType: AuditEventType.LLM_FORMAT_RUN,
              actorType: "worker",
              payload: {
                queueMessageId,
                status: "succeeded",
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
      })());

    context.verdictId = verdict.id;

    return {
      extractionId: extraction.id,
      truthDocumentType: truthUpdate.documentType ?? "unknown_legal_document",
      truthClassificationConfidence: truthUpdate.classificationConfidence ?? 0,
      truthTimeSensitive: truthUpdate.timeSensitive,
      truthEarliestDeadlineIso: truthUpdate.earliestDeadline?.toISOString() ?? null,
      verdictId: verdict.id,
      llmModel: verdict.llmModel,
      replayMode: existingExtraction ? "resume_from_extraction" : "fresh"
    };
  } catch (error) {
    throw normalizeWorkerError(error, context);
  }
}

async function handleMessage(message: Message): Promise<void> {
  const messageId = message.MessageId ?? "unknown";
  const receipt = message.ReceiptHandle ? "present" : "missing";
  const payload = parsePayload(message);

  if ("forceFail" in payload && payload.forceFail === true) {
    throw makeWorkerError({
      code: "FORCED_MESSAGE_FAILURE",
      message: "Forced message failure (forceFail=true).",
      retryable: true,
      context: {
        queueMessageId: messageId,
        stage: "validate_message",
        caseId: typeof payload.caseId === "string" ? payload.caseId : undefined,
        assetId: typeof payload.assetId === "string" ? payload.assetId : undefined,
        payloadType: typeof payload.type === "string" ? payload.type : undefined
      }
    });
  }

  if (payload.type === "asset_uploaded") {
    const outcome = await processAssetUploadedMessage(messageId, payload);
    console.log(
      JSON.stringify({
        level: "info",
        msg: "worker_asset_processed",
        queueMessageId: messageId,
        caseId: payload.caseId ?? null,
        assetId: payload.assetId ?? null,
        extractionId: outcome.extractionId,
        truthLayer: {
          documentType: outcome.truthDocumentType,
          classificationConfidence: outcome.truthClassificationConfidence,
          timeSensitive: outcome.truthTimeSensitive,
          earliestDeadline: outcome.truthEarliestDeadlineIso
        },
        verdictId: outcome.verdictId,
        llmModel: outcome.llmModel,
        replayMode: outcome.replayMode
      })
    );
    return;
  }

  console.log(
    JSON.stringify({
      level: "info",
      msg: "worker_message_received",
      messageId,
      receiptHandle: receipt,
      payload
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
      throw makeWorkerError({
        code: "MISSING_RECEIPT_HANDLE",
        message: "Missing ReceiptHandle on message.",
        retryable: true,
        context: {
          queueMessageId: messageId,
          stage: "delete_message"
        }
      });
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
    const normalizedError = normalizeWorkerError(error, {
      queueMessageId: messageId,
      stage: "unknown"
    });

    await writeFailureAudit(normalizedError);

    console.error(
      JSON.stringify({
        level: "error",
        msg: "worker_message_failed",
        messageId,
        retryable: normalizedError.retryable,
        stage: normalizedError.context.stage,
        code: normalizedError.code,
        error: normalizedError.message
      })
    );

    if (!normalizedError.retryable && message.ReceiptHandle) {
      try {
        await client.send(
          new DeleteMessageCommand({
            QueueUrl: config.queueUrl,
            ReceiptHandle: message.ReceiptHandle
          })
        );
        console.log(
          JSON.stringify({
            level: "warn",
            msg: "worker_message_dropped_non_retryable",
            messageId,
            code: normalizedError.code
          })
        );
      } catch (deleteError) {
        console.error(
          JSON.stringify({
            level: "error",
            msg: "worker_non_retryable_drop_failed",
            messageId,
            code: normalizedError.code,
            error: deleteError instanceof Error ? deleteError.message : String(deleteError)
          })
        );
      }
    }
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
