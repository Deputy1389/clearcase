import "dotenv/config";
import Fastify, { type FastifyReply } from "fastify";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { AssetType, AuditEventType, Prisma, type User } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../packages/db/src/client.ts";
import { normalizeZipCode, stateFromZipCode } from "./lib/profile.ts";
import { createUploadPlan, getUploadConfigStatus } from "./lib/uploads.ts";
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

async function getOrCreateUser(auth: AuthContext): Promise<User> {
  const subject = auth.subject;
  const email = auth.email ?? fallbackEmail(subject);

  const existing = await prisma.user.findUnique({
    where: { authProviderUserId: subject }
  });

  if (existing) {
    if (existing.email !== email) {
      try {
        return await prisma.user.update({
          where: { id: existing.id },
          data: { email }
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          return existing;
        }
        throw error;
      }
    }

    return existing;
  }

  try {
    return await prisma.user.create({
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
        return createdElsewhere;
      }
    }

    throw error;
  }
}

const app = Fastify({
  logger: true
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
  return { ok: true };
});

app.get("/me", async (request) => {
  const user = await getOrCreateUser(request.auth);

  return {
    user: toPublicUser(user),
    needsProfile: needsProfile(user)
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

  return {
    user: toPublicUser(updatedUser),
    needsProfile: needsProfile(updatedUser)
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
      caseId: true
    }
  });

  if (!foundAsset) {
    reply.status(404).send({ error: "NOT_FOUND", requestId: request.id });
    return;
  }

  const queueStatus = getQueueConfigStatus();
  if (!queueStatus.configured) {
    reply.status(503).send({
      error: "WORKER_QUEUE_NOT_CONFIGURED",
      requestId: request.id,
      missing: queueStatus.missing
    });
    return;
  }

  try {
    let resolvedUserDescription = explicitUserDescription;
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
          payload: true
        }
      });
      resolvedUserDescription =
        recentLogs.map((row) => extractCaseContextFromPayload(row.payload)).find((value) => Boolean(value)) ?? undefined;
    }

    const sendResult = await getSqsClient(queueStatus.region).send(
      new SendMessageCommand({
        QueueUrl: queueStatus.queueUrl,
        MessageBody: JSON.stringify({
          type: "asset_uploaded",
          caseId: foundAsset.caseId,
          assetId: foundAsset.id,
          userDescription: resolvedUserDescription || undefined
        })
      })
    );

    await prisma.auditLog.create({
      data: {
        caseId: foundAsset.caseId,
        assetId: foundAsset.id,
        eventType: AuditEventType.CASE_UPDATED,
        actorType: "api",
        requestId: request.id,
        payload: {
          subtype: "asset_uploaded_enqueued",
          queueMessageId: sendResult.MessageId ?? null,
          hasUserDescription: Boolean(resolvedUserDescription)
        } as Prisma.InputJsonValue
      }
    });

    reply.status(202).send({
      queued: true,
      messageId: sendResult.MessageId ?? null,
      caseId: foundAsset.caseId,
      assetId: foundAsset.id
    });
  } catch (error) {
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
  }
});

const apiPort = Number(process.env.API_PORT ?? 3001);
const apiHost = process.env.API_HOST ?? "0.0.0.0";

try {
  await app.listen({ host: apiHost, port: apiPort });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
