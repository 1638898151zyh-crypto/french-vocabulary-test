"""Render the complete current Édito B1 Part, preserving source IDs."""
import argparse
import json
from pathlib import Path
import subprocess
import sys


def safe_json(value):
    return json.dumps(value, ensure_ascii=False).replace('&', '\\u0026').replace('<', '\\u003c').replace('>', '\\u003e')


def main():
    parser = argparse.ArgumentParser(description='课本单词检测：单 Part 全量词条与独立主进度。')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--inline', action='store_true', help='输出可在聊天内渲染的HTML片段')
    parser.add_argument('--state', type=Path, help='此前导出的可信主进度；不读取每日副进度。')
    parser.add_argument('--state-out', type=Path)
    parser.add_argument('--pass', dest='passed', action='store_true', help='用户明确过关；需要当前主进度文件。')
    parser.add_argument('--request-id', help='当前用户确认消息的唯一标识，重试复用同一标识。')
    args = parser.parse_args()
    if args.passed and (not args.state or not args.request_id):
        parser.error('--pass 需要 --state 和 --request-id，不能猜测进度或重复推进。')
    skill = Path(__file__).resolve().parents[1]
    shared = skill.parent / 'french-vocabulary-test'
    bank_path = shared / 'assets/edito-b1-2023.json'
    bank = json.loads(bank_path.read_text(encoding='utf-8'))
    if len(bank) != 1110 or len({e['id'] for e in bank}) != 1110:
        raise ValueError('词库应含1110个唯一词条；请核对来源。')
    js = '''const fs=require('fs');globalThis.crypto=require('crypto').webcrypto;
    eval(fs.readFileSync(process.argv[1],'utf8'));
    const bank=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
    const raw=process.argv[3]?fs.readFileSync(process.argv[3],'utf8'):null;
    let state=raw?TextbookCore.restore(raw,bank):TextbookCore.create(bank);
    if(!state)throw Error('主进度文件无效；未覆盖原记录');
    if(process.argv[4]==='pass'&&!(state.processedCommands||[]).includes(process.argv[5])){
      if(state.completed)throw Error('全书已过关');
      const i=state.attempts.findLastIndex(a=>a.part===state.order[state.current]&&!a.passReason);
      if(i<0)throw Error('找不到当前检测');state.view=i;
      if(!TextbookCore.pass(state,bank,'manual',process.argv[5]))throw Error('无法推进当前部分');
      state.updatedAt=new Date().toISOString();
    }
    console.log(JSON.stringify(state));'''
    command = ['node', '-e', js, str(skill/'assets/textbook-core.js'), str(bank_path), str(args.state.resolve()) if args.state else '', 'pass' if args.passed else '', args.request_id or '']
    state = json.loads(subprocess.check_output(command, text=True))
    replacements = {
        '__VOCABULARY_JSON__': safe_json(bank),
        '__PART_TITLES_JSON__': safe_json(json.loads((skill/'assets/part-titles.json').read_text())),
        '__THEME_TITLES_JSON__': safe_json(json.loads((skill/'assets/theme-titles.json').read_text())),
        '__INITIAL_STATE_JSON__': safe_json(state),
        '__TEXTBOOK_CORE_JS__': (skill/'assets/textbook-core.js').read_text(),
    }
    template = (skill/'assets/template.html').read_text()
    # One pass avoids treating inserted source as another replacement placeholder.
    import re
    template = re.sub('|'.join(map(re.escape, replacements)), lambda m: replacements[m.group()], template)
    if args.inline:
        sys.path.insert(0, str(shared/'scripts'))
        from inline_card import inline_card
        template = inline_card(template, 'textbook')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(template, encoding='utf-8')
    if args.state_out:
        args.state_out.parent.mkdir(parents=True, exist_ok=True)
        args.state_out.write_text(json.dumps(state, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    active = state['attempts'][state['view']]
    print(json.dumps({'part':active['part'], 'words':len(active['ids']), 'groups':len({str(e['group']).strip() for e in bank if e['id'] in active['ids']}), 'completed':state['completed'], 'output':str(args.output)},ensure_ascii=False))


if __name__ == '__main__':
    main()
