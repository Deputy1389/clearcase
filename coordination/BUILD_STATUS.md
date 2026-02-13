# BUILD_STATUS

Append-only. Newest entry goes at the top.

## [2026-02-13T01:05:40Z] Status
- Completed: Prompt M executed end-to-end (launch hardening + QA evidence refresh).
- Prompt M details:
  - Viewer completion in mobile: image files now render in-app with explicit zoom controls + pan gesture support; PDF files keep in-app page/zoom controls with clear external fallback when device rendering is limited.
  - Added deterministic QA seed script `scripts/ops/prompt-m-seed-qa.mjs` to create free/plus identities, run checkout+webhook success for Plus unlock, upload/finalize PDF+image assets, and wait for plain-meaning rows.
  - Re-ran billing E2E (`scripts/ops/billing-e2e-verify.ps1`) and refreshed `output/ops/prompt-m-billing-e2e.json` with full success+failure transitions.
  - Captured Prompt M manual QA screenshots in `output/playwright/`:
    - `prompt-m-paywall-en.png`
    - `prompt-m-paywall-es.png`
    - `prompt-m-plain-meaning-en.png`
    - `prompt-m-plain-meaning-es.png`
    - `prompt-m-viewer-image.png`
    - `prompt-m-viewer-pdf.png`
    - `prompt-m-plus-unlocked-account.png`
  - Updated capture automation (`scripts/qa/prompt-m-capture.mjs`) for resilient navigation/selectors and browser QA mode with disabled web security to avoid local web CORS noise during screenshot collection.
- In progress: None.
- Files changed (this pass):
  - `apps/mobile/App.tsx`
  - `scripts/qa/prompt-m-capture.mjs`
  - `scripts/ops/prompt-m-seed-qa.mjs`
  - `coordination/CURRENT_TASK.md`
  - `coordination/BUILD_STATUS.md`
  - `coordination/DECISIONS.md`
  - `coordination/BLOCKERS.md`
  - `coordination/PAID_LAUNCH_READINESS.md`
- Tests run + result:
  - `npx tsc --noEmit -p apps/api/tsconfig.json` (pass)
  - `npx tsc --noEmit -p apps/mobile/tsconfig.json` (pass)
  - `npx tsc --noEmit -p apps/worker/tsconfig.json` (pass)
  - `node --test apps/api/tests/*.mjs` (pass, 14 tests)
  - `powershell -ExecutionPolicy Bypass -File scripts/ops/billing-e2e-verify.ps1 -ApiBase http://127.0.0.1:3001 -WebhookSecret promptm-local-secret` (pass; full paid+failure entitlement path)
  - `node scripts/ops/prompt-m-seed-qa.mjs` (pass; Plus unlock + assets + plain meaning rows)
  - `node scripts/qa/prompt-m-capture.mjs` (pass; required screenshot set generated)
- Risks:
  - Push delivery remains stubbed (`push_delivery_stub`) and needs provider wiring before production push rollout.
  - Screenshot automation uses browser security-disabled mode for local web QA; this is evidence tooling only and not production runtime behavior.
- Next step: Await launch decision (`soft launch` / `controlled pilot` / `hold`) using refreshed readiness evidence.

## [2026-02-13T00:23:23Z] Status
- Completed: Prompts H, I, J, K, and L implementation + validation.
- Prompt H details:
  - Finalized billing integration routes and persistence behavior in `apps/api/src/server.ts`: `POST /billing/checkout`, `POST /billing/webhooks/subscription`, `GET /ops/billing/reconciliation`.
  - Added signature verification + replay safety (`BillingWebhookEvent` receipt table), out-of-order handling, billing-to-entitlement transitions (active, cancel/end-of-term, grace-period, ended), and billing reconciliation drift flags.
  - Added billing API coverage in `apps/api/tests/billing.api.test.mjs` for signature rejection, idempotency, transition sequence (create/cancel/past_due/reactivate/end), and access-control behavior after entitlement changes.
