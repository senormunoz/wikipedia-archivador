import {readdirSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const manifest=JSON.parse(readFileSync('extension/manifest.json'));
if(manifest.manifest_version!==3)throw Error('Expected Manifest V3');
for(const name of readdirSync('extension').filter(x=>x.endsWith('.js')))execFileSync(process.execPath,['--check',`extension/${name}`]);
console.log('Manifest y sintaxis JavaScript correctos.');
