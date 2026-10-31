"""Proportionate document/source archive checks; no model/image validation."""
import re,json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[5]
APP=ROOT/'tools/prompt-builder/versions/v18'
NORM=ROOT/'versions/v16'
old=(ROOT/'versions/v15/输出/规范框架v15.md').read_text();new=(NORM/'输出/规范框架v16.md').read_text()
def part(text,start,end):return text[text.index(start):text.index(end,text.index(start))]
for start,end in [('## 8.','## 9.'),('<!-- MODEL_ADAPTERS_START -->','<!-- MODEL_ADAPTERS_END -->'),('## 13.','## 14.')]:
 assert part(old,start,end)==part(new,start,end),f'Changed preserved module: {start}'
print('PASS three picture modules, adapter registry and historical example unchanged')
snapshot=json.loads((APP/'验证材料/历史SHA-256.json').read_text())
for filename,digest in snapshot.items():assert hashlib.sha256((ROOT/filename).read_bytes()).hexdigest()==digest,filename
print(f'PASS {len(snapshot)} archived file SHA-256 values unchanged')
files=[ROOT/x for x in ('README.md','CHANGELOG.md','AGENTS.md','提示词输入模板.md')]+list(NORM.glob('*.md'))+list((NORM/'输出').glob('*.md'))+list(APP.glob('*.md'))
link_count=0
for p in files:
 s=p.read_text();fence=None;table_width=None
 for line in s.splitlines():
  if line.startswith('```'):
   fence=None if fence else line[:3];table_width=None;continue
  if fence:continue
  assert not re.match(r'^#+[^ #]',line),f'{p}: malformed heading'
  if line.startswith('|'):
   width=len(re.split(r'(?<!\\)\|',line))
   if table_width is not None:assert width==table_width,f'{p}: inconsistent table {line}'
   table_width=width
  else:table_width=None
 assert fence is None,f'{p}: unclosed fence'
 for match in re.finditer(r'!?\[[^\]]*\]\(([^\s)]+)\)',s):
  target=match.group(1)
  if '://' in target or target.startswith('#'):continue
  target=target.split('#')[0];assert (p.parent/target).exists(),f'{p}: missing {target}';link_count+=1
 assert '待最终' not in s and '检查进行中' not in s,f'{p}: incomplete delivery state'
print(f'PASS {len(files)} Markdown documents; headings, fences, tables and {link_count} local links')
assert re.findall(r'^## (\d+)\.',new,re.M)==[str(i) for i in range(1,16)]
assert '- 版本：16.0' in new and '- 基线：V15' in new and '- 日期：2026-10-30' in new
assert 'versions/v18/输出/server.py' in (ROOT/'启动提示词工作台.command').read_text()
for folder in (APP,NORM):
 for name in ('需求.md','计划.md','变更记录.md','验收记录.md'):assert (folder/name).is_file()
 for i in range(1,7):assert f'R-0{i}' in (folder/'变更记录.md').read_text()
 assert '- [ ]' not in (folder/'计划.md').read_text()
print('PASS 15-chapter complete V16, version/baseline/date, R-01–R-06 records and V18 launcher')
source=(APP/'输出/src/App.jsx').read_text()
for marker in ['Conditions','ConceptCard','catalog.mjs','scene-data','from "antd"','brief_contract','selected.relationship']:assert marker not in source
assert 'scene-forge-workspace-v18' in (APP/'输出/model.mjs').read_text()
assert (APP/'输出/dist/index.html').is_file()
print('PASS new UI source has no old components/catalog; schema6 storage and production dist present')
