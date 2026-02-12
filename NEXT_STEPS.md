# NEXT_STEPS.md

This file represents the **current authoritative task list**.
Unlike `SESSION_LOG.md`, this file SHOULD be edited as things change.

---

## Current Phase
Mobile product pass + backend/worker stabilization (post Phase 7).

---

## Completed Milestones

1. API/worker pipeline through Phase 7 is implemented and validated.
2. Replay/idempotency hardening and regression coverage landed.
3. Mobile app scaffolding and core flows are in place:
   - auth/profile onboarding
   - dashboard/cases/workspace/account screens
   - upload from file or camera (multi-photo)
   - finalize enqueue after upload
   - case context save + reprocess
   - manual category override
4. Workspace now has severity-based top action card (red/yellow/green).

---

## Immediate Next Steps

1. Mobile UX polish pass:
   - spacing/typography consistency in Workspace
   - tighter hierarchy for summary/category/context cards
   - verify no overflow/truncation on narrow devices
2. End-to-end device verification:
   - create account
   - new case upload from camera
   - processing completion under active worker
   - manual category override + refresh consistency
3. Reliability checks:
   - ensure API base auto-detection is stable on LAN
   - handle API offline/reconnect paths without stale errors
4. Curate realistic test assets:
   - add public/synthetic legal document samples for smoke testing.

---

## Runtime Commands

Run each in its own terminal from `C:\Clearcase\Clearcase`:

1. `npm run api:start`
2. `npm run worker:start`
3. `npm --prefix apps/mobile run start -- --lan --clear --port 8081`
4. Optional web preview: `npm --prefix apps/mobile run web -- --non-interactive --port 8090`

---

## Notes

- Keep deterministic boundaries:
  - OCR/truth extraction deterministic
  - LLM formatting only from structured truth payload
- Do not commit logs/runtime artifacts (`.api.log`, `.worker.log`, `.playwright-cli/`).
- Keep schema changes explicit and minimal.
