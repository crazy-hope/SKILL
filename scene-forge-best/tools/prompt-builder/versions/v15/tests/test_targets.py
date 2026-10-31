import unittest,json
from unittest.mock import patch
from test_server import server,BRIEF,envelope,result

class TargetTests(unittest.TestCase):
    def request(self,target,provider='openai',response=None):
        with patch.object(server,'upstream',return_value=envelope(response)) as call:
            out=server.generate({'provider':provider,'model':'text-only-test','key':'secret','brief':{**BRIEF,'目标模型':target}})
        return out,call

    def test_target_is_independent_of_text_provider(self):
        cases=[('Midjourney','midjourney'),('OpenAI 图像模型','openai-image'),('FLUX','flux'),('Stable Diffusion','stable-diffusion'),('Imagen','imagen')]
        for provider in ('openai','deepseek'):
            for target,expected in cases:
                out,call=self.request(target,provider)
                self.assertEqual(out.get('target',{}).get('id'),expected)
                self.assertEqual(out['target']['requested'],target)
                self.assertTrue(out['target']['sources'])
                self.assertEqual(out['target']['checkedAt'],'2026-10-22' if expected=='midjourney' else '2026-10-16')
                system=call.call_args.args[3]['messages'][0]['content']
                self.assertIn(server.spec()[0],system)
                selected=json.loads(system.split('本次目标模型适配（仅使用这一分支）：\n')[1])
                self.assertEqual(selected['id'],expected)
                self.assertTrue(selected['rules'])

    def test_aliases_preserve_explicit_version_without_claiming_verification(self):
        for target,expected in [('MJ v7','midjourney'),('gpt-image-1','openai-image'),('FLUX.2 pro','flux'),('SDXL','stable-diffusion'),('imagen-4.0-generate-001','imagen')]:
            out,_=self.request(target)
            self.assertEqual(out.get('target',{}).get('id'),expected)
            self.assertEqual(out['target']['requested'],target)
            self.assertTrue(out['target']['notice'])

    def test_unknown_or_empty_target_is_generic(self):
        for target in ('','由你设计','My Custom Model','FLUXish','DeepSeek','Gemini'):
            out,_=self.request(target)
            self.assertEqual(out.get('target',{}).get('id'),'generic')
            self.assertEqual(out['target']['sources'],[])

    def test_multiple_targets_clarify_without_paid_request(self):
        out,call=self.request('Midjourney / FLUX')
        self.assertEqual(out['status'],'clarification')
        call.assert_not_called()

    def test_non_mj_parameter_contamination_is_rejected(self):
        for target in ('FLUX','Stable Diffusion','OpenAI 图像模型','Imagen','Custom'):
            for lang in ('zh','en'):
                for flag in ('--ar 16:9','--v 7','--stylize 250','--no watermark','--sref 123'):
                    r=result();r['schemes'][0][lang]+=' '+flag
                    with self.subTest(target=target,lang=lang,flag=flag),self.assertRaises(server.AppError):self.request(target,response=r)
        r=result();r['schemes'][0]['en']+=' --ar 16:9'
        self.assertEqual(self.request('Midjourney',response=r)[0]['status'],'ready')

    def test_broken_spec_registry_fails_before_network(self):
        norm,meta=server.spec()
        # A missing registry must never fall back to stale hardcoded rules.
        with patch.object(server,'spec',return_value=('not a registry',meta)),patch.object(server,'upstream') as call:
            with self.assertRaises(server.AppError):
                server.generate({'provider':'openai','model':'test','key':'test','brief':BRIEF})
            call.assert_not_called()

    def test_generation_uses_rules_from_current_spec_bytes(self):
        norm,meta=server.spec()
        # Change the trusted document fixture, not the request or model response.
        changed=norm.replace('以主体、动作、风格、环境关系组织自然语言','测试文档中的独立规则 ABC123')
        with patch.object(server,'spec',return_value=(changed,meta)):
            out,call=self.request('FLUX')
        selected=json.loads(call.call_args.args[3]['messages'][0]['content'].split('本次目标模型适配（仅使用这一分支）：\n')[1])
        self.assertIn('ABC123',selected['rules'][0])

    def test_model_specific_rules_are_in_selected_branch(self):
        for target,phrase in [('FLUX','正向'),('Stable Diffusion','负向'),('Imagen','imagen-3.0-generate-002'),('OpenAI 图像模型','自然语言'),('Midjourney','--ar')]:
            _,call=self.request(target)
            instruction=call.call_args.args[3]['messages'][0]['content']
            self.assertIn('本次目标模型适配（仅使用这一分支）：\n',instruction)
            self.assertIn(phrase,instruction.split('本次目标模型适配（仅使用这一分支）：\n')[-1])