- Prompt I details:
  - Added growth/lifecycle ingestion normalization in API via `/events/track` and subtype mapping for `upload_started`, `upload_completed`, `first_deadline_detected`.
  - Kept paywall funnel tracking (`paywall_viewed`, `checkout_started`, `checkout_succeeded`) and `paywall_variant` support.
  - Added weekly KPI operator script `scripts/ops/weekly-growth-kpis.ps1` and npm script `ops:growth-weekly`.
- Prompt J details:
  - Added asset catalog + secure access endpoints:
    - `GET /cases/:id/assets`
    - `GET /cases/:id/assets/:assetId/access?action=view|download`
  - Added ownership enforcement and audit events for `asset_view_opened` and `asset_download_requested`.
  - Added API test coverage in `apps/api/tests/asset-viewer.api.test.mjs`.
  - Added mobile case asset listing with processing/source metadata and open/download actions using signed access URLs.
- Prompt K details:
  - Added Plus-gated plain-meaning endpoint `GET /cases/:id/plain-meaning?language=en|es` with source-linked receipts and uncertainty strings.
  - Added API test coverage in `apps/api/tests/plain-meaning.api.test.mjs` for Plus gating and payload/receipt shape.
  - Added mobile plain-meaning viewer modal and API integration.
- Prompt L details:
  - Simplified conversion to one primary paid plan path in mobile sheet/checkouts.
  - Switched plan activation to billing checkout (`/billing/checkout`) instead of local tier toggles.
  - Updated key conversion copy (EN/ES) for free-limit modal, plus-required prompts, paywall sheet, and account billing card to align with `coordination/PAYWALL_COPY_GOLD.md` intent and legal boundary language.
  - Added paywall impression tracking (`paywall_viewed`) with source + locale + variant.
- Files changed (this pass):
  - `apps/api/src/server.ts`
  - `apps/api/src/lib/uploads.ts`
  - `apps/api/tests/billing.api.test.mjs`
  - `apps/api/tests/asset-viewer.api.test.mjs`
  - `apps/api/tests/plain-meaning.api.test.mjs`
  - `apps/mobile/src/api.ts`
  - `apps/mobile/App.tsx`
  - `scripts/ops/weekly-growth-kpis.ps1`
  - `package.json`
  - `coordination/CURRENT_TASK.md`
  - `coordination/BUILD_STATUS.md`
  - `coordination/DECISIONS.md`
  - `coordination/BLOCKERS.md`
- Tests run + result:
  - `npx tsc --noEmit -p apps/api/tsconfig.json` (pass)
  - `npx tsc --noEmit -p apps/mobile/tsconfig.json` (pass)
  - `npx tsc --noEmit -p apps/worker/tsconfig.json` (pass)
  - `node --test apps/api/tests/*.mjs` (pass, 14 tests)
- Risks:
  - Mobile viewer currently opens signed URLs via OS/browser handlers rather than a fully native in-app PDF pager implementation.
  - Billing checkout uses configured provider path; local environments still require explicit webhook simulation for `checkout_succeeded` entitlement transitions.
- Next step: Run manual mobile QA for EN/ES paywall and plain-meaning/document-view flows and capture screenshots for prompt-level evidence.

## [2026-02-12T23:46:02Z] Status
- Completed: Prompt F + Prompt G implementation.
- Prompt F details:
  - Added durable entitlement persistence with DB table bootstrap (`UserEntitlement`) and server-authoritative gating for all Plus routes.
  - Wired default entitlement seed (`free/active`) in `getOrCreateUser` and exposed entitlement state on `/me`.
  - Added admin/internal entitlement APIs:
    - `GET /ops/entitlements`
    - `POST /ops/entitlements/grant`
    - `POST /ops/entitlements/revoke`
  - Added operator scripts:
    - `scripts/ops/entitlements-list.ps1`
    - `scripts/ops/entitlements-grant.ps1`
    - `scripts/ops/entitlements-revoke.ps1`
  - Added npm scripts:
    - `ops:entitlements:list`
    - `ops:entitlements:grant`
    - `ops:entitlements:revoke`
  - Updated entitlement tests to grant via durable ops endpoint instead of audit subtype heuristics.
