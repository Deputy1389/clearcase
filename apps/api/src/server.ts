import "dotenv/config";
import * as Sentry from "@sentry/node";

const SENTRY_DSN = process.env.SENTRY_DSN?.trim() ?? "";
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.2,
    environment: process.env.NODE_ENV ?? "development"
  });
}

import Fastify, { type FastifyReply } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { AssetType, AuditEventType, Prisma, type User } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../packages/db/src/client.ts";
import { normalizeZipCode, stateFromZipCode } from "./lib/profile.ts";
import { createDownloadPlan, createUploadPlan, getUploadConfigStatus } from "./lib/uploads.ts";
import { authPlugin, type AuthContext } from "./plugins/auth.ts";

const patchMeSchema = z
  .object({
    fullName: z.string().trim().min(1).max(120).optional(),
    zipCode: z.string().trim().regex(/^\d{5}(?:-\d{4})?$/).optional()
  })
  .strict()
  .refine((value) => value.fullName !== undefined || value.zipCode !== undefined, {
    message: "Provide at least one field to update."
  });

const createCaseSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional()
  })
  .strict();

const caseParamsSchema = z
  .object({
    id: z.string().trim().min(1)
  })
  .strict();

const assetParamsSchema = z
  .object({
    id: z.string().trim().min(1),
    assetId: z.string().trim().min(1)
  })
  .strict();

const consultPacketLinkParamsSchema = z
  .object({
    id: z.string().trim().min(1),
    token: z.string().trim().min(1)
  })
  .strict();

const consultPacketLinkCreateSchema = z
  .object({
    expiresInDays: z.number().int().min(1).max(30).optional()
  })
  .strict();

const opsEntitlementLookupQuerySchema = z
  .object({
    subject: z.string().trim().min(1).optional(),
    email: z.string().trim().email().optional(),
    includeHistory: z.coerce.boolean().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional()
  })
  .strict()
  .refine((value) => value.subject !== undefined || value.email !== undefined, {
    message: "Provide subject or email."
  });

const opsEntitlementGrantSchema = z
  .object({
    subject: z.string().trim().min(1).optional(),
    email: z.string().trim().email().optional(),
    plan: z.enum(["free", "plus"]).default("plus"),
    status: z.enum(["active", "trial"]).default("active"),
    source: z.enum(["manual", "billing"]).default("manual"),
    startAt: z.string().datetime().optional(),
    endAt: z.string().datetime().optional()
  })
  .strict()
  .refine((value) => value.subject !== undefined || value.email !== undefined, {
    message: "Provide subject or email."
  });

const opsEntitlementRevokeSchema = z
  .object({
    subject: z.string().trim().min(1).optional(),
    email: z.string().trim().email().optional(),
    source: z.enum(["manual", "billing"]).default("manual"),
    reason: z.string().trim().min(1).max(200).optional()
  })
  .strict()
  .refine((value) => value.subject !== undefined || value.email !== undefined, {
    message: "Provide subject or email."
  });

const pushDeviceRegisterSchema = z
  .object({
    deviceId: z.string().trim().min(1).max(120),
    platform: z.enum(["ios", "android", "web"]),
    token: z.string().trim().min(8).max(4096),
    language: z.enum(["en", "es"]).optional()
  })
  .strict();

const pushPreferencesPatchSchema = z
  .object({
    enabled: z.boolean().optional(),
    language: z.enum(["en", "es"]).optional(),
    quietHoursStart: z
      .string()
      .trim()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .nullable()
      .optional(),
    quietHoursEnd: z
      .string()
      .trim()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .nullable()
      .optional()
  })
  .strict()
  .refine(
    (value) =>
      value.enabled !== undefined ||
      value.language !== undefined ||
      value.quietHoursStart !== undefined ||
      value.quietHoursEnd !== undefined,
    {
      message: "Provide at least one field to update."
    }
  )
  .refine(
    (value) =>
      (value.quietHoursStart === undefined && value.quietHoursEnd === undefined) ||
      (value.quietHoursStart !== undefined && value.quietHoursEnd !== undefined),
    {
      message: "quietHoursStart and quietHoursEnd must be provided together."
    }
  );

const assetAccessQuerySchema = z
  .object({
    action: z.enum(["view", "download"]).default("view")
  })
  .strict();

const plainMeaningQuerySchema = z
  .object({
    language: z.enum(["en", "es"]).default("en")
  })
  .strict();

const billingCheckoutSchema = z
  .object({
    plan: z.enum(["plus_monthly"]).default("plus_monthly"),
    successUrl: z.string().trim().url().optional(),
    cancelUrl: z.string().trim().url().optional(),
    triggerSource: z.string().trim().min(1).max(80).optional(),
    locale: z.enum(["en", "es"]).optional()
  })
  .strict();

const billingWebhookBodySchema = z
  .object({
    provider: z.enum(["internal_stub", "stripe"]).default("internal_stub"),
    eventId: z.string().trim().min(3).max(180),
    eventType: z.enum(["create", "update", "cancel", "past_due", "payment_failed"]),
    createdAt: z.string().datetime().optional(),
    subscription: z
      .object({
        providerSubscriptionId: z.string().trim().min(1).max(180),
        providerCustomerId: z.string().trim().min(1).max(180).optional(),
        status: z.string().trim().min(1).max(64).optional(),
        currentPeriodStart: z.string().datetime().optional(),
        currentPeriodEnd: z.string().datetime().optional(),
        cancelAtPeriodEnd: z.boolean().optional(),
        graceUntil: z.string().datetime().optional()
      })
      .strict(),
    user: z
      .object({
        userId: z.string().trim().min(1).optional(),
        subject: z.string().trim().min(1).optional(),
        email: z.string().trim().email().optional()
      })
      .strict()
      .optional(),
    metadata: z.record(z.string(), z.string()).optional()
  })
  .strict();

const eventTrackSchema = z
  .object({
    event: z.string().trim().min(1).max(120),
    source: z.string().trim().min(1).max(120).optional(),
    locale: z.enum(["en", "es"]).optional(),
    paywallVariant: z.string().trim().min(1).max(80).optional(),
    properties: z.record(z.string(), z.unknown()).optional()
  })
  .strict();

const createAssetSchema = z
  .object({
    fileName: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().min(3).max(200),
    byteSize: z.number().int().positive().max(25 * 1024 * 1024),
    assetType: z.nativeEnum(AssetType).optional()
  })
  .strict();

const finalizeAssetSchema = z
  .object({
    userDescription: z.string().trim().min(1).max(2000).optional()
  })
  .strict();

const caseContextSchema = z
  .object({
    description: z.string().trim().min(1).max(2000)
  })
  .strict();

const caseWatchModeSchema = z
  .object({
    enabled: z.boolean()
  })
  .strict();

const MANUAL_DOCUMENT_TYPES = [
  "protective_order_notice",
  "family_court_notice",
  "small_claims_complaint",
  "summons_complaint",
  "subpoena_notice",
  "judgment_notice",
  "court_hearing_notice",
  "demand_letter",
  "eviction_notice",
  "foreclosure_default_notice",
  "repossession_notice",
  "landlord_security_deposit_notice",
  "lease_violation_notice",
  "debt_collection_notice",
  "wage_garnishment_notice",
  "tax_notice",
  "unemployment_benefits_denial",
  "workers_comp_denial_notice",
  "benefits_overpayment_notice",
  "insurance_denial_letter",
  "insurance_subrogation_notice",
  "incident_evidence_photo",
  "utility_shutoff_notice",
  "license_suspension_notice",
  "citation_ticket",
  "general_legal_notice",
  "non_legal_or_unclear_image",
  "unknown_legal_document"
] as const;

const caseClassificationSchema = z
  .object({
    documentType: z.enum(MANUAL_DOCUMENT_TYPES)
  })
  .strict();

type PublicUser = Pick<
  User,
  | "id"
  | "authProviderUserId"
  | "email"
  | "fullName"
  | "zipCode"
  | "jurisdictionState"
  | "createdAt"
  | "updatedAt"
>;

function fallbackEmail(subject: string): string {
  const safeSubject = subject.replace(/[^a-zA-Z0-9._-]/g, "-");
  return `dev+${safeSubject}@clearcase.local`;
}

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    authProviderUserId: user.authProviderUserId,
    email: user.email,
    fullName: user.fullName,
    zipCode: user.zipCode,
    jurisdictionState: user.jurisdictionState,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function needsProfile(user: User): boolean {
  return !user.fullName || !user.zipCode || !user.jurisdictionState;
}

function sendValidationError(reply: FastifyReply, requestId: string, issues: unknown): void {
  reply.status(400).send({
    error: "BAD_REQUEST",
    requestId,
    issues
  });
}

const CONSULT_PACKET_TOKEN_REGEX = /^[a-f0-9]{32}$/;
const CONSULT_PACKET_LINK_ID_REGEX = /^lnk_[a-f0-9]{12}$/;

function parseCsvSet(value: string | undefined): Set<string> {
  if (!value) return new Set<string>();
  return new Set(
    value
      .split(",")
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean)
  );
}

function normalizeConsultPacketToken(value: string): string {
  return value.trim().toLowerCase();
}

function buildConsultPacketLinkId(token: string): string {
  return `lnk_${createHash("sha256").update(token).digest("hex").slice(0, 12)}`;
}

