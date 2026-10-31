"""Version, archive and Markdown checks for this delivery; stdlib only."""
from pathlib import Path
import hashlib,json,re
root=Path(__file__).resolve().parents[5]
app=root/'tools/prompt-builder/versions/v17'
norm=root/'versions/v15'
old=json.loads((app/'验证材料/历史SHA-256.json').read_text())
changed=[path for path,digest in old.items() if not (root/path).is_file() or hashlib.sha256((root/path).read_bytes()).hexdigest()!=digest]
assert not changed,changed
paths=[root/n for n in ('AGENTS.md','README.md','CHANGELOG.md','提示词输入模板.md')]+list(norm.rglob('*.md'))+list(app.glob('*.md'))
link_count=0;fences=0;tables=0
for path in paths:
 text=path.read_text();active=None
 for line in text.splitlines():
  m=re.match(r'^\s*(`{3,}|~{3,})',line)
  if m:
   marker=m.group(1)
   if active is None:active=marker;fences+=1
   elif marker[0]==active[0] and len(marker)>=len(active):active=None
  if active is None and re.match(r'^\|\s*:?-+',line):tables+=1
 assert active is None,('fence',str(path))
 # Validate file links, ignoring HTTP and intra-document anchors.
 for raw in re.findall(r'\]\(([^\n)]+)\)',text):
  target=raw.split(' "',1)[0].strip('<>').split('#',1)[0]
  if not target or re.match(r'[a-zA-Z][a-zA-Z0-9+.-]*:',target):continue
  resolved=(path.parent/target).resolve()
  assert resolved.exists() or resolved==(app/'验证材料/文档与历史校验.json').resolve(),('missing link',str(path),target)
  link_count+=1
v14=(root/'versions/v14/输出/规范框架v14.md').read_text();v15=(norm/'输出/规范框架v15.md').read_text()
for a,b in [('## 8. 三个画面控制模块','## 9. 创意'),('## 13. 应用示例','## 14. 后续'),('<!-- MODEL_ADAPTERS_START -->','<!-- MODEL_ADAPTERS_END -->')]:
 def block(s):return s[s.index(a):s.index(b,s.index(a))]
 assert block(v14)==block(v15),('preserved block',a)
assert len(re.findall(r'^## \d+\.',v15,re.M))==15
for key in ('位置、材质与状态、颜色','表现基准贯穿全文','独立文本审校','完整V15','schemaVersion=5'):
 assert key in v15,key
for key in ('R-01','R-02','R-03','R-04','R-05','R-06','R-07','R-08'):
 for folder in (norm,app):
  for name in ('需求.md','变更记录.md'):
   assert key in (folder/name).read_text(),(key,folder,name)
assert 'versions/v17/输出/server.py' in (root/'启动提示词工作台.command').read_text()
assert 'versions/v15/输出/规范框架v15.md' in (app/'输出/server.py').read_text()
assert (app/'输出/dist/index.html').is_file()
assert '17.0.0'==json.loads((app/'输出/package.json').read_text())['version']
report={'result':'pass','oldArchiveFilesUnchanged':len(old),'markdownFiles':len(paths),'localLinks':link_count,'codeBlocks':fences,'tables':tables,'normChapters':15,'preserved':['three picture modules','model registry','historical example'],'normSHA256':hashlib.sha256((norm/'输出/规范框架v15.md').read_bytes()).hexdigest(),'realModelTest':'not executed','imageTest':'not executed'}
(app/'验证材料/文档与历史校验.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
