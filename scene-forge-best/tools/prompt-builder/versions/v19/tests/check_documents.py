import re,json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[5];APP=ROOT/'tools/prompt-builder/versions/v19';BASE=APP.parent/'v18'
snapshot=json.loads((APP/'验证材料/历史SHA-256.json').read_text())
for filename,digest in snapshot.items():assert hashlib.sha256((ROOT/filename).read_bytes()).hexdigest()==digest,filename
print(f'PASS {len(snapshot)} archived files unchanged including complete specification V16')
for name in ('model.mjs','contract.py','defaults.json'):
 assert (APP/'输出'/name).read_bytes()==(BASE/'输出'/name).read_bytes(),name
assert (APP/'输出/server.py').read_text().replace('V19 React/Ant Design studio','V18 six-paragraph studio')==(BASE/'输出/server.py').read_text()
print('PASS data/default contracts and server business unchanged; shared workspace-v18')
files=[ROOT/x for x in ['AGENTS.md','README.md','CHANGELOG.md','提示词输入模板.md']]+list(APP.glob('*.md'))+list((APP/'维护记录').glob('*.md'));links=0
for p in files:
 s=p.read_text();fence=False;width=None
 for line in s.splitlines():
  if line.startswith('```'):fence=not fence;width=None;continue
  if fence:continue
  assert not re.match(r'^#+[^ #]',line),f'{p}: heading'
  if line.startswith('|'):
   n=len(re.split(r'(?<!\\)\|',line))
   if width is not None:assert n==width,f'{p}: table'
   width=n
  else:width=None
 assert not fence,f'{p}: fence'
 for target in re.findall(r'!?\[[^\]]*\]\(([^\s)]+)\)',s):
  if '://' in target or target.startswith('#'):continue
  assert (p.parent/target.split('#')[0]).exists(),f'{p}: {target}';links+=1
 if p.parent==APP:assert not re.search('状态：进行中|审查进行中|待最终核对',s),f'{p}: unfinished'
print(f'PASS {len(files)} Markdown files, headings/fences/tables and {links} local links')
for i in range(1,5):assert f'R-0{i}' in (APP/'变更记录.md').read_text()
assert '- [ ]' not in (APP/'计划.md').read_text()
assert 'versions/v19/输出/server.py' in (ROOT/'启动提示词工作台.command').read_text()
assert json.loads((APP/'输出/package.json').read_text())['dependencies']['antd']=='6.6.7'
assert json.loads((APP/'输出/node_modules/antd/package.json').read_text())['version']=='6.6.7'
for name in ['BriefEditor','Results','SettingsModal','RecordsModal']:
 s=(APP/f'输出/src/components/{name}.jsx').read_text();assert 'from "antd"' in s
for asset in re.findall(r'(?:src|href)="(/assets/[^"]+)"',(APP/'输出/dist/index.html').read_text()):assert (APP/'输出/dist'/asset.lstrip('/')).is_file()
print('PASS R-01–R-04 mapping, V19 launcher, installed library/components and built assets')

maintenance=APP/"维护记录/2026-10-30-样式与生成弹窗.md"
for name,digest in json.loads((maintenance.with_suffix("")/"不变文件SHA-256.json").read_text()).items():
 assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==digest,name
for i in range(1,5):assert f"M-0{i}" in maintenance.read_text()
assert "- [ ]" not in maintenance.read_text()
print("PASS M-01–M-04 maintenance mapping and specification/defaults/data/server SHA unchanged")
