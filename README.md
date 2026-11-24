# Second Pass

A revision notebook for B.Tech students. A student picks a subject and how many days are left; the app opens a saved revision page or generates one, with a cheat sheet, unit notes, important questions, numericals and diagrams. Guests can browse and read. Generating, chatting and admin tools need a login.

The first data pack covers the AKTU B.Tech first-year syllabus. The product name is independent of the university; AKTU appears below only where the syllabus or paper source is being cited.

Built with Next.js App Router, TypeScript, Tailwind, SQLite/Turso, Zod, Auth.js, Groq and Gemini. KaTeX renders formulas and Mermaid renders diagrams with `securityLevel: "strict"`.

---

## Status

Working end to end:

- Public home page with subject search, branch/semester filters and a "how many days" wizard.
- 11 day-option cards on every subject page (`Full Syllabus`, `1 Day` … `10 Days`).
- Public browse, subject and saved-page views; print styles; report button; version badges.
- Revision pages are tabbed: **Unit 1 … Unit N** plus **Most important, Formulas, Numericals, Diagrams**. One tab is open at a time, the strip stays visible and scrolls sideways on phones, and Print shows every tab as one sheet. Unit 1 opens first; a 1-day page opens on its cheat sheet.
- A floating **Ask AI** button on every revision page. It opens a chat sheet (bottom sheet on phones, panel on desktop), keeps history, and offers starter questions.
- Generation with cache lookup, 3-minute lock, daily per-user limit, global AI-call cap, Zod validation, one JSON retry, key failover, and a syllabus-only fallback when no AI keys exist.
- Chat saved in SQLite, limited per user per day, with history restored on refresh.
- Google login, plus a dev-only email login for local testing. Admin allow-list by email.
- Admin: CSV import, paper PDF/paste ingestion, question review, page publish/hide, report review and page hiding.
- Automated tests for cache keys, the generation lock, limits, Zod retry and 429 failover.

Data status:

- **Sample rows** (`SAMPLE101`–`SAMPLE104`) are clearly labelled `is_sample = 1`. They exist only so the app can be tested.
- **Real rows** for `BAS101`, `BAS103` and `BCS101` were imported from official AKTU syllabus pages. Every real row is `verified = 0` until the owner approves it in `/admin`.
- Real papers: one 2024-25 paper each for BAS101 and BCS101. BAS103's paper was found but not imported because its maths text extracts as broken glyphs.

See [data/REPORT.md](data/REPORT.md) and [data/conflicts.md](data/conflicts.md).

---

## Requirements

- Node.js **22.5 or newer** (the local database uses `node:sqlite`). Node 24 or 26 is fine.
- npm 10+.
- Optional: a Turso database, Google OAuth credentials, Groq keys and/or a Gemini key.

No AI key is needed to run the app. Without keys it creates a syllabus-only draft, clearly marked, and never invents past-paper questions.

---

## Quick start

```bash
npm install
cp .env.example .env      # then edit AUTH_SECRET and ADMIN_EMAILS
npm run db:migrate
npm run db:seed           # optional sample subjects
npm run db:import-real    # optional real first-year subjects and papers
npm run dev
```

Open <http://localhost:3000>.

For a dev login, keep `ALLOW_DEV_LOGIN=true` and `AUTH_GOOGLE_ID` empty. On `/login`, enter the email in `ADMIN_EMAILS` to get admin access.

Build and check:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

---

## Environment variables

Copy `.env.example` to `.env` and fill in what you have. It is a complete template: site URL, database, auth, every Groq key, the Gemini key, models, admin emails and limits. Never commit `.env` (it is in `.gitignore`).

