import React,{useEffect,useRef,useState} from 'react';
import {LoaderCircle,ShieldCheck} from 'lucide-react';
import {requestPasswordRecovery,verifyPasswordRecovery,resetRecoveredPassword} from './supabase-identity.js';

export function PasswordRecovery({onBusy,onComplete,onBack}){
 const [stage,setStage]=useState('email'),[email,setEmail]=useState(''),[sentEmail,setSentEmail]=useState('');
 const [code,setCode]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[cooldown,setCooldown]=useState(0);
 const lock=useRef(false),input=useRef();
 useEffect(()=>{input.current?.focus();},[stage]);
 useEffect(()=>{if(cooldown<=0)return;const timer=setTimeout(()=>setCooldown(v=>Math.max(0,v-1)),1000);return()=>clearTimeout(timer);},[cooldown]);
 async function action(fn){if(lock.current)return;lock.current=true;setBusy(true);onBusy(true);setMessage('');try{await fn();}catch(error){setMessage(error.message||'操作未完成，请稍后再试。');}finally{lock.current=false;setBusy(false);onBusy(false);}}
 async function send(){await action(async()=>{const recipient=(stage==='email'?email:sentEmail).trim();await requestPasswordRecovery(recipient);setSentEmail(recipient);setCode('');setCooldown(60);setStage('code');setMessage('如果该邮箱已注册，验证码已发送。请检查收件箱和垃圾箱。');});}
 async function submit(event){event.preventDefault();if(stage==='email'){await send();return;}await action(async()=>{
  if(stage==='code'){await verifyPasswordRecovery(sentEmail,code);setCode('');setStage('password');return;}
  if(password!==confirm)throw Error('两次输入的新密码不一致。');
  if(password.length<8)throw Error('新密码至少需要 8 位。');
  await resetRecoveredPassword(password);setPassword('');setConfirm('');onComplete();
 });}
 return <div className="password-recovery">
  <ol className="recovery-steps" aria-label="找回密码步骤">{[['email','邮箱'],['code','验证码'],['password','新密码']].map(([value,label],i)=><li key={value} aria-current={stage===value?'step':undefined}><span>{i+1}</span>{label}</li>)}</ol>
  <p>{stage==='email'?'输入注册时使用的邮箱，我们会发送找回密码验证码。':stage==='code'?<>验证码已发送至 <strong>{sentEmail}</strong>。请在 10 分钟内验证，重新发送后使用最新验证码。</>:'邮箱已验证。设置新密码后即可继续使用原账号，学习记录保留。新密码至少 8 位，可以和旧密码相同。'}</p>
  <form onSubmit={submit} aria-busy={busy}>
   {stage==='email'&&<label>注册邮箱<input ref={input} type="email" required autoComplete="email" value={email} disabled={busy} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>}
   {stage==='code'&&<label>邮箱验证码<input ref={input} className="recovery-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} disabled={busy} onPaste={e=>{e.preventDefault();setCode(e.clipboardData.getData('text').replace(/\s/g,'').slice(0,6));}} onChange={e=>setCode(e.target.value.replace(/\s/g,''))} placeholder="6 位数字验证码"/></label>}
   {stage==='password'&&<><label>新密码<input ref={input} type="password" required minLength={8} autoComplete="new-password" value={password} disabled={busy} onChange={e=>setPassword(e.target.value)} placeholder="至少 8 位"/></label><label>确认新密码<input type="password" required minLength={8} autoComplete="new-password" value={confirm} disabled={busy} onChange={e=>setConfirm(e.target.value)} placeholder="再次输入新密码"/></label></>}
   {message&&<p className="form-message" role="status">{message}</p>}
   <button type="submit" className="button primary full" disabled={busy}>{busy?<LoaderCircle size={18} className="spin"/>:stage==='password'?<ShieldCheck size={18}/>:null}{({email:'发送验证码',code:'验证邮箱',password:'保存新密码'})[stage]}</button>
  </form>
  {stage==='code'&&<div className="recovery-links"><button type="button" className="text-link" disabled={busy||cooldown>0} onClick={send}>{cooldown>0?`${cooldown} 秒后可重发`:'重新发送验证码'}</button><button type="button" className="text-link" disabled={busy} onClick={()=>{setStage('email');setCode('');setMessage('');}}>修改邮箱</button></div>}
  <button className="text-link center" disabled={busy} onClick={onBack}>返回登录</button>
 </div>;
}
