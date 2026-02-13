import "dotenv/config";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";

const API_BASE = process.env.CLEARCASE_API_BASE || "http://127.0.0.1:3001";
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
      "x-auth-subject": `plus-api-test-${seed}`,
      "x-user-email": `plus.user.${seed}@example.com`
    };
  }
  return {
    "x-auth-subject": `free-api-test-${seed}`,
    "x-user-email": `free.user.${seed}@example.com`
  };
}

function buildSeed(tag) {
  return `${tag}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function assertPlusRequired(response) {
  assert.equal(response.status, 403);
  assert.equal(response.data?.error, "PLUS_REQUIRED");
  assert.equal(response.data?.code, "PLUS_REQUIRED");
}

async function createCase(headers, title, baseUrl = API_BASE) {
  const created = await jsonRequest("/cases", {
    method: "POST",
    headers,
    body: { title }
  }, baseUrl);
  assert.equal(created.status, 201);
  const caseId = created.data?.id;
  assert.ok(typeof caseId === "string" && caseId.length > 0);
  return caseId;
}

async function grantPlusByOps(headers, baseUrl = API_BASE) {
  const granted = await jsonRequest("/ops/entitlements/grant", {
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
  }, baseUrl);
  assert.equal(granted.status, 200);
  assert.equal(granted.data?.effective?.isPlus, true);
}

function randomPort() {
  return 4300 + Math.floor(Math.random() * 500);
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
  assert.equal(
    health.status,
    200,
    `API is not reachable at ${baseUrl}. Start API before running this test.`
  );
}

test("PLUS_REQUIRED is enforced on watch-mode for Free and allows Plus", async (t) => {
  const api = await startApiServer();
  t.after(async () => {
    await api.stop();
  });
  await ensureApiReady(api.baseUrl);
  const seed = buildSeed("watch");

  const freeHeaders = buildHeaders(seed, "free");
  const plusHeaders = buildHeaders(seed, "plus");

  const freeCaseId = await createCase(freeHeaders, "Free watch entitlement case", api.baseUrl);
  const plusCaseId = await createCase(plusHeaders, "Plus watch entitlement case", api.baseUrl);
  await grantPlusByOps(plusHeaders, api.baseUrl);

  const freeWatch = await jsonRequest(`/cases/${freeCaseId}/watch-mode`, {
    method: "POST",
    headers: freeHeaders,
    body: { enabled: true }
  }, api.baseUrl);
  assertPlusRequired(freeWatch);

  const plusWatch = await jsonRequest(`/cases/${plusCaseId}/watch-mode`, {
    method: "POST",
    headers: plusHeaders,
    body: { enabled: true }
  }, api.baseUrl);
  assert.equal(plusWatch.status, 200);
  assert.equal(plusWatch.data?.saved, true);
});

test("PLUS_REQUIRED is enforced on consult-link list for Free and allows Plus", async (t) => {
  const api = await startApiServer();
  t.after(async () => {
    await api.stop();
  });
  await ensureApiReady(api.baseUrl);
  const seed = buildSeed("consult-list");

  const freeHeaders = buildHeaders(seed, "free");
  const plusHeaders = buildHeaders(seed, "plus");

  const freeCaseId = await createCase(freeHeaders, "Free consult list case", api.baseUrl);
  const plusCaseId = await createCase(plusHeaders, "Plus consult list case", api.baseUrl);
  await grantPlusByOps(plusHeaders, api.baseUrl);

  const freeList = await jsonRequest(`/cases/${freeCaseId}/consult-packet-links`, {
    method: "GET",
    headers: freeHeaders
  }, api.baseUrl);
  assertPlusRequired(freeList);

  const plusList = await jsonRequest(`/cases/${plusCaseId}/consult-packet-links`, {
    method: "GET",
    headers: plusHeaders
  }, api.baseUrl);
  assert.equal(plusList.status, 200);
  assert.equal(plusList.data?.caseId, plusCaseId);
  assert.ok(Array.isArray(plusList.data?.links));
});

test("PLUS_REQUIRED is enforced on consult-link create for Free and allows Plus", async (t) => {
  const api = await startApiServer();
  t.after(async () => {
    await api.stop();
  });
  await ensureApiReady(api.baseUrl);
  const seed = buildSeed("consult-create");

  const freeHeaders = buildHeaders(seed, "free");
  const plusHeaders = buildHeaders(seed, "plus");

  const freeCaseId = await createCase(freeHeaders, "Free consult create case", api.baseUrl);
  const plusCaseId = await createCase(plusHeaders, "Plus consult create case", api.baseUrl);
  await grantPlusByOps(plusHeaders, api.baseUrl);

  const freeCreate = await jsonRequest(`/cases/${freeCaseId}/consult-packet-links`, {
    method: "POST",
    headers: freeHeaders,
    body: { expiresInDays: 7 }
  }, api.baseUrl);
  assertPlusRequired(freeCreate);

  const plusCreate = await jsonRequest(`/cases/${plusCaseId}/consult-packet-links`, {
    method: "POST",
    headers: plusHeaders,
    body: { expiresInDays: 7 }
  }, api.baseUrl);
  assert.equal(plusCreate.status, 201);
  assert.equal(plusCreate.data?.caseId, plusCaseId);
  assert.ok(typeof plusCreate.data?.id === "string" && plusCreate.data.id.startsWith("lnk_"));
  assert.ok(typeof plusCreate.data?.tokenPreview === "string" && plusCreate.data.tokenPreview.includes("..."));
  assert.equal(plusCreate.data?.status, "active");
  assert.equal(plusCreate.data?.statusReason, "active");
});

test("PLUS_REQUIRED is enforced on consult-link disable for Free and allows Plus", async (t) => {
  const api = await startApiServer();
  t.after(async () => {
    await api.stop();
  });
  await ensureApiReady(api.baseUrl);
  const seed = buildSeed("consult-disable");

  const freeHeaders = buildHeaders(seed, "free");
  const plusHeaders = buildHeaders(seed, "plus");

  const plusCaseId = await createCase(plusHeaders, "Plus consult disable case", api.baseUrl);
  await grantPlusByOps(plusHeaders, api.baseUrl);
  const plusCreate = await jsonRequest(`/cases/${plusCaseId}/consult-packet-links`, {
    method: "POST",
    headers: plusHeaders,
    body: { expiresInDays: 7 }
  }, api.baseUrl);
  assert.equal(plusCreate.status, 201);
  const linkId = plusCreate.data?.id;
  assert.ok(typeof linkId === "string" && linkId.startsWith("lnk_"));

  const freeDisable = await jsonRequest(`/cases/${plusCaseId}/consult-packet-links/${linkId}/disable`, {
    method: "POST",
    headers: freeHeaders,
    body: {}
  }, api.baseUrl);
  assertPlusRequired(freeDisable);

  const plusDisable = await jsonRequest(`/cases/${plusCaseId}/consult-packet-links/${linkId}/disable`, {
    method: "POST",
    headers: plusHeaders,
    body: {}
  }, api.baseUrl);
  assert.equal(plusDisable.status, 200);
  assert.equal(plusDisable.data?.caseId, plusCaseId);
  assert.equal(plusDisable.data?.id, linkId);
  assert.equal(plusDisable.data?.disabled, true);
  assert.equal(plusDisable.data?.status, "disabled");
  assert.equal(plusDisable.data?.statusReason, "disabled");

  const plusDisableAgain = await jsonRequest(`/cases/${plusCaseId}/consult-packet-links/${linkId}/disable`, {
    method: "POST",
    headers: plusHeaders,
    body: {}
  }, api.baseUrl);
  assert.equal(plusDisableAgain.status, 200);
  assert.equal(plusDisableAgain.data?.disabled, true);
});
