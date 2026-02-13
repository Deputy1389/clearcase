# QA_PLUS_DEVICE_CHECKLIST

Device QA checklist for Plus entitlement UX and paid-value flows.

## Matrix

| Area | Scenario | Expected result | Status (Pass/Fail/Pending) | Notes |
|---|---|---|---|---|
| Free-limit hit UX | Free finalize reaches monthly cap | Calm quota contract is returned and UI has mapped copy/upgrade path | Pass | API regression coverage is green (`apps/api/tests/free-limit.api.test.mjs`), including `FREE_LIMIT_REACHED`; mobile branch mapping was verified in `apps/mobile/App.tsx` during copy pass. |
| Watch mode toggle behavior | Plus user toggles watch mode on/off from Workspace | Toggle saves, state persists after refresh, micro-events render in calm tone | Pass | Verified on case `cmljzxf1v002rrswoo5itdpo3`; toggled off/on, refreshed, and state persisted. Evidence: `output/playwright/prompt-c-watch-mode-plus-on.png`. |
| Watch mode toggle behavior | Free user views Workspace Plus preview | Locked watch-mode state is visible before any API call; upgrade CTA is present | Pass | Free workspace shows `Case Watch Mode locked on Free` + `Upgrade to Plus` with no API error fallback required. Evidence: `output/playwright/prompt-c-free-lock-preview-en.png`. |
| Consult-link create/list/disable | Plus user creates 7-day consult link in packet modal | Link appears in list with `id`, `tokenPreview`, `status=statusReason=active` | Pass | Packet modal created links with `ID lnk_*`, token preview, active status. Evidence: `output/playwright/prompt-c-consult-link-active.png`. |
| Consult-link create/list/disable | Plus user disables active link | Disable returns success, link status becomes disabled, repeat disable remains idempotent | Pass | UI disable shows disabled status. API repeat-disable idempotency verified (`disabled=true` on first and second call for same token). Evidence: `output/playwright/prompt-c-consult-link-disabled.png`. |
| Consult-link create/list/disable | Free user attempts Plus consult-link paths | User sees upgrade explainer + CTA (no generic failure banner) | Pass | Free flow displays upgrade sheet (`Current plan: ClearCase Free`, `Start Plus monthly`) without generic failure banner. Evidence: `output/playwright/prompt-c-free-upgrade-modal-en.png`. |
| Packet history visibility | Plus user opens lawyer-ready packet modal | Packet history section is visible with version rows when audit entries exist | Pass | After saving case context, packet modal shows version row (`Packet v1 - after context added`). Evidence: `output/playwright/prompt-c-packet-history-visible.png`. |
| Free lock-state messaging | Free user explores Plus surfaces | Clear lock states shown for watch mode and packet links with neutral EN/ES language | Pass | EN lock-state validated in free preview; ES case view validated with no mixed-language lock artifacts after copy cleanup. Evidence: `output/playwright/prompt-c-free-lock-preview-en.png`, `output/playwright/prompt-c-workspace-spanish-consistent.png`. |
| Offline/reconnect behavior | Device goes offline then reconnects during Plus flows | Offline message is calm and explicit; reconnect restores actions without stale error state | Pass | With API stopped, watch toggle shows explicit connectivity error; after API restart, same toggle succeeds and state updates. Evidence: `output/playwright/prompt-c-offline-error-watch.png`, `output/playwright/prompt-c-offline-recovered-watch.png`. |
