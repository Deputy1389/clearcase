# DECISIONS

## [2026-02-13T01:05:40Z] Decision
- Decision: Keep PDF viewing in embedded WebView with explicit page/zoom controls, and implement image viewing as native in-app zoom/pan (Image + gesture pan + reset controls) with explicit external fallback action.
- Reason: Prompt M requires true in-app viewing behavior where feasible, plus deterministic fallback guidance when rendering is device-limited.
- Alternatives considered: Keep all formats in WebView-only behavior; force all opens to external browser.
- Impact: Viewer UX now satisfies launch requirements for in-app inspection while preserving reliability escape hatch.

## [2026-02-13T01:05:40Z] Decision
- Decision: Introduced deterministic Prompt M QA seeding (`scripts/ops/prompt-m-seed-qa.mjs`) and screenshot automation hardening (`scripts/qa/prompt-m-capture.mjs`) as repeatable evidence generation tools.
- Reason: Launch-readiness evidence needed to be reproducible and auditable across free/paywall/Plus/viewer/plain-meaning flows.
- Alternatives considered: Manual-only setup per run; ad-hoc CLI commands without repeatable script contract.
- Impact: QA evidence can be regenerated consistently with known identities/cases and linked in readiness docs.

## [2026-02-13T01:05:40Z] Decision
- Decision: Production push rollout recommendation remains staged: keep `PUSH_NOTIFICATIONS_ENABLED=false` in first paid rollout until provider wiring replaces `push_delivery_stub`; then enable for a constrained cohort and expand.
- Reason: Current push path is auditable and scheduler-ready, but outbound delivery is still stubbed and not provider-backed.
- Alternatives considered: Enable push globally at launch with stub path; block launch until full push provider integration.
- Impact: Paid launch can proceed without exposing users to unreliable push behavior, while preserving a safe cutover path.

## [2026-02-13T00:23:23Z] Decision
- Decision: Billing webhook processing now records idempotent receipts and enforces signed payload validation when `BILLING_WEBHOOK_SECRET` is configured, with out-of-order event suppression by `lastEventCreatedAt`.
- Reason: Prompt H requires deterministic, replay-safe, auditable billing-driven entitlement transitions.
- Alternatives considered: Stateless webhook processing without stored receipts; signature-optional processing even when secret is set.
- Impact: Duplicate/replayed and stale billing events do not double-apply entitlement transitions, and webhook authenticity can be enforced in production.

## [2026-02-13T00:23:23Z] Decision
- Decision: Added dedicated owner-scoped document access endpoints using presigned download URLs (`/cases/:id/assets`, `/cases/:id/assets/:assetId/access`) and explicit audit subtypes (`asset_view_opened`, `asset_download_requested`).
- Reason: Prompt J requires secure re-open/download document behavior with auditable access and no cross-case exposure.
- Alternatives considered: Returning raw S3 keys to client; relying only on existing case-detail payload for asset access.
- Impact: Document access is now explicit, traceable, and ownership-enforced at API level.

## [2026-02-13T00:23:23Z] Decision
- Decision: Plain-meaning translation is delivered as a Plus-gated API payload generated from extraction text only, with mandatory receipts + uncertainty fields and EN/ES localization.
- Reason: Prompt K requires materially clear paid value without legal-advice drift or inferred facts beyond extraction outputs.
- Alternatives considered: Free-tier translator access; generated explanations without source receipts.
- Impact: Translator output is traceable and bounded to extracted text, and Plus differentiation is explicit.

## [2026-02-13T00:23:23Z] Decision
- Decision: Mobile conversion flow now uses one primary paid plan and server checkout (`/billing/checkout`) instead of local plan toggles; paywall copy on key surfaces was aligned to Gold positioning and boundary language.
- Reason: Prompt L requires clear pricing/value messaging and billing-backed conversion behavior.
- Alternatives considered: Keep multiple competing plan options in first conversion surface; keep local non-billing “plan activate” UX.
- Impact: Upgrade path now maps to real billing flow and more consistent value messaging across EN/ES conversion surfaces.

## [2026-02-12T23:46:02Z] Decision
- Decision: Plus access is now driven by persisted `UserEntitlement` records (`plan/status/source/start/end`) with allowlists retained only as non-production fallback (`CLEARCASE_ALLOWLIST_FALLBACK`).
- Reason: Prompt F requires durable, auditable entitlement truth that does not depend on email/name heuristics.
- Alternatives considered: Continue audit-subtype entitlement inference (`plan_plus_active`) or client marker flows.
- Impact: Production Plus route gating no longer depends on mutable user strings; grant/revoke transitions are durable and queryable.

