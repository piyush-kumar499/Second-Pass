# AKTU data report

Date of research: 23 November 2026 (IST)
Owner approval status: **everything below is `verified = 0`**. Approve rows in `/admin` before treating them as final.

## What was opened

| Source | What it gave us | Result |
| --- | --- | --- |
| [AKTU syllabus 2022-23 page](https://aktu.ac.in/syllabus%202022-2023.html) | Official link to the B.Tech first-year syllabus | Used |
| [Official B.Tech 1st year syllabus PDF](https://aktu.ac.in/pdf/syllabus/syllabus2223/Syllabus_BTech_First_Yr_Common_other_than_AG_%26_BT_effective_from_2022_23_R.pdf) | Subject codes, names and all five units for BAS101, BAS103 and BCS101 | Used |
| [AKTU old question papers page](https://aktu.ac.in/old-question-paper.html) | 2,713 PDF links, mostly older-scheme papers (CE-401, CS-801, ME-801, ...) | Opened, no current first-year codes found |
| [AKTU syllabus 2024-25 page](https://aktu.ac.in/syllabus%202024-2025.html) | 2nd, 3rd and 4th year PDFs only | Opened, no first-year PDF |
| [Poori Padhai AKTU common-subjects index](https://www.pooripadhai.com/previous-year-question-paper/universities/aktu/b.tech/common-subjects/) | Links to paper PDFs on Google Drive for BAS101, BAS103 and BCS101 | Used only to find papers |
| [BAS101 2024-25 paper](https://drive.google.com/file/d/1QBmxAZflM64x1C-j5Og69NlTWhyfTyEE/view) | Question text | Imported, 21 questions |
| [BCS101 2024-25 paper](https://drive.google.com/file/d/1vIa5EsXnodlahA4pRIwYsAbeLjPvJ_Wn/view) | Question text | Imported, 22 questions |
| [BAS103 2024-25 paper](https://drive.google.com/file/d/12Arzv3q65WCJF_V2MWgOqI16CJtxob8y/view) | Question text with embedded maths | Downloaded, not imported (garbled maths font) |

`aktuonline.com` was not used: its `robots.txt` explicitly disallows AI crawlers. No login, paywall or block was bypassed. Requests were made slowly (about one per second or slower).

## Per subject

| Subject | Syllabus found | Units | Papers imported | Years covered | Questions imported | Flagged problems |
| --- | --- | --- | --- | --- | --- | --- |
| BAS101 Engineering Physics | Yes, official PDF | 5 | 1 | 2024-25 | 21 | One Section-B question was skipped because its formula did not extract cleanly. The rest of the English text is clean. |
| BAS103 Engineering Mathematics-I | Yes, official PDF | 5 | 0 | 2024-25 paper found | 0 | The paper's maths uses embedded fonts that extract as broken glyphs. Importing it would mean inventing or silently rewriting the questions, so it was left out. |
| BCS101 Programming for Problem Solving | Yes, official PDF | 5 | 1 | 2024-25 | 22 | The paper is bilingual. Only the English text was kept; the Hindi font extracted as broken characters. One star-pattern question is a legitimate run of symbols and was explicitly marked clean. |

Totals: **3 subjects, 15 syllabus units, 2 papers, 43 questions, 0 flagged questions in the database.**

## Checks done

- **Codes:** taken from the official evaluation scheme (`BAS101/BAS201`, `BAS103`, `BCS101/BCS201`), not from memory.
- **Unit topics:** typed from the official PDF. The official wording is kept, including its own spelling such as "Gama" and "Schrodinger".
- **Unit guesses:** each imported question was mapped to a unit by matching its topic against the official unit list. These are guesses and are stored as such.
- **Duplicates:** the import script uses the app's question hash. Re-running `npm run db:import-real` skips already-saved questions.
- **Garbled text:** the normal garble guard is applied. Nothing flagged was inserted.
- **Verified rows:** the script never overwrites a row where `verified = 1`.
- **PDF copies:** not committed and not served by the app. The extracted question text and a source link are stored instead.

## Subject-level notes

### BAS101 Engineering Physics

- Official name: "ENGINEERING PHYSICS".
- Official code pair: `BAS101 / BAS201` (semester I / semester II).
- Units: Quantum Mechanics; Electromagnetic Field Theory; Wave Optics; Fiber Optics and Laser; Superconductors and Nano-Materials.
- Paper used: 2024-25, SEM I, 70 marks, 3 hours.
- Section A (2 marks): 7 questions. Section B (7 marks): 5 questions. Section C (7 marks): 10 questions. 21 clean questions imported, 1 skipped.

### BAS103 Engineering Mathematics-I

- Official name: "ENGINEERING MATHEMATICS-I".
- Units: Matrices; Differential Calculus-I; Differential Calculus-II; Multiple Integration; Vector Calculus.
- The 2024-25 paper PDF exists but the text layer is broken around every equation. For example, matrices and integrals extract as stray Unicode glyphs. Under the quality rules, it was not imported.
- No clean paper for this subject was found on the official AKTU old-paper page.

### BCS101 Programming for Problem Solving

- Official name: "PROGRAMMING FOR PROBLEM SOLVING".
- Official code pair: `BCS101 / BCS201`.
- Units: computer system and C basics; expressions and conditional branching; iteration, loops, arrays and structures; functions, searching and sorting; pointers and file handling.
- Paper used: 2024-25, SEM I, 70 marks, 3 hours.
- Section A (2 marks): 7 questions. Section B (7 marks): 5 questions. Section C (7 marks): 10 questions. All 22 imported.

## How to reproduce

```bash
npm run db:migrate
npm run db:seed          # sample rows, useful for the demo
npm run db:import-real   # these three real first-year subjects
```

The typed source data is in `data/real/aktu-first-year.json`. The importer is `scripts/import-real.mjs`.

## Missing data

- No current-scheme first-year papers on the official AKTU old-question-paper page. It indexes older codes such as `CE-401`, not `BAS101`/`BAS103`/`BCS101`.
- No 2023-24, 2024-25 or 2025-26 official first-year syllabus PDF was found. The 2022-23 document is the latest official first-year document linked from the syllabus pages, so its scheme label is used.
- Only one paper per subject, not the 10 to 15 years the brief asks for.
- No paper questions for BAS103.
- No subjects from other branches or later years.
- No official model papers for these three subjects were found on `model-question-paper.html`.
- No attempt was made to transcribe the Hindi side of bilingual papers.