- Prompt G details:
  - Added push persistence/bootstrap tables:
    - `UserNotificationPreference`
    - `UserPushDevice`
    - `DeadlinePushReminder`
  - Added user endpoints:
    - `GET /me/notification-preferences`
    - `PATCH /me/notification-preferences`
    - `POST /me/push-devices/register`
  - Added reminder scheduling for T-14/T-7/T-3/T-1 with dedupe keying and stale suppression when deadline changes.
  - Added watch-mode scheduling trigger in API and deadline-sync trigger in worker after truth/replay updates.
  - Added worker reminder delivery loop with retries/backoff, quiet-hours handling, per-user/day send caps, and auditable outcomes (`scheduled|sent|failed|suppressed`) via `push_reminder_delivery`.
  - Added mobile integration:
    - server-backed push preference toggles (enabled + quiet hours)
    - best-effort device registration stub
    - `/me`-driven entitlement state usage (removed `+plus` email marker spoof path).
- In progress: None.
- Files changed: `apps/api/src/server.ts`, `apps/api/tests/plus-required.api.test.mjs`, `apps/api/tests/free-limit.api.test.mjs`, `apps/api/tests/entitlement-push.api.test.mjs`, `apps/worker/src/worker.ts`, `apps/mobile/src/api.ts`, `apps/mobile/App.tsx`, `scripts/ops/entitlements-list.ps1`, `scripts/ops/entitlements-grant.ps1`, `scripts/ops/entitlements-revoke.ps1`, `package.json`, `coordination/CURRENT_TASK.md`, `coordination/BUILD_STATUS.md`, `coordination/DECISIONS.md`, `coordination/BLOCKERS.md`.
- Tests run + result:
  - `npx tsc --noEmit -p apps/api/tsconfig.json` (pass)
  - `npx tsc --noEmit -p apps/worker/tsconfig.json` (pass)
  - `npx tsc --noEmit -p apps/mobile/tsconfig.json` (pass)
  - `node --test apps/api/tests/*.mjs` (pass, 11 tests)
  - `node --test apps/worker/src/lib/ocr.provider.test.ts apps/worker/src/lib/pipeline.regression.test.ts` (pass, 8 tests)
- Risks:
  - Push delivery currently uses a local stub sender (`push_delivery_stub`) and not a production push provider.
  - Reminder processing cadence is tied to worker loop timing and SQS poll interval.
- Next step: If requested, implement Prompt H billing integration so entitlement transitions are webhook-driven.

## [2026-02-12T23:00:48Z] Status
- Completed: Prompt E (Operational Monitoring) implemented end-to-end. Added post-onboarding language-switch reliability in Account settings with explicit EN/ES selector (immediate apply + persistence) and verified EN->ES->EN round-trip behavior with no mixed-language case view. Added internal metrics endpoint `GET /ops/metrics/summary` with 24h and 7d audit-log aggregates for `FREE_LIMIT_REACHED`, `FREE_OCR_DISABLED`, `PLUS_REQUIRED`, OCR success/fail + page-unit totals, consult-link create/disable, and finalize enqueue success/failure including per-hour/day rates. Added ops event audits for plus-required/free-limit/free-ocr-disabled and finalize enqueue failures to make counts operationally visible. Added daily operator script `scripts/ops/daily-metrics-report.ps1` with env-configurable warning thresholds and optional non-zero exit on warning. Added runbook docs at `coordination/OPS_MONITORING.md`.
- In progress: None.
- Files changed: `apps/api/src/server.ts`, `apps/api/tests/free-limit.api.test.mjs`, `apps/api/tests/ops-metrics.api.test.mjs`, `apps/mobile/App.tsx`, `scripts/ops/daily-metrics-report.ps1`, `coordination/OPS_MONITORING.md`, `package.json`, `coordination/CURRENT_TASK.md`, `coordination/BUILD_STATUS.md`, `coordination/DECISIONS.md`, `coordination/BLOCKERS.md`.
- Tests run + result: `npx tsc --noEmit -p apps/api/tsconfig.json` (pass); `npx tsc --noEmit -p apps/mobile/tsconfig.json` (pass); `node --test apps/api/tests/*.mjs` (pass, 10 tests including new ops-metrics suite).
- Manual QA evidence:
  - Language selector visible in settings: `output/playwright/prompt-e-language-selector-settings.png`
  - Post-switch Spanish case view consistency: `output/playwright/prompt-e-language-roundtrip-spanish-cases.png`
  - Reload persistence verified after English switch (Playwright snapshot `page-2026-02-12T22-58-56-104Z.yml` remained English).
