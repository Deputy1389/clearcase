import "dotenv/config";
import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
  type Message
} from "@aws-sdk/client-sqs";

type WorkerConfig = {
  region: string;
  queueUrl: string;
  waitTimeSeconds: number;
  visibilityTimeoutSeconds: number;
};

const DEFAULT_WAIT_TIME_SECONDS = 20;
const DEFAULT_VISIBILITY_TIMEOUT_SECONDS = 30;

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

  if (
    parsedBody &&
    typeof parsedBody === "object" &&
    "forceFail" in parsedBody &&
    (parsedBody as { forceFail?: unknown }).forceFail === true
  ) {
    throw new Error("Forced message failure (forceFail=true).");
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
