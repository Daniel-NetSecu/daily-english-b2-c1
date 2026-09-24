import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lessonsDir = path.join(projectRoot, 'content', 'lessons');
const archiveDir = path.join(projectRoot, 'archive');
const expectedOrder = ['vocabulary', 'reading', 'grammar', 'practice', 'answers'];

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

const files = (await fs.readdir(lessonsDir)).filter((name) => name.endsWith('.json')).sort();
if (!files.length) throw new Error('No lesson JSON files found in content/lessons.');

const lessons = [];
for (const file of files) {
  const lesson = JSON.parse(await fs.readFile(path.join(lessonsDir, file), 'utf8'));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lesson.date)) throw new Error(`${file}: date must be YYYY-MM-DD.`);
  if (file !== `${lesson.date}.json`) throw new Error(`${file}: filename must match lesson date.`);
  const order = lesson.sections?.map((section) => section.type) ?? [];
  if (order.join(',') !== expectedOrder.join(',')) {
    throw new Error(`${file}: sections must be exactly ${expectedOrder.join(' → ')}.`);
  }
  lessons.push(lesson);
}
lessons.sort((a, b) => b.date.localeCompare(a.date));

const byYear = new Map();
for (const lesson of lessons) {
  const [year, month] = lesson.date.split('-');
  if (!byYear.has(year)) byYear.set(year, new Map());
  const months = byYear.get(year);
  if (!months.has(month)) months.set(month, []);
  months.get(month).push(lesson);
}

function archiveNav(prefix, current = {}) {
  const years = [...byYear.entries()].sort(([a], [b]) => b.localeCompare(a));
  const tree = years.map(([year, months]) => {
    const monthItems = [...months.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([month, monthLessons]) => {
      const dates = monthLessons.map((lesson) => {
        const currentAttr = current.date === lesson.date ? ' aria-current="page"' : '';
        return `<li><a href="${prefix}archive/${year}/${month}/${lesson.date.slice(8)}/"${currentAttr}>${escapeHtml(lesson.date)} · ${escapeHtml(lesson.title)}</a></li>`;
      }).join('');
      const currentAttr = current.month === `${year}-${month}` ? ' aria-current="page"' : '';
      return `<li><a href="${prefix}archive/${year}/${month}/"${currentAttr}>${month} 月</a><ul>${dates}</ul></li>`;
    }).join('');
    const currentAttr = current.year === year ? ' aria-current="page"' : '';
    return `<li><a href="${prefix}archive/${year}/"${currentAttr}>${year} 年</a><ul>${monthItems}</ul></li>`;
  }).join('');
  return `<aside class="archive-sidebar" aria-label="课程历史导航"><details class="archive-disclosure" open><summary>课程历史</summary><nav><p><a href="${prefix}archive/"${current.archive ? ' aria-current="page"' : ''}>全部课程</a></p><ul class="archive-tree">${tree}</ul></nav></details></aside>`;
}

function shell({ title, description, prefix, current, main, bodyClass = '' }) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(description)}">
  <title>${escapeHtml(title)} · Daily English B2–C1</title>
  <link rel="stylesheet" href="${prefix}styles.css">
</head>
<body class="${escapeHtml(bodyClass)}">
  <a class="skip-link" href="#main-content">跳到主要内容</a>
  <div class="site-layout">
    ${archiveNav(prefix, current)}
    <div class="page-column">${main}</div>
  </div>
