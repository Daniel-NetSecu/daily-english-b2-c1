import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Temporary copy stays inside this project; never changes real lesson sources.
const temp = await fs.mkdtemp(path.join(root,'.test-'));
function run(script, success = true, pattern) {
  const result = spawnSync(process.execPath, [path.join(temp,'scripts',script)], {encoding:'utf8'});
  assert.equal(result.status === 0, success, result.stdout+result.stderr);
  if (pattern) assert.match(result.stderr, pattern);
  if (success) process.stdout.write(result.stdout);
}
try {
  for (const name of ['scripts','content','styles.css']) await fs.cp(path.join(root,name),path.join(temp,name),{recursive:true});
  const dir = path.join(temp,'content/lessons');
  const files = (await fs.readdir(dir)).filter(n => n.endsWith('.json')).sort();
  const base = JSON.parse(await fs.readFile(path.join(dir,files.at(-1)),'utf8'));
  const year = Number(base.date.slice(0,4))+1;
  assert(year < 9999, 'test requires room for a future year');
  async function add(date, theme = 'Synthetic '+date, changes = {}) {
    const lesson = {...base,date,theme,slug:'synthetic-'+date,title:'Synthetic '+date,...changes};
    await fs.writeFile(path.join(dir,date+'.json'),JSON.stringify(lesson));
  }
  run('build.mjs'); run('verify.mjs');
  const dates = [year+'-01-02', year+'-02-03'];
  for (const date of dates) { await add(date); run('build.mjs'); run('verify.mjs'); }
  const home = await fs.readFile(path.join(temp,'index.html'),'utf8');
  assert(home.includes('Synthetic '+dates[1]));
  assert(home.includes('<details class="archive-month" open><summary>02 月'));
  assert(home.includes('<details class="archive-month"><summary>01 月'));
  assert(home.includes('<details class="archive-year"><summary>'+base.date.slice(0,4)+' 年'));
  for (const date of dates) await fs.unlink(path.join(dir,date+'.json'));
  run('build.mjs'); run('verify.mjs');
  await assert.rejects(fs.access(path.join(temp,'archive',String(year))));
  for (const date of ['2025-02-29','2026-02-30','2026-13-01','0000-01-01']) {
    await add(date); run('build.mjs',false,/real calendar date/); await fs.unlink(path.join(dir,date+'.json'));
  }
  await add(year+'-03-01','  '+base.theme+'  ');
  run('build.mjs',false,/duplicate theme/); await fs.unlink(path.join(dir,year+'-03-01.json'));
  await add(year+'-03-01','Unique metadata test',{duration:'15 minutes'});
  run('build.mjs',false,/metadata must/); await fs.unlink(path.join(dir,year+'-03-01.json'));
  await add(year+'-03-01','Unique section test',{sections:[...base.sections].reverse()});
  run('build.mjs',false,/sections must/); await fs.unlink(path.join(dir,year+'-03-01.json'));
  await fs.writeFile(path.join(dir,'zz-duplicate.json'), JSON.stringify(base));
  run('build.mjs',false,/duplicate date/); await fs.unlink(path.join(dir,'zz-duplicate.json'));
  await add(year+'-03-01','Unique filename test',{date:year+'-03-02'});
  run('build.mjs',false,/filename must match/); await fs.unlink(path.join(dir,year+'-03-01.json'));
  await add(year+'-03-01','ＭＩＸＥＤ  Theme');
  await add(year+'-03-02',' mixed theme ');
  run('build.mjs',false,/duplicate theme/);
  await fs.unlink(path.join(dir,year+'-03-01.json')); await fs.unlink(path.join(dir,year+'-03-02.json'));
  await add('2028-02-29','Valid leap day'); run('build.mjs'); run('verify.mjs');
  console.log('Regression tests passed: new year/month, newest home, collapsed inactive groups, stale cleanup, invalid dates, leap day, duplicate theme, duration and section order.');
} finally { await fs.rm(temp,{recursive:true,force:true}); }
