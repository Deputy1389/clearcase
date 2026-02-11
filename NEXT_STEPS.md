# NEXT_STEPS.md

This file represents the **current authoritative task list**.
Unlike SESSION_LOG.md, this file SHOULD be edited as things change.

---

## Current Phase
Phase 4 - SQS Worker (Skeleton In Progress)

---

## Immediate Next Steps

1. Create/confirm SQS queue for worker consumption (dev queue).
2. Add IAM permissions for queue consume/ack (`sqs:ReceiveMessage`, `sqs:DeleteMessage`, `sqs:GetQueueAttributes`, `sqs:ChangeMessageVisibility`).
3. Set `SQS_QUEUE_URL` in `.env`.
4. Start worker with `npm run worker:start` and verify it boots without env errors.
5. Enqueue a test message and verify worker logs message receive + ack behavior.

---

## Phase 3 - S3 Uploads + Assets (Completed)

- Presigned URL flow implemented.
- `POST /cases/:id/assets` implemented and ownership enforced.
- Metadata-only `Asset` record creation implemented.
- End-to-end verified: upload-init + presigned PUT + case asset linkage + cross-user 404.

---

## Blockers / Risks

- Worker runtime is blocked on missing `SQS_QUEUE_URL` and queue IAM permissions.

---

## Notes

- Do not modify Prisma schema unless strictly required
- Keep uploads isolated from OCR logic
- Maintain deterministic pipeline order
- Phase 3 is complete and verified via `npm run mvp:phase3-smoke`.
- `POST /cases/:id/assets` is now implemented (ownership + metadata DB write + presigned URL creation)
- Execution preference: batch mode by default, no routine confirmation prompts
- Only stop for confirmation on destructive actions (data deletion, DB drop, migration removal, or large code removal)

---
