# Paid Readiness Plan (Builder Sequence)

This sequence is designed to reach the minimum bar for a paid product.
Run prompts in order: A -> B -> C -> D -> E -> F -> G -> H -> I -> J -> K -> L -> M.
Launch-critical note: complete F + H before broad paid rollout.

## Prompt A - Trust + Enforcement

Goal:
Harden identity/entitlements and make free-limit enforcement atomic under concurrency.

Scope:
1) Auth/entitlement hardening:
- Remove Plus inference from user-controlled patterns (email tags like `+plus`, name tags like `[plus]`).
- Keep dev-header auth stub for local development only; do not use user-controlled strings as production entitlement truth.
- Use server-authoritative plan lookup logic only for Plus route gating.

2) Atomic quota reservation in finalize flow:
- Implement a reservation mechanism in `POST /cases/:id/assets/:assetId/finalize` before enqueue.
- Reservation must be atomic and concurrency-safe.
- On enqueue failure, rollback/release reservation so usage is not leaked.
- Ensure finalize is idempotent per asset.

3) Guardrail test expansion:
- Add API tests for:
  - daily cap branch (`FREE_DAILY_UPLOAD_LIMIT_REACHED`)
  - global free OCR kill switch (`FREE_OCR_DISABLED`)
  - concurrent finalize burst (cannot overshoot limits)
- Keep existing free-limit and plus-required tests passing.

Validation:
- `npx tsc --noEmit -p apps/api/tsconfig.json`
- `npx tsc --noEmit -p apps/mobile/tsconfig.json`
- `npx tsc --noEmit -p apps/worker/tsconfig.json`
- `node --test apps/api/tests/*.mjs`

Definition of done:
- No client-controlled entitlement spoof path remains.
- Quota enforcement is atomic under concurrent finalize requests.
- Guardrail contracts are fully covered by tests.

---

## Prompt B - Cost Minimization

Goal:
Reduce OCR spend while preserving deterministic, auditable behavior.

Scope:
1) PDF text-first path:
- Detect embedded/selectable text in PDFs.
- If meaningful text exists, skip Vision OCR and use direct text extraction.
- If not, continue with OCR.
- Emit explicit receipts for selected processing path.

2) Scanned-page-only OCR for PDFs:
- OCR only pages that lack embedded text when feasible.
- If page-level split is not feasible now, keep full-doc fallback and document limitation in coordination logs.

3) Hash-based OCR cache:
- Compute deterministic server-side content hash.
- Reuse prior extraction for same user + identical content + compatible provider/version.
- Add auditable cache-hit receipts that reference source extraction.
- Never trust client-provided hashes.

4) Usage accounting coherence:
- Ensure usage/page-unit logic aligns with OCR path:
  - direct PDF text path should not incur OCR page units
  - cache hits should not double-charge OCR usage

Validation:
- `npx tsc --noEmit -p apps/api/tsconfig.json`
- `npx tsc --noEmit -p apps/worker/tsconfig.json`
- worker/API tests pass, including new cache/text-first tests.

Definition of done:
- Duplicate files do not re-run OCR.
- Digital PDFs skip OCR where possible.
- Receipts clearly show path and cache status.

---

## Prompt C - Device QA + Evidence

Goal:
Prove paid-flow readiness on real app surfaces and close remaining UX risks.

Scope:
1) Execute device QA checklist and update results:
- `coordination/QA_PLUS_DEVICE_CHECKLIST.md` set each row to Pass/Fail with notes.
- Cover:
  - Free-limit hit UX
  - Plus gating UX
  - watch mode
  - consult packet links
  - offline/reconnect
  - language consistency (EN/ES)

2) Capture QA evidence:
- Add screenshot references and repro notes in `coordination/BUILD_STATUS.md`.
- Log defects with severity and expected fix owner.

3) Cleanup pass for copy consistency:
- Ensure calm, non-directive copy across limit and upgrade states.
- Ensure no mixed-language case view content.

Validation:
- `npx tsc --noEmit -p apps/mobile/tsconfig.json`
- any changed API tests still pass.

