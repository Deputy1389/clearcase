import "dotenv/config";
import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
  type Message
} from "@aws-sdk/client-sqs";
import { randomUUID } from "node:crypto";
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
  maxMessageRetries: number;
};

const DEFAULT_WAIT_TIME_SECONDS = 20;
const DEFAULT_VISIBILITY_TIMEOUT_SECONDS = 30;
const DEFAULT_MAX_MESSAGE_RETRIES = 5;
const ocrProvider = createOcrProvider();
const configuredOcrProvider = (process.env.OCR_PROVIDER?.trim().toLowerCase() || "stub");
const formatter = createCaseFormatter();
const TRUTH_CONFIDENCE_EPSILON = 0.0001;
const PUSH_DELIVERY_SUBTYPE = "push_reminder_delivery";
const PUSH_REMINDER_OFFSETS_DAYS = [14, 7, 3, 1] as const;
const PUSH_REMINDER_DEFAULT_DELIVERY_HOUR_UTC = 14;
const PUSH_DEFAULT_DAILY_LIMIT_PER_USER = 4;
const PUSH_DEFAULT_RETRY_DELAY_SECONDS = 90;
const PUSH_DEFAULT_MAX_RETRIES = 3;
const PUSH_PROCESSING_BATCH_SIZE = 10;

type ReminderOutcome = "scheduled" | "sent" | "failed" | "suppressed";
type NotificationLanguage = "en" | "es";

type PushPreferenceRecord = {
  enabled: boolean;
  language: NotificationLanguage;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
};

type PushReminder = {
  id: string;
  userId: string;
  caseId: string;
  dedupeKey: string;
  deadlineDateIso: string;
  reminderDate: Date;
  offsetDays: number;
  status: "scheduled";
  reason: string | null;
  language: NotificationLanguage;
  attemptCount: number;
  nextAttemptAt: Date;
};

let pushStorageReady: Promise<void> | null = null;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function toPositiveInt(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return null;
  const normalized = Math.floor(parsed);
  if (normalized <= 0) return null;
  return normalized;
}

function derivePageUnitEstimateFromExtractionData(params: {
  providerMetadata: Record<string, unknown> | null;
  sourceMetadata: Record<string, unknown> | null;
  mimeType: string;
}): number {
  const providerValue = toPositiveInt(params.providerMetadata?.pageUnitEstimate);
  if (providerValue) return providerValue;

  const sourceValue = toPositiveInt(params.sourceMetadata?.pageUnitEstimate);
  if (sourceValue) return sourceValue;

  if (params.mimeType.toLowerCase().includes("pdf")) {
    const pageCount = toPositiveInt(params.providerMetadata?.pageCount) ?? toPositiveInt(params.sourceMetadata?.pageCount);
    return pageCount ?? 1;
  }
  return 1;
}

function extractCaseContextFromAuditPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  if (record.subtype !== "case_context_set") {
    return null;
  }
  const description = record.description;
  return typeof description === "string" && description.trim() ? description.trim() : null;
}

function computeCaseReadinessScore(params: {
  hasDocumentType: boolean;
  hasDeadlineSignal: boolean;
  hasSummary: boolean;
  hasContext: boolean;
  assetCount: number;
  extractionCount: number;
  verdictCount: number;
  classificationConfidence: number | null;
}): { score: number; components: Record<string, boolean> } {
  const hasMultipleAssets = params.assetCount >= 2;
  const hasExtraction = params.extractionCount > 0;
  const hasVerdict = params.verdictCount > 0;
  const confidenceKnown = params.classificationConfidence !== null;

  const components = {
    documentType: params.hasDocumentType,
    deadlineSignal: params.hasDeadlineSignal,
    summary: params.hasSummary,
    context: params.hasContext,
    assets: hasMultipleAssets,
    extraction: hasExtraction,
    verdict: hasVerdict,
    confidenceKnown
  };

  const total = Object.keys(components).length;
  const met = Object.values(components).filter(Boolean).length;
  return {
    score: Math.round((met / total) * 100),
    components
  };
}

async function writeCaseReadinessSnapshotAudit(input: {
  caseId: string;
  queueMessageId: string;
  extractionId: string | null;
  verdictId: string | null;
  source: "worker_processed" | "worker_replay";
}): Promise<void> {
  const [caseState, counts, logs] = await Promise.all([
    prisma.case.findUnique({
      where: { id: input.caseId },
      select: {
        documentType: true,
        earliestDeadline: true,
        plainEnglishExplanation: true,
        classificationConfidence: true
      }
    }),
    prisma.case.findUnique({
      where: { id: input.caseId },
      select: {
        _count: {
          select: {
            assets: true,
            extractions: true,
            verdicts: true
          }
        }
      }
    }),
    prisma.auditLog.findMany({
      where: {
        caseId: input.caseId,
        eventType: AuditEventType.CASE_UPDATED
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 30,
      select: {
        payload: true
      }
    })
  ]);

  const hasContext = logs
    .map((row) => extractCaseContextFromAuditPayload(row.payload))
    .some((value) => Boolean(value));

  const readiness = computeCaseReadinessScore({
    hasDocumentType: Boolean(caseState?.documentType),
    hasDeadlineSignal: Boolean(caseState?.earliestDeadline),
    hasSummary: Boolean(caseState?.plainEnglishExplanation),
    hasContext,
    assetCount: counts?._count.assets ?? 0,
    extractionCount: counts?._count.extractions ?? 0,
    verdictCount: counts?._count.verdicts ?? 0,
    classificationConfidence: caseState?.classificationConfidence ?? null
  });

  await prisma.auditLog.create({
    data: {
      caseId: input.caseId,
      extractionId: input.extractionId ?? undefined,
      verdictId: input.verdictId ?? undefined,
      eventType: AuditEventType.CASE_UPDATED,
      actorType: "worker",
      payload: {
        subtype: "case_readiness_snapshot",
        source: input.source,
        queueMessageId: input.queueMessageId,
        score: readiness.score,
        components: readiness.components
      } as Prisma.InputJsonValue
    }
  });
}

function parseBooleanEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === "1" || raw === "true" || raw === "yes" || raw === "on") return true;
  if (raw === "0" || raw === "false" || raw === "no" || raw === "off") return false;
  return fallback;
}

function parsePositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function pushNotificationsEnabled(): boolean {
  return parseBooleanEnv("PUSH_NOTIFICATIONS_ENABLED", true);
}

function pushDailyLimitPerUser(): number {
  return parsePositiveIntEnv("PUSH_NOTIFICATIONS_DAILY_LIMIT_PER_USER", PUSH_DEFAULT_DAILY_LIMIT_PER_USER);
}

function pushRetryDelaySeconds(): number {
  return parsePositiveIntEnv("PUSH_NOTIFICATIONS_RETRY_DELAY_SECONDS", PUSH_DEFAULT_RETRY_DELAY_SECONDS);
}

function pushMaxRetries(): number {
  return parsePositiveIntEnv("PUSH_NOTIFICATIONS_MAX_RETRIES", PUSH_DEFAULT_MAX_RETRIES);
}

function parseNotificationLanguage(value: unknown): NotificationLanguage | null {
  if (value === "en" || value === "es") return value;
  return null;
}

function parseReminderOutcome(value: unknown): ReminderOutcome | null {
  if (value === "scheduled" || value === "sent" || value === "failed" || value === "suppressed") {
    return value;
  }
  return null;
}

function asDateOrNull(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function isoDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function buildReminderDate(deadlineDateIso: string, offsetDays: number): Date {
  const value = new Date(`${deadlineDateIso}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - offsetDays);
  value.setUTCHours(PUSH_REMINDER_DEFAULT_DELIVERY_HOUR_UTC, 0, 0, 0);
  return value;
}

function reminderDedupeKey(caseId: string, deadlineDateIso: string, offsetDays: number): string {
  return `${caseId}:${deadlineDateIso}:T-${offsetDays}`;
}

function utcDayRange(reference: Date): { start: Date; end: Date } {
  const start = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate(), 0, 0, 0, 0)
  );
  const end = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate() + 1, 0, 0, 0, 0)
  );
  return { start, end };
}

function parseHourMinute(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours * 60 + minutes;
}

function isWithinQuietHours(now: Date, quietStart: string | null, quietEnd: string | null): boolean {
  const start = parseHourMinute(quietStart);
  const end = parseHourMinute(quietEnd);
  if (start === null || end === null) return false;
  if (start === end) return true;
  const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  if (start < end) {
    return currentMinutes >= start && currentMinutes < end;
  }
  return currentMinutes >= start || currentMinutes < end;
}

function pushTemplate(language: NotificationLanguage, offsetDays: number, deadlineIso: string): {
  title: string;
  body: string;
} {
  if (language === "es") {
    return {
      title: "Recordatorio de continuidad del caso",
      body: `Seguimiento calmado: posible fecha en ${offsetDays} dias (${deadlineIso}).`
    };
  }
  return {
    title: "Case continuity reminder",
    body: `Calm watch update: possible date in ${offsetDays} days (${deadlineIso}).`
  };
}

async function ensurePushStorage(): Promise<void> {
  if (!pushStorageReady) {
    pushStorageReady = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "UserNotificationPreference" (
          "id" TEXT PRIMARY KEY,
          "userId" TEXT NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE,
          "enabled" BOOLEAN NOT NULL DEFAULT false,
          "language" TEXT NOT NULL CHECK ("language" IN ('en', 'es')) DEFAULT 'en',
          "quietHoursStart" TEXT NULL,
          "quietHoursEnd" TEXT NULL,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "UserPushDevice" (
          "id" TEXT PRIMARY KEY,
          "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
          "deviceId" TEXT NOT NULL,
          "platform" TEXT NOT NULL CHECK ("platform" IN ('ios', 'android', 'web')),
          "token" TEXT NOT NULL,
          "language" TEXT NOT NULL CHECK ("language" IN ('en', 'es')) DEFAULT 'en',
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "lastSeenAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "UserPushDevice_userId_deviceId_key"
        ON "UserPushDevice"("userId", "deviceId")
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "DeadlinePushReminder" (
          "id" TEXT PRIMARY KEY,
          "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
          "caseId" TEXT NOT NULL REFERENCES "Case"("id") ON DELETE CASCADE,
          "dedupeKey" TEXT NOT NULL UNIQUE,
          "deadlineDate" DATE NOT NULL,
          "reminderDate" TIMESTAMPTZ NOT NULL,
          "offsetDays" INTEGER NOT NULL CHECK ("offsetDays" IN (14, 7, 3, 1)),
          "status" TEXT NOT NULL CHECK ("status" IN ('scheduled', 'sent', 'failed', 'suppressed')) DEFAULT 'scheduled',
          "reason" TEXT NULL,
          "language" TEXT NOT NULL CHECK ("language" IN ('en', 'es')) DEFAULT 'en',
          "attemptCount" INTEGER NOT NULL DEFAULT 0,
          "nextAttemptAt" TIMESTAMPTZ NOT NULL,
          "sentAt" TIMESTAMPTZ NULL,
          "suppressedAt" TIMESTAMPTZ NULL,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "DeadlinePushReminder_due_idx"
        ON "DeadlinePushReminder"("status", "nextAttemptAt")
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "DeadlinePushReminder_caseId_status_idx"
        ON "DeadlinePushReminder"("caseId", "status")
      `);
    })();
  }
  await pushStorageReady;
}