function buildConsultPacketTokenPreview(token: string): string {
  if (token.length < 10) return `${token.slice(0, 4)}...`;
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

const ASSET_UPLOADED_ENQUEUED_SUBTYPE = "asset_uploaded_enqueued";
const ASSET_UPLOADED_ENQUEUING_SUBTYPE = "asset_uploaded_enqueuing";
const FREE_QUOTA_RESERVATION_SUBTYPE = "free_finalize_quota_reserved";
const ENTITLEMENT_CHANGE_SUBTYPE = "plan_entitlement_changed";
const PUSH_DELIVERY_SUBTYPE = "push_reminder_delivery";
const OPS_SUBTYPE_PLUS_REQUIRED = "plus_required";
const OPS_SUBTYPE_FREE_LIMIT_REACHED = "free_limit_reached";
const OPS_SUBTYPE_FREE_OCR_DISABLED = "free_ocr_disabled";
const OPS_SUBTYPE_FINALIZE_ENQUEUE_FAILED = "asset_uploaded_enqueue_failed";
const OPS_SUBTYPE_CONSULT_LINK_CREATED = "consult_packet_link_created";
const OPS_SUBTYPE_CONSULT_LINK_DISABLED = "consult_packet_link_disabled";
const ASSET_VIEW_OPENED_SUBTYPE = "asset_view_opened";
const ASSET_DOWNLOAD_REQUESTED_SUBTYPE = "asset_download_requested";
const PAYWALL_EVENT_SUBTYPE = "paywall_event";
const BILLING_WEBHOOK_SUBTYPE = "billing_webhook_processed";
const BILLING_RECONCILIATION_SUBTYPE = "billing_reconciliation";
const PUSH_REMINDER_OFFSETS_DAYS = [14, 7, 3, 1] as const;
const PUSH_REMINDER_MAX_PER_USER_PER_DAY_FALLBACK = 4;
const PUSH_REMINDER_DEFAULT_DELIVERY_HOUR_UTC = 14;
const BILLING_PROVIDER_INTERNAL = "internal_stub";
const BILLING_PROVIDER_STRIPE = "stripe";
const BILLING_GRACE_DAYS_DEFAULT = 7;
const DEFAULT_PLUS_PRICE_MONTHLY = "$15/month";
const DEFAULT_PAYWALL_VARIANT = "gold_v1";
const DIRECT_TRACKED_EVENT_SUBTYPES = new Set([
  "upload_started",
  "upload_completed",
  "first_deadline_detected",
  OPS_SUBTYPE_FREE_LIMIT_REACHED
]);
type EntitlementPlan = "free" | "plus";
type EntitlementStatus = "active" | "revoked" | "trial";
type EntitlementSource = "manual" | "billing";
type PushPlatform = "ios" | "android" | "web";
type NotificationLanguage = "en" | "es";
type ReminderOutcome = "scheduled" | "sent" | "failed" | "suppressed";
type BillingProvider = "internal_stub" | "stripe";
type BillingEventType = "create" | "update" | "cancel" | "past_due" | "payment_failed";
type BillingSubscriptionStatus =
  | "active"
  | "trialing"
  | "cancelled"
  | "past_due"
  | "payment_failed"
  | "ended"
  | "unknown";

type BillingSubscriptionRow = {
  id: string;
  userId: string;
  provider: BillingProvider;
  providerCustomerId: string | null;
  providerSubscriptionId: string;
  status: BillingSubscriptionStatus;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  graceUntil: Date | null;
  lastEventId: string | null;
  lastEventCreatedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

type BillingWebhookEnvelope = {
  provider: BillingProvider;
  eventId: string;
  eventType: BillingEventType;
  createdAt: Date | null;
  subscription: {
    providerSubscriptionId: string;
    providerCustomerId: string | null;
    status: string | null;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    graceUntil: Date | null;
  };
  user: {
    userId?: string;
    subject?: string;
    email?: string;
  } | null;
  metadata: Record<string, string>;
};

type PushPreference = {
  id: string;
  userId: string;
  enabled: boolean;
  language: NotificationLanguage;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

type PushReminderRow = {
  id: string;
  userId: string;
  caseId: string;
  dedupeKey: string;
  deadlineDate: Date;
  reminderDate: Date;
  offsetDays: number;
  status: ReminderOutcome;
  reason: string | null;
  language: NotificationLanguage;
  attemptCount: number;
  nextAttemptAt: Date;
  sentAt: Date | null;
  suppressedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

type PersistedEntitlement = {
  id: string;
  userId: string;
  plan: EntitlementPlan;
  status: EntitlementStatus;
  source: EntitlementSource;
  startAt: Date | null;
  endAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

type EffectiveEntitlement = PersistedEntitlement & {
  isPlus: boolean;
  viaAllowlistFallback: boolean;
};

let entitlementStorageReady: Promise<void> | null = null;
let pushStorageReady: Promise<void> | null = null;
let billingStorageReady: Promise<void> | null = null;

function parseEntitlementPlan(value: unknown): EntitlementPlan | null {
  if (value === "free" || value === "plus") return value;
  return null;
}

function parseEntitlementStatus(value: unknown): EntitlementStatus | null {
  if (value === "active" || value === "revoked" || value === "trial") return value;
  return null;
}

function parseEntitlementSource(value: unknown): EntitlementSource | null {
  if (value === "manual" || value === "billing") return value;
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

function toPersistedEntitlement(row: Record<string, unknown> | null): PersistedEntitlement | null {
  if (!row) return null;
  const plan = parseEntitlementPlan(row.plan);
  const status = parseEntitlementStatus(row.status);
  const source = parseEntitlementSource(row.source);
  const id = typeof row.id === "string" ? row.id : null;
  const userId = typeof row.userId === "string" ? row.userId : null;
  if (!plan || !status || !source || !id || !userId) {
    return null;
  }
  return {
    id,
    userId,
    plan,
    status,
    source,
    startAt: asDateOrNull(row.startAt),
    endAt: asDateOrNull(row.endAt),
    createdAt: asDateOrNull(row.createdAt),
    updatedAt: asDateOrNull(row.updatedAt)
  };
}

function parsePushPlatform(value: unknown): PushPlatform | null {
  if (value === "ios" || value === "android" || value === "web") return value;
  return null;
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

function parseBillingProvider(value: unknown): BillingProvider | null {
  if (value === BILLING_PROVIDER_INTERNAL || value === BILLING_PROVIDER_STRIPE) return value;
  return null;
}

function parseBillingSubscriptionStatus(value: unknown): BillingSubscriptionStatus | null {
  if (
    value === "active" ||
    value === "trialing" ||
    value === "cancelled" ||
    value === "past_due" ||
    value === "payment_failed" ||
    value === "ended" ||
    value === "unknown"
  ) {
    return value;
  }
  return null;
}

function normalizeBillingSubscriptionStatus(value: string | null | undefined): BillingSubscriptionStatus {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return "unknown";
  if (normalized === "active") return "active";
  if (normalized === "trialing" || normalized === "trial") return "trialing";
  if (normalized === "canceled" || normalized === "cancelled") return "cancelled";
  if (normalized === "past_due") return "past_due";
  if (normalized === "payment_failed" || normalized === "unpaid") return "payment_failed";
  if (normalized === "ended" || normalized === "expired") return "ended";
  return "unknown";
}

function toBillingSubscriptionRow(row: Record<string, unknown> | null): BillingSubscriptionRow | null {
  if (!row) return null;
  const id = typeof row.id === "string" ? row.id : null;
  const userId = typeof row.userId === "string" ? row.userId : null;
  const provider = parseBillingProvider(row.provider);
  const providerSubscriptionId =
    typeof row.providerSubscriptionId === "string" ? row.providerSubscriptionId : null;
  const status = parseBillingSubscriptionStatus(row.status);
  if (!id || !userId || !provider || !providerSubscriptionId || !status) {
    return null;
  }
  return {
    id,
    userId,
    provider,
    providerCustomerId: typeof row.providerCustomerId === "string" ? row.providerCustomerId : null,
    providerSubscriptionId,
    status,
    currentPeriodStart: asDateOrNull(row.currentPeriodStart),
    currentPeriodEnd: asDateOrNull(row.currentPeriodEnd),
    cancelAtPeriodEnd: row.cancelAtPeriodEnd === true,
    graceUntil: asDateOrNull(row.graceUntil),
    lastEventId: typeof row.lastEventId === "string" ? row.lastEventId : null,
    lastEventCreatedAt: asDateOrNull(row.lastEventCreatedAt),
    createdAt: asDateOrNull(row.createdAt),
    updatedAt: asDateOrNull(row.updatedAt)
  };
}

function toPushPreference(row: Record<string, unknown> | null): PushPreference | null {
  if (!row) return null;
  const id = typeof row.id === "string" ? row.id : null;
  const userId = typeof row.userId === "string" ? row.userId : null;
  const enabled = typeof row.enabled === "boolean" ? row.enabled : null;
  const language = parseNotificationLanguage(row.language);
  if (!id || !userId || enabled === null || !language) {
    return null;
  }
  return {
    id,
    userId,
    enabled,
    language,
    quietHoursStart: typeof row.quietHoursStart === "string" ? row.quietHoursStart : null,
    quietHoursEnd: typeof row.quietHoursEnd === "string" ? row.quietHoursEnd : null,
    createdAt: asDateOrNull(row.createdAt),
    updatedAt: asDateOrNull(row.updatedAt)
  };
}

function toPushReminderRow(row: Record<string, unknown> | null): PushReminderRow | null {
  if (!row) return null;
  const id = typeof row.id === "string" ? row.id : null;
  const userId = typeof row.userId === "string" ? row.userId : null;
  const caseId = typeof row.caseId === "string" ? row.caseId : null;
  const dedupeKey = typeof row.dedupeKey === "string" ? row.dedupeKey : null;
  const deadlineDate = asDateOrNull(row.deadlineDate);
  const reminderDate = asDateOrNull(row.reminderDate);
  const offsetDays = typeof row.offsetDays === "number" ? Math.floor(row.offsetDays) : Number.NaN;
  const status = parseReminderOutcome(row.status);
  const language = parseNotificationLanguage(row.language);
  const attemptCount =
    typeof row.attemptCount === "number" ? Math.max(0, Math.floor(row.attemptCount)) : Number.NaN;
  const nextAttemptAt = asDateOrNull(row.nextAttemptAt);
  if (
    !id ||
    !userId ||
    !caseId ||
    !dedupeKey ||
    !deadlineDate ||
    !reminderDate ||
    !Number.isFinite(offsetDays) ||
    !status ||
    !language ||
    !Number.isFinite(attemptCount) ||
    !nextAttemptAt
  ) {
    return null;
  }
  return {
    id,
    userId,
    caseId,
    dedupeKey,
    deadlineDate,
    reminderDate,
    offsetDays,
    status,
    reason: typeof row.reason === "string" ? row.reason : null,
    language,
    attemptCount,
    nextAttemptAt,
    sentAt: asDateOrNull(row.sentAt),
    suppressedAt: asDateOrNull(row.suppressedAt),
    createdAt: asDateOrNull(row.createdAt),
    updatedAt: asDateOrNull(row.updatedAt)
  };
}

function entitlementIsPlus(row: { plan: EntitlementPlan; status: EntitlementStatus }): boolean {
  return row.plan === "plus" && (row.status === "active" || row.status === "trial");
}

function allowlistFallbackEnabled(): boolean {
  return parseBooleanEnv("CLEARCASE_ALLOWLIST_FALLBACK", process.env.NODE_ENV !== "production");
}

async function ensureEntitlementStorage(): Promise<void> {
  if (!entitlementStorageReady) {
    entitlementStorageReady = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "UserEntitlement" (
          "id" TEXT PRIMARY KEY,
          "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
          "plan" TEXT NOT NULL CHECK ("plan" IN ('free', 'plus')),
          "status" TEXT NOT NULL CHECK ("status" IN ('active', 'revoked', 'trial')),
          "source" TEXT NOT NULL CHECK ("source" IN ('manual', 'billing')),
          "startAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "endAt" TIMESTAMPTZ NULL,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "UserEntitlement_userId_startAt_idx"
        ON "UserEntitlement"("userId", "startAt" DESC)
      `);
    })();
  }
  await entitlementStorageReady;
}

async function getCurrentPersistedEntitlement(userId: string): Promise<PersistedEntitlement | null> {
  await ensureEntitlementStorage();
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      userId: string;
      plan: string;
      status: string;
      source: string;
      startAt: Date;
      endAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    }>
  >(Prisma.sql`
    SELECT
      ue."id" AS "id",
      ue."userId" AS "userId",
      ue."plan" AS "plan",
      ue."status" AS "status",
      ue."source" AS "source",
      ue."startAt" AS "startAt",
      ue."endAt" AS "endAt",
      ue."createdAt" AS "createdAt",
      ue."updatedAt" AS "updatedAt"
    FROM "UserEntitlement" ue
    WHERE ue."userId" = ${userId}
      AND ue."startAt" <= NOW()
      AND (ue."endAt" IS NULL OR ue."endAt" > NOW())
    ORDER BY ue."startAt" DESC, ue."createdAt" DESC
    LIMIT 1
  `);

  return toPersistedEntitlement((rows[0] as unknown as Record<string, unknown>) ?? null);
}

async function closeCurrentEntitlement(userId: string, at: Date): Promise<void> {
  await ensureEntitlementStorage();
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "UserEntitlement" AS ue
    SET "endAt" = ${at},
        "updatedAt" = NOW()
    WHERE ue."id" = (
      SELECT current."id"
      FROM "UserEntitlement" current
      WHERE current."userId" = ${userId}
        AND current."startAt" <= ${at}
        AND (current."endAt" IS NULL OR current."endAt" > ${at})
      ORDER BY current."startAt" DESC, current."createdAt" DESC
      LIMIT 1
    )
  `);
}

async function insertEntitlementRecord(input: {
  userId: string;
  plan: EntitlementPlan;
  status: EntitlementStatus;
  source: EntitlementSource;
  startAt: Date;
  endAt: Date | null;
}): Promise<PersistedEntitlement> {
  await ensureEntitlementStorage();
  const entitlementId = randomUUID();
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "UserEntitlement" (
      "id",
      "userId",
      "plan",
      "status",
      "source",
      "startAt",
      "endAt",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${entitlementId},
      ${input.userId},
      ${input.plan},
      ${input.status},
      ${input.source},
      ${input.startAt},
      ${input.endAt},
      NOW(),
      NOW()
    )
  `);

  const inserted = await prisma.$queryRaw<
    Array<{
      id: string;
      userId: string;
      plan: string;
      status: string;
      source: string;
      startAt: Date;
      endAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    }>
  >(Prisma.sql`
    SELECT
      ue."id" AS "id",
      ue."userId" AS "userId",
      ue."plan" AS "plan",
      ue."status" AS "status",
      ue."source" AS "source",
      ue."startAt" AS "startAt",
      ue."endAt" AS "endAt",
      ue."createdAt" AS "createdAt",
      ue."updatedAt" AS "updatedAt"
    FROM "UserEntitlement" ue
    WHERE ue."id" = ${entitlementId}
    LIMIT 1
  `);
  const row = toPersistedEntitlement((inserted[0] as unknown as Record<string, unknown>) ?? null);
  if (!row) {
    throw new Error(`Failed to read inserted entitlement row for userId='${input.userId}'.`);
  }
  return row;
}

async function resolveEffectiveEntitlement(user: User): Promise<EffectiveEntitlement> {
  const persisted = await getCurrentPersistedEntitlement(user.id);
  if (persisted) {
    return {
      ...persisted,
      isPlus: entitlementIsPlus(persisted),
      viaAllowlistFallback: false
    };
  }

  if (allowlistFallbackEnabled()) {
    const plusSubjects = parseCsvSet(process.env.CLEARCASE_PLUS_SUBJECTS);
    const plusEmails = parseCsvSet(process.env.CLEARCASE_PLUS_EMAILS);
    if (
      plusSubjects.has(user.authProviderUserId.trim().toLowerCase()) ||
      plusEmails.has(user.email.trim().toLowerCase())
    ) {
      return {
        id: `allowlist-${user.id}`,
        userId: user.id,
        plan: "plus",
        status: "active",
        source: "manual",
        startAt: null,
        endAt: null,
        createdAt: null,
        updatedAt: null,
        isPlus: true,
        viaAllowlistFallback: true
      };
    }
  }

  return {
    id: `default-free-${user.id}`,
    userId: user.id,
    plan: "free",
    status: "active",
    source: "manual",
    startAt: null,
    endAt: null,
    createdAt: null,
    updatedAt: null,
    isPlus: false,
    viaAllowlistFallback: false
  };
}

async function hasPlusEntitlement(user: User): Promise<boolean> {
  const entitlement = await resolveEffectiveEntitlement(user);
  return entitlement.isPlus;
}

function entitlementResponse(row: EffectiveEntitlement) {
  return {
    id: row.id,
    plan: row.plan,
    status: row.status,
    source: row.source,
    startAt: row.startAt?.toISOString() ?? null,
    endAt: row.endAt?.toISOString() ?? null,
    isPlus: row.isPlus,
    viaAllowlistFallback: row.viaAllowlistFallback
  };
}

function persistedEntitlementResponse(row: PersistedEntitlement) {
  return {
    id: row.id,
    plan: row.plan,
    status: row.status,
    source: row.source,
    startAt: row.startAt?.toISOString() ?? null,
    endAt: row.endAt?.toISOString() ?? null
  };
}

async function listEntitlementHistory(userId: string, limit: number): Promise<PersistedEntitlement[]> {
  await ensureEntitlementStorage();
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      userId: string;
      plan: string;
      status: string;
      source: string;
      startAt: Date;
      endAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    }>
  >(Prisma.sql`
    SELECT
      ue."id" AS "id",
      ue."userId" AS "userId",
      ue."plan" AS "plan",
      ue."status" AS "status",
      ue."source" AS "source",
      ue."startAt" AS "startAt",
      ue."endAt" AS "endAt",
      ue."createdAt" AS "createdAt",
      ue."updatedAt" AS "updatedAt"
    FROM "UserEntitlement" ue
    WHERE ue."userId" = ${userId}
    ORDER BY ue."startAt" DESC, ue."createdAt" DESC
    LIMIT ${limit}
  `);

  return rows
    .map((row) => toPersistedEntitlement(row as unknown as Record<string, unknown>))
    .filter((row): row is PersistedEntitlement => row !== null);
}

async function findUserBySubjectOrEmail(input: {
  subject?: string;
  email?: string;
}): Promise<User | null> {
  const subject = input.subject?.trim();
  if (subject) {
    const bySubject = await prisma.user.findUnique({
      where: {
        authProviderUserId: subject
      }
    });
    if (bySubject) return bySubject;
  }

  const email = input.email?.trim().toLowerCase();
  if (email) {
    const byEmail = await prisma.user.findFirst({
      where: {
        email
      }
    });
    if (byEmail) return byEmail;
  }

  return null;
}

async function latestCaseIdForUser(userId: string): Promise<string | null> {
  const row = await prisma.case.findFirst({
    where: {
      userId
    },
    orderBy: {
      updatedAt: "desc"
    },
    select: {
      id: true
    }
  });
  return row?.id ?? null;
}

async function writeEntitlementAuditEvent(input: {
  userId: string;
  action: "seed" | "grant" | "revoke";
  requestId?: string;
  actorId?: string | null;
  reason?: string | null;
  previous?: PersistedEntitlement | null;
  next?: PersistedEntitlement | null;
}): Promise<void> {
  const auditCaseId = await latestCaseIdForUser(input.userId);
  await prisma.auditLog.create({
    data: {
      caseId: auditCaseId ?? undefined,
      eventType: AuditEventType.CASE_UPDATED,
      actorType: "api",
      actorId: input.actorId ?? undefined,
      requestId: input.requestId,
      payload: {
        subtype: ENTITLEMENT_CHANGE_SUBTYPE,
        action: input.action,
        userId: input.userId,
        reason: input.reason ?? null,
        previous: input.previous
          ? {
              id: input.previous.id,
              plan: input.previous.plan,
              status: input.previous.status,
              source: input.previous.source,
              startAt: input.previous.startAt?.toISOString() ?? null,
              endAt: input.previous.endAt?.toISOString() ?? null
            }
          : null,
        next: input.next
          ? {
              id: input.next.id,
              plan: input.next.plan,
              status: input.next.status,
              source: input.next.source,
              startAt: input.next.startAt?.toISOString() ?? null,
              endAt: input.next.endAt?.toISOString() ?? null
            }
          : null
      } as Prisma.InputJsonValue
    }
  });
}

async function ensureDefaultEntitlementForUser(userId: string): Promise<void> {
  await ensureEntitlementStorage();
  const existing = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT ue."id" AS "id"
    FROM "UserEntitlement" ue
    WHERE ue."userId" = ${userId}
    LIMIT 1
  `);
  if (existing.length > 0) return;

  const seeded = await insertEntitlementRecord({
    userId,
    plan: "free",
    status: "active",
    source: "manual",
    startAt: new Date(),
    endAt: null
  });
  await writeEntitlementAuditEvent({
    userId,
    action: "seed",
    next: seeded
  });
}

async function applyEntitlementGrant(input: {
  userId: string;
  plan: EntitlementPlan;
  status: Exclude<EntitlementStatus, "revoked">;
  source: EntitlementSource;
  startAt: Date;
  endAt: Date | null;
  requestId?: string;
  actorId?: string | null;
}): Promise<{ previous: PersistedEntitlement | null; current: PersistedEntitlement }> {
  const previous = await getCurrentPersistedEntitlement(input.userId);
  await closeCurrentEntitlement(input.userId, input.startAt);
  const current = await insertEntitlementRecord({
    userId: input.userId,
    plan: input.plan,
    status: input.status,
    source: input.source,
    startAt: input.startAt,
    endAt: input.endAt
  });
  await writeEntitlementAuditEvent({
    userId: input.userId,
    action: "grant",
    requestId: input.requestId,
    actorId: input.actorId,
    previous,
    next: current
  });
  return { previous, current };
}

async function applyEntitlementRevoke(input: {
  userId: string;
  source: EntitlementSource;
  reason?: string;
  requestId?: string;
  actorId?: string | null;
}): Promise<{ previous: PersistedEntitlement | null; revoked: PersistedEntitlement; current: PersistedEntitlement }> {
  const now = new Date();
  const previous = await getCurrentPersistedEntitlement(input.userId);
  await closeCurrentEntitlement(input.userId, now);
  const revoked = await insertEntitlementRecord({
    userId: input.userId,
    plan: "plus",
    status: "revoked",
    source: input.source,
    startAt: now,
    endAt: null
  });
  const current = await insertEntitlementRecord({
    userId: input.userId,
    plan: "free",
    status: "active",
    source: "manual",
    startAt: now,
    endAt: null
  });
  await writeEntitlementAuditEvent({
    userId: input.userId,
    action: "revoke",
    requestId: input.requestId,
    actorId: input.actorId,
    reason: input.reason,
    previous,
    next: current
  });
  return { previous, revoked, current };
}

function pushNotificationsEnabled(): boolean {
  return parseBooleanEnv("PUSH_NOTIFICATIONS_ENABLED", true);
}

function pushReminderMaxPerUserPerDay(): number {
  return parsePositiveIntEnv(
    "PUSH_NOTIFICATIONS_DAILY_LIMIT_PER_USER",
    PUSH_REMINDER_MAX_PER_USER_PER_DAY_FALLBACK
  );
}

function isoDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildReminderDate(deadlineDateIso: string, offsetDays: number): Date {
  const deadline = new Date(`${deadlineDateIso}T00:00:00.000Z`);
  deadline.setUTCDate(deadline.getUTCDate() - offsetDays);
  deadline.setUTCHours(PUSH_REMINDER_DEFAULT_DELIVERY_HOUR_UTC, 0, 0, 0);
  return deadline;
}

function reminderDedupeKey(caseId: string, deadlineDateIso: string, offsetDays: number): string {
  return `${caseId}:${deadlineDateIso}:T-${offsetDays}`;
}

function pushPreferenceResponse(value: PushPreference) {
  return {
    enabled: value.enabled,
    language: value.language,
    quietHoursStart: value.quietHoursStart,
    quietHoursEnd: value.quietHoursEnd
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
        CREATE INDEX IF NOT EXISTS "UserPushDevice_userId_isActive_idx"
        ON "UserPushDevice"("userId", "isActive")
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
        CREATE INDEX IF NOT EXISTS "DeadlinePushReminder_caseId_status_idx"
        ON "DeadlinePushReminder"("caseId", "status")
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "DeadlinePushReminder_due_idx"
        ON "DeadlinePushReminder"("status", "nextAttemptAt")
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "DeadlinePushReminder_user_sent_idx"
        ON "DeadlinePushReminder"("userId", "sentAt")
      `);
    })();
  }
  await pushStorageReady;
}

async function getPushPreferenceForUser(userId: string): Promise<PushPreference> {
  await ensurePushStorage();
  const existing = await prisma.$queryRaw<
    Array<{
      id: string;
      userId: string;
      enabled: boolean;
      language: string;
      quietHoursStart: string | null;
      quietHoursEnd: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>
  >(Prisma.sql`
    SELECT
      pref."id" AS "id",
      pref."userId" AS "userId",
      pref."enabled" AS "enabled",
      pref."language" AS "language",
      pref."quietHoursStart" AS "quietHoursStart",
      pref."quietHoursEnd" AS "quietHoursEnd",
      pref."createdAt" AS "createdAt",
      pref."updatedAt" AS "updatedAt"
    FROM "UserNotificationPreference" pref
    WHERE pref."userId" = ${userId}
    LIMIT 1
  `);
  const parsed = toPushPreference((existing[0] as unknown as Record<string, unknown>) ?? null);
  if (parsed) {
    return parsed;
  }

  const createdId = randomUUID();
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "UserNotificationPreference" (
      "id", "userId", "enabled", "language", "quietHoursStart", "quietHoursEnd", "createdAt", "updatedAt"
    )
    VALUES (${createdId}, ${userId}, false, 'en', NULL, NULL, NOW(), NOW())
    ON CONFLICT ("userId") DO NOTHING
  `);

  const reloaded = await prisma.$queryRaw<
    Array<{
      id: string;
      userId: string;
      enabled: boolean;
      language: string;
      quietHoursStart: string | null;
      quietHoursEnd: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>
  >(Prisma.sql`
    SELECT
      pref."id" AS "id",
      pref."userId" AS "userId",
      pref."enabled" AS "enabled",
      pref."language" AS "language",
      pref."quietHoursStart" AS "quietHoursStart",
      pref."quietHoursEnd" AS "quietHoursEnd",
      pref."createdAt" AS "createdAt",
      pref."updatedAt" AS "updatedAt"
    FROM "UserNotificationPreference" pref
    WHERE pref."userId" = ${userId}
    LIMIT 1
  `);
  const fallback = toPushPreference((reloaded[0] as unknown as Record<string, unknown>) ?? null);
  if (!fallback) {
    throw new Error(`Failed to create/read UserNotificationPreference for userId='${userId}'.`);
  }
  return fallback;
}

async function updatePushPreferenceForUser(
  userId: string,
  patch: {
    enabled?: boolean;
    language?: NotificationLanguage;
    quietHoursStart?: string | null;
    quietHoursEnd?: string | null;
  }
): Promise<PushPreference> {
  await ensurePushStorage();
  const current = await getPushPreferenceForUser(userId);
  const nextEnabled = patch.enabled ?? current.enabled;
  const nextLanguage = patch.language ?? current.language;
  const nextQuietStart =
    patch.quietHoursStart !== undefined ? patch.quietHoursStart : current.quietHoursStart;
  const nextQuietEnd = patch.quietHoursEnd !== undefined ? patch.quietHoursEnd : current.quietHoursEnd;

  await prisma.$executeRaw(Prisma.sql`
    UPDATE "UserNotificationPreference"
    SET
      "enabled" = ${nextEnabled},
      "language" = ${nextLanguage},
      "quietHoursStart" = ${nextQuietStart},
      "quietHoursEnd" = ${nextQuietEnd},
      "updatedAt" = NOW()
    WHERE "userId" = ${userId}
  `);

  return getPushPreferenceForUser(userId);
}

async function upsertPushDeviceRegistration(input: {
  userId: string;
  deviceId: string;
  platform: PushPlatform;
  token: string;
  language: NotificationLanguage;
}): Promise<void> {
  await ensurePushStorage();
  const newId = randomUUID();
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "UserPushDevice" (
      "id", "userId", "deviceId", "platform", "token", "language", "isActive", "lastSeenAt", "createdAt", "updatedAt"
    )
    VALUES (${newId}, ${input.userId}, ${input.deviceId}, ${input.platform}, ${input.token}, ${input.language}, true, NOW(), NOW(), NOW())
    ON CONFLICT ("userId", "deviceId")
    DO UPDATE SET
      "platform" = EXCLUDED."platform",
      "token" = EXCLUDED."token",
      "language" = EXCLUDED."language",
      "isActive" = true,
      "lastSeenAt" = NOW(),
      "updatedAt" = NOW()
  `);
}

async function countActivePushDevices(userId: string): Promise<number> {
  await ensurePushStorage();
  const rows = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    SELECT COUNT(*)::int AS "count"
    FROM "UserPushDevice"
    WHERE "userId" = ${userId}
      AND "isActive" = true
  `);
  return Number(rows[0]?.count ?? 0);
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

async function writePushReminderAuditEvent(input: {
  caseId: string;
  userId: string;
  requestId?: string;
  actorType: "api" | "worker";
  actorId?: string | null;
  reminderId?: string;
  dedupeKey?: string;
  outcome: ReminderOutcome;
  reason?: string | null;
  reminderDate?: Date | null;
  deadlineDateIso?: string | null;
  offsetDays?: number | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        caseId: input.caseId,
        eventType: AuditEventType.CASE_UPDATED,
        actorType: input.actorType,
        actorId: input.actorId ?? undefined,
        requestId: input.requestId,
        payload: {
          subtype: PUSH_DELIVERY_SUBTYPE,
          userId: input.userId,
          reminderId: input.reminderId ?? null,
          dedupeKey: input.dedupeKey ?? null,
          outcome: input.outcome,
          reason: input.reason ?? null,
          reminderDate: input.reminderDate?.toISOString() ?? null,
          deadlineDate: input.deadlineDateIso ?? null,
          offsetDays: input.offsetDays ?? null
        } as Prisma.InputJsonValue
      }
    });
  } catch {
    // Push audits are best-effort and should not break user flows.
  }
}

async function suppressScheduledRemindersForCase(input: {
  caseId: string;
  userId: string;
  reason: string;
  requestId?: string;
  actorType: "api" | "worker";
  actorId?: string | null;
}): Promise<number> {
  await ensurePushStorage();
  const rows = await prisma.$queryRaw<
    Array<{ id: string; dedupeKey: string; reminderDate: Date; offsetDays: number; deadlineDate: Date }>
  >(Prisma.sql`
    UPDATE "DeadlinePushReminder"
    SET
      "status" = 'suppressed',
      "reason" = ${input.reason},
      "suppressedAt" = NOW(),
      "updatedAt" = NOW()
    WHERE "caseId" = ${input.caseId}
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
      writePushReminderAuditEvent({
        caseId: input.caseId,
        userId: input.userId,
        requestId: input.requestId,
        actorType: input.actorType,
        actorId: input.actorId,
        reminderId: row.id,
        dedupeKey: row.dedupeKey,
        outcome: "suppressed",
        reason: input.reason,
        reminderDate: row.reminderDate,
        deadlineDateIso: isoDateOnly(row.deadlineDate),
        offsetDays: row.offsetDays
      })
    )
  );

  return rows.length;
}

async function syncCaseDeadlineReminders(input: {
  caseId: string;
  requestId?: string;
  actorType: "api" | "worker";
  actorId?: string | null;
}): Promise<{
  watchEnabled: boolean;
  scheduled: number;
  suppressed: number;
  deadlineDate: string | null;
}> {
  await ensurePushStorage();
  if (!pushNotificationsEnabled()) {
    const found = await prisma.case.findUnique({
      where: { id: input.caseId },
      select: { id: true, userId: true }
    });
    if (!found) {
      return { watchEnabled: false, scheduled: 0, suppressed: 0, deadlineDate: null };
    }
    const suppressed = await suppressScheduledRemindersForCase({
      caseId: found.id,
      userId: found.userId,
      reason: "feature_disabled",
      requestId: input.requestId,
      actorType: input.actorType,
      actorId: input.actorId
    });
    return { watchEnabled: false, scheduled: 0, suppressed, deadlineDate: null };
  }

  const foundCase = await prisma.case.findUnique({
    where: { id: input.caseId },
    select: {
      id: true,
      userId: true,
      earliestDeadline: true
    }
  });
  if (!foundCase) {
    return { watchEnabled: false, scheduled: 0, suppressed: 0, deadlineDate: null };
  }

  const watchEnabled = await latestWatchModeEnabled(foundCase.id);
  if (!watchEnabled || !foundCase.earliestDeadline) {
    const suppressed = await suppressScheduledRemindersForCase({
      caseId: foundCase.id,
      userId: foundCase.userId,
      reason: watchEnabled ? "no_deadline" : "watch_disabled",
      requestId: input.requestId,
      actorType: input.actorType,
      actorId: input.actorId
    });
    return { watchEnabled, scheduled: 0, suppressed, deadlineDate: null };
  }

  const preference = await getPushPreferenceForUser(foundCase.userId);
  const deadlineDate = isoDateOnly(foundCase.earliestDeadline);
  const dedupeKeys: string[] = [];
  const now = new Date();
  let scheduledCount = 0;

  for (const offset of PUSH_REMINDER_OFFSETS_DAYS) {
    const dueAt = buildReminderDate(deadlineDate, offset);
    if (dueAt.getTime() <= now.getTime()) {
      continue;
    }

    const dedupeKey = reminderDedupeKey(foundCase.id, deadlineDate, offset);
    dedupeKeys.push(dedupeKey);
    const inserted = await prisma.$queryRaw<
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
        sentAt: Date | null;
        suppressedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
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
        ${deadlineDate}::date,
        ${dueAt},
        ${offset},
        'scheduled',
        NULL,
        ${preference.language},
        0,
        ${dueAt},
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
        "nextAttemptAt" AS "nextAttemptAt",
        "sentAt" AS "sentAt",
        "suppressedAt" AS "suppressedAt",
        "createdAt" AS "createdAt",
        "updatedAt" AS "updatedAt"
    `);
    const reminder = toPushReminderRow((inserted[0] as unknown as Record<string, unknown>) ?? null);
    if (!reminder || reminder.status !== "scheduled") {
      continue;
    }
    scheduledCount += 1;
    const isInsert = reminder.createdAt && reminder.updatedAt
      ? reminder.createdAt.getTime() === reminder.updatedAt.getTime()
      : false;
    if (isInsert) {
      await writePushReminderAuditEvent({
        caseId: reminder.caseId,
        userId: reminder.userId,
        requestId: input.requestId,
        actorType: input.actorType,
        actorId: input.actorId,
        reminderId: reminder.id,
        dedupeKey: reminder.dedupeKey,
        outcome: "scheduled",
        reason: null,
        reminderDate: reminder.reminderDate,
        deadlineDateIso: isoDateOnly(reminder.deadlineDate),
        offsetDays: reminder.offsetDays
      });
    }
  }

  let staleRows: Array<{ id: string; dedupeKey: string; reminderDate: Date; offsetDays: number; deadlineDate: Date }> =
    [];
  if (dedupeKeys.length > 0) {
    staleRows = await prisma.$queryRaw<
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
    `);
  } else {
    staleRows = await prisma.$queryRaw<
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
  }

  await Promise.all(
    staleRows.map((row) =>
      writePushReminderAuditEvent({
        caseId: foundCase.id,
        userId: foundCase.userId,
        requestId: input.requestId,
        actorType: input.actorType,
        actorId: input.actorId,
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

  return {
    watchEnabled,
    scheduled: scheduledCount,
    suppressed: staleRows.length,
    deadlineDate
  };
}

function sendPlusRequired(reply: FastifyReply, requestId: string): void {
  reply.status(403).send({
    error: "PLUS_REQUIRED",
    code: "PLUS_REQUIRED",
    requestId
  });
}

const DEFAULT_FREE_MONTHLY_PAGE_LIMIT = 5;
const DEFAULT_FREE_DAILY_UPLOAD_LIMIT = 10;

function parsePositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    return fallback;
  }
  return value;
}

function parseBooleanEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === "1" || raw === "true" || raw === "yes" || raw === "on") return true;
  if (raw === "0" || raw === "false" || raw === "no" || raw === "off") return false;
  return fallback;
}

function getFreeMonthlyPageLimit(): number {
  return parsePositiveIntEnv("FREE_MONTHLY_PAGE_LIMIT", DEFAULT_FREE_MONTHLY_PAGE_LIMIT);
}

function getFreeDailyUploadLimit(): number {
  return parsePositiveIntEnv("FREE_DAILY_UPLOAD_LIMIT", DEFAULT_FREE_DAILY_UPLOAD_LIMIT);
}

function isGlobalFreeOcrEnabled(): boolean {
  return parseBooleanEnv("GLOBAL_FREE_OCR_ENABLED", true);
}

function billingEnabled(): boolean {
  return parseBooleanEnv("BILLING_ENABLED", true);
}

function billingProvider(): BillingProvider {
  const raw = process.env.BILLING_PROVIDER?.trim().toLowerCase();
  return raw === BILLING_PROVIDER_STRIPE ? BILLING_PROVIDER_STRIPE : BILLING_PROVIDER_INTERNAL;
}

function paywallVariantFlag(): string {
  return process.env.PAYWALL_VARIANT?.trim() || DEFAULT_PAYWALL_VARIANT;
}

function plusPriceMonthlyToken(): string {
  return process.env.PLUS_PRICE_MONTHLY?.trim() || DEFAULT_PLUS_PRICE_MONTHLY;
}

function checkoutAltPlanEnabled(): boolean {
  return parseBooleanEnv("ENABLE_ALT_PLUS_PLAN", false);
}

function billingGraceDays(): number {
  return parsePositiveIntEnv("BILLING_GRACE_DAYS", BILLING_GRACE_DAYS_DEFAULT);
}

function billingWebhookSecret(): string | null {
  const value = process.env.BILLING_WEBHOOK_SECRET?.trim();
  return value && value.length > 0 ? value : null;
}

function formatBillingSignature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function verifyBillingSignature(signatureHeader: string | null, payload: string, secret: string): boolean {
  if (!signatureHeader) return false;
  const raw = signatureHeader.trim();

  // Stripe signature format: t=timestamp,v1=signature
  if (raw.includes("t=") && raw.includes("v1=")) {
    return verifyStripeSignature(raw, payload, secret);
  }

  // ClearCase internal format: sha256=hex or raw hex
  const lowered = raw.toLowerCase();
  const providedHex = lowered.startsWith("sha256=") ? lowered.slice("sha256=".length) : lowered;
  if (!/^[a-f0-9]+$/.test(providedHex)) return false;
  const expectedHex = formatBillingSignature(payload, secret);
  const providedBuffer = Buffer.from(providedHex, "hex");
  const expectedBuffer = Buffer.from(expectedHex, "hex");
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

function verifyStripeSignature(header: string, payload: string, secret: string): boolean {
  const STRIPE_TOLERANCE_SECONDS = 300;
  const parts = header.split(",");
  const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
  const signature = parts.find((p) => p.startsWith("v1="))?.slice(3);
  if (!timestamp || !signature) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const age = Math.abs(Date.now() / 1000 - ts);
  if (age > STRIPE_TOLERANCE_SECONDS) return false;

  const expectedSig = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  const expectedBuffer = Buffer.from(expectedSig, "hex");
  const actualBuffer = Buffer.from(signature, "hex");
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, actualBuffer);
}

function addDays(reference: Date, days: number): Date {
  const next = new Date(reference);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function normalizeWebhookEnvelope(input: z.infer<typeof billingWebhookBodySchema>): BillingWebhookEnvelope {
  return {
    provider: input.provider,
    eventId: input.eventId,
    eventType: input.eventType,
    createdAt: input.createdAt ? asDateOrNull(input.createdAt) : null,
    subscription: {
      providerSubscriptionId: input.subscription.providerSubscriptionId,
      providerCustomerId: input.subscription.providerCustomerId ?? null,
      status: input.subscription.status ?? null,
      currentPeriodStart: input.subscription.currentPeriodStart
        ? asDateOrNull(input.subscription.currentPeriodStart)
        : null,
      currentPeriodEnd: input.subscription.currentPeriodEnd
        ? asDateOrNull(input.subscription.currentPeriodEnd)
        : null,
      cancelAtPeriodEnd: input.subscription.cancelAtPeriodEnd === true,
      graceUntil: input.subscription.graceUntil ? asDateOrNull(input.subscription.graceUntil) : null
    },
    user: input.user
      ? {
          userId: input.user.userId?.trim(),
          subject: input.user.subject?.trim(),
          email: input.user.email?.trim().toLowerCase()
        }
      : null,
    metadata: input.metadata ?? {}
  };
}

function billingStatusShouldHavePlus(status: BillingSubscriptionStatus, row: {
  currentPeriodEnd: Date | null;
  graceUntil: Date | null;
}, now: Date): boolean {
  if (status === "active" || status === "trialing") return true;
  if (status === "cancelled") {
    return row.currentPeriodEnd ? row.currentPeriodEnd.getTime() > now.getTime() : false;
  }
  if (status === "past_due" || status === "payment_failed") {
    return row.graceUntil ? row.graceUntil.getTime() > now.getTime() : false;
  }
  return false;
}

async function ensureBillingStorage(): Promise<void> {
  if (!billingStorageReady) {
    billingStorageReady = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "BillingSubscription" (
          "id" TEXT PRIMARY KEY,
          "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
          "provider" TEXT NOT NULL CHECK ("provider" IN ('internal_stub', 'stripe')),
          "providerCustomerId" TEXT NULL,
          "providerSubscriptionId" TEXT NOT NULL,
          "status" TEXT NOT NULL CHECK ("status" IN ('active', 'trialing', 'cancelled', 'past_due', 'payment_failed', 'ended', 'unknown')),
          "currentPeriodStart" TIMESTAMPTZ NULL,
          "currentPeriodEnd" TIMESTAMPTZ NULL,
          "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
          "graceUntil" TIMESTAMPTZ NULL,
          "lastEventId" TEXT NULL,
          "lastEventCreatedAt" TIMESTAMPTZ NULL,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "BillingSubscription_providerSubscriptionId_key"
        ON "BillingSubscription"("provider", "providerSubscriptionId")
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "BillingSubscription_userId_idx"
        ON "BillingSubscription"("userId")
      `);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "BillingWebhookEvent" (
          "id" TEXT PRIMARY KEY,
          "provider" TEXT NOT NULL CHECK ("provider" IN ('internal_stub', 'stripe')),
          "eventId" TEXT NOT NULL,
          "eventType" TEXT NOT NULL,
          "status" TEXT NOT NULL,
          "receivedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "processedAt" TIMESTAMPTZ NULL,
          "payload" JSONB NOT NULL,
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "BillingWebhookEvent"
        ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      `);
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "BillingWebhookEvent_provider_eventId_key"
        ON "BillingWebhookEvent"("provider", "eventId")
      `);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "BillingCheckoutSession" (
          "id" TEXT PRIMARY KEY,
          "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
          "provider" TEXT NOT NULL CHECK ("provider" IN ('internal_stub', 'stripe')),
          "sessionId" TEXT NOT NULL,
          "status" TEXT NOT NULL CHECK ("status" IN ('created', 'completed', 'expired', 'failed')),
          "checkoutUrl" TEXT NOT NULL,
          "plan" TEXT NOT NULL,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "BillingCheckoutSession_userId_idx"
        ON "BillingCheckoutSession"("userId", "createdAt" DESC)
      `);
    })();
  }
  await billingStorageReady;
}

async function logPaywallEvent(input: {
  userId: string;
  requestId?: string;
  event: string;
  source?: string;
  locale?: NotificationLanguage;
  paywallVariant?: string;
  properties?: Record<string, unknown>;
}): Promise<void> {
  const caseId = await latestCaseIdForUser(input.userId);
  await prisma.auditLog.create({
    data: {
      caseId: caseId ?? undefined,
      eventType: AuditEventType.CASE_UPDATED,
      actorType: "user",
      actorId: input.userId,
      requestId: input.requestId,
      payload: {
        subtype: PAYWALL_EVENT_SUBTYPE,
        event: input.event,
        source: input.source ?? null,
        locale: input.locale ?? null,
        paywallVariant: input.paywallVariant ?? paywallVariantFlag(),
        properties: input.properties ?? {}
      } as Prisma.InputJsonValue
    }
  });
}

async function trackLifecycleEvent(input: {
  userId: string;
  requestId?: string;
  event: string;
  source?: string;
  locale?: NotificationLanguage;
  paywallVariant?: string;
  properties?: Record<string, unknown>;
}): Promise<void> {
  const normalizedEvent = input.event.trim().toLowerCase();
  if (DIRECT_TRACKED_EVENT_SUBTYPES.has(normalizedEvent)) {
    const caseId = await latestCaseIdForUser(input.userId);
    await prisma.auditLog.create({
      data: {
        caseId: caseId ?? undefined,
        eventType: AuditEventType.CASE_UPDATED,
        actorType: "user",
        actorId: input.userId,
        requestId: input.requestId,
        payload: {
          subtype: normalizedEvent,
          source: input.source ?? null,
          locale: input.locale ?? null,
          paywallVariant: input.paywallVariant ?? paywallVariantFlag(),
          properties: input.properties ?? {}
        } as Prisma.InputJsonValue
      }
    });
    return;
  }

  await logPaywallEvent({
    userId: input.userId,
    requestId: input.requestId,
    event: normalizedEvent,
    source: input.source,
    locale: input.locale,
    paywallVariant: input.paywallVariant,
    properties: input.properties
  });
}

async function writeBillingWebhookAudit(input: {
  userId?: string | null;
  requestId?: string;
  eventId: string;
  eventType: BillingEventType;
  status: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  const caseId = input.userId ? await latestCaseIdForUser(input.userId) : null;
  await prisma.auditLog.create({
    data: {
      caseId: caseId ?? undefined,
      eventType: AuditEventType.CASE_UPDATED,
      actorType: "api",
      actorId: input.userId ?? undefined,
      requestId: input.requestId,
      payload: {
        subtype: BILLING_WEBHOOK_SUBTYPE,
        eventId: input.eventId,
        eventType: input.eventType,
        status: input.status,
        ...(input.details ?? {})
      } as Prisma.InputJsonValue
    }
  });
}

async function insertBillingWebhookReceipt(input: {
  provider: BillingProvider;
  eventId: string;
  eventType: BillingEventType;
  payload: Record<string, unknown>;
}): Promise<{ inserted: boolean; id: string | null }> {
  await ensureBillingStorage();
  const id = randomUUID();
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    INSERT INTO "BillingWebhookEvent" (
      "id",
      "provider",
      "eventId",
      "eventType",
      "status",
      "receivedAt",
      "processedAt",
      "payload"
    )
    VALUES (
      ${id},
      ${input.provider},
      ${input.eventId},
      ${input.eventType},
      'received',
      NOW(),
      NULL,
      ${input.payload as Prisma.InputJsonValue}
    )
    ON CONFLICT ("provider", "eventId") DO NOTHING
    RETURNING "id" AS "id"
  `);
  if (rows.length === 0) {
    return { inserted: false, id: null };
  }
  return { inserted: true, id: rows[0].id };
}

async function updateBillingWebhookReceiptStatus(
  id: string,
  status: string,
  payloadPatch?: Record<string, unknown>
): Promise<void> {
  await ensureBillingStorage();
  if (payloadPatch) {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "BillingWebhookEvent"
      SET
        "status" = ${status},
        "processedAt" = NOW(),
        "payload" = ("payload" || ${payloadPatch as Prisma.InputJsonValue}::jsonb),
        "updatedAt" = NOW()
      WHERE "id" = ${id}
    `);
    return;
  }
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "BillingWebhookEvent"
    SET
      "status" = ${status},
      "processedAt" = NOW(),
      "updatedAt" = NOW()
    WHERE "id" = ${id}
  `);
}

async function findBillingUser(input: BillingWebhookEnvelope["user"]): Promise<User | null> {
  if (!input) return null;
  if (input.userId) {
    const byId = await prisma.user.findUnique({
      where: {
        id: input.userId
      }
    });
    if (byId) return byId;
  }
  return findUserBySubjectOrEmail({
    subject: input.subject,
    email: input.email
  });
}

async function getBillingSubscriptionByProviderSubscriptionId(
  provider: BillingProvider,
  providerSubscriptionId: string
): Promise<BillingSubscriptionRow | null> {
  await ensureBillingStorage();
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      userId: string;
      provider: string;
      providerCustomerId: string | null;
      providerSubscriptionId: string;
      status: string;
      currentPeriodStart: Date | null;
      currentPeriodEnd: Date | null;
      cancelAtPeriodEnd: boolean;
      graceUntil: Date | null;
      lastEventId: string | null;
      lastEventCreatedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    }>
  >(Prisma.sql`
    SELECT
      bs."id" AS "id",
      bs."userId" AS "userId",
      bs."provider" AS "provider",
      bs."providerCustomerId" AS "providerCustomerId",
      bs."providerSubscriptionId" AS "providerSubscriptionId",
      bs."status" AS "status",
      bs."currentPeriodStart" AS "currentPeriodStart",
      bs."currentPeriodEnd" AS "currentPeriodEnd",
      bs."cancelAtPeriodEnd" AS "cancelAtPeriodEnd",
      bs."graceUntil" AS "graceUntil",
      bs."lastEventId" AS "lastEventId",
      bs."lastEventCreatedAt" AS "lastEventCreatedAt",
      bs."createdAt" AS "createdAt",
      bs."updatedAt" AS "updatedAt"
    FROM "BillingSubscription" bs
    WHERE bs."provider" = ${provider}
      AND bs."providerSubscriptionId" = ${providerSubscriptionId}
    LIMIT 1
  `);
  return toBillingSubscriptionRow((rows[0] as unknown as Record<string, unknown>) ?? null);
}

async function upsertBillingSubscription(input: {
  userId: string;
  envelope: BillingWebhookEnvelope;
  eventCreatedAt: Date;
}): Promise<BillingSubscriptionRow> {
  await ensureBillingStorage();
  const id = randomUUID();
  const normalizedStatus = normalizeBillingSubscriptionStatus(input.envelope.subscription.status);
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "BillingSubscription" (
      "id",
      "userId",
      "provider",
      "providerCustomerId",
      "providerSubscriptionId",
      "status",
      "currentPeriodStart",
      "currentPeriodEnd",
      "cancelAtPeriodEnd",
      "graceUntil",
      "lastEventId",
      "lastEventCreatedAt",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${id},
      ${input.userId},
      ${input.envelope.provider},
      ${input.envelope.subscription.providerCustomerId},
      ${input.envelope.subscription.providerSubscriptionId},
      ${normalizedStatus},
      ${input.envelope.subscription.currentPeriodStart},
      ${input.envelope.subscription.currentPeriodEnd},
      ${input.envelope.subscription.cancelAtPeriodEnd},
      ${input.envelope.subscription.graceUntil},
      ${input.envelope.eventId},
      ${input.eventCreatedAt},
      NOW(),
      NOW()
    )
    ON CONFLICT ("provider", "providerSubscriptionId")
    DO UPDATE SET
      "userId" = EXCLUDED."userId",
      "providerCustomerId" = EXCLUDED."providerCustomerId",
      "status" = EXCLUDED."status",
      "currentPeriodStart" = EXCLUDED."currentPeriodStart",
      "currentPeriodEnd" = EXCLUDED."currentPeriodEnd",
      "cancelAtPeriodEnd" = EXCLUDED."cancelAtPeriodEnd",
      "graceUntil" = EXCLUDED."graceUntil",
      "lastEventId" = EXCLUDED."lastEventId",
      "lastEventCreatedAt" = EXCLUDED."lastEventCreatedAt",
      "updatedAt" = NOW()
  `);

  const upserted = await getBillingSubscriptionByProviderSubscriptionId(
    input.envelope.provider,
    input.envelope.subscription.providerSubscriptionId
  );
  if (!upserted) {
    throw new Error(
      `Failed to load BillingSubscription for providerSubscriptionId='${input.envelope.subscription.providerSubscriptionId}'.`
    );
  }
  return upserted;
}

async function clearFutureBillingFallbackEntitlements(userId: string, startAt: Date): Promise<void> {
  await ensureEntitlementStorage();
  await prisma.$executeRaw(Prisma.sql`
    DELETE FROM "UserEntitlement"
    WHERE "userId" = ${userId}
      AND "plan" = 'free'
      AND "status" = 'active'
      AND "source" = 'billing'
      AND "startAt" >= ${startAt}
  `);
}

async function scheduleBillingFreeEntitlement(userId: string, startAt: Date): Promise<PersistedEntitlement> {
  await clearFutureBillingFallbackEntitlements(userId, startAt);
  const scheduled = await insertEntitlementRecord({
    userId,
    plan: "free",
    status: "active",
    source: "billing",
    startAt,
    endAt: null
  });
  await writeEntitlementAuditEvent({
    userId,
    action: "grant",
    next: scheduled,
    reason: "scheduled_billing_fallback"
  });
  return scheduled;
}

async function applyBillingDrivenEntitlement(input: {
  user: User;
  envelope: BillingWebhookEnvelope;
  eventCreatedAt: Date;
  requestId?: string;
}): Promise<{ transition: string; effective: EffectiveEntitlement }> {
  const now = new Date();
  const normalizedStatus = normalizeBillingSubscriptionStatus(input.envelope.subscription.status);
  const periodEnd = input.envelope.subscription.currentPeriodEnd;
  const graceUntil =
    input.envelope.subscription.graceUntil && input.envelope.subscription.graceUntil.getTime() > now.getTime()
      ? input.envelope.subscription.graceUntil
      : addDays(now, billingGraceDays());

  let transition = "noop";
  if (
    input.envelope.eventType === "create" ||
    (input.envelope.eventType === "update" &&
      (normalizedStatus === "active" || normalizedStatus === "trialing") &&
      !input.envelope.subscription.cancelAtPeriodEnd)
  ) {
    await applyEntitlementGrant({
      userId: input.user.id,
      plan: "plus",
      status: normalizedStatus === "trialing" ? "trial" : "active",
      source: "billing",
      startAt: now,
      endAt: null,
      requestId: input.requestId,
      actorId: input.user.id
    });
    await clearFutureBillingFallbackEntitlements(input.user.id, now);
    transition = "plus_active";
  } else if (
    input.envelope.eventType === "cancel" ||
    input.envelope.subscription.cancelAtPeriodEnd === true ||
    normalizedStatus === "cancelled"
  ) {
    if (periodEnd && periodEnd.getTime() > now.getTime()) {
      await applyEntitlementGrant({
        userId: input.user.id,
        plan: "plus",
        status: "active",
        source: "billing",
        startAt: now,
        endAt: periodEnd,
        requestId: input.requestId,
        actorId: input.user.id
      });
      await scheduleBillingFreeEntitlement(input.user.id, periodEnd);
      transition = "plus_until_period_end";
    } else {
      await applyEntitlementRevoke({
        userId: input.user.id,
        source: "billing",
        reason: "subscription_cancelled",
        requestId: input.requestId,
        actorId: input.user.id
      });
      transition = "revoked_immediate_cancel";
    }
  } else if (
    input.envelope.eventType === "past_due" ||
    input.envelope.eventType === "payment_failed" ||
    normalizedStatus === "past_due" ||
    normalizedStatus === "payment_failed"
  ) {
    await applyEntitlementGrant({
      userId: input.user.id,
      plan: "plus",
      status: "trial",
      source: "billing",
      startAt: now,
      endAt: graceUntil,
      requestId: input.requestId,
      actorId: input.user.id
    });
    await scheduleBillingFreeEntitlement(input.user.id, graceUntil);
    transition = "grace_period";
  } else if (normalizedStatus === "ended") {
    await applyEntitlementRevoke({
      userId: input.user.id,
      source: "billing",
      reason: "subscription_ended",
      requestId: input.requestId,
      actorId: input.user.id
    });
    transition = "revoked_ended";
  }

  const effective = await resolveEffectiveEntitlement(input.user);
  await writeBillingWebhookAudit({
    userId: input.user.id,
    requestId: input.requestId,
    eventId: input.envelope.eventId,
    eventType: input.envelope.eventType,
    status: transition,
    details: {
      normalizedStatus,
      periodEnd: periodEnd?.toISOString() ?? null,
      graceUntil: graceUntil?.toISOString() ?? null
    }
  });
  return { transition, effective };
}

async function createInternalStubCheckoutSession(input: {
  user: User;
  plan: "plus_monthly";
  successUrl: string;
  cancelUrl: string;
}): Promise<{ sessionId: string; checkoutUrl: string }> {
  const sessionId = `chk_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
  const base =
    process.env.BILLING_STUB_CHECKOUT_BASE_URL?.trim() ||
    "https://billing.clearcase.local/checkout";
  const checkoutUrl = `${base}?session_id=${encodeURIComponent(sessionId)}&plan=${encodeURIComponent(
    input.plan
  )}&uid=${encodeURIComponent(input.user.id)}&success_url=${encodeURIComponent(
    input.successUrl
  )}&cancel_url=${encodeURIComponent(input.cancelUrl)}`;
  return { sessionId, checkoutUrl };
}

async function createStripeCheckoutSession(input: {
  user: User;
  plan: "plus_monthly";
  successUrl: string;
  cancelUrl: string;
}): Promise<{ sessionId: string; checkoutUrl: string }> {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const stripePriceId = process.env.STRIPE_PRICE_ID_PLUS_MONTHLY?.trim();
  if (!stripeSecretKey || !stripePriceId) {
    throw new Error("Stripe checkout is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID_PLUS_MONTHLY.");
  }

  const body = new URLSearchParams();
  body.set("mode", "subscription");
  body.set("client_reference_id", input.user.id);
  body.set("customer_email", input.user.email);
  body.set("success_url", input.successUrl);
  body.set("cancel_url", input.cancelUrl);
  body.set("line_items[0][price]", stripePriceId);
  body.set("line_items[0][quantity]", "1");

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Stripe checkout session creation failed: ${response.status} ${detail}`);
  }

  const json = (await response.json()) as {
    id?: string;
    url?: string;
  };
  if (!json.id || !json.url) {
    throw new Error("Stripe checkout session response missing id/url.");
  }
  return {
    sessionId: json.id,
    checkoutUrl: json.url
  };
}

async function persistCheckoutSession(input: {
  userId: string;
  provider: BillingProvider;
  sessionId: string;
  checkoutUrl: string;
  plan: "plus_monthly";
}): Promise<void> {
  await ensureBillingStorage();
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "BillingCheckoutSession" (
      "id",
      "userId",
      "provider",
      "sessionId",
      "status",
      "checkoutUrl",
      "plan",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${randomUUID()},
      ${input.userId},
      ${input.provider},
      ${input.sessionId},
      'created',
      ${input.checkoutUrl},
      ${input.plan},
      NOW(),
      NOW()
    )
  `);
}

function utcMonthBounds(reference: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return { start, end };
}

function utcDayBounds(reference: Date): { start: Date; end: Date } {
  const start = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate(), 0, 0, 0, 0)
  );
  const end = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate() + 1, 0, 0, 0, 0)
  );
  return { start, end };
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function extractCaseUpdatedSubtype(payload: unknown): string | null {
  const record = asObject(payload);
  if (!record) return null;
  return typeof record.subtype === "string" ? record.subtype : null;
}

