import unittest,json
from unittest.mock import patch
from test_server import server,BRIEF,envelope

class SceneRoleTests(unittest.TestCase):
    def test_cross_field_roles_and_counts_are_sent_without_rewriting_input(self):
        for details in ('义体维修师，机械义臂','另一名义体维修师在旁边等候','必须有两名维修师'):
            brief={**BRIEF,'想画什么':'一名义体维修师维修摩托','必须包含':details}
            with patch.object(server,'upstream',return_value=envelope()) as call:
                out=server.generate({'provider':'deepseek','model':'test','key':'test','brief':brief})
            messages=call.call_args.args[3]['messages']
            self.assertIn('重复强调同一主体不自动增加人数或物件数',messages[0]['content'])
            self.assertIn('另一名',messages[0]['content'])
            self.assertIn('指代歧义',messages[0]['content'])
            self.assertEqual(json.loads(messages[1]['content']),brief)
            self.assertEqual(out['brief'],brief)
