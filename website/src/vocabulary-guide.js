import {VOCABULARY_FIELDS} from './vocabulary-import.js';
import {saveNativeText} from './native-app.js';

export const AI_VOCABULARY_PROMPT = `请根据我上传的法语课本 PDF，制作可导入“法语词汇学习网站”的完整词库。
课本名称：[填写]；级别：[A1/A2/B1/B2/C1/C2]；版本：[填写]。
范围：[全书词汇栏目 / 指定单元与印刷页码]。请先确认你能读取哪些页，并列出单元—Part—主题目录；不要立即猜测全书词数。

1. 严格按原书单元、Part、主题和词条顺序提取。优先提取词汇栏目及其明确列举的词和短语，不把所有课文句子当成词条；没有 Part 时每单元设 Partie=1。主题缺失时使用“本单元词汇”，说明这是整理标签。扫描页先进行 OCR，再对照页面图像检查重音、连字符与省音符号。
2. 保留法语冠词、性别、重音、介词、反身形式及完整短语。不要把原书并列词或括号说明随意删除。确需拆分时，每项分配独立 ID，并保留完整原书源行；不要全书去重，同一词在不同主题可分别保留。
3. 中文释义结合本主题和原书语境，明确它是辅助翻译。IPA 可留空；AI 生成音标一律标“AI生成·待核对”，没有音标标“未提供”。只有逐条由人核对后才标“人工已核对”。无法辨认的原文记录到“说明与校核”，不要编造填充。
4. 每行一个词条，ID 使用 U01P01-G01-E01，按单元、Part、主题、词条顺序生成；全书唯一，之后修订时保持 ID 稳定。Unité、Partie、原书小类序为正整数。同一 Part 标题一致，同主题名称一致。页码填写教材印刷页码；未知留空并说明，不用 PDF 页序冒充。
5. 建立“完整词库”工作表，按以下 14 列输出，列名完全一致：
${VOCABULARY_FIELDS.map(f=>f.label).join(' | ')}
来源标记可用 printed_bullet（原书列项）、expanded_visual_list（图示列项拆分）、printed_brace_annotation（括号或花括号注明的词项），其他类型如实说明。来源文件填写上传 PDF 的实际文件名。“原书源行 / 等价词原文”保留原文证据。
6. 输出未加密 .xlsx 文件，另附“总览”和“说明与校核”工作表：汇总每个单元、Part、主题词数、缺失来源、待核音标、OCR 不清之处及拆分处理。不要在“完整词库”的数据行中插入小计、合并单元格或解释文字。网站只读取词条，不导入抽题规则或学习进度。
7. 如果无法生成 Excel 文件，输出完整 UTF-8 CSV（逗号分隔，逗号/换行/双引号字段正确加引号并转义）。不要用 Markdown 表格代替文件。可按单元分批生成，但最终合并成一份全量词库，不能用省略号或“其余同上”代替词条。
8. 每批交付前核对原书覆盖范围、唯一 ID、必填项、章节顺序、词数和来源。最后报告“已完成范围 / 未完成范围 / 待人工校核项”；有缺页就明确标为部分词库，不宣称完成全书。`;

export const GUIDE_STEPS = [
  {title:'准备课本和标准',body:'把能清晰阅读的课本 PDF、课本名称与版本交给支持文件阅读的 AI。同时上传标准词库作为格式样例，或下载这里的空白 CSV 模板。先指定提取范围：全书词汇栏目，或某些单元。'},
  {title:'先确认目录，再分批提取',body:'粘贴下面的提示词，让 AI 先列出单元、Part 与主题。扫描版要检查 OCR；长课本按单元分批处理，保留稳定 ID，最后合并成一份完整文件。中断后明确从哪里继续。'},
  {title:'拿到可导入的文件',body:'优先让 AI 生成 .xlsx，并将全量词条放在“完整词库”表。不能生成 Excel 时选择 UTF-8 CSV。下载真实文件；把 .pdf、.txt 改成 .xlsx 不会转换格式。'},
  {title:'对照原书校核',body:'逐单元核对词汇栏覆盖范围、词数与章节顺序，抽查每个主题及 OCR 不清项。重点检查冠词、重音、短语、中文语境和拆分词。音标未人工核对就保持“待核对”；不确定的原文先补查，别让 AI 猜。'},
  {title:'回到网站，一键导入',body:'点击“一键导入词库”并选择文件，查看章节数、词数、字段检查和样例。核对课本名称、级别、版本，然后确认导入并开始检测。格式报错时按行号修复后重选；格式通过不等于内容已核实。'},
];

export function guideMarkdown(production=false){return `# 从课本 PDF 生成并导入法语词库\n\n${GUIDE_STEPS.map((s,i)=>`## ${i+1}. ${s.title}\n\n${s.body}`).join('\n\n')}\n\n## 文件与保存说明\n\n支持未加密 .xlsx、UTF-8 .csv、词条数组 .json；每文件最多 8 MB、10,000 词。6 个核心列必填，其余 8 列建议保留。${production?'导入文件在浏览器中解析。游客词库与记录保存在本机，登录后随账号同步到其他设备。清理浏览器数据会移除游客记录，请保留原文件并定期导出备份。':'导入在浏览器本机解析，不上传文件。记住词库仅保存到本浏览器，最多 30 本，不提供云同步，请保留原文件。当前设计预览的检测进度仅在本次页面内存中，刷新会重置。'}相同词库会打开已有课本，不覆盖进度。\n\n## 14 列标准\n\n${VOCABULARY_FIELDS.map(f=>`- ${f.label}${f.required?'（必填）':'（建议）'}：${f.description}`).join('\n')}\n\n## 可复制的 AI 提示词\n\n${AI_VOCABULARY_PROMPT}\n\n## 常见问题\n\nPDF 不能直接导入：先用 AI 生成词库文件。缺少核心列、重复 ID 或章节编号无效：按提示修复并重新选择。来源或 IPA 缺失不会阻止检测，但需要补查。标准样例的“每日抽题规则”不参与导入。\n`;}

export function downloadText(filename,content,type='text/plain;charset=utf-8'){
  if(saveNativeText(filename,content,type))return;
  const url=URL.createObjectURL(new Blob([content],{type}));
  const link=document.createElement('a');link.href=url;link.download=filename;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
