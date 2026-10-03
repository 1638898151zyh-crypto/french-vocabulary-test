"""Package the checked-in skills, optionally with a user-owned HTTPS MCP."""
import argparse
import json
import tempfile
import shutil
import zipfile
from pathlib import Path
from urllib.parse import urlparse

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--mcp-url', help='Your deployed HTTPS MCP endpoint')
parser.add_argument('--output', type=Path)
args = parser.parse_args()
if args.mcp_url:
    url = urlparse(args.mcp_url)
    if url.scheme != 'https' or not url.hostname or url.username or url.password or url.query or url.fragment:
        parser.error('MCP URL must be HTTPS without credentials, query or fragment')
manifest = json.loads((root / 'plugin-package/plugin.json').read_text())
out = args.output or root / 'dist' / f'french-vocabulary-test-{manifest["version"]}.zip'
out = out.resolve()
out.parent.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory() as tmp:
    package = Path(tmp) / 'french-vocabulary-test'
    shutil.copytree(root / 'plugin-package', package,
                    ignore=shutil.ignore_patterns('__pycache__', '.app.json', '.codex-plugin', 'mcp.json'))
    for filename in ['LICENSE', 'DATA_NOTICE.md']:
        shutil.copyfile(root / filename, package / filename)
    if args.mcp_url:
        (package / 'mcp.json').write_text(json.dumps({
            'mcpServers': {'vocabulary': {'type': 'streamable-http', 'url': args.mcp_url}}
        }, indent=2) + '\n')
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as archive:
        for file in sorted(package.rglob('*')):
            if file.is_symlink():
                raise ValueError(f'Symlinks are not supported: {file}')
            if file.is_file():
                archive.write(file, file.relative_to(package.parent))
print(json.dumps({'archive': str(out), 'version': manifest['version'],
                  'mode': 'skills-and-mcp' if args.mcp_url else 'skills-only'}))
