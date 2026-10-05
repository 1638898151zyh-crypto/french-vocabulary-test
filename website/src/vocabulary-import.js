export const MAX_IMPORT_BYTES = 8 * 1024 * 1024;
export const MAX_ENTRIES = 10000;
export const IMPORT_LIBRARY_KEY = 'atelier:design-imports:v1';

export const VOCABULARY_FIELDS = [
  {key:'id',label:'词条唯一ID',required:true,aliases:['id','词条ID','唯一ID'],description:'同一词条保持同一 ID，例如 U01P01-G01-E01。'},
  {key:'unite',label:'Unité',required:true,aliases:['unit','单元','单元编号'],description:'正整数；按教材单元编号填写。'},
  {key:'partie',label:'Partie',required:true,aliases:['part','部分','部分编号'],description:'正整数；没有分 Part 的教材，每单元填写 1。'},
  {key:'partie_title',label:'原书主题 / Partie',aliases:['partie_title','part_title','部分标题'],description:'这一 Part 的原书标题。'},
  {key:'book_page',label:'教材页码',aliases:['book_page','page','原书页码'],description:'教材印刷页码；不要用 PDF 页序代替。'},
  {key:'group_no',label:'原书小类序',aliases:['group_no','主题序号'],description:'主题在这个 Part 中的原书顺序。'},
  {key:'group',label:'原书小类名称',required:true,aliases:['group','theme','主题','主题名称'],description:'每个词所属的主题；同 Part 同名主题会合并。'},
  {key:'fr',label:'法语原词 / 短语',required:true,aliases:['fr','french','法语','法语词条'],description:'保留冠词、性别、重音和原书短语。'},
  {key:'zh',label:'中文释义',required:true,aliases:['zh','chinese','中文','中文翻译'],description:'结合教材主题给出中文释义。'},
  {key:'ipa',label:'IPA（辅助）',aliases:['ipa','音标','IPA辅助'],description:'可留空；未经核对的音标只标为草稿。'},
  {key:'ipa_status',label:'IPA 校核状态',aliases:['ipa_status','音标状态'],description:'例如“AI生成·待核对”“手动覆盖”“未提供”。'},
  {key:'source_type',label:'来源标记',aliases:['source_type','来源类型'],description:'例如 printed_bullet、expanded_visual_list。'},
  {key:'original',label:'原书源行 / 等价词原文',aliases:['original','原书原文','源行'],description:'完整保留原书源行，便于校核拆分或等价词。'},
  {key:'source_file',label:'来源文件',aliases:['source_file','PDF文件','文件来源'],description:'所依据的课本 PDF 文件名。'},
];
// Extra source columns are distinct from the 14-column blank template.
const extraFields = [
  {key:'partie_id',label:'Part 编号',aliases:['partie_id']},
  {key:'entry_in_group',label:'主题内词条顺序',aliases:['entry_in_group']},
  {key:'lemma_in_book',label:'课本词形',aliases:['lemma_in_book']},
  {key:'partie_title_zh',label:'Part 中文标题',aliases:['partie_title_zh','部分标题中文']},
  {key:'group_zh',label:'主题中文名称',aliases:['group_zh','主题中文']},
];
const importFields = [...VOCABULARY_FIELDS,...extraFields];
const requiredFields = VOCABULARY_FIELDS.filter(f=>f.required);
const normalHeader = value => String(value??'').normalize('NFKD').replace(/\p{M}/gu,'').replace(/[\s/()[\]（）_\-]/g,'').toLowerCase();
const fieldIndex = new Map(importFields.flatMap(f=>[f.key,f.label,...(f.aliases||[])].map(a=>[normalHeader(a),f.key])));
const text = value => typeof value==='string'?value.trim():value===null||value===undefined?'':String(value);
const partKey = e => `U${Number(e.unite)}P${Number(e.partie)}`;

export class VocabularyImportError extends Error {
  constructor(message,details=[]){super(message);this.name='VocabularyImportError';this.details=details;}
}

function headerAt(rows){
  for(let index=0;index<Math.min(rows.length,30);index++){
    const columns=new Map(),duplicates=[];
    rows[index].forEach((cell,col)=>{const key=fieldIndex.get(normalHeader(cell));if(key){if(columns.has(key))duplicates.push(key);columns.set(key,col);}});
    if(requiredFields.every(f=>columns.has(f.key)))return {index,columns,duplicates};
  }
  return null;
}

function ipaStatus(value,ipa){
  if(!ipa)return 'not_provided';
  const status=text(value);
  if(status==='manually_reviewed'||status==='手动覆盖'||status==='人工已核对')return 'manually_reviewed';
  if(['manually_transcribed_review_needed','manual_draft_review_needed'].includes(status))return status;
  return 'espeak_draft_review_needed';
}

