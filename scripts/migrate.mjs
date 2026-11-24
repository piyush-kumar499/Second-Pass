// Runs db/migrations/*.sql in order, once each.
// Works with a local SQLite file (node:sqlite) or Turso (@libsql/client/web).
// Usage: npm run db:migrate
import { readdir, readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

async function loadEnv() {
  try {
    const text = await readFile(".env", "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // No .env: defaults are used.
  }
}

await loadEnv();

const url = process.env.TURSO_DATABASE_URL?.trim() || "file:./data/dev.db";

async function makeDriver() {
  if (url.startsWith("file:")) {
    const file = path.resolve(url.slice("file:".length));
    await mkdir(path.dirname(file), { recursive: true });
    const database = new DatabaseSync(file);
    database.exec("PRAGMA journal_mode = WAL");
    return {
      execute: async (sql) => {
        const statement = database.prepare(sql);
        if (statement.columns().length > 0) return { rows: statement.all(), rowsAffected: 0 };
        const info = statement.run();
        return { rows: [], rowsAffected: Number(info.changes) };
      },
    };
  }

  const { createClient } = await import("@libsql/client/web");
  const client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN?.trim() || undefined,
  });
  return {
    execute: async (sql) => {
      const result = await client.execute(sql);
      return { rows: result.rows, rowsAffected: Number(result.rowsAffected ?? 0) };
    },
  };
}

const db = await makeDriver();

await db.execute(`
  CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

const dir = path.resolve("db/migrations");
const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
const done = new Set(
  (await db.execute("SELECT name FROM _migrations")).rows.map((row) => String(row.name)),
);

let applied = 0;
for (const file of files) {
  if (done.has(file)) continue;
  const sql = await readFile(path.join(dir, file), "utf8");
  const statements = sql
    .split(/;\s*(?:\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);

  await db.execute("BEGIN");
  try {
    for (const statement of statements) await db.execute(statement);
    await db.execute(`INSERT INTO _migrations (name) VALUES ('${file.replace(/'/g, "''")}')`);
    await db.execute("COMMIT");
    applied += 1;
    console.log(`✓ ${file}`);
  } catch (error) {
    await db.execute("ROLLBACK");
    console.error(`✗ ${file}:`, error);
    process.exit(1);
  }
}

console.log(applied === 0 ? "Database is already up to date." : `Applied ${applied} migration(s).`);
console.log(`Database: ${url.startsWith("file:") ? path.resolve(url.slice(5)) : url}`);
process.exit(0);
