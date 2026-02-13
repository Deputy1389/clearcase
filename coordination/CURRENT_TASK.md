# CURRENT_TASK

- Goal: Complete Prompt N - Pre-Revenue OCR Spend Lock.
- Scope in:
  - enforce pre-revenue OCR default config (`OCR_PROVIDER=stub`, `GLOBAL_FREE_OCR_ENABLED=false`)
  - add controlled allowlist/feature-flag path for paid OCR in internal QA only
  - add audit/reporting for OCR path usage and unexpected paid OCR activity
  - add tests and docs for pre-revenue OCR cost protection and safe switch-over
- Scope out:
  - architecture redesign
  - new premium feature expansion unrelated to OCR cost controls
- Definition of done: Pre-revenue environments keep OCR spend near zero by default, paid OCR access is controlled/auditable, and validations/tests are green.
- Owner: Builder (Codex)
- Started at (UTC): 2026-02-13T01:30:00Z