export function validateEntries(records){
  if(!Array.isArray(records)||records.length===0)throw new VocabularyImportError('词库没有词条。请先填写模板，再导入。');
  if(records.length>MAX_ENTRIES)throw new VocabularyImportError(`单份词库最多支持 ${MAX_ENTRIES.toLocaleString()} 条词汇。请按课本拆分。`);
  const errors=[],ids=new Set(),entries=[],partTitles=new Map();
  for(const [i,record] of records.entries()){
    const location=record?._row||i+2;
    if(!record||typeof record!=='object'||Array.isArray(record)){errors.push(`第 ${location} 行不是有效词条。`);continue;}
    const entry={};
    for(const field of importFields)entry[field.key]=text(record[field.key]);
    for(const field of requiredFields)if(!entry[field.key])errors.push(`第 ${location} 行缺少“${field.label}”。`);
    if(entry.id&&ids.has(entry.id))errors.push(`第 ${location} 行的 ID“${entry.id}”重复。`);
    if(entry.id)ids.add(entry.id);
    if(['__proto__','constructor','prototype'].includes(entry.id))errors.push(`第 ${location} 行的 ID 无效，请使用稳定的词条编号。`);
    for(const key of ['unite','partie']){
      const n=Number(entry[key]);
      if(!Number.isSafeInteger(n)||n<1||n>1000)errors.push(`第 ${location} 行的“${key==='unite'?'Unité':'Partie'}”必须是 1–1000 的整数。`);
      entry[key]=String(n);
    }
    if(typeof record.fr!=='string'||typeof record.zh!=='string')errors.push(`第 ${location} 行的法语与中文必须是文本。`);
    if(Object.values(entry).some(v=>v.length>2000))errors.push(`第 ${location} 行含超过 2000 字符的单元格，请缩短说明。`);
    const expectedPart=`U${entry.unite.padStart(2,'0')}P${entry.partie.padStart(2,'0')}`;
    if(entry.partie_id&&entry.partie_id!==expectedPart)errors.push(`第 ${location} 行的 Part 编号与 Unité / Partie 不一致。`);
    entry.partie_id=entry.partie_id||expectedPart;
    for(const key of ['group_no','entry_in_group'])if(entry[key]&&(!Number.isSafeInteger(Number(entry[key]))||Number(entry[key])<1||Number(entry[key])>MAX_ENTRIES))errors.push(`第 ${location} 行的 ${key} 必须是正整数。`);
    entry.ipa_status=ipaStatus(entry.ipa_status,entry.ipa);
    entry.ipa_status_original=text(record.ipa_status_original||record.ipa_status)||'未提供校核状态';
    entry.original=entry.original||entry.lemma_in_book||entry.fr;
    entry.lemma_in_book=entry.lemma_in_book||entry.original;
    entry.partie_title_zh=text(record.partie_title_zh);
    entry.group_zh=text(record.group_zh);
    const p=partKey(entry);
    if(entry.partie_title){
      if(partTitles.has(p)&&partTitles.get(p)!==entry.partie_title)errors.push(`第 ${location} 行的 ${p} 标题与同一 Part 的其他词条不一致。`);
      partTitles.set(p,entry.partie_title);
    }
    entries.push(entry);
  }
  if(errors.length)throw new VocabularyImportError(`词库有 ${errors.length} 处问题，尚未导入；已有记录保持不变。`,errors.slice(0,12));
  // Use explicit numeric source order when it is complete; preserve IDs and all records.
  if(entries.every(e=>e.group_no&&e.entry_in_group))entries.sort((a,b)=>Number(a.unite)-Number(b.unite)||Number(a.partie)-Number(b.partie)||Number(a.group_no)-Number(b.group_no)||Number(a.entry_in_group)-Number(b.entry_in_group));
  return entries;
}

export function vocabularySummary(entries){
  return {
    words:entries.length,
    units:new Set(entries.map(e=>e.unite)).size,
    parts:new Set(entries.map(partKey)).size,
    themes:new Set(entries.map(e=>partKey(e)+'::'+e.group)).size,
    missingIPA:entries.filter(e=>!e.ipa).length,
    unreviewedIPA:entries.filter(e=>e.ipa&&e.ipa_status!=='manually_reviewed').length,
    missingSource:entries.filter(e=>!e.book_page||!e.source_file).length,
  };
}

