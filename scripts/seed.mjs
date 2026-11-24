// Sample data only. Real AKTU data must come from the sources listed in README.md
// and /data/REPORT.md. Safe to run many times: nothing is duplicated.
// Usage: npm run db:seed
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
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
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // no .env
  }
}

await loadEnv();

const url = process.env.TURSO_DATABASE_URL?.trim() || "file:./data/dev.db";
if (!url.startsWith("file:")) {
  console.error("Seed writes only to a local file database. Unset TURSO_DATABASE_URL to seed locally.");
  process.exit(1);
}

const file = path.resolve(url.slice("file:".length));
await mkdir(path.dirname(file), { recursive: true });
const database = new DatabaseSync(file);
database.exec("PRAGMA journal_mode = WAL");
database.exec("PRAGMA foreign_keys = ON");

const execute = (sql, args = []) => {
  const statement = database.prepare(sql);
  const values = args.map((v) => (typeof v === "boolean" ? (v ? 1 : 0) : v === undefined ? null : v));
  if (statement.columns().length > 0) return statement.all(...values);
  return statement.run(...values);
};

function hashQuestion(text) {
  const normalised = text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return createHash("sha256").update(normalised).digest("hex").slice(0, 32);
}

const branches = [
  ["Computer Science & Engineering", "CSE"],
  ["Information Technology", "IT"],
  ["Electronics & Communication Engineering", "ECE"],
  ["Mechanical Engineering", "ME"],
  ["Civil Engineering", "CE"],
  ["Electrical & Electronics Engineering", "EEE"],
];

for (const [name, shortCode] of branches) {
  execute("INSERT INTO branches (name, short_code) VALUES (?, ?) ON CONFLICT (short_code) DO NOTHING", [
    name,
    shortCode,
  ]);
}

const subjects = [
  {
    code: "SAMPLE101",
    name: "Sample Engineering Mathematics I",
    semester: 1,
    scheme: "2024-25",
    common: true,
    branches: ["CSE", "IT", "ECE", "ME", "CE", "EEE"],
    units: [
      ["Differential Calculus", ["limits", "continuity", "differentiability", "Taylor and Maclaurin series", "maxima and minima"]],
      ["Matrices", ["rank of a matrix", "eigenvalues and eigenvectors", "Cayley-Hamilton theorem", "diagonalisation"]],
      ["Partial Differentiation", ["Euler's theorem", "Jacobians", "maxima and minima of two variables"]],
      ["Multiple Integrals", ["double integrals", "change of order of integration", "triple integrals", "area and volume"]],
      ["Vector Calculus", ["gradient", "divergence", "curl", "line and surface integrals"]],
    ],
  },
  {
    code: "SAMPLE102",
    name: "Sample Programming for Problem Solving",
    semester: 1,
    scheme: "2024-25",
    common: true,
    branches: ["CSE", "IT", "ECE", "ME", "CE", "EEE"],
    units: [
      ["Introduction to C", ["variables", "data types", "operators", "input and output"]],
      ["Control Structures", ["if-else", "switch", "for loop", "while loop", "nested loops"]],
      ["Arrays and Strings", ["one-dimensional arrays", "two-dimensional arrays", "string functions"]],
      ["Functions and Recursion", ["function arguments", "call by value", "recursion", "scope"]],
      ["Pointers and Structures", ["pointer basics", "pointers and arrays", "structures", "unions"]],
    ],
  },
  {
    code: "SAMPLE103",
    name: "Sample Data Structures",
    semester: 3,
    scheme: "2024-25",
    common: false,
    branches: ["CSE", "IT"],
    units: [
      ["Linear Structures", ["arrays", "stacks", "queues", "applications of stacks"]],
      ["Linked Lists", ["singly linked list", "doubly linked list", "circular list", "insertion and deletion"]],
      ["Trees", ["binary tree", "binary search tree", "tree traversals", "height and depth"]],
      ["Graphs", ["representation", "BFS", "DFS", "spanning trees"]],
      ["Searching, Sorting and Hashing", ["linear search", "binary search", "quick sort", "merge sort", "hash tables"]],
    ],
  },
  {
    code: "SAMPLE104",
    name: "Sample Digital Electronics",
    semester: 3,
    scheme: "2024-25",
    common: false,
    branches: ["ECE", "EEE"],
    units: [
      ["Number Systems and Boolean Algebra", ["binary arithmetic", "Boolean laws", "canonical forms", "logic gates"]],
      ["Combinational Circuits", ["Karnaugh maps", "adders and subtractors", "multiplexers", "decoders"]],
      ["Sequential Circuits", ["flip-flops", "registers", "counters", "state diagrams"]],
      ["Memory and Programmable Logic", ["ROM", "RAM", "PLA", "PAL"]],
      ["Logic Families", ["TTL", "CMOS", "noise margin", "propagation delay"]],
    ],
  },
];