Definition of done:
- No open P0/P1 defects in free-limit/plus flows.
- QA evidence and pass/fail outcomes are documented.

---

## Prompt D - Launch Readiness Gate

Goal:
Finalize go/no-go readiness for a paid pilot release with tight risk control.

Scope:
1) Paid-readiness verification:
- Validate minimum-bar criteria from completed logs, tests, and QA evidence:
  - trusted entitlement path
  - atomic free-limit enforcement
  - OCR cost minimizers active
  - EN/ES consistency in critical flows
- Produce a short checklist with Pass/Fail per criterion.

2) Residual risk and blocker triage:
- Enumerate any remaining P0/P1 items with owner + fix recommendation.
- Freeze non-critical feature work until P0/P1 is closed or explicitly accepted for pilot.

3) Pilot release controls:
- Confirm operational controls are documented and ready:
  - free OCR kill switch
  - quota env settings
  - budget/usage monitoring points
  - rollback steps

4) Final handoff artifact:
- Create/update `coordination/PAID_LAUNCH_READINESS.md` with:
  - go/no-go recommendation
  - evidence links (tests, screenshots, logs)
  - launch guardrails and first-week monitoring checklist

Validation:
- Ensure latest relevant typechecks/tests still pass.
- Ensure checklist artifacts are complete and internally consistent.

Definition of done:
- Clear Go/No-Go decision with evidence.
- No unresolved unknowns in launch-critical areas.

---

## Prompt E - Operational Monitoring

Goal:
Make usage/cost/reliability monitoring operational and easy to review daily.

Scope:
1) Add API ops metrics endpoint:
- `GET /ops/metrics/summary` with 24h and 7d aggregates for:
  - `FREE_LIMIT_REACHED`
  - `FREE_OCR_DISABLED`
  - `PLUS_REQUIRED`
  - `OCR_RUN` success/fail
  - OCR page-unit totals
  - consult-link create/disable
  - finalize enqueue success/failure

2) Add operator report script:
- `scripts/ops/daily-metrics-report.ps1`
- Pull summary endpoint and print compact daily report.

3) Add threshold warnings:
- Report warns on spikes/failure rates via env-configurable thresholds.
- MVP local warnings only (no external alert provider required).

4) Add ops docs:
- `coordination/OPS_MONITORING.md` with runbook, thresholds, and response actions.

Definition of done:
- Daily monitoring is easy to run and interpret from one script.

---

## Prompt F - Entitlement Source of Truth

Goal:
Replace allowlist-based Plus access with durable server-side entitlement persistence.

Scope:
1) Add persistent entitlement model (DB-backed):
- plan: `free|plus`
- status: `active|revoked|trial`
- start/end timestamps
- source: `manual|billing`

2) Use persisted entitlement for all Plus route gating.
- Keep allowlists only for local/dev fallback.

3) Add operator entitlement tooling:
- grant/revoke/list scripts
- auditable events for entitlement changes

4) Expose current entitlement state via API (`/me` or dedicated endpoint).

Definition of done:
- Production Plus access no longer depends on email/name/env heuristics.
- Entitlements are durable and auditable.

---

## Prompt G - Deadline Push Notifications

Goal:
Implement reliable, calm push reminders for deadline/watch events with user controls.

Scope:
1) Mobile token registration + server persistence per device/user.
2) Notification preferences (opt-in/out; language-aware templates; optional quiet hours).
3) Reminder scheduling for T-14/T-7/T-3/T-1 with dedupe/idempotency.
4) Delivery worker with retries and audit outcomes (`scheduled|sent|failed|suppressed`).
5) Guardrails:
- feature flag `PUSH_NOTIFICATIONS_ENABLED`
- per-user/day send limits
- suppress stale reminders when deadlines change

Definition of done:
- Eligible users receive push reminders.
- Delivery is auditable, deduped, and user-controllable.

---

## Prompt H - Billing Integration

Goal:
Connect real payments to entitlement state so Plus access is automatic and auditable.

Scope:
1) Billing provider integration:
- Implement checkout + subscription lifecycle integration with selected billing provider.

2) Webhook ingestion:
- Add signed webhook endpoint handling subscription events (`create|update|cancel|past_due|payment_failed`).
- Ensure idempotent processing and replay safety.