function extractQueueMessageId(payload: unknown): string | null {
  const record = asObject(payload);
  if (!record) return null;
  return typeof record.queueMessageId === "string" ? record.queueMessageId : null;
}

function asPositiveInt(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.floor(parsed);
  if (rounded <= 0) return null;
  return rounded;
}

function extractPageCountFromOcrPayload(payload: unknown): number | null {
  const row = asObject(payload);
  if (!row) return null;
  const providerMetadata = asObject(row.providerMetadata);
  const sourceMetadata = asObject(row.sourceMetadata);

  return (
    asPositiveInt(providerMetadata?.pageCount) ??
    asPositiveInt(sourceMetadata?.pageCount) ??
    null
  );
}

function extractPageUnitEstimateFromOcrPayload(payload: unknown): number | null {
  const row = asObject(payload);
  if (!row) return null;
  const providerMetadata = asObject(row.providerMetadata);
  const sourceMetadata = asObject(row.sourceMetadata);

  return (
    asPositiveInt(row.pageUnitEstimate) ??
    asPositiveInt(providerMetadata?.pageUnitEstimate) ??
    asPositiveInt(sourceMetadata?.pageUnitEstimate) ??
    null
  );
}

function extractMimeTypeFromOcrPayload(payload: unknown): string | null {
  const row = asObject(payload);
  if (!row) return null;
  const sourceMetadata = asObject(row.sourceMetadata);
  const mimeType = sourceMetadata?.mimeType;
  return typeof mimeType === "string" && mimeType.trim() ? mimeType.trim().toLowerCase() : null;
}

