import {restoreMulti,migrateClassic} from '../src/multi-learning.js';

const filename=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(webp|png|jpg)$/i;
function imageType(bytes){
 if(bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return ['image/webp','webp'];
 if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return ['image/png','png'];
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return ['image/jpeg','jpg'];
 return null;
}
export async function handleApi(request,env,fetcher=fetch){
 const path=new URL(request.url).pathname,origin=request.headers.get('Origin');
 const allowed=new Set([new URL(request.url).origin,...String(env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean)]);
 const cors=origin&&allowed.has(origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{};
 const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...cors}});
 if(origin&&!allowed.has(origin)&&!path.startsWith('/api/avatar/'))return json({error:'请求来源校验失败。'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...cors,'Access-Control-Allow-Methods':'GET,PUT,POST,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Max-Age':'600'}});
 if(!env.SUPABASE_URL||!env.SUPABASE_ANON_KEY)return json({error:'账号服务尚未配置。'},503);
 const base=env.SUPABASE_URL.replace(/\/$/,''),publicHeaders={apikey:env.SUPABASE_ANON_KEY};
 try{
  if(path.startsWith('/api/avatar/')&&request.method==='GET'){
   const name=path.slice('/api/avatar/'.length);if(!filename.test(name))return json({error:'头像不存在。'},404);
   const response=await fetcher(base+'/storage/v1/object/public/avatars/'+name);
   if(!response.ok)return json({error:'头像不存在。'},response.status===404?404:503);
   return new Response(response.body,{headers:{'Content-Type':{'webp':'image/webp','png':'image/png','jpg':'image/jpeg'}[name.split('.').at(-1).toLowerCase()],
    'Cache-Control':'public,max-age=31536000,immutable','X-Content-Type-Options':'nosniff',...cors}});
  }
  if(!['/api/avatar','/api/multi-progress','/api/progress'].includes(path))return json({error:'接口不存在。'},404);
  const authorization=request.headers.get('Authorization');
  if(!authorization?.startsWith('Bearer '))return json({error:'请先登录。'},401);
  const headers={...publicHeaders,Authorization:authorization};
  // Verify the token with Auth; never trust an unverified JWT payload or client user ID.
  const auth=await fetcher(base+'/auth/v1/user',{headers});
  if(!auth.ok){const expired=[401,403].includes(auth.status);return json({error:expired?'请重新登录。':'账号服务暂时不可用。'},expired?401:503);}
  const user=await auth.json();if(!user.id)return json({error:'请重新登录。'},401);
  if(path==='/api/avatar'){
   if(request.method!=='POST')return json({error:'不支持此操作。'},405);
   if(Number(request.headers.get('Content-Length'))>262144)return json({error:'头像超过 256 KB。'},413);
   const bytes=new Uint8Array(await request.arrayBuffer());if(bytes.length>262144)return json({error:'头像超过 256 KB。'},413);
   const type=imageType(bytes);if(!type||request.headers.get('Content-Type')!==type[0])return json({error:'头像格式无效。'},400);
   const name=crypto.randomUUID()+'.'+type[1];
   const upload=await fetcher(base+'/storage/v1/object/avatars/'+name,{method:'POST',headers:{...headers,'Content-Type':type[0],'x-upsert':'false'},body:bytes});
   if(!upload.ok)return json({error:'头像上传未完成，请稍后重试。'},503);
   return json({url:'/api/avatar/'+name});
  }
  if(request.method==='GET'){
   // RLS independently enforces that only auth.uid() can read this row.
   const response=await fetcher(base+'/rest/v1/learning_records?select=data,etag&user_id=eq.'+encodeURIComponent(user.id),{headers});
   if(!response.ok)return json({error:'暂时无法读取云端记录。'},503);
   const records=await response.json();return json(records[0]||{data:null,etag:null});
  }
  if(request.method!=='PUT')return json({error:'不支持此操作。'},405);
  if(Number(request.headers.get('Content-Length'))>16_000_000)return json({error:'记录超过 16 MB，请导出备份。'},413);
  const text=await request.text();if(new TextEncoder().encode(text).length>16_000_000)return json({error:'记录超过 16 MB，请导出备份。'},413);
  const body=JSON.parse(text),data=path==='/api/progress'?migrateClassic(body.data):restoreMulti(body.data);
  if(!data||!(body.etag===null||typeof body.etag==='string'&&body.etag.length>0&&body.etag.length<=200))return json({error:'记录校验失败，原记录未覆盖。'},400);
  const response=await fetcher(base+'/rest/v1/rpc/save_learning_record',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({p_data:data,p_expected_etag:body.etag})});
  if(!response.ok)return json({error:'暂时无法同步，记录仍保存在本机。'},503);
  const result=await response.json();
  if(!result?.modified)return json({error:'另一台设备已更新。请先导出本机备份，再读取云端记录。'},409);
  return json({etag:result.etag});
 }catch(error){return json({error:error instanceof SyntaxError?'记录不是有效 JSON。':'暂时无法同步，记录仍保存在本机。'},error instanceof SyntaxError?400:503);}
}
export default {fetch(request,env){return new URL(request.url).pathname.startsWith('/api/')?handleApi(request,env):env.ASSETS.fetch(request);}};
