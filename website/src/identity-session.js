// Keep SDK-managed cookies across browser restarts; never store a password.
// Authentication and token renewal remain the Identity SDK's responsibility.
export const REMEMBER_DAYS=30;
export function rememberIdentitySession(doc=globalThis.document,now=Date.now()){
  if(!doc)return false;
  try{
    const cookies=new Map(doc.cookie.split(';').map(s=>{const split=s.trim().indexOf('=');return split<0?[]:[s.trim().slice(0,split),s.trim().slice(split+1)];}).filter(p=>p.length===2));
    const access=cookies.get('nf_jwt'),refresh=cookies.get('nf_refresh');
    if(!access)return false;
    const payload=decodeURIComponent(access).split('.')[1];
    const {exp}=JSON.parse(atob(payload.replace(/-/g,'+').replace(/_/g,'/')));
    if(!Number.isSafeInteger(exp)||exp<=Math.floor(now/1000))return false;
    const options='; Path=/; Secure; SameSite=Lax';
    doc.cookie=`nf_jwt=${access}; Max-Age=${Math.min(exp-Math.floor(now/1000),REMEMBER_DAYS*86400)}${options}`;
    if(refresh)doc.cookie=`nf_refresh=${refresh}; Max-Age=${REMEMBER_DAYS*86400}${options}`;
    return true;
  }catch{return false;}
}

export async function restoreIdentitySession(sdk,doc=globalThis.document){
  // Renew the SDK's persisted session BEFORE getUser: on a browser restart,
  // getUser clears the stored user if the short-lived access cookie has expired.
  try{await sdk.refreshSession();}catch{}
  const user=await sdk.getUser();
  if(user)rememberIdentitySession(doc);
  return user;
}
