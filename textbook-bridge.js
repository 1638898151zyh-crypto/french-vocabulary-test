import {App} from '@modelcontextprotocol/ext-apps/app-with-deps';
const app=new App({name:'课本单词检测',version:'0.1.6'},{availableDisplayModes:['inline','fullscreen']});
app.onerror=()=>{const note=document.getElementById('toast');if(note)note.textContent='宿主连接暂时中断；本地记录仍保留。';};
app.connect().catch(()=>{const note=document.getElementById('toast');if(note)note.textContent='宿主连接未就绪；本地记录仍保留。';});