| Variable | What it does |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Absolute site URL used in metadata, e.g. `http://localhost:3000`. |
| `TURSO_DATABASE_URL` | Empty or `file:./data/dev.db` for local SQLite. Use `libsql://...` for Turso. |
| `TURSO_AUTH_TOKEN` | Turso token. Not needed for a local file. |
| `AUTH_SECRET` | Session signing secret. Generate with `openssl rand -base64 32`. |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth client. Leave empty to use dev email login. |
| `ALLOW_DEV_LOGIN` | `true` enables email login **only while Google is not configured**. Set `false` in production. |
| `GROQ_API1` … `GROQ_API4` | Up to four Groq keys. They rotate per task and cool down after a 429. |
| `GOOGLE_API1` | Gemini key, used as the fallback provider. |
| `MODEL_GENERATE` / `MODEL_CHAT` / `MODEL_INGEST` / `MODEL_FALLBACK` | Optional model overrides; defaults are in `lib/ai/config.ts`. |
| `ADMIN_EMAILS` | Comma-separated emails that can open `/admin`. |
| `CURRENT_VERSION` | `YYYY-MM`. Part of the cache key; bump it to make every page regenerate. |
| `DAILY_GEN_LIMIT_PER_USER` | Generations per user per day. Default `3`. |
| `DAILY_CHAT_LIMIT_PER_USER` | Chat messages per user per day. Default `30`. |
| `GLOBAL_DAILY_AI_CALL_CAP` | Hard stop for all AI calls per day. Default `500`. |

---

## Database

### Local SQLite (default)

- File: `data/dev.db` (git-ignored).
- Driver: `node:sqlite` `DatabaseSync`.
- Schema: `db/migrations/001_init.sql`.
- `db/migrate` records applied files in `_migrations`, so it is safe to run repeatedly.

### Turso

