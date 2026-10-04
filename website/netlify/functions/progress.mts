import {getUser,verifyRequestOrigin,AuthError} from '@netlify/identity';
import {getStore,getDeployStore} from '@netlify/blobs';
import type {Context,Config} from '@netlify/functions';
import {restoreBundle} from '../../src/engine.js';

function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}});}
export default async(req:Request,context:Context)=>{
 try{
  const user=await getUser();if(!user)return json({error:'请先登录。'},401);
  const store=context.deploy.context==='production'?getStore({name:'edito-progress',consistency:'strong'}):getDeployStore({name:'edito-progress',consistency:'strong'});
  // The authenticated identity owns the key; request bodies cannot select another account.
  const key='user/'+user.id;
  if(req.method==='GET'){
   const record=await store.getWithMetadata(key,{type:'json'});
   return json({data:record?.data||null,etag:record?.etag||null});
  }
  if(req.method!=='PUT')return json({error:'不支持此操作。'},405);
  verifyRequestOrigin(req);
  const text=await req.text();if(new TextEncoder().encode(text).length>4_000_000)return json({error:'进度备份超过4 MB，请先导出记录。'},413);
  const body=JSON.parse(text),data=restoreBundle(body.data);
  if(!data||!(body.etag===null||typeof body.etag==='string'))return json({error:'进度校验失败，原记录未覆盖。'},400);
  const result=await store.setJSON(key,data,body.etag?{onlyIfMatch:body.etag}:{onlyIfNew:true});
  if(!result.modified)return json({error:'另一台设备已更新进度。请导出本机备份，再读取最新云端记录。'},409);
  return json({etag:result.etag});
 }catch(error){
  if(error instanceof AuthError)return json({error:'请求来源校验失败。'},403);
  if(error instanceof SyntaxError)return json({error:'进度文件不是有效JSON。'},400);
  return json({error:'暂时无法同步，记录仍保存在本机。'},503);
 }
};
export const config:Config={path:'/api/progress',method:['GET','PUT']};
