# CONTRIBUTING.md

## Project: ClearCase

ClearCase is a real production-bound project. This is not a demo or tutorial.

### Core Principle
ClearCase provides legal clarity, not legal advice.

If you are unsure whether something crosses into legal advice, it probably does.
Err on the side of neutrality and uncertainty.

---

## Non-Negotiable Rules

- No legal advice
- No LLM inference of facts
- No raw images to LLMs
- No chat-first UX
- No silent assumptions

- Deterministic OCR first
- Truth-layer extraction before LLM
- LLM only formats structured data
- All outputs must be auditable
- Calm, non-alarming language

---

## Tech Stack (Locked)

- Node.js + TypeScript
- Fastify
- Postgres
- Prisma v7
- AWS S3
- AWS SQS
- Google Vision OCR
- OpenAI API (post-extraction)
- Managed auth (Clerk-style)
- Windows / PowerShell

Do not introduce new frameworks or databases without approval.

---

## Development Workflow

1. Read CLEARCASE_HANDOFF.txt before starting work
2. Check NEXT_STEPS.md for current priorities
3. Append to SESSION_LOG.md after each session
4. Prefer small, reviewable changes
5. Document brittle decisions

---

## Database Rules

- Prisma schema is intentional
- Do not remove tables for “MVP”
- Do not inline DATABASE_URL in schema.prisma
- Prisma v7 requires prisma.config.ts + adapter

---

## Communication Expectations

- Be explicit
- Prefer boring correctness
- Call out risks early
- Ask before redesigning

---

## If You Get Stuck

- Stop and document the issue in SESSION_LOG.md
- Ask one precise question
- Do not brute-force architectural changes

---

This project is expected to ship.
Treat it accordingly.
