import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';

const bank=Array.from({length:8},(_,i)=>[0,1].map(n=>({id:`word-${i}-${n}`,unite:i+1,partie:1,group:`theme-${i}-${n}`,fr:`mot-${i}-${n}`,zh:`词 ${i}-${n}`}))).flat();
const output=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {LibraryStatistics} from './src/navigation-preview-ui.jsx';const bank=${JSON.stringify(bank)};window.renderLibrary=(id='fixture')=>createRoot(document.getElementById('root')).render(<LibraryStatistics book={{id,bank}} state={{order:bank.filter((_,i)=>i%2===0).map(e=>'U'+e.unite+'P1')}} view="library" go={()=>{}} titleFor={(_,key)=>({zh:key+'中文标题',fr:'Titre '+key})} themeFor={(_,e)=>'主题中文 '+e.group}/>);window.renderLibrary();`,resolveDir:process.cwd(),loader:'jsx'},bundle:true,write:false,format:'iife',platform:'browser',loader:{'.css':'empty'},logLevel:'silent'});
const pause=()=>new Promise(r=>setTimeout(r,30));
function app(){const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test/',runScripts:'dangerously',pretendToBeVisual:true});dom.window.HTMLElement.prototype.scrollIntoView=()=>{};dom.window.eval(output.outputFiles[0].text);return dom;}
async function choose(w,label,match){w.document.querySelector(`button[aria-label="${label}"]`).click();await pause();const option=[...w.document.querySelectorAll('[role=option]')].find(b=>b.textContent.includes(match));assert.ok(option,match);option.click();await pause();}
const button=(d,text)=>[...d.querySelectorAll('.np-library-pager button')].find(b=>b.textContent.includes(text));

test('Part and theme bottom navigation obey boundaries, reset themes on Part change and retain the search query',async()=>{
 const dom=app(),w=dom.window,d=w.document;try{
  await pause();assert.equal(d.querySelector('.np-library-pager'),null);d.querySelector('[aria-label="筛选 Part"]').click();await pause();assert.equal(d.querySelector('.choice-search'),null);assert.equal(d.activeElement.getAttribute('role'),'option');assert.equal(d.querySelectorAll('[role=option]').length,9);d.querySelector('[aria-label="关闭选择菜单"]').click();await pause();
  await choose(w,'筛选 Part','U1 · P1');assert.equal(d.querySelectorAll('.np-dictionary details').length,2);assert.ok(button(d,'上一个 Part').disabled);assert.ok(!button(d,'下一个 Part').disabled);
  await choose(w,'筛选主题','theme-0-0');assert.equal(d.querySelectorAll('.np-library-pager section').length,2);assert.ok(button(d,'上一个主题').disabled);
  button(d,'下一个主题').click();await pause();assert.match(d.querySelector('.np-dictionary').textContent,/mot-0-1/);assert.ok(button(d,'下一个主题').disabled);
  button(d,'下一个 Part').click();await pause();assert.equal(d.querySelectorAll('.np-library-pager section').length,1);assert.match(d.querySelector('[aria-label="筛选主题"]').textContent,/全部主题/);assert.match(d.querySelector('.np-dictionary').textContent,/mot-1-0/);
  await choose(w,'筛选 Part','U8 · P1');assert.ok(button(d,'下一个 Part').disabled);button(d,'上一个 Part').click();await pause();assert.match(d.querySelector('[aria-label="筛选 Part"]').textContent,/U7/);
  await choose(w,'筛选 Part','全部');await choose(w,'筛选主题','theme-1-0');assert.equal(d.querySelectorAll('.np-library-pager section').length,1);assert.equal(button(d,'下一个 Part'),undefined);button(d,'下一个主题').click();await pause();assert.match(d.querySelector('.np-dictionary').textContent,/mot-1-1/);
  const input=d.querySelector('[aria-label="搜索法语或中文"]');Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value').set.call(input,'no-match');input.dispatchEvent(new w.Event('input',{bubbles:true}));await pause();button(d,'下一个主题').click();await pause();assert.equal(input.value,'no-match');assert.equal(d.querySelectorAll('.np-dictionary details').length,0);assert.ok(button(d,'上一个主题'));
 }finally{dom.window.close();}
});
test('searchable menu filters long labels, traps keyboard focus, closes on Escape and restores trigger focus and scrolling',async()=>{
 const dom=app(),w=dom.window,d=w.document;try{
  await pause();d.body.style.overflow='auto';const trigger=d.querySelector('[aria-label="筛选主题"]');trigger.click();await pause();assert.equal(d.body.style.overflow,'hidden');assert.equal(trigger.getAttribute('aria-expanded'),'true');
  const search=d.querySelector('.choice-search input');assert.equal(d.activeElement,search);Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value').set.call(search,'theme-7-1');search.dispatchEvent(new w.Event('input',{bubbles:true}));await pause();assert.equal(d.querySelectorAll('[role=option]').length,1);assert.match(d.querySelector('[role=option]').textContent,/theme-7-1/);
  d.querySelector('[role=option]').focus();d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Tab',bubbles:true}));assert.equal(d.activeElement.getAttribute('aria-label'),'关闭选择菜单');d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await pause();assert.equal(d.querySelector('[aria-modal=true]'),null);assert.equal(d.activeElement,trigger);assert.equal(d.body.style.overflow,'auto');
  trigger.click();await pause();d.querySelector('.choice-backdrop').click();await pause();assert.equal(d.querySelector('[aria-modal=true]'),null);
 }finally{dom.window.close();}
});

const dropdownOutput=await build({stdin:{contents:`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {ChoiceMenu} from './src/choice-menu.jsx';function App(){const [order,setOrder]=useState('textbook'),[layout,setLayout]=useState('classic');return <><ChoiceMenu presentation="dropdown" label="切换词汇顺序" value={order} options={[{value:'textbook',label:'按教材顺序'},{value:'random',label:'按混乱排序'}]} onChange={setOrder}/><ChoiceMenu presentation="dropdown" label="切换卡片布局" value={layout} options={[{value:'classic',label:'对错在左 · 翻译在右'},{value:'right',label:'翻译在左 · 对错在右'}]} onChange={setLayout}/><button id="outside">页面其他操作</button></>}createRoot(document.getElementById('root')).render(<App/>);`,resolveDir:process.cwd(),loader:'jsx'},bundle:true,write:false,format:'iife',platform:'browser',loader:{'.css':'empty'},logLevel:'silent'});

test('anchored dropdowns preserve scrolling, toggle in place and stay inside narrow viewports',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test/',runScripts:'dangerously',pretendToBeVisual:true}),w=dom.window,d=w.document;
 w.innerWidth=320;w.innerHeight=700;
 w.HTMLElement.prototype.getBoundingClientRect=function(){return this.getAttribute('aria-label')==='切换卡片布局'?{left:160,bottom:200,width:140}:{left:20,bottom:200,width:130};};
 w.eval(dropdownOutput.outputFiles[0].text);
 try{
  await pause();d.body.style.overflow='auto';const order=d.querySelector('[aria-label="切换词汇顺序"]'),layout=d.querySelector('[aria-label="切换卡片布局"]');
  order.click();await pause();let popup=d.querySelector('.choice-dropdown');assert.ok(popup);assert.equal(d.querySelector('.choice-backdrop'),null);assert.equal(d.querySelector('[aria-modal]'),null);assert.equal(d.body.style.overflow,'auto');assert.equal(order.getAttribute('aria-haspopup'),'listbox');assert.equal(popup.style.top,'207px');assert.ok(parseFloat(popup.style.left)+parseFloat(popup.style.width)<=308);
  order.click();await pause();assert.equal(d.querySelector('.choice-dropdown'),null);
  order.click();await pause();layout.click();await pause();assert.equal(d.querySelectorAll('.choice-dropdown').length,1);assert.equal(order.getAttribute('aria-expanded'),'false');assert.equal(layout.getAttribute('aria-expanded'),'true');popup=d.querySelector('.choice-dropdown');assert.ok(parseFloat(popup.style.left)+parseFloat(popup.style.width)<=308);
  [...popup.querySelectorAll('[role=option]')].find(b=>b.textContent.includes('翻译在左')).click();await pause();assert.equal(d.querySelector('.choice-dropdown'),null);assert.match(layout.textContent,/翻译在左/);assert.equal(d.activeElement,layout);
  order.click();await pause();d.querySelector('#outside').dispatchEvent(new w.Event('pointerdown',{bubbles:true}));await pause();assert.equal(d.querySelector('.choice-dropdown'),null);
  order.click();await pause();w.innerWidth=390;w.dispatchEvent(new w.Event('resize'));await pause();assert.equal(d.querySelector('.choice-dropdown').style.left,'20px');
 }finally{w.close();}
});

test('dropdown keyboard selection, Escape and Tab do not trap focus',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test/',runScripts:'dangerously',pretendToBeVisual:true}),w=dom.window,d=w.document;w.eval(dropdownOutput.outputFiles[0].text);
 try{
  await pause();const order=d.querySelector('[aria-label="切换词汇顺序"]');order.focus();order.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));await pause();assert.equal(d.activeElement.getAttribute('aria-selected'),'true');
  d.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));assert.match(d.activeElement.textContent,/混乱/);d.activeElement.click();await pause();assert.match(order.textContent,/混乱/);assert.equal(d.activeElement,order);
  order.click();await pause();d.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await pause();assert.equal(d.querySelector('.choice-dropdown'),null);assert.equal(d.activeElement,order);
  order.click();await pause();const tab=new w.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true});d.activeElement.dispatchEvent(tab);await pause();assert.equal(tab.defaultPrevented,false);assert.equal(d.querySelector('.choice-dropdown'),null);assert.equal(d.activeElement,order);
 }finally{w.close();}
});
