import {App} from '@modelcontextprotocol/ext-apps/app-with-deps';

const app = new App({name:'法语词汇检测',version:'0.1.5'}, {availableDisplayModes:['inline','fullscreen']});
let receive, reject, connected = false, latest, connection;
const bridge = {
  start(onState,onError) {
    receive = onState; reject = onError;
    if(latest) receive(latest);
    connection=app.connect().then(()=>{connected=true;});
    connection.catch(()=>reject('连接未就绪，请重新打开插件界面。'));
  },
  async refresh() {
    await connection;
    const result=await app.callServerTool({name:'open_vocabulary_test',arguments:{}});
    const snapshot=result._meta?.snapshot || result.structuredContent?.snapshot;
    if(result.isError || !snapshot)throw new Error('记录恢复失败。');return snapshot;
  },
  async action(action,args={}) {
    await connection;
    const result=await app.callServerTool({name:'vocabulary_action',arguments:{action,...args}});
    if(result.isError) { const error=new Error(result.content?.find(item=>item.type==='text')?.text || '记录未保存，请重试。');error.definitive=true;throw error; }
    const snapshot=result._meta?.snapshot || result.structuredContent?.snapshot;
    if(!snapshot) throw new Error('测试连接未返回词汇记录。');
    latest=snapshot;
    return snapshot;
  }
};
app.ontoolresult = result => {
  const snapshot=result._meta?.snapshot || result.structuredContent?.snapshot;
  if(snapshot){latest=snapshot;receive?.(snapshot);}
  else if(result.isError) reject?.('测试记录加载失败，请重新打开。');
};
app.onerror=error=>reject?.('测试连接暂时中断，请重试。');
globalThis.VocabHost=bridge;
