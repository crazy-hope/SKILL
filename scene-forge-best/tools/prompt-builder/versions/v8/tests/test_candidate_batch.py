"""Request contract tests. Mocked upstream does not test LLM reasoning."""
import json, unittest
from unittest.mock import patch
from test_server import server, BRIEF, envelope, result

SCENES='建筑环境；街头机械师；高架车站列车进站；雨后夜市；载具展示；人物肖像；城市摩托骑手；屋顶无人机调度；垂直街区送货；城市河道巡检；全息广告维护；地下改装赛车；义体诊所候诊；产品静物；抽象构成；叙事场景；行人穿过霓虹商业街；全息鱼灯巡游；访客通过企业大厦入口安检；工人在工业下城区维修厂检修设备；乐手在地下俱乐部演出'

class CandidateBatchTests(unittest.TestCase):
    def test_many_choices_are_sent_with_candidate_policy_and_five_pair_contract(self):
        brief={**BRIEF,'题材':'赛博朋克','想画什么':SCENES,'数量':'5条','必须包含':'霓虹灯'}
        for provider in ('openai','deepseek'):
            mock=result();mock['schemes']=[dict(mock['schemes'][0]) for _ in range(5)]
            with patch.object(server,'upstream',return_value=envelope(mock)) as call:
                out=server.generate({'provider':provider,'model':'test','key':'test','brief':brief})
            system=call.call_args.args[3]['messages'][0]['content']
            self.assertIn('多选默认是候选范围',system)
            self.assertIn('画面类型不机械算作独立场景',system)
            self.assertIn('本次必须输出 5 个方案、5 对完整中英文',system)
            self.assertIn('未采用候选',system)
            self.assertEqual(json.loads(call.call_args.args[3]['messages'][1]['content']),brief)
            self.assertEqual(len(out['schemes']),5)

    def test_unset_people_counts_and_few_candidates_have_design_guidance(self):
        brief={**BRIEF,'想画什么':'街头机械师','数量':'5条'}
        mock=result();mock['schemes']=[dict(mock['schemes'][0]) for _ in range(5)]
        with patch.object(server,'upstream',return_value=envelope(mock)) as call:
            server.generate({'provider':'deepseek','model':'test','key':'test','brief':brief})
        system=call.call_args.args[3]['messages'][0]['content']
        self.assertIn('未填写人数不等于数量冲突',system)
        self.assertIn('候选少于方案数',system)
        self.assertNotIn('不得静默删除要求或自行猜测人数',system)

    def test_explicit_must_cover_constraints_remain_and_clarification_is_preserved(self):
        brief={**BRIEF,'想画什么':SCENES,'数量':'5条','创作自由度':'所有场景必须各自独立成图，不允许合并或省略'}
        response={'status':'clarification','questions':['独立场景数量超出指定方案数，请调整数量或覆盖范围。']}
        with patch.object(server,'upstream',return_value=envelope(response)) as call:
            out=server.generate({'provider':'deepseek','model':'test','key':'test','brief':brief})
        system=call.call_args.args[3]['messages'][0]['content']
        self.assertIn('03 必须包含始终是硬性要求',system)
        self.assertIn('全部必须体现',system)
        self.assertEqual(out['status'],'clarification')
        self.assertNotIn('schemes',out)
        self.assertEqual(out['brief'],brief)
