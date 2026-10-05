import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BookOpen, Library, CalendarDays, ChartNoAxesCombined, ChevronDown, ChevronRight, ArrowRight, ArrowUpRight, Check, X, Plus, Search, Sparkles, Layers, RotateCcw, LockKeyhole, CheckCircle2, Bookmark, Info, Upload, ArrowLeft, GraduationCap, Settings2,LayoutDashboard,Shuffle} from 'lucide-react';
import '../../assets/textbook-core.js';
import bank from '../../assets/textbook-bank.json';
import partTitles from '../../assets/part-titles.json';
import themeTitles from '../../assets/theme-titles.json';
import './textbooks-preview.css';
import './navigation-preview.css';
import {loadImportedLibrary,saveImportedLibrary,sameVocabulary,makeImportedBook} from './vocabulary-import.js';
import {ImportVocabulary,VocabularyGuide} from './vocabulary-import-ui.jsx';
import {initialBooks} from './books.js';
import {useMultiLearning,useLearningSlice} from './useMultiLearning.js';
import {AccountModal} from './account-modal.jsx';
import {logout} from '@netlify/identity';
import {touchMulti,migrateClassic} from './multi-learning.js';
import * as Study from './preview-study.js';
import {Quiz,PartDirectory,Records,Settings,About} from './study-preview-ui.jsx';
import {Home,SettingsAndBackup,LibraryStatistics,ReviewQuiz,DailyIntro} from './navigation-preview-ui.jsx';
import {createDaily,createPractice,reviewAction,eligible,validDaily,day} from './preview-review.js';
import {fullBackup,mainBackup,readBackup,downloadJSON} from './preview-backup.js';
import {AccountMenu,AccountAvatar} from './account-menu.jsx';

// Separate preview. Imported banks and settings use their own keys; learning stays in memory.
const core = Study;
const nav = [
  ['home','首页',LayoutDashboard],['study','课本过关',BookOpen],['daily','每日检测',CalendarDays],['library','词库统计',ChartNoAxesCombined],['settings','设置',Settings2],
];
const pageTitles={...Object.fromEntries(nav.map(([id,label])=>[id,label])),books:'我的课本',dictionary:'完整词库',records:'学习记录',guide:'词库生成与导入教程',about:'网站介绍与使用教程',practice:'普通词汇检测',settings:'设置与备份'};
const navigationPage=page=>['dictionary','records'].includes(page)?'library':page;
const ready = b => !!b.bank;
const createProgress = (book,options={}) => core.create(book.bank,book.level,options);
const freshProgress = (books=initialBooks,options={}) => Object.fromEntries(books.filter(ready).map(b=>[b.id,createProgress(b,options)]));
const shortPart = p => p?.replace(/^U(\d+)P(\d+)$/,'U$1 · P$2') || '全书完成';
const titleFor = (book,part) => book.imported ? book.titles[part] : book.id==='edito-b1' ? partTitles[part] : ({U1P1:{fr:'Les premiers mots',zh:'最初的几个词'},U1P2:{fr:'Les objets du quotidien',zh:'日常的小物件'}}[part]);
const themeFor = (book,entry) => entry.group_zh||(book.id==='edito-b1'?themeTitles[entry.group]:book.id==='my-notebook'?(entry.partie===1?'最初的几个词':'日常的小物件'):'');
const bookStatus = b => b.status==='ready'?'词库已就绪':b.status==='demo'?'演示词表':'待添加词库';
const initialPage = () => Object.hasOwn(pageTitles,location.hash.slice(2)) ? location.hash.slice(2) : location.hash==='#/textbook'?'study':'home';

function FileIcon(){return <Upload size={23}/>;}

function Cover({book,small=false}) {
  return <div className={`dp-cover ${book.color} ${small?'small':''}`} aria-hidden="true">
    <div className="cover-top"><span>{book.status==='demo'?'MON CARNET':'LE FRANÇAIS EN PARTAGE'}</span><span>✦</span></div>
    <div className="cover-title">{book.series}<strong>{book.level}</strong></div>
    <div className="cover-art"><span/><span/><span/><i/></div>
    <div className="cover-bottom"><span>{book.edition}</span><span>VOCABULAIRE</span></div>
  </div>;
}

