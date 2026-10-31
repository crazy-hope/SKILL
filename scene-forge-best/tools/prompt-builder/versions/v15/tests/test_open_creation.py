import copy,json,sys,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'输出'))
import server

def draft():
 b=dict.fromkeys(server.brief_contract.FIELDS,'')
 b.update(schemaVersion=4,elementSettings=[],designOptions={'exploration':'自动设计'})
 b.update({'数量':'1条','大致说明':'安静、辽阔、像时间停止了'})
 return b

def element(name,presence='reference',target=''):
 return dict(name=name,presence=presence,role='自动',scale='自动',frame='自动',count='自动',action='自动',position='自动',depth='自动',relation='自动',target=target)

class OpenCreation(unittest.TestCase):
 def test_intent_alone_and_required_dependencies(self):
  b=draft();self.assertEqual(server.brief_contract.validate(b,server.AppError),1)
  b['元素']='白鹿；道路';b['elementSettings']=[element('白鹿','required','道路'),element('道路')]
  with self.assertRaisesRegex(server.AppError,'必须'):server.brief_contract.validate(b,server.AppError)
  b['elementSettings'][1]['presence']='required';b['elementSettings'][1]['target']='白鹿'
  self.assertEqual(server.brief_contract.validate(b,server.AppError),1)
 def test_malformed_contract_before_network(self):
  b=draft();b['元素']='白鹿';b['elementSettings']=[element('白鹿')]
  cases=[]
  for mutate in [lambda x:x['elementSettings'][0].pop('presence'),lambda x:x['elementSettings'][0].update(presence='unknown'),lambda x:x.update(elementSettings=[]),lambda x:x.update(schemaVersion=3),lambda x:x['designOptions'].update(allowExtra=True)]:
   bad=copy.deepcopy(b);mutate(bad);cases.append(bad)
  for bad in cases:
   with patch.object(server,'upstream') as call:
    with self.assertRaises(server.AppError):server.generate(dict(provider='openai',model='mock',key='mock',brief=bad))
    call.assert_not_called()
 def test_instructions_support_open_subjects_and_conditional_constraints(self):
  s=server.brief_contract.instructions(draft(),1,'完整规范')
  for term in ['灵感参考','必须出现','库外','采用时','无人','不同主体','schemaVersion=4']:
   self.assertIn(term,s)
  for term in ['每方案默认全部包含已选元素','只有已选人物元素或说明明确要求人物时才启用人物','allowExtra为false']:
   self.assertNotIn(term,s)