function isPdfLike(assetType: AssetType, mimeType: string): boolean {
  return assetType === AssetType.DOCUMENT_PDF || mimeType.toLowerCase().includes("pdf");
}

function derivePageUnits(input: {
  assetType: AssetType;
  mimeType: string;
  detectedPageCount: number | null;
}): number {
  if (input.detectedPageCount && input.detectedPageCount > 0) {
    return input.detectedPageCount;
  }
  if (isPdfLike(input.assetType, input.mimeType)) {
    return 1;
  }
  return 1;
}

function derivePageUnitsFromOcrPayload(payload: unknown): number {
  const explicitPageUnits = extractPageUnitEstimateFromOcrPayload(payload);
  if (explicitPageUnits && explicitPageUnits > 0) {
    return explicitPageUnits;
  }
  const detectedPageCount = extractPageCountFromOcrPayload(payload);
  const mimeType = extractMimeTypeFromOcrPayload(payload) ?? "application/octet-stream";
  return derivePageUnits({
    assetType: mimeType.includes("pdf") ? AssetType.DOCUMENT_PDF : AssetType.DOCUMENT_IMAGE,
    mimeType,
    detectedPageCount
  });
}

async function estimateAssetPageUnits(asset: {
  id: string;
  assetType: AssetType;
  mimeType: string;
}): Promise<number> {
  const logs = await prisma.auditLog.findMany({
    where: {
      assetId: asset.id,
      eventType: AuditEventType.OCR_RUN
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 5,
    select: {
      payload: true
    }
  });

  for (const row of logs) {
    const payload = asObject(row.payload);
    if (!payload) continue;
    if (payload.status !== "succeeded") continue;
    const explicitPageUnits = extractPageUnitEstimateFromOcrPayload(payload);
    if (explicitPageUnits && explicitPageUnits > 0) {
      return explicitPageUnits;
    }
    const detected = extractPageCountFromOcrPayload(payload);
    if (detected && detected > 0) {
      return derivePageUnits({
        assetType: asset.assetType,
        mimeType: asset.mimeType,
        detectedPageCount: detected
      });
    }
  }

  return derivePageUnits({
    assetType: asset.assetType,
    mimeType: asset.mimeType,
    detectedPageCount: null
  });
}

async function getFreeMonthlyProcessedPageUnits(
  userId: string,
  start: Date,
  end: Date
): Promise<number> {
  return getFreeMonthlyProcessedPageUnitsFromClient(prisma, userId, start, end);
}

async function getFreeMonthlyProcessedPageUnitsFromClient(
  client: Pick<Prisma.TransactionClient, "auditLog">,
  userId: string,
  start: Date,
  end: Date
): Promise<number> {
  const logs = await client.auditLog.findMany({
    where: {
      eventType: AuditEventType.OCR_RUN,
      createdAt: {
        gte: start,
        lt: end
      },
      case: {
        userId
      }
    },
    select: {
      payload: true
    }
  });

  let used = 0;
  for (const row of logs) {
    const payload = asObject(row.payload);
    if (!payload || payload.status !== "succeeded") continue;
    used += derivePageUnitsFromOcrPayload(payload);
  }
  return used;
}

async function getFreeMonthlyReservedPageUnits(
  tx: Prisma.TransactionClient,
  userId: string,
  start: Date,
  end: Date
): Promise<number> {
  const reservationLogs = await tx.auditLog.findMany({
    where: {
      eventType: AuditEventType.CASE_UPDATED,
      createdAt: {
        gte: start,
        lt: end
      },
      case: {
        userId
      }
    },
    select: {
      assetId: true,
      payload: true
    }
  });

  const reservationByAsset = new Map<string, number>();
  for (const row of reservationLogs) {
    const subtype = extractCaseUpdatedSubtype(row.payload);
    if (subtype !== FREE_QUOTA_RESERVATION_SUBTYPE) continue;
    if (!row.assetId) continue;
    const payload = asObject(row.payload);
    const units = asPositiveInt(payload?.pageUnits) ?? 1;
    reservationByAsset.set(row.assetId, units);
  }

  if (reservationByAsset.size === 0) return 0;
  const reservedAssetIds = Array.from(reservationByAsset.keys());
  const ocrLogs = await tx.auditLog.findMany({
    where: {
      eventType: AuditEventType.OCR_RUN,
      assetId: {
        in: reservedAssetIds
      }
    },
    select: {
      assetId: true,
      payload: true
    }
  });

  const succeededAssets = new Set<string>();
  for (const row of ocrLogs) {
    if (!row.assetId) continue;
    const payload = asObject(row.payload);
    if (payload?.status === "succeeded") {
      succeededAssets.add(row.assetId);
    }
  }

  let reservedUnits = 0;
  for (const [assetId, units] of reservationByAsset.entries()) {
    if (!succeededAssets.has(assetId)) {
      reservedUnits += units;
    }
  }
  return reservedUnits;
}

async function getFreeDailyUploadCount(
  userId: string,
  start: Date,
  end: Date
): Promise<number> {
  const logs = await prisma.auditLog.findMany({
    where: {
      eventType: AuditEventType.CASE_UPDATED,
      createdAt: {
        gte: start,
        lt: end
      },
      case: {
        userId
      }
    },
    select: {
      payload: true
    }
  });

  let count = 0;
  for (const row of logs) {
    if (extractCaseUpdatedSubtype(row.payload) === ASSET_UPLOADED_ENQUEUED_SUBTYPE) {
      count += 1;
    }
  }
  return count;
}

async function getFreeDailyReservedUploadCount(
  tx: Prisma.TransactionClient,
  userId: string,
  start: Date,
  end: Date
): Promise<number> {
  const logs = await tx.auditLog.findMany({
    where: {
      eventType: AuditEventType.CASE_UPDATED,
      createdAt: {
        gte: start,
        lt: end
      },
      case: {
        userId
      }
    },
    select: {
      assetId: true,
      payload: true
    }
  });

  const activeAssetIds = new Set<string>();
  for (const row of logs) {
    if (!row.assetId) continue;
    const subtype = extractCaseUpdatedSubtype(row.payload);
    if (!subtype) continue;
    if (
      subtype === ASSET_UPLOADED_ENQUEUED_SUBTYPE ||
      subtype === ASSET_UPLOADED_ENQUEUING_SUBTYPE ||
      subtype === FREE_QUOTA_RESERVATION_SUBTYPE
    ) {
      activeAssetIds.add(row.assetId);
    }
  }

  return activeAssetIds.size;
}

type OpsMetricAuditInput = {
  requestId: string;
  subtype: string;
  actorId?: string | null;
  caseId?: string | null;
  assetId?: string | null;
  details?: Record<string, unknown>;
};

async function writeOpsMetricAudit(input: OpsMetricAuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        caseId: input.caseId ?? undefined,
        assetId: input.assetId ?? undefined,
        eventType: AuditEventType.CASE_UPDATED,
        actorType: "api",
        actorId: input.actorId ?? undefined,
        requestId: input.requestId,
        payload: {
          subtype: input.subtype,
          ...(input.details ?? {})
        } as Prisma.InputJsonValue
      }
    });
  } catch {
    // Monitoring logs are best-effort and should never break request handling.
  }
}

function getHeaderStringValue(value: string | string[] | undefined): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];
    if (typeof first === "string" && first.trim().length > 0) {
      return first.trim();
    }
  }
  return null;
}

