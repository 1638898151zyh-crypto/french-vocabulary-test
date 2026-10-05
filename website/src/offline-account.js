// This is a local record selector, never an authentication credential.
export const LAST_ACCOUNT='franmo-atelier:last-account:v1';
export function rememberLocalAccount(user,storage=globalThis.localStorage){
 try{
  if(!user){storage.removeItem(LAST_ACCOUNT);return;}
  if(typeof user.id!=='string'||!/^[a-zA-Z0-9_-]{1,200}$/.test(user.id))return;
  storage.setItem(LAST_ACCOUNT,JSON.stringify({id:user.id,name:String(user.name||'学习者').slice(0,80),email:String(user.email||'').slice(0,320),pictureUrl:String(user.pictureUrl||'').slice(0,2000)}));
 }catch{}
}
export function readLocalAccount(storage=globalThis.localStorage){
 try{const user=JSON.parse(storage.getItem(LAST_ACCOUNT)||'null');return user&&typeof user.id==='string'&&/^[a-zA-Z0-9_-]{1,200}$/.test(user.id)&&typeof user.name==='string'&&user.name.length<=80&&typeof user.email==='string'&&user.email.length<=320&&typeof user.pictureUrl==='string'&&user.pictureUrl.length<=2000?user:null;}catch{return null;}
}