const subjectIdByCode = new Map();

for (const subject of subjects) {
  execute(
    `INSERT INTO subjects (code, name, semester, scheme, is_common, is_sample, verified, source_url, fetched_at)
     VALUES (?, ?, ?, ?, ?, 1, 0, NULL, NULL)
     ON CONFLICT (code, scheme) DO NOTHING`,
    [subject.code, subject.name, subject.semester, subject.scheme, subject.common ? 1 : 0],
  );
  const row = execute("SELECT id FROM subjects WHERE code = ? AND scheme = ?", [
    subject.code,
    subject.scheme,
  ])[0];
  subjectIdByCode.set(subject.code, row.id);

  for (const shortCode of subject.branches) {
    const branch = execute("SELECT id FROM branches WHERE short_code = ?", [shortCode])[0];
    if (branch) {
      execute("INSERT OR IGNORE INTO subject_branches (subject_id, branch_id) VALUES (?, ?)", [
        row.id,
        branch.id,
      ]);
    }
  }

  subject.units.forEach(([title, topics], index) => {
    execute(
      `INSERT INTO syllabus_units (subject_id, unit_no, title, topics_json, verified)
       VALUES (?, ?, ?, ?, 0)
       ON CONFLICT (subject_id, unit_no) DO NOTHING`,
      [row.id, index + 1, title, JSON.stringify(topics)],
    );
  });
}

// Fake questions. They exist only so the app can be tested end to end.
const papers = [
  { code: "SAMPLE101", session: "2023-24 Odd", year: 2023 },
  { code: "SAMPLE101", session: "2024-25 Even", year: 2024 },
  { code: "SAMPLE102", session: "2023-24 Odd", year: 2023 },
  { code: "SAMPLE103", session: "2023-24 Odd", year: 2023 },
  { code: "SAMPLE103", session: "2024-25 Even", year: 2024 },
  { code: "SAMPLE104", session: "2023-24 Odd", year: 2023 },
];