function isOpsMetricsAuthorized(headers: Record<string, unknown>): boolean {
  const expectedToken = process.env.OPS_METRICS_TOKEN?.trim();
  if (!expectedToken) {
    return true;
  }
  const provided = getHeaderStringValue(
    (headers["x-ops-token"] as string | string[] | undefined) ?? undefined
  );
  return provided === expectedToken;
}

function isOpsAdminAuthorized(headers: Record<string, unknown>): boolean {
  const expectedToken = process.env.OPS_ADMIN_TOKEN?.trim() ?? process.env.OPS_METRICS_TOKEN?.trim();
  if (!expectedToken) {
    return process.env.NODE_ENV !== "production";
  }
  const provided = getHeaderStringValue(
    (headers["x-ops-token"] as string | string[] | undefined) ?? undefined
  );
  return provided === expectedToken;
}

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

type OpsWindowSummary = {
  start: string;
  end: string;
  hours: number;
  days: number;
  freeLimitReached: { count: number; perHour: number; perDay: number };
  freeOcrDisabled: { count: number; perHour: number; perDay: number };
  plusRequired: { count: number; perHour: number; perDay: number };
  ocrRuns: {
    succeeded: number;
    failed: number;
    total: number;
    failureRatePct: number;
    pageUnitsTotal: number;
    successPerHour: number;
    failurePerHour: number;
  };
  consultLinks: {
    created: number;
    disabled: number;
    createdPerDay: number;
    disabledPerDay: number;
  };
  finalizeEnqueue: {
    succeeded: number;
    failed: number;
    total: number;
    failureRatePct: number;
    successPerHour: number;
    failurePerHour: number;
  };
};

async function buildOpsWindowSummary(start: Date, end: Date): Promise<OpsWindowSummary> {
  const logs = await prisma.auditLog.findMany({
    where: {
      createdAt: {
        gte: start,
        lt: end
      },
      eventType: {
        in: [AuditEventType.CASE_UPDATED, AuditEventType.OCR_RUN]
      }
    },
    select: {
      eventType: true,
      payload: true
    }
  });

  let freeLimitReachedCount = 0;
  let freeOcrDisabledCount = 0;
  let plusRequiredCount = 0;
  let ocrSucceededCount = 0;
  let ocrFailedCount = 0;
  let ocrPageUnitsTotal = 0;
  let consultLinkCreatedCount = 0;
  let consultLinkDisabledCount = 0;
  let finalizeEnqueueSucceededCount = 0;
  let finalizeEnqueueFailedCount = 0;

  for (const row of logs) {
    if (row.eventType === AuditEventType.OCR_RUN) {
      const payload = asObject(row.payload);
      if (!payload) continue;
      const status = typeof payload.status === "string" ? payload.status : null;
      if (status === "succeeded") {
        ocrSucceededCount += 1;
        ocrPageUnitsTotal += derivePageUnitsFromOcrPayload(payload);
      } else if (status === "failed") {
        ocrFailedCount += 1;
      }
      continue;
    }

    const subtype = extractCaseUpdatedSubtype(row.payload);
    if (!subtype) continue;

    if (subtype === OPS_SUBTYPE_FREE_LIMIT_REACHED) {
      freeLimitReachedCount += 1;
      continue;
    }
    if (subtype === OPS_SUBTYPE_FREE_OCR_DISABLED) {
      freeOcrDisabledCount += 1;
      continue;
    }
    if (subtype === OPS_SUBTYPE_PLUS_REQUIRED) {
      plusRequiredCount += 1;
      continue;
    }
    if (subtype === OPS_SUBTYPE_CONSULT_LINK_CREATED) {
      consultLinkCreatedCount += 1;
      continue;
    }
    if (subtype === OPS_SUBTYPE_CONSULT_LINK_DISABLED) {
      consultLinkDisabledCount += 1;
      continue;
    }
    if (subtype === ASSET_UPLOADED_ENQUEUED_SUBTYPE) {
      finalizeEnqueueSucceededCount += 1;
      continue;
    }
    if (subtype === OPS_SUBTYPE_FINALIZE_ENQUEUE_FAILED) {
      finalizeEnqueueFailedCount += 1;
    }
  }

  const durationMs = Math.max(1, end.getTime() - start.getTime());
  const hours = durationMs / (60 * 60 * 1000);
  const days = durationMs / (24 * 60 * 60 * 1000);
  const ocrTotal = ocrSucceededCount + ocrFailedCount;
  const finalizeEnqueueTotal = finalizeEnqueueSucceededCount + finalizeEnqueueFailedCount;

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    hours: roundMetric(hours),
    days: roundMetric(days),
    freeLimitReached: {
      count: freeLimitReachedCount,
      perHour: roundMetric(freeLimitReachedCount / hours),
      perDay: roundMetric(freeLimitReachedCount / days)
    },
    freeOcrDisabled: {
      count: freeOcrDisabledCount,
      perHour: roundMetric(freeOcrDisabledCount / hours),
      perDay: roundMetric(freeOcrDisabledCount / days)
    },
    plusRequired: {
      count: plusRequiredCount,
      perHour: roundMetric(plusRequiredCount / hours),
      perDay: roundMetric(plusRequiredCount / days)
    },
    ocrRuns: {
      succeeded: ocrSucceededCount,
      failed: ocrFailedCount,
      total: ocrTotal,
      failureRatePct: ocrTotal > 0 ? roundMetric((ocrFailedCount / ocrTotal) * 100) : 0,
      pageUnitsTotal: ocrPageUnitsTotal,
      successPerHour: roundMetric(ocrSucceededCount / hours),
      failurePerHour: roundMetric(ocrFailedCount / hours)
    },
    consultLinks: {
      created: consultLinkCreatedCount,
      disabled: consultLinkDisabledCount,
      createdPerDay: roundMetric(consultLinkCreatedCount / days),
      disabledPerDay: roundMetric(consultLinkDisabledCount / days)
    },
    finalizeEnqueue: {
      succeeded: finalizeEnqueueSucceededCount,
      failed: finalizeEnqueueFailedCount,
      total: finalizeEnqueueTotal,
      failureRatePct:
        finalizeEnqueueTotal > 0
          ? roundMetric((finalizeEnqueueFailedCount / finalizeEnqueueTotal) * 100)
          : 0,
      successPerHour: roundMetric(finalizeEnqueueSucceededCount / hours),
      failurePerHour: roundMetric(finalizeEnqueueFailedCount / hours)
    }
  };
}

function sendFreeOcrDisabled(reply: FastifyReply, requestId: string): void {
  reply.status(403).send({
    error: "FREE_OCR_DISABLED",
    code: "FREE_OCR_DISABLED",
    requestId
  });
}

function sendFreeLimitReached(
  reply: FastifyReply,
  requestId: string,
  params: { limit: number; used: number; resetAt: string }
): void {
  reply.status(403).send({
    error: "FREE_LIMIT_REACHED",
    code: "FREE_LIMIT_REACHED",
    requestId,
    limit: params.limit,
    used: params.used,
    remaining: Math.max(0, params.limit - params.used),
    resetAt: params.resetAt
  });
}

function sendFreeDailyUploadLimitReached(
  reply: FastifyReply,
  requestId: string,
  params: { limit: number; used: number; resetAt: string }
): void {
  reply.status(403).send({
    error: "FREE_DAILY_UPLOAD_LIMIT_REACHED",
    code: "FREE_DAILY_UPLOAD_LIMIT_REACHED",
    requestId,
    limit: params.limit,
    used: params.used,
    remaining: Math.max(0, params.limit - params.used),
    resetAt: params.resetAt
  });
}

type QueueConfigStatus =
  | { configured: true; region: string; queueUrl: string }
  | { configured: false; missing: string[] };

let cachedSqsClient: SQSClient | null = null;
let cachedSqsRegion = "";

function getQueueConfigStatus(): QueueConfigStatus {
  const region = process.env.AWS_REGION?.trim();
  const queueUrl = process.env.SQS_QUEUE_URL?.trim();
  const missing: string[] = [];

  if (!region) missing.push("AWS_REGION");
  if (!queueUrl) missing.push("SQS_QUEUE_URL");

  if (!region || !queueUrl || missing.length > 0) {
    return { configured: false, missing };
  }

  return { configured: true, region, queueUrl };
}

function getSqsClient(region: string): SQSClient {
  if (cachedSqsClient && cachedSqsRegion === region) {
    return cachedSqsClient;
  }

  cachedSqsClient = new SQSClient({ region });
  cachedSqsRegion = region;
  return cachedSqsClient;
}

function extractCaseContextFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  if (record.subtype !== "case_context_set") {
    return null;
  }
  return typeof record.description === "string" && record.description.trim()
    ? record.description.trim()
    : null;
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

async function loadCaseReadinessSnapshot(caseId: string): Promise<{
  score: number;
  components: Record<string, boolean>;
}> {
  const [caseState, counts, logs] = await Promise.all([
    prisma.case.findUnique({
      where: { id: caseId },
      select: {
        documentType: true,
        earliestDeadline: true,
        plainEnglishExplanation: true,
        classificationConfidence: true
      }
    }),
    prisma.case.findUnique({
      where: { id: caseId },
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
        caseId,
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

  const latestContext = logs
    .map((row) => extractCaseContextFromPayload(row.payload))
    .find((value) => Boolean(value));

  const score = computeCaseReadinessScore({
    hasDocumentType: Boolean(caseState?.documentType),
    hasDeadlineSignal: Boolean(caseState?.earliestDeadline),
    hasSummary: Boolean(caseState?.plainEnglishExplanation),
    hasContext: Boolean(latestContext),
    assetCount: counts?._count.assets ?? 0,
    extractionCount: counts?._count.extractions ?? 0,
    verdictCount: counts?._count.verdicts ?? 0,
    classificationConfidence: caseState?.classificationConfidence ?? null
  });

  return score;
}

async function writeCaseReadinessSnapshotAudit(input: {
  caseId: string;
  actorType: "api" | "worker";
  requestId?: string;
  actorId?: string | null;
  subtype: string;
}): Promise<void> {
  const readiness = await loadCaseReadinessSnapshot(input.caseId);
  await prisma.auditLog.create({
    data: {
      caseId: input.caseId,
      eventType: AuditEventType.CASE_UPDATED,
      actorType: input.actorType,
      actorId: input.actorId ?? undefined,
      requestId: input.requestId,
      payload: {
        subtype: "case_readiness_snapshot",
        source: input.subtype,
        score: readiness.score,
        components: readiness.components
      } as Prisma.InputJsonValue
    }
  });
}

type ConsultPacketLinkState = {
  id: string;
  token: string;
  tokenPreview: string;
  createdAt: string;
  expiresAt: string;
  disabledAt: string | null;
};

function parseConsultPacketLinks(auditRows: Array<{ payload: unknown; createdAt: Date }>): ConsultPacketLinkState[] {
  const byToken = new Map<string, ConsultPacketLinkState>();

  for (const row of auditRows) {
    if (!row.payload || typeof row.payload !== "object" || Array.isArray(row.payload)) {
      continue;
    }
    const payload = row.payload as Record<string, unknown>;
    const subtype = typeof payload.subtype === "string" ? payload.subtype : "";
    const tokenRaw = typeof payload.token === "string" ? payload.token : "";
    const token = normalizeConsultPacketToken(tokenRaw);
    if (!token) continue;
    if (!CONSULT_PACKET_TOKEN_REGEX.test(token)) continue;

    if (subtype === "consult_packet_link_created") {
      const expiresAtRaw = typeof payload.expiresAt === "string" ? payload.expiresAt : null;
      if (!expiresAtRaw) continue;
      byToken.set(token, {
        id: buildConsultPacketLinkId(token),
        token,
        tokenPreview: buildConsultPacketTokenPreview(token),
        createdAt: row.createdAt.toISOString(),
        expiresAt: expiresAtRaw,
        disabledAt: null
      });
      continue;
    }

    if (subtype === "consult_packet_link_disabled") {
      const existing = byToken.get(token);
      if (existing) {
        existing.disabledAt = row.createdAt.toISOString();
      }
    }
  }

  return Array.from(byToken.values()).sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
}

function consultPacketStatus(link: ConsultPacketLinkState): "active" | "expired" | "disabled" {
  const now = Date.now();
  const expiresAtMs = new Date(link.expiresAt).getTime();
  const expired = Number.isFinite(expiresAtMs) ? expiresAtMs < now : true;
  if (link.disabledAt) return "disabled";
  if (expired) return "expired";
  return "active";
}

function assetSourceFromMimeType(mimeType: string): "camera" | "file" {
  return mimeType.toLowerCase().includes("image/") ? "camera" : "file";
}

function normalizeProcessingStatus(value: unknown): "pending" | "succeeded" | "failed" {
  if (value === "SUCCEEDED" || value === "succeeded") return "succeeded";
  if (value === "FAILED" || value === "failed") return "failed";
  return "pending";
}

type PlainMeaningRow = {
  id: string;
  originalText: string;
  plainMeaning: string;
  whyThisOftenMatters: string;
  commonlyPreparedItems: string[];
  receipts: Array<{
    assetId: string;
    fileName: string;
    pageHint: string | null;
    snippet: string;
    confidence: "high" | "medium" | "low";
  }>;
  uncertainty: string;
};

function splitIntoTextSnippets(rawText: string): string[] {
  const normalized = rawText
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 18);
  if (normalized.length > 0) {
    return normalized.slice(0, 8);
  }
  return rawText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 18)
    .slice(0, 8);
}

function confidenceBucket(value: number | null): "high" | "medium" | "low" {
  if (value === null) return "low";
  if (value >= 0.85) return "high";
  if (value >= 0.6) return "medium";
  return "low";
}

function buildPlainMeaningRows(input: {
  language: NotificationLanguage;
  extractionRows: Array<{
    id: string;
    assetId: string;
    rawText: string;
    confidence: number | null;
    fileName: string;
  }>;
}): PlainMeaningRow[] {
  const rows: PlainMeaningRow[] = [];
  for (const extraction of input.extractionRows) {
    const snippets = splitIntoTextSnippets(extraction.rawText);
    for (const snippet of snippets.slice(0, 3)) {
      const rowId = `pm_${rows.length + 1}_${extraction.id}`;
      if (input.language === "es") {
        rows.push({
          id: rowId,
          originalText: snippet,
          plainMeaning:
            "Este texto suele indicar una parte del proceso del caso. Puede ayudar leerlo con calma y ubicar fechas, nombres y acciones mencionadas.",
          whyThisOftenMatters:
            "Muchas personas usan esta seccion para preparar preguntas de consulta y reducir tiempo de explicaciones repetidas.",
          commonlyPreparedItems: [
            "Cronologia corta de hechos y fechas",
            "Copia de paginas relacionadas",
            "Lista breve de preguntas para consulta"
          ],
          receipts: [
            {
              assetId: extraction.assetId,
              fileName: extraction.fileName,
              pageHint: null,
              snippet: snippet.slice(0, 220),
              confidence: confidenceBucket(extraction.confidence)
            }
          ],
          uncertainty:
            "Interpretacion informativa basada en texto extraido. Puede faltar contexto fuera del documento."
        });
      } else {
        rows.push({
          id: rowId,
          originalText: snippet,
          plainMeaning:
            "This line often describes one part of the case process. It can help to read it calmly and identify dates, names, and actions mentioned.",
          whyThisOftenMatters:
            "Many people use this section to prepare consultation questions and reduce repeat explanation time.",
          commonlyPreparedItems: [
            "Short timeline of events and dates",
            "Copy of related document pages",
            "Brief list of consultation questions"
          ],
          receipts: [
            {
              assetId: extraction.assetId,
              fileName: extraction.fileName,
              pageHint: null,
              snippet: snippet.slice(0, 220),
              confidence: confidenceBucket(extraction.confidence)
            }
          ],
          uncertainty:
            "Informational interpretation from extracted text only. Context outside the document may be missing."
        });
      }
    }
  }
  return rows.slice(0, 10);
}

async function getOrCreateUser(auth: AuthContext): Promise<User> {
  const subject = auth.subject;
  const email = auth.email ?? fallbackEmail(subject);
  let resolvedUser: User | null = null;
  const existing = await prisma.user.findUnique({
    where: { authProviderUserId: subject }
  });

  if (existing) {
    if (existing.email !== email) {
      try {
        resolvedUser = await prisma.user.update({
          where: { id: existing.id },
          data: { email }
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          resolvedUser = existing;
        } else {
          throw error;
        }
      }
    } else {
      resolvedUser = existing;
    }
  } else {
    try {
      resolvedUser = await prisma.user.create({
        data: {
          authProviderUserId: subject,
          email
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const createdElsewhere = await prisma.user.findUnique({
          where: { authProviderUserId: subject }
        });

        if (createdElsewhere) {
          resolvedUser = createdElsewhere;
        } else {
          const existingByEmail = await prisma.user.findUnique({
            where: { email }
          });
          if (existingByEmail) {
            resolvedUser = existingByEmail;
          } else {
            throw error;
          }
        }
      } else {
        throw error;
      }
    }
  }

  if (!resolvedUser) {
    throw new Error(`Failed to resolve user for auth subject='${subject}'.`);
  }
  await ensureDefaultEntitlementForUser(resolvedUser.id);
  return resolvedUser;
}

const app = Fastify({
  logger: true,
  genReqId: () => randomUUID()
});

// --- Production middleware ---

await app.register(cors, {
  origin: process.env.CORS_ORIGIN?.split(",").map((s) => s.trim()) ?? true,
  credentials: true
});

await app.register(helmet as any, {
  contentSecurityPolicy: false
});

await app.register(rateLimit, {
  max: Number(process.env.RATE_LIMIT_MAX ?? 100),
  timeWindow: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
  keyGenerator: (request: any) => request.auth?.subject ?? request.ip
});

// --- Request logging ---

app.addHook("onResponse", (request, reply, done) => {
  request.log.info(
    {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTime: reply.elapsedTime
    },
    "request_completed"
  );
  done();
});

await authPlugin(app);

app.setErrorHandler((error, request, reply) => {
  request.log.error(
    {
      err: error,
      requestId: request.id,
      method: request.method,
      url: request.url
    },
    "Unhandled API error"
  );

  if (SENTRY_DSN) {
    Sentry.captureException(error, {
      extra: { requestId: request.id, method: request.method, url: request.url }
    });
  }

  if (reply.sent) {
    return;
  }

  reply.status(500).send({
    error: "INTERNAL_SERVER_ERROR",
    requestId: request.id
  });
});

app.setNotFoundHandler((request, reply) => {
  reply.status(404).send({
    error: "NOT_FOUND",
    requestId: request.id
  });
});

app.get("/health", async () => {
  const checks: Record<string, "ok" | "error"> = {};
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }
  const healthy = Object.values(checks).every((v) => v === "ok");
  return { ok: healthy, checks };
});

app.get("/ops/metrics/summary", async (request, reply) => {
  if (!isOpsMetricsAuthorized(request.headers as Record<string, unknown>)) {
    reply.status(403).send({
      error: "FORBIDDEN",
      requestId: request.id
    });
    return;
  }

  const now = new Date();
  const last24hStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7dStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [last24h, last7d] = await Promise.all([
    buildOpsWindowSummary(last24hStart, now),
    buildOpsWindowSummary(last7dStart, now)
  ]);

  return {
    generatedAt: now.toISOString(),
    last24h,
    last7d
  };
});

app.get("/config/paywall", async () => {
  return {
    plusPriceMonthly: plusPriceMonthlyToken(),
    paywallVariant: paywallVariantFlag(),
    showAlternatePlan: checkoutAltPlanEnabled(),
    billingEnabled: billingEnabled()
  };
});

app.post("/events/track", async (request, reply) => {
  const parsed = eventTrackSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    sendValidationError(reply, request.id, parsed.error.issues);
    return;
  }
  const user = await getOrCreateUser(request.auth);
  await trackLifecycleEvent({
    userId: user.id,
    requestId: request.id,
    event: parsed.data.event,
    source: parsed.data.source,
    locale: parsed.data.locale,
    paywallVariant: parsed.data.paywallVariant,
    properties: parsed.data.properties as Record<string, unknown> | undefined
  });
  reply.status(202).send({ tracked: true });
});

app.post("/billing/checkout", async (request, reply) => {
  const parsed = billingCheckoutSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    sendValidationError(reply, request.id, parsed.error.issues);
    return;
  }
  if (!billingEnabled()) {
    reply.status(503).send({
      error: "BILLING_DISABLED",
      requestId: request.id
    });
    return;
  }

  const user = await getOrCreateUser(request.auth);
  const provider = billingProvider();
  const successUrl =
    parsed.data.successUrl?.trim() ||
    process.env.BILLING_SUCCESS_URL?.trim() ||
    "https://app.clearcase.local/billing/success";
  const cancelUrl =
    parsed.data.cancelUrl?.trim() ||
    process.env.BILLING_CANCEL_URL?.trim() ||
    "https://app.clearcase.local/billing/cancel";

  try {
    const checkout =
      provider === BILLING_PROVIDER_STRIPE
        ? await createStripeCheckoutSession({
            user,
            plan: parsed.data.plan,
            successUrl,
            cancelUrl
          })
        : await createInternalStubCheckoutSession({
            user,
            plan: parsed.data.plan,
            successUrl,
            cancelUrl
          });

    await persistCheckoutSession({
      userId: user.id,
      provider,
      sessionId: checkout.sessionId,
      checkoutUrl: checkout.checkoutUrl,
      plan: parsed.data.plan
    });
    await logPaywallEvent({
      userId: user.id,
      requestId: request.id,
      event: "checkout_started",
      source: parsed.data.triggerSource ?? "unknown",
      locale: parsed.data.locale,
      paywallVariant: paywallVariantFlag(),
      properties: {
        provider,
        plan: parsed.data.plan
      }
    });

    reply.status(200).send({
      provider,
      sessionId: checkout.sessionId,
      checkoutUrl: checkout.checkoutUrl,
      plusPriceMonthly: plusPriceMonthlyToken(),
      paywallVariant: paywallVariantFlag()
    });
  } catch (error) {
    await logPaywallEvent({
      userId: user.id,
      requestId: request.id,
      event: "checkout_failed",
      source: parsed.data.triggerSource ?? "unknown",
      locale: parsed.data.locale,
      paywallVariant: paywallVariantFlag(),
      properties: {
        provider,
        plan: parsed.data.plan,
        error: error instanceof Error ? error.message : String(error)
      }
    });
    reply.status(502).send({
      error: "CHECKOUT_CREATE_FAILED",
      requestId: request.id
    });
  }
});

app.post("/billing/webhooks/subscription", async (request, reply) => {
  const payloadString = JSON.stringify(request.body ?? {});
  const parse = billingWebhookBodySchema.safeParse(request.body ?? {});
  if (!parse.success) {
    sendValidationError(reply, request.id, parse.error.issues);
    return;
  }

  const secret = billingWebhookSecret();
  if (secret) {
    // Check both Stripe's native header and our custom header
    const stripeSignature = getHeaderStringValue(
      (request.headers["stripe-signature"] as string | string[] | undefined) ?? undefined
    );
    const customSignature = getHeaderStringValue(
      (request.headers["x-billing-signature"] as string | string[] | undefined) ?? undefined
    );
    const signatureHeader = stripeSignature ?? customSignature;
    if (!verifyBillingSignature(signatureHeader, payloadString, secret)) {
      reply.status(401).send({
        error: "INVALID_WEBHOOK_SIGNATURE",
        requestId: request.id
      });
      return;
    }
  }

  const envelope = normalizeWebhookEnvelope(parse.data);
  const receipt = await insertBillingWebhookReceipt({
    provider: envelope.provider,
    eventId: envelope.eventId,
    eventType: envelope.eventType,
    payload: parse.data as unknown as Record<string, unknown>
  });

  if (!receipt.inserted) {
    reply.status(200).send({
      received: true,
      duplicate: true
    });
    return;
  }

  try {
    const user = await findBillingUser(envelope.user);
    if (!user) {
      await updateBillingWebhookReceiptStatus(receipt.id!, "ignored_user_not_found");
      await writeBillingWebhookAudit({
        requestId: request.id,
        eventId: envelope.eventId,
        eventType: envelope.eventType,
        status: "ignored_user_not_found",
        details: {
          providerSubscriptionId: envelope.subscription.providerSubscriptionId
        }
      });
      reply.status(202).send({
        received: true,
        processed: false,
        reason: "USER_NOT_FOUND"
      });
      return;
    }

    await ensureDefaultEntitlementForUser(user.id);

    const incomingCreatedAt = envelope.createdAt ?? new Date();
    const existingSubscription = await getBillingSubscriptionByProviderSubscriptionId(
      envelope.provider,
      envelope.subscription.providerSubscriptionId
    );
    if (
      existingSubscription?.lastEventCreatedAt &&
      incomingCreatedAt.getTime() < existingSubscription.lastEventCreatedAt.getTime()
    ) {
      await updateBillingWebhookReceiptStatus(receipt.id!, "ignored_out_of_order");
      await writeBillingWebhookAudit({
        userId: user.id,
        requestId: request.id,
        eventId: envelope.eventId,
        eventType: envelope.eventType,
        status: "ignored_out_of_order"
      });
      reply.status(200).send({
        received: true,
        processed: false,
        reason: "OUT_OF_ORDER_EVENT"
      });
      return;
    }

    const subscription = await upsertBillingSubscription({
      userId: user.id,
      envelope,
      eventCreatedAt: incomingCreatedAt
    });

    const transition = await applyBillingDrivenEntitlement({
      user,
      envelope,
      eventCreatedAt: incomingCreatedAt,
      requestId: request.id
    });

    if (transition.effective.isPlus) {
      await logPaywallEvent({
        userId: user.id,
        requestId: request.id,
        event: "checkout_succeeded",
        source: "billing_webhook",
        paywallVariant: paywallVariantFlag(),
        properties: {
          provider: subscription.provider,
          providerSubscriptionId: subscription.providerSubscriptionId
        }
      });
    }

    await updateBillingWebhookReceiptStatus(receipt.id!, "processed", {
      transition: transition.transition
    });
    reply.status(200).send({
      received: true,
      processed: true,
      transition: transition.transition,
      entitlement: entitlementResponse(transition.effective)
    });
  } catch (error) {
    await updateBillingWebhookReceiptStatus(receipt.id!, "failed", {
      error: error instanceof Error ? error.message : String(error)
    });
    request.log.error(
      {
        err: error,
        requestId: request.id,
        billingEventId: envelope.eventId
      },
      "Failed to process billing webhook"
    );
    reply.status(500).send({
      error: "BILLING_WEBHOOK_PROCESSING_FAILED",
      requestId: request.id
    });
  }
});

app.get("/ops/billing/reconciliation", async (request, reply) => {
  if (!isOpsAdminAuthorized(request.headers as Record<string, unknown>)) {
    reply.status(403).send({
      error: "FORBIDDEN",
      requestId: request.id
    });
    return;
  }

  const limitRaw = Number((request.query as { limit?: string | number } | undefined)?.limit ?? 100);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.floor(limitRaw))) : 100;

  await ensureBillingStorage();
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      userId: string;
      provider: string;
      providerCustomerId: string | null;
      providerSubscriptionId: string;
      status: string;
      currentPeriodStart: Date | null;
      currentPeriodEnd: Date | null;
      cancelAtPeriodEnd: boolean;
      graceUntil: Date | null;
      lastEventId: string | null;
      lastEventCreatedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    }>
  >(Prisma.sql`
    SELECT
      bs."id" AS "id",
      bs."userId" AS "userId",
      bs."provider" AS "provider",
      bs."providerCustomerId" AS "providerCustomerId",
      bs."providerSubscriptionId" AS "providerSubscriptionId",
      bs."status" AS "status",
      bs."currentPeriodStart" AS "currentPeriodStart",
      bs."currentPeriodEnd" AS "currentPeriodEnd",
      bs."cancelAtPeriodEnd" AS "cancelAtPeriodEnd",
      bs."graceUntil" AS "graceUntil",
      bs."lastEventId" AS "lastEventId",
      bs."lastEventCreatedAt" AS "lastEventCreatedAt",
      bs."createdAt" AS "createdAt",
      bs."updatedAt" AS "updatedAt"
    FROM "BillingSubscription" bs
    ORDER BY bs."updatedAt" DESC
    LIMIT ${limit}
  `);

  const now = new Date();
  const items: Array<Record<string, unknown>> = [];
  let mismatches = 0;

  for (const raw of rows) {
    const row = toBillingSubscriptionRow(raw as unknown as Record<string, unknown>);
    if (!row) continue;
    const user = await prisma.user.findUnique({ where: { id: row.userId } });
    if (!user) continue;
    const entitlement = await resolveEffectiveEntitlement(user);
    const expectedPlus = billingStatusShouldHavePlus(row.status, row, now);
    const driftFlags: string[] = [];
    if (expectedPlus && !entitlement.isPlus) driftFlags.push("expected_plus_missing");
    if (!expectedPlus && entitlement.isPlus) driftFlags.push("unexpected_plus_active");
    if (driftFlags.length > 0) mismatches += 1;
    items.push({
      userId: row.userId,
      email: user.email,
      provider: row.provider,
      providerSubscriptionId: row.providerSubscriptionId,
      billingStatus: row.status,
      currentPeriodEnd: row.currentPeriodEnd?.toISOString() ?? null,
      graceUntil: row.graceUntil?.toISOString() ?? null,
      expectedPlus,
      entitlement: entitlementResponse(entitlement),
      driftFlags
    });
  }

  await prisma.auditLog.create({
    data: {
      eventType: AuditEventType.CASE_UPDATED,
      actorType: "api",
      requestId: request.id,
      payload: {
        subtype: BILLING_RECONCILIATION_SUBTYPE,
        checked: items.length,
        mismatches
      } as Prisma.InputJsonValue
    }
  });

  reply.status(200).send({
    generatedAt: now.toISOString(),
    checked: items.length,
    mismatches,
    items
  });
});

