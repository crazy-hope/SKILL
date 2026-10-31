import json,unittest
from unittest.mock import patch
from test_server import server,BRIEF,envelope

class CelestialTests(unittest.TestCase):
    def request(self,topic,provider='deepseek'):
        brief={**BRIEF,'题材':topic,'必须包含':'自定义旅人；宋代建筑','视觉偏好':'黄昏','负面提示词':''}
        with patch.object(server,'upstream',return_value=envelope()) as call:
            out=server.generate({'provider':provider,'model':'test','key':'test','brief':brief})
        messages=call.call_args.args[3]['messages']
        self.assertEqual(json.loads(messages[1]['content']),brief)
        self.assertEqual(out['brief'],brief)
        self.assertIn(server.spec()[0],messages[0]['content'])
        return messages[0]['content']

    def test_topic_and_aliases_reach_both_services_with_scoped_direction(self):
        for provider in ('openai','deepseek'):
            for topic in ('东方天界幻想','东方天界','东方幻想世界','赛博朋克；东方幻想世界'):
                text=self.request(topic,provider)
                self.assertIn('【东方天界幻想专属方向】',text)
                for term in ('巨构主导','人物渺小','前景、中景、远景','具体输入优先','不自动加入','混合题材'):
                    self.assertIn(term,text)

    def test_other_topics_and_unrecognized_prose_do_not_receive_direction(self):
        for topic in ('赛博朋克','山海异境','仙侠江湖','志怪传说','龙宫水府','东方幻想','非东方天界幻想','不要东方幻想世界',''):
            self.assertNotIn('【东方天界幻想专属方向】',self.request(topic))