export function inferBook(filename,metadata={}){
  const raw=filename.replace(/\.(xlsx|csv|json)$/i,'').replace(/[_]+/g,' ').replace(/标准词库|完整词库|词汇表|词库|vocabulary[-_ ]?bank/gi,' ').replace(/\s+/g,' ').trim();
  const year=raw.match(/\b(20\d{2})\b/)?.[1];
  const level=raw.match(/\b([ABC][12])\b/i)?.[1]?.toUpperCase();
  return {
    name:text(metadata.name)||raw.replace(/\b20\d{2}\b/g,'').trim()||'导入课本',
    level:text(metadata.level)||level||'自由',
    edition:text(metadata.edition)||text(metadata.year)||(year?year+' 版':'未填写版本'),
  };
}

function createResult(records,filename,metadata={},sourceSheet='',missingColumns=[]){
  const entries=validateEntries(records),summary=vocabularySummary(entries),warnings=[];
  if(missingColumns.length)warnings.push(`缺少推荐列：${missingColumns.join('、')}。核心检测仍可使用。`);
  if(summary.missingIPA)warnings.push(`${summary.missingIPA} 条没有音标，检测时将不显示音标。`);
  if(summary.unreviewedIPA)warnings.push(`${summary.unreviewedIPA} 条音标标为待核对；格式通过不表示语音已审定。`);
  if(summary.missingSource)warnings.push(`${summary.missingSource} 条缺少教材页码或来源文件，建议补齐后核对原书。`);
  return {entries,summary,warnings,book:inferBook(filename,metadata),sourceSheet,filename};
}

export function parseWorkbookSheets(sheets,filename){
  const candidates=sheets.map(s=>({...s,header:headerAt(s.data||[])})).filter(s=>s.header);
  if(!candidates.length)throw new VocabularyImportError('没有找到词库表头。请在“完整词库”表提供 ID、Unité、Partie、主题、法语和中文这 6 个核心列。');
  const preferred=candidates.filter(s=>text(s.sheet)==='完整词库');
  if(!preferred.length&&candidates.length>1)throw new VocabularyImportError('发现多个词库工作表。请将全量词条汇总到一张名为“完整词库”的表，再导入。');
  const selected=preferred[0]||candidates[0];
  if(selected.header.duplicates.length)throw new VocabularyImportError('表头中有重复的字段，请保留每个字段的一列。',selected.header.duplicates.map(k=>importFields.find(f=>f.key===k).label));
  const records=[];
  selected.data.slice(selected.header.index+1).forEach((row,index)=>{
    if(row.every(c=>c===null||c===undefined||text(c)===''))return;
    const record={_row:selected.header.index+index+2};
    for(const [key,col] of selected.header.columns)record[key]=row[col];
    records.push(record);
  });
  const missing=VOCABULARY_FIELDS.filter(f=>!f.required&&!selected.header.columns.has(f.key)).map(f=>f.label);
  return createResult(records,filename,{},selected.sheet,missing);
}

