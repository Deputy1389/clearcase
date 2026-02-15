import * as Sentry from "@sentry/react-native";
import React from "react";
import { useAppController } from "./src/hooks/useAppController";
import { AppRouter } from "./src/AppRouter";

// --- Sentry error tracking ---
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() ?? "";
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.2,
    enableAutoSessionTracking: true,
    environment: __DEV__ ? "development" : "production"
  });
}

function App() {
  const controller = useAppController();

  return <AppRouter controller={controller} />;
}

export default SENTRY_DSN ? Sentry.wrap(App) : App;
