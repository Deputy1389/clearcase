# MVP_WEEK_EXECUTION.md

Goal: ship a working ClearCase MVP in 7 focused days once AWS is active.

## Day 0 (Tonight / Pre-sleep)
- Confirm files exist:
  - `scripts/mvp/preflight.ps1`
  - `scripts/mvp/aws-ready.ps1`
  - `scripts/mvp/start-dev.ps1`
- Tomorrow start command:
  - `npm run mvp:preflight`

## Day 1 (AWS + Phase 3)
- Configure `.env` keys:
  - `AWS_REGION`
  - `S3_BUCKET`
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
- Validate:
  - `npm run mvp:aws-check`
- Build Phase 3 endpoint:
  - `POST /cases/:id/assets` (presigned URL flow)
  - ownership enforcement
  - metadata-only DB write
- Exit criteria:
  - upload init request returns `assetId`, `s3Key`, presigned URL

## Day 2 (Phase 4)
- Add worker process skeleton
- Add SQS consume/ack/retry basics
- Exit criteria:
  - messages can be enqueued and consumed locally/dev

## Day 3 (Phase 5)
- Add OCR adapter boundary and provider wiring
- Persist deterministic OCR output as extraction record
- Exit criteria:
  - uploaded asset can produce extraction row

## Day 4 (Phase 6)
- Build truth-layer extraction/classification pipeline
- Add deadline/jurisdiction structured outputs
- Exit criteria:
  - extraction -> structured facts persisted and replayable

## Day 5 (Phase 7)
- Add LLM formatting layer from structured facts only
- Add disclaimers, uncertainty language, and receipts
- Exit criteria:
  - stable final explanation JSON for a case

## Day 6 (Stabilize)
- End-to-end tests + bug fixes
- Ownership and auth edge cases
- Error handling and idempotency checks
- Exit criteria:
  - clean E2E run from upload -> explanation

## Day 7 (Demo polish)
- UI/API wiring pass
- Demo script and data fixture prep
- Metrics logging pass
- Exit criteria:
  - reliable investor/demo flow

## Daily startup commands
```powershell
Set-Location C:\ClearCase\clearcase
npm run mvp:preflight
npm run mvp:aws-check   # skip until AWS is restored
npm run mvp:start
```

## Non-negotiables
- Keep Prisma schema unchanged unless absolutely necessary.
- Keep batch mode execution: no routine confirmation prompts.
- Only stop for destructive actions.
