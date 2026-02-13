import "dotenv/config";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import test from "node:test";
import { Client } from "pg";

const API_BASE = process.env.CLEARCASE_API_BASE || "http://127.0.0.1:3001";
const DATABASE_URL = process.env.DATABASE_URL;

function buildOpsHeaders() {
  const token = process.env.OPS_ADMIN_TOKEN?.trim() || process.env.OPS_METRICS_TOKEN?.trim();
  if (!token) return {};
  return { "x-ops-token": token };
}

async function jsonRequest(path, { method, headers, body }, baseUrl = API_BASE) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(headers ?? {})
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

function buildHeaders(seed, tier) {
  if (tier === "plus") {
    return {
      "x-auth-subject": `free-limit-plus-${seed}`,
      "x-user-email": `free.limit.plus.${seed}@example.com`
    };
  }
  return {
    "x-auth-subject": `free-limit-free-${seed}`,
    "x-user-email": `free.limit.free.${seed}@example.com`
  };
}

function buildSeed(tag) {
  return `${tag}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

async function ensureApiReady(baseUrl = API_BASE) {
  const health = await fetch(`${baseUrl}/health`);
  assert.equal(
    health.status,
    200,
    `API is not reachable at ${baseUrl}. Start API before running this test.`
  );
}

async function createCase(headers, title, baseUrl = API_BASE) {
  const created = await jsonRequest(
    "/cases",
    {
      method: "POST",
      headers,
      body: { title }
    },
    baseUrl
  );
  assert.equal(created.status, 201);
  const caseId = created.data?.id;
  assert.ok(typeof caseId === "string" && caseId.length > 0);
  return caseId;
}

async function getUserId(headers, baseUrl = API_BASE) {
  const me = await jsonRequest("/me", { method: "GET", headers }, baseUrl);
  assert.equal(me.status, 200);
  const userId = me.data?.user?.id;
  assert.ok(typeof userId === "string" && userId.length > 0);
  return userId;
}

async function withDb(fn) {
  assert.ok(DATABASE_URL, "DATABASE_URL must be set to run free-limit API tests.");
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function createAssetRow(db, { caseId, userId, mimeType = "image/jpeg", assetType = "DOCUMENT_IMAGE" }) {
  const assetId = randomUUID();
  const s3Key = `tests/free-limit/${assetId}`;
  await db.query(
    `
      INSERT INTO "Asset" ("id", "caseId", "uploaderUserId", "assetType", "s3Key", "fileName", "mimeType", "byteSize", "createdAt")
      VALUES ($1, $2, $3, $4::"AssetType", $5, $6, $7, $8, NOW())
    `,
    [assetId, caseId, userId, assetType, s3Key, `asset-${assetId}.jpg`, mimeType, 1024]
  );
  return assetId;
}

async function insertSucceededOcrUsage(db, { caseId, assetId, pageCount, mimeType = "image/jpeg" }) {
  const payload = {
    status: "succeeded",
    providerMetadata: {
      pageCount
    },
    sourceMetadata: {
      mimeType
    }
  };
  await db.query(
    `
      INSERT INTO "AuditLog" ("id", "caseId", "assetId", "eventType", "actorType", "payload", "createdAt")
      VALUES ($1, $2, $3, $4::"AuditEventType", $5, $6::jsonb, NOW())
    `,
    [randomUUID(), caseId, assetId, "OCR_RUN", "worker", JSON.stringify(payload)]
  );
}

async function countEnqueueAuditRows(db, caseId) {
  const { rows } = await db.query(
    `
      SELECT COUNT(*)::int AS count
      FROM "AuditLog"
      WHERE "caseId" = $1
        AND "eventType" = 'CASE_UPDATED'::"AuditEventType"
        AND ("payload"->>'subtype') = 'asset_uploaded_enqueued'
    `,
    [caseId]
  );
  return Number(rows[0]?.count ?? 0);
}

async function grantPlusByOps(headers, baseUrl = API_BASE) {
  const granted = await jsonRequest(
    "/ops/entitlements/grant",
    {
      method: "POST",
      headers: {
        ...buildOpsHeaders()
      },
      body: {
        subject: headers["x-auth-subject"],
        email: headers["x-user-email"],
        plan: "plus",
        status: "active",
        source: "manual"
      }
    },
    baseUrl
  );
  assert.equal(granted.status, 200);
  assert.equal(granted.data?.effective?.isPlus, true);
}

async function insertCaseUpdatedAudit(db, { caseId, assetId, subtype, payload = {} }) {
  await db.query(
    `
      INSERT INTO "AuditLog" ("id", "caseId", "assetId", "eventType", "actorType", "payload", "createdAt")
      VALUES ($1, $2, $3, $4::"AuditEventType", $5, $6::jsonb, NOW())
    `,
    [randomUUID(), caseId, assetId ?? null, "CASE_UPDATED", "api", JSON.stringify({ subtype, ...payload })]
  );
}

function randomPort() {
  return 3300 + Math.floor(Math.random() * 500);
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
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

test("Free user is blocked at monthly limit with stable FREE_LIMIT_REACHED contract and no enqueue side effects", async () => {
  await ensureApiReady();
  const seed = buildSeed("free-block");
  const headers = buildHeaders(seed, "free");

  const caseId = await createCase(headers, "Free limit contract case");
  const userId = await getUserId(headers);

  await withDb(async (db) => {
    const historyAssetId = await createAssetRow(db, { caseId, userId, mimeType: "application/pdf", assetType: "DOCUMENT_PDF" });
    await insertSucceededOcrUsage(db, {
      caseId,
      assetId: historyAssetId,
      pageCount: 1000,
      mimeType: "application/pdf"
    });

    const newAssetId = await createAssetRow(db, { caseId, userId });
    const enqueueBefore = await countEnqueueAuditRows(db, caseId);

    const finalize = await jsonRequest(`/cases/${caseId}/assets/${newAssetId}/finalize`, {
      method: "POST",
      headers,
      body: {}
    });

    assert.equal(finalize.status, 403);
    assert.equal(finalize.data?.error, "FREE_LIMIT_REACHED");
    assert.equal(finalize.data?.code, "FREE_LIMIT_REACHED");
    assert.ok(Number.isFinite(finalize.data?.limit));
    assert.ok(Number.isFinite(finalize.data?.used));
    assert.ok(Number.isFinite(finalize.data?.remaining));
    assert.ok(typeof finalize.data?.resetAt === "string" && finalize.data.resetAt.length > 0);
    assert.ok(!Number.isNaN(Date.parse(finalize.data?.resetAt)));
    assert.equal(finalize.data?.remaining, Math.max(0, finalize.data?.limit - finalize.data?.used));

    const enqueueAfter = await countEnqueueAuditRows(db, caseId);
    assert.equal(enqueueAfter, enqueueBefore);
  });
});

test("Plus user is not blocked by Free monthly page limit", async (t) => {
  const api = await startApiServer();
  t.after(async () => {
    await api.stop();
  });
  await ensureApiReady(api.baseUrl);
  const seed = buildSeed("plus-bypass");
  const headers = buildHeaders(seed, "plus");

  const caseId = await createCase(headers, "Plus bypass free limit case", api.baseUrl);
  const userId = await getUserId(headers, api.baseUrl);

  await grantPlusByOps(headers, api.baseUrl);
  await withDb(async (db) => {
    const historyAssetId = await createAssetRow(db, { caseId, userId, mimeType: "application/pdf", assetType: "DOCUMENT_PDF" });
    await insertSucceededOcrUsage(db, {
      caseId,
      assetId: historyAssetId,
      pageCount: 1000,
      mimeType: "application/pdf"
    });

    const newAssetId = await createAssetRow(db, { caseId, userId });
    const finalize = await jsonRequest(`/cases/${caseId}/assets/${newAssetId}/finalize`, {
      method: "POST",
      headers,
      body: {}
    }, api.baseUrl);

    const blockedByFreeLimit =
      finalize.status === 403 &&
      finalize.data &&
      typeof finalize.data === "object" &&
      finalize.data.error === "FREE_LIMIT_REACHED";

    assert.equal(blockedByFreeLimit, false);
  });
});

test("Free user gets FREE_DAILY_UPLOAD_LIMIT_REACHED when daily cap is exhausted", async () => {
  await ensureApiReady();
  const seed = buildSeed("free-daily-limit");
  const headers = buildHeaders(seed, "free");

  const caseId = await createCase(headers, "Free daily limit case");
  const userId = await getUserId(headers);

  await withDb(async (db) => {
    for (let i = 0; i < 20; i += 1) {
      const existingAssetId = await createAssetRow(db, { caseId, userId });
      await insertCaseUpdatedAudit(db, {
        caseId,
        assetId: existingAssetId,
        subtype: "asset_uploaded_enqueued",
        payload: {
          queueMessageId: `daily-limit-${i}`
        }
      });
    }

    const newAssetId = await createAssetRow(db, { caseId, userId });
    const finalize = await jsonRequest(`/cases/${caseId}/assets/${newAssetId}/finalize`, {
      method: "POST",
      headers,
      body: {}
    });

    assert.equal(finalize.status, 403);
    assert.equal(finalize.data?.error, "FREE_DAILY_UPLOAD_LIMIT_REACHED");
    assert.equal(finalize.data?.code, "FREE_DAILY_UPLOAD_LIMIT_REACHED");
    assert.ok(Number.isFinite(finalize.data?.limit));
    assert.ok(Number.isFinite(finalize.data?.used));
    assert.ok(typeof finalize.data?.resetAt === "string" && finalize.data.resetAt.length > 0);
  });
});

test("Free user gets FREE_OCR_DISABLED when kill switch is off", async (t) => {
  const api = await startApiServer({
    GLOBAL_FREE_OCR_ENABLED: "false"
  });
  t.after(async () => {
    await api.stop();
  });

  await ensureApiReady(api.baseUrl);
  const seed = buildSeed("free-ocr-disabled");
  const headers = buildHeaders(seed, "free");
  const caseId = await createCase(headers, "Free OCR disabled case", api.baseUrl);
  const userId = await getUserId(headers, api.baseUrl);

  await withDb(async (db) => {
    const assetId = await createAssetRow(db, { caseId, userId });
    const finalize = await jsonRequest(
      `/cases/${caseId}/assets/${assetId}/finalize`,
      {
        method: "POST",
        headers,
        body: {}
      },
      api.baseUrl
    );

    assert.equal(finalize.status, 403);
    assert.equal(finalize.data?.error, "FREE_OCR_DISABLED");
    assert.equal(finalize.data?.code, "FREE_OCR_DISABLED");
  });
});

test("Concurrent free finalize burst cannot overshoot monthly limit", async (t) => {
  const api = await startApiServer({
    FREE_MONTHLY_PAGE_LIMIT: "1",
    AWS_REGION: "us-east-1",
    SQS_QUEUE_URL: "https://sqs.us-east-1.amazonaws.com/000000000000/clearcase-test"
  });
  t.after(async () => {
    await api.stop();
  });

  await ensureApiReady(api.baseUrl);
  const seed = buildSeed("free-burst");
  const headers = buildHeaders(seed, "free");

  const caseId = await createCase(headers, "Concurrent burst case", api.baseUrl);
  const userId = await getUserId(headers, api.baseUrl);

  const assetIds = await withDb(async (db) => {
    const rows = [];
    for (let i = 0; i < 8; i += 1) {
      rows.push(await createAssetRow(db, { caseId, userId }));
    }
    return rows;
  });

  const responses = await Promise.all(
    assetIds.map((assetId) =>
      jsonRequest(
        `/cases/${caseId}/assets/${assetId}/finalize`,
        {
          method: "POST",
          headers,
          body: {}
        },
        api.baseUrl
      )
    )
  );

  const monthlyLimitBlocks = responses.filter((row) => row.data?.error === "FREE_LIMIT_REACHED").length;
  const enqueueFailures = responses.filter((row) => row.data?.error === "QUEUE_ENQUEUE_FAILED").length;
  const queuedAccepted = responses.filter((row) => row.status === 202 && row.data?.queued === true).length;

  assert.ok(monthlyLimitBlocks >= 1 || enqueueFailures >= 1);
  assert.ok(queuedAccepted <= 1);
});