async function getOrCreatePushPreference(userId: string): Promise<PushPreferenceRecord> {
  await ensurePushStorage();
  const rows = await prisma.$queryRaw<
    Array<{
      enabled: boolean;
      language: string;
      quietHoursStart: string | null;
      quietHoursEnd: string | null;
    }>
  >(Prisma.sql`
    SELECT
      pref."enabled" AS "enabled",
      pref."language" AS "language",
      pref."quietHoursStart" AS "quietHoursStart",
      pref."quietHoursEnd" AS "quietHoursEnd"
    FROM "UserNotificationPreference" pref
    WHERE pref."userId" = ${userId}
    LIMIT 1
  `);
  const language = parseNotificationLanguage(rows[0]?.language ?? null);
  if (rows.length > 0 && language) {
    return {
      enabled: rows[0].enabled === true,
      language,
      quietHoursStart: rows[0].quietHoursStart ?? null,
      quietHoursEnd: rows[0].quietHoursEnd ?? null
    };
  }

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "UserNotificationPreference" (
      "id", "userId", "enabled", "language", "quietHoursStart", "quietHoursEnd", "createdAt", "updatedAt"
    )
    VALUES (${randomUUID()}, ${userId}, false, 'en', NULL, NULL, NOW(), NOW())
    ON CONFLICT ("userId") DO NOTHING
  `);

  return {
    enabled: false,
    language: "en",
    quietHoursStart: null,
    quietHoursEnd: null
  };
}

async function listActivePushDeviceTokens(userId: string): Promise<Array<{ token: string; language: NotificationLanguage }>> {
  await ensurePushStorage();
  const rows = await prisma.$queryRaw<Array<{ token: string; language: string }>>(Prisma.sql`
    SELECT "token" AS "token", "language" AS "language"
    FROM "UserPushDevice"
    WHERE "userId" = ${userId}
      AND "isActive" = true
    ORDER BY "updatedAt" DESC
  `);
  return rows
    .map((row) => ({
      token: row.token,
      language: parseNotificationLanguage(row.language)
    }))
    .filter((row): row is { token: string; language: NotificationLanguage } => Boolean(row.language));
}

async function latestWatchModeEnabled(caseId: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ enabled: boolean | null }>>(Prisma.sql`
    SELECT (log."payload"->>'enabled')::boolean AS "enabled"
    FROM "AuditLog" log
    WHERE log."caseId" = ${caseId}
      AND log."eventType" = 'CASE_UPDATED'::"AuditEventType"
      AND (log."payload"->>'subtype') = 'case_watch_mode_set'
    ORDER BY log."createdAt" DESC
    LIMIT 1
  `);
  return rows[0]?.enabled === true;
}

async function writePushReminderAudit(params: {
  caseId: string;
  userId: string;
  reminderId: string;
  dedupeKey: string;
  outcome: ReminderOutcome;
  reason: string | null;
  reminderDate: Date;
  deadlineDateIso: string;
  offsetDays: number;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        caseId: params.caseId,
        eventType: AuditEventType.CASE_UPDATED,
        actorType: "worker",
        payload: {
          subtype: PUSH_DELIVERY_SUBTYPE,
          userId: params.userId,
          reminderId: params.reminderId,
          dedupeKey: params.dedupeKey,
          outcome: params.outcome,
          reason: params.reason,
          reminderDate: params.reminderDate.toISOString(),
          deadlineDate: params.deadlineDateIso,
          offsetDays: params.offsetDays
        } as Prisma.InputJsonValue
      }
    });
  } catch {
    // Reminder audit is best-effort.
  }
}

async function suppressScheduledRemindersForCase(caseId: string, userId: string, reason: string): Promise<number> {
  await ensurePushStorage();
  const rows = await prisma.$queryRaw<
    Array<{ id: string; dedupeKey: string; reminderDate: Date; offsetDays: number; deadlineDate: Date }>
  >(Prisma.sql`
    UPDATE "DeadlinePushReminder"
    SET
      "status" = 'suppressed',
      "reason" = ${reason},
      "suppressedAt" = NOW(),
      "updatedAt" = NOW()
    WHERE "caseId" = ${caseId}
      AND "status" = 'scheduled'
    RETURNING
      "id" AS "id",
      "dedupeKey" AS "dedupeKey",
      "reminderDate" AS "reminderDate",
      "offsetDays" AS "offsetDays",
      "deadlineDate" AS "deadlineDate"
  `);
  await Promise.all(
    rows.map((row) =>
      writePushReminderAudit({
        caseId,
        userId,
        reminderId: row.id,
        dedupeKey: row.dedupeKey,
        outcome: "suppressed",
        reason,
        reminderDate: row.reminderDate,
        deadlineDateIso: isoDateOnly(row.deadlineDate),
        offsetDays: row.offsetDays
      })
    )
  );
  return rows.length;
}

async function syncCaseDeadlineReminders(caseId: string): Promise<void> {
  await ensurePushStorage();
  const foundCase = await prisma.case.findUnique({
    where: { id: caseId },
    select: {
      id: true,
      userId: true,
      earliestDeadline: true
    }
  });
  if (!foundCase) return;

  if (!pushNotificationsEnabled()) {
    await suppressScheduledRemindersForCase(foundCase.id, foundCase.userId, "feature_disabled");
    return;
  }

  const watchEnabled = await latestWatchModeEnabled(foundCase.id);
  if (!watchEnabled || !foundCase.earliestDeadline) {
    await suppressScheduledRemindersForCase(
      foundCase.id,
      foundCase.userId,
      watchEnabled ? "no_deadline" : "watch_disabled"
    );
    return;
  }

  const preference = await getOrCreatePushPreference(foundCase.userId);
  const deadlineIso = isoDateOnly(foundCase.earliestDeadline);
  const dedupeKeys: string[] = [];
  const now = new Date();
  for (const offset of PUSH_REMINDER_OFFSETS_DAYS) {
    const reminderDate = buildReminderDate(deadlineIso, offset);
    if (reminderDate.getTime() <= now.getTime()) continue;
    const dedupeKey = reminderDedupeKey(foundCase.id, deadlineIso, offset);
    dedupeKeys.push(dedupeKey);
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        dedupeKey: string;
        deadlineDate: Date;
        reminderDate: Date;
        offsetDays: number;
        status: string;
      }>
    >(Prisma.sql`
      INSERT INTO "DeadlinePushReminder" (
        "id",
        "userId",
        "caseId",
        "dedupeKey",
        "deadlineDate",
        "reminderDate",
        "offsetDays",
        "status",
        "reason",
        "language",
        "attemptCount",
        "nextAttemptAt",
        "sentAt",
        "suppressedAt",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${randomUUID()},
        ${foundCase.userId},
        ${foundCase.id},
        ${dedupeKey},
        ${deadlineIso}::date,
        ${reminderDate},
        ${offset},
        'scheduled',
        NULL,
        ${preference.language},
        0,
        ${reminderDate},
        NULL,
        NULL,
        NOW(),
        NOW()
      )
      ON CONFLICT ("dedupeKey")
      DO UPDATE SET
        "userId" = EXCLUDED."userId",
        "caseId" = EXCLUDED."caseId",
        "deadlineDate" = EXCLUDED."deadlineDate",
        "reminderDate" = EXCLUDED."reminderDate",
        "offsetDays" = EXCLUDED."offsetDays",
        "language" = EXCLUDED."language",
        "status" = CASE
          WHEN "DeadlinePushReminder"."status" = 'sent' THEN 'sent'
          ELSE 'scheduled'
        END,
        "reason" = CASE
          WHEN "DeadlinePushReminder"."status" = 'sent' THEN "DeadlinePushReminder"."reason"
          ELSE NULL
        END,
        "attemptCount" = CASE
          WHEN "DeadlinePushReminder"."status" = 'sent' THEN "DeadlinePushReminder"."attemptCount"
          ELSE 0
        END,
        "nextAttemptAt" = CASE
          WHEN "DeadlinePushReminder"."status" = 'sent' THEN "DeadlinePushReminder"."nextAttemptAt"
          ELSE EXCLUDED."reminderDate"
        END,
        "sentAt" = CASE
          WHEN "DeadlinePushReminder"."status" = 'sent' THEN "DeadlinePushReminder"."sentAt"
          ELSE NULL
        END,
        "suppressedAt" = CASE
          WHEN "DeadlinePushReminder"."status" = 'sent' THEN "DeadlinePushReminder"."suppressedAt"
          ELSE NULL
        END,
        "updatedAt" = NOW()
      RETURNING
        "id" AS "id",
        "dedupeKey" AS "dedupeKey",
        "deadlineDate" AS "deadlineDate",
        "reminderDate" AS "reminderDate",
        "offsetDays" AS "offsetDays",
        "status" AS "status"
    `);
    const outcome = parseReminderOutcome(rows[0]?.status ?? null);
    if (rows.length > 0 && outcome === "scheduled") {
      await writePushReminderAudit({
        caseId: foundCase.id,
        userId: foundCase.userId,
        reminderId: rows[0].id,
        dedupeKey: rows[0].dedupeKey,
        outcome: "scheduled",
        reason: null,
        reminderDate: rows[0].reminderDate,
        deadlineDateIso: isoDateOnly(rows[0].deadlineDate),
        offsetDays: rows[0].offsetDays
      });
    }
  }

  const staleRows = dedupeKeys.length
    ? await prisma.$queryRaw<
        Array<{ id: string; dedupeKey: string; reminderDate: Date; offsetDays: number; deadlineDate: Date }>
      >(Prisma.sql`
        UPDATE "DeadlinePushReminder"
        SET
          "status" = 'suppressed',
          "reason" = 'stale_deadline',
          "suppressedAt" = NOW(),
          "updatedAt" = NOW()
        WHERE "caseId" = ${foundCase.id}
          AND "status" = 'scheduled'
          AND "dedupeKey" NOT IN (${Prisma.join(dedupeKeys)})
        RETURNING
          "id" AS "id",
          "dedupeKey" AS "dedupeKey",
          "reminderDate" AS "reminderDate",
          "offsetDays" AS "offsetDays",
          "deadlineDate" AS "deadlineDate"
      `)
    : await prisma.$queryRaw<
        Array<{ id: string; dedupeKey: string; reminderDate: Date; offsetDays: number; deadlineDate: Date }>
      >(Prisma.sql`
        UPDATE "DeadlinePushReminder"
        SET
          "status" = 'suppressed',
          "reason" = 'stale_deadline',
          "suppressedAt" = NOW(),
          "updatedAt" = NOW()
        WHERE "caseId" = ${foundCase.id}
          AND "status" = 'scheduled'
        RETURNING
          "id" AS "id",
          "dedupeKey" AS "dedupeKey",
          "reminderDate" AS "reminderDate",
          "offsetDays" AS "offsetDays",
          "deadlineDate" AS "deadlineDate"
      `);

  await Promise.all(
    staleRows.map((row) =>
      writePushReminderAudit({
        caseId: foundCase.id,
        userId: foundCase.userId,
        reminderId: row.id,
        dedupeKey: row.dedupeKey,
        outcome: "suppressed",
        reason: "stale_deadline",
        reminderDate: row.reminderDate,
        deadlineDateIso: isoDateOnly(row.deadlineDate),
        offsetDays: row.offsetDays
      })
    )
  );
}

async function getDuePushReminders(limit: number): Promise<PushReminder[]> {
  await ensurePushStorage();
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      userId: string;
      caseId: string;
      dedupeKey: string;
      deadlineDate: Date;
      reminderDate: Date;
      offsetDays: number;
      status: string;
      reason: string | null;
      language: string;
      attemptCount: number;
      nextAttemptAt: Date;
    }>
  >(Prisma.sql`
    SELECT
      "id" AS "id",
      "userId" AS "userId",
      "caseId" AS "caseId",
      "dedupeKey" AS "dedupeKey",
      "deadlineDate" AS "deadlineDate",
      "reminderDate" AS "reminderDate",
      "offsetDays" AS "offsetDays",
      "status" AS "status",
      "reason" AS "reason",
      "language" AS "language",
      "attemptCount" AS "attemptCount",
      "nextAttemptAt" AS "nextAttemptAt"
    FROM "DeadlinePushReminder"
    WHERE "status" = 'scheduled'
      AND "nextAttemptAt" <= NOW()
    ORDER BY "nextAttemptAt" ASC
    LIMIT ${limit}
  `);

  return rows
    .map((row) => {
      const language = parseNotificationLanguage(row.language);
      const status = parseReminderOutcome(row.status);
      if (!language || status !== "scheduled") return null;
      return {
        id: row.id,
        userId: row.userId,
        caseId: row.caseId,
        dedupeKey: row.dedupeKey,
        deadlineDateIso: isoDateOnly(row.deadlineDate),
        reminderDate: row.reminderDate,
        offsetDays: row.offsetDays,
        status,
        reason: row.reason,
        language,
        attemptCount: row.attemptCount,
        nextAttemptAt: row.nextAttemptAt
      } satisfies PushReminder;
    })
    .filter((row): row is PushReminder => row !== null);
}

async function countSentRemindersForUserDay(userId: string, reference: Date): Promise<number> {
  const { start, end } = utcDayRange(reference);
  const rows = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    SELECT COUNT(*)::int AS "count"
    FROM "DeadlinePushReminder"
    WHERE "userId" = ${userId}
      AND "status" = 'sent'
      AND "sentAt" >= ${start}
      AND "sentAt" < ${end}
  `);
  return Number(rows[0]?.count ?? 0);
}

