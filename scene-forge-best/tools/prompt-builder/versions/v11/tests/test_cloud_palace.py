import json,unittest
from unittest.mock import patch
from test_server import server,BRIEF,envelope

class CloudPalaceTests(unittest.TestCase):
    def test_both_services_receive_cloud_direction_without_changing_brief_or_spec(self):
        for provider in ('openai','deepseek'):
            for scene,required in [('叙事场景','仙鹤'),('叙事场景','仙女；仙鹤'),('无人空景','白鹿'),('巨型宫阙','山石')]:
                with self.subTest(provider=provider,scene=scene,required=required):
                    brief={**BRIEF,'题材':'云上天宫','想画什么':scene,'必须包含':required,'视觉偏好':'红白色'}
                    with patch.object(server,'upstream',return_value=envelope()) as call:
                        out=server.generate({'provider':provider,'model':'test','key':'test','brief':brief})
                    messages=call.call_args.args[3]['messages'];text=messages[0]['content']
                    for term in ('【云上天宫专属方向】','主场景必须在云海之上','主色、辅色与小面积强调色','双语最终提示词'):
                        self.assertIn(term,text)
                    # A sparse animal brief must never inherit unconditional architecture/human requirements.
                    for obsolete in ('建筑与山石均须出现','默认有少量渺小人物','例如云上天宫的建筑与山石在云海之上','默认让建筑本身具有超常体量'):
                        self.assertNotIn(obsolete,text)
                    self.assertNotIn('【东方天界幻想专属方向】',text)
                    self.assertIn(server.spec()[0],text)
                    self.assertEqual(json.loads(messages[1]['content']),brief)
                    self.assertEqual(out['brief'],brief)

    def test_matching_uses_selected_topic_tokens_and_combines_only_selected_directions(self):
        for value in ('东方天界幻想','赛博朋克','山海异境','不要云上天宫','云上天宫殿',''):
            self.assertNotIn('【云上天宫专属方向】',server.topic_direction(value))
        mixed=server.topic_direction('云上天宫；东方天界幻想')
        self.assertIn('【云上天宫专属方向】',mixed)
        self.assertIn('【东方天界幻想专属方向】',mixed)
