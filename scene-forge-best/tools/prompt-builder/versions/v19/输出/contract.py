"""Fresh V18 input contract; no legacy creative fields or migrations."""
import json
from pathlib import Path
DEFAULTS=json.loads((Path(__file__).parent/'defaults.json').read_text())
FIELDS=('style','color','camera','mood','moment','subject','negative','target')
def fresh_brief():return dict(schemaVersion=6,**DEFAULTS,subject='',target='Midjourney',count=1)
def validate_brief(value,error=ValueError):
    if not isinstance(value,dict) or set(value)!=set(FIELDS)|{'schemaVersion','count'} or type(value['schemaVersion']) is not int or value['schemaVersion']!=6:
        raise error('输入格式错误：需要当前六段工作台数据。')
    for key in FIELDS:
        if not isinstance(value[key],str) or len(value[key])>(12000 if key=='subject' else 6000):raise error('输入内容格式错误或超长。')
    if type(value['count']) is not int or not 1<=value['count']<=10:raise error('方案数量需要是1至10。')
    return dict(value)
