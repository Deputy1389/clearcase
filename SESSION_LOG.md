# SESSION_LOG.md

This file is an **append-only log** of development sessions for ClearCase.
Do not rewrite history. Always add new entries at the bottom.

---

## Session Template

**Date:** YYYY-MM-DD  
**Tool:** opencode / codex CLI  
**Context Loaded:** CLEARCASE_HANDOFF.txt  
**Goal:** (what you intended to work on)

### What was done
- 

### Decisions made
- 

### Problems encountered
- 

### Resolutions
- 

### Open questions
- 

### Notes for next session
- 

---

**Date:** 2026-02-11  
**Tool:** codex CLI  
**Context Loaded:** CLEARCASE_HANDOFF.txt, startClearCase.txt, NEXT_STEPS.md, SESSION_LOG.md  
**Goal:** Phase 2 API skeleton only

### What was done
- Verified baseline commands for Phase 1 stability; fixed command path usage by running repo commands with explicit `Set-Location C:\ClearCase\clearcase`.
- Added a new Fastify TypeScript API skeleton under `apps/api`.
- Implemented auth stub via headers (`x-auth-subject`, `x-user-email`) with a stable dev fallback identity.
- Implemented `GET /health`, `GET /me`, `PATCH /me`, `POST /cases`, and `GET /cases/:id`.
- Added strict Zod validation for `PATCH /me` and ownership enforcement for case reads.
- Added ZIP normalization and ZIP-to-state derivation, then persisted `jurisdictionState` on profile update.
- Snapshotted user ZIP/state onto created cases.
- Added API scripts and dependencies, then validated with `npm run api:typecheck` and live endpoint calls.

### Decisions made
- Keep Phase 2 intentionally minimal in one API service file plus small auth/profile helpers.
- Derive jurisdiction state locally from ZIP using the `zipcodes` package to keep onboarding deterministic.
- Keep auth as a replaceable stub with explicit `subject` identity mapping to `User.authProviderUserId`.

### Problems encountered
- Initial API test hit stale Node processes and returned outdated behavior.
- `req.auth` was undefined due Fastify plugin encapsulation.
- PowerShell string escaping produced invalid JSON in raw `curl.exe` tests.

### Resolutions
- Attached auth hook globally by invoking `authPlugin(app)` directly.
- Switched verification to PowerShell-native JSON request commands for deterministic tests.
- Cleaned port-bound background processes between runs.

### Open questions
- None for Phase 2 scope.

### Notes for next session
- Phase 2 skeleton is complete and verified.
- Next planned work remains Phase 3 upload/asset design, without OCR/SQS integration yet.

---

**Date:** 2026-02-11  
**Tool:** codex CLI  
**Context Loaded:** CLEARCASE_HANDOFF.txt, startClearCase.txt, NEXT_STEPS.md, SESSION_LOG.md  
**Goal:** Prepare for Phase 3 handoff and pause

### What was done
- Confirmed Phase 2 is complete and stable.
- Documented specific AWS prerequisites for Phase 3.
- Updated NEXT_STEPS.md to set Phase 3 as current and list exact resume steps.

### Decisions made
- Phase 3 implementation is intentionally deferred until AWS account/bucket/credentials are ready.

### Problems encountered
- None.

### Resolutions
- Added explicit blocker and resume checklist in NEXT_STEPS.md.

### Open questions
- None.

### Notes for next session
- Start with AWS setup completion, then implement `POST /cases/:id/assets` using presigned URL flow.

---

**Date:** 2026-02-11  
**Tool:** codex CLI  
**Context Loaded:** CLEARCASE_HANDOFF.txt, startClearCase.txt, NEXT_STEPS.md, SESSION_LOG.md  
**Goal:** Persist execution preference for future sessions

### What was done
- Updated context files to enforce batch-mode execution preference.
- Added explicit rule to avoid routine confirmation prompts for non-destructive plan steps.

### Decisions made
- Only destructive actions require a confirmation pause.

### Problems encountered
- None.

### Resolutions
- Added consistent instructions across authoritative context files.

### Open questions
- None.

### Notes for next session
- Continue Phase 3 once AWS prerequisites are prepared, without routine confirmation prompts.

---

