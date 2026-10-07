import inspireBank from '../../assets/inspire-a1-bank.json' with {type:'json'};
import inspireTitles from '../../assets/inspire-a1-titles.json' with {type:'json'};
import editoA2Bank from '../../assets/edito-a2-2022-bank.json' with {type:'json'};
import editoA2Titles from '../../assets/edito-a2-2022-titles.json' with {type:'json'};
import editoA1Bank from '../../assets/edito-a1-2022-bank.json' with {type:'json'};
import editoA1Titles from '../../assets/edito-a1-2022-titles.json' with {type:'json'};
import {makeImportedBook,vocabularySummary} from './vocabulary-import.js';

const translatedBank=inspireBank.map(entry=>({
  ...entry,
  partie_title_zh:inspireTitles.parts[`U${entry.unite}P${entry.partie}`],
  group_zh:inspireTitles.themes[entry.group],
}));

export const inspireBook = {
  ...makeImportedBook(
    {entries:translatedBank,summary:vocabularySummary(translatedBank),filename:'Inspire_A1_标准词库.csv'},
    {name:'Inspire A1',level:'A1',edition:'版本未标注'},
    'inspire-a1',
  ),
  series:'Inspire',
  supplied:true,
  remember:false,
  subtitle:'课本核心词汇与实用表达，共 937 条；按 8 个单元学习。',
  notice:'P1–P3 为语言课，P4 为课堂交流、技巧及总结表达；这是整理词库的学习切分。全部音标为人工转写、待独立复核。',
};

const translatedA2Bank=editoA2Bank.map(entry=>{
  const part=`U${entry.unite}P${entry.partie}`;
  return {...entry,partie_title_zh:editoA2Titles.parts[part],group_zh:editoA2Titles.themesByPart[`${part}::${entry.group}`]||editoA2Titles.themes[entry.group]};
});

export const editoA2Book = {
  ...makeImportedBook(
    {entries:translatedA2Bank,summary:vocabularySummary(translatedA2Bank),filename:'Édito_A2_2022_标准词库.csv'},
    {name:'Édito A2',level:'A2',edition:'2022 · 第 2 版'},
    'edito-a2-2022',
  ),
  series:'Édito',
  supplied:true,
  remember:false,
  subtitle:'2022 年第 2 版，850 条专题词汇；Part 与主题均含中文标题。',
  notice:'覆盖 24 个专题词汇 Part。848 条音标仍待校核；另外 2 条保留文件原有的已校对标记，不代表本次重新核验。',
};

const translatedA1Bank=editoA1Bank.map(entry=>{
  const part=`U${entry.unite}P${entry.partie}`;
  return {...entry,partie_title_zh:editoA1Titles.parts[part],group_zh:editoA1Titles.themesByPart[`${part}::${entry.group}`]||editoA1Titles.themes[entry.group]};
});

export const editoA1Book = {
  ...makeImportedBook(
    {entries:translatedA1Bank,summary:vocabularySummary(translatedA1Bank),filename:'Édito_A1_2022_标准词库.csv'},
    {name:'Édito A1',level:'A1',edition:'2022 · 第 2 版'},
    'edito-a1-2022',
  ),
  series:'Édito',
  supplied:true,
  remember:false,
  subtitle:'2022 年第 2 版，566 条专题词汇；Part 与主题均含中文标题。',
  notice:'覆盖 10 个单元、20 个专题词汇 Part、80 个主题组。组合词条保留原书编排，不按词形去重；全部 566 条音标仍待校对。',
};