const questions = [
  ["SAMPLE101", 1, 10, "Find the Taylor series expansion of f(x) = sin x about x = 0.", 2023, "2023-24 Odd"],
  ["SAMPLE101", 1, 10, "Find the Taylor series expansion of f(x) = sin x about x = 0.", 2024, "2024-25 Even"],
  ["SAMPLE101", 2, 10, "Find the eigenvalues and eigenvectors of the matrix [[2, 1], [1, 2]].", 2023, "2023-24 Odd"],
  ["SAMPLE101", 2, 10, "State and verify the Cayley-Hamilton theorem for a 2x2 matrix.", 2024, "2024-25 Even"],
  ["SAMPLE101", 3, 10, "Verify Euler's theorem for f(x, y) = x^3 + y^3 + 3xy.", 2023, "2023-24 Odd"],
  ["SAMPLE101", 4, 10, "Evaluate the double integral of x*y over the unit square.", 2024, "2024-25 Even"],
  ["SAMPLE101", 5, 10, "Find the divergence and curl of the vector field F = xi + yj + zk.", 2023, "2023-24 Odd"],
  ["SAMPLE102", 2, 5, "Write a C program to print the sum of the first n natural numbers using a for loop.", 2023, "2023-24 Odd"],
  ["SAMPLE102", 3, 5, "Explain how a two-dimensional array is stored in memory with an example.", 2023, "2023-24 Odd"],
  ["SAMPLE102", 4, 7, "Write a recursive function to compute the factorial of a number.", 2023, "2023-24 Odd"],
  ["SAMPLE102", 5, 7, "Explain the difference between a structure and a union in C.", 2023, "2023-24 Odd"],
  ["SAMPLE103", 1, 7, "Explain the application of a stack in checking balanced parentheses.", 2023, "2023-24 Odd"],
  ["SAMPLE103", 2, 7, "Write an algorithm to reverse a singly linked list.", 2023, "2023-24 Odd"],
  ["SAMPLE103", 2, 7, "Write an algorithm to reverse a singly linked list.", 2024, "2024-25 Even"],
  ["SAMPLE103", 3, 10, "Insert the keys 50, 30, 70, 20, 40 into a binary search tree and write all traversals.", 2024, "2024-25 Even"],
  ["SAMPLE103", 4, 10, "Compare BFS and DFS with a small example graph.", 2023, "2023-24 Odd"],
  ["SAMPLE103", 5, 7, "Compare quick sort and merge sort with time complexity and stability.", 2024, "2024-25 Even"],
  ["SAMPLE104", 1, 5, "Convert (45)10 into binary and hexadecimal.", 2023, "2023-24 Odd"],
  ["SAMPLE104", 2, 10, "Simplify the Boolean expression using a Karnaugh map: F = Σ(0,1,2,5,7).", 2023, "2023-24 Odd"],
  ["SAMPLE104", 3, 10, "Explain the working of a JK flip-flop with a truth table.", 2023, "2023-24 Odd"],
  ["SAMPLE104", 4, 7, "Differentiate between ROM and RAM.", 2023, "2023-24 Odd"],
  ["SAMPLE104", 5, 7, "Compare TTL and CMOS logic families.", 2023, "2023-24 Odd"],
];

for (const paper of papers) {
  const subjectId = subjectIdByCode.get(paper.code);
  if (!subjectId) continue;
  const existing = execute("SELECT id FROM papers WHERE subject_id = ? AND session = ?", [
    subjectId,
    paper.session,
  ])[0];
  if (!existing) {
    execute(
      "INSERT INTO papers (subject_id, session, year, source_note, verified) VALUES (?, ?, ?, ?, 0)",
      [subjectId, paper.session, paper.year, "Sample paper, not real AKTU data"],
    );
  }
}

for (const [code, unit, marks, text, year, session] of questions) {
  const subjectId = subjectIdByCode.get(code);
  if (!subjectId) continue;
  const paper = execute("SELECT id FROM papers WHERE subject_id = ? AND session = ?", [
    subjectId,
    session,
  ])[0];
  execute(
    `INSERT INTO questions (subject_id, paper_id, unit_no, marks, text, year, session, hash, verified, flagged)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
     ON CONFLICT (subject_id, hash) DO NOTHING`,
    [subjectId, paper?.id ?? null, unit, marks, text, year, session, hashQuestion(text)],
  );
}

const counts = execute(
  "SELECT (SELECT COUNT(*) FROM branches) AS branches, (SELECT COUNT(*) FROM subjects) AS subjects, (SELECT COUNT(*) FROM questions) AS questions",
)[0];

console.log("Seed complete:", counts);
console.log("Sample codes: SAMPLE101, SAMPLE102, SAMPLE103, SAMPLE104");
console.log("All sample rows are marked is_sample = 1 and verified = 0.");
