# NEXT_STEPS.md

This file represents the **current authoritative task list**.
Unlike SESSION_LOG.md, this file SHOULD be edited as things change.

---

## Current Phase
Phase 3 - S3 Uploads + Assets (Prep Pending)

---

## Immediate Next Steps

1. Prepare AWS account + S3 bucket + IAM access keys
2. Add AWS/S3 env vars to `.env` (`AWS_REGION`, `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
3. Confirm upload mode: presigned URL flow
4. Implement `POST /cases/:id/assets` (metadata only, ownership enforced)
5. Verify end-to-end upload init flow from API
6. Use `MVP_WEEK_EXECUTION.md` and startup scripts (`npm run mvp:preflight`, `npm run mvp:aws-check`, `npm run mvp:start`)

---

## Phase 3 - S3 Uploads + Assets (Planned)

- Decide on presigned URL flow vs proxy upload
- Define Asset lifecycle states
- Add `POST /cases/:id/assets`
- Store metadata only (no OCR yet)
- Ensure user ownership enforced

---

## Blockers / Risks

- AWS account and S3 credentials are not configured yet, so Phase 3 implementation is paused.

---

## Notes

- Do not modify Prisma schema unless strictly required
- Keep uploads isolated from OCR logic
- Maintain deterministic pipeline order
- Do not proceed to SQS/OCR until Phase 3 is complete
- Execution preference: batch mode by default, no routine confirmation prompts
- Only stop for confirmation on destructive actions (data deletion, DB drop, migration removal, or large code removal)

---
