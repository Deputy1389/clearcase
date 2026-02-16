import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const apiBase = process.env.CLEARCASE_API_BASE?.trim() || "http://127.0.0.1:3001";
const outDir = path.resolve("output/ops");
const fixturesPath = path.resolve("scripts", "ops", "mock-legal-fixtures.json");
const generatorPath = path.resolve("scripts", "ops", "generate-realistic-mock-legal-cases.py");

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const identity = {
  subject: "mobile-test",
  email: "test@test.com"
};

const fileExtToMime = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg"
};

function loadFixtures() {
  const raw = fs.readFileSync(fixturesPath, "utf8");
  return JSON.parse(raw);
}

function authHeaders() {
  return {
    "x-auth-subject": identity.subject,
    "x-user-email": identity.email,
    Accept: "application/json"
  };
}

async function requestJson(url, init = {}) {
  const res = await fetch(url, init);
  const text = await res.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  return { ok: res.ok, status: res.status, body };
}

async function createCase(title) {
  const result = await requestJson(`${apiBase}/cases`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ title })
  });
  return result.body.id;
}

async function setCaseClassification(caseId, documentType) {
  await requestJson(`${apiBase}/cases/${caseId}/classification`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ documentType })
  });
}

async function ensurePlusEntitlement() {
  await requestJson(`${apiBase}/ops/entitlements/grant`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      subject: identity.subject,
      email: identity.email,
      plan: "plus",
      status: "active",
      source: "manual"
    })
  });
}

async function uploadAndFinalize(caseId, filePath, userDescription) {
  const fileName = path.basename(filePath);
  const mimeType = fileExtToMime[path.extname(fileName).toLowerCase()] || "application/octet-stream";
  const bytes = fs.readFileSync(filePath);

  const plan = await requestJson(`${apiBase}/cases/${caseId}/assets`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ fileName, mimeType, byteSize: bytes.byteLength })
  });

  await fetch(plan.body.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": mimeType, ...(plan.body.uploadHeaders || {}) },
    body: bytes
  });

  await requestJson(`${apiBase}/cases/${caseId}/assets/${plan.body.assetId}/finalize`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ userDescription })
  });
  return plan.body.assetId;
}

async function main() {
  const fixtures = loadFixtures();
  const runTag = "SEED";
  const docsDir = path.resolve("testdocs", "mock-legal-cases");
  
  console.log("Seeding test@test.com...");
  await ensurePlusEntitlement();

  for (const fixture of fixtures.slice(0, 5)) {
    const filePath = path.join(docsDir, fixture.fileName);
    if (!fs.existsSync(filePath)) {
        console.warn(`File missing: ${filePath}. Skipping.`);
        continue;
    }
    const title = fixture.caseTitle;
    const caseId = await createCase(title);
    await uploadAndFinalize(caseId, filePath, fixture.description);
    await setCaseClassification(caseId, fixture.documentType);
    console.log(`Seeded: ${title}`);
  }
  console.log("Done seeding.");
}

main().catch(console.error);
