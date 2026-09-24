import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const checks = [];

function assert(condition, message) {
  (condition ? checks : failures).push(message);
}

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
}

const lessonFiles = (await fs.readdir(path.join(root, 'content', 'lessons'))).filter((name) => name.endsWith('.json'));
assert(lessonFiles.length > 0, 'at least one lesson JSON exists');
for (const file of lessonFiles) {
  const lesson = JSON.parse(await fs.readFile(path.join(root, 'content', 'lessons', file), 'utf8'));
  assert(file === `${lesson.date}.json`, `${file} matches its date`);
  assert(lesson.sections.map((section) => section.type).join(',') === 'vocabulary,reading,grammar,practice,answers', `${file} has the required five-section order`);
}

const required = [
  'index.html', 'styles.css', 'archive/index.html',
  'archive/2026/index.html', 'archive/2026/09/index.html', 'archive/2026/09/24/index.html'
];
for (const relative of required) {
  try { await fs.access(path.join(root, relative)); assert(true, `${relative} exists`); }
  catch { assert(false, `${relative} exists`); }
}

const htmlFiles = (await walk(root)).filter((file) => file.endsWith('.html'));
for (const file of htmlFiles) {
  const relative = path.relative(root, file).replaceAll('\\', '/');
  const html = await fs.readFile(file, 'utf8');
  assert(!/(?:src|href)=["'](?:https?:)?\/\//i.test(html), `${relative} has no external resources or links`);
  assert(html.includes('aria-label="课程历史导航"'), `${relative} includes archive navigation`);
  assert(html.includes('aria-current="page"'), `${relative} exposes aria-current`);
  assert(html.includes('<details class="archive-disclosure"'), `${relative} uses native details for mobile archive navigation`);
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
  for (const href of hrefs) {
    if (href.startsWith('#') || href.startsWith('mailto:')) continue;
    const target = path.resolve(path.dirname(file), href.split('#')[0]);
    let exists = false;
    try {
      const stat = await fs.stat(target);
      exists = stat.isDirectory() ? await fs.stat(path.join(target, 'index.html')).then(() => true, () => false) : true;
    } catch {}
    assert(exists, `${relative} link resolves: ${href}`);
  }
}

const home = await fs.readFile(path.join(root, 'index.html'), 'utf8');
const sequence = ['生词和重点词语', '英语短文', '语法与句型', '快速练习', '答案'].map((label) => home.indexOf(`>${label}</h2>`));
assert(sequence.every((position) => position >= 0) && sequence.every((position, index) => index === 0 || sequence[index - 1] < position), 'home page renders the five lesson sections in order');
assert(/<section class="lesson-section answers"[\s\S]*?<details>[\s\S]*?<summary>/.test(home), 'answers are inside a collapsed details element');
assert(!/<details\s+open[^>]*>\s*<summary[^>]*>查看三题答案<\/summary>/i.test(home), 'answer details is collapsed by default');

const css = await fs.readFile(path.join(root, 'styles.css'), 'utf8');
assert(/\.archive-disclosure\s*\{[^}]*position:\s*sticky/s.test(css), 'desktop archive sidebar is sticky');
assert(/@media\s*\(max-width:\s*820px\)[\s\S]*\.archive-disclosure\s*\{[^}]*position:\s*static/s.test(css), 'mobile archive disclosure returns to native document flow');
assert(/a\[aria-current="page"\]/.test(css), 'aria-current has a visible style');

if (failures.length) {
  console.error(`Static verification failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Static verification passed: ${checks.length} checks across ${htmlFiles.length} HTML files.`);
}
