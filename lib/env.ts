// Reads environment variables in one place.
// Nothing here throws at import time, so `next build` works without secrets.

export function env(name: string, fallback = ""): string {
  return (process.env[name] ?? "").trim() || fallback;
}

export function envInt(name: string, fallback: number): number {
  const parsed = Number.parseInt(env(name), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function envList(name: string): string[] {
  return env(name)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export const currentVersion = () => env("CURRENT_VERSION", "2026-11");

export const genLimitPerUser = () => envInt("DAILY_GEN_LIMIT_PER_USER", 3);
export const chatLimitPerUser = () => envInt("DAILY_CHAT_LIMIT_PER_USER", 30);
export const globalDailyCap = () => envInt("GLOBAL_DAILY_AI_CALL_CAP", 500);

export const adminEmails = () =>
  envList("ADMIN_EMAILS").map((email) => email.toLowerCase());

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}

// Google login and the Gemini key are different things.
export const googleLoginConfigured = () =>
  Boolean(env("AUTH_GOOGLE_ID") && env("AUTH_GOOGLE_SECRET"));

// Dev email login is allowed only when explicitly switched on.
export const devLoginAllowed = () =>
  env("ALLOW_DEV_LOGIN", "false").toLowerCase() === "true" && !googleLoginConfigured();