async function claimReminderForProcessing(reminderId: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    UPDATE "DeadlinePushReminder"
    SET
      "nextAttemptAt" = NOW() + INTERVAL '60 seconds',
      "updatedAt" = NOW()
    WHERE "id" = ${reminderId}
      AND "status" = 'scheduled'
      AND "nextAttemptAt" <= NOW()
    RETURNING "id" AS "id"
  `);
  return rows.length > 0;
}

async function markReminderSuppressed(reminder: PushReminder, reason: string): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "DeadlinePushReminder"
    SET
      "status" = 'suppressed',
      "reason" = ${reason},
      "suppressedAt" = NOW(),
      "updatedAt" = NOW()
    WHERE "id" = ${reminder.id}
      AND "status" = 'scheduled'
  `);
  await writePushReminderAudit({
    caseId: reminder.caseId,
    userId: reminder.userId,
    reminderId: reminder.id,
    dedupeKey: reminder.dedupeKey,
    outcome: "suppressed",
    reason,
    reminderDate: reminder.reminderDate,
    deadlineDateIso: reminder.deadlineDateIso,
    offsetDays: reminder.offsetDays
  });
}

async function markReminderSent(reminder: PushReminder): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "DeadlinePushReminder"
    SET
      "status" = 'sent',
      "reason" = NULL,
      "sentAt" = NOW(),
      "updatedAt" = NOW()
    WHERE "id" = ${reminder.id}
      AND "status" = 'scheduled'
  `);
  await writePushReminderAudit({
    caseId: reminder.caseId,
    userId: reminder.userId,
    reminderId: reminder.id,
    dedupeKey: reminder.dedupeKey,
    outcome: "sent",
    reason: null,
    reminderDate: reminder.reminderDate,
    deadlineDateIso: reminder.deadlineDateIso,
    offsetDays: reminder.offsetDays
  });
}

async function markReminderFailed(reminder: PushReminder, reason: string): Promise<void> {
  const nextAttemptCount = reminder.attemptCount + 1;
  const maxRetries = pushMaxRetries();
  if (nextAttemptCount >= maxRetries) {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "DeadlinePushReminder"
      SET
        "status" = 'failed',
        "reason" = ${reason},
        "attemptCount" = ${nextAttemptCount},
        "nextAttemptAt" = NOW(),
        "updatedAt" = NOW()
      WHERE "id" = ${reminder.id}
        AND "status" = 'scheduled'
    `);
    await writePushReminderAudit({
      caseId: reminder.caseId,
      userId: reminder.userId,
      reminderId: reminder.id,
      dedupeKey: reminder.dedupeKey,
      outcome: "failed",
      reason: "max_retries_exhausted",
      reminderDate: reminder.reminderDate,
      deadlineDateIso: reminder.deadlineDateIso,
      offsetDays: reminder.offsetDays
    });
    return;
  }

  const retryAt = new Date(Date.now() + pushRetryDelaySeconds() * 1000 * nextAttemptCount);
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "DeadlinePushReminder"
    SET
      "attemptCount" = ${nextAttemptCount},
      "nextAttemptAt" = ${retryAt},
      "reason" = ${reason},
      "updatedAt" = NOW()
    WHERE "id" = ${reminder.id}
      AND "status" = 'scheduled'
  `);
  await writePushReminderAudit({
    caseId: reminder.caseId,
    userId: reminder.userId,
    reminderId: reminder.id,
    dedupeKey: reminder.dedupeKey,
    outcome: "failed",
    reason: "retry_scheduled",
    reminderDate: reminder.reminderDate,
    deadlineDateIso: reminder.deadlineDateIso,
    offsetDays: reminder.offsetDays
  });
}

async function sendPushToDevice(input: { token: string; title: string; body: string }): Promise<void> {
  if (parseBooleanEnv("PUSH_NOTIFICATIONS_FORCE_FAIL", false)) {
    throw new Error("Forced push delivery failure.");
  }
  console.log(
    JSON.stringify({
      level: "info",
      msg: "push_delivery_stub",
      tokenPreview: `${input.token.slice(0, 6)}...`,
      title: input.title,
      body: input.body
    })
  );
}

async function processSingleDuePushReminder(reminder: PushReminder): Promise<void> {
  if (!pushNotificationsEnabled()) {
    await markReminderSuppressed(reminder, "feature_disabled");
    return;
  }

  const caseRow = await prisma.case.findUnique({
    where: { id: reminder.caseId },
    select: {
      earliestDeadline: true
    }
  });
  if (!caseRow?.earliestDeadline) {
    await markReminderSuppressed(reminder, "stale_deadline");
    return;
  }
  const currentDeadlineIso = isoDateOnly(caseRow.earliestDeadline);
  if (currentDeadlineIso !== reminder.deadlineDateIso) {
    await markReminderSuppressed(reminder, "stale_deadline");
    return;
  }

  const watchEnabled = await latestWatchModeEnabled(reminder.caseId);
  if (!watchEnabled) {
    await markReminderSuppressed(reminder, "watch_disabled");
    return;
  }

  const preference = await getOrCreatePushPreference(reminder.userId);
  if (!preference.enabled) {
    await markReminderSuppressed(reminder, "opt_out");
    return;
  }

  if (isWithinQuietHours(new Date(), preference.quietHoursStart, preference.quietHoursEnd)) {
    await markReminderSuppressed(reminder, "quiet_hours");
    return;
  }

  const sentToday = await countSentRemindersForUserDay(reminder.userId, new Date());
  if (sentToday >= pushDailyLimitPerUser()) {
    await markReminderSuppressed(reminder, "daily_limit");
    return;
  }

  const activeTokens = await listActivePushDeviceTokens(reminder.userId);
  if (activeTokens.length === 0) {
    await markReminderSuppressed(reminder, "no_active_device");
    return;
  }

  const language = preference.language || reminder.language;
  const message = pushTemplate(language, reminder.offsetDays, reminder.deadlineDateIso);

  let deliverySucceeded = false;
  for (const tokenRow of activeTokens) {
    try {
      await sendPushToDevice({
        token: tokenRow.token,
        title: message.title,
        body: message.body
      });
      deliverySucceeded = true;
    } catch {
      // Continue trying additional active tokens before considering retry.
    }
  }

  if (deliverySucceeded) {
    await markReminderSent(reminder);
    return;
  }

  await markReminderFailed(reminder, "delivery_failed");
}

async function processDuePushRemindersBatch(): Promise<void> {
  await ensurePushStorage();
  if (!pushNotificationsEnabled()) {
    return;
  }

  const due = await getDuePushReminders(PUSH_PROCESSING_BATCH_SIZE);
  for (const reminder of due) {
    const claimed = await claimReminderForProcessing(reminder.id);
    if (!claimed) {
      continue;
    }
    try {
      await processSingleDuePushReminder(reminder);
    } catch (error) {
      await markReminderFailed(
        reminder,
        error instanceof Error ? error.message.slice(0, 180) : "delivery_exception"
      );
    }
  }
}

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
    ),
    maxMessageRetries: readNumberEnv("SQS_MAX_MESSAGE_RETRIES", DEFAULT_MAX_MESSAGE_RETRIES)
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
    const lower = error.message.toLowerCase();
    const nonRetryableOcrAuthError =
      lower.includes("permission_denied") ||
      lower.includes("requires billing to be enabled") ||
      lower.includes("api has not been used in project") ||
      lower.includes("access not configured") ||
      lower.includes("invalid api key") ||
      lower.includes("insufficient authentication scopes") ||
      lower.includes("missing required env var: google_application_credentials") ||
      lower.includes("google_application_credentials");

    return new WorkerProcessingError({
      code: "UNHANDLED_ERROR",
      message: error.message,
      retryable: !nonRetryableOcrAuthError,
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
    const contextReuse = payload.contextReuse as { sourceCaseId?: unknown } | undefined;
    const contextReuseSourceCaseId =
      contextReuse && typeof contextReuse.sourceCaseId === "string"
        ? contextReuse.sourceCaseId
        : undefined;
    const contextReusedFromCrossCaseMemory = Boolean(contextReuseSourceCaseId);
    const hasUserDescription = Boolean(userDescriptionRaw);
    const userDescription = hasUserDescription ? userDescriptionRaw : undefined;

    context.stage = "load_asset";
    const asset = await prisma.asset.findFirst({
      where: {
        id: payload.assetId,
        caseId: payload.caseId
      },
      select: {
        id: true,
        caseId: true,
        s3Key: true,
        fileName: true,
        mimeType: true,
        assetType: true,
        case: {
          select: {
            userId: true
          }
        }
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
      await writeCaseReadinessSnapshotAudit({
        caseId: completedExtraction.caseId,
        queueMessageId,
        extractionId: completedExtraction.id,
        verdictId: verdict.id,
        source: "worker_replay"
      });
      await syncCaseDeadlineReminders(completedExtraction.caseId);

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
        let ocr: Awaited<ReturnType<typeof ocrProvider.run>>;
        const cacheLookup = hasUserDescription
          ? undefined
          : async (lookup: {
              contentSha256: string;
              fileName: string;
              mimeType: string;
            }) => {
              const cachedExtraction = await prisma.extraction.findFirst({
                where: {
                  assetId: {
                    not: asset.id
                  },
                  asset: {
                    sha256: lookup.contentSha256,
                    case: {
                      userId: asset.case.userId
                    }
                  }
                },
                orderBy: {
                  createdAt: "desc"
                },
                select: {
                  id: true,
                  engine: true,
                  engineVersion: true,
                  rawText: true,
                  structuredFacts: true
                }
              });

              if (!cachedExtraction) {
                return null;
              }

              const structuredFactsRecord = asRecord(cachedExtraction.structuredFacts);
              const providerMetadata = asRecord(structuredFactsRecord?.providerMetadata);
              const sourceMetadata = asRecord(structuredFactsRecord?.sourceMetadata);

              return {
                sourceExtractionId: cachedExtraction.id,
                engine: cachedExtraction.engine,
                engineVersion: cachedExtraction.engineVersion ?? undefined,
                rawText: cachedExtraction.rawText,
                structuredFacts: structuredFactsRecord ?? {
                  source: "cache_reused_structured_facts"
                },
                pageUnitEstimate: derivePageUnitEstimateFromExtractionData({
                  providerMetadata,
                  sourceMetadata,
                  mimeType: lookup.mimeType
                })
              };
            };

        try {
          ocr = await ocrProvider.run({
            caseId: asset.caseId,
            assetId: asset.id,
            s3Key: asset.s3Key,
            fileName: asset.fileName,
            mimeType: asset.mimeType,
            userDescription,
            cacheLookup
          });
        } catch (error) {
          const normalized = normalizeWorkerError(error, {
            ...context,
            stage: "ocr_stage"
          });
          try {
            await prisma.auditLog.create({
              data: {
                caseId: asset.caseId,
                assetId: asset.id,
                eventType: AuditEventType.OCR_RUN,
                actorType: "worker",
                payload: {
                  queueMessageId,
                  provider: configuredOcrProvider,
                  providerVersion: null,
                  status: "failed",
                  replayMode: "fresh",
                  hasUserDescription: Boolean(userDescription),
                  contextReusedFromCrossCaseMemory,
                  contextReuseSourceCaseId: contextReuseSourceCaseId ?? null,
                  sourceMetadata: {
                    s3Key: asset.s3Key,
                    fileName: asset.fileName,
                    mimeType: asset.mimeType
                  },
                  diagnostics: getErrorDiagnostics(normalized),
                  retryable: normalized.retryable
                } as Prisma.InputJsonValue
              }
            });
          } catch {
            // Failure audit write is best-effort; main worker failure audit still runs.
          }
          throw normalized;
        }

        const sourceMetadataRecord = asRecord(ocr.sourceMetadata);
        const providerMetadataRecord = asRecord(ocr.providerMetadata);
        const cacheInfo = asRecord(providerMetadataRecord?.cache);
        const processingPath =
          typeof providerMetadataRecord?.processingPath === "string"
            ? providerMetadataRecord.processingPath
            : null;
        const pageUnitEstimate = derivePageUnitEstimateFromExtractionData({
          providerMetadata: providerMetadataRecord,
          sourceMetadata: sourceMetadataRecord,
          mimeType: asset.mimeType
        });

        const createdExtraction = await prisma.$transaction(async (tx) => {
          const contentSha256 =
            sourceMetadataRecord && typeof sourceMetadataRecord.contentSha256 === "string"
              ? sourceMetadataRecord.contentSha256
              : null;

          if (contentSha256) {
            await tx.asset.update({
              where: {
                id: asset.id
              },
              data: {
                sha256: contentSha256
              }
            });
          }

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
                providerVersion: ocr.engineVersion ?? null,
                status: "succeeded",
                replayMode: "fresh",
                hasUserDescription: Boolean(userDescription),
                contextReusedFromCrossCaseMemory,
                contextReuseSourceCaseId: contextReuseSourceCaseId ?? null,
                sourceMetadata: sourceMetadataRecord ?? {
                  s3Key: asset.s3Key,
                  fileName: asset.fileName,
                  mimeType: asset.mimeType
                },
                providerMetadata: providerMetadataRecord ?? null,
                processingPath,
                cache: {
                  hit: cacheInfo?.hit === true,
                  sourceExtractionId:
                    typeof cacheInfo?.sourceExtractionId === "string"
                      ? cacheInfo.sourceExtractionId
                      : null
                },
                pageUnitEstimate,
                rawTextLength: ocr.rawText.length
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

    await writeCaseReadinessSnapshotAudit({
      caseId: extraction.caseId,
      queueMessageId,
      extractionId: extraction.id,
      verdictId: verdict.id,
      source: "worker_processed"
    });
    await syncCaseDeadlineReminders(extraction.caseId);

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
      MessageSystemAttributeNames: ["ApproximateReceiveCount"],
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
        receiveCount: message.Attributes?.ApproximateReceiveCount ?? null,
        retryable: normalizedError.retryable,
        stage: normalizedError.context.stage,
        code: normalizedError.code,
        error: normalizedError.message
      })
    );

    const receiveCountRaw = message.Attributes?.ApproximateReceiveCount;
    const receiveCount =
      typeof receiveCountRaw === "string" ? Number.parseInt(receiveCountRaw, 10) : Number.NaN;
    const exceededRetryLimit =
      Number.isFinite(receiveCount) && receiveCount >= config.maxMessageRetries;

    if (exceededRetryLimit && message.ReceiptHandle) {
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
            msg: "worker_message_dropped_retry_limit",
            messageId,
            receiveCount,
            maxMessageRetries: config.maxMessageRetries,
            code: normalizedError.code
          })
        );
      } catch (deleteError) {
        console.error(
          JSON.stringify({
            level: "error",
            msg: "worker_retry_limit_drop_failed",
            messageId,
            receiveCount,
            maxMessageRetries: config.maxMessageRetries,
            code: normalizedError.code,
            error: deleteError instanceof Error ? deleteError.message : String(deleteError)
          })
        );
      }
      return;
    }

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
  let currentJob: Promise<void> | null = null;

  const stop = (signal: string) => {
    console.log(JSON.stringify({ level: "info", msg: "worker_shutdown_requested", signal }));
    keepRunning = false;
  };

  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));

  process.on("unhandledRejection", (reason) => {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "unhandled_rejection",
        error: reason instanceof Error ? reason.message : String(reason)
      })
    );
  });

  console.log(
    JSON.stringify({
      level: "info",
      msg: "worker_started",
      queueUrl: config.queueUrl,
      waitTimeSeconds: config.waitTimeSeconds,
      visibilityTimeoutSeconds: config.visibilityTimeoutSeconds,
      maxMessageRetries: config.maxMessageRetries,
      ocrProvider: process.env.OCR_PROVIDER?.trim() ?? "stub",
      llmProvider: process.env.LLM_PROVIDER?.trim() ?? "stub",
      pid: process.pid
    })
  );

  while (keepRunning) {
    await processDuePushRemindersBatch();
    currentJob = pollOnce(client, config);
    await currentJob;
    currentJob = null;
  }

  await prisma.$disconnect();

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
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
  );
  process.exit(1);
});