**Date:** 2026-02-11  
**Tool:** codex CLI  
**Context Loaded:** CLEARCASE_HANDOFF.txt, startClearCase.txt, NEXT_STEPS.md, SESSION_LOG.md  
**Goal:** Prepare automation files for week-long MVP execution

### What was done
- Added MVP automation scripts under `scripts/mvp`.
- Added npm commands: `mvp:preflight`, `mvp:aws-check`, `mvp:start`.
- Added `MVP_WEEK_EXECUTION.md` with day-by-day delivery plan and startup commands.
- Updated NEXT_STEPS.md to reference the MVP runbook and scripts.
- Verified `mvp:preflight` passes.
- Verified `mvp:aws-check` fails fast with clear missing-key output until AWS env vars are set.

### Decisions made
- Keep automation simple and explicit in PowerShell to match project environment.

### Problems encountered
- None.

### Resolutions
- N/A.

### Open questions
- None.

### Notes for next session
- Once AWS account is restored, fill `.env` keys and run `npm run mvp:aws-check`, then start Phase 3.

---

**Date:** 2026-02-11  
**Tool:** codex CLI  
**Context Loaded:** CLEARCASE_HANDOFF.txt, startClearCase.txt, NEXT_STEPS.md, SESSION_LOG.md  
**Goal:** Stabilize startup flow, add backup automation, and prepare for full-auto relaunch

### What was done
- Validated startup scripts and runbook consistency (`scripts/mvp/*.ps1`, `MVP_WEEK_EXECUTION.md`).
- Ran `npm run mvp:start` and confirmed API health endpoint responds (`/health` = 200).
- Updated `scripts/mvp/aws-ready.ps1` to detect AWS CLI from known install paths when `aws` is not on PATH.
- Fixed local DB connectivity mismatch by changing `.env` `DATABASE_URL` host port from `5432` to `5433` to match Docker mapping.
- Started Docker Desktop, ran `npm run mvp:preflight`, and applied Prisma migration via `npx prisma migrate deploy`.
- Initialized git repository on `main` and created initial local backup commits.
- Added automated backup script `scripts/mvp/backup.ps1` and npm alias `mvp:backup`.

### Decisions made
- Use local commit identity for backups until user-provided git identity/remote is configured.
- Keep backup routine non-blocking when `origin` is missing (commit locally and continue).

### Problems encountered
- AWS CLI was installed but unavailable by command name due PATH mismatch.
- `mvp:preflight` initially reported DB unreachable because `.env` used port `5432` while Docker published `5433`.
- Initial version of `backup.ps1` had PowerShell parameter placement and no-remote handling issues.

### Resolutions
- Added AWS CLI path fallback in `aws-ready.ps1`.
- Corrected `DATABASE_URL` port in `.env` and reran preflight/migrations successfully.
- Fixed `backup.ps1` structure and remote detection logic; validated with `npm run mvp:backup`.

