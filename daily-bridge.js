import {App} from '@modelcontextprotocol/ext-apps/app-with-deps';
const app=new App({name:'每日单词检测',version:'0.1.10'},{availableDisplayModes:['inline','fullscreen']});
app.ontoolresult=result=>{const id=result.structuredContent?.launchId;if(id)globalThis.DailyUI?.start(id);};
app.onerror=()=>globalThis.DailyUI?.notice('宿主连接中断；本地副进度仍保留。');
app.connect().catch(()=>globalThis.DailyUI?.notice('宿主连接未就绪；可重新打开卡片。'));
