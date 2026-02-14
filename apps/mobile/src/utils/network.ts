import { Platform, NativeModules } from "react-native";
import type { AuthHeaders } from "../api";
import { DEFAULT_SUBJECT, DEFAULT_EMAIL } from "../constants";

export const ENV_API_BASE = process.env.EXPO_PUBLIC_API_BASE?.trim() || null;

export function extractMetroHost(): string | null {
  const scriptUrl = (NativeModules as { SourceCode?: { scriptURL?: string } }).SourceCode?.scriptURL;
  if (!scriptUrl) return null;
  const match = scriptUrl.match(/^https?:\/\/([^/:]+)(?::\d+)?\//i);
  return match?.[1] ?? null;
}

export function isLoopbackHost(host: string): boolean {
  return host === "127.0.0.1" || host === "localhost" || host === "10.0.2.2";
}

export function isPrivateIpv4Host(host: string): boolean {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return false;
  const parts = host.split(".").map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false;
  if (parts[0] === 10) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  return false;
}

export function isLoopbackApiBase(base: string): boolean {
  return /:\/\/(127\.0\.0\.1|localhost|10\.0\.2\.2)(:\d+)?$/i.test(base.trim());
}

export function extractHostFromApiBase(base: string): string | null {
  const match = base.trim().match(/^https?:\/\/([^/:?#]+)(?::\d+)?/i);
  return match?.[1] ?? null;
}

export function isLocalApiBase(base: string): boolean {
  const host = extractHostFromApiBase(base);
  if (!host) return false;
  return isLoopbackHost(host) || isPrivateIpv4Host(host);
}

export function resolveDefaultApiBase(): string {
  if (ENV_API_BASE) return ENV_API_BASE;
  const metroHost = extractMetroHost();
  if (metroHost && isPrivateIpv4Host(metroHost)) {
    return `http://${metroHost}:3001`;
  }
  return (
    Platform.select({
      android: "http://10.0.2.2:3001",
      ios: "http://127.0.0.1:3001",
      default: "http://127.0.0.1:3001"
    }) ?? "http://127.0.0.1:3001"
  );
}

export const DEFAULT_API_BASE = resolveDefaultApiBase();

export function buildHeaders(subject: string, email: string): AuthHeaders {
  return {
    "x-auth-subject": subject.trim() || DEFAULT_SUBJECT,
    "x-user-email": email.trim() || DEFAULT_EMAIL
  };
}