### Open questions
- User needs to provide GitHub remote URL to enable push backups.
- User needs to populate AWS env keys in `.env` from existing AWS account:
  - `AWS_REGION`
  - `S3_BUCKET`
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`

### Notes for next session
- User plans to relaunch using `codex --full-auto -C C:\Clearcase\Clearcase`.
- First actions on resume:
  1. configure `origin` and push `main`;
  2. run `npm run mvp:aws-check` after AWS keys are filled;
  3. begin Phase 3 `POST /cases/:id/assets` presigned URL implementation.

---

**Date:** 2026-02-11  
**Tool:** codex CLI  
**Context Loaded:** CLEARCASE_HANDOFF.txt, startClearCase.txt, NEXT_STEPS.md, SESSION_LOG.md  
**Goal:** Resume and implement Phase 3 upload-init endpoint

### What was done
- Resumed from prior checkpoint and confirmed AWS keys in `.env` are still empty.
- Implemented new upload helper at `apps/api/src/lib/uploads.ts`:
  - upload config validation from env
  - S3 key generation
  - presigned PUT URL generation
- Implemented `POST /cases/:id/assets` in `apps/api/src/server.ts` with:
  - params/body validation
  - case ownership enforcement
  - metadata-only `Asset` DB write
  - 503 response when AWS upload env is not configured
- Added AWS SDK dependencies for presigned URL generation:
  - `@aws-sdk/client-s3`
  - `@aws-sdk/s3-request-presigner`
- Ran `npm run api:typecheck` successfully.
- Ran runtime smoke check outside sandbox; endpoint currently returns 503 as expected until AWS env values are populated.
- Updated `NEXT_STEPS.md` to reflect Phase 3 implementation progress and remaining verification steps.

### Decisions made
- Keep upload-init behavior explicit when env is missing: return `503 AWS_UPLOADS_NOT_CONFIGURED` with missing keys list.
- Keep Prisma schema unchanged; Phase 3 implemented within existing models.

### Problems encountered
- `npm install` failed under sandbox due permission/network access constraints.
- Local `api:start` under sandbox hit `spawn EPERM` for tsx/esbuild runtime.
- Initial curl-based runtime checks had PowerShell escaping issues.

### Resolutions
- Re-ran package install with escalated permissions.
- Performed runtime endpoint verification outside sandbox.
- Switched runtime verification to PowerShell-native JSON requests.

### Open questions
- None.

### Notes for next session
- Fill `.env` AWS keys and run `npm run mvp:aws-check`.
- Validate happy-path `POST /cases/:id/assets` (expect 201 + presigned URL).
- Continue Phase 3 verification with an actual PUT upload to S3.

---

**Date:** 2026-02-11  
**Tool:** codex CLI  
**Context Loaded:** CLEARCASE_HANDOFF.txt, startClearCase.txt, NEXT_STEPS.md, SESSION_LOG.md  
**Goal:** Complete Phase 3 verification and begin Phase 4 worker skeleton

### What was done
- Added reusable Phase 3 smoke test script at `scripts/mvp/phase3-smoke.ps1`.
- Added npm command `mvp:phase3-smoke` to run the full upload-init + presigned PUT flow.
- Ran `npm run mvp:phase3-smoke` with network-enabled execution and verified:
  - case creation
  - upload-init response
  - successful PUT to S3
  - asset linked to case
  - cross-user case read blocked with 404
- Added worker skeleton under `apps/worker`:
  - `apps/worker/src/worker.ts`
  - `apps/worker/tsconfig.json`
- Added npm commands:
  - `worker:start`
  - `worker:typecheck`
- Added `@aws-sdk/client-sqs` dependency for worker polling.
- Verified `npm run api:typecheck` and `npm run worker:typecheck` both pass.
- Verified worker runtime fails fast with clear message when `SQS_QUEUE_URL` is missing.
- Added `SQS_QUEUE_URL` placeholder in `.env`.
- Updated `NEXT_STEPS.md` to mark Phase 3 completed and Phase 4 as current.

### Decisions made
- Keep Phase 4 worker minimal and explicit: receive one message, process stub, ack on success, retry by non-delete on failure.
- Use command-driven verification (`mvp:phase3-smoke`) to make handoff and repeatability deterministic.

### Problems encountered
- Phase 3 smoke PUT to S3 failed under sandbox due restricted network path.
- Worker/API runtime via `tsx` can hit sandbox `spawn EPERM`.

### Resolutions
- Re-ran external network/runtime verification with escalated execution.
- Kept compile checks available in normal mode and runtime checks for escalated mode.

### Open questions
- None.

### Notes for next session
- Create/configure SQS queue and IAM permissions.
- Set `SQS_QUEUE_URL` in `.env`.
- Verify worker consume/ack/retry behavior with a real queued message.

---

**Date:** 2026-02-11  
**Tool:** codex CLI  
**Context Loaded:** CLEARCASE_HANDOFF.txt, startClearCase.txt, NEXT_STEPS.md, SESSION_LOG.md  
**Goal:** Configure Phase 4 queue access and verify worker consume/ack flow

### What was done
- Created/fetched dev queue URL: `https://sqs.us-west-2.amazonaws.com/905418215132/clearcase-phase4-dev`.
- Updated `.env` with `SQS_QUEUE_URL`.
- Ran live worker consume/ack verification on dev queue:
  - enqueued test message
  - started worker
  - confirmed queue visible/not-visible counts returned to `0`.
- Enhanced worker skeleton in `apps/worker/src/worker.ts`:
  - configurable `SQS_VISIBILITY_TIMEOUT_SECONDS`
  - deterministic `forceFail=true` failure hook for retry testing.
