"""Convert the bundled self-contained UI into a scoped chat HTML fragment."""
import re
import uuid


def _scope_css(text, root):
    output, offset = [], 0
    while offset < len(text):
        start = text.find('{', offset)
        if start < 0:
            break
        header, depth, end = text[offset:start].strip(), 1, start + 1
        while end < len(text) and depth:
            depth += (text[end] == '{') - (text[end] == '}')
            end += 1
        if depth:
            raise ValueError('Unbalanced template CSS')
        content, offset = text[start + 1:end - 1], end
        if header == '@media(prefers-color-scheme:dark)':
            continue
        if header.startswith('@'):
            output.append(header + '{' + _scope_css(content, root) + '}')
        else:
            selectors = [s.strip() for s in header.split(',')]
            selectors = [root if s in (':root', 'body') else root + ' ' + s for s in selectors]
            output.append(','.join(selectors) + '{' + content + '}')
    return '\n'.join(output)


def inline_card(document, mode):
    if mode not in ('vocabulary', 'textbook'):
        raise ValueError('Unknown card mode')
    token = uuid.uuid4().hex[:12]
    root_id = 'fv-' + mode + '-' + token
    root = '#' + root_id
    styles = re.findall(r'<style[^>]*>(.*?)</style>', document, re.S)
    body = re.search(r'<body[^>]*>(.*?)</body>', document, re.S)
    if not body or not styles:
        raise ValueError('Expected the bundled UI document')
    css = '\n'.join(styles).replace('color-scheme:light;', 'color-scheme:inherit;')
    palette = {
        '--bg': 'light-dark(#fff,#191b1e)', '--ink': 'light-dark(#202124,#f0f0f1)',
        '--muted': 'light-dark(#777b80,#a0a3a7)', '--line': 'light-dark(#eeeef0,#303338)',
        '--pale': 'light-dark(#f5f6f7,#26292e)', '--green': 'light-dark(#139950,#198851)',
        '--red': 'light-dark(#ce454b,#be4148)', '--disabled': 'light-dark(#bfc3c6,#666b72)',
        '--disabled-border': 'light-dark(#e8eaec,#373b42)',
    }
    for name, value in palette.items():
        css = re.sub(re.escape(name) + r':[^;}]+', name + ':' + value, css)
    css = css.replace('cursor:pointer;', '')
    css = css.replace('#438ac7', 'light-dark(#438ac7,#acd0f3)')
    css = css.replace('background:#eaf2fa;color:#427cae', 'background:var(--pale);color:var(--muted)')
    css = _scope_css(css, root)
    css += '\n' + root + ' .tools,' + root + ' .actions,' + root + ' .tabs{flex-wrap:wrap}'
    css += '\n' + root + ' h1{padding-right:90px}'
    css += '\n@media(pointer:coarse){' + root + ' .mark,' + root + ' .nav,' + root + ' .tab,' + root + ' .action{min-height:44px}}'
    ui = body.group(1)
    # Separate frames and repeated cards must not attach to each other's nodes or globals.
    aliases = {'TextbookCore': 'TBCardCore_' + token, 'VocabCore': 'FVCardCore_' + token}
    for old, new in aliases.items():
        ui = ui.replace('globalThis.' + old, 'globalThis.' + new)
    ui = ui.replace('const host = globalThis.VocabHost;', 'const host = undefined;')
    ui = ui.replace('document.querySelector(', 'root.querySelector(')
    marker = "'use strict';\nconst bank=" if mode == 'textbook' else "'use strict';\n    const bank ="
    replacement = marker.replace('const bank', "const root=document.getElementById('" + root_id + "');\n    const bank")
    if marker not in ui:
        raise ValueError('UI initialization changed; inspect template before rendering')
    ui = ui.replace(marker, replacement, 1)
    ui = re.sub(r' title="\$\{!open.*?\}"', '', ui)
    ui = re.sub(r' tabindex="\$\{a.group===i\?0:-1\}"', '', ui)
    ui = ui.replace(' tab.tabIndex = selected ? 0 : -1;', '')
    ui = re.sub(r'class="(word|mark|nav|tab|action)([ "])', r'class="cursor-interaction \1\2', ui)
    result = '<div id="' + root_id + '">\n<style>\n' + css + '\n</style>\n' + ui + '\n</div>\n'
    if len(result.encode('utf-8')) >= 1_000_000:
        raise ValueError('Chat card exceeds 1 MB; reduce the embedded range')
    if re.search(r'<(?:html|head|body)\b|<!doctype', result, re.I):
        raise ValueError('Chat cards must be HTML fragments')
    if re.search(r'\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(', result):
        raise ValueError('Inline fallback must not depend on network APIs')
    return result
