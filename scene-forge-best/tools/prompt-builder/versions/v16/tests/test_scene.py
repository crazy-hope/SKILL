"""Scene workflow: strict inputs, concepts, and selected-concept generation."""
import copy
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / '输出'))
import server


def concept(title='叶下水纹', summary='田野荷塘中，低垂荷叶在水面投下阴影。', relationship='荷叶覆盖近处水面，水纹从叶缘向外展开。', variation='以低位观察叶下空间和水纹。'):
    return dict(title=title, summary=summary, relationship=relationship, variation=variation)


def scene(selected=None):
    return dict(core='', backdrop='', direction='', keep='', change='', selected=selected)


def draft(selected=None):
    value = dict.fromkeys(server.brief_contract.FIELDS, '')
    value.update(schemaVersion=5, elementSettings=[], designOptions={'exploration': '自动设计'}, scene=scene(selected))
    value.update({'数量': '1条', '目标模型': 'Midjourney'})
    value['scene']['core'] = '田野荷塘'
    return value


def concept_result():
    return {'status': 'concepts', 'concepts': [
        concept(),
        concept('叶面承露', '荷叶表面承托一滴清露。', '露珠压住叶片低点，叶脉向四周展开。', '由上向下观察叶面凹陷。'),
        concept('荷间水路', '连片荷叶之间留出一条弯曲水路。', '水路穿过交错叶片，开口通向田野。', '让水路引导纵深。')
    ]}


def envelope(output, finish='stop'):
    return {'choices': [{'finish_reason': finish, 'message': {'content': json.dumps(output, ensure_ascii=False)}}]}


def request(brief, provider='openai'):
    return dict(provider=provider, model='mock-text', key='mock-secret', brief=brief)


class SceneContractTests(unittest.TestCase):
    def test_scene_only_and_selected_survive_validation(self):
        for selected in (None, concept()):
            brief = draft(selected)
            original = copy.deepcopy(brief)
            self.assertEqual(server.brief_contract.validate(brief, server.AppError), 1)
            self.assertEqual(brief, original)

    def test_scene_requires_exact_shape_nonempty_selected_fields_and_bounded_strings(self):
        bad_scenes = [None, {}, {**scene(), 'other': ''}, {**scene(), 'core': None},
                      {**scene(), 'keep': 'x' * 1001}, {**scene(), 'selected': {}},
                      {**scene(), 'selected': {**concept(), 'extra': 'value'}},
                      {**scene(), 'selected': {**concept(), 'title': '   '}},
                      {**scene(), 'selected': {**concept(), 'summary': 'x' * 1001}}]
        for value in bad_scenes:
            with self.subTest(value=value):
                brief = draft(); brief['scene'] = value
                with self.assertRaises(server.AppError):
                    server.brief_contract.validate(brief, server.AppError)
        for version in (3, 4, True, 5.0):
            brief = draft(); brief['schemaVersion'] = version
            with self.assertRaises(server.AppError): server.brief_contract.validate(brief, server.AppError)

    def test_unselected_final_request_is_rejected_before_network(self):
        with patch.object(server, 'upstream') as upstream:
            with self.assertRaisesRegex(server.AppError, '选择.*构思'):
                server.generate(request(draft()))
            upstream.assert_not_called()