app.get("/ops/growth/weekly-kpis", async (request, reply) => {
  if (!isOpsMetricsAuthorized(request.headers as Record<string, unknown>)) {
    reply.status(403).send({
      error: "FORBIDDEN",
      requestId: request.id
    });
    return;
  }

  const now = new Date();
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const cohortStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const cohortEnd = weekStart;

  const [paywallEvents, reminders, consultLinks, totalUsers, reminderEnabledUsers, cohortUsers, paidEntitlements] =
    await Promise.all([
      prisma.auditLog.findMany({
        where: {
          eventType: AuditEventType.CASE_UPDATED,
          createdAt: {
            gte: weekStart,
            lt: now
          }
        },
        select: {
          payload: true
        }
      }),
      prisma.$queryRaw<Array<{ value: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS "value"
        FROM "UserNotificationPreference"
        WHERE "enabled" = true
      `),
      prisma.auditLog.findMany({
        where: {
          eventType: AuditEventType.CASE_UPDATED,
          createdAt: {
            gte: weekStart,
            lt: now
          },
          payload: {
            path: ["subtype"],
            equals: OPS_SUBTYPE_CONSULT_LINK_CREATED
          }
        },
        select: {
          caseId: true
        }
      }),
      prisma.user.count(),
      prisma.$queryRaw<Array<{ value: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS "value"
        FROM "UserNotificationPreference"
        WHERE "enabled" = true
      `),
      prisma.user.findMany({
        where: {
          createdAt: {
            gte: cohortStart,
            lt: cohortEnd
          }
        },
        select: {
          id: true,
          createdAt: true
        }
      }),
      prisma.auditLog.findMany({
        where: {
          eventType: AuditEventType.CASE_UPDATED,
          createdAt: {
            gte: weekStart,
            lt: now
          },
          payload: {
            path: ["subtype"],
            equals: ENTITLEMENT_CHANGE_SUBTYPE
          }
        },
        select: {
          payload: true
        }
      })
    ]);

  const funnel = {
    paywallViewed: 0,
    checkoutStarted: 0,
    checkoutSucceeded: 0
  };
  let freeLimitReached = 0;
  let uploadStarted = 0;
  let uploadCompleted = 0;
  for (const log of paywallEvents) {
    const payload = asObject(log.payload);
    const subtype = extractCaseUpdatedSubtype(log.payload);
    if (subtype === OPS_SUBTYPE_FREE_LIMIT_REACHED) {
      freeLimitReached += 1;
    }
    if (subtype === "upload_started") uploadStarted += 1;
    if (subtype === "upload_completed") uploadCompleted += 1;
    if (!payload || payload.subtype !== PAYWALL_EVENT_SUBTYPE) continue;
    const event = typeof payload.event === "string" ? payload.event : "";
    if (event === "paywall_viewed") funnel.paywallViewed += 1;
    if (event === "checkout_started") funnel.checkoutStarted += 1;
    if (event === "checkout_succeeded") funnel.checkoutSucceeded += 1;
  }

  let paidTransitionCount = 0;
  for (const log of paidEntitlements) {
    const payload = asObject(log.payload);
    if (!payload || payload.subtype !== ENTITLEMENT_CHANGE_SUBTYPE) continue;
    const next = asObject(payload.next);
    const plan = next && typeof next.plan === "string" ? next.plan : null;
    const source = next && typeof next.source === "string" ? next.source : null;
    if (plan === "plus" && source === "billing") {
      paidTransitionCount += 1;
    }
  }

  let retained = 0;
  for (const user of cohortUsers) {
    const day6 = new Date(user.createdAt.getTime() + 6 * 24 * 60 * 60 * 1000);
    const day8 = new Date(user.createdAt.getTime() + 8 * 24 * 60 * 60 * 1000);
    const hasActivity = await prisma.auditLog.findFirst({
      where: {
        createdAt: {
          gte: day6,
          lt: day8
        },
        case: {
          userId: user.id
        }
      },
      select: {
        id: true
      }
    });
    if (hasActivity) retained += 1;
  }

  const activeCaseCount = await prisma.case.count({
    where: {
      updatedAt: {
        gte: weekStart,
        lt: now
      }
    }
  });
  const uniqueSharedCases = new Set(consultLinks.map((row) => row.caseId).filter(Boolean));

  const reminderEnabledCount = Number(reminderEnabledUsers[0]?.value ?? reminders[0]?.value ?? 0);
  const remindersEnabledPct =
    totalUsers > 0 ? Math.round((reminderEnabledCount / totalUsers) * 10000) / 100 : 0;
  const trialToPaidConversionPct =
    funnel.checkoutStarted > 0
      ? Math.round((funnel.checkoutSucceeded / funnel.checkoutStarted) * 10000) / 100
      : 0;
  const day7RetentionPct =
    cohortUsers.length > 0 ? Math.round((retained / cohortUsers.length) * 10000) / 100 : 0;
  const packetShareRatePct =
    activeCaseCount > 0 ? Math.round((uniqueSharedCases.size / activeCaseCount) * 10000) / 100 : 0;

  reply.status(200).send({
    generatedAt: now.toISOString(),
    windowStart: weekStart.toISOString(),
    funnel: {
      ...funnel,
      paywallVariant: paywallVariantFlag()
    },
    events: {
      uploadStarted,
      uploadCompleted,
      freeLimitReached,
      firstDeadlineDetected: paywallEvents.filter(
        (row) => extractCaseUpdatedSubtype(row.payload) === "first_deadline_detected"
      ).length
    },
    kpis: {
      trialToPaidConversionPct,
      day7RetentionPct,
      remindersEnabledPct,
      packetShareRatePct
    },
    counts: {
      paidTransitionCount,
      cohortSize: cohortUsers.length,
      retained
    }
  });
});

app.get("/ops/entitlements", async (request, reply) => {
  if (!isOpsAdminAuthorized(request.headers as Record<string, unknown>)) {
    reply.status(403).send({
      error: "FORBIDDEN",
      requestId: request.id
    });
    return;
  }

  const queryParse = opsEntitlementLookupQuerySchema.safeParse(request.query ?? {});
  if (!queryParse.success) {
    sendValidationError(reply, request.id, queryParse.error.issues);
    return;
  }

  const foundUser = await findUserBySubjectOrEmail({
    subject: queryParse.data.subject,
    email: queryParse.data.email
  });
  if (!foundUser) {
    reply.status(404).send({
      error: "NOT_FOUND",
      requestId: request.id
    });
    return;
  }

  await ensureDefaultEntitlementForUser(foundUser.id);
  const effective = await resolveEffectiveEntitlement(foundUser);
  const includeHistory = queryParse.data.includeHistory === true;
  const historyLimit = queryParse.data.limit ?? 20;
  const history = includeHistory ? await listEntitlementHistory(foundUser.id, historyLimit) : [];

  reply.status(200).send({
    user: toPublicUser(foundUser),
    entitlement: entitlementResponse(effective),
    history: history.map((row) => persistedEntitlementResponse(row))
  });
});

app.post("/ops/entitlements/grant", async (request, reply) => {
  if (!isOpsAdminAuthorized(request.headers as Record<string, unknown>)) {
    reply.status(403).send({
      error: "FORBIDDEN",
      requestId: request.id
    });
    return;
  }

  const bodyParse = opsEntitlementGrantSchema.safeParse(request.body ?? {});
  if (!bodyParse.success) {
    sendValidationError(reply, request.id, bodyParse.error.issues);
    return;
  }

  const foundUser = await findUserBySubjectOrEmail({
    subject: bodyParse.data.subject,
    email: bodyParse.data.email
  });
  if (!foundUser) {
    reply.status(404).send({
      error: "NOT_FOUND",
      requestId: request.id
    });
    return;
  }

  await ensureDefaultEntitlementForUser(foundUser.id);

  const startAt = bodyParse.data.startAt ? new Date(bodyParse.data.startAt) : new Date();
  const endAt = bodyParse.data.endAt ? new Date(bodyParse.data.endAt) : null;
  if (Number.isNaN(startAt.getTime())) {
    sendValidationError(reply, request.id, [{ message: "startAt must be a valid datetime." }]);
    return;
  }
  if (endAt && Number.isNaN(endAt.getTime())) {
    sendValidationError(reply, request.id, [{ message: "endAt must be a valid datetime." }]);
    return;
  }
  if (endAt && endAt.getTime() <= startAt.getTime()) {
    sendValidationError(reply, request.id, [{ message: "endAt must be greater than startAt." }]);
    return;
  }

  const granted = await applyEntitlementGrant({
    userId: foundUser.id,
    plan: bodyParse.data.plan,
    status: bodyParse.data.status,
    source: bodyParse.data.source,
    startAt,
    endAt,
    requestId: request.id,
    actorId: null
  });
  const effective = await resolveEffectiveEntitlement(foundUser);

  reply.status(200).send({
    user: toPublicUser(foundUser),
    previous: granted.previous ? persistedEntitlementResponse(granted.previous) : null,
    current: persistedEntitlementResponse(granted.current),
    effective: entitlementResponse(effective)
  });
});

