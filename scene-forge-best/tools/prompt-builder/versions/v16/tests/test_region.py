import hashlib,json,unittest
from unittest.mock import patch
from test_design import brief
from test_server import server,envelope

class RegionTests(unittest.TestCase):
    def test_region_reaches_both_providers_and_saved_result_with_v14_source(self):
        for provider in ('openai','deepseek'):
            for region in ('东方','西方','中国',''):
                b={**brief(),'题材':'赛博朋克','地域':region}
                with patch.object(server,'upstream',return_value=envelope()) as call:
                    out=server.generate(dict(provider=provider,model='mock',key='mock',brief=b))
                self.assertEqual(out['brief']['地域'],region)
                payload=call.call_args.args[3]
                self.assertEqual(json.loads(payload['messages'][1]['content'])['地域'],region)
                self.assertEqual(out['spec']['version'],'v14')
                expected=(server.ROOT/'versions/v14/输出/规范框架v14.md').read_bytes()
                self.assertEqual(out['spec']['sha256'],hashlib.sha256(expected).hexdigest())
                self.assertIn(expected.decode(),payload['messages'][0]['content'])

    def test_bad_region_or_unknown_field_rejected_before_network(self):
        for extra in ({'地域':None},{'地域':12},{'地域':[]},{'地域':{}},{'地域':'东方；西方'},{'地域':'日本'},{'地域':'中国 '},{'地域':'中国','unexpected':True}):
            with self.subTest(extra=extra),patch.object(server,'upstream') as call:
                with self.assertRaises(server.AppError):
                    server.generate(dict(provider='openai',model='mock',key='mock',brief={**brief(),**extra}))
                call.assert_not_called()

    def test_current_v16_request_without_region_is_preserved(self):
        b=brief()
        with patch.object(server,'upstream',return_value=envelope()) as call:
            out=server.generate(dict(provider='openai',model='mock',key='mock',brief=b))
        self.assertNotIn('地域',out['brief'])
        self.assertNotIn('地域',json.loads(call.call_args.args[3]['messages'][1]['content']))
