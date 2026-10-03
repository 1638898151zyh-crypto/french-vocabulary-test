const RESOURCE='__QUIZ_RESOURCE_URI__';
const TEXTBOOK_RESOURCE='__TEXTBOOK_RESOURCE_URI__';
const COMPATIBLE_RESOURCE=/^ui:\/\/french-vocabulary-test\/quiz(?:-[a-f0-9]{16})?\.html$/;
const TEXTBOOK_COMPATIBLE_RESOURCE=/^ui:\/\/french-vocabulary-test\/textbook-[a-f0-9]{16}\.html$/;
const DAILY_RESOURCE='__DAILY_RESOURCE_URI__';
const DAILY_COMPATIBLE_RESOURCE=/^ui:\/\/french-vocabulary-test\/daily-[a-f0-9]{16}\.html$/;
const MIME='text/html;profile=mcp-app';
const resourceMeta={
  ui:{prefersBorder:true,csp:{connectDomains:[],resourceDomains:[]}},
  'openai/ui':{preferredDisplayMode:'inline',availableDisplayModes:['inline','fullscreen']}
};
const actionSchema={type:'object',properties:{action:{type:'string',enum:['toggle','vote','group','repeat','next']},roundId:{type:'string'},id:{type:'string'},kind:{type:'string',enum:['good','bad']},group:{type:'integer',minimum:0,maximum:4},requestId:{type:'string'}},required:['action','roundId','requestId'],additionalProperties:false};
const tools=[
  {name:'open_vocabulary_test',title:'法语词汇检测',description:'打开法语词汇检测，恢复第一单元 P1 和 P2 的本轮记录；每组十词，共五组。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,openWorldHint:false,destructiveHint:false},_meta:{ui:{resourceUri:RESOURCE},'openai/outputTemplate':RESOURCE}},
  {name:'open_textbook_vocabulary_test',title:'课本单词检测',description:'打开 Édito B1 课本检测交互卡片，按主题分组检测当前 Part 全部词条，每组为一个完整主题，组数与词数不设上限，沿24个Part推进。主进度由界面恢复当前客户端记录；可导入导出，不是云端主进度。无记录时从U1 P1开始。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,openWorldHint:false,destructiveHint:false},_meta:{ui:{resourceUri:TEXTBOOK_RESOURCE},'openai/outputTemplate':TEXTBOOK_RESOURCE}},
  {name:'open_daily_vocabulary_test',title:'每日单词检测',description:'打开每日复习交互卡片；读取客户端课本已过关主进度，副进度不得超出主进度。最近Part抽两组、倒数第二和第三Part各一组、其余已过关Part随机一个抽一组；五组十词，每组来自一个词库主题，每次打开重新抽词。至少需4个已过关Part；主题不足10词不跨主题补词。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,openWorldHint:false,destructiveHint:false},_meta:{ui:{resourceUri:DAILY_RESOURCE},'openai/outputTemplate':DAILY_RESOURCE}},
  {name:'vocabulary_action',title:'记录词汇检测',description:'界面使用：翻开、收起、自评、改选、换组或开启新一轮；每轮每词只计一个结果，改选会替换原结果。',inputSchema:actionSchema,annotations:{readOnlyHint:false,openWorldHint:false,destructiveHint:false,idempotentHint:true},_meta:{ui:{visibility:['app']}}},
  {name:'get_vocabulary_progress',title:'词汇检测进度',description:'读取本轮进度和历史累计，不能代替用户自评。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,openWorldHint:false,destructiveHint:false}}
];
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}
function rpcError(id,code,message,status=200){return json({jsonrpc:'2.0',id,error:{code,message}},status);}
function newState(stats={},round=1,cycle=0){return {...VocabCore.create(BANK,cycle,stats,round),roundId:crypto.randomUUID(),recentRequests:[]};}
async function readState(db,userId){
  let row=await db.prepare('SELECT revision, state_json FROM vocabulary_state WHERE user_id = ?').bind(userId).first();
  if(!row){
    const initial=newState();
    await db.prepare('INSERT OR IGNORE INTO vocabulary_state (user_id, revision, state_json, updated_at) VALUES (?, ?, ?, ?)').bind(userId,0,JSON.stringify(initial),Date.now()).run();
    row=await db.prepare('SELECT revision, state_json FROM vocabulary_state WHERE user_id = ?').bind(userId).first();
  }
  if(!row) throw new Error('记录加载失败。');
  const stored=JSON.parse(row.state_json),valid=VocabCore.restore(stored,BANK);
  if(!valid || typeof stored.roundId!=='string') throw new Error('保存记录格式异常，请联系创建者。');
  return {revision:row.revision,state:{...valid,roundId:stored.roundId,recentRequests:Array.isArray(stored.recentRequests)?stored.recentRequests.slice(-200):[]}};
}
function snapshot(state,revision){return {state,revision};}
function resultFor(state,revision,message='已恢复词汇检测。'){
  return {content:[{type:'text',text:message}],structuredContent:{round:state.round,groups:5,words:50,progress:VocabCore.totals(state)},_meta:{snapshot:snapshot(state,revision)}};
}
async function applyAction(db,userId,args){
  if(!args || !['toggle','vote','group','repeat','next'].includes(args.action) || typeof args.roundId!=='string' || typeof args.requestId!=='string' || args.requestId.length<1 || args.requestId.length>128) throw new Error('检测操作参数无效。');
  for(let attempt=0;attempt<4;attempt++){
    const current=await readState(db,userId);
    let {state,revision}=current;
    if(state.recentRequests.includes(args.requestId))return resultFor(state,revision,'此操作已经记录。');
    if(state.roundId!==args.roundId)throw new Error('本轮已更换，请重新打开检测界面后继续。');
    if(args.action==='toggle'){
      if(typeof args.id!=='string' || !VocabCore.toggle(state,args.id))throw new Error('词汇不在本轮。');
    }else if(args.action==='vote'){
      if(typeof args.id!=='string' || !VocabCore.vote(state,args.id,args.kind))return resultFor(state,revision,'此选项已选择，或答案尚未翻开。');
    }else if(args.action==='group'){
      if(!Number.isInteger(args.group) || args.group<0 || args.group>4)throw new Error('分组参数无效。');
      state.group=args.group;
    }else{
      const recent=state.recentRequests;
      state={...VocabCore.restart(state,BANK,args.action==='next'),roundId:crypto.randomUUID(),recentRequests:recent};
    }
    state.recentRequests=[...state.recentRequests,args.requestId].slice(-200);
    const write=await db.prepare('UPDATE vocabulary_state SET state_json = ?, revision = revision + 1, updated_at = ? WHERE user_id = ? AND revision = ?').bind(JSON.stringify(state),Date.now(),userId,revision).run();
    if(write.meta?.changes===1)return resultFor(state,revision+1,'已保存。');
  }
  throw new Error('记录正在更新，请重试。');
}
async function callTool(name,args,env,userId){
  if(!userId)return {content:[{type:'text',text:'请先连接词汇检测插件。'}],isError:true};
  if(name==='open_textbook_vocabulary_test')return {content:[{type:'text',text:'已打开课本单词检测。请在卡片中恢复当前客户端主进度，或导入此前导出的记录。'}],structuredContent:{mode:'textbook',level:'B1',parts:24,bankWords:1110,progressStorage:'client-local'},_meta:{'openai/widgetDescription':'Édito B1 当前 Part 全量词汇自测；点击词条翻开中文和音标，自评可改选。主进度保存在当前客户端。'}};
  if(name==='open_daily_vocabulary_test')return {content:[{type:'text',text:'已打开每日单词检测。卡片将按本客户端课本主进度抽取5组各10词，每组只取一个主题；可导入课本主进度。请在卡片中自评。'}],structuredContent:{mode:'daily',launchId:crypto.randomUUID(),groups:5,words:50,minimumMasteredParts:4,progressStorage:'client-local'},_meta:{'openai/widgetDescription':'每日单词检测，读取本客户端课本已过关范围，独立副进度、翻词、自评与改选，不推进主进度。'}};
  if(!env.DB)return {content:[{type:'text',text:'云端记录暂不可用。'}],isError:true};
  try{
    if(name==='vocabulary_action')return await applyAction(env.DB,userId,args);
    if(name==='open_vocabulary_test'){
      const {state,revision}=await readState(env.DB,userId);return resultFor(state,revision);
    }
    if(name==='get_vocabulary_progress'){
      const {state}=await readState(env.DB,userId);return {content:[{type:'text',text:`第 ${state.round} 轮已判 ${VocabCore.totals(state).done}/50。`}],structuredContent:{round:state.round,progress:VocabCore.totals(state),counts:state.stats}};
    }
    return {content:[{type:'text',text:'未知检测工具。'}],isError:true};
  }catch(error){console.error('vocabulary-operation-failed',error.message);return {content:[{type:'text',text:error.message}],isError:true};}
}
export default {
  async fetch(request,env){
    const url=new URL(request.url),userId=request.headers.get('oai-authenticated-user-id');
    if(url.pathname==='/')return new Response(LANDING_HTML,{headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store'}});
    if(url.pathname!=='/mcp')return new Response('Not found',{status:404});
    if(request.method==='GET')return new Response('Method not allowed',{status:405,headers:{Allow:'POST'}});
    if(request.method==='DELETE')return new Response(null,{status:204});
    if(request.method!=='POST')return new Response('Method not allowed',{status:405});
    let message;try{message=await request.json();}catch{return rpcError(null,-32700,'Parse error',400);}
    if(!message || typeof message!=='object' || Array.isArray(message) || message.jsonrpc!=='2.0' || typeof message.method!=='string')return rpcError(message?.id??null,-32600,'Invalid request',400);
    if(message.id===undefined)return new Response(null,{status:202});
    const id=message.id,params=message.params||{};
    if(message.method==='initialize')return json({jsonrpc:'2.0',id,result:{protocolVersion:['2025-11-25','2025-06-18','2025-03-26'].includes(params.protocolVersion)?params.protocolVersion:'2025-11-25',capabilities:{tools:{},resources:{}},serverInfo:{name:'法语词汇检测',version:'0.1.11'},instructions:'检测法语到中文。普通U1混合检测调用 open_vocabulary_test；课本单Part检测调用 open_textbook_vocabulary_test；每日复习调用 open_daily_vocabulary_test。让用户自行翻开和评分，不把客户端主进度说成已读取的云端记录。'}});
    if(message.method==='ping')return json({jsonrpc:'2.0',id,result:{}});
    if(message.method==='tools/list')return json({jsonrpc:'2.0',id,result:{tools}});
    if(message.method==='resources/list')return json({jsonrpc:'2.0',id,result:{resources:[{uri:RESOURCE,name:'法语词汇检测',mimeType:MIME,_meta:resourceMeta},{uri:TEXTBOOK_RESOURCE,name:'课本单词检测',mimeType:MIME,_meta:resourceMeta},{uri:DAILY_RESOURCE,name:'每日单词检测',mimeType:MIME,_meta:resourceMeta}]}});
    if(message.method==='resources/templates/list')return json({jsonrpc:'2.0',id,result:{resourceTemplates:[]}});
    if(message.method==='resources/read'){
      if(typeof params.uri!=='string' || !(COMPATIBLE_RESOURCE.test(params.uri)||TEXTBOOK_COMPATIBLE_RESOURCE.test(params.uri)||DAILY_COMPATIBLE_RESOURCE.test(params.uri)))return rpcError(id,-32602,'Unknown resource');
      if(!userId)return rpcError(id,-32001,'Authentication required',401);
      return json({jsonrpc:'2.0',id,result:{contents:[{uri:params.uri,mimeType:MIME,text:DAILY_COMPATIBLE_RESOURCE.test(params.uri)?DAILY_HTML:TEXTBOOK_COMPATIBLE_RESOURCE.test(params.uri)?TEXTBOOK_HTML:QUIZ_HTML,_meta:resourceMeta}]}});
    }
    if(message.method==='tools/call'){
      if(!userId)return rpcError(id,-32001,'Authentication required',401);
      return json({jsonrpc:'2.0',id,result:await callTool(params.name,params.arguments||{},env,userId)});
    }
    return rpcError(id,-32601,'Method not found');
  }
};
