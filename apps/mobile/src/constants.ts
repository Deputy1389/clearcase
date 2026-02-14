export const DEFAULT_SUBJECT = "dev-subject-0001";
export const DEFAULT_EMAIL = "dev+dev-subject-0001@clearcase.local";

export const STORAGE_API_BASE = "clearcase.mobile.apiBase";
export const STORAGE_SUBJECT = "clearcase.mobile.subject";
export const STORAGE_EMAIL = "clearcase.mobile.email";
export const STORAGE_ONBOARDED = "clearcase.mobile.onboarded";
export const STORAGE_OFFLINE_SESSION = "clearcase.mobile.offlineSession";
export const STORAGE_PLAN_TIER = "clearcase.mobile.planTier";
export const STORAGE_LANGUAGE = "clearcase.mobile.language";
export const STORAGE_PUSH_DEVICE_ID = "clearcase.mobile.pushDeviceId";
export const STORAGE_INTAKE_PREFIX = "clearcase.mobile.intake";
export const STORAGE_STEP_STATUS_PREFIX = "clearcase.mobile.premiumSteps";
export const DEFAULT_PLUS_PRICE_MONTHLY = "$15/month";
export const IMAGE_UPLOAD_MAX_DIMENSION = 1600;
export const IMAGE_UPLOAD_QUALITY = 0.45;
export const MOBILE_BUILD_STAMP = "mobile-ui-2026-02-13b";

export function intakeStorageKey(caseId: string): string {
  return `${STORAGE_INTAKE_PREFIX}.${caseId}`;
}

export function stepStatusStorageKey(caseId: string): string {
  return `${STORAGE_STEP_STATUS_PREFIX}.${caseId}`;
}
