import type { IntakeDraft, StepProgress, PlanTier, AppLanguage } from "../types";
import { STORAGE_INTAKE_PREFIX, STORAGE_STEP_STATUS_PREFIX } from "../constants";

export function intakeStorageKey(caseId: string): string {
  return `${STORAGE_INTAKE_PREFIX}.${caseId}`;
}

export function stepStatusStorageKey(caseId: string): string {
  return `${STORAGE_STEP_STATUS_PREFIX}.${caseId}`;
}

export function emptyIntakeDraft(): IntakeDraft {
  return {
    matterSummary: "",
    clientGoals: "",
    constraints: "",
    timelineNarrative: "",
    partiesAndRoles: "",
    communicationsLog: "",
    financialImpact: "",
    questionsForCounsel: "",
    desiredOutcome: ""
  };
}

export function parseStepProgress(value: unknown): StepProgress | null {
  if (value === "not_started" || value === "in_progress" || value === "done" || value === "deferred") {
    return value;
  }
  return null;
}

export function parseIntakeDraft(value: unknown): IntakeDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const read = (field: keyof IntakeDraft): string => {
    const raw = row[field];
    return typeof raw === "string" ? raw : "";
  };
  return {
    matterSummary: read("matterSummary"),
    clientGoals: read("clientGoals"),
    constraints: read("constraints"),
    timelineNarrative: read("timelineNarrative"),
    partiesAndRoles: read("partiesAndRoles"),
    communicationsLog: read("communicationsLog"),
    financialImpact: read("financialImpact"),
    questionsForCounsel: read("questionsForCounsel"),
    desiredOutcome: read("desiredOutcome")
  };
}

export function parsePlanTier(value: string | null): PlanTier | null {
  if (value === "free") return "free";
  if (value === "plus" || value === "plus_subscription" || value === "plus_case_month") return "plus";
  return null;
}

export function planTierLabel(value: PlanTier): string {
  if (value === "plus") return "ClearCase Plus";
  return "ClearCase Free";
}

export function planTierShort(value: PlanTier): string {
  if (value === "plus") return "Plus";
  return "Free";
}

export function parseLanguage(value: string | null): AppLanguage | null {
  if (value === "en" || value === "es") return value;
  return null;
}

export function languageLabel(value: AppLanguage): string {
  return value === "es" ? "Espanol" : "English";
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}
