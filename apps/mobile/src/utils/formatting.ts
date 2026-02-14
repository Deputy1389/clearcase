import type { AppLanguage } from "../types";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function confidenceLabel(value: number | null): string {
  if (value === null) return "unknown";
  if (value >= 0.85) return "high";
  if (value >= 0.6) return "medium";
  return "low";
}

export function localizedConfidenceLabel(language: AppLanguage, value: number | null): string {
  const label = confidenceLabel(value);
  if (language === "en") return label;
  if (label === "high") return "alta";
  if (label === "medium") return "media";
  if (label === "low") return "baja";
  return "desconocida";
}

export function fmtIsoDate(value: string | null | undefined): string {
  if (!value) return "Unknown";
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
}

export function titleize(value: string): string {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function daysUntil(value: string): number | null {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const now = Date.now();
  return Math.ceil((d.getTime() - now) / (1000 * 60 * 60 * 24));
}

export function fmtDate(value: string | null, language: AppLanguage = "en"): string {
  if (!value) return language === "es" ? "No se detecta fecha" : "No deadline detected";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString();
}

export function fmtDateTime(value: string | null): string {
  if (!value) return "Unknown";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
