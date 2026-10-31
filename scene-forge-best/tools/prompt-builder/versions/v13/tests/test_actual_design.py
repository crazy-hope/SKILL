import copy, json, unittest
from unittest.mock import patch
from test_server import server, result, envelope, BRIEF


class ActualDesignTests(unittest.TestCase):
    def test_generation_keeps_per_scheme_design_and_excludes_unknown_keys(self):
        for provider in ('openai', 'deepseek'):
            r = result()
            r['schemes'][0]['design']['元素'] = '悬浮的折光石环、镜面水池（库外原创组合）'
            r['schemes'][0]['design']['key'] = 'not-for-storage'
            with patch.object(server, 'upstream', return_value=envelope(r)) as call:
                out = server.generate({'provider': provider, 'model': 'test', 'key': 'test', 'brief': BRIEF})
            self.assertEqual(out['schemes'][0]['design']['元素'], '悬浮的折光石环、镜面水池（库外原创组合）')
            self.assertNotIn('key', out['schemes'][0]['design'])
            instructions = call.call_args.args[3]['messages'][0]['content']
            self.assertIn('"design"', instructions)
            self.assertIn('库外', instructions)
            self.assertEqual(out['brief'], BRIEF)

    def test_incomplete_or_placeholder_design_never_becomes_ready(self):
        good = result()['schemes'][0]['design']
        invalid = [None, [], '设计文本', {}, {**good, '元素': []}]
        for value in ('', '  ', '自动', '自动设计', '未指定', '由你设计', 'x' * 3001):
            invalid.append({**good, '元素': value})
        for design in invalid:
            r = result()
            r['schemes'][0]['design'] = design
            with self.subTest(design=design), self.assertRaises(server.AppError):
                server.parse_output(envelope(r), 1)
        r = result()
        del r['schemes'][0]['design']
        with self.assertRaises(server.AppError):
            server.parse_output(envelope(r), 1)

    def test_two_schemes_keep_distinct_designs(self):
        r = result()
        r['schemes'].append(copy.deepcopy(r['schemes'][0]))
        r['schemes'][1]['design']['镜头'] = '俯视远景'
        out = server.parse_output(envelope(r), 2)
        self.assertEqual(out['schemes'][0]['design']['镜头'], '中远景平视')
        self.assertEqual(out['schemes'][1]['design']['镜头'], '俯视远景')
