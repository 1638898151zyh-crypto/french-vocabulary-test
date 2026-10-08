import React,{useState} from 'react';
import {BookOpen,CheckCircle2,Check,X,ChevronDown,RotateCcw,Settings2,Shuffle,ArrowRight,Library,Upload,Info} from 'lucide-react';
import {ChoiceMenu} from './choice-menu.jsx';
import * as Study from './preview-study.js';

const shortPart=p=>p.replace(/^U(\d+)P(\d+)$/,'U$1 · P$2');

export function WordRow({entry,index,attempt,stats,act}){
  const open=!!attempt.opened[entry.id],vote=attempt.votes[entry.id],counts=stats||{good:0,bad:0};
  function flip(){act('toggle',entry.id,null,attempt.id);}
  return <div className={`dp-word-row study-word-row ${open?'opened':''}`} data-word-id={entry.id} onClick={flip}>
    <div className="study-word-top">
      <button className="dp-word-trigger" aria-expanded={open} onClick={e=>{e.stopPropagation();flip();}}><span>{String(index+1).padStart(2,'0')}</span><strong lang="fr">{entry.fr}</strong><ChevronDown size={14} className={open?'opened':''}/></button>
      <span className={`dp-ipa ${!open?'hidden':''}`} aria-hidden={!open}>{entry.ipa||'未提供音标'}</span>
    </div>
    <div className="study-word-bottom">
      <div className="dp-votes">{['good','bad'].map(kind=><button key={kind} disabled={!open} aria-label={`${kind==='good'?'正确':'错误'} ${entry.fr}`} aria-pressed={vote===kind} className={`${kind} ${vote===kind?'chosen':''}`} onClick={e=>{e.stopPropagation();act('vote',entry.id,kind,attempt.id);}}>{kind==='good'?<Check size={16}/>:<X size={16}/>}<span className={!open?'hidden':''}>{counts[kind]}</span></button>)}</div>
      <span className={`dp-answer ${!open?'hidden':''}`} aria-hidden={!open}>{entry.zh}</span>
    </div>
  </div>;
}

export function Quiz({book,state,attempt,act,auto,settings,onSettings,titleFor,themeFor}){
  const grouped=Study.groups(book.bank,attempt),group=grouped[attempt.group]||grouped[0],title=titleFor(book,attempt.part);
  const dictionary=new Map(book.bank.map(e=>[e.id,e]));
  const done=Object.keys(attempt.votes).length,passed=!!state.mastered[attempt.part],good=Object.values(attempt.votes).filter(v=>v==='good').length,bad=done-good,last=attempt.group===grouped.length-1;
  const first=dictionary.get(group.ids[0]);
  return <section className={`dp-quiz study-quiz layout-${settings.layout}`}>
    <header className="quiz-heading"><div><div className="quiz-meta"><span>{book.name}</span><i/>{shortPart(attempt.part)}<span>第 {attempt.round} 轮</span>{passed&&<span className="dp-status available">已过关 · 可重测</span>}</div><h2 lang="fr">{title?.fr}</h2><p>{title?.zh}</p></div><span className="quiz-word-count">{grouped.length} 组 · {attempt.ids.length} 词</span></header>
    <div className="study-tools"><ChoiceMenu presentation="dropdown" label="切换词汇顺序" value={attempt.shuffled?'random':'textbook'} options={[{value:'textbook',label:'按教材顺序',description:'保留课本中的词汇顺序'},{value:'random',label:'按混乱排序',description:'只打乱当前主题内的词汇，保留已判记录'}]} onChange={value=>{const shuffle=value==='random';onSettings({shuffle});act('order',shuffle,null,attempt.id);}}/><ChoiceMenu presentation="dropdown" label="切换卡片布局" value={settings.layout} options={[{value:'classic',label:'对错在左 · 翻译在右'},{value:'right',label:'翻译在左 · 对错在右'}]} onChange={layout=>onSettings({layout})}/></div>
    <div className="quiz-completion"><span>本部分已判 <b>{done}</b> / {attempt.ids.length} 词</span><span className="study-live-score" role="status" aria-live="polite" aria-label="本轮对错与正确率"><span className="score-good">✔ {good}</span><span className="score-bad">✘ {bad}</span><span>正确率 <b>{done?Math.round(good/done*100)+'%':'—'}</b></span></span><div className="dp-track"><span style={{width:done/attempt.ids.length*100+'%'}}/></div></div>
    <div className="dp-group-tabs" role="tablist" aria-label="主题分组">{grouped.map((g,i)=><button role="tab" aria-selected={attempt.group===i} key={g.label} className={attempt.group===i?'active':''} onClick={()=>act('group',i,null,attempt.id)}>第 {i+1} 组</button>)}</div>
    <div className="dp-theme"><span>{String(attempt.group+1).padStart(2,'0')}</span><div><h3 lang="fr">{group.label}</h3><p>{themeFor(book,first)}</p></div><small>{group.ids.length} 词</small></div>
    <div className="dp-word-list">{group.ids.map((id,i)=><WordRow key={id} entry={dictionary.get(id)} index={i} attempt={attempt} stats={state.stats[id]} act={act}/>)}</div>
    <div className="dp-quiz-footer"><span>{book.name} · 本组完整主题词汇</span><span>{attempt.group+1} / {grouped.length} 组</span></div>
    <div className="dp-quiz-actions"><button className="dp-button" onClick={()=>act('repeat',null,null,attempt.id)}><RotateCcw size={15}/>再测本部分</button><button className="dp-button primary" disabled={last&&!!attempt.passReason} onClick={()=>{if(last)act('pass',null,null,attempt.id);else{act('group',attempt.group+1,null,attempt.id);document.querySelector('.dp-group-tabs')?.scrollIntoView({block:'start',behavior:'smooth'});}}}>{last?<CheckCircle2 size={16}/>:<ArrowRight size={16}/>} {last?(auto?'正在完成本轮…':attempt.passReason?'本轮已完成':'本部分过关'):'下一组'}</button></div>
  </section>;
}

