import json,unittest
from unittest.mock import patch
from test_open_creation import draft,element
from test_server import server,envelope

class TopicBoundaries(unittest.TestCase):
 def test_boundary_rules_reach_both_providers_without_rewriting_inputs(self):
  for provider in ('openai','deepseek'):
   for mode,description in [('reference',''),('required',''),('required','明确融合东方建筑与西式骑士造型')]:
    b=draft();b.update({'题材':'东方奇幻世界','地域':'','元素':'西式骑士','大致说明':description})
    b['elementSettings']=[element('西式骑士',mode)]
    with patch.object(server,'upstream',return_value=envelope()) as call:
     result=server.generate(dict(provider=provider,model='mock',key='mock',brief=b))
    payload=call.call_args.args[3];rules=payload['messages'][0]['content']
    self.assertEqual(json.loads(payload['messages'][1]['content']),b)
    self.assertEqual(result['brief'],b)
    # Check request construction, not mock-model semantic compliance.
    self.assertIn('【题材文化与世界边界】',rules)
    self.assertIn('地域留空不解除题材',rules)
    self.assertIn('不相容的参考可舍弃',rules)
    self.assertIn('不相容的必须项返回clarification',rules)
    self.assertIn('只有用户明确要求跨文化融合',rules)
    self.assertIn('东方奇幻世界',rules)
    self.assertIn('只写“东方”标签不够',rules)
    self.assertIn('共享对象',rules)
    self.assertIn(server.spec()[0],rules)
 def test_unbounded_theme_and_visual_medium_are_not_forced_into_one_culture(self):
  b=draft();b['题材']='抽象构成';b['风格与复杂度']='油画'
  rules=server.brief_contract.instructions(b,1,'规范')
  self.assertIn('中性或未指定题材不凭空设定东方或西方',rules)
  self.assertIn('媒介不等于文化归属',rules)