function App({production=false}) {
  const learning=useMultiLearning(production);
  const [auth,setAuth]=useState(false),[switchingAccount,setSwitchingAccount]=useState(false);
  function closeAccount(){setAuth(false);setSwitchingAccount(false);}
  function openAccount(switching=false){setSwitchingAccount(switching);setAuth(true);}
  useEffect(()=>{if(learning.authCallback?.type==='recovery'||learning.authCallback?.type==='invite')setAuth(true);},[learning.authCallback]);
  const [library]=useState(()=>{try{return loadImportedLibrary(window.localStorage);}catch{return {books:[],error:'浏览器无法保存词库，可取消记住词库临时使用。'};}});
  const [books,setBooks]=useLearningSlice(learning,'books',()=>[...initialBooks.map(b=>library.books.find(saved=>saved.id===b.id)||b),...library.books.filter(b=>!initialBooks.some(i=>i.id===b.id))],production);
  const [bookId,setBookId]=useLearningSlice(learning,'bookId',()=>{const selected=new URLSearchParams(location.search).get('book');return books.some(b=>b.id===selected)?selected:'edito-b1';},production);
  const [settings,setSettings]=useLearningSlice(learning,'settings',()=>{try{return core.loadSettings(window.localStorage);}catch{return {...core.DEFAULT_SETTINGS};}},production);
  const [theme,setTheme]=useLearningSlice(learning,'theme',()=>{try{const t=localStorage.getItem('atelier:design-theme:v1');return ['light','dark','system'].includes(t)?t:'light';}catch{return 'light';}},production);
  const [secondary,setSecondary]=useLearningSlice(learning,'secondary',()=>({}),production),[dailyProblem,setDailyProblem]=useState(''),[backupPreview,setBackupPreview]=useState(null);
  const [previewAccount,setPreviewAccount]=useState({id:'preview-alain',name:'Alain'}),[previewAccountDialog,setPreviewAccountDialog]=useState(false);
  const backupInput=useRef(null);
  const [progress,setProgress]=useLearningSlice(learning,'progress',()=>freshProgress(books,{shuffle:settings.shuffle}),production),[page,setPage]=useState(initialPage);
  const [importing,setImporting]=useState(null);
  function changeSettings(patch){const next={...settings,...patch};setSettings(next);try{if(!production)core.saveSettings(window.localStorage,next);}catch{setToast('设置已在本次预览生效，浏览器暂时无法保存。');}}
  function changeTheme(next){setTheme(next);try{if(!production)localStorage.setItem('atelier:design-theme:v1',next);}catch{setToast('外观已应用，浏览器暂时无法保存。');}}
  const [switcher,setSwitcher]=useState(false),[adding,setAdding]=useState(false),[notes,setNotes]=useState(false);
  const [query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[wordQuery,setWordQuery]=useState(''),[toast,setToast]=useState('');
  const switchRef=useRef(null),resetRef=useRef(null);
  const book=books.find(b=>b.id===bookId),state=progress[bookId],attempt=state&&core.active(state);
  const totalParts=ready(book)?core.parts(book.bank).length:0;
  const [autoPart,setAutoPart]=useState(null);
  const allowedStamp=state?eligible(state).join('|'):'';
  function go(next){setPage(next);setSwitcher(false);location.hash='/'+next;window.scrollTo({top:0,behavior:'instant'});}
  function choose(id,next){setBookId(id);setSwitcher(false);setWordQuery('');if(next)go(next);setToast('已切换课本。每本课本的记录分别保留。');}
  function generateDaily(){
    if(!ready(book))return;
    const own=secondary[bookId]||{};const previous=own.daily||{stats:own.dailyStats||{},round:own.dailySerial||0};const result=createDaily(book,state,previous);setDailyProblem(result.problem||'');
    setSecondary(old=>{const prev=old[bookId]||{},history=prev.daily?[{round:prev.daily,allowed:prev.dailyAllowed||eligible(state)},...(prev.dailyHistory||[])].slice(0,20):prev.dailyHistory||[];return {...old,[bookId]:{...prev,daily:result.round,dailyAllowed:eligible(state),dailyStats:result.round?.stats||prev.dailyStats||prev.daily?.stats||{},dailySerial:result.round?.round||prev.dailySerial||prev.daily?.round||0,dailyHistory:history}};});
  }
  function review(mode,action,id,kind,attemptId){setSecondary(old=>{const own=old[bookId]||{},q=own[mode];if(!q||attemptId&&(mode==='daily'?q.launchId:`practice-${q.round}`)!==attemptId)return old;const next=reviewAction(q,mode,action,id,kind,book);if(next===q)return old;const hKey=mode+'History',history=['repeat','next'].includes(action)?[mode==='daily'?{round:q,allowed:eligible(state)}:q,...(own[hKey]||[])].slice(0,20):own[hKey]||[];return {...old,[bookId]:{...own,[mode]:next,...(mode==='daily'?{dailyStats:next.stats,dailySerial:next.round}:{}),[hKey]:history}};});}
  async function prepareBackup(e){const f=e.target.files?.[0];e.target.value='';if(!f)return;try{if(f.size>16_000_000)throw Error('备份文件超过 16 MB。');const source=JSON.parse(await f.text());const migrated=production&&source.mode==='atelier'?migrateClassic(source):null;if(production&&source.mode==='atelier'&&!migrated)throw Error('旧版记录校验失败，原记录未修改。');const result=readBackup(migrated||source,books,progress);setBackupPreview({...result,filename:f.name});}catch(error){setToast('导入未完成：'+error.message);}}
  function restoreBackup(){const result=backupPreview;if(production){learning.adopt(touchMulti({...learning.bundle,...result,secondary:{...learning.bundle.secondary,...result.secondary}}));setBackupPreview(null);go('study');setToast('已恢复学习记录。');return;}setBooks(result.books);setProgress(result.progress);setSecondary(old=>({...old,...result.secondary}));setBookId(result.bookId);if(result.settings){setSettings(result.settings);try{core.saveSettings(localStorage,result.settings);}catch{}}if(result.theme)changeTheme(result.theme);setBackupPreview(null);go('study');setToast('已恢复预览记录；正式网站学习数据保持不变。');}
  function act(action,id,kind,attemptId){
    setProgress(old=>{
      const next=structuredClone(old[bookId]);next.level=book.level;
      if(attemptId&&core.active(next).id!==attemptId)return old;
      let changed=false;
      if(action==='toggle')changed=core.toggle(next,id);
      if(action==='vote')changed=core.vote(next,id,kind);
      if(action==='group'&&Number.isInteger(id)&&id>=0&&id<core.groups(book.bank,core.active(next)).length){core.active(next).group=id;changed=true;}
      if(action==='pass')changed=core.pass(next,book.bank,kind||'manual',{shuffle:settings.shuffle});
      if(action==='repeat')changed=core.repeat(next,book.bank,{shuffle:settings.shuffle});
      if(action==='part')changed=core.selectPart(next,book.bank,id,{shuffle:settings.shuffle});
      if(!changed)return old;
      return {...old,[bookId]:next};
    });
    if(action==='part'||action==='repeat')window.scrollTo({top:0,behavior:'instant'});
  }
  useEffect(()=>{
    const fn=()=>setPage(initialPage());window.addEventListener('hashchange',fn);
    return ()=>window.removeEventListener('hashchange',fn);
  },[]);
  useEffect(()=>{
    if(!switcher)return;
    const fn=e=>{if(!switchRef.current?.contains(e.target))setSwitcher(false);};
    const esc=e=>{if(e.key==='Escape')setSwitcher(false);};
    window.addEventListener('pointerdown',fn);window.addEventListener('keydown',esc);
    switchRef.current?.querySelector('[role="menuitem"]')?.focus();
    return ()=>{window.removeEventListener('pointerdown',fn);window.removeEventListener('keydown',esc);};
  },[switcher]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),4200);return ()=>clearTimeout(timer);},[toast]);
  useEffect(()=>{const media=matchMedia('(prefers-color-scheme: dark)'),apply=()=>{document.documentElement.dataset.previewTheme=theme==='system'?(media.matches?'dark':'light'):theme;};apply();media.addEventListener('change',apply);return ()=>media.removeEventListener('change',apply);},[theme]);
  useEffect(()=>{if(page!=='daily'||!ready(book))return;generateDaily();},[page,bookId,allowedStamp]);
  useEffect(()=>{if(page!=='daily'||!ready(book))return;const timer=setInterval(()=>{if(secondary[bookId]?.daily?.day!==day())generateDaily();},60000);return ()=>clearInterval(timer);},[page,bookId,allowedStamp,secondary[bookId]?.daily?.day]);
  useEffect(()=>{if(page!=='practice'||!ready(book))return;setSecondary(old=>old[bookId]?.practice?old:{...old,[bookId]:{...old[bookId],practice:createPractice(book)}});},[page,bookId]);
  useEffect(()=>{
    if(page!=='study'||!state||attempt.passReason||!core.perfect(state))return;
    const captured=attempt.id;setAutoPart(captured);
    const timer=setTimeout(()=>{act('pass',null,'automatic',captured);setAutoPart(null);setToast('本轮已自动过关；累计次数已保留，可从目录重测任意 Part。');},850);
    return ()=>{clearTimeout(timer);setAutoPart(null);};
  },[state,bookId,page,settings.shuffle]);
  useEffect(()=>{
    if(!state||!secondary[bookId]?.daily||validDaily(secondary[bookId].daily,book,state))return;
    setSecondary(old=>{const own=old[bookId];if(!own?.daily||validDaily(own.daily,book,state))return old;return {...old,[bookId]:{...own,daily:null,dailyStats:own.daily.stats,dailySerial:own.daily.round,dailyHistory:[{round:own.daily,allowed:own.dailyAllowed},...(own.dailyHistory||[])].slice(0,20)}};});
  },[state,bookId,secondary[bookId]?.daily]);
  const shown=books.filter(b=>(filter==='all'||filter==='ready'&&ready(b)||filter==='pending'&&!ready(b))&&`${b.name} ${b.level} ${b.edition}`.toLowerCase().includes(query.toLowerCase()));
  function reset(){setBookId('edito-b1');setProgress(freshProgress(books,{shuffle:settings.shuffle}));setSecondary({});setQuery('');setFilter('all');setAdding(false);setNotes(false);setImporting(null);go('home');setToast('预览进度已重置；导入词库与设置保留，正式学习记录未改动。');}
  function importBook(result,metadata,target,remember){
    const existing=books.find(b=>b.bank&&sameVocabulary(b.bank,result.entries));
    if(existing){setImporting(null);choose(existing.id,'study');setToast('这份词库已存在，已打开原课本；已有自评与进度保留。');return;}
    if(!target&&books.length>=35)throw Error('最多添加 35 本课本，请备份后再整理书架。');
    if(!metadata.name||metadata.name.length>48||!['A1','A2','B1','B2','C1','C2','自由'].includes(metadata.level))throw Error('请检查课本名称和级别。');
    const targetBook=target&&books.find(b=>b.id===target);
    if(target&&(!targetBook||targetBook.bank))throw Error('请选择待添加词库的课本，或创建新课本。');
    const imported=makeImportedBook(result,metadata,target||crypto.randomUUID());imported.remember=remember;
    const next=target?books.map(b=>b.id===target?imported:b):[...books,imported];
    if(remember&&!production){if(library.error)throw Error(library.error);saveImportedLibrary(window.localStorage,next);}
    setBooks(next);setProgress(old=>({...old,[imported.id]:createProgress(imported,{shuffle:settings.shuffle})}));setImporting(null);setQuery('');setFilter('all');choose(imported.id,'study');
    setToast(`已导入 ${result.summary.words.toLocaleString()} 条词汇。${production?'词库与学习记录随当前学习空间保存。':remember?'词库已保存在本浏览器。':'词库仅在本次预览使用。'}`);
  }
  const currentPart=attempt?.part||null;
  const currentTitle=currentPart&&titleFor(book,currentPart);

  if(production&&learning.sync==='loading')return <div className="site-loading" role="status">正在恢复学习记录…</div>;
  return <div className={`dp-shell ${production?'dp-production':''}`}>
    {!production&&<div className="dp-preview-bar"><span><Sparkles size={14}/><strong>设计预览</strong><span>仅使用临时演示进度 · 原有学习记录保持不变</span></span><button ref={resetRef} onClick={reset}><RotateCcw size={13}/>重置预览</button></div>}
    <aside className="dp-sidebar">
      <a className="dp-brand" href="#/home" onClick={e=>{e.preventDefault();go('home');}}><span className="dp-brand-icon"><BookOpen size={24}/></span><span>Atelier<small>法语词汇学习</small></span><span className="brand-dot"/></a>
      <div className="dp-nav-label">MON ESPACE<span>学习空间</span></div>
      <nav aria-label="主要导航">{nav.map(([id,label,Icon])=><button key={id} className={`dp-nav-item ${navigationPage(page)===id?'active':''}`} onClick={()=>go(id)}><Icon size={19}/><span>{id==='settings'?'设置与备份':label}</span>{navigationPage(page)===id&&<span className="nav-dot"/>}</button>)}</nav>
      <div className="dp-side-course"><div className="side-course-label">当前学习课本<Bookmark size={13}/></div><div className={`side-course-icon ${book.color}`}><BookOpen size={24}/></div><strong>{book.name}</strong><small>{ready(book)?`${book.bank.length} 词 · 独立学习进度`:'词库尚未添加'}</small><button onClick={()=>go('books')}>查看我的课本<ArrowUpRight size={14}/></button></div>
      <div className="dp-side-bottom">{!production&&<button onClick={()=>setNotes(true)}><Info size={17}/>设计说明</button>}<div className="dp-user">{production&&learning.user?<AccountAvatar user={learning.user}/>:<span><GraduationCap size={20}/></span>}<div><strong>{production?(learning.user?.name||'游客学习'):'预览模式'}</strong><small>{production?({loading:'正在恢复记录',local:'已保存到本机',memory:'保存受限，请导出备份',pending:'等待云端同步',saving:'正在同步',cloud:'已同步到云端',offline:'本机保存，等待同步',conflict:'同步冲突，请到设置处理'})[learning.sync]:'体验课本切换与检测'}</small></div></div></div>
    </aside>
    <main className="dp-main">
      <header className="dp-topbar"><div className="dp-breadcrumb"><span>学习空间</span><ChevronRight size={13}/><strong>{pageTitles[page]}</strong></div><div className="dp-top-right">
        <div className="dp-switch-wrap" ref={switchRef}>
          <button className="dp-switch" aria-label="切换当前课本" aria-expanded={switcher} aria-haspopup="menu" onClick={()=>setSwitcher(!switcher)}><span className={`switch-cover ${book.color}`}><BookOpen size={15}/></span><span><small>当前课本</small><strong>{book.name}</strong></span><ChevronDown size={15}/></button>
          {switcher&&<div className="dp-switch-menu" role="menu" aria-label="选择课本"><div className="switch-menu-label">切换学习课本<span>进度分别保存</span></div>{books.map(b=><button key={b.id} role="menuitem" onClick={()=>choose(b.id)} className={bookId===b.id?'selected':''}><span className={`switch-cover ${b.color}`}><BookOpen size={17}/></span><span><strong>{b.name}</strong><small>{bookStatus(b)}</small></span>{bookId===b.id&&<Check size={16}/>}</button>)}<button className="switch-manage" role="menuitem" onClick={()=>go('books')}><Library size={15}/>管理我的课本<ArrowRight size={14}/></button></div>}
        </div><AccountMenu user={production?learning.user:previewAccount} demo={!production} loading={production&&learning.sync==='loading'} onLogin={()=>production?openAccount():setPreviewAccountDialog(true)} onSwitch={()=>production?openAccount(true):setPreviewAccountDialog(true)} onSettings={()=>go('settings')} onLogout={async()=>{if(production){await logout();learning.setMessage('已退出，恢复游客学习记录。');}else{setPreviewAccount(null);setToast('已退出演示账号。');}}}/>
      </div></header>
      <div className="dp-content">
        {page==='home'&&<Home books={books} book={book} state={state} go={go} titleFor={titleFor}/>}
        {page==='books'&&<>
          <div className="dp-page-heading"><div><div className="dp-eyebrow">MA BIBLIOTHÈQUE</div><h1>我的课本<span>每一本，都有自己的旅程。</span></h1><p>选择一本课本，继续你的词汇学习。切换课本时，各自的进度与记录都会保留。</p></div></div>
          {library.error&&<div className="vi-message"><Info size={17}/><span>{library.error}</span></div>}<section className="dp-featured"><div className="featured-copy"><span className="dp-eyebrow"><span className="green-dot"/>当前学习课本</span><h2>{book.name}<span>{book.edition}</span></h2><p>{ready(book)?(state.completed?'这本课本已完成。回顾已学词汇，让记忆更牢固。':`从 ${shortPart(currentPart)} 开始，${currentTitle?.zh||currentTitle?.fr||'继续你的学习'}。`):'添加这本课本的词库后，就可以开始检测。'}</p><div className="featured-meta">{ready(book)?<><span><Layers size={14}/>{book.id==='edito-b1'?'12 个单元':`${new Set(book.bank.map(e=>e.unite)).size} 个单元`}</span><span>{totalParts} 个 Part</span><span>{book.bank.length.toLocaleString()} 条词汇</span></>:<span><Upload size={14}/>词库待添加</span>}</div><div className="featured-actions"><button className="dp-button primary" onClick={()=>go('study')}>{ready(book)?'进入课本检测':'查看课本详情'}<ArrowRight size={15}/></button><button className="dp-text-button" onClick={()=>go('records')}>查看本书记录<ChevronRight size={14}/></button></div></div><div className="featured-right"><div className="featured-progress"><span>本书预览进度</span><strong>{state?.current||0}<small> / {totalParts||'—'} Part</small></strong><div className="dp-track"><span style={{width:totalParts?(state?.current||0)/totalParts*100+'%':'0%'}}/></div><small>切换课本，进度分别保留</small></div><Cover book={book}/></div></section>
          <div className="dp-shelf-toolbar"><div className="dp-filters" role="group" aria-label="筛选课本">{[['all','全部课本'],['ready','可检测'],['pending','待添加词库']].map(([id,label])=><button key={id} aria-pressed={filter===id} className={filter===id?'selected':''} onClick={()=>setFilter(id)}>{label}{id==='all'&&<span>{books.length}</span>}</button>)}</div><label className="dp-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索课本或级别…" aria-label="搜索课本"/></label></div>
          <div className="dp-book-grid">{shown.map(b=>{const p=progress[b.id],n=ready(b)?core.parts(b.bank).length:0;return <article key={b.id} className={`dp-book-card ${b.id===bookId?'current':''}`}>
            <div className="book-cover-wrap"><Cover book={b}/>{b.id===bookId&&<span className="dp-current-tag"><Check size={11}/>当前课本</span>}</div>
            <div className="book-card-body"><div className="book-heading"><h3>{b.name}</h3><span className={`dp-status ${ready(b)?'available':'pending'}`}>{bookStatus(b)}</span></div><p>{b.subtitle}</p><div className="book-numbers">{ready(b)?<><span>{b.bank.length.toLocaleString()} 词</span><i/><span>{n} 个 Part</span><span className="book-done">{p?.current||0} / {n}</span></>:<span>词库添加后开启检测</span>}</div><div className="dp-track"><span style={{width:n?(p?.current||0)/n*100+'%':'0%'}}/></div><button className={`book-card-action ${b.id===bookId?'active':''}`} onClick={()=>choose(b.id,'study')}>{ready(b)?b.id===bookId?'开始检测':'选择这本课本':'查看课本详情'}<ArrowRight size={15}/></button></div>
          </article>;})}</div>
          {!shown.length&&<div className="dp-empty compact"><Search size={25}/><h2>没有找到课本</h2><p>试试其他关键词，或添加自己的课本。</p></div>}
          <div className="dp-bottom-note"><span className="note-icon"><Bookmark size={20}/></span><div><strong>切换课本，也保留你走过的每一步。</strong><p>课本检测、每日复习、词库与学习记录始终属于当前课本，各本课本互不混用。</p></div><span className="dp-note-french">Un livre, un parcours.</span></div>
          <section className="vi-add-books" aria-label="添加课本与导入词库"><div className="vi-actions"><button className="dp-button" onClick={()=>setAdding(true)}><Plus size={16}/>添加课本</button><button className="dp-button primary" onClick={()=>setImporting({target:''})}><Upload size={16}/>一键导入词库</button></div><div className="vi-shelf-tip"><div><FileIcon/><span><strong>自己的课本，也能一键开始。</strong><small>按标准生成词库，导入后自动识别单元与主题。首页和设置中提供生成教程。</small></span></div></div></section>
          <footer className="dp-footer"><span>Petit à petit, on va loin.</span><span>Édito B2 为待接入示例；自定义笔记使用演示词表。</span></footer>
        </>}
        {page==='guide'&&<VocabularyGuide production={production} onImport={()=>setImporting({target:''})} notify={setToast}/>}
        {page==='settings'&&<><div className="dp-page-heading"><div><div className="dp-eyebrow">MES PRÉFÉRENCES</div><h1>设置与备份</h1><p>备份学习记录，调整界面外观、卡片布局与词汇顺序。</p></div></div><SettingsAndBackup production={production} learning={learning} onAccount={()=>openAccount()} onGuest={()=>{const guest=learning.guest();if(!guest){setToast('没有有效游客记录。');return;}setBackupPreview({...readBackup(guest,books,progress),filename:'本机游客记录'});}} book={book} settings={settings} onChange={changeSettings} theme={theme} onTheme={changeTheme} onFullBackup={()=>downloadJSON(production?learning.bundle:fullBackup(books,progress,settings,bookId,secondary,theme),production?'franmo-multibook-backup.json':'atelier-multibook-preview-backup.json')} onMainBackup={()=>downloadJSON(mainBackup(book,state),`${book.id}-${production?'':'preview-'}main-progress.json`)} onImport={()=>backupInput.current.click()} go={go}/></>}
        {page==='about'&&<><div className="dp-page-heading"><div><div className="dp-eyebrow">L’ATELIER</div><h1>网站介绍与使用教程</h1></div></div><About go={go} production={production}/></>}
        {!['home','books','guide','settings','about'].includes(page)&&<><div className="dp-context"><button onClick={()=>go('books')}><ArrowLeft size={14}/>我的课本</button><span>/</span><strong>{book.name}</strong><span className="context-level">{book.level}</span><span className="context-status">{bookStatus(book)}</span></div><div className="dp-page-heading inner"><div><div className="dp-eyebrow">{page==='study'?'APPRENDRE':page==='daily'?'RÉVISER':page==='records'?'MES PROGRÈS':'LE VOCABULAIRE'}</div><h1>{pageTitles[page]}</h1><p>{page==='study'?'按主题检测，点击整行翻词；页面底部可任选 Part。':page==='daily'?'只复习当前课本已过关的内容，不混入其他课本词汇。':page==='practice'?'第一单元 P1＋P2 混合练习，五组各十词；累计独立，不改变课本过关。':'浏览完整词库，按 Part 查看每个词的累计正确与错误次数。'}</p></div><button className="dp-button" onClick={()=>go('books')}><Library size={15}/>切换课本</button></div>
        {!ready(book)?<section className="dp-unavailable"><Cover book={book}/><div><span className="dp-status pending">词库待添加</span><h2>课本已选好，下一步添加词库。</h2><p>{book.name} 目前只有课本信息。导入对应的词条与章节后，就能开始检测并保存这本课本自己的进度。</p><button className="dp-button primary" onClick={()=>setImporting({target:book.id})}><Upload size={16}/>一键导入词库</button><button className="dp-text-button" onClick={()=>choose('edito-b1')}>先体验 Édito B1<ArrowRight size={14}/></button></div></section>:
          page==='study'?<div className="study-page">
            {book.notice&&<div className="vi-message"><Info size={17}/><span>{book.notice}</span></div>}
            <div className="study-setting-link"><button className="dp-text-button" onClick={()=>go('settings')}><Settings2 size={16}/>布局与乱序设置</button></div>
            <Quiz book={book} state={state} attempt={attempt} act={act} auto={autoPart===attempt.id} settings={settings} onSettings={changeSettings} titleFor={titleFor} themeFor={themeFor}/>
            <PartDirectory book={book} state={state} act={act} titleFor={titleFor}/>
          </div>:
          page==='daily'?<><DailyIntro book={book} state={state} onGenerate={generateDaily}/>{secondary[bookId]?.daily&&validDaily(secondary[bookId].daily,book,state)?<ReviewQuiz book={book} quiz={secondary[bookId].daily} mode="daily" settings={settings} changeSettings={changeSettings} act={(...args)=>review('daily',...args)} themeFor={themeFor}/>:<section className="dp-empty"><span className="empty-icon"><CalendarDays size={33}/></span><h2>先为 {book.name} 积累一点进度</h2><p>{dailyProblem||'需要至少过关 4 个 Part，各组需有足够的同主题词汇。'}<br/>最近已过关 Part 抽两组，前两个各一组，其余已过关 Part 抽一组；每组 10 词。</p><div className="daily-course"><BookOpen size={16}/>{book.name}<span>本书已过关 {state.current} 个 Part</span></div><div className="vi-actions"><button className="dp-button primary" onClick={()=>go('study')}>继续本书检测<ArrowRight size={15}/></button><button className="dp-button" onClick={()=>backupInput.current.click()}><Upload size={15}/>导入已有进度</button></div></section>}</>:
          page==='practice'?secondary[bookId]?.practice?<ReviewQuiz book={book} quiz={secondary[bookId].practice} mode="practice" settings={settings} changeSettings={changeSettings} act={(...args)=>review('practice',...args)} themeFor={themeFor}/>:<section className="dp-empty"><Shuffle size={30}/><h2>本书暂不满足五组十词的条件</h2><p>第一单元 P1 和 P2 各需要至少 25 个不同词条。可继续完整主题的课本过关。</p><button className="dp-button primary" onClick={()=>go('study')}>继续课本过关<ArrowRight size={15}/></button></section>:
          <LibraryStatistics production={production} key={book.id} book={book} state={state} view={page} go={go} titleFor={titleFor} themeFor={themeFor} secondary={secondary[bookId]}/>}
        </>}
      </div>
    </main>
    <nav className="dp-mobile-nav" aria-label="手机导航">{nav.map(([id,label,Icon])=><button key={id} className={navigationPage(page)===id?'active':''} onClick={()=>go(id)}><Icon size={20}/><span>{label}</span></button>)}</nav>
    <input className="vi-hidden-file" ref={backupInput} type="file" accept="application/json,.json" aria-label="导入学习进度文件" onChange={prepareBackup}/>
    {!production&&previewAccountDialog&&<Dialog title="体验账号菜单" close={()=>setPreviewAccountDialog(false)}><p className="dialog-intro">这里演示登录后的头像菜单；真实登录与保持登录在正式网站使用。</p><div className="preview-account-options">{[{id:'preview-alain',name:'Alain'},{id:'preview-camille',name:'Camille'}].map(account=><button key={account.id} onClick={()=>{setPreviewAccount(account);setPreviewAccountDialog(false);setToast('已切换演示账号；本地预览不会改动正式账号。');}}><strong>{account.name}</strong><small>选择演示账号</small></button>)}</div><a className="dp-button" href="https://franmotest.netlify.app/#/settings" target="_blank" rel="noreferrer">前往正式站登录<ArrowUpRight size={15}/></a></Dialog>}
    {backupPreview&&<Dialog title={production?"恢复学习记录":"恢复预览学习记录"} close={()=>setBackupPreview(null)}><div className="dp-design-notes"><p><b>{backupPreview.filename}</b></p><p>{backupPreview.label} · {backupPreview.books.filter(b=>b.bank).length} 本已就绪课本</p><p>已校验词条与判定次数。{production?'确认后替换对应课本的学习记录，建议先导出当前备份。':'确认后替换对应课本的预览进度；正式站记录不变。'}</p></div><div className="dialog-actions"><button className="dp-button" onClick={()=>setBackupPreview(null)}>取消</button><button className="dp-button primary" onClick={restoreBackup}>{production?'恢复记录':'恢复到预览'}</button></div></Dialog>}
    {production&&auth&&<AccountModal learning={learning} close={closeAccount} switching={switchingAccount}/>}
    {production&&learning.message&&<div className="dp-toast" role="status"><Info size={18}/><span>{learning.message}</span><button aria-label="关闭提示" onClick={()=>learning.setMessage('')}><X size={15}/></button></div>}
    {toast&&<div className="dp-toast" role="status"><CheckCircle2 size={18}/><span>{toast}</span><button aria-label="关闭提示" onClick={()=>setToast('')}><X size={15}/></button></div>}
    {importing&&<ImportVocabulary production={production} books={books} defaultTarget={importing.target} storageError={production?null:library.error} close={()=>setImporting(null)} onImport={importBook} onGuide={()=>{setImporting(null);go('guide');}}/>}
    {adding&&<AddBook production={production} close={()=>setAdding(false)} onAdd={data=>{if(books.length>=35){setToast('最多添加 35 本课本。');return;}const b={...data,id:crypto.randomUUID(),series:data.name,subtitle:'自己的课本，自己的学习节奏。',color:'sand',status:'pending'};setBooks(old=>[...old,b]);setAdding(false);setFilter('all');setQuery('');setToast('课本已添加到书架；添加词库后才能开始检测。');}}/>}
    {notes&&<Dialog title="多课本设计说明" close={()=>setNotes(false)}><div className="dp-design-notes"><p><b>① 先选择课本</b>书架展示课本、级别、词库状态和进度；顶部随时切换。</p><p><b>② 检测围绕当前课本</b>课本检测、每日复习、词库和记录一同切换。</p><p><b>③ 每本课本独立保存</b>切到另一本，原来的卡片、自评、过关与历史都保留。</p><p><b>④ 词库先就绪，再开始</b>现有 Édito B1 使用真实 1110 词；Édito A2 2022 和 Inspire A1 已接入；B2 仍是待接入选项。法语笔记是 6 词演示，不来自任何教材。</p><p><b>本次仅为交互预览</b>检测进度在页面内存中，刷新重置；勾选记住的导入词库保存在本浏览器。原有正式学习记录不读取、修改或同步。</p></div></Dialog>}
  </div>;
}

