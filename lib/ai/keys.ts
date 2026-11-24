import { env } from "../env";

export type GroqKey = { label: string; value: string; cooldownUntil: number };

// A tiny key pool: round-robin across healthy keys, cooldown for failed ones.
export class KeyPool {
  private keys: GroqKey[] = [];
  private cursor = 0;

  constructor(
    entries: { label: string; value: string }[],
    private defaultCooldownMs = 60_000,
  ) {
    this.keys = entries
      .filter((entry) => entry.value.trim().length > 0)
      .map((entry) => ({ ...entry, cooldownUntil: 0 }));
  }

  get size(): number {
    return this.keys.length;
  }

  // Ordered list for this task, starting at the rotating cursor so load spreads out.
  candidates(labels: string[], now = Date.now()): GroqKey[] {
    const wanted = labels
      .map((label) => this.keys.find((key) => key.label === label))
      .filter((key): key is GroqKey => Boolean(key));
    if (wanted.length === 0) return [];

    const start = this.cursor % wanted.length;
    this.cursor += 1;
    const rotated = [...wanted.slice(start), ...wanted.slice(0, start)];
    return rotated.filter((key) => key.cooldownUntil <= now);
  }

  markFailure(label: string, retryAfterMs?: number, now = Date.now()): void {
    const key = this.keys.find((entry) => entry.label === label);
    if (!key) return;
    key.cooldownUntil = now + (retryAfterMs ?? this.defaultCooldownMs);
  }

  markSuccess(label: string): void {
    const key = this.keys.find((entry) => entry.label === label);
    if (key) key.cooldownUntil = 0;
  }

  // Used by tests and the admin dashboard.
  snapshot(now = Date.now()) {
    return this.keys.map((key) => ({
      label: key.label,
      healthy: key.cooldownUntil <= now,
      cooldownUntil: key.cooldownUntil,
    }));
  }
}

// Rebuilt lazily so tests and `next dev` pick up env changes.
function collect(prefix: string, max = 9): { label: string; value: string }[] {
  const entries: { label: string; value: string }[] = [];
  for (let i = 1; i <= max; i += 1) {
    const label = `${prefix}${i}`;
    const value = env(label);
    if (value) entries.push({ label, value });
  }
  return entries;
}

let groqPool: KeyPool | undefined;
let googleKey: string | undefined;

export function getGroqPool(): KeyPool {
  if (!groqPool) groqPool = new KeyPool(collect("GROQ_API"));
  return groqPool;
}

export function getGoogleKey(): string {
  if (googleKey === undefined) googleKey = env("GOOGLE_API1");
  return googleKey;
}

export function resetKeyPools(): void {
  groqPool = undefined;
  googleKey = undefined;
}

export function hasAnyKey(): boolean {
  return getGroqPool().size > 0 || Boolean(getGoogleKey());
}
