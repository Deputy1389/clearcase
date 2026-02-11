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

type WorkerConfig = {
  region: string;
  queueUrl: string;
  waitTimeSeconds: number;
  visibilityTimeoutSeconds: number;
};

const DEFAULT_WAIT_TIME_SECONDS = 20;
const DEFAULT_VISIBILITY_TIMEOUT_SECONDS = 30;
const ocrProvider = createOcrProvider();

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

    console.log(
      JSON.stringify({
        level: "info",
        msg: "worker_asset_processed",
        caseId: asset.caseId,
        assetId: asset.id,
        extractionId: extraction.id
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
