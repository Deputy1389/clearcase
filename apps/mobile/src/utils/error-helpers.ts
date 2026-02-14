import type { ApiError } from "../api";
import type { AppLanguage, PlusFeatureGate } from "../types";

export type FreeLimitApiPayload = {
  limit: number;
  used: number;
  remaining: number;
  resetAt: string;
};

export function summarizeError(error: unknown): string {
  if (error instanceof Error) {
    const apiError = error as ApiError;
    if (apiError.data && typeof apiError.data === "object") {
      const code = (apiError.data as Record<string, unknown>).error;
      if (typeof code === "string") return `${apiError.message} (${code})`;
    }
    return apiError.message;
  }
  return String(error);
}

export function withNetworkHint(error: unknown, apiBase: string): string {
  const message = summarizeError(error);
  const m = message.toLowerCase();
  const isNetworkFailure =
    m.includes("network request failed") ||
    m.includes("failed to fetch") ||
    m.includes("network error contacting api") ||
    m.includes("timed out") ||
    m.includes("health check failed") ||
    m.includes("api 502") ||
    m.includes("api 503") ||
    m.includes("api 504") ||
    m.includes("api 5");
  if (!isNetworkFailure) return message;
  return `${message}. Cannot reach API at ${apiBase}. Use your computer LAN IP (example: http://192.168.x.x:3001).`;
}

export function isPlusRequiredApiError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const apiError = error as ApiError;
  if (apiError.status !== 403) return false;
  if (!apiError.data || typeof apiError.data !== "object") return false;
  const payload = apiError.data as Record<string, unknown>;
  return payload.error === "PLUS_REQUIRED" && payload.code === "PLUS_REQUIRED";
}

export function parseFreeLimitApiError(error: unknown): FreeLimitApiPayload | null {
  if (!(error instanceof Error)) return null;
  const apiError = error as ApiError;
  if (apiError.status !== 403) return null;
  if (!apiError.data || typeof apiError.data !== "object") return null;
  const payload = apiError.data as Record<string, unknown>;
  if (payload.error !== "FREE_LIMIT_REACHED" || payload.code !== "FREE_LIMIT_REACHED") {
    return null;
  }

  const limit = typeof payload.limit === "number" ? payload.limit : Number(payload.limit);
  const used = typeof payload.used === "number" ? payload.used : Number(payload.used);
  const remaining = typeof payload.remaining === "number" ? payload.remaining : Number(payload.remaining);
  const resetAt = typeof payload.resetAt === "string" ? payload.resetAt : "";
  if (!Number.isFinite(limit) || !Number.isFinite(used) || !Number.isFinite(remaining) || !resetAt) {
    return null;
  }

  return {
    limit: Math.max(0, Math.floor(limit)),
    used: Math.max(0, Math.floor(used)),
    remaining: Math.max(0, Math.floor(remaining)),
    resetAt
  };
}

export function isFreeOcrDisabledApiError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const apiError = error as ApiError;
  if (apiError.status !== 403) return false;
  if (!apiError.data || typeof apiError.data !== "object") return false;
  const payload = apiError.data as Record<string, unknown>;
  return payload.error === "FREE_OCR_DISABLED" && payload.code === "FREE_OCR_DISABLED";
}

export function formatLimitResetAt(resetAtIso: string, language: AppLanguage): string {
  const parsed = new Date(resetAtIso);
  if (Number.isNaN(parsed.getTime())) {
    return language === "es" ? "fin del mes actual" : "the end of this month";
  }
  return parsed.toLocaleString();
}

export function plusUpgradeExplainer(language: AppLanguage, feature: PlusFeatureGate): string {
  if (language === "es") {
    if (feature === "watch_mode") {
      return "Esta funcion esta en Plus. Plus ayuda a muchas personas a reducir tiempo de explicaciones repetidas con una cronologia, recordatorios y paquete listo para consulta.";
    }
    return "Esta funcion esta en Plus. Plus ayuda a muchas personas a reducir tiempo de explicaciones repetidas con una cronologia, recordatorios y paquete listo para consulta.";
  }
  if (feature === "watch_mode") {
    return "This feature is on Plus. Plus helps many people avoid repeat explanation time by keeping one timeline, reminders, and a consultation-ready packet.";
  }
  return "This feature is on Plus. Plus helps many people avoid repeat explanation time by keeping one timeline, reminders, and a consultation-ready packet.";
}

export function isNetworkErrorLike(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("network error contacting api") ||
    m.includes("network request failed") ||
    m.includes("failed to fetch") ||
    m.includes("timed out") ||
    m.includes("cannot reach api") ||
    m.includes("health check failed") ||
    m.includes("api 502") ||
    m.includes("api 503") ||
    m.includes("api 504") ||
    m.includes("api 5")
  );
}