## [2026-02-12T23:46:02Z] Decision
- Decision: Added internal entitlement operator APIs and scripts (`/ops/entitlements`, `/ops/entitlements/grant`, `/ops/entitlements/revoke`; PowerShell list/grant/revoke scripts).
- Reason: Prompt F explicitly requires operator tooling with auditable entitlement changes.
- Alternatives considered: Direct SQL-only operator workflow; deferring entitlement tooling until billing integration.
- Impact: Entitlement management is now operational from API/scripts and emits explicit `plan_entitlement_changed` audit payloads.

## [2026-02-12T23:46:02Z] Decision
- Decision: Implemented deadline push reminders with DB-backed scheduling (`DeadlinePushReminder`) and worker-side delivery/retry loop, including calm templates, quiet-hours suppression, per-user/day caps, stale-deadline suppression, and outcome audits.
- Reason: Prompt G requires reliable, deduped, user-controlled reminders with auditable `scheduled|sent|failed|suppressed` outcomes and guardrails.
- Alternatives considered: SQS-delayed scheduling for all reminders (insufficient for >15 minute horizon), immediate-send-only notifications, external push provider integration in this pass.
- Impact: Reminder lifecycle is deterministic/auditable now, with feature-flag control (`PUSH_NOTIFICATIONS_ENABLED`) and readiness for later provider swap-in.

## [2026-02-12T23:46:02Z] Decision
- Decision: Removed mobile `+plus` email-marker path from auth headers and shifted plan display to server `/me` entitlement state.
- Reason: Client marker paths conflict with entitlement source-of-truth hardening and were causing false expectations in premium flow testing.
- Alternatives considered: Keep client-side Plus marker + local-plan unlock behavior.
- Impact: Mobile premium status now aligns with server entitlement truth; local plan selection no longer spoofs access.

## [2026-02-12T23:00:48Z] Decision
- Decision: Added internal ops summary endpoint (`GET /ops/metrics/summary`) backed by audit-log aggregation for 24h and 7d windows, with optional token guard (`OPS_METRICS_TOKEN`) and explicit rate fields.
- Reason: Prompt E requires daily operational visibility for usage, reliability, and cost indicators without external monitoring dependencies.
- Alternatives considered: External metrics stack integration in this pass; ad-hoc SQL-only operator workflow.
- Impact: Operators can query a single deterministic endpoint for free-limit pressure, OCR reliability, consult-link activity, and finalize enqueue health.

## [2026-02-12T23:00:48Z] Decision
- Decision: Replaced Account language alert picker with an always-visible EN/ES selector in settings that updates language immediately and persists to storage.
- Reason: Users must be able to change language after onboarding and not be trapped by first-run selection.
- Alternatives considered: Keep Alert-based language picker; require sign-out/restart to apply language.
- Impact: Language switching is explicit, accessible, immediate, and persistent across reloads/restarts; manual QA confirms EN<->ES round-trip consistency in case views.

## [2026-02-12T22:30:55Z] Decision
- Decision: Launch recommendation set to "Go for controlled paid pilot" with cohort-limited rollout and explicit operational guardrails.
- Reason: Prompt A/B/C acceptance criteria are satisfied (trusted entitlement checks, atomic quota enforcement, OCR cost controls, and EN/ES critical-flow QA), and no open P0/P1 defects remain in free-limit/plus flows.
- Alternatives considered: Full public paid launch now; no-go until billing-grade entitlement persistence is implemented.
- Impact: Pilot can proceed with close monitoring, while billing-backed entitlement persistence remains a required precondition for broader paid release.

## [2026-02-12T21:26:24Z] Decision
- Decision: Removed Plus entitlement inference from user-controlled identity patterns (`+plus` email tags / `[plus]` name tags) and switched Plus gating to server-authoritative plan lookup only (env allowlists + entitlement audit events).
- Reason: Client-controlled pattern matching is spoofable and fails paid-readiness trust requirements.
- Alternatives considered: Keep heuristic Plus inference for dev convenience; gate Plus only client-side.
- Impact: Plus access now requires explicit server-side grants, and tests grant Plus via auditable `plan_plus_active` events.

