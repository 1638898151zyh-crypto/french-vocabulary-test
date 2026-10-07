// One-time, read-only export. All output stays in ignored private storage.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {getStore} from '@netlify/blobs';
const siteID='ce2adca4-a577-471d-9f6b-3706700c7458';
const config=JSON.parse(await readFile('.netlify/cli-config/netlify/Config/config.json','utf8'));
const token=config.users[config.userId].auth.token;
const output=resolve('../.netlify/migration/exports',new Date().toISOString().replace(/[:.]/g,'-'));
await mkdir(output,{recursive:true});
const manifest={siteID,exportedAt:new Date().toISOString(),stores:{}};
const siteResponse=await fetch('https://api.netlify.com/api/v1/sites/'+siteID,{headers:{Authorization:'Bearer '+token}});
if(!siteResponse.ok)throw Error('Cannot read source site.');
const site=await siteResponse.json(),users=[];
if(!site.identity_instance_id)throw Error('Source Identity service was not found.');
for(let page=1;;page++){
 const response=await fetch(`https://api.netlify.com/api/v1/sites/${siteID}/identity/${site.identity_instance_id}/users?per_page=100&page=${page}`,{headers:{Authorization:'Bearer '+token}});
 if(!response.ok)throw Error('Account export failed; source data was not modified.');
 const result=await response.json(),batch=Array.isArray(result)?result:result.users;
 if(!Array.isArray(batch))throw Error('Unexpected account export format.');
 users.push(...batch);if(batch.length===0)break;
}
if(new Set(users.map(u=>u.id)).size!==users.length)throw Error('Account pagination returned duplicate IDs.');
await writeFile(resolve(output,'users.json'),JSON.stringify(users,null,2));
manifest.accounts={count:users.length,passwordHashIncluded:users.some(u=>Boolean(u.encrypted_password||u.password_hash))};
for(const name of ['franmo-progress-v2','edito-progress','franmo-avatars']){
 const store=getStore({name,siteID,token,consistency:'strong'});
 const folder=resolve(output,name);await mkdir(folder,{recursive:true});
 const records=[];
 for await(const page of store.list({paginate:true}))for(const entry of page.blobs){
  const result=await store.getWithMetadata(entry.key,{type:'arrayBuffer'});
  if(!result)throw Error('Export changed while reading; retry without modifying the source.');
  const bytes=Buffer.from(result.data),file=createHash('sha256').update(entry.key).digest('hex')+'.bin';
  await writeFile(resolve(folder,file),bytes,{flag:'wx'});
  records.push({key:entry.key,etag:result.etag,metadata:result.metadata,file,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
 }
 await writeFile(resolve(folder,'index.json'),JSON.stringify(records,null,2));
 manifest.stores[name]={count:records.length};
}
await writeFile(resolve(output,'manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({output,accounts:manifest.accounts,stores:manifest.stores}));
