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
  subject: "clearcase-test-account",
  email: "clearcase.test.account@example.com"
};

const fileExtToMime = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg"
};

function loadFixtures() {
  const raw = fs.readFileSync(fixturesPath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`Fixture file must be a JSON array: ${fixturesPath}`);
  }

  const fixtures = parsed.map((row, index) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error(`Invalid fixture at index ${index}`);
    }
    const fixture = row;
    if (
      typeof fixture.documentType !== "string" ||
      typeof fixture.caseTitle !== "string" ||
      typeof fixture.fileName !== "string" ||
      typeof fixture.description !== "string"
    ) {
      throw new Error(`Fixture ${index} is missing required string fields.`);
    }
    return {
      documentType: fixture.documentType.trim(),
      caseTitle: fixture.caseTitle.trim(),
      fileName: fixture.fileName.trim(),
      description: fixture.description.trim()
    };
  });

  if (fixtures.length === 0) {
    throw new Error(`No fixtures found in ${fixturesPath}`);
  }
  return fixtures;
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
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { ok: res.ok, status: res.status, body };
}

async function createCase(title) {
  const result = await requestJson(`${apiBase}/cases`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ title })
  });
  if (!result.ok || !result.body?.id) {
    throw new Error(`Create case '${title}' failed (${result.status}): ${JSON.stringify(result.body)}`);
  }
  return result.body.id;
}

async function setCaseClassification(caseId, documentType) {
  const result = await requestJson(`${apiBase}/cases/${caseId}/classification`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ documentType })
  });
  if (!result.ok) {
    throw new Error(
      `Set classification '${documentType}' for case '${caseId}' failed (${result.status}): ${JSON.stringify(result.body)}`
    );
  }
}

async function ensurePlusEntitlement() {
  const result = await requestJson(`${apiBase}/ops/entitlements/grant`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      subject: identity.subject,
      email: identity.email,
      plan: "plus",
      status: "active",
      source: "manual"
    })
  });
  if (!result.ok) {
    throw new Error(`Could not grant Plus entitlement (${result.status}): ${JSON.stringify(result.body)}`);
  }
}

function ensureMockFixtureDocs(runTag) {
  const docsDir = path.resolve("testdocs", "mock-legal-cases");
  fs.mkdirSync(docsDir, { recursive: true });
  const result = spawnSync(
    "python",
    [
      generatorPath,
      "--fixtures",
      fixturesPath,
      "--out-dir",
      docsDir,
      "--run-tag",
      runTag,
      "--recipient-name",
      "Xavier Smooth"
    ],
    { stdio: "inherit" }
  );
  if (result.status !== 0) {
    throw new Error("Realistic fixture PDF generation failed. See output above.");
  }
  return docsDir;
}

async function uploadAndFinalize(caseId, filePath, userDescription) {
  const fileName = path.basename(filePath);
  const mimeType = fileExtToMime[path.extname(fileName).toLowerCase()] || "application/octet-stream";
  const bytes = fs.readFileSync(filePath);

  const plan = await requestJson(`${apiBase}/cases/${caseId}/assets`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      fileName,
      mimeType,
      byteSize: bytes.byteLength
    })
  });
  if (!plan.ok || !plan.body?.uploadUrl || !plan.body?.assetId) {
    throw new Error(`Upload plan for '${fileName}' failed (${plan.status}): ${JSON.stringify(plan.body)}`);
  }

  const uploadRes = await fetch(plan.body.uploadUrl, {
    method: plan.body.uploadMethod || "PUT",
    headers: {
      "Content-Type": mimeType,
      ...(plan.body.uploadHeaders || {})
    },
    body: bytes
  });
  if (!uploadRes.ok) {
    throw new Error(`Upload of '${fileName}' failed (${uploadRes.status})`);
  }

  const finalized = await requestJson(`${apiBase}/cases/${caseId}/assets/${plan.body.assetId}/finalize`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ userDescription })
  });
  if (!finalized.ok) {
    throw new Error(`Finalize of '${fileName}' failed (${finalized.status}): ${JSON.stringify(finalized.body)}`);
  }
  return plan.body.assetId;
}

async function main() {
  const fixtures = loadFixtures();
  const runTag = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const docsRoot = ensureMockFixtureDocs(runTag);
  await ensurePlusEntitlement();

  const summary = [];
  for (const fixture of fixtures) {
    const filePath = path.join(docsRoot, fixture.fileName);
    const title = `[${runTag}] ${fixture.caseTitle}`;
    const caseId = await createCase(title);
    const assetId = await uploadAndFinalize(caseId, filePath, fixture.description);
    await setCaseClassification(caseId, fixture.documentType);
    summary.push({
      caseTitle: title,
      documentType: fixture.documentType,
      caseId,
      assetId,
      filePath
    });
    console.log(
      `Case ${title} (${fixture.documentType}) -> case ${caseId}, asset ${assetId}, file ${path.relative(".", filePath)}`
    );
  }

  fs.writeFileSync(
    path.join(outDir, "test-account-cases.json"),
    `${JSON.stringify({ identity, generatedAt: new Date().toISOString(), summary }, null, 2)}\n`,
    "utf8"
  );
  console.log(`Test account data written to ${path.join(outDir, "test-account-cases.json")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
