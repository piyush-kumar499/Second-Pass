import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

// One tiny database interface with two drivers:
// - local file  -> node:sqlite (no native packages, works on the phone and on any Node 22+ host)
// - Turso       -> @libsql/client/web over HTTPS/WebSockets (loaded only when a remote URL is set)
// This keeps `npm install` free of native builds, and production still uses Turso exactly as planned.

export type InValue = string | number | bigint | boolean | null | Uint8Array;

export type DbResult = {
  rows: Record<string, unknown>[];
  rowsAffected: number;
  lastInsertRowid: number | bigint;
};

export type DbDriver = {
  execute(sql: string, args?: InValue[]): Promise<DbResult>;
};

function normalise(args: InValue[]): (string | number | bigint | null | Uint8Array)[] {
  return args.map((value) => {
    if (typeof value === "boolean") return value ? 1 : 0;
    if (value === undefined) return null;
    return value as string | number | bigint | null | Uint8Array;
  });
}

class LocalDriver implements DbDriver {
  private database: DatabaseSync;

  constructor(file: string) {
    mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    this.database = new DatabaseSync(file);
    this.database.exec("PRAGMA journal_mode = WAL");
    this.database.exec("PRAGMA foreign_keys = ON");
    this.database.exec("PRAGMA busy_timeout = 5000");
  }

  async execute(sql: string, args: InValue[] = []): Promise<DbResult> {
    const statement = this.database.prepare(sql);
    const values = normalise(args);

    if (statement.columns().length > 0) {
      const rows = statement.all(...values) as Record<string, unknown>[];
      return { rows: rows.map((row) => ({ ...row })), rowsAffected: 0, lastInsertRowid: 0 };
    }

    const info = statement.run(...values);
    return {
      rows: [],
      rowsAffected: Number(info.changes),
      lastInsertRowid: info.lastInsertRowid,
    };
  }
}

class RemoteDriver implements DbDriver {
  constructor(private client: { execute(input: unknown): Promise<unknown> }) {}

  async execute(sql: string, args: InValue[] = []): Promise<DbResult> {
    const result = (await this.client.execute({ sql, args })) as {
      rows: Record<string, unknown>[];
      rowsAffected: number;
      lastInsertRowid?: number | bigint;
    };
    return {
      rows: result.rows.map((row) => ({ ...row })),
      rowsAffected: Number(result.rowsAffected ?? 0),
      lastInsertRowid: result.lastInsertRowid ?? 0,
    };
  }
}

const globalForDb = globalThis as unknown as { __dbDriver?: DbDriver; __dbReady?: Promise<DbDriver> };

export function databaseUrl(): string {
  return process.env.TURSO_DATABASE_URL?.trim() || "file:./data/dev.db";
}

async function createDriver(): Promise<DbDriver> {
  const url = databaseUrl();

  if (url.startsWith("file:")) {
    return new LocalDriver(url.slice("file:".length));
  }

  // Remote Turso. The web build is pure JavaScript, so it never needs a native binary.
  const { createClient } = await import("@libsql/client/web");
  const client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN?.trim() || undefined,
  });
  return new RemoteDriver(client);
}

export function db(): Promise<DbDriver> {
  if (!globalForDb.__dbReady) {
    globalForDb.__dbReady = createDriver().then((driver) => {
      globalForDb.__dbDriver = driver;
      return driver;
    });
  }
  return globalForDb.__dbReady;
}

export async function all<T = Record<string, unknown>>(
  sql: string,
  args: InValue[] = [],
): Promise<T[]> {
  const result = await (await db()).execute(sql, args);
  return result.rows as T[];
}

export async function one<T = Record<string, unknown>>(
  sql: string,
  args: InValue[] = [],
): Promise<T | null> {
  const rows = await all<T>(sql, args);
  return rows[0] ?? null;
}

export async function run(sql: string, args: InValue[] = []): Promise<DbResult> {
  return (await db()).execute(sql, args);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export async function transaction<T>(fn: () => Promise<T>): Promise<T> {
  const client = await db();
  await client.execute("BEGIN IMMEDIATE");
  try {
    const result = await fn();
    await client.execute("COMMIT");
    return result;
  } catch (error) {
    await client.execute("ROLLBACK");
    throw error;
  }
}
