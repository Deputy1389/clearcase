# QA_REPORT.md

Date: 2026-02-12  
Scope: Improvement-focused QA pass (language tone, status labels, naming, privacy signaling, confidence labeling)

## Tier 0 - Smoke Tests

Commands executed:
- `docker compose up -d`
- `docker ps`
- `npx prisma validate --schema=packages/db/prisma/schema.prisma`
- `npx prisma migrate status --schema=packages/db/prisma/schema.prisma`
- `npx prisma generate --schema=packages/db/prisma/schema.prisma`
- API health probe: `GET http://127.0.0.1:3001/health`

Result:
- PASS. Docker, Prisma, and API health all succeeded.

## Tier 1 - API Contract Checks

Executed live API checks (PowerShell script assertions) for:
- `GET /health` -> `{ ok: true }`
- `GET /me` default identity when headers are absent
- `GET /me` header override with `x-auth-subject` and `x-user-email`
- `PATCH /me` invalid zip rejected with 400
- `PATCH /me` valid update persists `fullName` and `zipCode`
- `needsProfile` flips to `false` when profile fields are present
- `POST /cases` creates case for current user
- `GET /cases/:id` succeeds for owner
- Ownership enforcement denies cross-user read (`404` observed)

Result:
- PASS.

## Tier 2 - DB Integration Checks

Executed integration checks against real Postgres through API:
- `getOrCreateUser` idempotency via repeated `GET /me` for same auth subject
- Case snapshot invariance:
  - profile zip/state set to `94105/CA`
  - case created
  - profile changed to `10001`
  - case remained `jurisdictionZip=94105`, `jurisdictionState=CA`

Result:
- PASS.

## Tier 3 - UI / Regression / Build Checks

Commands executed:
- `npx tsx --test apps/worker/src/lib/pipeline.regression.test.ts`
- `npx tsc --noEmit -p apps/mobile/tsconfig.json`
- `npx tsc --noEmit -p apps/worker/tsconfig.json`
- `npm run web:build`

Improvement copy compliance checks executed:
- Banned phrases absent (`Review immediately`, `Call ... immediately`, `Review Ready`)
- Expected phrases present (`Ready to review`, `Extraction confidence`, `No deadline detected`, `Private by default`, context-helper wording)

Result:
- PASS.

## Security and Reliability Notes

- Ownership checks passed for cross-user case access.
- No evidence that API routes accept client-provided `userId` for record selection.
- No committed secrets detected in tracked files by quick pattern scan (excluding `.env` files).
- Worker logs include message payload logging for unknown message types. Current observed payloads are IDs, but this should remain monitored to avoid accidental sensitive payload logging.

## Files Changed In This QA Cycle

- `apps/mobile/App.tsx`
- `apps/worker/src/lib/formatter.ts`
- `QA_REPORT.md`
- `SESSION_LOG.md`

## Summary

- Improvement implementation and QA checks are green for current scope.
- No blocking regressions were found in API contracts, DB-backed ownership/snapshot behavior, or build/typecheck/regression tests.

## Known Gaps and Next Items

1. Add automated Fastify `app.inject()` tests for API routes (currently validated live via script, not as committed test files).
2. Add dedicated integration test harness script for repeatable DB reset/setup per run.
3. Add device-level E2E run for mobile UX (camera/upload/reprocess/manual category) on real hardware.
