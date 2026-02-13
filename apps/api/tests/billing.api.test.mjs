import "dotenv/config";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { resolve } from "node:path";
import test from "node:test";

const API_BASE = process.env.CLEARCASE_API_BASE || "http://127.0.0.1:3001";

function buildAuthHeaders(seed) {
  return {
    "x-auth-subject": `billing-api-${seed}`,
    "x-user-email": `billing.api.${seed}@example.com`
  };
}

function buildOpsHeaders() {
  const token = process.env.OPS_ADMIN_TOKEN?.trim() || process.env.OPS_METRICS_TOKEN?.trim();
  if (!token) return {};
  return { "x-ops-token": token };
}

function randomPort() {
  return 4800 + Math.floor(Math.random() * 300);
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

function signWebhookPayload(payload, secret) {
  return `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

async function sendWebhook(baseUrl, body, secret, overrideSignature) {
  const payloadString = JSON.stringify(body);
  const signature = overrideSignature ?? signWebhookPayload(payloadString, secret);
  return jsonRequest(
    "/billing/webhooks/subscription",
    {
      method: "POST",
      headers: {
        "x-billing-signature": signature
      },
      body
    },
    baseUrl
  );
}

test("billing webhook signature, idempotency, transitions, and reconciliation drift flags", async (t) => {
  const webhookSecret = `test-secret-${Date.now()}`;
  const api = await startApiServer({
    BILLING_ENABLED: "true",
    BILLING_PROVIDER: "internal_stub",
    BILLING_WEBHOOK_SECRET: webhookSecret
  });
  t.after(async () => {
    await api.stop();
  });

  await ensureApiReady(api.baseUrl);
  const seed = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const authHeaders = buildAuthHeaders(seed);

  const createdCase = await jsonRequest(
    "/cases",
    {
      method: "POST",
      headers: authHeaders,
      body: {
        title: "Billing entitlement transition case"
      }
    },
    api.baseUrl
  );
  assert.equal(createdCase.status, 201);
  const caseId = createdCase.data?.id;
  assert.ok(typeof caseId === "string" && caseId.length > 0);

  const watchBefore = await jsonRequest(
    `/cases/${caseId}/watch-mode`,
    {
      method: "POST",
      headers: authHeaders,
      body: { enabled: true }
    },
    api.baseUrl
  );
  assert.equal(watchBefore.status, 403);
  assert.equal(watchBefore.data?.error, "PLUS_REQUIRED");

  const now = Date.now();
  const plusPeriodEnd = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
  const graceUntil = new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString();

  const baseSubscription = {
    providerSubscriptionId: `sub_${seed}`,
    providerCustomerId: `cus_${seed}`,
    currentPeriodStart: new Date(now).toISOString(),
    currentPeriodEnd: plusPeriodEnd,
    cancelAtPeriodEnd: false
  };

  const createBody = {
    provider: "internal_stub",
    eventId: `evt-create-${seed}`,
    eventType: "create",
    createdAt: new Date(now + 1000).toISOString(),
    subscription: {
      ...baseSubscription,
      status: "active"
    },
    user: {
      subject: authHeaders["x-auth-subject"],
      email: authHeaders["x-user-email"]
    },
    metadata: {
      source: "billing_test"
    }
  };

  const invalidSig = await sendWebhook(api.baseUrl, createBody, webhookSecret, "sha256=invalid");
  assert.equal(invalidSig.status, 401);
  assert.equal(invalidSig.data?.error, "INVALID_WEBHOOK_SIGNATURE");

  const created = await sendWebhook(api.baseUrl, createBody, webhookSecret);
  assert.equal(created.status, 200);
  assert.equal(created.data?.processed, true);
  assert.equal(created.data?.transition, "plus_active");

  const duplicate = await sendWebhook(api.baseUrl, createBody, webhookSecret);
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.data?.duplicate, true);

  const watchAfterCreate = await jsonRequest(
    `/cases/${caseId}/watch-mode`,
    {
      method: "POST",
      headers: authHeaders,
      body: { enabled: true }
    },
    api.baseUrl
  );
  assert.equal(watchAfterCreate.status, 200);

  const cancelBody = {
    provider: "internal_stub",
    eventId: `evt-cancel-${seed}`,
    eventType: "cancel",
    createdAt: new Date(now + 2000).toISOString(),
    subscription: {
      ...baseSubscription,
      status: "cancelled",
      cancelAtPeriodEnd: true
    },
    user: {
      subject: authHeaders["x-auth-subject"],
      email: authHeaders["x-user-email"]
    }
  };
  const cancelled = await sendWebhook(api.baseUrl, cancelBody, webhookSecret);
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.data?.transition, "plus_until_period_end");

  const watchAfterCancel = await jsonRequest(
    `/cases/${caseId}/watch-mode`,
    {
      method: "POST",
      headers: authHeaders,
      body: { enabled: true }
    },
    api.baseUrl
  );
  assert.equal(watchAfterCancel.status, 200);

  const pastDueBody = {
    provider: "internal_stub",
    eventId: `evt-past-due-${seed}`,
    eventType: "past_due",
    createdAt: new Date(now + 3000).toISOString(),
    subscription: {
      ...baseSubscription,
      status: "past_due",
      graceUntil
    },
    user: {
      subject: authHeaders["x-auth-subject"],
      email: authHeaders["x-user-email"]
    }
  };
  const inGrace = await sendWebhook(api.baseUrl, pastDueBody, webhookSecret);
  assert.equal(inGrace.status, 200);
  assert.equal(inGrace.data?.transition, "grace_period");

  const reactivatedBody = {
    provider: "internal_stub",
    eventId: `evt-reactivated-${seed}`,
    eventType: "update",
    createdAt: new Date(now + 4000).toISOString(),
    subscription: {
      ...baseSubscription,
      status: "active"
    },
    user: {
      subject: authHeaders["x-auth-subject"],
      email: authHeaders["x-user-email"]
    }
  };
  const reactivated = await sendWebhook(api.baseUrl, reactivatedBody, webhookSecret);
  assert.equal(reactivated.status, 200);
  assert.equal(reactivated.data?.transition, "plus_active");

  const outOfOrderBody = {
    provider: "internal_stub",
    eventId: `evt-out-of-order-${seed}`,
    eventType: "update",
    createdAt: new Date(now + 500).toISOString(),
    subscription: {
      ...baseSubscription,
      status: "active"
    },
    user: {
      subject: authHeaders["x-auth-subject"],
      email: authHeaders["x-user-email"]
    }
  };
  const outOfOrder = await sendWebhook(api.baseUrl, outOfOrderBody, webhookSecret);
  assert.equal(outOfOrder.status, 200);
  assert.equal(outOfOrder.data?.reason, "OUT_OF_ORDER_EVENT");

  const endedBody = {
    provider: "internal_stub",
    eventId: `evt-ended-${seed}`,
    eventType: "update",
    createdAt: new Date(now + 5000).toISOString(),
    subscription: {
      ...baseSubscription,
      status: "ended",
      currentPeriodEnd: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
      graceUntil: new Date(now - 24 * 60 * 60 * 1000).toISOString()
    },
    user: {
      subject: authHeaders["x-auth-subject"],
      email: authHeaders["x-user-email"]
    }
  };
  const ended = await sendWebhook(api.baseUrl, endedBody, webhookSecret);
  assert.equal(ended.status, 200);
  assert.equal(ended.data?.transition, "revoked_ended");

  const watchAfterEnded = await jsonRequest(
    `/cases/${caseId}/watch-mode`,
    {
      method: "POST",
      headers: authHeaders,
      body: { enabled: true }
    },
    api.baseUrl
  );
  assert.equal(watchAfterEnded.status, 403);
  assert.equal(watchAfterEnded.data?.error, "PLUS_REQUIRED");

  const manualGrant = await jsonRequest(
    "/ops/entitlements/grant",
    {
      method: "POST",
      headers: buildOpsHeaders(),
      body: {
        subject: authHeaders["x-auth-subject"],
        email: authHeaders["x-user-email"],
        plan: "plus",
        status: "active",
        source: "manual"
      }
    },
    api.baseUrl
  );
  assert.equal(manualGrant.status, 200);

  const reconciliation = await jsonRequest(
    "/ops/billing/reconciliation?limit=50",
    {
      headers: buildOpsHeaders()
    },
    api.baseUrl
  );
  assert.equal(reconciliation.status, 200);
  const found = (reconciliation.data?.items ?? []).find(
    (row) => row.providerSubscriptionId === baseSubscription.providerSubscriptionId
  );
  assert.ok(found);
  assert.ok(Array.isArray(found.driftFlags));
  assert.ok(found.driftFlags.includes("unexpected_plus_active"));
});
