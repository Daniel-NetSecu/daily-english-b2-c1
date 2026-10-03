import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lessons = await Promise.all((await fs.readdir(path.join(root, 'content/lessons'))).filter(n => n.endsWith('.json')).map(async n => JSON.parse(await fs.readFile(path.join(root, 'content/lessons', n), 'utf8'))));
assert(lessons.length);
const historicalDir = path.join(root,'content/historical');
for (const name of await fs.readdir(historicalDir).catch(e => { if (e.code === 'ENOENT') return []; throw e; })) {
  if (name.endsWith('.json')) lessons.push({...JSON.parse(await fs.readFile(path.join(historicalDir,name),'utf8')), historical:true});
}
lessons.sort((a,b) => b.date.localeCompare(a.date));
const pages = new Set(['index.html', 'archive/index.html']);
for (const lesson of lessons) {
  const [y,m,d] = lesson.date.split('-');
  pages.add('archive/' + y + '/index.html');
  pages.add('archive/' + y + '/' + m + '/index.html');
  pages.add('archive/' + y + '/' + m + '/' + d + '/' + (lesson.historical ? lesson.slug + '/' : '') + 'index.html');
}
async function walk(dir) {
  const result = [];
  for (const entry of await fs.readdir(dir, {withFileTypes:true})) {
    const full = path.join(dir,entry.name);
    assert(!entry.isSymbolicLink(), 'no generated symlinks');
    if (entry.isDirectory()) result.push(...await walk(full)); else result.push(full);
  }
  return result;
}
const actual = ['index.html', ...(await walk(path.join(root,'archive'))).map(f => path.relative(root,f).replaceAll('\\','/'))];
assert.deepEqual(actual.sort(), [...pages].sort(), 'exact generated page set; no stale pages');
let checks = 0;
function check(ok, message) { assert(ok, message); checks++; }
for (const relative of pages) {
  const file = path.join(root,relative);
  const html = await fs.readFile(file,'utf8');
  check(!/(?:src|href)=["'](?:https?:)?\/\//i.test(html), relative + ': local resources only');
  check(html.includes('aria-label="课程历史导航"'), relative + ': sidebar');
  check(html.includes('<details class="archive-disclosure"'), relative + ': mobile disclosure');
  check(html.includes('<details class="archive-year"') && html.includes('<details class="archive-month"'), relative + ': native year/month groups');
  const active = [...html.matchAll(/<a href="([^"]+)" aria-current="page"/g)];
  check(active.length === 1, relative + ': exactly one active link');
  for (const [,href] of active) check(path.resolve(path.dirname(file), href.endsWith('/') ? href+'index.html' : href) === file, relative + ': active link targets exact page');
  const parts = relative === 'index.html' ? lessons[0].date.split('-') : relative.split('/').slice(1,-1);
  if (parts[0]) check(html.includes('<details class="archive-year" open><summary>'+parts[0]+' 年</summary>'), relative + ': selected year open');
  if (parts[1]) check(html.includes('<details class="archive-month" open><summary>'+parts[1]+' 月</summary>'), relative + ': selected month open');
  for (const lesson of lessons) {
    check(html.includes(lesson.date+' · '), relative + ': archive contains '+lesson.date);
    if (lesson.historical) check(html.includes('/'+lesson.slug+'/'), relative + ': historical lesson link '+lesson.slug);
  }
  for (const [,href] of html.matchAll(/href="([^"]+)"/g)) {
    if (href.startsWith('#')) { check(html.includes('id="'+href.slice(1)+'"'), 'fragment resolves'); continue; }
    const target = path.resolve(path.dirname(file), href.endsWith('/') ? href+'index.html' : href);
    check(target.startsWith(root+path.sep), 'link stays within site');
    check((await fs.stat(target)).isFile(), relative + ': link resolves '+href);
  }
  if (html.includes('class="lesson-page"')) {
    check(html.includes('<span>约 10 分钟</span>'), relative + ': duration');
    check(/<section class="lesson-section answers"[\s\S]*?<details><summary>/.test(html), relative + ': collapsed answers');
    check(html.includes('Learn a little. Practise daily. Keep growing.'), relative + ': generic footer');
    const positions = [1,2,3,4,5].map(n => html.indexOf('id="section-'+n+'"'));
    check(positions.every((p,i) => p >= 0 && (!i || p > positions[i-1])), relative + ': section order');
  }
}
const home = await fs.readFile(path.join(root,'index.html'),'utf8');
check(home.includes('<time datetime="'+lessons[0].date+'">'), 'home displays newest lesson');
const css = await fs.readFile(path.join(root,'styles.css'),'utf8');
check(/\.archive-disclosure\s*\{[^}]*position:\s*sticky/s.test(css), 'sticky desktop sidebar');
check(/@media\s*\(max-width:\s*820px\)[\s\S]*\.archive-disclosure\s*\{[^}]*position:\s*static/s.test(css), 'mobile document flow');
check(css.includes('a[aria-current="page"]'), 'active page styling');
check(css.includes('summary:focus-visible'), 'keyboard focus styling');
console.log('Static verification passed: '+checks+' checks across '+pages.size+' HTML files.');
