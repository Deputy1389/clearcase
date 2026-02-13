# NEXT_STEPS.md

This file is the current authoritative execution plan for launch.
Unlike `SESSION_LOG.md`, this file SHOULD be edited as things change.

---

## Current Phase
Post-Prompt-M launch gating for full-scale release readiness, with pre-revenue OCR spend protection.

---

## Current Product Status (as of 2026-02-13)

1. Billing, entitlement persistence, webhook replay/idempotency, and reconciliation are implemented.
2. Plus value loop is implemented:
   - timeline/memory continuity
   - deadline watch/reminder scheduling
   - plain-meaning translation with receipts
   - consultation packet and sharing
3. Document viewer is implemented with in-app image/PDF handling and explicit fallback where needed.
4. Launch hardening evidence is captured in:
   - `coordination/PAID_LAUNCH_READINESS.md`
   - `coordination/BUILD_STATUS.md`
   - `output/playwright/prompt-m-*.png`
   - `output/ops/prompt-m-billing-e2e.json`
5. Residual operational caveat:
   - push delivery provider is still stubbed (`push_delivery_stub`) and requires production provider wiring before broad enablement.
6. Business guardrail requirement:
   - keep OCR provider spend at or near zero until first paying customers are active.

---

## Full-Scale Launch Gates (Dependency Order)

### Gate A - Revenue Integrity
- Verify billing transitions in production-like environment:
  - checkout start/success
  - create/update/cancel/past_due/payment_failed webhook transitions
  - entitlement state drift monitoring
- Exit criteria:
  - `checkout_success_rate >= 85%`
  - `billing_entitlement_drift <= 0.5%`
  - no open P0 billing defects

### Gate B - Reliability + Cost Control
- Verify OCR pipeline performance and guardrails under load while running in pre-revenue cost-protection mode.
- Confirm kill switch and free limits are enforced and auditable.
- Exit criteria:
  - `ocr_failure_rate <= 3%`
  - queue lag and processing latency within defined SLOs
  - no sustained worker enqueue backlog

### Gate B0 - Pre-Revenue OCR Spend Lock (new hard gate)
- Enforce no-spend default until first paid customers are active:
  - default `OCR_PROVIDER=stub` in all non-production and pre-revenue production environments
  - keep `GLOBAL_FREE_OCR_ENABLED=false` by default for public traffic during pre-revenue
  - allow OCR only via explicit allowlist/feature flag for internal QA and pilot proofs
- Verify PDF text-first + cache paths are still active for zero-cost processing opportunities.
- Exit criteria:
  - expected daily OCR billable units remain near zero
  - audit logs clearly show whether runs are `stub`, `pdf_text_direct`, `cache_reuse`, or paid OCR provider
  - operator can toggle paid OCR on/off without deploy.

### Gate C - Value Loop Proof
- Confirm first-session value loop:
  - upload -> explanation -> next step -> premium value touchpoint
- Exit criteria:
  - paid users engage with Plus features (plain-meaning/watch mode/packet)
  - day-7 retention meets threshold set from pilot baseline

### Gate D - UX/Localization/Support
- Complete device QA for EN/ES and network edge cases.
- Confirm no mixed-language views and no directive Spanish legal phrasing.
- Exit criteria:
  - no open P0/P1 in onboarding/upload/paywall/viewer/plain-meaning/billing
  - support flow and response SLA in place

### Gate E - Progressive Rollout
- Expand gradually:
  - 10% -> 25% -> 50% -> 100%
- Hold each stage for 24-48h with go/no-go checks.
- Automatic rollback if gate metrics exceed thresholds.

---

## Immediate Next Steps (Builder)

1. OCR spend lock implementation (highest priority):
   - add explicit pre-revenue OCR mode env contract and docs
   - ensure `OCR_PROVIDER=stub` + `GLOBAL_FREE_OCR_ENABLED=false` defaults for pre-revenue environments
   - add allowlist/feature-flag path to permit limited paid OCR for internal QA only
   - add an operator report section for daily OCR spend signals and provider path distribution
2. Push provider cutover implementation:
   - replace stub sender with production provider (APNs/FCM or selected vendor)
   - add provider credentials/env validation
   - keep `PUSH_NOTIFICATIONS_ENABLED=false` until staged validation passes
3. Launch dashboard and alert thresholds:
   - finalize daily/weekly KPI outputs
   - add explicit alert thresholds for billing drift, OCR failure, queue lag, and unexpected paid OCR usage
4. Stage-gate rollout tooling:
   - implement rollout stage config + guard checks
   - add operator command/checklist for stage promotion and rollback
5. Full device QA rerun on release candidate:
   - EN/ES paywall, viewer, plain-meaning, checkout, post-checkout unlock
   - offline/reconnect and low-network behavior
6. Go/No-Go packet refresh:
   - update `coordination/PAID_LAUNCH_READINESS.md` with latest metrics snapshot
   - produce final launch recommendation (`soft launch`, `controlled pilot expansion`, or `hold`)

---

## Runtime Commands

Run each in its own terminal from `C:\Clearcase\Clearcase`:

1. `npm run api:start`
2. `npm run worker:start`
3. `npm --prefix apps/mobile run start -- --lan --clear --port 8081`
4. Optional web preview: `npm --prefix apps/mobile run web -- --non-interactive --port 8090`

---

## Notes

- Keep deterministic boundaries:
  - OCR/truth extraction deterministic
  - LLM formatting only from structured truth payload
- Do not commit logs/runtime artifacts or secrets:
  - `.api.log`, `.worker.log`, `.playwright-cli/`, `secrets/`, `*.key.json`
- Keep schema changes explicit and minimal.
