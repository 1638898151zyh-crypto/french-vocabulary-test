import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {TwaManifest,TwaGenerator,ConsoleLog,fetchUtils} from '@bubblewrap/core';

const project=fileURLToPath(new URL('../',import.meta.url));
const manifest=new TwaManifest(JSON.parse(readFileSync(new URL('../twa-manifest.json',import.meta.url),'utf8')));
const error=manifest.validate();if(error)throw Error(error);
// Use Node's environment-aware fetch and fail quickly on unavailable resources.
fetchUtils.fetch=url=>fetch(url,{signal:AbortSignal.timeout(30000)});
await new TwaGenerator().createTwaProject(project,manifest,new ConsoleLog('Franmotest'));
// Bubblewrap's template still references the retired JCenter repository.
const gradle=new URL('../build.gradle',import.meta.url);
writeFileSync(gradle,readFileSync(gradle,'utf8').replaceAll('jcenter()','mavenCentral()'));
function cleanTemplates(directory){
 for(const entry of readdirSync(directory,{withFileTypes:true})){
  const path=join(directory,entry.name);
  if(entry.isDirectory())cleanTemplates(path);
  else if(/\.(java|xml|gradle)$/.test(entry.name))writeFileSync(path,readFileSync(path,'utf8').replace(/[\t ]+$/gm,'').trimEnd()+'\n');
 }
}
cleanTemplates(join(project,'app/src/main'));
for(const file of ['build.gradle','app/build.gradle']){
 const path=join(project,file);writeFileSync(path,readFileSync(path,'utf8').replace(/[\t ]+$/gm,'').trimEnd()+'\n');
}
console.log('Franmotest Android project generated.');
