import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const appUrl = "http://127.0.0.1:19007";
const apiBase = "http://127.0.0.1:3001";
const outDir = path.resolve("output/playwright");

const free = JSON.parse(fs.readFileSync("output/ops/prompt-m-free-user.json", "utf8"));
const plus = JSON.parse(fs.readFileSync("output/ops/prompt-m-plus-checkout-success.json", "utf8"));

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

function identityHeaders(identity) {
  return {
    "x-auth-subject": identity.subject,
    "x-user-email": identity.email,
    Accept: "application/json"
  };
}

async function apiJson(pathname, identity) {
  const response = await fetch(`${apiBase}${pathname}`, {
    headers: identityHeaders(identity)
  });
  if (!response.ok) {
    throw new Error(`API ${pathname} failed (${response.status})`);
  }
  return response.json();
}

async function bootstrapIdentity(page, identity, language) {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ apiBaseInner, subject, email, languageInner }) => {
    localStorage.setItem("clearcase.mobile.apiBase", apiBaseInner);
    localStorage.setItem("clearcase.mobile.subject", subject);
    localStorage.setItem("clearcase.mobile.email", email);
    localStorage.setItem("clearcase.mobile.onboarded", "1");
    localStorage.setItem("clearcase.mobile.language", languageInner);
    localStorage.removeItem("clearcase.mobile.offlineSession");
  }, {
    apiBaseInner: apiBase,
    subject: identity.subject,
    email: identity.email,
    languageInner: language
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4200);
}

async function clickByRoleOrText(page, nameMatchers, timeoutMs = 5000) {
  for (const matcher of nameMatchers) {
    const buttonLocator = page.getByRole("button", { name: matcher }).first();
    if ((await buttonLocator.count()) > 0) {
      await buttonLocator.click({ timeout: timeoutMs });
      return;
    }
  }
  for (const matcher of nameMatchers) {
    const textLocator = page.getByText(matcher).first();
    if ((await textLocator.count()) > 0) {
      await textLocator.click({ timeout: timeoutMs });
      return;
    }
  }
  throw new Error(`Unable to click target: ${nameMatchers.map((item) => item.toString()).join(", ")}`);
}

async function openWorkspaceForCase(page, identity, language) {
  await clickByRoleOrText(page, language === "es" ? [/^Casos$/i] : [/^Cases$/i]);
  await page.waitForTimeout(1300);

  const detail = identity.caseId ? await apiJson(`/cases/${identity.caseId}`, identity) : null;
  const caseTitle = detail?.title ?? null;
  if (caseTitle) {
    const caseText = page.getByText(caseTitle).first();
    if ((await caseText.count()) > 0) {
      await caseText.click();
      await page.waitForTimeout(2000);
      return;
    }
  }

  const fallbackCard = page.getByText(/Pending detection|Deteccion pendiente/i).first();
  if ((await fallbackCard.count()) > 0) {
    await fallbackCard.click();
    await page.waitForTimeout(2000);
    return;
  }

  const anyCase = page.getByText(/Untitled case|Caso sin titulo/i).first();
  if ((await anyCase.count()) > 0) {
    await anyCase.click();
    await page.waitForTimeout(2000);
    return;
  }

  throw new Error("Could not open a case workspace");
}

async function closeSheet(page, language) {
  await clickByRoleOrText(
    page,
    language === "es" ? [/^Cerrar$/i, /^Ahora no$/i] : [/^Close$/i, /^Back$/i],
    3000
  );
  await page.waitForTimeout(600);
}

async function captureViewerShots(page, identity) {
  let capturedPdf = false;
  let capturedImage = false;

  for (let index = 0; index < 6; index += 1) {
    await bootstrapIdentity(page, identity, "en");
    await openWorkspaceForCase(page, identity, "en");
    await page.getByText(/Case timeline/i).first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);

    const openButtons = page.getByText(/^Open$/i);
    const count = await openButtons.count();
    console.log(`[viewer] open button count=${count} index=${index}`);
    if (index >= count) break;
    await openButtons.nth(index).click();
    await page.waitForTimeout(2200);

    const isPdf = (await page.getByText(/^Page \+$/i).count()) > 0 || (await page.getByText(/^Page -$/i).count()) > 0;
    console.log(`[viewer] detected type=${isPdf ? "pdf" : "image"} index=${index}`);

    if (isPdf && !capturedPdf) {
      await page.screenshot({ path: path.join(outDir, "prompt-m-viewer-pdf.png"), fullPage: true });
      capturedPdf = true;
    } else if (!isPdf && !capturedImage) {
      await page.screenshot({ path: path.join(outDir, "prompt-m-viewer-image.png"), fullPage: true });
      capturedImage = true;
    }

    if (capturedPdf && capturedImage) return;
  }

  if (!capturedPdf) {
    throw new Error("Could not capture PDF viewer screenshot");
  }
  if (!capturedImage) {
    throw new Error("Could not capture image viewer screenshot");
  }
}

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-web-security", "--disable-features=IsolateOrigins,site-per-process"]
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  // Paywall EN
  await bootstrapIdentity(page, free, "en");
  await openWorkspaceForCase(page, free, "en");
  await page.getByText(/ClearCase Plus Preview/i).first().scrollIntoViewIfNeeded();
  await clickByRoleOrText(page, [/^Start Plus$/i, /Upgrade to Plus/i]);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outDir, "prompt-m-paywall-en.png"), fullPage: true });
  await closeSheet(page, "en");

  // Paywall ES
  await bootstrapIdentity(page, free, "es");
  await openWorkspaceForCase(page, free, "es");
  await page.getByText(/Vista previa de ClearCase Plus/i).first().scrollIntoViewIfNeeded();
  await clickByRoleOrText(page, [/^Iniciar Plus$/i, /Mejorar a Plus/i]);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outDir, "prompt-m-paywall-es.png"), fullPage: true });
  await closeSheet(page, "es");

  // Plain meaning EN
  await bootstrapIdentity(page, plus, "en");
  await openWorkspaceForCase(page, plus, "en");
  await clickByRoleOrText(page, [/Open plain meaning view/i]);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outDir, "prompt-m-plain-meaning-en.png"), fullPage: true });
  await closeSheet(page, "en");

  // Plain meaning ES
  await bootstrapIdentity(page, plus, "es");
  await openWorkspaceForCase(page, plus, "es");
  await clickByRoleOrText(page, [/Abrir vista de significado simple/i]);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outDir, "prompt-m-plain-meaning-es.png"), fullPage: true });
  await closeSheet(page, "es");

  // Viewer screenshots (EN)
  await captureViewerShots(page, plus);

  // Plus unlocked state after checkout success
  await bootstrapIdentity(page, plus, "en");
  await clickByRoleOrText(page, [/^Account$/i]);
  await page.waitForTimeout(1300);
  await page.screenshot({ path: path.join(outDir, "prompt-m-plus-unlocked-account.png"), fullPage: true });

  await context.close();
  await browser.close();
}

run().catch((error) => {
  console.error(error);
  fs.writeFileSync(path.join(outDir, "prompt-m-capture-error.txt"), String(error?.stack || error), "utf8");
  process.exit(1);
});