## [2026-02-12T21:26:24Z] Decision
- Decision: Finalize flow now uses serializable preflight with advisory locks (`finalize-asset:*` and `free-usage:*`) plus audit-log reservation markers (`free_finalize_quota_reserved`) before enqueue.
- Reason: Free-limit checks had race windows under concurrent finalize requests and could overshoot limits.
- Alternatives considered: Non-atomic read/check/write counters; per-request in-memory mutex; schema migration to dedicated quota tables in this pass.
- Impact: Free monthly/daily enforcement is atomic under concurrent finalize bursts, and per-asset finalize is idempotent (`asset_uploaded_enqueuing`/`asset_uploaded_enqueued`).

## [2026-02-12T21:26:24Z] Decision
- Decision: On enqueue/config failure after reservation preflight, rollback reservation and pending enqueue markers; on successful queue send with audit update failure, keep queued success response and preserve marker state.
- Reason: Usage reservations must not leak on enqueue failure, while successful queue submission should avoid false-negative retries.
- Alternatives considered: Always rollback on any post-send failure; keep reservations permanently without rollback path.
- Impact: Failures before/at enqueue release usage, and successful enqueue remains acknowledged even if final audit enrichment fails.

## [2026-02-12T20:49:43Z] Decision
- Decision: Implement PDF text-first extraction in `apps/worker/src/lib/ocr.ts` (embedded text probe) and return deterministic `processingPath=pdf_text_direct` when meaningful selectable text exists; otherwise fall back to Google Vision with explicit probe metadata.
- Reason: Embedded-text PDFs can bypass OCR cost while preserving deterministic extraction boundaries and receipts.
- Alternatives considered: Always run Vision for PDFs; trust client-reported document type/text presence.
- Impact: Digital PDFs now skip Vision when possible, with transparent audit metadata indicating chosen path and fallback rationale.

## [2026-02-12T20:49:43Z] Decision
- Decision: Add same-user hash-based extraction reuse before OCR via provider cache lookup callback, using server-derived SHA-256 from S3 bytes and persisting `Asset.sha256` in worker transaction.
- Reason: Prevent repeated OCR cost for identical content while keeping the trust boundary server-side and auditable.
- Alternatives considered: Client-supplied hash dedupe; post-OCR dedupe only; new schema/table for cache index.
- Impact: Identical uploads for the same user can reuse prior extraction deterministically with `cache_reuse` receipts and source extraction reference.

## [2026-02-12T20:49:43Z] Decision
- Decision: Defer page-level split OCR for mixed PDFs in this pass; use full-document OCR fallback when embedded text is insufficient, and record explicit limitation metadata in receipts/logs.
- Reason: Current stack/workflow does not yet include robust deterministic per-page PDF splitting + selective OCR execution without broader refactor.
- Alternatives considered: Ad-hoc page splitting in this pass; ignoring limitation in receipts.
- Impact: Cost minimization is improved for fully digital PDFs, and mixed PDFs remain fully auditable with a documented limitation for future iteration.

## [2026-02-12T20:34:29Z] Decision
- Decision: Enforce Free anti-abuse limits in `POST /cases/:id/assets/:assetId/finalize` before queue submission, with hard 403 contracts for `FREE_LIMIT_REACHED` and `FREE_OCR_DISABLED`.
- Reason: The only reliable place to prevent OCR cost runaway is the server finalize gate before any enqueue side effects occur.
- Alternatives considered: Client-side quota checks; enforcing only after worker OCR starts.
- Impact: Over-limit Free requests are blocked authoritatively pre-enqueue, with deterministic response payloads suitable for mobile UX and QA assertions.

## [2026-02-12T20:34:29Z] Decision
- Decision: Derive monthly billable Free usage from auditable successful OCR run records (`AuditEventType.OCR_RUN` with payload metadata), using detected page counts when present and conservative fallback of 1 page unit.
- Reason: Usage must be derived from server-trusted, auditable processing records rather than client counters while preserving cost safety for missing metadata.
- Alternatives considered: New persisted counter table; counting enqueue requests; trusting client-reported page counts.
- Impact: Free usage accounting is replayable and explainable from existing audit trail, with no schema changes and predictable fallback behavior.

