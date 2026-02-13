import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Client } from "pg";

const API_BASE = process.env.CLEARCASE_API_BASE || "http://127.0.0.1:3001";
const DATABASE_URL = process.env.DATABASE_URL;

function buildAuthHeaders(seed) {
  return {
    "x-auth-subject": `ops-metrics-test-${seed}`,
    "x-user-email": `ops.metrics.${seed}@example.com`
  };
}

function buildOpsHeaders() {
  const token = process.env.OPS_METRICS_TOKEN?.trim();
  if (!token) return {};
  return { "x-ops-token": token };
}

async function ensureApiReady() {
  const health = await fetch(`${API_BASE}/health`);
  assert.equal(health.status, 200, `API is not reachable at ${API_BASE}.`);
}

async function jsonRequest(path, { method = "GET", headers = {}, body } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
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

async function createCase(headers, title) {
  const created = await jsonRequest("/cases", {
    method: "POST",
    headers,
    body: { title }
  });
  assert.equal(created.status, 201);
  const caseId = created.data?.id;
  assert.ok(typeof caseId === "string" && caseId.length > 0);
  return caseId;
}

async function withDb(fn) {
  assert.ok(DATABASE_URL, "DATABASE_URL must be set to run ops-metrics API tests.");
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

function readWindowCounts(summary) {
  const window = summary?.last24h;
  return {
    freeLimitReached: Number(window?.freeLimitReached?.count ?? 0),
    freeOcrDisabled: Number(window?.freeOcrDisabled?.count ?? 0),
    plusRequired: Number(window?.plusRequired?.count ?? 0),
    ocrSucceeded: Number(window?.ocrRuns?.succeeded ?? 0),
    ocrFailed: Number(window?.ocrRuns?.failed ?? 0),
    ocrPageUnitsTotal: Number(window?.ocrRuns?.pageUnitsTotal ?? 0),
    consultCreated: Number(window?.consultLinks?.created ?? 0),
    consultDisabled: Number(window?.consultLinks?.disabled ?? 0),
    enqueueSucceeded: Number(window?.finalizeEnqueue?.succeeded ?? 0),
    enqueueFailed: Number(window?.finalizeEnqueue?.failed ?? 0)
  };
}

test("ops metrics summary returns expected aggregate deltas for tracked audit events", async () => {
  await ensureApiReady();

  const seed = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const authHeaders = buildAuthHeaders(seed);
  const opsHeaders = buildOpsHeaders();
  const caseId = await createCase(authHeaders, "Ops summary metric case");

  const baseline = await jsonRequest("/ops/metrics/summary", {
    headers: opsHeaders
  });
  assert.equal(baseline.status, 200);
  const before = readWindowCounts(baseline.data);

  await withDb(async (db) => {
    const now = new Date();
    const insertCaseUpdated = async (subtype, payload = {}) => {
      await db.query(
        `
          INSERT INTO "AuditLog" ("id", "caseId", "eventType", "actorType", "payload", "createdAt")
          VALUES ($1, $2, $3::"AuditEventType", $4, $5::jsonb, $6)
        `,
        [randomUUID(), caseId, "CASE_UPDATED", "api", JSON.stringify({ subtype, ...payload }), now]
      );
    };

    await insertCaseUpdated("free_limit_reached", { limit: 5, used: 5 });
    await insertCaseUpdated("free_ocr_disabled");
    await insertCaseUpdated("plus_required", { route: "watch_mode_set" });
    await insertCaseUpdated("consult_packet_link_created");
    await insertCaseUpdated("consult_packet_link_disabled");
    await insertCaseUpdated("asset_uploaded_enqueued", { queueMessageId: `q-${seed}` });
    await insertCaseUpdated("asset_uploaded_enqueue_failed", { reason: "queue_send_failed" });

    await db.query(
      `
        INSERT INTO "AuditLog" ("id", "caseId", "eventType", "actorType", "payload", "createdAt")
        VALUES ($1, $2, $3::"AuditEventType", $4, $5::jsonb, $6)
      `,
      [
        randomUUID(),
        caseId,
        "OCR_RUN",
        "worker",
        JSON.stringify({
          status: "succeeded",
          pageUnitEstimate: 4,
          sourceMetadata: { mimeType: "application/pdf" }
        }),
        now
      ]
    );

    await db.query(
      `
        INSERT INTO "AuditLog" ("id", "caseId", "eventType", "actorType", "payload", "createdAt")
        VALUES ($1, $2, $3::"AuditEventType", $4, $5::jsonb, $6)
      `,
      [
        randomUUID(),
        caseId,
        "OCR_RUN",
        "worker",
        JSON.stringify({
          status: "failed",
          provider: "stub"
        }),
        now
      ]
    );
  });

  const afterSummary = await jsonRequest("/ops/metrics/summary", {
    headers: opsHeaders
  });
  assert.equal(afterSummary.status, 200);
  const after = readWindowCounts(afterSummary.data);

  assert.ok(after.freeLimitReached - before.freeLimitReached >= 1);
  assert.ok(after.freeOcrDisabled - before.freeOcrDisabled >= 1);
  assert.ok(after.plusRequired - before.plusRequired >= 1);
  assert.ok(after.ocrSucceeded - before.ocrSucceeded >= 1);
  assert.ok(after.ocrFailed - before.ocrFailed >= 1);
  assert.ok(after.ocrPageUnitsTotal - before.ocrPageUnitsTotal >= 4);
  assert.ok(after.consultCreated - before.consultCreated >= 1);
  assert.ok(after.consultDisabled - before.consultDisabled >= 1);
  assert.ok(after.enqueueSucceeded - before.enqueueSucceeded >= 1);
  assert.ok(after.enqueueFailed - before.enqueueFailed >= 1);
});