export function parseCSV(csv,delimiter=','){
  const rows=[];let row=[],cell='',quoted=false,closed=false;
  const source=csv.replace(/^\uFEFF/,'');
  for(let i=0;i<source.length;i++){
    const c=source[i];
    if(quoted){if(c==='"'){if(source[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;}
    else if(c==='"'){if(cell||closed)throw new VocabularyImportError('CSV 引号格式无效。请让 AI 重新导出标准 UTF-8 CSV。');quoted=true;}
    else if(c===delimiter){row.push(cell);cell='';closed=false;}
    else if(c==='\r'||c==='\n'){if(c==='\r'&&source[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';closed=false;}
    else if(closed&&!/\s/.test(c))throw new VocabularyImportError('CSV 引号结束后存在多余字符，请检查逗号与引号。');
    else if(!closed)cell+=c;
    if(cell.length>4000||rows.length>MAX_ENTRIES+35)throw new VocabularyImportError('CSV 超过支持的行数或单元格长度。');
  }
  if(quoted)throw new VocabularyImportError('CSV 有未闭合的引号，请重新导出完整文件。');
  if(cell||row.length){row.push(cell);rows.push(row);}
  return rows;
}

export function parseCSVText(content,filename){
  let rows;
  for(const separator of [',',';','\t']){
    try{const candidate=parseCSV(content,separator);if(headerAt(candidate)){rows=candidate;break;}}catch(error){if(separator===',')rows=null;}
  }
  if(!rows)throw new VocabularyImportError('未找到 CSV 的词库表头。请使用模板中的列名，并导出 UTF-8 CSV。');
  return parseWorkbookSheets([{sheet:'CSV 词库',data:rows}],filename);
}

export function parseJSONText(content,filename){
  let data;
  try{data=JSON.parse(content.replace(/^\uFEFF/,''));}catch{throw new VocabularyImportError('JSON 文件格式无效，请导入完整的 JSON 文件。');}
  if(!data||typeof data!=='object')throw new VocabularyImportError('JSON 应为词条数组，或 {book, entries}。');
  const metadata=Array.isArray(data)?{}:data.book||data.metadata||{};
  const rawEntries=Array.isArray(data)?data:data.entries;
  if(!Array.isArray(rawEntries))throw new VocabularyImportError('JSON 应为词条数组，或 {book, entries}。学习进度备份不是词库文件。');
  const entries=rawEntries.map((raw,index)=>{
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return raw;
    const mapped={_row:index+1};
    for(const [key,value] of Object.entries(raw)){const field=fieldIndex.get(normalHeader(key));if(field)mapped[field]=value;}
    for(const key of ['partie_title_zh','group_zh','ipa_status_original'])if(raw[key])mapped[key]=raw[key];
    return mapped;
  });
  return createResult(entries,filename,metadata,'JSON 词库');
}

export async function readVocabularyFile(file){
  if(!file||!file.size)throw new VocabularyImportError('请选择有内容的词库文件。');
  if(file.size>MAX_IMPORT_BYTES)throw new VocabularyImportError('词库文件超过 8 MB。请按课本拆分，或导出较小的 CSV。');
  const extension=file.name.split('.').at(-1).toLowerCase();
  if(extension==='xlsx'){
    try{
      const {default:readExcel}=await import('read-excel-file/browser');
      const sheets=await readExcel(file);
      return parseWorkbookSheets(sheets,file.name);
    }catch(error){if(error instanceof VocabularyImportError)throw error;throw new VocabularyImportError('无法读取 Excel。请使用未加密的 .xlsx 文件；改扩展名不能把 PDF 或旧版 .xls 变成词库。');}
  }
  if(extension==='csv')return parseCSVText(await file.text(),file.name);
  if(extension==='json')return parseJSONText(await file.text(),file.name);
  throw new VocabularyImportError('支持 .xlsx、UTF-8 .csv 和 .json。请先把课本 PDF 交给 AI 生成词库，再导入。');
}

export function sameVocabulary(first,second){
  if(first.length!==second.length)return false;
  const fields=['id','unite','partie','partie_title','group','fr','zh','ipa'];
  const sig=entries=>JSON.stringify(entries.map(e=>fields.map(k=>text(e[k]))));
  return sig(first)===sig(second);
}

export function makeImportedBook(result,metadata,id=crypto.randomUUID()){
  const labels={};
  for(const e of result.entries){const p=partKey(e);labels[p]||={fr:e.partie_title||p,zh:e.partie_title_zh||''};}
  return {
    id,name:metadata.name.trim(),series:metadata.name.trim(),level:metadata.level,edition:metadata.edition.trim()||'未填写版本',
    color:metadata.level==='A2'?'mint':metadata.level==='B2'?'peach':metadata.level==='B1'?'blue':'sand',
    status:'ready',bank:result.entries,titles:labels,imported:true,
    subtitle:`已导入 ${result.summary.words.toLocaleString()} 词，按原书主题检测。`,sourceFilename:result.filename,
  };
}

export function loadImportedLibrary(storage){
  try{
    const raw=storage.getItem(IMPORT_LIBRARY_KEY);
    if(!raw)return {books:[],error:null};
    const data=JSON.parse(raw);
    if(data.version!==1||!Array.isArray(data.books)||data.books.length>30)throw Error('invalid library');
    const seen=new Set();
    const books=data.books.map(b=>{
      if(!b?.imported||typeof b.id!=='string'||!b.id||['edito-b1','inspire-a1','edito-a2-2022','my-notebook'].includes(b.id)||seen.has(b.id)||!text(b.name)||b.name.length>48||!['A1','A2','B1','B2','C1','C2','自由'].includes(b.level))throw Error('invalid book');
      seen.add(b.id);
      const entries=validateEntries(b.bank);
      const restored=makeImportedBook({entries,summary:vocabularySummary(entries),filename:text(b.sourceFilename)},b,b.id);
      restored.remember=true;
      return restored;
    });
    return {books,error:null};
  }catch{return {books:[],error:'本机导入词库暂时无法读取，原缓存已保留。可重新选择词库文件并取消“记住词库”，仅在本次预览使用。'};}
}

export function saveImportedLibrary(storage,books){
  const saved=books.filter(b=>b.imported&&b.remember);
  if(saved.length>30)throw new VocabularyImportError('本机最多保存 30 本导入课本，请取消“记住词库”后临时使用。');
  try{storage.setItem(IMPORT_LIBRARY_KEY,JSON.stringify({version:1,books:saved}));}
  catch{throw new VocabularyImportError('浏览器暂时无法保存这份词库。请取消“记住词库”，仅在本次预览使用；已有词库未修改。');}
}

export function blankCSVTemplate(){return '\uFEFF'+VOCABULARY_FIELDS.map(f=>`"${f.label.replace(/"/g,'""')}"`).join(',')+'\r\n';}