- Daily report sample output (`powershell -ExecutionPolicy Bypass -File scripts/ops/daily-metrics-report.ps1 -ApiBase http://127.0.0.1:3001`):
  - `FREE_LIMIT_REACHED: 6 (0.25/h)`
  - `FREE_OCR_DISABLED: 7 (0.29/h)`
  - `PLUS_REQUIRED: 15 (0.63/h)`
  - `OCR_RUN: success=106 fail=3 failRate=2.75% pageUnits=24091`
  - `Consult links: created=42 disabled=23`
  - `Finalize enqueue: success=216 fail=7 failRate=3.14%`
  - Threshold warnings: none.
- Risks: Ops summary relies on audit-event completeness; older history before Prompt E does not include new `plus_required`/`free_*` ops subtype logs.
- Next step: Await next coordination prompt; if requested, add authenticated export/CSV mode for daily metrics.

## [2026-02-12T22:30:55Z] Status
- Completed: Prompt D launch-readiness gate completed. Added `coordination/PAID_LAUNCH_READINESS.md` with evidence-backed recommendation, minimum-bar pass/fail checklist, residual risk triage, pilot guardrails (kill switch + quotas + entitlement controls), first-week monitoring points, and rollback steps. Confirmed no open P0/P1 defects in free-limit/plus flows based on Prompt C QA outcomes and regression tests.
- In progress: None.
- Files changed: `coordination/PAID_LAUNCH_READINESS.md`, `coordination/CURRENT_TASK.md`, `coordination/BUILD_STATUS.md`, `coordination/DECISIONS.md`, `coordination/BLOCKERS.md`.
- Tests run + result: Reused latest green validation from Prompt C (`npx tsc --noEmit -p apps/mobile/tsconfig.json` pass; `node --test apps/api/tests/*.mjs` pass, 9 tests). No additional code changes after those validations.
- Risks: Pilot readiness is acceptable, but broad paid rollout still requires billing-backed entitlement persistence beyond allowlist/audit-event sources.
- Next step: Await user direction; if requested, execute billing-source persistence and production launch hardening tasks.

## [2026-02-12T22:28:37Z] Status
- Completed: Prompt C device QA executed and documented in `coordination/QA_PLUS_DEVICE_CHECKLIST.md` with Pass/Fail + notes for free-limit coverage, plus gating UX, watch mode behavior, consult-link lifecycle, packet history visibility, offline/reconnect, and EN/ES consistency. Captured QA evidence screenshots in `output/playwright/` and completed copy cleanup in mobile to remove mixed-language case-view artifacts (Spanish `Open`/`No deadline detected`), localize case-priority/status labels, localize bottom tabs in ES, and fix Spanish premium-step copy typos (`resumenes`/`paquete` phrasing).
- QA evidence (screenshots):
  - `output/playwright/prompt-c-watch-mode-plus-on.png`
  - `output/playwright/prompt-c-consult-link-active.png`
  - `output/playwright/prompt-c-consult-link-disabled.png`
  - `output/playwright/prompt-c-packet-history-visible.png`
  - `output/playwright/prompt-c-free-lock-preview-en.png`
  - `output/playwright/prompt-c-free-upgrade-modal-en.png`
  - `output/playwright/prompt-c-offline-error-watch.png`
  - `output/playwright/prompt-c-offline-recovered-watch.png`
  - `output/playwright/prompt-c-workspace-spanish-consistent.png`
