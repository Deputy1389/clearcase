# PAID_LAUNCH_READINESS

Generated at (UTC): 2026-02-13T01:05:40Z

## Recommendation
Go for a controlled paid pilot release.

## Go/No-Go Checklist
| Criterion | Result | Evidence |
|---|---|---|
| Billing paid path works end-to-end (free -> paywall -> checkout -> webhook success -> Plus unlock) | Pass | `output/ops/prompt-m-billing-e2e.json` (`flow.checkoutStarted.status=200`, `webhookCreate.transition=plus_active`, `entitlementAfterCreate.isPlus=true`, `plusRouteAfterCreate.status=200`) |
| Billing failure path is enforced (`past_due`/`payment_failed`) | Pass | `output/ops/prompt-m-billing-e2e.json` (`webhookPastDue.transition=grace_period`, `entitlementAfterPastDue.isPlus=true`, `webhookPaymentFailed.transition=revoked_immediate_cancel`, `entitlementAfterPaymentFailed.isPlus=false`, `plusRouteAfterPaymentFailed.status=403`) |
| Plus identity verified after checkout success | Pass | `output/ops/prompt-m-plus-checkout-success.json` (`isPlus=true`, `entitlementStatus=active`) |
| In-app viewer supports required behavior | Pass | `apps/mobile/App.tsx` (image zoom/pan + PDF page/zoom + external fallback), screenshots `output/playwright/prompt-m-viewer-image.png`, `output/playwright/prompt-m-viewer-pdf.png` |
| EN/ES QA evidence for paywall + plain meaning + unlocked account | Pass | `output/playwright/prompt-m-paywall-en.png`, `output/playwright/prompt-m-paywall-es.png`, `output/playwright/prompt-m-plain-meaning-en.png`, `output/playwright/prompt-m-plain-meaning-es.png`, `output/playwright/prompt-m-plus-unlocked-account.png` |
| Build validation remains green after Prompt M changes | Pass | `npx tsc --noEmit -p apps/api/tsconfig.json`, `npx tsc --noEmit -p apps/mobile/tsconfig.json`, `npx tsc --noEmit -p apps/worker/tsconfig.json`, `node --test apps/api/tests/*.mjs` |

## Prompt M Manual QA Record
| Scenario | Result | Repro Notes | Evidence |
|---|---|---|---|
| Paywall EN | Pass | Free user -> open case workspace -> `Start Plus` from Plus preview | `output/playwright/prompt-m-paywall-en.png` |
| Paywall ES | Pass | Free user -> switch ES -> open case workspace -> `Iniciar Plus` | `output/playwright/prompt-m-paywall-es.png` |
| Plain meaning EN | Pass | Plus user -> open case workspace -> `Open plain meaning view` | `output/playwright/prompt-m-plain-meaning-en.png` |
| Plain meaning ES | Pass | Plus user -> switch ES -> `Abrir vista de significado simple` | `output/playwright/prompt-m-plain-meaning-es.png` |
| Document viewer (image) | Pass | Plus user -> Case timeline -> open image asset in-app | `output/playwright/prompt-m-viewer-image.png` |
| Document viewer (PDF) | Pass | Plus user -> Case timeline -> open PDF asset in-app | `output/playwright/prompt-m-viewer-pdf.png` |
| Post-checkout Plus unlocked state | Pass | Plus user -> Account tab shows active Plus state | `output/playwright/prompt-m-plus-unlocked-account.png` |

## Push Production Cutover Requirements
Current status: reminder scheduling, dedupe, suppression, retries, and audits are implemented; outbound send is still stubbed (`push_delivery_stub` in `apps/worker/src/worker.ts`).

Required cutover actions before enabling paid-user push in production:
1. Replace `sendPushToDevice` stub with real provider integration (APNs/FCM or chosen provider), including provider auth secret management.
2. Keep `PUSH_NOTIFICATIONS_ENABLED=false` until provider delivery is verified in staging with real device tokens.
3. Validate audit outcomes for live sends: `push_reminder_delivery` must show expected `scheduled|sent|failed|suppressed` distribution without abnormal fail spikes.
4. Confirm fallback behavior:
   - if push disabled: reminders are marked suppressed (`feature_disabled`) and no send attempts occur
   - if provider errors: retries/backoff (`PUSH_NOTIFICATIONS_RETRY_DELAY_SECONDS`, `PUSH_NOTIFICATIONS_MAX_RETRIES`) and final `failed` audit outcomes occur deterministically
5. Confirm operator controls:
   - global kill switch: `PUSH_NOTIFICATIONS_ENABLED`
   - daily user cap: `PUSH_NOTIFICATIONS_DAILY_LIMIT_PER_USER`
   - force-fail test path: `PUSH_NOTIFICATIONS_FORCE_FAIL` (staging only)

## Push Rollout Recommendation
1. Phase 0 (launch day): `PUSH_NOTIFICATIONS_ENABLED=false` for all paid users while billing and in-app premium flows run live.
2. Phase 1 (small cohort): enable push for internal + small pilot cohort only; monitor `push_reminder_delivery` audits for 48 hours.
3. Phase 2 (controlled pilot): expand to pilot cohort if send success/failure ratios are stable and no noisy suppression anomalies.
4. Phase 3 (broad enable): enable by default only after provider reliability and opt-out behavior are validated.

## Residual Risks
- Push delivery provider is not yet wired; push remains an operational follow-up for broad rollout.
- QA screenshot automation uses browser security-disabled mode in local evidence runs; production clients are unaffected.

## Decision
Go for controlled paid pilot now, with push rollout phased per the cutover plan above.
