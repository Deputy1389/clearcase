# NEXT_STEPS.md

This file represents the **current authoritative task list**.
Unlike SESSION_LOG.md, this file SHOULD be edited as things change.

---

## Current Phase
Phase 3 - S3 Uploads + Assets (Implementation In Progress)

---

## Immediate Next Steps

1. Fill AWS/S3 env vars in `.env` (`AWS_REGION`, `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
2. Run `npm run mvp:aws-check`
3. Verify `POST /cases/:id/assets` returns 201 with `assetId`, `s3Key`, and `uploadUrl`
4. Verify presigned PUT upload against S3
5. Use `MVP_WEEK_EXECUTION.md` and startup scripts (`npm run mvp:preflight`, `npm run mvp:aws-check`, `npm run mvp:start`)

---

## Phase 3 - S3 Uploads + Assets (Planned)

- Decide on presigned URL flow vs proxy upload
- Define Asset lifecycle states
- Add `POST /cases/:id/assets`
- Store metadata only (no OCR yet)
- Ensure user ownership enforced

---

## Blockers / Risks

- AWS env values are still empty in `.env`, so live presigned upload verification is blocked.

---

## Notes

- Do not modify Prisma schema unless strictly required
- Keep uploads isolated from OCR logic
- Maintain deterministic pipeline order
- Do not proceed to SQS/OCR until Phase 3 is complete
- `POST /cases/:id/assets` is now implemented (ownership + metadata DB write + presigned URL creation)
- Execution preference: batch mode by default, no routine confirmation prompts
- Only stop for confirmation on destructive actions (data deletion, DB drop, migration removal, or large code removal)

---