- Repro notes:
  - Plus watch-mode persistence: toggled on/off in workspace, refreshed app, and verified persisted state/micro-events remained calm.
  - Consult links: created 7-day link in packet modal, verified `ID/tokenPreview/status`, disabled link in UI, and validated repeat-disable idempotency via direct API call with same token.
  - Offline/reconnect: stopped API listener on `:3001`, triggered watch toggle to confirm explicit connectivity message, restarted API, repeated toggle to confirm recovery and no stale lock state.
  - Language consistency: switched app to ES and verified case workspace content no longer mixes EN lock/status/deadline labels.
- Defects logged:
  - `DEF-P2-ES-CASE-MIXED-LABELS` (Severity P2, Owner: Mobile): Spanish workspace showed mixed labels (`Open`, `No deadline detected`); fixed in this pass (`apps/mobile/App.tsx`).
  - `DEF-P3-ES-PREMIUM-TYPO` (Severity P3, Owner: Mobile): Spanish premium-step strings used hybrid terms (`resumentes`, `packet`); fixed in this pass (`apps/mobile/App.tsx`).
  - Open P0/P1 in free-limit/plus flows: none.
- In progress: None.
- Files changed: `apps/mobile/App.tsx`, `coordination/QA_PLUS_DEVICE_CHECKLIST.md`, `coordination/BUILD_STATUS.md`.
- Tests run + result: `npx tsc --noEmit -p apps/mobile/tsconfig.json` (pass); `node --test apps/api/tests/*.mjs` (pass, 9 tests).
- Risks: Plus entitlement in QA requires explicit server-side entitlement seed/allowlist in this MVP build; local plan selection alone does not create billing entitlement records.
- Next step: Run Prompt D from `coordination/PAID_READINESS_PLAN.md` and produce launch readiness go/no-go artifact.

## [2026-02-12T21:26:24Z] Status
- Completed: Prompt A Trust + Enforcement implemented end-to-end. Auth hardening: removed Plus inference from user-controlled email/name patterns, made dev-header auth stub local/dev-only (`CLEARCASE_DEV_HEADER_AUTH_ENABLED`, default off in production), and moved Plus gating to server-authoritative lookup (server allowlists + entitlement audit events `plan_plus_active`/`plan_plus_revoked`). Finalize hardening: `POST /cases/:id/assets/:assetId/finalize` now uses serializable transaction preflight with advisory locks (asset lock for idempotency, user lock for free-tier usage), creates free-tier quota reservation markers before enqueue, enforces monthly/daily limits against processed + reserved usage, and avoids duplicate enqueue per asset (`asset_uploaded_enqueuing`/`asset_uploaded_enqueued`). On queue configuration/send failure, reservation + pending enqueue markers are rolled back/released. Added/updated API tests for daily cap (`FREE_DAILY_UPLOAD_LIMIT_REACHED`), kill switch (`FREE_OCR_DISABLED`), concurrent finalize burst overshoot protection, plus existing free-limit and plus-required suites migrated to server-side entitlement grant events (no `+plus` spoof).
- In progress: None.
- Files changed: `apps/api/src/plugins/auth.ts`, `apps/api/src/server.ts`, `apps/api/tests/plus-required.api.test.mjs`, `apps/api/tests/free-limit.api.test.mjs`, `coordination/CURRENT_TASK.md`, `coordination/BUILD_STATUS.md`, `coordination/DECISIONS.md`, `coordination/BLOCKERS.md`.
- Tests run + result: `npx tsc --noEmit -p apps/api/tsconfig.json` (pass); `npx tsc --noEmit -p apps/mobile/tsconfig.json` (pass); `npx tsc --noEmit -p apps/worker/tsconfig.json` (pass); `node --test apps/api/tests/*.mjs` against fresh API on `http://127.0.0.1:3310` (pass, 9 tests); Prompt B revalidation `node --test apps/worker/src/lib/ocr.provider.test.ts apps/worker/src/lib/pipeline.regression.test.ts` (pass, 8 tests).
- Risks: Entitlement source remains allowlist/audit-event based until dedicated billing-plan persistence is introduced; advisory-lock + audit-log reservation model is effective for atomic enforcement but adds operational dependence on audit-log integrity.
- Next step: Continue with Prompt C (device QA checklist execution and evidence capture) unless new priorities override.