</body>
</html>`;
}

function sectionHeading(section, index) {
  return `<div class="section-heading"><span class="section-number">${String(index + 1).padStart(2, '0')}</span><div><p class="kicker">${escapeHtml(section.label)}</p><h2 id="section-${index + 1}">${escapeHtml(section.title)}</h2></div></div>`;
}

function renderSection(section, index) {
  const heading = sectionHeading(section, index);
  if (section.type === 'vocabulary') {
    const cards = section.items.map((item) => `<article class="word-card"><h3>${escapeHtml(item.term)} <span>${escapeHtml(item.part)}</span></h3><p class="meaning">${escapeHtml(item.meaning)}</p><p class="example">${escapeHtml(item.example)}</p></article>`).join('');
    return `<section class="lesson-section" aria-labelledby="section-${index + 1}">${heading}<div class="vocab-grid">${cards}</div></section>`;
  }
  if (section.type === 'reading') {
    const paragraphs = section.paragraphs.map((text) => `<p>${escapeHtml(text)}</p>`).join('');
    return `<section class="lesson-section" aria-labelledby="section-${index + 1}">${heading}<article class="reading-card"><h3>${escapeHtml(section.heading)}</h3>${paragraphs}</article></section>`;
  }
  if (section.type === 'grammar') {
    const cards = section.items.map((item) => `<article class="grammar-card"><p class="pattern">${escapeHtml(item.pattern)}</p><p>${escapeHtml(item.explanation)}</p><p class="example"><strong>Example:</strong> ${escapeHtml(item.example)}</p></article>`).join('');
    return `<section class="lesson-section" aria-labelledby="section-${index + 1}">${heading}<div class="grammar-list">${cards}</div></section>`;
  }
  if (section.type === 'practice') {
    const items = section.items.map((item) => `<li><span class="question-type">${escapeHtml(item.kind)}</span>${escapeHtml(item.question)}</li>`).join('');
    return `<section class="lesson-section" aria-labelledby="section-${index + 1}">${heading}<ol class="question-list">${items}</ol></section>`;
  }
  const answers = section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  return `<section class="lesson-section answers" aria-labelledby="section-${index + 1}">${heading}<details><summary>${escapeHtml(section.summary)}</summary><ol>${answers}</ol></details></section>`;
}

function lessonPage(lesson, prefix, isHome = false) {
  const sections = lesson.sections.map(renderSection).join('');
  const [year, month] = lesson.date.split('-');
  const hero = `<header class="hero"><div class="hero__inner"><p class="eyebrow">Daily English · ${escapeHtml(lesson.theme)}</p><h1>${escapeHtml(lesson.title)}</h1><p class="lead">${escapeHtml(lesson.subtitle)}</p><div class="meta" aria-label="课程信息"><span class="level">${escapeHtml(lesson.level)}</span><span>${escapeHtml(lesson.duration)}</span><time datetime="${lesson.date}">${lesson.date}</time></div></div></header>`;
  const main = `${hero}<main id="main-content">${sections}</main><footer><p>Listen first. Clarify gently. Protect the relationship.</p></footer>`;
  return shell({
    title: lesson.title,
    description: `${lesson.theme}：${lesson.title}，包含词汇、短文、语法、练习和折叠答案。`,
    prefix,
    current: { date: lesson.date, year, month: `${year}-${month}`, home: isHome },
    main,
    bodyClass: 'lesson-page'
  });
}

function listingPage({ heading, intro, selectedLessons, prefix, current }) {
  const items = selectedLessons.map((lesson) => {
    const [year, month, day] = lesson.date.split('-');
    return `<li><time datetime="${lesson.date}">${lesson.date}</time><a href="${prefix}archive/${year}/${month}/${day}/">${escapeHtml(lesson.title)}</a><span>${escapeHtml(lesson.theme)} · ${escapeHtml(lesson.level)}</span></li>`;
  }).join('');
  const main = `<header class="archive-hero"><p class="eyebrow">Daily English · Archive</p><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(intro)}</p><a class="home-link" href="${prefix}index.html">返回最新课程</a></header><main id="main-content" class="archive-main"><ol class="lesson-list">${items}</ol></main>`;
  return shell({ title: heading, description: intro, prefix, current, main, bodyClass: 'archive-page' });
}

await fs.rm(archiveDir, { recursive: true, force: true });
await fs.mkdir(archiveDir, { recursive: true });

await fs.writeFile(path.join(projectRoot, 'index.html'), lessonPage(lessons[0], '', true));
await fs.writeFile(path.join(archiveDir, 'index.html'), listingPage({ heading: '课程历史', intro: '按年、月和日期浏览所有 B2–C1 英语微课。', selectedLessons: lessons, prefix: '../', current: { archive: true } }));

for (const [year, months] of byYear) {
  const yearLessons = [...months.values()].flat();
  const yearDir = path.join(archiveDir, year);
  await fs.mkdir(yearDir, { recursive: true });
  await fs.writeFile(path.join(yearDir, 'index.html'), listingPage({ heading: `${year} 年课程`, intro: `${year} 年发布的全部课程。`, selectedLessons: yearLessons, prefix: '../../', current: { year } }));
  for (const [month, monthLessons] of months) {
    const monthDir = path.join(yearDir, month);
    await fs.mkdir(monthDir, { recursive: true });
    await fs.writeFile(path.join(monthDir, 'index.html'), listingPage({ heading: `${year} 年 ${month} 月`, intro: `${year} 年 ${month} 月发布的课程。`, selectedLessons: monthLessons, prefix: '../../../', current: { year, month: `${year}-${month}` } }));
    for (const lesson of monthLessons) {
      const dayDir = path.join(monthDir, lesson.date.slice(8));
      await fs.mkdir(dayDir, { recursive: true });
      await fs.writeFile(path.join(dayDir, 'index.html'), lessonPage(lesson, '../../../../'));
    }
  }
}

console.log(`Built ${lessons.length} lesson(s): index.html plus archive year/month/date pages.`);