app.post("/ops/entitlements/revoke", async (request, reply) => {
  if (!isOpsAdminAuthorized(request.headers as Record<string, unknown>)) {
    reply.status(403).send({
      error: "FORBIDDEN",
      requestId: request.id
    });
    return;
  }

  const bodyParse = opsEntitlementRevokeSchema.safeParse(request.body ?? {});
  if (!bodyParse.success) {
    sendValidationError(reply, request.id, bodyParse.error.issues);
    return;
  }

  const foundUser = await findUserBySubjectOrEmail({
    subject: bodyParse.data.subject,
    email: bodyParse.data.email
  });
  if (!foundUser) {
    reply.status(404).send({
      error: "NOT_FOUND",
      requestId: request.id
    });
    return;
  }

  await ensureDefaultEntitlementForUser(foundUser.id);
  const revoked = await applyEntitlementRevoke({
    userId: foundUser.id,
    source: bodyParse.data.source,
    reason: bodyParse.data.reason,
    requestId: request.id,
    actorId: null
  });
  const effective = await resolveEffectiveEntitlement(foundUser);

  reply.status(200).send({
    user: toPublicUser(foundUser),
    previous: revoked.previous ? persistedEntitlementResponse(revoked.previous) : null,
    revoked: persistedEntitlementResponse(revoked.revoked),
    current: persistedEntitlementResponse(revoked.current),
    effective: entitlementResponse(effective)
  });
});

app.get("/me", async (request) => {
  const user = await getOrCreateUser(request.auth);
  const [entitlement, pushPreference, activePushDevices] = await Promise.all([
    resolveEffectiveEntitlement(user),
    getPushPreferenceForUser(user.id),
    countActivePushDevices(user.id)
  ]);

  return {
    user: toPublicUser(user),
    needsProfile: needsProfile(user),
    entitlement: entitlementResponse(entitlement),
    pushPreferences: pushPreferenceResponse(pushPreference),
    pushDevices: {
      activeCount: activePushDevices
    }
  };
});

app.get("/me/notification-preferences", async (request) => {
  const user = await getOrCreateUser(request.auth);
  const preference = await getPushPreferenceForUser(user.id);
  return {
    pushPreferences: pushPreferenceResponse(preference)
  };
});

app.patch("/me/notification-preferences", async (request, reply) => {
  const parse = pushPreferencesPatchSchema.safeParse(request.body ?? {});
  if (!parse.success) {
    sendValidationError(reply, request.id, parse.error.issues);
    return;
  }

  const user = await getOrCreateUser(request.auth);
  const nextLanguage = parse.data.language ? parseNotificationLanguage(parse.data.language) : null;
  const updated = await updatePushPreferenceForUser(user.id, {
    enabled: parse.data.enabled,
    language: nextLanguage ?? undefined,
    quietHoursStart: parse.data.quietHoursStart,
    quietHoursEnd: parse.data.quietHoursEnd
  });

  return {
    pushPreferences: pushPreferenceResponse(updated)
  };
});

app.post("/me/push-devices/register", async (request, reply) => {
  const parse = pushDeviceRegisterSchema.safeParse(request.body ?? {});
  if (!parse.success) {
    sendValidationError(reply, request.id, parse.error.issues);
    return;
  }

  const user = await getOrCreateUser(request.auth);
  const preference = await getPushPreferenceForUser(user.id);
  const language = parse.data.language ?? preference.language;
  await upsertPushDeviceRegistration({
    userId: user.id,
    deviceId: parse.data.deviceId,
    platform: parse.data.platform,
    token: parse.data.token,
    language
  });

  return {
    registered: true,
    deviceId: parse.data.deviceId,
    platform: parse.data.platform,
    language
  };
});

app.patch("/me", async (request, reply) => {
  const parsed = patchMeSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    sendValidationError(reply, request.id, parsed.error.issues);
    return;
  }

  const user = await getOrCreateUser(request.auth);
  const updateData: {
    fullName?: string;
    zipCode?: string;
    jurisdictionState?: string | null;
  } = {};

  if (parsed.data.fullName !== undefined) {
    updateData.fullName = parsed.data.fullName.trim();
  }

  if (parsed.data.zipCode !== undefined) {
    const normalizedZipCode = normalizeZipCode(parsed.data.zipCode);
    const state = stateFromZipCode(normalizedZipCode);

    if (!state) {
      sendValidationError(reply, request.id, [
        { message: "zipCode could not be mapped to a US state." }
      ]);
      return;
    }

    updateData.zipCode = normalizedZipCode;
    updateData.jurisdictionState = state;
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: updateData
  });
  const [entitlement, pushPreference, activePushDevices] = await Promise.all([
    resolveEffectiveEntitlement(updatedUser),
    getPushPreferenceForUser(updatedUser.id),
    countActivePushDevices(updatedUser.id)
  ]);

  return {
    user: toPublicUser(updatedUser),
    needsProfile: needsProfile(updatedUser),
    entitlement: entitlementResponse(entitlement),
    pushPreferences: pushPreferenceResponse(pushPreference),
    pushDevices: {
      activeCount: activePushDevices
    }
  };
});

app.post("/cases", async (request, reply) => {
  const parsed = createCaseSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    sendValidationError(reply, request.id, parsed.error.issues);
    return;
  }

  const user = await getOrCreateUser(request.auth);
  const createdCase = await prisma.case.create({
    data: {
      userId: user.id,
      title: parsed.data.title,
      jurisdictionZip: user.zipCode,
      jurisdictionState: user.jurisdictionState
    }
  });

  reply.status(201).send(createdCase);
});

app.get("/cases", async (request) => {
  const user = await getOrCreateUser(request.auth);

  const cases = await prisma.case.findMany({
    where: {
      userId: user.id
    },
    orderBy: {
      updatedAt: "desc"
    },
    include: {
      _count: {
        select: {
          assets: true,
          extractions: true,
          verdicts: true
        }
      }
    }
  });

  return {
    cases
  };
});

app.get("/cases/:id", async (request, reply) => {
  const paramsParse = caseParamsSchema.safeParse(request.params);
  if (!paramsParse.success) {
    sendValidationError(reply, request.id, paramsParse.error.issues);
    return;
  }

  const user = await getOrCreateUser(request.auth);
  const foundCase = await prisma.case.findFirst({
    where: {
      id: paramsParse.data.id,
      userId: user.id
    },
    include: {
      assets: {
        orderBy: {
          createdAt: "desc"
        }
      },
      extractions: {
        orderBy: {
          createdAt: "desc"
        }
      },
      verdicts: {
        orderBy: {
          createdAt: "desc"
        }
      },
      auditLogs: {
        orderBy: {
          createdAt: "desc"
        }
      },
      chatSessions: {
        include: {
          messages: true
        }
      }
    }
  });

  if (!foundCase) {
    reply.status(404).send({ error: "NOT_FOUND", requestId: request.id });
    return;
  }

  return foundCase;
});

app.get("/cases/:id/assets", async (request, reply) => {
  const paramsParse = caseParamsSchema.safeParse(request.params);
  if (!paramsParse.success) {
    sendValidationError(reply, request.id, paramsParse.error.issues);
    return;
  }

  const user = await getOrCreateUser(request.auth);
  const foundCase = await prisma.case.findFirst({
    where: {
      id: paramsParse.data.id,
      userId: user.id
    },
    select: {
      id: true
    }
  });

  if (!foundCase) {
    reply.status(404).send({ error: "NOT_FOUND", requestId: request.id });
    return;
  }

  const assets = await prisma.asset.findMany({
    where: {
      caseId: foundCase.id
    },
    orderBy: {
      createdAt: "desc"
    },
    include: {
      extractions: {
        orderBy: {
          createdAt: "desc"
        },
        take: 1,
        select: {
          status: true
        }
      }
    }
  });

  reply.status(200).send({
    caseId: foundCase.id,
    assets: assets.map((asset) => ({
      id: asset.id,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      byteSize: asset.byteSize,
      createdAt: asset.createdAt,
      source: assetSourceFromMimeType(asset.mimeType),
      assetType: asset.assetType,
      processingStatus: normalizeProcessingStatus(asset.extractions[0]?.status)
    }))
  });
});

app.get("/cases/:id/assets/:assetId/access", async (request, reply) => {
  const paramsParse = assetParamsSchema.safeParse(request.params);
  if (!paramsParse.success) {
    sendValidationError(reply, request.id, paramsParse.error.issues);
    return;
  }
  const queryParse = assetAccessQuerySchema.safeParse(request.query ?? {});
  if (!queryParse.success) {
    sendValidationError(reply, request.id, queryParse.error.issues);
    return;
  }

  const user = await getOrCreateUser(request.auth);
  const foundAsset = await prisma.asset.findFirst({
    where: {
      id: paramsParse.data.assetId,
      caseId: paramsParse.data.id,
      case: {
        userId: user.id
      }
    },
    select: {
      id: true,
      caseId: true,
      s3Key: true,
      fileName: true,
      mimeType: true,
      createdAt: true
    }
  });

  if (!foundAsset) {
    reply.status(404).send({ error: "NOT_FOUND", requestId: request.id });
    return;
  }

  const action = queryParse.data.action;
  try {
    const plan = await createDownloadPlan({
      s3Key: foundAsset.s3Key,
      fileName: foundAsset.fileName,
      disposition: action === "download" ? "attachment" : "inline"
    });
    await prisma.auditLog.create({
      data: {
        caseId: foundAsset.caseId,
        assetId: foundAsset.id,
        eventType: AuditEventType.CASE_UPDATED,
        actorType: "user",
        actorId: user.id,
        requestId: request.id,
        payload: {
          subtype: action === "download" ? ASSET_DOWNLOAD_REQUESTED_SUBTYPE : ASSET_VIEW_OPENED_SUBTYPE,
          action,
          mimeType: foundAsset.mimeType,
          fileName: foundAsset.fileName
        } as Prisma.InputJsonValue
      }
    });

    reply.status(200).send({
      caseId: foundAsset.caseId,
      assetId: foundAsset.id,
      action,
      accessUrl: plan.downloadUrl,
      expiresInSeconds: plan.expiresInSeconds
    });
  } catch (error) {
    request.log.error(
      {
        err: error,
        requestId: request.id,
        caseId: foundAsset.caseId,
        assetId: foundAsset.id,
        action
      },
      "Failed to create asset access URL"
    );
    reply.status(502).send({
      error: "ASSET_ACCESS_URL_GENERATION_FAILED",
      requestId: request.id
    });
  }
});

app.get("/cases/:id/plain-meaning", async (request, reply) => {
  const paramsParse = caseParamsSchema.safeParse(request.params);
  if (!paramsParse.success) {
    sendValidationError(reply, request.id, paramsParse.error.issues);
    return;
  }
  const queryParse = plainMeaningQuerySchema.safeParse(request.query ?? {});
  if (!queryParse.success) {
    sendValidationError(reply, request.id, queryParse.error.issues);
    return;
  }

  const user = await getOrCreateUser(request.auth);
  if (!(await hasPlusEntitlement(user))) {
    await writeOpsMetricAudit({
      requestId: request.id,
      actorId: user.id,
      subtype: OPS_SUBTYPE_PLUS_REQUIRED,
      details: {
        route: "plain_meaning",
        requestedCaseId: paramsParse.data.id
      }
    });
    sendPlusRequired(reply, request.id);
    return;
  }

  const foundCase = await prisma.case.findFirst({
    where: {
      id: paramsParse.data.id,
      userId: user.id
    },
    select: {
      id: true,
      classificationConfidence: true
    }
  });
  if (!foundCase) {
    reply.status(404).send({ error: "NOT_FOUND", requestId: request.id });
    return;
  }

  const extractions = await prisma.extraction.findMany({
    where: {
      caseId: foundCase.id,
      status: "SUCCEEDED"
    },
    orderBy: {
      createdAt: "desc"
    },
    include: {
      asset: {
        select: {
          id: true,
          fileName: true
        }
      }
    },
    take: 10
  });

  const rows = buildPlainMeaningRows({
    language: queryParse.data.language,
    extractionRows: extractions.map((row) => ({
      id: row.id,
      assetId: row.assetId,
      rawText: row.rawText,
      confidence: foundCase.classificationConfidence,
      fileName: row.asset.fileName
    }))
  });

  reply.status(200).send({
    caseId: foundCase.id,
    language: queryParse.data.language,
    rows,
    boundary:
      queryParse.data.language === "es"
        ? "Interpretacion informativa para preparacion de consulta. No es asesoria legal."
        : "Informational interpretation for consultation preparation. Not legal advice."
  });
});

app.get("/cases/:id/consult-packet-links", async (request, reply) => {
  const paramsParse = caseParamsSchema.safeParse(request.params);
  if (!paramsParse.success) {
    sendValidationError(reply, request.id, paramsParse.error.issues);
    return;
  }

  const user = await getOrCreateUser(request.auth);
  if (!(await hasPlusEntitlement(user))) {
    await writeOpsMetricAudit({
      requestId: request.id,
      actorId: user.id,
      subtype: OPS_SUBTYPE_PLUS_REQUIRED,
      details: {
        route: "consult_packet_links_list",
        requestedCaseId: paramsParse.data.id
      }
    });
    sendPlusRequired(reply, request.id);
    return;
  }
  const foundCase = await prisma.case.findFirst({
    where: {
      id: paramsParse.data.id,
      userId: user.id
    },
    select: {
      id: true
    }
  });

  if (!foundCase) {
    reply.status(404).send({ error: "NOT_FOUND", requestId: request.id });
    return;
  }

  const auditRows = await prisma.auditLog.findMany({
    where: {
      caseId: foundCase.id,
      eventType: AuditEventType.CASE_UPDATED
    },
    orderBy: {
      createdAt: "asc"
    },
    select: {
      payload: true,
      createdAt: true
    }
  });

  const links = parseConsultPacketLinks(auditRows).map((link) => {
    const status = consultPacketStatus(link);
    return {
      id: link.id,
      tokenPreview: link.tokenPreview,
      createdAt: link.createdAt,
      expiresAt: link.expiresAt,
      disabledAt: link.disabledAt,
      status,
      statusReason: status
    };
  });

  reply.status(200).send({
    caseId: foundCase.id,
    links
  });
});

app.post("/cases/:id/consult-packet-links", async (request, reply) => {
  const paramsParse = caseParamsSchema.safeParse(request.params);
  if (!paramsParse.success) {
    sendValidationError(reply, request.id, paramsParse.error.issues);
    return;
  }
  const bodyParse = consultPacketLinkCreateSchema.safeParse(request.body ?? {});
  if (!bodyParse.success) {
    sendValidationError(reply, request.id, bodyParse.error.issues);
    return;
  }

  const user = await getOrCreateUser(request.auth);
  if (!(await hasPlusEntitlement(user))) {
    await writeOpsMetricAudit({
      requestId: request.id,
      actorId: user.id,
      subtype: OPS_SUBTYPE_PLUS_REQUIRED,
      details: {
        route: "consult_packet_links_create",
        requestedCaseId: paramsParse.data.id
      }
    });
    sendPlusRequired(reply, request.id);
    return;
  }
  const foundCase = await prisma.case.findFirst({
    where: {
      id: paramsParse.data.id,
      userId: user.id
    },
    select: {
      id: true
    }
  });

  if (!foundCase) {
    reply.status(404).send({ error: "NOT_FOUND", requestId: request.id });
    return;
  }

  const expiresInDays = bodyParse.data.expiresInDays ?? 7;
  const token = normalizeConsultPacketToken(randomUUID().replace(/-/g, ""));
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + expiresInDays * 24 * 60 * 60 * 1000);
  const shareUrl = `https://share.clearcase.local/consult-packet/${token}`;
  const status = "active" as const;

  await prisma.auditLog.create({
    data: {
      caseId: foundCase.id,
      eventType: AuditEventType.CASE_UPDATED,
      actorType: "user",
      actorId: user.id,
      requestId: request.id,
      payload: {
        subtype: OPS_SUBTYPE_CONSULT_LINK_CREATED,
        token,
        expiresAt: expiresAt.toISOString(),
        expiresInDays,
        shareUrl
      } as Prisma.InputJsonValue
    }
  });

  reply.status(201).send({
    caseId: foundCase.id,
    id: buildConsultPacketLinkId(token),
    tokenPreview: buildConsultPacketTokenPreview(token),
    shareUrl,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    status,
    statusReason: status
  });
});

app.post("/cases/:id/consult-packet-links/:token/disable", async (request, reply) => {
  const paramsParse = consultPacketLinkParamsSchema.safeParse(request.params);
  if (!paramsParse.success) {
    sendValidationError(reply, request.id, paramsParse.error.issues);
    return;
  }

  const user = await getOrCreateUser(request.auth);
  if (!(await hasPlusEntitlement(user))) {
    await writeOpsMetricAudit({
      requestId: request.id,
      actorId: user.id,
      subtype: OPS_SUBTYPE_PLUS_REQUIRED,
      details: {
        route: "consult_packet_links_disable",
        requestedCaseId: paramsParse.data.id
      }
    });
    sendPlusRequired(reply, request.id);
    return;
  }
  const foundCase = await prisma.case.findFirst({
    where: {
      id: paramsParse.data.id,
      userId: user.id
    },
    select: {
      id: true
    }
  });

  if (!foundCase) {
    reply.status(404).send({ error: "NOT_FOUND", requestId: request.id });
    return;
  }

  const tokenOrId = normalizeConsultPacketToken(paramsParse.data.token);
  const isToken = CONSULT_PACKET_TOKEN_REGEX.test(tokenOrId);
  const isLinkId = CONSULT_PACKET_LINK_ID_REGEX.test(tokenOrId);
  if (!isToken && !isLinkId) {
    sendValidationError(reply, request.id, [
      {
        path: ["token"],
        message: "Expected a valid link token or link id."
      }
    ]);
    return;
  }
  const auditRows = await prisma.auditLog.findMany({
    where: {
      caseId: foundCase.id,
      eventType: AuditEventType.CASE_UPDATED
    },
    orderBy: {
      createdAt: "asc"
    },
    select: {
      payload: true,
      createdAt: true
    }
  });
  const links = parseConsultPacketLinks(auditRows);
  const foundLink = isToken
    ? links.find((row) => row.token === tokenOrId)
    : links.find((row) => row.id === tokenOrId);
  if (!foundLink) {
    reply.status(404).send({ error: "NOT_FOUND", requestId: request.id });
    return;
  }

  const alreadyDisabled = Boolean(foundLink.disabledAt);
  await prisma.auditLog.create({
    data: {
      caseId: foundCase.id,
      eventType: AuditEventType.CASE_UPDATED,
      actorType: "user",
      actorId: user.id,
      requestId: request.id,
      payload: {
        subtype: "consult_packet_link_disable_requested",
        linkId: foundLink.id,
        tokenPreview: foundLink.tokenPreview,
        outcome: alreadyDisabled ? "already_disabled" : "disabled"
      } as Prisma.InputJsonValue
    }
  });

  if (!alreadyDisabled) {
    await prisma.auditLog.create({
      data: {
        caseId: foundCase.id,
        eventType: AuditEventType.CASE_UPDATED,
        actorType: "user",
        actorId: user.id,
        requestId: request.id,
        payload: {
          subtype: OPS_SUBTYPE_CONSULT_LINK_DISABLED,
          token: foundLink.token
        } as Prisma.InputJsonValue
      }
    });
  }

  const status = "disabled" as const;
  reply.status(200).send({
    caseId: foundCase.id,
    id: foundLink.id,
    disabled: true,
    status,
    statusReason: status
  });
});