## [2026-02-12T20:17:25Z] Decision
- Decision: Introduced a dedicated `language` gate screen in mobile routing and made hydration route to it whenever `STORAGE_LANGUAGE` is missing, with a stored `postLanguageScreen` to resume auth/onboarding/home flow after selection.
- Reason: The prompt requires language selection before any onboarding/auth content while still preserving existing persisted-session routing behavior.
- Alternatives considered: Prompt language inside onboarding slide 1; infer language only from device locale without explicit confirmation.
- Impact: Fresh installs/session resets now start with explicit language choice, and selected language applies immediately across onboarding and core app copy.

## [2026-02-12T20:17:25Z] Decision
- Decision: Replaced the onboarding carousel with a 7-step EN/ES sequence aligned to crisis intake framing (calm welcome, scope boundary, upload guidance, optional context, plan choice, receipts+uncertainty, continuity/reminders) and updated plan surfaces to show Free + Plus monthly + Plus active-case month pricing.
- Reason: Plus value needed to be explicit in the first minute with continuity and pricing clarity while maintaining non-advisory legal tone.
- Alternatives considered: Keep prior 4-slide onboarding and only adjust paywall copy; add pricing only in account settings.
- Impact: First-run onboarding now communicates premium continuity value and trust mechanics up front, and pricing appears consistently in paywall/account messaging.

## [2026-02-12T19:57:16Z] Decision
- Decision: Implement OCR provider selection directly in `apps/worker/src/lib/ocr.ts` with `createOcrProvider()` supporting `stub` and `google_vision`, and make google provider read bytes from S3 (`S3_BUCKET` + `s3Key`) before Vision inference.
- Reason: Keeps worker deterministic/replayable while replacing stub OCR with a real provider path without schema changes.
- Alternatives considered: Fetch file bytes in `worker.ts` before provider call; remove stub provider entirely.
- Impact: OCR behavior is controlled by env with safe local fallback; worker can process real uploaded documents through Vision while preserving existing dev/test stub workflows.

## [2026-02-12T19:57:16Z] Decision
- Decision: Record explicit `OCR_RUN` failure audits during OCR stage (before retries) and enrich successful OCR audits with provider/source metadata.
- Reason: Needed stronger traceability and retry-safe diagnostics at the exact stage where OCR fails.
- Alternatives considered: Rely only on generic `worker_failure` audits; keep minimal OCR success payload.
- Impact: OCR receipts are now auditable per run with provider/version/source details and explicit failure context.

## [2026-02-12T19:13:21Z] Decision
- Decision: Handle mobile `PLUS_REQUIRED` responses with a single upgrade explainer + CTA flow (`promptPlusUpgrade`) instead of showing generic error banners.
- Reason: Free users should get consistent, calm premium gating language and a direct upgrade path.
- Alternatives considered: Keep per-route generic failure banners; silently fail and rely on hidden UI states.
- Impact: Entitlement failures now map to one predictable conversion-oriented UX path in EN/ES.

## [2026-02-12T19:13:21Z] Decision
- Decision: Expand entitlement API tests to cover Free vs Plus behavior on all Plus-only routes (watch-mode, consult-link list/create/disable) with strict `PLUS_REQUIRED` assertions.
- Reason: Prevents regressions where one route drifts from the entitlement contract.
- Alternatives considered: Keep a single watch-mode entitlement test only.
- Impact: QA confidence increased for backend entitlement consistency and route-level behavior.

## [2026-02-12T18:59:05Z] Decision
- Decision: Enforce Plus access server-side on watch mode and consult-link endpoints with a stable `403` response payload containing `error/code = PLUS_REQUIRED`.
- Reason: Prevents client-only bypasses and matches the requested paid-value enforcement without needing billing redesign.
- Alternatives considered: Keep client-only gating; defer entitlement checks until billing integration.
- Impact: Free users are consistently blocked at API level, Plus behavior remains available, and QA can validate with deterministic status codes.

## [2026-02-12T18:59:05Z] Decision
- Decision: Keep audit-log-based consult links but expose only `id` and `tokenPreview` in list responses, with strict token/id validation on disable and explicit `statusReason` values.
- Reason: Improves trust and safety with minimal architecture change while preserving current MVP flow.
- Alternatives considered: Keep returning full token in list payload; replace audit-log model with a new dedicated links table.
- Impact: Link handling is safer and auditable, disable is idempotent, and client UX can show explicit active/expired/disabled states.

## [YYYY-MM-DDTHH:MM:SSZ] Decision
- Decision:
- Reason:
- Alternatives considered:
- Impact:


