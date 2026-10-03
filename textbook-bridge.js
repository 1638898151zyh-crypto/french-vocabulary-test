import {App} from '@modelcontextprotocol/ext-apps/app-with-deps';
const app=new App({name:'课本单词检测',version:'1.0.8'},{availableDisplayModes:['inline','fullscreen']});
globalThis.TextbookHost={async send(prompt){
  const result=await app.sendMessage({role:'user',content:[{type:'text',text:prompt}]});
  if(result.isError)throw new Error('宿主未接受续接消息');
}};
app.ontoolresult=result=>globalThis.TextbookUI?.start(result);
app.onerror=()=>{const note=document.getElementById('toast');if(note)note.textContent='宿主连接暂时中断；本地记录仍保留。';};
app.connect().catch(()=>{const note=document.getElementById('toast');if(note)note.textContent='宿主连接未就绪；本地记录仍保留。';});
