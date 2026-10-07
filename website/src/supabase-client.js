import {createClient} from '@supabase/supabase-js';

export const backendConfigured=Boolean(import.meta.env?.VITE_SUPABASE_URL&&import.meta.env?.VITE_SUPABASE_ANON_KEY);
let instance;
export function supabaseClient(){
 if(!backendConfigured)throw Error('新账号服务尚未配置，请继续游客学习并保留备份。');
 return instance??=createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'franmotest:supabase-session:v1'}
 });
}
export function normalizeUser(user){
 if(!user)return null;
 // Only administrators can write app_metadata. Preserve the previous local record scope.
 const legacy=user.app_metadata?.legacy_user_id;
 return {id:typeof legacy==='string'&&/^[a-zA-Z0-9_-]{1,200}$/.test(legacy)?legacy:user.id,
  authId:user.id,email:user.email,name:user.user_metadata?.full_name||user.user_metadata?.name,
  pictureUrl:user.user_metadata?.avatar_url,confirmedAt:user.email_confirmed_at,
  createdAt:user.created_at,updatedAt:user.updated_at};
}
