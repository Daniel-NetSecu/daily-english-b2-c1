# Daily English B2–C1

A dependency-free static lesson archive. Lesson content lives in JSON; a Node.js script builds the current lesson homepage plus year/month/date archive pages.

## Structure

```text
content/lessons/YYYY-MM-DD.json  lesson sources
scripts/build.mjs                static-site generator (Node built-ins only)
scripts/verify.mjs               static integrity checks (Node built-ins only)
index.html                       generated latest lesson
archive/                         generated archive pages
styles.css                       shared local stylesheet
```

Every lesson follows this exact sequence:

1. 生词和重点词语
2. 英语短文
3. 语法与句型
4. 快速练习
5. 答案（native `<details>`; collapsed by default）

The site has no package install, remote font, CDN, tracker, client-side framework, or external runtime resource.

## Add a lesson

1. Copy an existing file in `content/lessons/` to `content/lessons/YYYY-MM-DD.json`.
2. Set `date` to the same `YYYY-MM-DD` value as the filename.
3. Keep exactly five `sections` in this order: `vocabulary`, `reading`, `grammar`, `practice`, `answers`.
4. Use a unique theme (normalized Unicode, whitespace and case are checked), level `B2–C1`, and duration `约 10 分钟`. Dates must be real calendar dates; filenames must match. Fill the section content. Keep the answer section’s `summary` short and put each answer in `items`.
5. Build and verify before committing.

## Build

Node.js 18 or newer is sufficient; only built-in modules are used.

```powershell
node scripts/build.mjs
```

The build sorts lessons by date, writes the newest lesson to `index.html`, and recreates:

```text
archive/index.html
archive/YYYY/index.html
archive/YYYY/MM/index.html
archive/YYYY/MM/DD/index.html
```

## Verify

```powershell
node scripts/verify.mjs
```

The builder validates lesson naming, real dates, unique themes, metadata and section order. The verifier checks generated pages, history navigation, `aria-current`, collapsed answers, desktop sticky navigation, mobile native `details`/`summary`, local link targets, and absence of external resources.

For a local browser check, use any static HTTP server rooted at this directory; direct `file://` opening also works because generated links are relative.

## Automatic GitHub Pages deployment

The workflow in `.github/workflows/pages.yml` runs on pushes to main and manual workflow_dispatch (main only). It rebuilds from lesson JSON, verifies all dynamically derived archive pages, runs isolated regression tests, stages an allowlist of public HTML/CSS, and deploys the Pages artifact. Generated files checked into Git are not trusted as build inputs.

One-time owner action: in **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source. The workflow does not change repository settings. Until the owner enables Actions-based Pages, deployment may fail; a local build is not proof of publication.

Build has only contents: read; deployment has only pages: write and id-token: write. Checkout does not persist credentials. Only _site is uploaded: index.html, styles.css, and archive/**/index.html. No JSON sources, scripts, Git metadata, credentials, or README are included. All lesson content must remain original/public-safe; JSON text is HTML-escaped.

### Complete local pipeline

```sh
node scripts/build.mjs
node scripts/verify.mjs
node scripts/test.mjs
node scripts/stage.mjs
```

The regression suite creates a temporary project-local copy, adds a synthetic new year and month, rebuilds after each addition, checks homepage promotion and all navigation links, removes the fixtures to prove stale-page cleanup, and tests invalid dates, leap days, duplicate themes, metadata and section order. It cleans up in finally and does not change real lessons. _site and temporary copies are ignored by Git.

Year and month groups use native details/summary controls (Tab, Enter/Space). The current year/month open automatically; other groups remain collapsible. Only the exact active page gets aria-current; on the homepage this is 最新课程, not its duplicate archive URL. The desktop sidebar is left-aligned and scrollable; mobile uses document flow. Answers remain collapsed.

After reviewing and committing the source changes, push to main. Check the Actions deployment result and fetch the published homepage and dated archive page before calling the release complete. No paid service or package installation is required.

## Restored historical versions

`content/historical/YYYY-MM-DD--slug.json` holds previously published lessons that were overwritten on the same date. Each record preserves its original text and date and adds `sourceCommit` for provenance. The builder merges these into the same chronological navigation, labels them 历史版本, and assigns `archive/YYYY/MM/DD/slug/` URLs. Main lesson URLs remain unchanged and the homepage continues to use the newest regular lesson. Historical themes can repeat because these are preserved originals, not new scheduled lessons. Do not delete this directory when adding new courses.

Recovered on 2026-10-03:
- 2026-09-24 — The Anatomy of a Sincere Apology (source commit 982fb6a).
- 2026-09-24 — Small Repairs, Stronger Relationships (source commit c4b1786).

Their dates are the original lesson metadata, not a newly inferred publication time.
