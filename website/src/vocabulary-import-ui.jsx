import React,{useEffect,useRef,useState} from 'react';
import {Upload,FileSpreadsheet,CheckCircle2,AlertCircle,X,ArrowRight,BookOpen,Download,Copy,ChevronRight,Info} from 'lucide-react';
import {readVocabularyFile,VOCABULARY_FIELDS,blankCSVTemplate,sameVocabulary} from './vocabulary-import.js';
import {AI_VOCABULARY_PROMPT,GUIDE_STEPS,guideMarkdown,downloadText} from './vocabulary-guide.js';

export function VocabularyGuide({onImport,notify,production=false}){
  async function copy(){try{await navigator.clipboard.writeText(AI_VOCABULARY_PROMPT);notify('已复制 AI 提示词，填写课本信息后即可使用。');}catch{notify('暂时无法复制，请选择下方提示词手动复制。');}}
  return <div className="vi-guide">
    <div className="dp-page-heading"><div><div className="dp-eyebrow">DU LIVRE AUX MOTS</div><h1>把一本课本，变成你的词库。</h1><p>PDF 交给 AI 整理 · 核对原书 · 导入网站检测</p></div><button className="dp-button primary" onClick={onImport}><Upload size={16}/>一键导入词库</button></div>
    <section className="vi-guide-hero"><span className="vi-hero-icon"><FileSpreadsheet size={36}/></span><div><span className="dp-eyebrow">你的课本，你的词汇旅程</span><h2>先生成词库，再开始学习。</h2><p>网站读取你整理好的词条文件，按单元、Part 和主题创建检测卡片。<br/>以下标准参考你提供的 Édito B1 2023 词库，可用于其他法语课本。</p><div className="vi-actions"><button className="dp-button" onClick={()=>downloadText('法语词库_空白模板.csv',blankCSVTemplate(),'text/csv;charset=utf-8')}><Download size={15}/>下载空白模板</button><button className="dp-text-button" onClick={()=>downloadText('AI词库生成与导入教程.md',guideMarkdown(production))}>下载完整教程<Download size={14}/></button></div></div></section>
    <div className="vi-guide-layout"><div>
      <section className="vi-panel"><div className="vi-section-heading"><h2>从 PDF 到检测，五步就绪</h2><span>首次使用约需完整校核一遍</span></div><ol className="vi-steps">{GUIDE_STEPS.map((s,i)=><li key={s.title}><span>{String(i+1).padStart(2,'0')}</span><div><h3>{s.title}</h3><p>{s.body}</p></div></li>)}</ol></section>
      <section className="vi-panel"><div className="vi-section-heading"><h2>直接复制给 AI 的提示词</h2><button className="dp-button" onClick={copy}><Copy size={14}/>复制完整提示词</button></div><p className="vi-muted">上传课本 PDF 后粘贴，先填写名称、级别、版本与提取范围。</p><textarea className="vi-prompt" aria-label="AI 词库生成提示词" readOnly value={AI_VOCABULARY_PROMPT}/></section>
      <section className="vi-panel"><div className="vi-section-heading"><h2>与标准样例一致的 14 列</h2><span>6 列必填 · 8 列建议保留</span></div><div className="vi-field-table">{VOCABULARY_FIELDS.map(f=><div key={f.key}><strong>{f.label}<small className={f.required?'required':''}>{f.required?'必填':'建议'}</small></strong><p>{f.description}</p></div>)}</div><p className="vi-muted">Excel 表头可在前 30 行内；标题与说明行会自动跳过。“完整词库”只放数据，其他说明页不作为词条。</p></section>
    </div><aside className="vi-guide-aside">
      <section className="vi-panel"><BookOpen size={23}/><h3>导入功能说明</h3><ul><li>支持 .xlsx、UTF-8 CSV 和词条数组 JSON；PDF 需先生成词库。</li><li>每文件最多 8 MB、10,000 词。</li><li>自动识别标准列、章节和主题，检查缺失字段、重复 ID 与编号。</li><li>预览通过后确认导入，每本课本单独检测。</li><li>相同词库打开已有课本，不覆盖已有自评。</li></ul></section>
      <section className="vi-panel"><Info size={23}/><h3>文件和进度怎样保存？</h3><p>{production?'词库文件在浏览器中解析。游客词库与学习记录保存在本机；登录后词库随记录同步到账号。请保留原文件，并定期导出完整备份。':'导入文件在本机浏览器中解析，不上传。“记住词库”保存到当前浏览器，最多 30 本；换浏览器或清理网站数据后需重新导入，请保留原文件。'}</p><p>{production?'清理浏览器数据会移除游客记录；已登录账号可恢复云端记录。':'本页仍是设计预览：检测进度仅在本次页面保留，刷新重置；原网站正式学习记录不受影响。'}</p></section>
      <section className="vi-panel"><AlertCircle size={23}/><h3>格式通过，还要核对内容</h3><p>AI 可能遗漏词条、误读扫描页或给出不准确的翻译、音标。请对照原书核实；“待核对”音标不会因导入自动变为已审定。</p></section>
    </aside></div>
  </div>;
}

