import "dotenv/config";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";
import { Client } from "pg";

const API_BASE = process.env.CLEARCASE_API_BASE || "http://127.0.0.1:3001";
const DATABASE_URL = process.env.DATABASE_URL;

function buildAuthHeaders(seed) {
  return {
    "x-auth-subject": `entitlement-push-${seed}`,
    "x-user-email": `entitlement.push.${seed}@example.com`
  };
}

function buildOpsHeaders() {
  const token = process.env.OPS_ADMIN_TOKEN?.trim() || process.env.OPS_METRICS_TOKEN?.trim();
  if (!token) return {};
  return { "x-ops-token": token };
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

async function withDb(fn) {
  assert.ok(DATABASE_URL, "DATABASE_URL must be set to run entitlement+push API tests.");
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

function randomPort() {
  return 4700 + Math.floor(Math.random() * 400);
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

test("durable entitlement flow and push preference/device/reminder persistence", async (t) => {
  const api = await startApiServer();
  t.after(async () => {
    await api.stop();
  });
  await ensureApiReady(api.baseUrl);
  const seed = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const authHeaders = buildAuthHeaders(seed);
  const opsHeaders = buildOpsHeaders();

  const meInitial = await jsonRequest("/me", { headers: authHeaders }, api.baseUrl);
  assert.equal(meInitial.status, 200);
  assert.equal(meInitial.data?.entitlement?.plan, "free");
  assert.equal(meInitial.data?.entitlement?.isPlus, false);
  assert.equal(meInitial.data?.pushPreferences?.enabled, false);

  const grant = await jsonRequest("/ops/entitlements/grant", {
    method: "POST",
    headers: opsHeaders,
    body: {
      subject: authHeaders["x-auth-subject"],
      email: authHeaders["x-user-email"],
      plan: "plus",
      status: "active",
      source: "manual"
    }
  }, api.baseUrl);
  assert.equal(grant.status, 200);
  assert.equal(grant.data?.effective?.isPlus, true);

  const meAfterGrant = await jsonRequest("/me", { headers: authHeaders }, api.baseUrl);
  assert.equal(meAfterGrant.status, 200);
  assert.equal(meAfterGrant.data?.entitlement?.plan, "plus");
  assert.equal(meAfterGrant.data?.entitlement?.isPlus, true);

  const patchPrefs = await jsonRequest("/me/notification-preferences", {
    method: "PATCH",
    headers: authHeaders,
    body: {
      enabled: true,
      language: "es",
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00"
    }
  }, api.baseUrl);
  assert.equal(patchPrefs.status, 200);
  assert.equal(patchPrefs.data?.pushPreferences?.enabled, true);
  assert.equal(patchPrefs.data?.pushPreferences?.language, "es");
  assert.equal(patchPrefs.data?.pushPreferences?.quietHoursStart, "22:00");
  assert.equal(patchPrefs.data?.pushPreferences?.quietHoursEnd, "07:00");

  const register = await jsonRequest("/me/push-devices/register", {
    method: "POST",
    headers: authHeaders,
    body: {
      deviceId: `device-${seed}`,
      platform: "web",
      token: `token-${seed}`,
      language: "es"
    }
  }, api.baseUrl);
  assert.equal(register.status, 200);
  assert.equal(register.data?.registered, true);

  const createdCase = await jsonRequest("/cases", {
    method: "POST",
    headers: authHeaders,
    body: {
      title: "Reminder sync case"
    }
  }, api.baseUrl);
  assert.equal(createdCase.status, 201);
  const caseId = createdCase.data?.id;
  assert.ok(typeof caseId === "string" && caseId.length > 0);

  await withDb(async (db) => {
    await db.query(
      `UPDATE "Case" SET "earliestDeadline" = NOW() + INTERVAL '20 days', "updatedAt" = NOW() WHERE "id" = $1`,
      [caseId]
    );
  });

  const watchOn = await jsonRequest(`/cases/${caseId}/watch-mode`, {
    method: "POST",
    headers: authHeaders,
    body: { enabled: true }
  }, api.baseUrl);
  assert.equal(watchOn.status, 200);

  const reminderCounts = await withDb(async (db) => {
    const { rows } = await db.query(
      `
        SELECT
          COUNT(*) FILTER (WHERE "status" = 'scheduled')::int AS scheduled_count,
          COUNT(*) FILTER (WHERE "status" = 'suppressed')::int AS suppressed_count
        FROM "DeadlinePushReminder"
        WHERE "caseId" = $1
      `,
      [caseId]
    );
    return rows[0];
  });
  assert.ok(Number(reminderCounts.scheduled_count) >= 1);

  await withDb(async (db) => {
    await db.query(
      `UPDATE "Case" SET "earliestDeadline" = NOW() + INTERVAL '30 days', "updatedAt" = NOW() WHERE "id" = $1`,
      [caseId]
    );
  });

  const watchRefresh = await jsonRequest(`/cases/${caseId}/watch-mode`, {
    method: "POST",
    headers: authHeaders,
    body: { enabled: true }
  }, api.baseUrl);
  assert.equal(watchRefresh.status, 200);

  const staleCounts = await withDb(async (db) => {
    const { rows } = await db.query(
      `
        SELECT COUNT(*)::int AS stale_count
        FROM "DeadlinePushReminder"
        WHERE "caseId" = $1
          AND "status" = 'suppressed'
          AND "reason" = 'stale_deadline'
      `,
      [caseId]
    );
    return Number(rows[0]?.stale_count ?? 0);
  });
  assert.ok(staleCounts >= 1);

  const revoke = await jsonRequest("/ops/entitlements/revoke", {
    method: "POST",
    headers: opsHeaders,
    body: {
      subject: authHeaders["x-auth-subject"],
      email: authHeaders["x-user-email"],
      source: "manual",
      reason: "test_revoke"
    }
  }, api.baseUrl);
  assert.equal(revoke.status, 200);
  assert.equal(revoke.data?.effective?.isPlus, false);
});