1. Create a database in the [Turso dashboard](https://turso.tech) or with the Turso CLI.
2. Put the `libsql://...` URL in `TURSO_DATABASE_URL` and its token in `TURSO_AUTH_TOKEN`.
3. Run `npm run db:migrate`.
4. Seed/import:
   - locally first, then copy, **or**
   - use the admin CSV import in `/admin/subjects` against the Turso-backed app.

Remote queries use `@libsql/client/web` (pure HTTP), not the native `libsql` package. This is deliberate: the native package has no Android binding.

> `npm run db:seed` and `npm run db:import-real` accept a local `file:` URL or a Turso URL. The seed refuses to write to anything that is not a local file (to avoid overwriting production); the real-data importer supports both.

**Important:** a fresh Turso database is empty. Apply the migration before the first request.

---

## Google OAuth

1. Open [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials).
2. Create an **OAuth client ID** of type *Web application*.
3. Add the redirect URI:
   - Local: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://your-domain.example/api/auth/callback/google`
4. Put the client ID and secret in `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.
5. Set `ALLOW_DEV_LOGIN=false`.

Auth.js uses JWT sessions. The chat is a popup, not an inline form. `components/ChatWidget.tsx` renders the floating button, the modal sheet, Esc/backdrop closing, body scroll lock and the saved history. The old inline `ChatPanel.tsx` was removed. The app keeps its own `users` table and upserts the profile on sign-in, so the database works the same with Google or the dev provider.

---

## AI keys

- Groq is the primary provider. Add one or more of `GROQ_API1` … `GROQ_API4`.
- Gemini is the fallback. Add `GOOGLE_API1` if you have one.
- Keys are tried in a rotating order. A key that returns 429/5xx is cooled down and skipped. A bad JSON answer gets one correction attempt on the same key, then the next key is tried.
- Every AI call is logged to `ai_calls` with task, model, key label, tokens, latency, success and error. The global daily cap counts these rows.
- With no keys, generation returns a sample/syllabus-only page and chat returns a short "AI is not configured" reply. No exam questions are invented.

No code change is needed when real keys are added; only `.env` changes.

---

## Import real data

### Re-runnable importer (included)

`data/real/aktu-first-year.json` holds the real first-year subjects and the two imported papers. `scripts/import-real.mjs`:

- inserts subjects, units, papers and questions;
- writes `verified = 0`;
- skips duplicate questions by the same hash the app uses;
- never overwrites a row the admin already verified.

```bash
npm run db:import-real
```

### Admin UI

- `/admin/subjects` — paste or upload a CSV of subjects and syllabus units. Two steps: preview, then commit.
- `/admin/papers` — upload a paper PDF or paste its text, let the AI extract questions, edit the table, then save. If no AI key is configured, add questions by hand.
- `/admin/questions` — verify, flag, clear a flag, or delete a question. Filter by subject or "flagged only".
- `/admin/pages` — publish, hide or return a page to draft. See reports and view counts.
- `/admin/reports` — review reports; dismiss them, publish or hide the page.

CSV formats are shown inside the import panel and in `lib/csv.ts`. Subject rows accept `code,name,semester,scheme,is_common,branches,source_url`; unit rows accept `code,scheme,unit_no,title,topics,source_url` (topics separated by semicolons). Questions are added through the paper ingest panel, not a question CSV.

---

## Data notes and missing data

Complete:

- Official first-year subject codes, names and five units each for **BAS101 Engineering Physics**, **BAS103 Engineering Mathematics-I** and **BCS101 Programming for Problem Solving**, from the official 2022-23 AKTU syllabus PDF.
- 21 BAS101 questions and 22 BCS101 questions from their 2024-25 papers, stored unverified with a source link.
- Deduplication, garble flags and unit guesses for imported questions.

Partial:

- Only three first-year subjects, one paper each. The brief asks for many years and all branches.
- The 2022-23 first-year scheme is the latest official first-year document found. The official 2024-25 page has no first-year PDF.

Missing:

- Current-scheme first-year papers on the official AKTU old-question-paper page (it indexes older codes such as `CE-401`).
- BAS103 questions: the 2024-25 paper's maths text layer is broken, and rewriting it by hand was not done.
- Papers for other branches, semesters and years; branch-specific subject lists; later-year syllabi.
- The Hindi side of bilingual papers (broken font, English kept instead).

Skipped on purpose:

- `aktuonline.com` disallows AI crawlers in `robots.txt`.
- No paywall, login or block was bypassed.
- No PDF copies are committed or served; the app stores extracted text plus a source URL.

Sources opened are listed in [data/REPORT.md](data/REPORT.md); disagreements are in [data/conflicts.md](data/conflicts.md).

---

## Tests

```bash
npm test
```

Covered:

- Cache key depends only on subject, days option and version. Branch and the user's note do not change it.
- Two simultaneous generations produce one created page; the other waits or reports the lock.
- Daily per-user generation/chat limits, refund on failure, and the global daily AI-call cap.
- Bad AI JSON is rejected and retried once with the validation error, then fails over.
- A 429 marks the key as cooling down and moves to the next key.

The test environment forces the offline mock path, so no real AI calls are made.

---

## Look and feel

The interface is a warm paper notebook rather than a generic dashboard: cream paper with faint graph dots, serif headings, monospace labels, pine-green ink, a highlighter behind key words, and cards with a flat offset shadow. Tokens live in `tailwind.config.ts`; shared classes (`.card`, `.btn-primary`, `.chip`, `.input`, `.marker`, `.paper-note`) live in `app/globals.css`. Every public page is laid out for phones first (single column, 11 day cards in a 2-column grid, horizontally scrolling unit tabs, bottom-sheet chat) and widens cleanly on tablets and laptops.

## Revision page tabs

`lib/revision-views.ts` turns the saved page JSON into tabs. It groups sections by `unit_no`, then by template, drops exact duplicates written by older full-pack pages, keeps the “About this draft” note above the tabs, and picks Unit 1 (or the cheat sheet on pages without units) as the default. No AI call is made when switching tabs, so it works on every already-saved page. `components/RevisionTabs.tsx` handles the interaction, keyboard arrows, and print-all. Tests are in `tests/revision-views.test.ts`.

## Project structure

```
app/
  page.tsx                 home + days wizard
  browse/                  public subject browse
  subject/[id]/            11 day cards and existing pages
  page/[id]/               revision page, chat, print, report
  login/                   Google or dev email login
  admin/                   dashboard, subjects, papers, questions, pages, reports
  api/                     auth, subjects, generate, status, chat, report, admin import/ingest
components/
  ChatWidget.tsx           floating Ask AI button + popup chat
  RevisionTabs.tsx         unit/study tabs on a revision page
  blocks/                  block renderer, KaTeX, Mermaid
  admin/                   CSV import and paper ingest panels
lib/
  ai/                      config, key pool, Groq/Gemini clients, prompts, runner, mock
  db.ts                    local SQLite / Turso driver
  generate.ts              cache → lock → AI/mock → validate → save
  chat.ts                  saved chat and limits
  pages.ts                 page CRUD, versions, reports
  subjects.ts              subject/unit/question queries
  schema/                  Zod schemas
db/migrations/             plain SQL
scripts/                   migrate, seed, real-data import, test runner
data/real/                 typed real data (tracked)
data/REPORT.md             research report (tracked)
data/conflicts.md          source conflicts (tracked)
tests/                     Vitest tests
```

---

## Assumptions

- A page is shared by everyone for the same **subject + days option + `CURRENT_VERSION`**. Branch and the user's note are not part of the cache key.
- The first person to request a missing page generates it; others wait for the same page instead of starting a second AI call.
- A page starts as `draft` ("AI draft — not verified"). Publishing is an admin action.
- Five reports hide a page automatically. An admin can publish it again.
- "Full Syllabus" (`0` days) is the deep full pack; `1` day is the shortest plan.
- Real imported data stays unverified until the owner approves it. The "Unverified data" badge is not cosmetic.
- The local sample data is not real AKTU material and must not be treated as such.

## Known limitations

- No background job queue: a long generation is held by a 3-minute lock and polled by the client. A server restart drops the lock after it expires.
- The AI mock is a syllabus outline, not a substitute for a real generation.
- The real dataset is intentionally small; see **Missing data** above.
- Rate limiting is database-based and intended for a single small deployment, not a large multi-region one.
- PDF text extraction depends on the PDF's text layer. Scanned or embedded-math PDFs need manual review, which the admin preview supports.

---

## Android / shared-storage notes

This project was built on `/storage/emulated/0`, which is FUSE-mounted and forbids symlinks and `exec`. The following changes make it work there; they are harmless on a normal laptop:

- `.npmrc` sets `bin-links=false`. Scripts call binaries as `node node_modules/...` instead of relying on `.bin` symlinks.
- Install with `npm install --force`. The native `libsql@0.5.x` package declares no Android platform, so npm reports `EBADPLATFORM`; the app never imports its native binding (remote Turso uses `@libsql/client/web`).
- `next dev` and `next build` use `--webpack`. Turbopack has no Android native binding in this Next.js version.
- Tailwind is v3 with PostCSS. Tailwind v4's `lightningcss` native binding is unavailable here.
- `npm test` copies the esbuild binary to the system temp folder before running, because `node_modules` is on a `noexec` mount. On a normal machine it just runs Vitest.
- The `rollup` override in `package.json` points at the WASM build for the same reason. Remove it on a normal machine if you prefer the native build.

## Security notes

- AI text is rendered as React text and validated by Zod. No `dangerouslySetInnerHTML` for AI content.
- Mermaid runs with `securityLevel: "strict"`, and the resulting SVG is imported through `DOMParser`, not injected as an HTML string.
- Admin routes check the session and the `ADMIN_EMAILS` allow-list on the server.
- Generated pages are untrusted drafts until an admin publishes them.
- The dev email provider is off when Google is configured and can be disabled explicitly with `ALLOW_DEV_LOGIN=false`.
