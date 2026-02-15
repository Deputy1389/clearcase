import { useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AppLanguage } from "../types";
import { parseLanguage } from "../utils/parsing";

const STORAGE_LANGUAGE = "clearcase.mobile.language";

export function useLanguage() {
  const [language, setLanguage] = useState<AppLanguage>("en");

  const setLanguageWithPersistence = useCallback(async (next: AppLanguage) => {
    setLanguage(next);
    try {
      await AsyncStorage.setItem(STORAGE_LANGUAGE, next);
    } catch {
      // Ignore storage failures.
    }
  }, []);

  const loadPersistedLanguage = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_LANGUAGE);
      if (stored) setLanguage(parseLanguage(stored));
    } catch {
      // Ignore storage failures.
    }
  }, []);

  return { language, setLanguage, setLanguageWithPersistence, loadPersistedLanguage };
}
