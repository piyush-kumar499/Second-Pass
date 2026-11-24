# Source conflicts and ambiguities

Where sources disagreed, the official AKTU document was kept. Nothing below changes an imported question or syllabus fact.

## 1. Which first-year scheme is current?

- **Official:** the syllabus page for 2022-23 links the B.Tech 1st Year document marked "Effective from the Session: 2022-23" (common to all branches except Agriculture Engineering and Biotechnology).
- **Official:** the 2024-25, 2025-26 and 2026-27 syllabus pages list 2nd, 3rd and 4th year PDFs, but no B.Tech first-year PDF.
- **Third-party:** paper indexes label first-year papers by exam session (2024-25), not by syllabus scheme.

**Decision:** subject codes, names and units are stored with `scheme = "2022-23"`, the latest official first-year scheme we could open. This is a gap in the official page, not proof that a newer scheme does not exist.

## 2. Subject name formatting

- **Official PDF:** `BAS103 : ENGINEERING MATHEMATICS-I`.
- **Poori Padhai:** "Engineering Mathematics 1-BAS103" and "Engineering Mathematics-BAS103" (two index entries pointing at different files).

**Decision:** use the official name, "Engineering Mathematics-I". The third-party variants are only index labels.

## 3. Code pairs

- **Official PDF:** semester I and semester II swap some subjects: `BAS101 / BAS201`, `BAS102 / BAS202`, `BEE101 / BEE201`, `BEC101 / BEC201`, `BCS101 / BCS201`, `BME101 / BME201`.
- **Third-party:** entries usually list only the semester-I code.

**Decision:** imported subjects use the semester-I codes (`BAS101`, `BAS103`, `BCS101`). The alternate semester-II codes are noted in this file, not stored as duplicate subjects.

## 4. Exam session label

- **Paper header:** "BTECH (SEM I) THEORY EXAMINATION 2024-25".
- **Paper footer/date:** 18-Mar-2025 (BAS101) and 05-Mar-2025 (BCS101). A March date is unusual for a semester-I odd exam.

**Decision:** store `session = "2024-25"` and `year = 2024`, exactly as printed. Do not guess "Odd" or "Even".

## 5. Old-scheme papers on the official site

- **Official old-paper page:** 2,713 links, but codes are from older schemes (`CE-401`, `CS-801`, `ME-801`, `MCA-404`, ...).
- **Third-party:** current first-year papers use `BAS101`/`BAS103`/`BCS101`.

**Decision:** the official page is still the first place checked, but it does not contain the current first-year codes. Current papers were found through a third-party index and downloaded from the linked Google Drive copies. Each paper records its `source_url`.

## 6. Bilingual papers

- The BAS101 and BCS101 PDFs print English and Hindi for every question.
- The Hindi text layer uses a legacy font and extracts as broken characters.

**Decision:** keep the clean English text only. The Hindi text is not imported and is not silently reconstructed.

## 7. BAS103 maths font

- The BAS103 2024-25 PDF opens and prints, but its maths is stored as embedded-font glyphs.
- Extracted text shows stray characters where matrices, integrals and fractions should be.

**Decision:** no BAS103 questions were imported. Rewriting them from the rendered page would be manual transcription, which was outside this pass; importing the broken text would violate the quality rules.