class ConceptTests(unittest.TestCase):
    def parse(self, output, finish='stop'):
        self.assertTrue(callable(getattr(server, 'parse_concepts', None)), 'Concept parser must validate upstream output')
        return server.parse_concepts(envelope(output, finish))

    def test_three_distinct_concepts_are_parsed(self):
        self.assertEqual(self.parse(concept_result()), concept_result())

    def test_count_duplicate_unknown_keys_and_blank_fields_are_rejected(self):
        invalid = [dict(status='ready', concepts=concept_result()['concepts']),
                   dict(status='concepts', concepts=concept_result()['concepts'][:2]),
                   dict(status='concepts', concepts=[concept(), concept(), concept()])]
        for changes in ({'title': ''}, {'summary': 'x' * 1001}, {'variation': None}, {'extra': 'invented'}):
            value = concept_result(); value['concepts'][0].update(changes); invalid.append(value)
        invalid.append({**concept_result(), 'schemes': []})
        value=concept_result(); value['concepts'][1]={k:' '+v+' ' for k,v in value['concepts'][0].items()}; invalid.append(value)
        for value in invalid:
            with self.subTest(value=value), self.assertRaises(server.AppError): self.parse(value)
        with self.assertRaises(server.AppError): self.parse(concept_result(), 'length')

    def test_clarification_is_preserved_but_blank_questions_are_rejected(self):
        value = {'status': 'clarification', 'questions': ['必须项冲突，请选择。']}
        self.assertEqual(self.parse(value), value)
        with self.assertRaises(server.AppError): self.parse({'status': 'clarification', 'questions': [' ']})

    def test_both_providers_get_all_constraints_and_complete_spec_for_concepts(self):
        self.assertTrue(callable(getattr(server, 'concepts', None)), 'Concept request handler is required')
        for provider in ('openai', 'deepseek'):
            brief = draft(); brief.update({'题材': '东方奇幻', '大致说明': '无人', '负面提示词': ''})
            brief['scene'].update(backdrop='远处田野', keep='保留水路', change='允许变化视点')
            with patch.object(server, 'upstream', return_value=envelope(concept_result())) as call:
                out = server.concepts(request(brief, provider))
            payload = call.call_args.args[3]
            system = payload['messages'][0]['content']
            self.assertEqual(json.loads(payload['messages'][1]['content']), brief)
            self.assertIn(server.spec()[0], system)
            self.assertIn('"status":"concepts"', system)
            self.assertNotIn('正常返回 {"status":"ready"', system)
            self.assertNotIn('config 必须写明', system)
            self.assertNotIn('mock-secret', json.dumps(out, ensure_ascii=False))
            self.assertEqual(out['concepts'], concept_result()['concepts'])
            self.assertEqual(out['brief'], brief)
            self.assertEqual(out['spec']['version'], 'v14')
            self.assertEqual(out['provider'], provider)

    def test_concept_invalid_inputs_and_upstream_failures_cannot_become_success(self):
        for value in (None, {}, {**scene(), 'selected': {'title': 'only title'}}):
            brief = draft(); brief['scene'] = value
            with patch.object(server, 'upstream') as call:
                with self.assertRaises(server.AppError): server.concepts(request(brief))
                call.assert_not_called()
        with patch.object(server, 'upstream', side_effect=server.AppError('模拟上游失败', 502)):
            with self.assertRaisesRegex(server.AppError, '模拟上游失败'):
                server.concepts(request(draft()))

    def test_malformed_and_truncated_concepts_never_escape_as_success(self):
        for value in ([], {}, {'choices': None}, {'choices': [None]},
                      {'choices': [{'finish_reason': 'stop', 'message': {'content': 'not JSON'}}]}):
            with self.subTest(value=value), self.assertRaises(server.AppError): server.parse_concepts(value)

    def test_selected_concept_anchors_final_output_not_another_round_of_ideas(self):
        from test_server import result
        brief = draft(concept())
        with patch.object(server, 'upstream', return_value=envelope(result())) as call:
            out = server.generate(request(brief))
        payload = call.call_args.args[3]
        self.assertEqual(json.loads(payload['messages'][1]['content'])['scene']['selected'], concept())
        self.assertIn('scene.selected', payload['messages'][0]['content'])
        self.assertNotIn('多方案在未锁定的概念、不同主体', payload['messages'][0]['content'])
        self.assertEqual(out['brief']['scene']['selected'], concept())
        self.assertEqual(out['status'], 'ready')

    def test_concept_target_family_conflict_does_not_call_upstream(self):
        self.assertTrue(callable(getattr(server, 'concepts', None)), 'Concept request handler is required')
        brief = draft(); brief['目标模型'] = 'Midjourney 或 FLUX'
        with patch.object(server, 'upstream') as call:
            out = server.concepts(request(brief))
        self.assertEqual(out['status'], 'clarification')
        call.assert_not_called()


class MockWorkflowTests(unittest.TestCase):
    def test_browser_mock_both_stages_preserve_selected_and_provenance(self):
        from mock_server import fake
        for provider in ('openai', 'deepseek'):
            brief = draft(); brief['数量'] = '10条'
            with patch.object(server, 'upstream', side_effect=fake):
                ideas = server.concepts(request(brief, provider))
                self.assertEqual(len(ideas['concepts']), 3)
                self.assertTrue(all('模拟' in idea['title'] for idea in ideas['concepts']))
                brief['scene']['selected'] = ideas['concepts'][1]
                generated = server.generate(request(brief, provider))
            self.assertEqual(len(generated['schemes']), 10)
            self.assertEqual(generated['brief']['scene']['selected'], ideas['concepts'][1])
            self.assertEqual(generated['spec'], ideas['spec'])
            self.assertTrue(all('模拟' in item['name'] and 'Mock' in item['en'] for item in generated['schemes']))


if __name__ == '__main__': unittest.main()