export function PartDirectory({book,state,act,titleFor}){
  const active=Study.active(state);
  return <section className="dp-chapters study-directory" aria-label="选择 Part 进行检测"><div className="chapter-heading"><span><BookOpen size={18}/>课本目录 · 选择 Part 检测</span><b>{Study.masteredCount(state)}/{state.order.length} 已过关</b></div><p>{book.name} · {book.edition} · 点击即可进入检测，未完成的卡片可继续。</p><div className="study-part-grid">{Study.parts(book.bank).map(p=>{const title=titleFor(book,p.key),passed=!!state.mastered[p.key],current=p.key===active.part;return <button key={p.key} className={`chapter-item ${current?'current':''}`} aria-current={current?'true':undefined} onClick={()=>act('part',p.key)}><span>{passed?<CheckCircle2 size={18}/>:<span className="chapter-circle">{p.unit}</span>}</span><div><strong>{shortPart(p.key)}</strong><small>{title?.zh||title?.fr}</small>{title?.zh&&<small lang="fr">{title.fr}</small>}</div><span className="chapter-now">{current?'当前检测':passed?'已过关 · 可重测':'开始检测'}</span></button>;})}</div><div className="chapter-note"><Info size={14}/>任选 Part 不会自动过关其他章节；重测累计记录保留。</div></section>;
}

export function Records({book,state,titleFor,production=false}){
  const [selected,setSelected]=useState(null);
  const total=Object.values(state.stats).reduce((n,c)=>n+c.good+c.bad,0);
  return <><div className="dp-record-stats">{[['本书已过关',Study.masteredCount(state),` / ${state.order.length} Part`],['累计自评',total,' 次'],['检测轮次',state.attempts.length,' 轮']].map(([label,n,unit])=><div key={label}><span>{label}</span><strong>{n}<small>{unit}</small></strong></div>)}</div>
    <div className="study-records">{Study.parts(book.bank).map(p=>{const stats=Study.partStatistics(state,book.bank,p.key),title=titleFor(book,p.key),open=selected===p.key;return <section className="study-part-record" key={p.key}><button className="study-record-heading" aria-expanded={open} aria-controls={`record-${p.key}`} onClick={()=>setSelected(open?null:p.key)}><BookOpen size={20}/><span><strong>{shortPart(p.key)} · {title?.zh||title?.fr}</strong><small>{stats.rounds} 轮 · {stats.judged}/{stats.entries.length} 词已自评</small></span><span className="study-record-counts"><b>✔ {stats.good}</b><b>✘ {stats.bad}</b></span><ChevronDown size={17} className={open?'opened':''}/></button>{open&&<div id={`record-${p.key}`} className="study-word-stats"><div className="study-stats-header"><span>词汇 / 释义</span><span>正确次数</span><span>错误次数</span></div>{stats.entries.map(e=><div key={e.id} className="study-stats-row"><span><strong lang="fr">{e.fr}</strong><small>{e.zh}</small></span><span>{e.good}</span><span>{e.bad}</span></div>)}</div>}</section>;})}</div>
    <p className="dp-preview-caption">点击任意 Part 查看每个词的累计次数。同一轮改选替换判定，重测新一轮增加次数。{production?'学习记录自动保存，可在设置中备份。':'当前预览记录刷新后重置。'}</p></>;
}

