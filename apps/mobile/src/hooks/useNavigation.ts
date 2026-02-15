import { useState, useCallback } from "react";
import type { Screen, ContentScreen } from "../types";

export function useNavigation() {
  const [screen, setScreen] = useState<Screen>("language");
  const [postLanguageScreen, setPostLanguageScreen] = useState<ContentScreen>("onboarding");

  const goBack = useCallback((fallback: Screen = "home") => {
    setScreen(fallback);
  }, []);

  return { screen, setScreen, postLanguageScreen, setPostLanguageScreen, goBack };
}
