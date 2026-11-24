-- 001_init.sql — first schema for Second Pass.
-- Plain SQLite, runs on Turso (libSQL) and on a local file.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  image TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS branches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  short_code TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  semester INTEGER NOT NULL,
  scheme TEXT NOT NULL,
  is_common INTEGER NOT NULL DEFAULT 0,
  is_sample INTEGER NOT NULL DEFAULT 0,
  verified INTEGER NOT NULL DEFAULT 0,
  source_url TEXT,
  fetched_at TEXT,
  UNIQUE (code, scheme)
);

CREATE TABLE IF NOT EXISTS subject_branches (
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  PRIMARY KEY (subject_id, branch_id)
);

CREATE TABLE IF NOT EXISTS syllabus_units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  unit_no INTEGER NOT NULL,
  title TEXT NOT NULL,
  topics_json TEXT NOT NULL DEFAULT '[]',
  verified INTEGER NOT NULL DEFAULT 0,
  source_url TEXT,
  fetched_at TEXT,
  UNIQUE (subject_id, unit_no)
);

CREATE TABLE IF NOT EXISTS papers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  session TEXT NOT NULL,
  year INTEGER,
  source_note TEXT,
  source_url TEXT,
  fetched_at TEXT,
  verified INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  paper_id INTEGER REFERENCES papers(id) ON DELETE SET NULL,
  unit_no INTEGER,
  marks INTEGER,
  text TEXT NOT NULL,
  year INTEGER,
  session TEXT,
  hash TEXT NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0,
  flagged INTEGER NOT NULL DEFAULT 0,
  flag_reason TEXT,
  source_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (subject_id, hash)
);

CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  days_option INTEGER NOT NULL,
  version_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  content_json TEXT NOT NULL,
  model_used TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  report_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (subject_id, days_option, version_label)
);

CREATE TABLE IF NOT EXISTS page_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  user_id TEXT,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS usage_daily (
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  gen_count INTEGER NOT NULL DEFAULT 0,
  chat_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS generation_locks (
  key TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  locked_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task TEXT NOT NULL,
  model TEXT NOT NULL,
  key_label TEXT,
  tokens_in INTEGER,
  tokens_out INTEGER,
  latency_ms INTEGER,
  success INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_subjects_code ON subjects (code);
CREATE INDEX IF NOT EXISTS idx_subjects_name ON subjects (name);
CREATE INDEX IF NOT EXISTS idx_subjects_semester ON subjects (semester);
CREATE INDEX IF NOT EXISTS idx_subject_branches_branch ON subject_branches (branch_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_subject ON syllabus_units (subject_id, unit_no);
CREATE INDEX IF NOT EXISTS idx_papers_subject ON papers (subject_id, year);
CREATE INDEX IF NOT EXISTS idx_questions_subject_unit ON questions (subject_id, unit_no);
CREATE INDEX IF NOT EXISTS idx_questions_hash ON questions (subject_id, hash);
CREATE INDEX IF NOT EXISTS idx_pages_lookup ON pages (subject_id, days_option, version_label);
CREATE INDEX IF NOT EXISTS idx_pages_status ON pages (status, created_at);
CREATE INDEX IF NOT EXISTS idx_chats_user_page ON chats (user_id, page_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chats_page ON chats (page_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reports_page ON page_reports (page_id);
CREATE INDEX IF NOT EXISTS idx_ai_calls_date ON ai_calls (created_at);
