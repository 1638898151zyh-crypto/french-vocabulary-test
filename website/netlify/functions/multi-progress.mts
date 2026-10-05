import {getUser,verifyRequestOrigin,AuthError} from '@netlify/identity';
import {getStore,getDeployStore} from '@netlify/blobs';
import type {Context,Config} from '@netlify/functions';
import {restoreMulti,migrateClassic} from '../../src/multi-learning.js';

const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export default async(req:Request,context:Context)=>{
 try{
  const user=await getUser();if(!user)return json({error:'请先登录。'},401);
  const production=context.deploy.context==='production';
  const store=production?getStore({name:'franmo-progress-v2',consistency:'strong'}):getDeployStore({name:'franmo-progress-v2',consistency:'strong'});
  const key='user/'+user.id;
  if(req.method==='GET'){
   const record=await store.getWithMetadata(key,{type:'json'});
   if(record)return json({data:record.data,etag:record.etag});
   const legacy=production?getStore({name:'edito-progress',consistency:'strong'}):getDeployStore({name:'edito-progress',consistency:'strong'});
   const old=await legacy.get(key,{type:'json'});
   const migrated=old&&migrateClassic(old);
   if(old&&!migrated)return json({error:'旧版云端记录无法迁移，原记录已保留。'},422);
   return json({data:migrated||null,etag:null});
  }
  if(req.method!=='PUT')return json({error:'不支持此操作。'},405);
  verifyRequestOrigin(req);
  const text=await req.text();if(new TextEncoder().encode(text).length>16_000_000)return json({error:'记录超过 16 MB，请导出备份。'},413);
  const body=JSON.parse(text),data=restoreMulti(body.data);
  if(!data||!(body.etag===null||typeof body.etag==='string'))return json({error:'记录校验失败，原记录未覆盖。'},400);
  const result=await store.setJSON(key,data,body.etag?{onlyIfMatch:body.etag}:{onlyIfNew:true});
  if(!result.modified)return json({error:'另一台设备已更新。请先导出本机备份，再读取云端记录。'},409);
  return json({etag:result.etag});
 }catch(error){
  if(error instanceof AuthError)return json({error:'请求来源校验失败。'},403);
  if(error instanceof SyntaxError)return json({error:'记录不是有效 JSON。'},400);
  return json({error:'暂时无法同步，记录仍保存在本机。'},503);
 }
};
export const config:Config={path:'/api/multi-progress',method:['GET','PUT']};