app.post("/cases/:id/watch-mode", async (request, reply) => {
  const paramsParse = caseParamsSchema.safeParse(request.params);
  if (!paramsParse.success) {
    sendValidationError(reply, request.id, paramsParse.error.issues);
    return;
  }
  const bodyParse = caseWatchModeSchema.safeParse(request.body ?? {});
  if (!bodyParse.success) {
    sendValidationError(reply, request.id, bodyParse.error.issues);
    return;
  }

  const user = await getOrCreateUser(request.auth);
  if (!(await hasPlusEntitlement(user))) {
    await writeOpsMetricAudit({
      requestId: request.id,
      actorId: user.id,
      subtype: OPS_SUBTYPE_PLUS_REQUIRED,
      details: {
        route: "watch_mode_set",
        requestedCaseId: paramsParse.data.id
      }
    });
    sendPlusRequired(reply, request.id);
    return;
  }
  const foundCase = await prisma.case.findFirst({
    where: {
      id: paramsParse.data.id,
      userId: user.id
    },
    select: {
      id: true
    }
  });

  if (!foundCase) {
    reply.status(404).send({ error: "NOT_FOUND", requestId: request.id });
    return;
  }

  await prisma.auditLog.create({
    data: {
      caseId: foundCase.id,
      eventType: AuditEventType.CASE_UPDATED,
      actorType: "user",
      actorId: user.id,
      requestId: request.id,
      payload: {
        subtype: "case_watch_mode_set",
        enabled: bodyParse.data.enabled
      } as Prisma.InputJsonValue
    }
  });
  await syncCaseDeadlineReminders({
    caseId: foundCase.id,
    requestId: request.id,
    actorType: "api",
    actorId: user.id
  });

  reply.status(200).send({
    saved: true,
    caseId: foundCase.id,
    enabled: bodyParse.data.enabled
  });
});

app.post("/cases/:id/context", async (request, reply) => {
  const paramsParse = caseParamsSchema.safeParse(request.params);
  if (!paramsParse.success) {
    sendValidationError(reply, request.id, paramsParse.error.issues);
    return;
  }
  const bodyParse = caseContextSchema.safeParse(request.body ?? {});
  if (!bodyParse.success) {
    sendValidationError(reply, request.id, bodyParse.error.issues);
    return;
  }

  const user = await getOrCreateUser(request.auth);
  const foundCase = await prisma.case.findFirst({
    where: {
      id: paramsParse.data.id,
      userId: user.id
    },
    select: {
      id: true
    }
  });

  if (!foundCase) {
    reply.status(404).send({ error: "NOT_FOUND", requestId: request.id });
    return;
  }

  const description = bodyParse.data.description.trim();
  await prisma.auditLog.create({
    data: {
      caseId: foundCase.id,
      eventType: AuditEventType.CASE_UPDATED,
      actorType: "user",
      actorId: user.id,
      requestId: request.id,
      payload: {
        subtype: "case_context_set",
        description
      } as Prisma.InputJsonValue
    }
  });
  await writeCaseReadinessSnapshotAudit({
    caseId: foundCase.id,
    actorType: "api",
    actorId: user.id,
    requestId: request.id,
    subtype: "case_context_set"
  });

  reply.status(200).send({
    saved: true,
    caseId: foundCase.id,
    description
  });
});

app.post("/cases/:id/classification", async (request, reply) => {
  const paramsParse = caseParamsSchema.safeParse(request.params);
  if (!paramsParse.success) {
    sendValidationError(reply, request.id, paramsParse.error.issues);
    return;
  }
  const bodyParse = caseClassificationSchema.safeParse(request.body ?? {});
  if (!bodyParse.success) {
    sendValidationError(reply, request.id, bodyParse.error.issues);
    return;
  }

  const user = await getOrCreateUser(request.auth);
  const foundCase = await prisma.case.findFirst({
    where: {
      id: paramsParse.data.id,
      userId: user.id
    },
    select: {
      id: true
    }
  });

  if (!foundCase) {
    reply.status(404).send({ error: "NOT_FOUND", requestId: request.id });
    return;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const nextCase = await tx.case.update({
      where: { id: foundCase.id },
      data: {
        documentType: bodyParse.data.documentType,
        classificationConfidence: 1
      }
    });

    await tx.auditLog.create({
      data: {
        caseId: foundCase.id,
        eventType: AuditEventType.CASE_UPDATED,
        actorType: "user",
        actorId: user.id,
        requestId: request.id,
        payload: {
          subtype: "manual_document_type_set",
          documentType: bodyParse.data.documentType
        } as Prisma.InputJsonValue
      }
    });

    return nextCase;
  });

  await writeCaseReadinessSnapshotAudit({
    caseId: foundCase.id,
    actorType: "api",
    actorId: user.id,
    requestId: request.id,
    subtype: "manual_document_type_set"
  });

  reply.status(200).send({
    saved: true,
    case: updated
  });
});

app.post("/cases/:id/assets", async (request, reply) => {
  const paramsParse = caseParamsSchema.safeParse(request.params);
  if (!paramsParse.success) {
    sendValidationError(reply, request.id, paramsParse.error.issues);
    return;
  }

  const bodyParse = createAssetSchema.safeParse(request.body ?? {});
  if (!bodyParse.success) {
    sendValidationError(reply, request.id, bodyParse.error.issues);
    return;
  }

  const user = await getOrCreateUser(request.auth);
  const foundCase = await prisma.case.findFirst({
    where: {
      id: paramsParse.data.id,
      userId: user.id
    },
    select: {
      id: true
    }
  });

  if (!foundCase) {
    reply.status(404).send({ error: "NOT_FOUND", requestId: request.id });
    return;
  }

  const uploadConfigStatus = getUploadConfigStatus();
  if (!uploadConfigStatus.configured) {
    reply.status(503).send({
      error: "AWS_UPLOADS_NOT_CONFIGURED",
      requestId: request.id,
      missing: uploadConfigStatus.missing
    });
    return;
  }

  const requestBody = bodyParse.data;
  let uploadPlan: Awaited<ReturnType<typeof createUploadPlan>>;

  try {
    uploadPlan = await createUploadPlan({
      caseId: foundCase.id,
      fileName: requestBody.fileName,
      mimeType: requestBody.mimeType
    });
  } catch (error) {
    request.log.error(
      {
        err: error,
        requestId: request.id,
        caseId: foundCase.id,
        uploaderUserId: user.id
      },
      "Failed to create presigned upload URL"
    );
    reply.status(502).send({ error: "UPLOAD_URL_GENERATION_FAILED", requestId: request.id });
    return;
  }

  const createdAsset = await prisma.asset.create({
    data: {
      caseId: foundCase.id,
      uploaderUserId: user.id,
      assetType: requestBody.assetType ?? AssetType.DOCUMENT_IMAGE,
      s3Key: uploadPlan.s3Key,
      fileName: requestBody.fileName,
      mimeType: requestBody.mimeType,
      byteSize: requestBody.byteSize
    }
  });

  reply.status(201).send({
    assetId: createdAsset.id,
    caseId: foundCase.id,
    s3Key: createdAsset.s3Key,
    uploadUrl: uploadPlan.uploadUrl,
    uploadMethod: "PUT",
    uploadHeaders: {
      "Content-Type": requestBody.mimeType
    },
    expiresInSeconds: uploadPlan.expiresInSeconds
  });
});

app.post("/cases/:id/assets/:assetId/finalize", async (request, reply) => {
  const paramsParse = assetParamsSchema.safeParse(request.params);
  if (!paramsParse.success) {
    sendValidationError(reply, request.id, paramsParse.error.issues);
    return;
  }
  const bodyParse = finalizeAssetSchema.safeParse(request.body ?? {});
  if (!bodyParse.success) {
    sendValidationError(reply, request.id, bodyParse.error.issues);
    return;
  }

  const { id: caseId, assetId } = paramsParse.data;
  const explicitUserDescription = bodyParse.data.userDescription?.trim();
  const user = await getOrCreateUser(request.auth);
  const foundAsset = await prisma.asset.findFirst({
    where: {
      id: assetId,
      caseId,
      case: {
        userId: user.id
      }
    },
    select: {
      id: true,
      caseId: true,
      assetType: true,
      mimeType: true
    }
  });

  if (!foundAsset) {
    reply.status(404).send({ error: "NOT_FOUND", requestId: request.id });
    return;
  }

  const isPlusUser = await hasPlusEntitlement(user);
  const now = new Date();
  const month = utcMonthBounds(now);
  const day = utcDayBounds(now);
  const monthlyLimit = getFreeMonthlyPageLimit();
  const dailyLimit = getFreeDailyUploadLimit();
  const pendingAssetUnits = isPlusUser ? 0 : await estimateAssetPageUnits(foundAsset);

  type FinalizePreflightResult =
    | { kind: "alreadyQueued"; messageId: string | null; pending: boolean }
    | { kind: "freeOcrDisabled" }
    | { kind: "freeMonthlyLimit"; used: number }
    | { kind: "freeDailyLimit"; used: number }
    | { kind: "ready"; reservationLogId: string | null; enqueueAuditLogId: string };

  const preflight = await prisma.$transaction(
    async (tx): Promise<FinalizePreflightResult> => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`finalize-asset:${foundAsset.id}`}))`;
      const recentAssetEvents = await tx.auditLog.findMany({
        where: {
          assetId: foundAsset.id,
          eventType: AuditEventType.CASE_UPDATED
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 20,
        select: {
          payload: true
        }
      });

      for (const row of recentAssetEvents) {
        const subtype = extractCaseUpdatedSubtype(row.payload);
        if (subtype === ASSET_UPLOADED_ENQUEUED_SUBTYPE) {
          return {
            kind: "alreadyQueued",
            messageId: extractQueueMessageId(row.payload),
            pending: false
          };
        }
        if (subtype === ASSET_UPLOADED_ENQUEUING_SUBTYPE) {
          return {
            kind: "alreadyQueued",
            messageId: extractQueueMessageId(row.payload),
            pending: true
          };
        }
      }

      let reservationLogId: string | null = null;
      if (!isPlusUser) {
        if (!isGlobalFreeOcrEnabled()) {
          return { kind: "freeOcrDisabled" };
        }

        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`free-usage:${user.id}`}))`;
        const [usedMonthlyPages, reservedMonthlyPages, usedDailyUploads] = await Promise.all([
          getFreeMonthlyProcessedPageUnitsFromClient(tx, user.id, month.start, month.end),
          getFreeMonthlyReservedPageUnits(tx, user.id, month.start, month.end),
          getFreeDailyReservedUploadCount(tx, user.id, day.start, day.end)
        ]);

        const usedMonthly = usedMonthlyPages + reservedMonthlyPages;
        if (usedMonthly + pendingAssetUnits > monthlyLimit) {
          return {
            kind: "freeMonthlyLimit",
            used: usedMonthly
          };
        }

        if (dailyLimit > 0 && usedDailyUploads >= dailyLimit) {
          return {
            kind: "freeDailyLimit",
            used: usedDailyUploads
          };
        }

        const reservationLog = await tx.auditLog.create({
          data: {
            caseId: foundAsset.caseId,
            assetId: foundAsset.id,
            eventType: AuditEventType.CASE_UPDATED,
            actorType: "api",
            requestId: request.id,
            payload: {
              subtype: FREE_QUOTA_RESERVATION_SUBTYPE,
              pageUnits: pendingAssetUnits
            } as Prisma.InputJsonValue
          }
        });
        reservationLogId = reservationLog.id;
      }

      const enqueueAuditLog = await tx.auditLog.create({
        data: {
          caseId: foundAsset.caseId,
          assetId: foundAsset.id,
          eventType: AuditEventType.CASE_UPDATED,
          actorType: "api",
          requestId: request.id,
          payload: {
            subtype: ASSET_UPLOADED_ENQUEUING_SUBTYPE,
            reservationLogId,
            reservedPageUnits: reservationLogId ? pendingAssetUnits : null
          } as Prisma.InputJsonValue
        }
      });

      return {
        kind: "ready",
        reservationLogId,
        enqueueAuditLogId: enqueueAuditLog.id
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    }
  );

  if (preflight.kind === "alreadyQueued") {
    reply.status(202).send({
      queued: true,
      alreadyQueued: true,
      pending: preflight.pending,
      messageId: preflight.messageId,
      caseId: foundAsset.caseId,
      assetId: foundAsset.id,
      contextReuse: {
        reused: false,
        sourceCaseId: null
      }
    });
    return;
  }

  if (preflight.kind === "freeOcrDisabled") {
    await writeOpsMetricAudit({
      requestId: request.id,
      actorId: user.id,
      caseId: foundAsset.caseId,
      assetId: foundAsset.id,
      subtype: OPS_SUBTYPE_FREE_OCR_DISABLED
    });
    sendFreeOcrDisabled(reply, request.id);
    return;
  }

  if (preflight.kind === "freeMonthlyLimit") {
    await writeOpsMetricAudit({
      requestId: request.id,
      actorId: user.id,
      caseId: foundAsset.caseId,
      assetId: foundAsset.id,
      subtype: OPS_SUBTYPE_FREE_LIMIT_REACHED,
      details: {
        limit: monthlyLimit,
        used: preflight.used,
        resetAt: month.end.toISOString()
      }
    });
    sendFreeLimitReached(reply, request.id, {
      limit: monthlyLimit,
      used: preflight.used,
      resetAt: month.end.toISOString()
    });
    return;
  }

  if (preflight.kind === "freeDailyLimit") {
    sendFreeDailyUploadLimitReached(reply, request.id, {
      limit: dailyLimit,
      used: preflight.used,
      resetAt: day.end.toISOString()
    });
    return;
  }

  const releasePreflightReservation = async (): Promise<void> => {
    await prisma.$transaction(async (tx) => {
      if (preflight.enqueueAuditLogId) {
        await tx.auditLog.deleteMany({
          where: {
            id: preflight.enqueueAuditLogId
          }
        });
      }
      if (preflight.reservationLogId) {
        await tx.auditLog.deleteMany({
          where: {
            id: preflight.reservationLogId
          }
        });
      }
    });
  };

  const queueStatus = getQueueConfigStatus();
  if (!queueStatus.configured) {
    await releasePreflightReservation();
    await writeOpsMetricAudit({
      requestId: request.id,
      actorId: user.id,
      caseId: foundAsset.caseId,
      assetId: foundAsset.id,
      subtype: OPS_SUBTYPE_FINALIZE_ENQUEUE_FAILED,
      details: {
        reason: "queue_not_configured",
        missing: queueStatus.missing
      }
    });
    reply.status(503).send({
      error: "WORKER_QUEUE_NOT_CONFIGURED",
      requestId: request.id,
      missing: queueStatus.missing
    });
    return;
  }

  try {
    let resolvedUserDescription = explicitUserDescription;
    let reusedFromCaseId: string | null = null;
    let reusedFromCrossCaseMemory = false;
    if (!resolvedUserDescription) {
      const recentLogs = await prisma.auditLog.findMany({
        where: {
          caseId: foundAsset.caseId,
          eventType: AuditEventType.CASE_UPDATED
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 40,
        select: {
          caseId: true,
          payload: true
        }
      });
      resolvedUserDescription =
        recentLogs
          .map((row) => ({
            caseId: row.caseId,
            description: extractCaseContextFromPayload(row.payload)
          }))
          .find((row) => Boolean(row.description))?.description ?? undefined;
    }

    if (!resolvedUserDescription) {
      const crossCaseLogs = await prisma.auditLog.findMany({
        where: {
          eventType: AuditEventType.CASE_UPDATED,
          case: {
            userId: user.id,
            id: {
              not: foundAsset.caseId
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 80,
        select: {
          caseId: true,
          payload: true
        }
      });

      const reused = crossCaseLogs
        .map((row) => ({
          caseId: row.caseId,
          description: extractCaseContextFromPayload(row.payload)
        }))
        .find((row) => Boolean(row.description));

      if (reused?.description) {
        resolvedUserDescription = reused.description;
        reusedFromCrossCaseMemory = true;
        reusedFromCaseId = reused.caseId ?? null;
      }
    }

    let sendResult: { MessageId?: string };
    try {
      sendResult = await getSqsClient(queueStatus.region).send(
        new SendMessageCommand({
          QueueUrl: queueStatus.queueUrl,
          MessageBody: JSON.stringify({
            type: "asset_uploaded",
            caseId: foundAsset.caseId,
            assetId: foundAsset.id,
            userDescription: resolvedUserDescription || undefined,
            contextReuse:
              reusedFromCrossCaseMemory && reusedFromCaseId
                ? {
                    sourceCaseId: reusedFromCaseId
                  }
                : undefined
          })
        })
      );
    } catch (error) {
      await releasePreflightReservation();
      await writeOpsMetricAudit({
        requestId: request.id,
        actorId: user.id,
        caseId: foundAsset.caseId,
        assetId: foundAsset.id,
        subtype: OPS_SUBTYPE_FINALIZE_ENQUEUE_FAILED,
        details: {
          reason: "queue_send_failed"
        }
      });
      request.log.error(
        {
          err: error,
          requestId: request.id,
          caseId: foundAsset.caseId,
          assetId: foundAsset.id
        },
        "Failed to enqueue asset_uploaded message"
      );
      reply.status(502).send({ error: "QUEUE_ENQUEUE_FAILED", requestId: request.id });
      return;
    }

    try {
      await prisma.auditLog.update({
        where: {
          id: preflight.enqueueAuditLogId
        },
        data: {
          payload: {
            subtype: ASSET_UPLOADED_ENQUEUED_SUBTYPE,
            queueMessageId: sendResult.MessageId ?? null,
            hasUserDescription: Boolean(resolvedUserDescription),
            contextReusedFromCrossCaseMemory: reusedFromCrossCaseMemory,
            contextSourceCaseId: reusedFromCaseId,
            reservationLogId: preflight.reservationLogId,
            reservedPageUnits: preflight.reservationLogId ? pendingAssetUnits : null
          } as Prisma.InputJsonValue
        }
      });
    } catch (error) {
      request.log.error(
        {
          err: error,
          requestId: request.id,
          caseId: foundAsset.caseId,
          assetId: foundAsset.id,
          enqueueAuditLogId: preflight.enqueueAuditLogId
        },
        "Queued message but failed to persist enqueue audit log update"
      );
    }

    reply.status(202).send({
      queued: true,
      messageId: sendResult.MessageId ?? null,
      caseId: foundAsset.caseId,
      assetId: foundAsset.id,
      contextReuse: {
        reused: reusedFromCrossCaseMemory,
        sourceCaseId: reusedFromCaseId
      }
    });
  } catch (error) {
    await writeOpsMetricAudit({
      requestId: request.id,
      actorId: user.id,
      caseId: foundAsset.caseId,
      assetId: foundAsset.id,
      subtype: OPS_SUBTYPE_FINALIZE_ENQUEUE_FAILED,
      details: {
        reason: "prepare_enqueue_payload_failed"
      }
    });
    request.log.error(
      {
        err: error,
        requestId: request.id,
        caseId: foundAsset.caseId,
        assetId: foundAsset.id
      },
      "Failed to prepare asset finalize enqueue payload"
    );
    reply.status(500).send({ error: "INTERNAL_SERVER_ERROR", requestId: request.id });
  }
});

const apiPort = Number(process.env.API_PORT ?? 3001);
const apiHost = process.env.API_HOST ?? "0.0.0.0";

// --- Graceful shutdown ---

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "Received shutdown signal, draining...");
  try {
    await app.close();
    await prisma.$disconnect();
    app.log.info("Shutdown complete.");
    process.exit(0);
  } catch (error) {
    app.log.error(error, "Error during shutdown");
    process.exit(1);
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

try {
  await app.listen({ host: apiHost, port: apiPort });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
