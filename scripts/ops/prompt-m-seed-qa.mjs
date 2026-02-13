import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const apiBase = process.env.CLEARCASE_API_BASE?.trim() || "http://127.0.0.1:3001";
const webhookSecret = process.env.BILLING_WEBHOOK_SECRET?.trim() || "promptm-local-secret";
const outDir = path.resolve("output/ops");

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

function authHeaders(subject, email) {
  return {
    "x-auth-subject": subject,
    "x-user-email": email,
    Accept: "application/json"
  };
}

async function requestJson(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { ok: response.ok, status: response.status, body };
}

function signedWebhookHeaders(payloadJson) {
  if (!webhookSecret) {
    return {
      "Content-Type": "application/json",
      Accept: "application/json"
    };
  }
  const sig = crypto.createHmac("sha256", webhookSecret).update(payloadJson).digest("hex");
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "x-billing-signature": `sha256=${sig}`
  };
}

async function createCase(identity, title) {
  const result = await requestJson(`${apiBase}/cases`, {
    method: "POST",
    headers: {
      ...authHeaders(identity.subject, identity.email),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ title })
  });
  if (!result.ok || !result.body?.id) {
    throw new Error(`Create case failed (${result.status}): ${JSON.stringify(result.body)}`);
  }
  return result.body.id;
}

async function startCheckout(identity) {
  const result = await requestJson(`${apiBase}/billing/checkout`, {
    method: "POST",
    headers: {
      ...authHeaders(identity.subject, identity.email),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      plan: "plus_monthly",
      triggerSource: "prompt_m_seed",
      locale: "en"
    })
  });
  if (!result.ok) {
    throw new Error(`Checkout failed (${result.status}): ${JSON.stringify(result.body)}`);
  }
  return result.body;
}

async function applyWebhook(identity, subscriptionId, customerId) {
  const now = new Date();
  const payload = {
    provider: "internal_stub",
    eventId: `evt_prompt_m_seed_${Date.now()}`,
    eventType: "create",
    createdAt: now.toISOString(),
    subscription: {
      providerSubscriptionId: subscriptionId,
      providerCustomerId: customerId,
      status: "active",
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30).toISOString(),
      cancelAtPeriodEnd: false
    },
    user: {
      subject: identity.subject,
      email: identity.email
    }
  };
  const payloadJson = JSON.stringify(payload);
  const result = await requestJson(`${apiBase}/billing/webhooks/subscription`, {
    method: "POST",
    headers: signedWebhookHeaders(payloadJson),
    body: payloadJson
  });
  if (!result.ok) {
    throw new Error(`Webhook failed (${result.status}): ${JSON.stringify(result.body)}`);
  }
  return result.body;
}

async function uploadAsset(identity, caseId, filePath, mimeType, fileName, description) {
  const bytes = fs.readFileSync(filePath);
  const plan = await requestJson(`${apiBase}/cases/${caseId}/assets`, {
    method: "POST",
    headers: {
      ...authHeaders(identity.subject, identity.email),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      fileName,
      mimeType,
      byteSize: bytes.byteLength
    })
  });
  if (!plan.ok || !plan.body?.uploadUrl || !plan.body?.assetId) {
    throw new Error(`Upload plan failed (${plan.status}): ${JSON.stringify(plan.body)}`);
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
    throw new Error(`Upload PUT failed (${uploadRes.status}) for ${fileName}`);
  }

  const finalized = await requestJson(`${apiBase}/cases/${caseId}/assets/${plan.body.assetId}/finalize`, {
    method: "POST",
    headers: {
      ...authHeaders(identity.subject, identity.email),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ userDescription: description })
  });
  if (!finalized.ok) {
    throw new Error(`Finalize failed (${finalized.status}): ${JSON.stringify(finalized.body)}`);
  }
  return plan.body.assetId;
}

async function getMe(identity) {
  const me = await requestJson(`${apiBase}/me`, {
    method: "GET",
    headers: authHeaders(identity.subject, identity.email)
  });
  if (!me.ok) throw new Error(`GET /me failed (${me.status})`);
  return me.body;
}

async function pollPlainMeaning(identity, caseId, timeoutMs = 120000) {
  const start = Date.now();
  let lastRows = [];
  while (Date.now() - start < timeoutMs) {
    const result = await requestJson(`${apiBase}/cases/${caseId}/plain-meaning?language=en`, {
      method: "GET",
      headers: authHeaders(identity.subject, identity.email)
    });
    if (result.ok && Array.isArray(result.body?.rows)) {
      lastRows = result.body.rows;
      if (lastRows.length > 0) return lastRows;
    }
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
  return lastRows;
}

async function main() {
  const seed = `${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${Math.floor(Math.random() * 9000 + 1000)}`;

  const free = {
    subject: `prompt-m-free-${seed}`,
    email: `prompt.m.free.${seed}@example.com`
  };
  const plus = {
    subject: `prompt-m-plus-${seed}`,
    email: `prompt.m.plus.${seed}@example.com`
  };

  const freeCaseId = await createCase(free, `Prompt M Free Case ${seed}`);
  const plusCaseId = await createCase(plus, `Prompt M Plus Case ${seed}`);
  const checkout = await startCheckout(plus);
  const webhook = await applyWebhook(plus, `sub_prompt_m_seed_${seed}`, `cus_prompt_m_seed_${seed}`);
  const me = await getMe(plus);

  const pdfAssetId = await uploadAsset(
    plus,
    plusCaseId,
    path.resolve("testdocs/highanxiety/sample-digital-text.pdf"),
    "application/pdf",
    "prompt-m-sample.pdf",
    "Prompt M sample digital PDF"
  );
  const imageAssetId = await uploadAsset(
    plus,
    plusCaseId,
    path.resolve("testdocs/highanxiety/sample-scanned-page.png"),
    "image/png",
    "prompt-m-sample.png",
    "Prompt M sample scanned image"
  );

  const plainMeaningRows = await pollPlainMeaning(plus, plusCaseId);

  const generatedAt = new Date().toISOString();
  const freeOutput = {
    generatedAt,
    apiBase,
    subject: free.subject,
    email: free.email,
    caseId: freeCaseId
  };
  const plusOutput = {
    generatedAt,
    apiBase,
    subject: plus.subject,
    email: plus.email,
    caseId: plusCaseId,
    checkoutSessionId: checkout.sessionId ?? null,
    checkoutUrl: checkout.checkoutUrl ?? null,
    webhookTransition: webhook.transition ?? null,
    isPlus: Boolean(me?.entitlement?.isPlus),
    entitlementStatus: me?.entitlement?.status ?? null,
    plainMeaningRows: plainMeaningRows.length
  };
  const viewerOutput = {
    generatedAt,
    subject: plus.subject,
    email: plus.email,
    caseId: plusCaseId,
    pdfAssetId,
    imageAssetId,
    pdfFinalized: true,
    imageFinalized: true,
    plainMeaningRows: plainMeaningRows.length
  };

  fs.writeFileSync(path.join(outDir, "prompt-m-free-user.json"), `${JSON.stringify(freeOutput, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(outDir, "prompt-m-plus-checkout-success.json"), `${JSON.stringify(plusOutput, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(outDir, "prompt-m-viewer-assets.json"), `${JSON.stringify(viewerOutput, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({ freeOutput, plusOutput, viewerOutput }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
