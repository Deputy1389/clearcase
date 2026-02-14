import { createHmac, timingSafeEqual } from "node:crypto";
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

function parseBooleanEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === "1" || raw === "true" || raw === "yes" || raw === "on") return true;
  if (raw === "0" || raw === "false" || raw === "no" || raw === "off") return false;
  return fallback;
}

function isDevHeaderAuthEnabled(): boolean {
  const defaultEnabled = process.env.NODE_ENV !== "production";
  return parseBooleanEnv("CLEARCASE_DEV_HEADER_AUTH_ENABLED", defaultEnabled);
}

function getHeaderValue(request: FastifyRequest, name: string): string | undefined {
  const value = request.headers[name];
  if (typeof value === "string" && value.length > 0) return value;
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

// --- JWT / Bearer token verification ---

function base64UrlDecode(value: string): Buffer {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64");
}

function verifyJwtHs256(token: string, secret: string): { sub: string; email?: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;
  const expectedSig = createHmac("sha256", secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest();
  const actualSig = base64UrlDecode(signatureB64);

  if (expectedSig.length !== actualSig.length) return null;
  if (!timingSafeEqual(expectedSig, actualSig)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64).toString("utf8"));
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    if (!payload.sub || typeof payload.sub !== "string") return null;
    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

async function verifyFirebaseToken(idToken: string, projectId: string): Promise<{ sub: string; email?: string } | null> {
  try {
    const parts = idToken.split(".");
    if (parts.length !== 3) return null;

    // Decode header to get kid
    const header = JSON.parse(base64UrlDecode(parts[0]).toString("utf8"));
    const kid = header.kid;
    if (!kid) return null;

    // Fetch Google public keys
    const keysResponse = await fetch(
      "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
    );
    if (!keysResponse.ok) return null;
    const keys = (await keysResponse.json()) as Record<string, string>;
    const cert = keys[kid];
    if (!cert) return null;

    // Verify using Node crypto
    const { createVerify } = await import("node:crypto");
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${parts[0]}.${parts[1]}`);
    const signatureValid = verifier.verify(cert, base64UrlDecode(parts[2]));
    if (!signatureValid) return null;

    // Decode and validate payload
    const payload = JSON.parse(base64UrlDecode(parts[1]).toString("utf8"));
    const now = Date.now() / 1000;
    if (payload.exp && now > payload.exp) return null;
    if (payload.iat && now < payload.iat - 300) return null;
    if (payload.aud !== projectId) return null;
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null;
    if (!payload.sub || typeof payload.sub !== "string") return null;

    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

function extractBearerToken(request: FastifyRequest): string | null {
  const header = getHeaderValue(request, "authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

type AuthProvider = "dev-header-stub" | "jwt-hs256" | "firebase";

function resolveAuthProvider(): AuthProvider {
  if (isDevHeaderAuthEnabled()) return "dev-header-stub";
  const provider = process.env.AUTH_PROVIDER?.trim().toLowerCase();
  if (provider === "firebase") return "firebase";
  if (provider === "jwt" || provider === "jwt-hs256") return "jwt-hs256";
  // Default: if FIREBASE_PROJECT_ID is set, use Firebase. If JWT_SECRET is set, use JWT.
  if (process.env.FIREBASE_PROJECT_ID?.trim()) return "firebase";
  if (process.env.JWT_SECRET?.trim()) return "jwt-hs256";
  return "dev-header-stub";
}

const HEALTH_PATHS = new Set(["/health", "/config/paywall"]);

export async function authPlugin(app: FastifyInstance): Promise<void> {
  const authProvider = resolveAuthProvider();

  app.addHook("onRequest", async (request, reply) => {
    // Skip auth for health/config endpoints
    if (HEALTH_PATHS.has(request.url.split("?")[0])) {
      request.auth = { provider: "anonymous", subject: "anonymous" };
      return;
    }

    if (authProvider === "dev-header-stub") {
      const subject = getHeaderValue(request, "x-auth-subject") ?? DEFAULT_SUBJECT;
      const email = getHeaderValue(request, "x-user-email") ?? buildFallbackEmail(subject);
      request.auth = { provider: "dev-header-stub", subject, email };
      return;
    }

    const token = extractBearerToken(request);
    if (!token) {
      reply.status(401).send({ error: "UNAUTHORIZED", message: "Missing Authorization header." });
      return;
    }

    if (authProvider === "jwt-hs256") {
      const secret = process.env.JWT_SECRET?.trim();
      if (!secret) {
        reply.status(500).send({ error: "AUTH_CONFIG_ERROR", message: "JWT_SECRET not configured." });
        return;
      }
      const claims = verifyJwtHs256(token, secret);
      if (!claims) {
        reply.status(401).send({ error: "UNAUTHORIZED", message: "Invalid or expired token." });
        return;
      }
      request.auth = { provider: "jwt-hs256", subject: claims.sub, email: claims.email };
      return;
    }

    if (authProvider === "firebase") {
      const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
      if (!projectId) {
        reply.status(500).send({ error: "AUTH_CONFIG_ERROR", message: "FIREBASE_PROJECT_ID not configured." });
        return;
      }
      const claims = await verifyFirebaseToken(token, projectId);
      if (!claims) {
        reply.status(401).send({ error: "UNAUTHORIZED", message: "Invalid or expired Firebase token." });
        return;
      }
      request.auth = { provider: "firebase", subject: claims.sub, email: claims.email };
      return;
    }

    reply.status(500).send({ error: "AUTH_CONFIG_ERROR", message: "Unknown auth provider." });
  });
}