3) Entitlement mapping:
- Map billing events into persisted entitlement state (Prompt F model).
- Enforce grace-period and failed-payment behaviors explicitly.

4) Operator reconciliation:
- Add admin/operator visibility for billing status vs entitlement status drift.

5) Tests:
- Webhook signature verification tests.
- Webhook idempotency/replay tests.
- Access transition tests on cancel/failure/reactivation.

Definition of done:
- Plus entitlement is billing-driven (not allowlist-driven) for production flows.
- Billing-to-entitlement transitions are auditable and reliable.

---

## Prompt I - Growth + Retention Loop

Goal:
Improve conversion and retention with measurable, calm lifecycle signals after billing launch.

Scope:
1) Funnel instrumentation:
- Track key events:
  - upload started/completed
  - first deadline detected
  - free limit reached
  - paywall viewed
  - checkout started/succeeded/failed

2) In-app lifecycle nudges (calm tone):
- Add user-visible moments:
  - no-change weekly reassurance
  - packet ready
  - new tracked date

3) Experiment hooks:
- Add A/B test flags for pricing/paywall copy variants.

4) Weekly KPI reporting:
- Add report endpoint/script/dashboard for:
  - trial-to-paid conversion
  - day-7 retention
  - % cases with reminders enabled
  - packet share rate

5) Localization parity:
- Ensure EN/ES parity for all growth/retention copy and events.

Definition of done:
- Conversion and retention can be measured weekly with actionable data.
- Iteration on pricing/paywall/lifecycle messaging is experiment-ready.

---

## Prompt J - Case Document Viewer (Premium Trust Foundation)

Goal:
Let users re-open and review uploaded files inside each case so the app behaves like a reliable case file cabinet.

Scope:
1) Case assets list in workspace/case view:
- Show uploaded assets with type, upload timestamp, processing status, and source (camera/file).
- Preserve calm EN/ES labels and avoid mixed-language views.

2) Secure in-app viewer:
- Images: full-screen open, pinch/zoom, pan.
- PDFs: full-screen open, page navigation, zoom.
- Add per-asset open/download actions without exposing cross-case access.

3) Authorization and audit:
- Enforce user ownership on all asset view/download APIs.
- Add auditable events for `asset_view_opened` and `asset_download_requested`.

4) Stability and QA:
- API tests for ownership and unauthorized access denial.
- Mobile QA for image zoom, PDF paging, and viewer close/reopen state.

Definition of done:
- Users can reliably view previously uploaded images/PDFs in-case.
- No ownership bypass path exists.
- EN/ES viewer labels are consistent.

---

## Prompt K - Plain Meaning Translator (Paid Value Anchor)

Goal:
Add a calm, side-by-side legal-jargon explanation view that improves consultation readiness without giving legal advice.

Scope:
1) Side-by-side explanation view:
- Sections: `Original text`, `Plain meaning`, `Why this often matters`, `Commonly prepared items`.
- Generate from extraction/truth-layer structured outputs only.
- No raw-image LLM path and no inferred facts beyond extracted data.

2) Receipts and uncertainty:
- Each explanation row includes source reference (page/snippet when available).
- Include explicit uncertainty labeling when extraction confidence is limited.

3) Localization and tone safety:
- Localize all user-facing labels and explanatory text for EN/ES.
- Spanish phrasing must remain non-directive (`suele`, `a menudo`, `muchas personas optan`), avoid `debe/tiene que`.
- No mixed-language case view.

4) Packaging:
- Free: basic summary + original document viewing.
- Plus: full side-by-side plain-meaning translator and consultation-ready explanation blocks.

5) Validation:
- Typecheck API/mobile/worker.
- Add regression tests for translator payload shape and source-reference presence.
- Add mobile QA evidence for EN and ES translator screens.

Definition of done:
- Users can read legal text in plain language with source-linked receipts.
- Plus value is materially clearer at first use.
- Guardrails (no legal advice, no guessed facts, calm tone) remain intact.

---

## Prompt L - Pricing + Paywall Value Proposition Clarity

