// Run with an ignored private config: {url,serviceRoleKey,exportDir,usersFile}.
// usersFile must be the authoritative Identity export, not inferred from learning records.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {restoreMulti,migrateClassic} from '../src/multi-learning.js';
const cfg=JSON.parse(await readFile(process.argv[2],'utf8'));
const usersRaw=JSON.parse(await readFile(cfg.usersFile,'utf8'));
const users=Array.isArray(usersRaw)?usersRaw:usersRaw.users;
if(!Array.isArray(users)||users.some(u=>!u.id||!u.email)||new Set(users.map(u=>u.id)).size!==users.length)throw Error('A complete, authoritative account export is required.');
const checked=result=>{if(result.error)throw Error('Migration operation failed: '+result.error.code);return result.data;};
const readStore=async name=>JSON.parse(await readFile(resolve(cfg.exportDir,name,'index.json'),'utf8'));
async function bytes(name,record){
 const value=await readFile(resolve(cfg.exportDir,name,record.file));
 if(createHash('sha256').update(value).digest('hex')!==record.sha256)throw Error('Backup checksum mismatch.');
 return value;
}
// Validate all records before any writes. Preserve old ETags and IDs for offline continuity.
const records=new Map();
for(const name of ['edito-progress','franmo-progress-v2'])for(const record of await readStore(name)){
 const raw=JSON.parse(await bytes(name,record));
 const data=name==='franmo-progress-v2'?restoreMulti(raw):migrateClassic(raw);
 if(!data)throw Error('A source learning record failed validation.');
 const id=record.key.replace(/^user\//,'');
 if(!users.some(u=>u.id===id))throw Error('Account export is missing an owner; no source records will be discarded.');
 records.set(id,{data,etag:record.etag});
}
const avatars=[];
for(const record of await readStore('franmo-avatars')){
 const name=record.key.replace(/^avatars\//,'');
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(webp|png|jpg)$/i.test(name))throw Error('Invalid avatar filename.');
 const content=await bytes('franmo-avatars',record);
 if(content.length>262144)throw Error('Source avatar exceeds the storage limit.');
 avatars.push({name,content,type:{webp:'image/webp',png:'image/png',jpg:'image/jpeg'}[name.split('.').at(-1).toLowerCase()]});
}
if(process.argv.includes('--check-only')){
 console.log(JSON.stringify({validated:true,accounts:users.length,records:records.size,avatars:avatars.length,passwordResetRequired:users.filter(u=>!(u.encrypted_password||u.password_hash)).length}));
 process.exit(0);
}
const client=createClient(cfg.url,cfg.serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false}});
const existing=new Map();
for(let page=1;;page++){
 const result=checked(await client.auth.admin.listUsers({page,perPage:100}));
 for(const user of result.users)existing.set(user.id,user);
 if(result.users.length<100)break;
}
const mapping=[];
for(const source of users){
 let user=existing.get(source.id);
 if(user&&user.email?.toLowerCase()!==source.email.toLowerCase())throw Error('Existing account ID belongs to a different email.');
 if(!user){
  const hash=source.encrypted_password||source.password_hash;
  user=checked(await client.auth.admin.createUser({id:source.id,email:source.email,
   email_confirm:Boolean(source.confirmed_at||source.email_confirmed_at),
   user_metadata:source.user_metadata||{},app_metadata:{legacy_user_id:source.id},
   ...(hash?{password_hash:hash}:{})})).user;
 }
 if(user.id!==source.id)throw Error('Account IDs did not match; import stopped.');
 mapping.push({id:user.id,passwordResetRequired:!(source.encrypted_password||source.password_hash)});
 const record=records.get(source.id);
 if(record){
  const found=checked(await client.from('learning_records').select('etag').eq('user_id',user.id));
  // Never overwrite work already created on the new service. This makes retries safe.
  if(!found.length)checked(await client.from('learning_records').insert({user_id:user.id,...record}));
 }
}
for(const {name,content,type} of avatars){
 const result=await client.storage.from('avatars').upload(name,content,{contentType:type,upsert:false});
 if(result.error&&String(result.error.statusCode)!=='409')throw Error('Avatar migration failed.');
}
await writeFile(resolve(cfg.exportDir,'supabase-import-report.json'),JSON.stringify({importedAt:new Date().toISOString(),mapping,records:records.size},null,2));
console.log(JSON.stringify({accounts:mapping.length,records:records.size,passwordResets:mapping.filter(u=>u.passwordResetRequired).length}));
