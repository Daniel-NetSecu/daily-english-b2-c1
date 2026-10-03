import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root,'_site');
const files = ['index.html','styles.css'];
async function collect(dir) {
  for (const entry of await fs.readdir(path.join(root,dir),{withFileTypes:true})) {
    const relative = path.join(dir,entry.name);
    assert(!entry.isSymbolicLink(), 'No symlinks in public artifact');
    if (entry.isDirectory()) await collect(relative);
    else { assert(entry.name === 'index.html', 'Unexpected archive file: '+relative); files.push(relative); }
  }
}
await collect('archive');
await fs.rm(output,{recursive:true,force:true});
for (const relative of files) {
  assert((await fs.lstat(path.join(root,relative))).isFile(), 'Regular files only');
  await fs.mkdir(path.dirname(path.join(output,relative)),{recursive:true});
  await fs.copyFile(path.join(root,relative),path.join(output,relative));
}
console.log('Staged '+files.length+' public HTML/CSS files in _site; no sources or credentials.');
