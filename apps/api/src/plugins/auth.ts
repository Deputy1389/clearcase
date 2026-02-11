import type { FastifyInstance, FastifyRequest } from "fastify";

export type AuthContext = {
  provider: string;
  subject: string;
  email?: string;
};

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthContext;
  }
}

const DEFAULT_SUBJECT = "dev-subject-0001";

function getHeaderValue(request: FastifyRequest, name: string): string | undefined {
  const value = request.headers[name];

  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];
    return typeof first === "string" && first.length > 0 ? first : undefined;
  }

  return undefined;
}

function buildFallbackEmail(subject: string): string {
  const safeSubject = subject.replace(/[^a-zA-Z0-9._-]/g, "-");
  return `dev+${safeSubject}@clearcase.local`;
}

export async function authPlugin(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", async (request) => {
    const subject = getHeaderValue(request, "x-auth-subject") ?? DEFAULT_SUBJECT;
    const email = getHeaderValue(request, "x-user-email") ?? buildFallbackEmail(subject);

    request.auth = {
      provider: "dev-header-stub",
      subject,
      email
    };
  });
}