## [2026-02-12T20:49:43Z] Status
- Completed: Added deterministic PDF text-first path in OCR provider (`apps/worker/src/lib/ocr.ts`) that extracts embedded PDF text and returns `processingPath=pdf_text_direct` when meaningful text is present; implemented full-document Vision fallback when embedded text is absent/insufficient with explicit `pdfTextProbe` receipts and limitation marker (`page_level_split_ocr_not_implemented_full_document_ocr_fallback`); added same-user hash-based reuse hook (content SHA-256 from S3 bytes) before OCR call with cache-hit metadata and source extraction reference; updated worker processing (`apps/worker/src/worker.ts`) to perform cache lookup per user, persist `Asset.sha256`, and write expanded OCR audit receipts including `processingPath`, cache hit/miss, and `pageUnitEstimate`; updated API free-limit usage derivation to honor `pageUnitEstimate` from OCR receipts; added/extended tests for PDF direct text skip, OCR fallback for scanned/no-text PDF, and cache-hit reuse (`apps/worker/src/lib/ocr.provider.test.ts`); added smoke fixtures `testdocs/highanxiety/sample-digital-text.pdf`, `testdocs/highanxiety/sample-scanned-page.pdf`, `testdocs/highanxiety/sample-scanned-page.png`; extended real OCR smoke script to run multiple high-anxiety fixtures and assert path expectations.
- In progress: None.
- Files changed: `apps/worker/src/lib/ocr.ts`, `apps/worker/src/worker.ts`, `apps/worker/src/lib/ocr.provider.test.ts`, `apps/api/src/server.ts`, `scripts/mvp/phase8-real-ocr-smoke.ps1`, `testdocs/highanxiety/sample-digital-text.pdf`, `testdocs/highanxiety/sample-scanned-page.pdf`, `testdocs/highanxiety/sample-scanned-page.png`, `package.json`, `package-lock.json`, `coordination/CURRENT_TASK.md`, `coordination/BUILD_STATUS.md`, `coordination/DECISIONS.md`.
- Tests run + result: `npx tsc --noEmit -p apps/api/tsconfig.json` (pass); `npx tsc --noEmit -p apps/worker/tsconfig.json` (pass); `node --test apps/worker/src/lib/ocr.provider.test.ts apps/worker/src/lib/pipeline.regression.test.ts` (pass, 8 tests); `node --test apps/api/tests/*.mjs` against fresh updated API on `http://127.0.0.1:3102` (pass, 6 tests).
- Risks: Page-level split OCR for mixed PDFs is not implemented in this pass; when a PDF has partial embedded text + partial scanned pages, the current deterministic behavior is full-document OCR fallback after text probe.
- Next step: Optional follow-up to implement per-page split OCR for mixed PDFs to reduce OCR calls further while preserving receipts per page.

## [2026-02-12T20:34:29Z] Status
- Completed: Enforced free anti-abuse guardrails in API finalize path before queue enqueue: monthly processed-page limit (`FREE_MONTHLY_PAGE_LIMIT`, default 5), daily free upload limit (`FREE_DAILY_UPLOAD_LIMIT`, default 10), and global free OCR kill switch (`GLOBAL_FREE_OCR_ENABLED`, default true); added stable `FREE_LIMIT_REACHED` payload contract (`error`, `code`, `limit`, `used`, `remaining`, `resetAt`) and `FREE_OCR_DISABLED` contract; implemented usage derivation from auditable OCR run records (`AuditEventType.OCR_RUN` succeeded payload with page-count detection + conservative fallbacks); added mobile handling for `FREE_LIMIT_REACHED` and `FREE_OCR_DISABLED` with calm EN/ES plan-upgrade messaging including usage/reset timing; added API regression tests for free-limit block contract, plus bypass, and blocked-no-enqueue side effect.
- In progress: None.
- Files changed: `apps/api/src/server.ts`, `apps/mobile/App.tsx`, `apps/api/tests/free-limit.api.test.mjs`, `coordination/CURRENT_TASK.md`, `coordination/BUILD_STATUS.md`, `coordination/DECISIONS.md`.
- Tests run + result: `npx tsc --noEmit -p apps/api/tsconfig.json` (pass); `npx tsc --noEmit -p apps/mobile/tsconfig.json` (pass); `npx tsc --noEmit -p apps/worker/tsconfig.json` (pass); `node --test apps/api/tests/*.mjs` against fresh updated API on `http://127.0.0.1:3101` (pass, 6 tests including new free-limit coverage).
- Risks: Free monthly usage is derived from successful OCR audit payload metadata; if an OCR provider omits page count metadata, fallback billing remains conservative at 1 page unit for that run.
- Next step: Device QA pass to verify limit-hit UX copy and plan-sheet flow in mobile with a seeded free-limit scenario.

