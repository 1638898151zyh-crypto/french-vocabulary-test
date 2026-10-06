import {cpSync,existsSync,mkdirSync,readdirSync,rmSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const project=fileURLToPath(new URL('../',import.meta.url)),root=resolve(project,'..');
const website=join(root,'website');
execFileSync(process.execPath,[join(website,'node_modules/vite/bin/vite.js'),'build','--mode','android'],{cwd:website,stdio:'inherit'});
const destination=resolve(project,'app/src/main/assets/public');
if(destination!==join(project,'app/src/main/assets/public'))throw Error('Unexpected assets path.');
// This exact generated directory is ignored by Git and never contains source or user data.
if(existsSync(destination))rmSync(destination,{recursive:true});
mkdirSync(destination,{recursive:true});
cpSync(join(website,'dist-android'),destination,{recursive:true});
if(existsSync(join(destination,'sw.js')))throw Error('Native assets must not contain a service worker.');
const scripts=readdirSync(join(destination,'assets')).filter(name=>name.endsWith('.js')).map(name=>readFileSync(join(destination,'assets',name),'utf8')).join('');
for(const marker of ['Édito B1','Inspire A1','Édito A2','FranmotestNative'])if(!scripts.includes(marker))throw Error('Native bundle missing '+marker);
console.log('APK assets ready: learning UI, three textbook banks, native file bridge.');
