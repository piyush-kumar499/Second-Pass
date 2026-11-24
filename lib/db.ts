import { AsyncLocalStorage } from "node:async_hooks";
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
  /** Opens an explicit transaction. Every query inside its scope must use `driver`. */
  begin?(): Promise<{
    driver: DbDriver;
    commit(): Promise<void>;
    rollback(): Promise<void>;
  }>;
};

// Queries inside transaction(fn) are routed to the transaction's driver instead of
// the pooled client. This is what makes BEGIN/COMMIT work on Turso: the HTTP client
// cannot share a transaction state between separate requests.
const activeDriver = new AsyncLocalStorage<DbDriver>();

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

  async begin() {
    this.database.exec("BEGIN IMMEDIATE");
    return {
      driver: this as DbDriver,
      commit: async () => {
        this.database.exec("COMMIT");
      },
      rollback: async () => {
        this.database.exec("ROLLBACK");
      },
    };
  }
}

type RemoteClient = {
  execute(input: unknown): Promise<unknown>;
  transaction?(mode: string): Promise<{
    execute(input: unknown): Promise<unknown>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
  }>;
};

class RemoteDriver implements DbDriver {
  private client: RemoteClient;

  constructor(client: RemoteClient) {
    this.client = client;
  }

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

  async begin() {
    if (!this.client.transaction) {
      throw new Error("This database driver does not support transactions.");
    }
    const tx = await this.client.transaction("write");
    return {
      driver: new RemoteDriver(tx) as DbDriver,
      commit: () => tx.commit(),
      rollback: () => tx.rollback(),
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
  return new RemoteDriver(client as unknown as RemoteClient);
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

async function driver(): Promise<DbDriver> {
  return activeDriver.getStore() ?? db();
}

export async function all<T = Record<string, unknown>>(
  sql: string,
  args: InValue[] = [],
): Promise<T[]> {
  const result = await (await driver()).execute(sql, args);
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
  return (await driver()).execute(sql, args);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export async function transaction<T>(fn: () => Promise<T>): Promise<T> {
  // Nested calls join the transaction that is already open.
  if (activeDriver.getStore()) {
    return fn();
  }

  const current = await db();
  if (!current.begin) {
    throw new Error("This database driver does not support transactions.");
  }

  const tx = await current.begin();
  try {
    const result = await activeDriver.run(tx.driver, fn);
    await tx.commit();
    return result;
  } catch (error) {
    try {
      await tx.rollback();
    } catch {
      // The transaction may already be closed; the original error is the useful one.
    }
    throw error;
  }
}
