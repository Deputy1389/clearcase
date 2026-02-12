# ClearCase Mobile (Expo)

This app is the mobile-first client for ClearCase.

## Run

From repo root:

```powershell
npm run api:start
```

In a second terminal:

```powershell
npm run worker:start
```

In a third terminal:

```powershell
npm run mobile:start
```

## Open on phone (Expo Go)

1. Install Expo Go on your phone.
2. Use the URL from Expo CLI (or scan the QR code if shown).
3. In the app, open the `Connection` card and set API base:
   - Physical phone on LAN: `http://<YOUR_COMPUTER_IP>:3001`
   - Android emulator: `http://10.0.2.2:3001`
   - iOS simulator: `http://127.0.0.1:3001`
4. Tap `Apply`, then `Test + Refresh`.

Connection settings are persisted locally in the app.

## Key flows implemented

- Connection health check (`/health`)
- Profile read/update (`/me`, `PATCH /me`)
- Case list/create (`/cases`)
- Case detail (`/cases/:id`)
- Upload-init + file upload (`/cases/:id/assets`)
- Pipeline status, receipts, and latest extraction/verdict preview
