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