export function Settings({settings,onChange,production=false}){
  return <div className="study-settings"><section className="vi-panel"><h2><Settings2 size={20}/>检测卡片布局</h2><p>切换布局立即生效，不改变当前卡片和自评。</p><div className="study-layout-options">{[['classic','布局一','对错在左，翻译在右'],['right','布局二','翻译在左，对错在右']].map(([value,label,description])=><label className={settings.layout===value?'selected':''} key={value}><input type="radio" name="card-layout" checked={settings.layout===value} onChange={()=>onChange({layout:value})}/><strong>{label}</strong><small>{description}</small><div className={`study-layout-sample ${value}`}><span>un livre</span><span>{value==='classic'?'✔　✘':'一本书'}</span><span>{value==='classic'?'一本书':'✔　✘'}</span></div></label>)}</div></section>
    <section className="vi-panel"><h2><Shuffle size={20}/>重新检测的词汇顺序</h2><label className="study-setting-check"><input type="checkbox" checked={settings.shuffle} onChange={e=>onChange({shuffle:e.target.checked})}/><span><strong>在同一主题内打乱顺序</strong><small>默认关闭。开启后新卡片和“再测本部分”会在各自主题内重新排列；主题本身不混合，当前卡片不会突然重排。</small></span></label></section><div className="vi-message"><Info size={18}/><span>{production?'布局与乱序偏好、检测记录自动保存；登录后随账号同步。':'布局与乱序偏好保存在当前浏览器。检测记录仍属于本次预览，刷新后重置。'}</span></div></div>;
}

export function About({go,production=false}){
  const steps=[
    ['选择课本','在“我的课本”选择 Édito B1、Inspire A1、Édito A2 2022，或导入自己的词库。课本、词条和累计次数分别记录。'],
    ['选择 Part','进入“课本过关”，在页面底部目录任选 Part。首次打开创建卡片，未完成的卡片可继续；已过关的部分也能检测。'],
    ['点击整行翻词','点击单词所在整行查看中文和音标，再点击 ✔ 或 ✘ 自评。答案区与音标提前预留位置，翻开和收起时单词保持固定。'],
    ['切换布局与顺序','卡片上方可立即切换两种布局。到“设置”开启主题内乱序，下一张新卡片或重测时生效，默认按教材顺序。'],
    ['过关与重测','本轮全部词判断正确会自动过关，也可手动点击“本部分过关”。只标记当前 Part，不代替其他章节过关。点“再测本部分”开始新一轮，旧轮的对错次数保留。'],
    ['查看每个词的统计','进入“词库统计”的“学习记录”，点击 Part 展开每个词的累计正确与错误次数。同一轮重复点击同一个判定不加次数；改选会替换旧判定；新一轮可再次累计。'],
    ['每日检测与普通练习','每日检测只从本书已过关的 Part 抽取五组十词。最近已过关 Part 两组、前两个各一组，其余已过关 Part 一组，每组保持同一主题；词数不足时提示继续学习。首页的普通练习为第一单元 P1＋P2 五组十词，副进度各自独立。'],
    ['邮箱验证码找回密码','登录窗口点击“忘记密码”，输入注册邮箱，填写邮件中的 6 位验证码，再设置新密码。验证码 10 分钟有效，60 秒后可重发；新密码至少 8 位，可以与旧密码相同。原账号和学习记录保留。'],
    ['备份与跨设备继续',production?'游客记录保存在本机，登录后可在其他设备继续。在设置中导出完整备份或本书主进度；导入先检查，再确认恢复。旧版 Édito B1 网站备份和插件主进度也可迁移。':'在“设置与备份”导出多课本完整备份或本书主进度，刷新或换设备后可导入继续。导入先检查并预览，再确认恢复。正式 Édito B1 网站和插件导出的主进度也可迁移到预览；账号同步继续在正式站管理。'],
  ];
  return <div className="study-about"><section className="vi-guide-hero"><span className="vi-hero-icon"><BookOpen size={34}/></span><div><span className="dp-eyebrow">BIENVENUE À FRANMOTEST</span><h2>沿着课本，一点点掌握法语词汇。</h2><p>Franmotest 由 Français（法语）、mots（单词）、test（检测）组合而来，是按教材单元、Part 与主题进行法语到中文自测的学习空间。完整词条优先展示，翻词后自行判断，逐轮积累自己的练习记录。</p><div className="vi-actions"><button className="dp-button primary" onClick={()=>go('study')}>开始检测<ArrowRight size={15}/></button><button className="dp-button" onClick={()=>go('books')}><Library size={15}/>我的课本</button></div></div></section><section className="vi-panel"><h2>使用教程</h2><ol className="vi-steps">{steps.map(([title,body],i)=><li key={title}><span>{String(i+1).padStart(2,'0')}</span><div><h3>{title}</h3><p>{body}</p></div></li>)}</ol></section><section className="vi-panel"><h2>把自己的 PDF 整理成词库</h2><p>先让 AI 按标准提取词汇，核对原书和章节，再到书架页底部一键导入。词库生成教程提供标准字段、空白模板和可复制提示词。</p><button className="dp-button" onClick={()=>go('guide')}><Upload size={15}/>打开词库生成教程</button></section><div className="vi-message"><Info size={18}/><span>{production?'学习记录自动保存，每日检测和普通练习各自独立；换设备可登录同步或通过备份迁移。音标只作学习辅助，请核对待校核内容。':'当前是本地功能预览：检测记录仅在本次页面内保留，刷新后重置；课本词库与设置可以保存在本浏览器。每日检测和普通练习各自独立；正式账号同步请前往正式站。'}</span></div></div>;
}
