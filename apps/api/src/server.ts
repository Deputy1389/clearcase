import "dotenv/config";
import Fastify, { type FastifyReply } from "fastify";
import { AssetType, Prisma, type User } from "@prisma/client";
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

const createAssetSchema = z
  .object({
    fileName: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().min(3).max(200),
    byteSize: z.number().int().positive().max(25 * 1024 * 1024),
    assetType: z.nativeEnum(AssetType).optional()
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

function sendValidationError(reply: FastifyReply, issues: unknown): void {
  reply.status(400).send({
    error: "BAD_REQUEST",
    issues
  });
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
    sendValidationError(reply, parsed.error.issues);
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
      sendValidationError(reply, [{ message: "zipCode could not be mapped to a US state." }]);
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
    sendValidationError(reply, parsed.error.issues);
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

app.get("/cases/:id", async (request, reply) => {
  const paramsParse = caseParamsSchema.safeParse(request.params);
  if (!paramsParse.success) {
    sendValidationError(reply, paramsParse.error.issues);
    return;
  }

  const user = await getOrCreateUser(request.auth);
  const foundCase = await prisma.case.findFirst({
    where: {
      id: paramsParse.data.id,
      userId: user.id
    },
    include: {
      assets: true,
      extractions: true,
      verdicts: true,
      auditLogs: true,
      chatSessions: {
        include: {
          messages: true
        }
      }
    }
  });

  if (!foundCase) {
    reply.status(404).send({ error: "NOT_FOUND" });
    return;
  }

  return foundCase;
});

app.post("/cases/:id/assets", async (request, reply) => {
  const paramsParse = caseParamsSchema.safeParse(request.params);
  if (!paramsParse.success) {
    sendValidationError(reply, paramsParse.error.issues);
    return;
  }

  const bodyParse = createAssetSchema.safeParse(request.body ?? {});
  if (!bodyParse.success) {
    sendValidationError(reply, bodyParse.error.issues);
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
    reply.status(404).send({ error: "NOT_FOUND" });
    return;
  }

  const uploadConfigStatus = getUploadConfigStatus();
  if (!uploadConfigStatus.configured) {
    reply.status(503).send({
      error: "AWS_UPLOADS_NOT_CONFIGURED",
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
    request.log.error({ err: error }, "Failed to create presigned upload URL");
    reply.status(502).send({ error: "UPLOAD_URL_GENERATION_FAILED" });
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

const apiPort = Number(process.env.API_PORT ?? 3001);
const apiHost = process.env.API_HOST ?? "0.0.0.0";

try {
  await app.listen({ host: apiHost, port: apiPort });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
