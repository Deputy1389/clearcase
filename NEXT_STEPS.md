# NEXT_STEPS.md

This file represents the **current authoritative task list**.
Unlike SESSION_LOG.md, this file SHOULD be edited as things change.

---

## Current Phase
Phase 6 - Truth Layer (Prep)

---

## Immediate Next Steps

1. Build Phase 6 truth-layer transformer from extraction output to structured case facts.
2. Persist structured case facts/deadline signals on case update path (deterministic only).
3. Add `phase6-smoke` verification path and replayability checks.
4. Keep OCR provider boundary deterministic (no provider swap yet) until truth-layer is stable.

---

## Phase 3 - S3 Uploads + Assets (Completed)

- Presigned URL flow implemented.
- `POST /cases/:id/assets` implemented and ownership enforced.
- Metadata-only `Asset` record creation implemented.
- End-to-end verified: upload-init + presigned PUT + case asset linkage + cross-user 404.

---

## Phase 4 - SQS Worker (Completed)

- Worker process scaffold implemented under `apps/worker`.
- SQS queue wiring via `.env` `SQS_QUEUE_URL`.
- Consume/ack path verified on dev queue.
- Retry behavior verified via `mvp:phase4-smoke` (`forceFail=true` message reappears and is cleaned up).

---

## Phase 5 - OCR Adapter Boundary (Completed - Stub Provider)

- OCR provider boundary added at `apps/worker/src/lib/ocr.ts`.
- Worker now processes `asset_uploaded` messages and persists `Extraction` + `AuditLog`.
- End-to-end verified via `mvp:phase5-smoke`:
  - API case + asset creation
  - queue message publish
  - worker processing
  - extraction persistence on case.

---

## Blockers / Risks

- No active blockers for Phase 6 prep.

---

## Notes

- Do not modify Prisma schema unless strictly required
- Keep uploads isolated from OCR logic
- Maintain deterministic pipeline order
- Phase 3 is complete and verified via `npm run mvp:phase3-smoke`.
- `POST /cases/:id/assets` is now implemented (ownership + metadata DB write + presigned URL creation)
- Phase 4 smoke command: `npm run mvp:phase4-smoke`.
- Phase 5 smoke command: `npm run mvp:phase5-smoke`.
- `.env` now includes `SQS_QUEUE_URL`.
- Execution preference: batch mode by default, no routine confirmation prompts
- Only stop for confirmation on destructive actions (data deletion, DB drop, migration removal, or large code removal)

---
