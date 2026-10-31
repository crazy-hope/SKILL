from review_fixture import reviewed_upstream
import json,unittest
from unittest.mock import patch
from test_design import brief,setting
from test_server import server,envelope

class GenderTests(unittest.TestCase):
    def test_gender_reaches_both_providers_and_returned_history(self):
        for provider in ('openai','deepseek'):
            for gender in ('自动','男性','女性','非二元','不强调性别','一男一女'):
                b=brief();b.update({'题材':'赛博朋克','元素':'网络黑客'})
                b['elementSettings']=[{**setting(),'name':'网络黑客','gender':gender,'target':''}]
                with patch.object(server,'upstream',side_effect=reviewed_upstream(envelope())) as call:
                    out=server.generate(dict(provider=provider,model='mock',key='mock',brief=b))
                self.assertEqual(out['brief']['elementSettings'][0]['gender'],gender)
                sent=json.loads(call.call_args_list[0].args[3]['messages'][1]['content'])
                self.assertEqual(sent['elementSettings'][0]['gender'],gender)

    def test_bad_gender_and_unknown_attributes_rejected_before_network(self):
        for extra in ({'gender':None},{'gender':123},{'gender':[]},{'gender':''},{'gender':'x'*81},{'gender':'女性','unknown':'x'}):
            b=brief();b['elementSettings']=[{**setting(),**extra}]+[s for s in b['elementSettings'] if s['name']!='仙女']
            with patch.object(server,'upstream') as call:
                with self.assertRaises(server.AppError):
                    server.generate(dict(provider='openai',model='mock',key='mock',brief=b))
                call.assert_not_called()