export function ImportVocabulary({books,defaultTarget='',storageError,close,onImport,onGuide,production=false}){
  const [result,setResult]=useState(null),[error,setError]=useState(null),[busy,setBusy]=useState(false);
  const [name,setName]=useState(''),[level,setLevel]=useState('自由'),[edition,setEdition]=useState(''),[target,setTarget]=useState(defaultTarget),[remember,setRemember]=useState(!storageError);
  const ref=useRef(null),fileRef=useRef(null),ticket=useRef(0),closeRef=useRef(close);closeRef.current=close;
  const duplicate=result&&books.find(b=>b.bank&&sameVocabulary(b.bank,result.entries));
  useEffect(()=>{const previous=document.activeElement,overflow=document.body.style.overflow;document.body.style.overflow='hidden';ref.current.querySelector('button')?.focus();
    function keys(e){if(e.key==='Escape')closeRef.current();if(e.key==='Tab'){const els=[...ref.current.querySelectorAll('button,input,select,a,textarea')].filter(el=>!el.disabled&&el.getClientRects().length);if(e.shiftKey&&document.activeElement===els[0]){e.preventDefault();els.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===els.at(-1)){e.preventDefault();els[0]?.focus();}}}
    window.addEventListener('keydown',keys);return()=>{ticket.current++;window.removeEventListener('keydown',keys);document.body.style.overflow=overflow;previous?.focus();};
  },[]);
  async function select(file){const current=++ticket.current;setError(null);setResult(null);setBusy(true);
    try{const parsed=await readVocabularyFile(file);if(current!==ticket.current)return;setResult(parsed);const b=books.find(b=>b.id===target);setName(b?.name||parsed.book.name);setLevel(b?.level||(['A1','A2','B1','B2','C1','C2','自由'].includes(parsed.book.level)?parsed.book.level:'自由'));setEdition(b?.edition==='待确认版本'?parsed.book.edition:b?.edition||parsed.book.edition);}
    catch(e){if(current===ticket.current)setError(e);}finally{if(current===ticket.current)setBusy(false);}
  }
  function targetChange(id){setTarget(id);const b=books.find(b=>b.id===id);if(b){setName(b.name);setLevel(b.level);setEdition(b.edition==='待确认版本'?result?.book.edition||'':b.edition);}else if(result){setName(result.book.name);setLevel(result.book.level);setEdition(result.book.edition);}}
  function confirm(e){e.preventDefault();setError(null);try{if(storageError&&remember)throw Error(storageError);const b=books.find(b=>b.id===target);if(b&&result.book.level!=='自由'&&b.level!=='自由'&&result.book.level!==b.level)throw Error(`文件识别为 ${result.book.level}，所选课本为 ${b.level}。请确认来源，或选择“创建新课本”。`);onImport(result,{name:name.trim(),level,edition:edition.trim()},target,remember);}catch(e){setError(e);}}
  return <div className="dp-backdrop" onClick={e=>{if(e.target===e.currentTarget)close();}}><section className="dp-dialog vi-import-dialog" role="dialog" aria-modal="true" aria-labelledby="vi-title" ref={ref}>
    <button className="dp-dialog-close" aria-label="关闭导入窗口" onClick={close}><X size={20}/></button><div className="vi-modal-heading"><span className="dialog-icon"><Upload size={24}/></span><div><span className="dp-eyebrow">IMPORTER MON VOCABULAIRE</span><h2 id="vi-title">一键导入词库</h2></div></div>
    <p className="dialog-intro">选一个文件，检查词条，再开始你的课本检测。</p><div className="vi-stage"><span className={!result?'active':'done'}>① 选择文件</span><ChevronRight size={14}/><span className={result?'active':''}>② 检查并确认</span></div>
    <input ref={fileRef} type="file" className="vi-hidden-file" aria-label="选择词库文件" accept=".xlsx,.csv,.json" onChange={e=>{const file=e.target.files?.[0];if(file)select(file);e.target.value='';}}/>
    <button className={`vi-upload ${result?'selected':''}`} disabled={busy} onClick={()=>fileRef.current.click()}><FileSpreadsheet size={result?22:33}/><strong>{busy?'正在读取并检查…':result?result.filename:'选择词库文件'}</strong><span>{result?`${result.sourceSheet} · 点击重新选择`:'Excel .xlsx / UTF-8 CSV / JSON · 最大 8 MB'}</span></button>
    {error&&<div className="vi-message error" role="alert"><AlertCircle size={18}/><div><strong>{error.message}</strong>{error.details?.length>0&&<ul>{error.details.map((d,i)=><li key={i}>{d}</li>)}</ul>}</div></div>}
    {storageError&&<div className="vi-message"><Info size={17}/><span>{storageError}</span></div>}
    {result?<form onSubmit={confirm}>
      {duplicate&&<div className="vi-message"><BookOpen size={17}/><span>这份词库已存在于“{duplicate.name}”。确认后将打开已有课本，保留已有自评与进度。</span></div>}
      <div className="vi-success"><CheckCircle2 size={17}/><strong>核心字段检查通过</strong><span>内容请对照原书核实</span></div><div className="vi-counts">{[['词条',result.summary.words],['单元',result.summary.units],['Part',result.summary.parts],['主题',result.summary.themes]].map(([label,n])=><div key={label}><strong>{n.toLocaleString()}</strong><span>{label}</span></div>)}</div>
      <label>导入到<select value={target} onChange={e=>targetChange(e.target.value)}><option value="">创建新课本</option>{books.filter(b=>!b.bank).map(b=><option key={b.id} value={b.id}>{b.name} · {b.level}</option>)}</select></label>
      <div className="vi-book-fields"><label>课本名称<input required maxLength={48} value={name} onChange={e=>setName(e.target.value)} readOnly={!!target}/></label><label>级别<select value={level} disabled={!!target} onChange={e=>setLevel(e.target.value)}>{['A1','A2','B1','B2','C1','C2','自由'].map(l=><option key={l}>{l}</option>)}</select></label><label>版本 / 年份<input maxLength={36} value={edition} onChange={e=>setEdition(e.target.value)}/></label></div>
      <div className="vi-sample"><strong>词条预览 <span>前 3 条</span></strong>{result.entries.slice(0,3).map(e=><div key={e.id}><span><b lang="fr">{e.fr}</b><small>U{e.unite} · P{e.partie} · {e.group}</small></span><span>{e.zh}</span></div>)}</div>
      {result.warnings.length>0&&<details className="vi-warnings"><summary><Info size={15}/>{result.warnings.length} 项建议核对<ChevronRight size={14}/></summary><ul>{result.warnings.map(w=><li key={w}>{w}</li>)}</ul></details>}
      {!production&&<label className="vi-remember"><input type="checkbox" checked={remember} disabled={!!storageError} onChange={e=>setRemember(e.target.checked)}/><span>记住导入词库<small>仅本浏览器保存；预览检测进度刷新后重置。</small></span></label>}
      <div className="dialog-actions"><button className="dp-button" type="button" onClick={close}>取消</button><button type="submit" className="dp-button primary" disabled={!name.trim()||busy}>{duplicate?'打开已有课本':'确认导入并检测'}<ArrowRight size={15}/></button></div>
    </form>:<div className="vi-import-help"><p>还没有词库？把课本 PDF 发给 AI，按标准生成文件即可。</p><button className="dp-text-button" onClick={onGuide}>查看词库生成教程<ArrowRight size={14}/></button><button className="dp-text-button" onClick={()=>downloadText('法语词库_空白模板.csv',blankCSVTemplate(),'text/csv;charset=utf-8')}>下载空白模板<Download size={14}/></button><p className="vi-local-note">在本机解析文件 · 原学习记录保持不变</p></div>}
  </section></div>;
}
