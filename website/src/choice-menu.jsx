import React,{useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,ChevronDown,Search,X} from 'lucide-react';
import './choice-menu.css';

export function ChoiceMenu({label,value,options,onChange,searchable=options.length>6,presentation='dialog'}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState('');
 const [position,setPosition]=useState(null);
 const id=useId(),trigger=useRef(),dialog=useRef();
 const dropdown=presentation==='dropdown';
 const selected=options.find(o=>o.value===value);
 const filtered=options.filter(o=>(o.label+' '+(o.description||'')).toLocaleLowerCase().includes(query.toLocaleLowerCase().trim()));
 useLayoutEffect(()=>{
  if(!open||!dropdown)return;
  const place=()=>{
   const rect=trigger.current.getBoundingClientRect(),viewport=window.visualViewport;
   const width=viewport?.width||window.innerWidth,height=viewport?.height||window.innerHeight;
   const offsetLeft=viewport?.offsetLeft||0,offsetTop=viewport?.offsetTop||0;
   const popupWidth=Math.min(Math.max(rect.width,280),width-24);
   setPosition({top:rect.bottom+7,left:Math.max(offsetLeft+12,Math.min(rect.left,offsetLeft+width-popupWidth-12)),width:popupWidth,maxHeight:Math.max(0,Math.min(320,offsetTop+height-rect.bottom-19))});
  };
  place();window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
  window.visualViewport?.addEventListener('resize',place);
  return()=>{window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);window.visualViewport?.removeEventListener('resize',place);};
 },[open,dropdown]);
 useEffect(()=>{
  if(!open)return;
  if(dropdown){
   const focusTrigger=()=>trigger.current?.focus({preventScroll:true});
   const outside=e=>{if(!trigger.current?.contains(e.target)&&!dialog.current?.contains(e.target))setOpen(false);};
   const otherMenu=e=>{if(e.detail!==id)setOpen(false);};
   const focusOutside=e=>{if(!trigger.current?.contains(e.target)&&!dialog.current?.contains(e.target))setOpen(false);};
   const key=e=>{
    if(!trigger.current?.contains(e.target)&&!dialog.current?.contains(e.target))return;
    if(e.key==='Escape'){e.preventDefault();setOpen(false);focusTrigger();}
    if(e.key==='Tab'&&dialog.current?.contains(e.target)){
     // The popup is portalled; return to the trigger so Tab follows page order.
     focusTrigger();setOpen(false);
    }
    if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){
     e.preventDefault();const choices=[...dialog.current.querySelectorAll('[role=option]')],index=choices.indexOf(document.activeElement);
     choices[e.key==='Home'?0:e.key==='End'?choices.length-1:Math.max(0,Math.min(choices.length-1,index+(e.key==='ArrowDown'?1:-1)))]?.focus({preventScroll:true});
    }
   };
   document.dispatchEvent(new CustomEvent('choice-dropdown-open',{detail:id}));
   dialog.current.querySelector('[aria-selected=true]')?.focus({preventScroll:true});
   document.addEventListener('pointerdown',outside,true);document.addEventListener('focusin',focusOutside);document.addEventListener('keydown',key);document.addEventListener('choice-dropdown-open',otherMenu);
   return()=>{document.removeEventListener('pointerdown',outside,true);document.removeEventListener('focusin',focusOutside);document.removeEventListener('keydown',key);document.removeEventListener('choice-dropdown-open',otherMenu);};
  }
  const oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
  dialog.current.querySelector('[aria-selected=true]')?.scrollIntoView?.({block:'nearest'});
  (dialog.current.querySelector('input')||dialog.current.querySelector('[aria-selected=true]')||dialog.current.querySelector('button')).focus();
  const key=e=>{
   if(e.key==='Escape'){e.preventDefault();setOpen(false);}
   const items=[...dialog.current.querySelectorAll('input,button')];
   if(e.key==='Tab'){const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
   if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)&&document.activeElement?.getAttribute('role')==='option'){
    e.preventDefault();const choices=[...dialog.current.querySelectorAll('[role=option]')],index=choices.indexOf(document.activeElement);
    choices[e.key==='Home'?0:e.key==='End'?choices.length-1:Math.max(0,Math.min(choices.length-1,index+(e.key==='ArrowDown'?1:-1)))]?.focus();
   }
  };
  document.addEventListener('keydown',key);
  return()=>{document.body.style.overflow=oldOverflow;document.removeEventListener('keydown',key);trigger.current?.focus();};
 },[open,dropdown,id]);
 if(dropdown)return <div className="choice-menu choice-menu-inline"><button ref={trigger} type="button" className="choice-trigger" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={open?id:undefined} onClick={()=>setOpen(v=>!v)} onKeyDown={e=>{if(!open&&['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();setOpen(true);}}}><span>{selected?.label||label}</span><ChevronDown size={15}/></button>{open&&createPortal(<div ref={dialog} id={id} className="choice-dropdown choice-options" role="listbox" aria-label={label} style={position||{visibility:'hidden'}}>{options.map(o=><button key={o.value} type="button" role="option" aria-selected={o.value===value} tabIndex={o.value===value?0:-1} onClick={()=>{onChange(o.value);setOpen(false);trigger.current?.focus({preventScroll:true});}}><span><strong>{o.label}</strong>{o.description&&<small>{o.description}</small>}</span>{o.value===value?<Check size={18}/>:<span className="choice-dot"/>}</button>)}</div>,document.body)}</div>;
 return <div className="choice-menu"><button ref={trigger} type="button" className="choice-trigger" aria-label={label} aria-haspopup="dialog" aria-expanded={open} aria-controls={open?id:undefined} onClick={()=>{setQuery('');setOpen(true);}}><span>{selected?.label||label}</span><ChevronDown size={15}/></button>{open&&createPortal(<div className="choice-backdrop" onClick={e=>{if(e.target===e.currentTarget)setOpen(false);}}><section ref={dialog} id={id} className={`choice-dialog ${searchable?'searchable':''}`} role="dialog" aria-modal="true" aria-labelledby={id+'-title'}><header><h2 id={id+'-title'}>{label}</h2><button type="button" aria-label="关闭选择菜单" onClick={()=>setOpen(false)}><X size={19}/></button></header>{searchable&&<label className="choice-search"><Search size={17}/><input type="search" aria-label={`搜索${label}`} placeholder="搜索章节或主题…" value={query} onChange={e=>setQuery(e.target.value)}/></label>}<div className="choice-options" role="listbox" aria-label={label}>{filtered.map(o=><button key={o.value} type="button" role="option" aria-selected={o.value===value} onClick={()=>{onChange(o.value);setOpen(false);}}><span><strong>{o.label}</strong>{o.description&&<small>{o.description}</small>}</span>{o.value===value?<Check size={18}/>:<span className="choice-dot"/>}</button>)}{!filtered.length&&<p className="choice-empty">没有找到匹配选项</p>}</div></section></div>,document.body)}</div>;
}