function Dialog({title,close,children}){
  const ref=useRef(null),previous=useRef(document.activeElement),closeRef=useRef(close);closeRef.current=close;
  useEffect(()=>{
    const initial=ref.current?.querySelector('input')||ref.current?.querySelector('button');initial?.focus();
    const fn=e=>{if(e.key==='Escape')closeRef.current();if(e.key==='Tab'){const list=[...ref.current.querySelectorAll('input,select,button')].filter(e=>!e.disabled);if(e.shiftKey&&document.activeElement===list[0]){e.preventDefault();list.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===list.at(-1)){e.preventDefault();list[0].focus();}}};
    const overflow=document.body.style.overflow;document.body.style.overflow='hidden';window.addEventListener('keydown',fn);
    return ()=>{window.removeEventListener('keydown',fn);document.body.style.overflow=overflow;previous.current?.focus();};
  },[]);
  return <div className="dp-backdrop" onClick={e=>{if(e.target===e.currentTarget)close();}}><section className="dp-dialog" role="dialog" aria-modal="true" aria-labelledby="dp-dialog-title" ref={ref}><button className="dp-dialog-close" aria-label="关闭窗口" onClick={close}><X size={20}/></button><span className="dialog-icon"><BookOpen size={24}/></span><h2 id="dp-dialog-title">{title}</h2>{children}</section></div>;
}
function AddBook({close,onAdd,production=false}){
  const [name,setName]=useState(''),[level,setLevel]=useState('A2'),[edition,setEdition]=useState('');
  return <Dialog title="添加一本课本" close={close}><p className="dialog-intro">从课本信息开始，为它留一个独立的学习空间。</p><form onSubmit={e=>{e.preventDefault();if(name.trim())onAdd({name:name.trim(),level,edition:edition.trim()||'未填写版本'});}}><label>课本名称<input required maxLength={48} placeholder="例如：Édito A2、我的法语笔记" value={name} onChange={e=>setName(e.target.value)}/></label><div className="dialog-fields"><label>级别<select value={level} onChange={e=>setLevel(e.target.value)}>{['A1','A2','B1','B2','C1','C2','自由'].map(l=><option key={l}>{l}</option>)}</select></label><label>版本 / 年份<input maxLength={36} placeholder="例如：2023 版" value={edition} onChange={e=>setEdition(e.target.value)}/></label></div><div className="dialog-note"><Info size={17}/><span>添加后还需要导入词库，才能开始检测。每本课本拥有自己的章节、进度与记录。</span></div><div className="dialog-actions"><button type="button" className="dp-button" onClick={close}>取消</button><button type="submit" className="dp-button primary" disabled={!name.trim()}><Plus size={15}/>{production?'添加到书架':'添加到预览'}</button></div></form></Dialog>;
}

const previewContainer=document.getElementById('root');
previewContainer.atelierRoot||=createRoot(previewContainer);
previewContainer.atelierRoot.render(<App production={!location.pathname.endsWith('/textbooks-preview.html')}/>);
