import sys,json,unittest,copy
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'输出'))
import server
from test_server import envelope,result

def brief():
    return {'schemaVersion':2,'题材':'云上天宫','元素':'白鹿；仙女；星河；星沙云脊','视觉偏好':'时间：日出；配色：朱砂红为主、墨黑为辅、米白留白','镜头':'景别：超远景；视角：侧面高位俯视','风格与复杂度':'表现风格：电影 CG；复杂度：简约','构图':'对角线','目标模型':'Midjourney','画幅':'9:16','数量':'5条','大致说明':'白鹿发光，仙女沿云脊行走','负面提示词':'','elementSettings':[{'name':'白鹿','role':'主体','scale':'巨大','frame':'突出','count':'单个'},{'name':'仙女','role':'辅助','scale':'常规','frame':'高度约占画面3%','count':'单个'}],'designOptions':{'exploration':'自动设计','selectionMode':'全部包含','allowExtra':False},'legacy':{}}
class NewBriefTests(unittest.TestCase):
    def test_both_providers_keep_all_selections_and_full_spec(self):
        for provider in ('openai','deepseek'):
            b=brief();r=result();r['schemes']*=5
            with patch.object(server,'upstream',return_value=envelope(r)) as call:
                out=server.generate({'provider':provider,'model':'mock','key':'test','brief':b})
                self.assertEqual(out['brief'],b);self.assertEqual(out['spec']['version'],'v8')
                messages=call.call_args.args[3]['messages'];self.assertEqual(json.loads(messages[1]['content']),b)
                self.assertIn(server.spec()[0],messages[0]['content'])
                self.assertIn('elementSettings',messages[0]['content'])
                self.assertNotIn('默认仙境感与巨构主导',messages[0]['content'])
                self.assertNotIn('主场景必须在云海之上',messages[0]['content'])
    def test_invalid_settings_rejected_without_network(self):
        mutations=[lambda b:b['elementSettings'][0].update(name='未选宫殿'),lambda b:b['elementSettings'][0].update(role='bad'),lambda b:b['elementSettings'][0].update(key='secret'),lambda b:b['designOptions'].update(allowExtra='yes'),lambda b:b.update(数量='11条'),lambda b:b.update(schemaVersion=True),lambda b:b.update(legacy={'unexpected':'x'})]
        for mutate in mutations:
            b=brief();mutate(b)
            with patch.object(server,'upstream') as call:
                with self.assertRaises(server.AppError):server.generate({'provider':'openai','model':'mock','key':'test','brief':b})
                call.assert_not_called()
    def test_clarification_kept_and_unknown_target_uses_generic(self):
        b=brief();b['目标模型']='unknown model';b['大致说明']='必须深夜且必须正午';b['数量']='1条'
        with patch.object(server,'upstream',return_value=envelope({'status':'clarification','questions':['时间冲突']})):
            out=server.generate({'provider':'openai','model':'mock','key':'test','brief':b})
            self.assertEqual(out['status'],'clarification');self.assertEqual(out['target']['id'],'generic')

class IndependentClothingTests(unittest.TestCase):
    def test_explicit_unworn_garment_is_not_banned_by_no_people_rule(self):
        b=brief();b['元素']='拖地长裙';b['elementSettings']=[];b['大致说明']='独立衣裙展示，不含人物';b['数量']='1条'
        with patch.object(server,'upstream',return_value=envelope()) as call:
            server.generate({'provider':'openai','model':'mock','key':'test','brief':b})
            system=call.call_args.args[3]['messages'][0]['content']
            self.assertNotIn('人物未启用则不输出小人物、衣裙',system)
            self.assertEqual(json.loads(call.call_args.args[3]['messages'][1]['content'])['元素'],'拖地长裙')
