"""Refresh skill fallbacks from the owning textbook UI source."""
from pathlib import Path
import json,re,sys
sys.dont_write_bytecode=True
root=Path(__file__).resolve().parents[1]
skill=root/'plugin-package/skills/textbook-vocabulary-test'
source=(root/'assets/textbook-template.html').read_text()
template=source
for id,token in [('vocabulary-data','__VOCABULARY_JSON__'),('part-titles','__PART_TITLES_JSON__'),('theme-titles','__THEME_TITLES_JSON__'),('initial-state','__INITIAL_STATE_JSON__')]:
 template=re.sub(r'(<script id="'+id+r'"[^>]*>).*?(</script>)',lambda m:m[1]+token+m[2],template,flags=re.S)
core=(root/'assets/textbook-core.js').read_text()
assert core in template
template=template.replace(core,'__TEXTBOOK_CORE_JS__',1)
(skill/'assets/template.html').write_text(template)
(skill/'assets/textbook-core.js').write_text(core)
(skill/'assets/preview.html').write_text(source)
sys.path.insert(0,str(root/'plugin-package/skills/french-vocabulary-test/scripts'))
from inline_card import inline_card
(skill/'assets/interactive-card.html').write_text(inline_card(source,'textbook'))
print('Textbook template, preview and independent inline card refreshed.')
