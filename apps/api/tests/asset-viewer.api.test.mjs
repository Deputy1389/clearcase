import "dotenv/config";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import test from "node:test";
import { Client } from "pg";

const API_BASE = process.env.CLEARCASE_API_BASE || "http://127.0.0.1:3001";
const DATABASE_URL = process.env.DATABASE_URL;

function buildAuthHeaders(seed, suffix = "a") {
  return {
    "x-auth-subject": `viewer-api-${seed}-${suffix}`,
    "x-user-email": `viewer.api.${seed}.${suffix}@example.com`
  };
}

async function withDb(fn) {
  assert.ok(DATABASE_URL, "DATABASE_URL must be set to run asset viewer API tests.");
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

function randomPort() {
  return 5200 + Math.floor(Math.random() * 300);
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
    AWS_REGION: "us-east-1",
    S3_BUCKET: "clearcase-test-bucket",
    AWS_ACCESS_KEY_ID: "test",
    AWS_SECRET_ACCESS_KEY: "test",
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

test("asset list and secure access URLs are owner-scoped and auditable", async (t) => {
  const api = await startApiServer();
  t.after(async () => {
    await api.stop();
  });
  await ensureApiReady(api.baseUrl);

  const seed = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const ownerHeaders = buildAuthHeaders(seed, "owner");
  const otherHeaders = buildAuthHeaders(seed, "other");

  const ownerCase = await jsonRequest(
    "/cases",
    {
      method: "POST",
      headers: ownerHeaders,
      body: { title: "Owner case" }
    },
    api.baseUrl
  );
  assert.equal(ownerCase.status, 201);
  const caseId = ownerCase.data?.id;
  assert.ok(typeof caseId === "string" && caseId.length > 0);

  const ownerMe = await jsonRequest("/me", { headers: ownerHeaders }, api.baseUrl);
  assert.equal(ownerMe.status, 200);
  const ownerUserId = ownerMe.data?.user?.id;
  assert.ok(typeof ownerUserId === "string");

  const assetId = randomUUID();
  await withDb(async (db) => {
    await db.query(
      `
        INSERT INTO "Asset" ("id", "caseId", "uploaderUserId", "assetType", "s3Key", "fileName", "mimeType", "byteSize", "createdAt")
        VALUES ($1, $2, $3, $4::"AssetType", $5, $6, $7, $8, NOW())
      `,
      [
        assetId,
        caseId,
        ownerUserId,
        "DOCUMENT_PDF",
        `tests/viewer/${assetId}.pdf`,
        "notice.pdf",
        "application/pdf",
        4096
      ]
    );
  });

  const listed = await jsonRequest(`/cases/${caseId}/assets`, { headers: ownerHeaders }, api.baseUrl);
  assert.equal(listed.status, 200);
  assert.equal(listed.data?.caseId, caseId);
  assert.ok(Array.isArray(listed.data?.assets));
  const listedAsset = listed.data.assets.find((row) => row.id === assetId);
  assert.ok(listedAsset);
  assert.equal(listedAsset.processingStatus, "pending");
  assert.equal(listedAsset.source, "file");

  const viewAccess = await jsonRequest(
    `/cases/${caseId}/assets/${assetId}/access?action=view`,
    { headers: ownerHeaders },
    api.baseUrl
  );
  assert.equal(viewAccess.status, 200);
  assert.equal(viewAccess.data?.action, "view");
  assert.ok(typeof viewAccess.data?.accessUrl === "string" && viewAccess.data.accessUrl.includes("X-Amz-Signature"));

  const downloadAccess = await jsonRequest(
    `/cases/${caseId}/assets/${assetId}/access?action=download`,
    { headers: ownerHeaders },
    api.baseUrl
  );
  assert.equal(downloadAccess.status, 200);
  assert.equal(downloadAccess.data?.action, "download");
  assert.ok(typeof downloadAccess.data?.accessUrl === "string" && downloadAccess.data.accessUrl.includes("X-Amz-Signature"));

  const otherAttempt = await jsonRequest(
    `/cases/${caseId}/assets/${assetId}/access?action=view`,
    { headers: otherHeaders },
    api.baseUrl
  );
  assert.equal(otherAttempt.status, 404);

  const auditSummary = await withDb(async (db) => {
    const { rows } = await db.query(
      `
        SELECT
          COUNT(*) FILTER (WHERE ("payload"->>'subtype') = 'asset_view_opened')::int AS view_count,
          COUNT(*) FILTER (WHERE ("payload"->>'subtype') = 'asset_download_requested')::int AS download_count
        FROM "AuditLog"
        WHERE "assetId" = $1
      `,
      [assetId]
    );
    return rows[0];
  });

  assert.ok(Number(auditSummary.view_count) >= 1);
  assert.ok(Number(auditSummary.download_count) >= 1);
});
