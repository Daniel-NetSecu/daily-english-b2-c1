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

The first lesson follows this exact sequence:

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
4. Fill the lesson metadata and section content. Keep the answer section’s `summary` short and put each answer in `items`.
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

The verifier checks lesson naming and section order, generated pages, history navigation, `aria-current`, collapsed answers, desktop sticky navigation, mobile native `details`/`summary`, local link targets, and absence of external resources.

For a local browser check, use any static HTTP server rooted at this directory; direct `file://` opening also works because generated links are relative.

## Commit and publish

Use the repository’s Git executable and repository-local identity (do not change global Git configuration):

```powershell
<absolute-path-to-git.exe> config --local user.name "Daniel-NetSecu"
<absolute-path-to-git.exe> config --local user.email "193844612+Daniel-NetSecu@users.noreply.github.com"
node scripts/build.mjs
node scripts/verify.mjs
<absolute-path-to-git.exe> add README.md content scripts index.html archive styles.css
<absolute-path-to-git.exe> commit -m "Build data-driven Daily English archive"
<absolute-path-to-git.exe> push origin main
```

GitHub Pages is configured to deploy from the repository root of the `main` branch. After pushing, confirm the Pages API/build status and fetch the published URL over HTTPS before treating the release as complete.
