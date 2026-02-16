import { useState, useCallback, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_GUIDED_STEPS = "clearcase_guided_steps";

export function useGuidedAssistance(selectedCaseId: string | null) {
  const [stepCompletion, setStepCompletion] = useState<Record<string, boolean>>({});

  // Load from storage on mount
  useEffect(() => {
    async function load() {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_GUIDED_STEPS);
        if (saved) {
          setStepCompletion(JSON.parse(saved));
        }
      } catch (e) {
        console.warn("Failed to load guided steps", e);
      }
    }
    void load();
  }, []);

  const toggleStepCompletion = useCallback(async (instructionId: string, stepIndex: number) => {
    if (!selectedCaseId) return;
    const key = `${selectedCaseId}:${instructionId}:${stepIndex}`;
    
    setStepCompletion(prev => {
      const next = { ...prev, [key]: !prev[key] };
      // Persist
      void AsyncStorage.setItem(STORAGE_GUIDED_STEPS, JSON.stringify(next));
      return next;
    });
  }, [selectedCaseId]);

  const isStepCompleted = useCallback((instructionId: string, stepIndex: number) => {
    if (!selectedCaseId) return false;
    const key = `${selectedCaseId}:${instructionId}:${stepIndex}`;
    return !!stepCompletion[key];
  }, [selectedCaseId, stepCompletion]);

  return {
    stepCompletion,
    toggleStepCompletion,
    isStepCompleted
  };
}