Goal:
Make the paid offer easy to understand in under 10 seconds, with one clear promise tied to time, continuity, and reduced prep friction.

Scope:
1) Simplify offer structure:
- Present one primary paid plan (Plus) with a single default price and billing cadence.
- Remove competing/ambiguous plan framing on first conversion surfaces.
- Keep any alternate pricing path hidden from primary funnel unless explicitly enabled by feature flag.

2) Value proposition rewrite (EN/ES):
- Rewrite paywall, upgrade modals, and account billing copy around concrete outcomes:
  - deadline reminders
  - case memory continuity
  - consultation-ready packet prep
  - plain-meaning translation
- Avoid generic "more AI" messaging.
- Keep calm, non-directive, non-legal-advice tone.
- Use `coordination/PAYWALL_COPY_GOLD.md` as the default source copy and keep wording changes minimal unless blocked by UI constraints.

3) Conversion surface consistency:
- Align value bullets across:
  - first-run onboarding plan step
  - free-limit hit modal
  - Plus-required gate modal
  - account/billing screen
- Ensure no contradictory pricing or feature claims between screens.

4) Localization and safety:
- EN/ES parity for all pricing + value text.
- Spanish must avoid directive legal phrasing (`debe`, `tiene que`) and alarmist urgency.
- Preserve explicit boundary: ClearCase provides legal clarity, not legal advice.

5) Measurement hooks:
- Track paywall impression -> checkout start -> checkout success with locale and trigger source.
- Add `paywall_variant` flag support for copy tests without code churn.

Validation:
- `npx tsc --noEmit -p apps/mobile/tsconfig.json`
- any changed API/mobile tests pass.
- Manual QA screenshots for EN and ES paywall + upgrade flows.

Definition of done:
- Users can state what Plus does and why it is paid after one screen.
- Pricing/feature messaging is consistent across key funnels.
- EN/ES messaging is calm, clear, and non-directive.

---

## Prompt M - Final Launch Hardening + QA Evidence Refresh

Goal:
Close remaining launch-critical gaps after H-L and produce a refreshed go/no-go artifact for soft launch.

Scope:
1) Document viewer completion:
- Replace external OS/browser fallback for case documents with true in-app viewing where feasible:
  - images: in-app zoom/pan
  - PDFs: in-app page navigation/zoom
- Keep secure owner-scoped access and existing audit events.
- If a platform requires fallback, make fallback explicit and documented per platform.

2) Billing E2E verification:
- Run and document one full paid flow:
  - free user hits paywall
  - checkout initiated
  - webhook success simulated/received
  - entitlement transitions to Plus
  - Plus-gated feature access succeeds
- Capture failure-path proof for payment failure/past_due -> grace/revoke behavior.

3) Push readiness clarification:
- Keep current push delivery implementation, but document production cutover requirements clearly:
  - provider wiring required
  - env vars/secrets
  - expected audit outcomes and fallback behavior
- Add an explicit launch flag recommendation in ops docs (`PUSH_NOTIFICATIONS_ENABLED` default strategy).

4) Manual device QA evidence (EN/ES):
- Capture screenshots for:
  - paywall sheet EN + ES
  - plain-meaning modal EN + ES
  - document viewer image + PDF
  - post-checkout Plus unlocked state
- Record pass/fail and repro notes in coordination artifacts.

5) Launch artifact refresh:
- Update `coordination/PAID_LAUNCH_READINESS.md` to reflect H-L completion:
  - billing-backed entitlement status
  - updated residual risks
  - updated recommendation (`Go` / `Go with guardrails` / `No-Go`)
- Ensure no stale references remain (e.g., prior “billing not implemented yet” statements).

Validation:
- `npx tsc --noEmit -p apps/api/tsconfig.json`
- `npx tsc --noEmit -p apps/mobile/tsconfig.json`
- `npx tsc --noEmit -p apps/worker/tsconfig.json`
- `node --test apps/api/tests/*.mjs`

Definition of done:
- Launch docs match actual shipped behavior.
- Paid flow is verified end-to-end with evidence.
- Remaining risks are explicit, bounded, and operationally controlled.
