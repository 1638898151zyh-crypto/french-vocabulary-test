import {backendConfigured,supabaseClient} from './supabase-client.js';
export function apiUrl(path){
 if(!/^\/api\//.test(path))throw Error('无效的接口地址。');
 return import.meta.env?.VITE_NATIVE_APP==='true'&&backendConfigured?new URL(path,import.meta.env.VITE_SITE_URL).href:path;
}
export async function apiFetch(path,options={}){
 if(!backendConfigured)return fetch(path,options);
 const {data,error}=await supabaseClient().auth.getSession();if(error)throw error;
 const headers=new Headers(options.headers);
 if(data.session?.access_token)headers.set('Authorization','Bearer '+data.session.access_token);
 return fetch(apiUrl(path),{...options,credentials:'omit',headers});
}