## [2026-02-12T20:17:25Z] Status
- Completed: Added required first-run language selector screen before onboarding/auth/home routing; hydration now gates to language selection when no saved language and applies selection immediately via persisted preference; replaced onboarding with a 7-screen crisis-focused sequence (welcome/calm framing, does-not-provide-legal-advice boundary, upload guidance, optional context framing, plan choice, receipts+uncertainty orientation, continuity setup); updated mobile value copy across auth/home/workspace/account plan/paywall surfaces to emphasize reduced missed steps and preparation stress with neutral disclaimer language; expanded pricing presentation to show Free, Plus monthly ($7/month), and Plus active-case month ($20/case-month) with neutral cost framing; updated web hero messaging to match the same value/disclaimer/pricing positioning; localized additional workspace/drawer copy to reduce EN/ES mixing in case-facing flows.
- In progress: Manual device verification that a true fresh install/session reset lands on the language selector prior to onboarding content.
- Files changed: `apps/mobile/App.tsx`, `apps/web/src/App.tsx`, `coordination/CURRENT_TASK.md`, `coordination/BUILD_STATUS.md`, `coordination/DECISIONS.md`.
- Tests run + result: `npx tsc --noEmit -p apps/mobile/tsconfig.json` (pass); `npm run api:typecheck` (pass).
- Risks: End-to-end visual verification of the fresh-install language-first gate was validated by flow logic and typecheck but not by running the mobile app interactively in this pass.
- Next step: Run the mobile app, clear app storage/session, and confirm first screen is language selector before onboarding/auth; then capture QA evidence screenshots.

## [2026-02-12T19:57:16Z] Status
- Completed: Implemented real OCR provider path in `apps/worker/src/lib/ocr.ts` with `OCR_PROVIDER=google_vision` and retained `stub` fallback; added S3 byte retrieval + Google Vision document text detection with deterministic structured output metadata; expanded OCR audit fields in worker success path (`providerVersion`, `sourceMetadata`, `providerMetadata`, `rawTextLength`) and added explicit `OCR_RUN` failure audit payloads in OCR stage before retry handling; added provider/unit tests (`apps/worker/src/lib/ocr.provider.test.ts`); added real-document smoke script `scripts/mvp/phase8-real-ocr-smoke.ps1` and optional aggregator hook via `scripts/mvp/smoke.ps1 -IncludeRealOcr`; added a real file fixture in `testdocs/highanxiety/sample-smoke-image.png`; added `@google-cloud/vision` dependency.
- In progress: Manual execution of real OCR smoke (`phase8-real-ocr-smoke.ps1`) in a fully configured cloud env.
- Files changed: `apps/worker/src/lib/ocr.ts`, `apps/worker/src/worker.ts`, `apps/worker/src/lib/ocr.provider.test.ts`, `scripts/mvp/phase8-real-ocr-smoke.ps1`, `scripts/mvp/smoke.ps1`, `package.json`, `package-lock.json`, `testdocs/highanxiety/sample-smoke-image.png`, `coordination/CURRENT_TASK.md`, `coordination/BUILD_STATUS.md`, `coordination/DECISIONS.md`.
- Tests run + result: `npm run worker:typecheck` (pass); `npm run api:typecheck` (pass); `node --test apps/worker/src/lib/ocr.provider.test.ts` (pass, 4 tests); `node --test apps/worker/src/lib/pipeline.regression.test.ts` (pass, 2 tests).
- Risks: Real OCR runtime still depends on valid `GOOGLE_APPLICATION_CREDENTIALS` + `S3_BUCKET`/AWS creds in environment; fixture image is minimal and may produce empty OCR text while still validating end-to-end processing path.
- Next step: Run `powershell -ExecutionPolicy Bypass -File scripts/mvp/phase8-real-ocr-smoke.ps1 -StartApi -StartWorker` in an environment with Google Vision credentials and record results.

