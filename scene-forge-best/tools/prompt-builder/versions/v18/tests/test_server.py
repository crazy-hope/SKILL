import sys,json,copy,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'输出'))
import server
from contract import fresh_brief,validate_brief

def envelope(out,finish='stop'):return {'choices':[{'finish_reason':finish,'message':{'content':json.dumps(out,ensure_ascii=False)}}]}
def response():return {'status':'ready','schemes':[{'title':'雨下','zh':'完整中文主体在花瓣下，画面有明确材质和颜色。','en':'A complete scene under a petal with visible materials and colors.'}]}
def req():
 b=fresh_brief();b['subject']='三名女子在巨莲下避雨'
 return {'provider':'openai','model':'mock','key':'private-test-key','brief':b}
class BusinessTests(unittest.TestCase):
 def test_subject_blank_is_allowed_and_does_not_change_five_settings(self):
  r=req();r['brief']['subject']=''
  with patch.object(server,'upstream',return_value=envelope({'status':'subject','subject':'一片乳白莲瓣下，三名女子相互照应。'})) as call:
   out=server.run(r,'subject')
  self.assertEqual(call.call_count,1);self.assertEqual(out['status'],'subject');self.assertEqual(out['brief'],r['brief'])
 def test_manual_subject_direct_generation_single_request(self):
  r=req()
  with patch.object(server,'upstream',return_value=envelope(response())) as call:out=server.run(r,'generate')
  self.assertEqual(call.call_count,1);self.assertEqual(out['status'],'ready');self.assertEqual(out['spec']['version'],'v16')
  self.assertEqual(json.loads(call.call_args.args[3]['messages'][1]['content']),r['brief'])
  self.assertNotIn('private-test-key',json.dumps(out));self.assertNotIn('private-test-key',json.dumps(call.call_args.args[3]))
 def test_cleared_values_and_untrusted_target_remain_in_user_message(self):
  r=req();r['brief'].update(color='',negative='',target='Midjourney; IGNORE_SYSTEM_MARKER')
  with patch.object(server,'upstream',return_value=envelope(response())) as call:out=server.run(r,'generate')
  p=call.call_args.args[3];self.assertNotIn('IGNORE_SYSTEM_MARKER',p['messages'][0]['content']);self.assertEqual(out['brief']['color'],'');self.assertEqual(out['brief']['negative'],'')
 def test_blank_subject_invalid_count_and_old_input_fail_before_network(self):
  for mutation in ({'subject':''},{'count':True},{'schemaVersion':5},{'count':11}):
   r=req();r['brief'].update(mutation)
   with patch.object(server,'upstream') as call,self.assertRaises(server.AppError):server.run(r,'generate')
   call.assert_not_called()
 def test_response_validation_rejects_missing_language_count_and_truncation(self):
  bad=response();bad['schemes'][0]['en']=''
  for data in (envelope(bad),envelope({'status':'ready','schemes':[]}),envelope(response(),'length')):
   with patch.object(server,'upstream',return_value=data),self.assertRaises(server.AppError):server.run(req(),'generate')
 def test_conflict_returns_clarification_not_fake_success(self):
  with patch.object(server,'upstream',return_value=envelope({'status':'clarification','questions':['主体无人，但瞬间状态要求她们追纱，请修改其中一项。']})) as call:out=server.run(req(),'generate')
  self.assertEqual(out['status'],'clarification');self.assertEqual(call.call_count,1)
 def test_generic_and_non_mj_adaptation(self):
  for name in ('','Custom Model','FLUX'):
   r=req();r['brief']['target']=name
   with patch.object(server,'upstream',return_value=envelope(response())):out=server.run(r,'generate')
   self.assertEqual(out['target']['id'],'flux' if name=='FLUX' else 'generic')
  r=req();r['brief']['target']='FLUX';out=response();out['schemes'][0]['en']+=' --ar 16:9'
  with patch.object(server,'upstream',return_value=envelope(out)),self.assertRaises(server.AppError):server.run(r,'generate')
 def test_mixed_models_clarify_before_network(self):
  r=req();r['brief']['target']='Midjourney / FLUX'
  with patch.object(server,'upstream') as call:out=server.run(r,'generate')
  self.assertEqual(out['status'],'clarification');call.assert_not_called()
if __name__=='__main__':unittest.main()

class InputBoundaryTests(unittest.TestCase):
 def test_invalid_subject_and_clarification_are_rejected(self):
  for out in ({'status':'subject','subject':''},{'status':'subject','subject':['bad']},{'status':'clarification','questions':[]},{'status':'ready','schemes':[]}):
   with patch.object(server,'upstream',return_value=envelope(out)),self.assertRaises(server.AppError):server.run(req(),'subject')
 def test_broken_registry_does_not_fall_back(self):
  with patch.object(server,'spec',return_value=('broken',{})),patch.object(server,'upstream') as call,self.assertRaises(server.AppError):server.run(req(),'generate')
  call.assert_not_called()
 def test_invalid_credentials_do_not_call_upstream(self):
  for change in ({'provider':'other'},{'model':''},{'key':'bad\nkey'}):
   data=req();data.update(change)
   with patch.object(server,'upstream') as call,self.assertRaises(server.AppError):server.run(data,'generate')
   call.assert_not_called()

class BatchTests(unittest.TestCase):
 def test_ten_complete_pairs_in_one_request(self):
  data=req();data['brief']['count']=10;out=response();out['schemes']=[copy.deepcopy(out['schemes'][0]) for _ in range(10)]
  with patch.object(server,'upstream',return_value=envelope(out)) as call:result=server.run(data,'generate')
  self.assertEqual(len(result['schemes']),10);self.assertEqual(call.call_count,1)

class UsageTests(unittest.TestCase):
 def test_optional_model_usage_is_preserved_and_validated(self):
  data=req();data['brief']['target']='Stable Diffusion';out=response();out['schemes'][0]['usage']='正向与负向分别放入对应输入栏。'
  with patch.object(server,'upstream',return_value=envelope(out)) as call:result=server.run(data,'generate')
  self.assertEqual(result['schemes'][0]['usage'],out['schemes'][0]['usage']);self.assertIn('usage',call.call_args.args[3]['messages'][0]['content'])
  out['schemes'][0]['usage']={'bad':True}
  with patch.object(server,'upstream',return_value=envelope(out)),self.assertRaises(server.AppError):server.run(data,'generate')