- Re-ran `npm run worker:typecheck` successfully.

### Decisions made
- Keep retry simulation deterministic via message body (`forceFail`) to support repeatable queue tests.
- Keep queue config in `.env` and worker env variables only; no schema changes.

### Problems encountered
- IAM policy scope allowed SQS actions only on `clearcase-phase4-dev`, which blocked isolated queue tests.
- Background node processes made isolated retry verification less deterministic on the shared dev queue.

### Resolutions
- Completed reliable consume/ack validation on the permitted queue.
- Marked isolated retry verification as a remaining step requiring broader queue-policy scope.

### Open questions
- Whether to widen SQS IAM policy to allow isolated test queues (`clearcase-phase4-isolated-*`) for deterministic retry verification.

### Notes for next session
- Optionally widen SQS policy scope for isolated queue testing.
- Add dedicated `phase4-smoke` script and finish retry proof in isolated queue.
- Move into Phase 5 OCR adapter boundary after Phase 4 checklist completion.

---

**Date:** 2026-02-11  
**Tool:** codex CLI  
**Context Loaded:** CLEARCASE_HANDOFF.txt, startClearCase.txt, NEXT_STEPS.md, SESSION_LOG.md  
**Goal:** Finalize Phase 4 smoke automation and implement Phase 5 OCR boundary with persistence

### What was done
- Added `scripts/mvp/phase4-smoke.ps1` and npm command `mvp:phase4-smoke`.
- Hardened Phase 4 smoke script:
  - drains queue before checks
  - starts/stops worker process trees reliably
  - verifies ACK path
  - verifies RETRY path with `forceFail=true`
  - uses file-based SQS message-body payloads to preserve valid JSON
- Added OCR adapter boundary at `apps/worker/src/lib/ocr.ts` with deterministic stub provider (`OCR_PROVIDER=stub`).
- Updated worker processing in `apps/worker/src/worker.ts`:
  - handles `asset_uploaded` messages
  - loads asset metadata from DB
  - runs OCR provider
  - persists `Extraction`
  - writes `AuditLog` event (`OCR_RUN`)
  - retains existing consume/ack/retry skeleton behavior
- Added `scripts/mvp/phase5-smoke.ps1` and npm command `mvp:phase5-smoke`.
- Verified end-to-end Phase 5 flow:
  - created case + asset via API
  - queued `asset_uploaded` message
  - worker processed message
  - extraction persisted and visible via `GET /cases/:id`
- Re-ran API and worker typechecks successfully.

### Decisions made
- Keep OCR provider deterministic and local-stub only until truth layer is implemented.
- Use script-based smoke checks (`phase3`, `phase4`, `phase5`) as the standard repeatable verification path.

### Problems encountered
- SQS message JSON payloads were being transformed when passed directly via AWS CLI `--message-body`.
- Retry checks appeared flaky until worker process tree termination and payload correctness were enforced.

### Resolutions
- Switched queue publish in smoke scripts to file-based payloads (`file://...`) for exact JSON preservation.
- Added process-tree stop logic to avoid stale worker interference.
- Added deterministic `forceFail` path in worker and verified retry visibility behavior.

### Open questions
- None.

### Notes for next session
- Begin Phase 6 truth layer using persisted extraction outputs.
- Add `phase6-smoke` after initial truth-layer persistence path is implemented.

---

**Date:** 2026-02-11  
**Tool:** codex CLI  
**Context Loaded:** CLEARCASE_HANDOFF.txt, startClearCase.txt, NEXT_STEPS.md, SESSION_LOG.md  
**Goal:** Add restart handoff file for faster session continuity

### What was done
- Added `continue.txt` with current project snapshot, resume commands, phase status, and immediate next work.
- Updated `startClearCase.txt` startup checklist to read `continue.txt` before `SESSION_LOG.md` and `NEXT_STEPS.md`.

### Decisions made
- Keep `continue.txt` concise and operational (what to run, where we are, what’s next), not a full narrative log.

### Problems encountered
- None.

### Resolutions
- N/A.

### Open questions
- None.

### Notes for next session
- Update `continue.txt` before session close, then run `npm run mvp:backup`.

---
