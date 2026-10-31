import copy,json,sys,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'输出'))
import server
FIELDS=('题材','元素','视觉偏好','镜头','风格与复杂度','构图','目标模型','画幅','数量','大致说明','负面提示词')
def brief():
    b=dict.fromkeys(FIELDS,'');b.update({'题材':'云上天宫','元素':'仙女；白鹿；星河；星沙云脊','目标模型':'Midjourney','画幅':'9:16','数量':'1条','schemaVersion':4,'elementSettings':[],'designOptions':{'exploration':'自动设计'}})
    b['elementSettings']=[{**setting(),'name':n,'target':'','relation':'自动'} for n in b['元素'].split('；')]
    return b
def setting():return dict(name='仙女',presence='reference',role='辅助',scale='常规',frame='全身高度约占画面3%',count='单个',action='缓步',position='下部',depth='中景',relation='沿着',target='星沙云脊')
class DesignTests(unittest.TestCase):
    def test_selection_only_reaches_both_providers_with_autodesign_and_full_spec(self):
        from test_server import envelope
        for provider in ('openai','deepseek'):
            b=brief()
            with patch.object(server,'upstream',return_value=envelope()) as call:
                out=server.generate(dict(provider=provider,model='mock',key='mock',brief=b))
            payload=call.call_args.args[3];self.assertEqual(json.loads(payload['messages'][1]['content']),b)
            self.assertEqual(out['brief'],b)
            instruction=payload['messages'][0]['content']
            for phrase in ('动作与空间自动设计','手动锁定','不要求用户填写大致说明','附属','明确“无人”',server.spec()[0]):self.assertIn(phrase,instruction)
    def test_manual_settings_pass_unchanged(self):
        from test_server import envelope
        b=brief();b['elementSettings']=[setting()]+[s for s in b['elementSettings'] if s['name']!='仙女']
        with patch.object(server,'upstream',return_value=envelope()) as call:
            out=server.generate(dict(provider='openai',model='mock',key='mock',brief=b))
        self.assertEqual(out['brief'],b)
    def test_stale_relation_self_relation_bad_shape_and_old_versions_rejected_before_network(self):
        cases=[]
        for target in ('宫殿','仙女'):
            b=brief();b['elementSettings']=[{**setting(),'target':target}]+[s for s in b['elementSettings'] if s['name']!='仙女'];cases.append(b)
        for schema in (1,2,None):
            b=brief();b['schemaVersion']=schema;cases.append(b)
        b=brief();b['legacy']={};cases.append(b)
        b=brief();b['elementSettings']=[{**setting(),'action':'x'*81}]+[s for s in b['elementSettings'] if s['name']!='仙女'];cases.append(b)
        for b in cases:
            with patch.object(server,'upstream') as call:
                with self.assertRaises(server.AppError):server.generate(dict(provider='openai',model='mock',key='mock',brief=b))
                call.assert_not_called()
