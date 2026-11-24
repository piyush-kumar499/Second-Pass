import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

// A real SQLite file for the tests, created before any app module is imported.
const dir = mkdtempSync(path.join(tmpdir(), "aktu-test-"));
const file = path.join(dir, `db-${process.pid}.db`);

process.env.TURSO_DATABASE_URL = `file:${file}`;
delete process.env.TURSO_AUTH_TOKEN;
process.env.CURRENT_VERSION = "2026-11";
process.env.DAILY_GEN_LIMIT_PER_USER = "3";
process.env.DAILY_CHAT_LIMIT_PER_USER = "2";
process.env.GLOBAL_DAILY_AI_CALL_CAP = "1000";
process.env.ADMIN_EMAILS = "admin@example.com";
// Force the offline mock path in tests: no real AI calls.
for (let i = 1; i <= 9; i += 1) delete process.env[`GROQ_API${i}`];
delete process.env.GOOGLE_API1;

const database = new DatabaseSync(file);
const migrationFile = fileURLToPath(new URL("../db/migrations/001_init.sql", import.meta.url));
const sql = readFileSync(migrationFile, "utf8");
for (const statement of sql.split(/;\s*(?:\n|$)/).map((part) => part.trim()).filter(Boolean)) {
  database.exec(statement);
}
database.close();
