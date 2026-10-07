import bank from '../../assets/textbook-bank.json' with {type:'json'};
import {inspireBook,editoA2Book,editoA1Book} from './supplied-books.js';
const demoBank = [
  {id:'DEMO-P1-01',fr:'bonjour',zh:'你好',ipa:'/bɔ̃ʒuʁ/',unite:1,partie:1,group:'Les premiers mots',partie_title:'Les premiers mots'},
  {id:'DEMO-P1-02',fr:'merci',zh:'谢谢',ipa:'/mɛʁsi/',unite:1,partie:1,group:'Les premiers mots',partie_title:'Les premiers mots'},
  {id:'DEMO-P1-03',fr:'à bientôt',zh:'回头见',ipa:'/a bjɛ̃to/',unite:1,partie:1,group:'Les premiers mots',partie_title:'Les premiers mots'},
  {id:'DEMO-P2-01',fr:'un livre',zh:'一本书',ipa:'/œ̃ livʁ/',unite:1,partie:2,group:'Les objets du quotidien',partie_title:'Les objets du quotidien'},
  {id:'DEMO-P2-02',fr:'un café',zh:'一杯咖啡；一家咖啡馆',ipa:'/œ̃ kafe/',unite:1,partie:2,group:'Les objets du quotidien',partie_title:'Les objets du quotidien'},
  {id:'DEMO-P2-03',fr:'une maison',zh:'一所房子',ipa:'/yn mɛzɔ̃/',unite:1,partie:2,group:'Les objets du quotidien',partie_title:'Les objets du quotidien'},
];
export const initialBooks = [
  {id:'edito-b1',name:'Édito B1',series:'Édito',level:'B1',edition:'2023 版',color:'blue',status:'ready',bank,subtitle:'沿教材主题，一部分一部分掌握。'},
  inspireBook,
  editoA2Book,
  editoA1Book,
  {id:'edito-b2',name:'Édito B2',series:'Édito',level:'B2',edition:'待确认版本',color:'peach',status:'pending',subtitle:'课本选项示例，尚未接入词库。'},
  {id:'my-notebook',name:'我的法语笔记',series:'Mon carnet',level:'自由',edition:'演示词表',color:'sand',status:'demo',bank:demoBank,subtitle:'用 6 个示例词，体验独立的课本进度。'},
];
