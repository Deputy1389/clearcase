# NEXT_STEPS.md

This file represents the **current authoritative task list**.
Unlike SESSION_LOG.md, this file SHOULD be edited as things change.

---

## Current Phase
Phase 4 - SQS Worker (Skeleton In Progress)

---

## Immediate Next Steps

1. Expand IAM policy scope if needed for isolated retry testing (current policy is queue-specific to `clearcase-phase4-dev`).
2. Add a dedicated Phase 4 smoke script (`send -> consume -> ack -> retry check`) for repeatable verification.
3. Verify retry behavior in an isolated queue context (force-fail message remains retriable).
4. Begin Phase 5 OCR adapter boundary once Phase 4 verification checklist is complete.

---

## Phase 3 - S3 Uploads + Assets (Completed)

- Presigned URL flow implemented.
- `POST /cases/:id/assets` implemented and ownership enforced.
- Metadata-only `Asset` record creation implemented.
- End-to-end verified: upload-init + presigned PUT + case asset linkage + cross-user 404.

---

## Blockers / Risks

- Queue-specific IAM policy blocks isolated queue testing (`sqs:SendMessage`/`sqs:GetQueueAttributes` denied outside `clearcase-phase4-dev`).

---

## Notes

- Do not modify Prisma schema unless strictly required
- Keep uploads isolated from OCR logic
- Maintain deterministic pipeline order
- Phase 3 is complete and verified via `npm run mvp:phase3-smoke`.
- `POST /cases/:id/assets` is now implemented (ownership + metadata DB write + presigned URL creation)
- Phase 4 skeleton is implemented (`apps/worker/src/worker.ts`) and verified for startup + basic consume/ack on `clearcase-phase4-dev`.
- `.env` now includes `SQS_QUEUE_URL`.
- Execution preference: batch mode by default, no routine confirmation prompts
- Only stop for confirmation on destructive actions (data deletion, DB drop, migration removal, or large code removal)

---
