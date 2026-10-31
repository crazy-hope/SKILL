import json, unittest
from unittest.mock import patch
from test_design import brief, setting
from test_server import server, envelope

EXTRA=dict(age='青年',hairstyle='高马尾',clothing='交领长袍',clothingColor='青色',clothingMaterial='丝绸',accessories='玉佩')

class CharacterTests(unittest.TestCase):
    def test_character_settings_reach_both_providers_and_exports(self):
        for provider in ('openai','deepseek'):
            b=brief(); b['elementSettings']=[{**setting(),**EXTRA,'gender':'女性','count':'2人'}]+[s for s in b['elementSettings'] if s['name']!='仙女']
            with patch.object(server,'upstream',return_value=envelope()) as call:
                out=server.generate(dict(provider=provider,model='mock',key='mock',brief=b))
            payload=call.call_args.args[3]
            self.assertEqual(json.loads(payload['messages'][1]['content']),b)
            self.assertEqual(out['brief'],b)
            for key in EXTRA:self.assertIn(key,payload['messages'][0]['content'])
            for phrase in ('同一人物元素','衣服','不适用','服饰','clarification'):self.assertIn(phrase,payload['messages'][0]['content'])

    def test_each_optional_attribute_is_independent_and_bounded(self):
        for key in EXTRA:
            b=brief(); b['elementSettings']=[{**setting(),key:EXTRA[key]}]+[s for s in b['elementSettings'] if s['name']!='仙女']
            server.validate_brief(b) if hasattr(server,'validate_brief') else server.brief_contract.validate(b,server.AppError)
            for invalid in (None,123,[],{},'', '  ', 'x'*81):
                b['elementSettings'][0][key]=invalid
                with patch.object(server,'upstream') as call:
                    with self.assertRaises(server.AppError):server.generate(dict(provider='openai',model='mock',key='mock',brief=b))
                    call.assert_not_called()
