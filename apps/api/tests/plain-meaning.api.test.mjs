import "dotenv/config";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import test from "node:test";
import { Client } from "pg";

const API_BASE = process.env.CLEARCASE_API_BASE || "http://127.0.0.1:3001";
const DATABASE_URL = process.env.DATABASE_URL;

function buildAuthHeaders(seed, suffix = "user") {
  return {
    "x-auth-subject": `plain-meaning-${seed}-${suffix}`,
    "x-user-email": `plain.meaning.${seed}.${suffix}@example.com`
  };
}

function buildOpsHeaders() {
  const token = process.env.OPS_ADMIN_TOKEN?.trim() || process.env.OPS_METRICS_TOKEN?.trim();
  if (!token) return {};
  return { "x-ops-token": token };
}

async function withDb(fn) {
  assert.ok(DATABASE_URL, "DATABASE_URL must be set to run plain-meaning API tests.");
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

function randomPort() {
  return 5600 + Math.floor(Math.random() * 250);
}

async function wait(ms) {
  await new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function startApiServer(envOverrides = {}) {
  const port = randomPort();
  const mergedEnv = {
    ...process.env,
    API_HOST: "127.0.0.1",
    API_PORT: String(port),
    ...envOverrides
  };
  const env = Object.fromEntries(
    Object.entries(mergedEnv).filter(([, value]) => typeof value === "string")
  );
  const tsxCli = resolve(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
  const child = spawn(process.execPath, [tsxCli, "apps/api/src/server.ts"], {
    cwd: process.cwd(),
    env,
    stdio: "pipe"
  });

  let stderr = "";
  child.stderr?.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  const startedAt = Date.now();
  while (Date.now() - startedAt < 20_000) {
    if (child.exitCode !== null) {
      throw new Error(`API test server exited early with code ${child.exitCode}: ${stderr}`);
    }
    try {
      const health = await fetch(`${baseUrl}/health`);
      if (health.status === 200) {
        return {
          baseUrl,
          stop: async () => {
            if (child.exitCode === null) {
              child.kill();
              await wait(200);
            }
          }
        };
      }
    } catch {
      // keep polling
    }
    await wait(250);
  }

  if (child.exitCode === null) {
    child.kill();
  }
  throw new Error(`API test server failed to start at ${baseUrl}: ${stderr}`);
}

async function ensureApiReady(baseUrl = API_BASE) {
  const health = await fetch(`${baseUrl}/health`);
  assert.equal(health.status, 200, `API is not reachable at ${baseUrl}.`);
}

async function jsonRequest(path, { method = "GET", headers = {}, body } = {}, baseUrl = API_BASE) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      "content-type": "application/json",
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { status: response.status, data };
}

test("plain-meaning endpoint is plus-gated and returns source-linked rows", async (t) => {
  const api = await startApiServer();
  t.after(async () => {
    await api.stop();
  });
  await ensureApiReady(api.baseUrl);

  const seed = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const headers = buildAuthHeaders(seed, "primary");

  const createdCase = await jsonRequest(
    "/cases",
    {
      method: "POST",
      headers,
      body: { title: "Plain meaning case" }
    },
    api.baseUrl
  );
  assert.equal(createdCase.status, 201);
  const caseId = createdCase.data?.id;
  assert.ok(typeof caseId === "string" && caseId.length > 0);

  const me = await jsonRequest("/me", { headers }, api.baseUrl);
  assert.equal(me.status, 200);
  const userId = me.data?.user?.id;
  assert.ok(typeof userId === "string");

  const assetId = randomUUID();
  const extractionId = randomUUID();
  await withDb(async (db) => {
    await db.query(
      `
        INSERT INTO "Asset" ("id", "caseId", "uploaderUserId", "assetType", "s3Key", "fileName", "mimeType", "byteSize", "createdAt")
        VALUES ($1, $2, $3, $4::"AssetType", $5, $6, $7, $8, NOW())
      `,
      [
        assetId,
        caseId,
        userId,
        "DOCUMENT_PDF",
        `tests/plain-meaning/${assetId}.pdf`,
        "notice.pdf",
        "application/pdf",
        2048
      ]
    );

    await db.query(
      `
        INSERT INTO "Extraction" ("id", "caseId", "assetId", "engine", "engineVersion", "rawText", "structuredFacts", "status", "createdAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::"ExtractionStatus", NOW())
      `,
      [
        extractionId,
        caseId,
        assetId,
        "google-vision-ocr",
        "test",
        "The hearing date is March 4, 2026. Bring your notice and payment records. This section describes filing options and response windows.",
        JSON.stringify({ source: "test" }),
        "SUCCEEDED"
      ]
    );
  });

  const freeAttempt = await jsonRequest(`/cases/${caseId}/plain-meaning?language=en`, { headers }, api.baseUrl);
  assert.equal(freeAttempt.status, 403);
  assert.equal(freeAttempt.data?.error, "PLUS_REQUIRED");

  const grant = await jsonRequest(
    "/ops/entitlements/grant",
    {
      method: "POST",
      headers: buildOpsHeaders(),
      body: {
        subject: headers["x-auth-subject"],
        email: headers["x-user-email"],
        plan: "plus",
        status: "active",
        source: "manual"
      }
    },
    api.baseUrl
  );
  assert.equal(grant.status, 200);

  const english = await jsonRequest(`/cases/${caseId}/plain-meaning?language=en`, { headers }, api.baseUrl);
  assert.equal(english.status, 200);
  assert.equal(english.data?.caseId, caseId);
  assert.equal(english.data?.language, "en");
  assert.ok(Array.isArray(english.data?.rows));
  assert.ok(english.data.rows.length >= 1);
  const firstEn = english.data.rows[0];
  assert.ok(typeof firstEn.originalText === "string" && firstEn.originalText.length > 0);
  assert.ok(typeof firstEn.plainMeaning === "string" && firstEn.plainMeaning.length > 0);
  assert.ok(Array.isArray(firstEn.receipts) && firstEn.receipts.length > 0);
  assert.equal(firstEn.receipts[0]?.assetId, assetId);
  assert.equal(firstEn.receipts[0]?.fileName, "notice.pdf");
  assert.ok(typeof firstEn.receipts[0]?.snippet === "string" && firstEn.receipts[0].snippet.length > 0);

  const spanish = await jsonRequest(`/cases/${caseId}/plain-meaning?language=es`, { headers }, api.baseUrl);
  assert.equal(spanish.status, 200);
  assert.equal(spanish.data?.language, "es");
  assert.ok(Array.isArray(spanish.data?.rows) && spanish.data.rows.length >= 1);
  assert.ok(typeof spanish.data?.boundary === "string" && spanish.data.boundary.toLowerCase().includes("no es asesoria legal"));
  assert.ok(spanish.data.rows[0].plainMeaning.toLowerCase().includes("suele"));
});
