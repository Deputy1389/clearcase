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

export function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function daysUntil(value: string): number | null {
  // Parse date-only strings (YYYY-MM-DD) as local midnight, not UTC
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const a = startOfLocalDay(d).getTime();
  const b = startOfLocalDay(new Date()).getTime();
  return Math.round((a - b) / 86400000);
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
