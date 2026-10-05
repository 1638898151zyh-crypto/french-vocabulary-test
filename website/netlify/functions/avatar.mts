import {getUser,verifyRequestOrigin,AuthError} from '@netlify/identity';
import {getStore,getDeployStore} from '@netlify/blobs';
import type {Context,Config} from '@netlify/functions';

const MAX_BYTES=256*1024;
const types:Record<string,string>={webp:'image/webp',png:'image/png',jpg:'image/jpeg'};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
function imageType(b:Uint8Array){
  if(b.length>=12&&String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP')return 'webp';
  if(b.length>=8&&[137,80,78,71,13,10,26,10].every((n,i)=>b[i]===n))return 'png';
  if(b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255)return 'jpg';
  return null;
}
export default async(req:Request,context:Context)=>{
  try{
    const production=context.deploy.context==='production';
    const store=production?getStore({name:'franmo-avatars',consistency:'strong'}):getDeployStore({name:'franmo-avatars',consistency:'strong'});
    if(req.method==='GET'){
      const filename=context.params?.filename;
      if(!filename||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(webp|png|jpg)$/i.test(filename))return json({error:'头像不存在。'},404);
      const content=await store.get('avatars/'+filename,{type:'arrayBuffer'});if(!content)return json({error:'头像不存在。'},404);
      return new Response(content,{headers:{'Content-Type':types[filename.split('.').at(-1)!.toLowerCase()],'Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'}});
    }
    if(req.method!=='POST'||context.params?.filename)return json({error:'不支持此操作。'},405);
    const user=await getUser();if(!user)return json({error:'请先登录后上传头像。'},401);
    verifyRequestOrigin(req);
    const length=Number(req.headers.get('content-length'));if(length>MAX_BYTES)return json({error:'头像文件过大。'},413);
    const content=await req.arrayBuffer();if(content.byteLength>MAX_BYTES)return json({error:'头像文件过大。'},413);
    const extension=imageType(new Uint8Array(content));if(!extension||req.headers.get('content-type')!==types[extension])return json({error:'请选择有效的 JPG、PNG 或 WebP 图片。'},415);
    const filename=crypto.randomUUID()+'.'+extension;
    await store.set('avatars/'+filename,content);
    return json({url:'/api/avatar/'+filename});
  }catch(error){
    if(error instanceof AuthError)return json({error:'请求来源校验失败。'},403);
    return json({error:'头像服务暂时不可用，请稍后重试。'},503);
  }
};
export const config:Config={path:['/api/avatar','/api/avatar/:filename'],method:['GET','POST']};
