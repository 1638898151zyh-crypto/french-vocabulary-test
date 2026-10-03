"""Render the existing five-by-ten vocabulary UI, with an inline chat fallback."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess

from inline_card import inline_card


def safe_json(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).replace('&', '\\u0026').replace('<', '\\u003c').replace('>', '\\u003e')


def main():
    parser = argparse.ArgumentParser(description='法语词汇检测：生成可点击聊天卡片或独立预览。')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--inline', action='store_true', help='输出聊天内渲染的HTML片段')
    parser.add_argument('--unit', type=int, choices=range(1, 13), default=1)
    parser.add_argument('--bank', type=Path, help='用户指定且已核对的JSON词库；包含P1和P2各至少25词')
    parser.add_argument('--state', type=Path, help='此前导出的本模式记录；不会读取课本主进度')
    args = parser.parse_args()
    skill = Path(__file__).resolve().parents[1]
    bank_path = args.bank or skill / 'assets/edito-b1-2023.json'
    bank = json.loads(bank_path.read_text(encoding='utf-8'))
    if not args.bank:
        if len(bank) != 1110 or len({e['id'] for e in bank}) != 1110:
            raise ValueError('内置词库应为1110个唯一词条')
        bank = [e for e in bank if int(e['unite']) == args.unit]
    titles = json.loads((skill.parent/'textbook-vocabulary-test/assets/part-titles.json').read_text())
    bank = [{**e, 'partie_title_zh': e.get('partie_title_zh') or titles.get(f"U{int(e['unite'])}P{int(e['partie'])}", {}).get('zh', '')} if 'unite' in e and 'partie' in e else e for e in bank]
    core = (skill / 'assets/vocabulary-core.js').read_text()
    js = """const fs=require('fs');eval(fs.readFileSync(process.argv[1],'utf8'));
    const bank=JSON.parse(process.argv[2]);VocabCore.selectRound(bank);
    const raw=process.argv[3]?fs.readFileSync(process.argv[3],'utf8'):null;
    const state=raw?VocabCore.restore(raw,bank):null;
    if(raw&&!state)throw Error('记录无效；未覆盖任何已有记录');
    console.log(JSON.stringify(state));"""
    state = json.loads(subprocess.check_output(['node', '-e', js, str(skill / 'assets/vocabulary-core.js'), json.dumps(bank, ensure_ascii=False), str(args.state.resolve()) if args.state else ''], text=True))
    template = (skill / 'assets/template.html').read_text()
    replacements = {'__VOCABULARY_JSON__': safe_json(bank), '__CORE_JS__': core, '__SYNC_JS__': '', '__HOST_BRIDGE__': ''}
    document = re.sub('|'.join(map(re.escape, replacements)), lambda m: replacements[m.group()], template)
    document = document.replace('Édito B1 · U1 P1＋P2 · 法语 → 中文', ('用户词库' if args.bank else f'Édito B1 · U{args.unit} P1＋P2') + ' · 法语 → 中文')
    if args.bank or args.unit != 1:
        digest = hashlib.sha256(safe_json(bank).encode()).hexdigest()[:16]
        document = document.replace('french-vocabulary-test:edito-b1-u1:v1', 'french-vocabulary-test:range:' + digest + ':v1')
    # A supplied checkpoint is explicit; otherwise retain existing browser records.
    document = document.replace('state ||= Core.create(bank);', 'if (' + safe_json(state) + ') state = Core.restore(' + safe_json(state) + ',bank);\n    state ||= Core.create(bank);')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(inline_card(document, 'vocabulary') if args.inline else document, encoding='utf-8')
    print(json.dumps({'mode': 'vocabulary', 'words': 50, 'groups': 5, 'inline': args.inline, 'output': str(args.output)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