## [2026-02-12T19:13:21Z] Status
- Completed: Added Free-plan lock-state UX for Plus-only watch mode and consult-link capabilities in Workspace; replaced Plus-route `403 PLUS_REQUIRED` handling with a consistent upgrade explainer + CTA path in mobile; completed value-moment copy pass with concrete outcomes (tracked date count, reminder schedule status, readiness trajectory message, packet/share status); expanded API entitlement coverage to Free vs Plus on all Plus-only routes; added `coordination/QA_PLUS_DEVICE_CHECKLIST.md`.
- In progress: None.
- Files changed: `apps/mobile/App.tsx`, `apps/api/tests/plus-required.api.test.mjs`, `coordination/QA_PLUS_DEVICE_CHECKLIST.md`, `coordination/CURRENT_TASK.md`, `coordination/BUILD_STATUS.md`, `coordination/DECISIONS.md`, `NEXT_STEPS.md`.
- Tests run + result: `npx tsc --noEmit -p apps/api/tsconfig.json` (pass); `npx tsc --noEmit -p apps/mobile/tsconfig.json` (pass); `npx tsc --noEmit -p apps/worker/tsconfig.json` (pass); `node --test apps/api/tests/plus-required.api.test.mjs` (pass, 4 tests).
- Risks: Lock-state UX depends on local plan-tier state in mobile while hard enforcement remains server-side entitlement checks; device QA checklist is created but still marked pending until manual run.
- Next step: Execute the device QA checklist and convert each row from Pending to Pass/Fail with notes.

## [2026-02-12T18:59:05Z] Status
- Completed: Enforced server-side Plus checks with stable `PLUS_REQUIRED` responses for `POST /cases/:id/watch-mode`, `GET/POST /cases/:id/consult-packet-links`, and `POST /cases/:id/consult-packet-links/:token/disable`; hardened consult-link token normalization/validation and list redaction to `id` + `tokenPreview`; made disable idempotent and auditable with `consult_packet_link_disable_requested`; replaced directive Spanish mobile phrasing patterns (`Revisa...`) with neutral alternatives; added `PLUS_REQUIRED` API coverage and made test identities unique per run to avoid false collisions.
- In progress: None.
- Files changed: `apps/api/src/server.ts`, `apps/mobile/src/api.ts`, `apps/mobile/App.tsx`, `apps/worker/src/lib/formatter.ts`, `apps/worker/src/worker.ts`, `apps/api/tests/plus-required.api.test.mjs`, `coordination/CURRENT_TASK.md`, `coordination/BUILD_STATUS.md`, `coordination/DECISIONS.md`, `NEXT_STEPS.md`.
- Tests run + result: `npx tsc --noEmit -p apps/api/tsconfig.json` (pass); `npx tsc --noEmit -p apps/mobile/tsconfig.json` (pass); `npx tsc --noEmit -p apps/worker/tsconfig.json` (pass); `node --test apps/api/tests/plus-required.api.test.mjs` (pass, 1 test).
- Risks: Entitlement source is still metadata/header-driven for MVP and not billing-backed; `shareUrl` creation response intentionally includes full token for sharing.
- Next step: Perform device QA for Plus flows (watch mode, lawyer-ready packet history, consult-link create/disable) and capture acceptance screenshots.

## [YYYY-MM-DDTHH:MM:SSZ] Status
- Completed:
- In progress:
- Files changed:
- Tests run + result:
- Risks:
- Next step:


