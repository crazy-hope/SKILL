from review_fixture import reviewed_upstream
import sys,json,unittest,threading,urllib.request,urllib.error,io,zipfile
from pathlib import Path
from unittest.mock import patch, MagicMock
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'输出'))
import server

from test_design import brief
BRIEF=brief()
BRIEF['大致说明']='仙女眺望'
def result():
    return {'status':'ready','schemes':[{'name':'云上眺望','concept':'仙女在古松旁眺望云海','specs':'16:9','zh':'仙女在古松旁眺望云海，清晨冷灰光。','en':'A celestial maiden gazes across a sea of clouds beside an old pine, cool gray dawn light.','config':'参数未核实，请在平台选择 16:9。','checks':'检查宋代建筑特征','design':{'题材':'东方天界幻想','地域':'东方文化视觉','元素':'一位仙女、古松、云海','视觉偏好':'清晨冷灰光','镜头':'中远景平视','风格与复杂度':'写实、疏朗','构图':'仙女立于古松旁，云海向远处展开'}}]}
def envelope(content=None,finish='stop'):
    return {'choices':[{'finish_reason':finish,'message':{'content':json.dumps(content or result(),ensure_ascii=False)}}]}
class ServerTests(unittest.TestCase):
    def test_negative_input_reaches_both_providers_unchanged(self):
        for provider in ('openai','deepseek'):
            for negative in ('不要有水印，不要有logo，不要有变形，不要有空白黑边','不要文字',''):
                brief={**BRIEF,'负面提示词':negative}
                with patch.object(server,'upstream',side_effect=reviewed_upstream(envelope())) as call:
                    out=server.generate({'provider':provider,'model':'test-chat','key':'test','brief':brief})
                    self.assertEqual(json.loads(call.call_args_list[0].args[3]['messages'][1]['content'])['负面提示词'],negative)
                    self.assertEqual(out['brief']['负面提示词'],negative)
    def test_invalid_negative_input_rejected_before_network(self):
        for value in (None,[],123,'x'*3001):
            with patch.object(server,'upstream') as call:
                with self.assertRaises(server.AppError):
                    server.generate({'provider':'openai','model':'test','key':'test','brief':{**BRIEF,'负面提示词':value}})
                call.assert_not_called()
    def test_both_providers_read_full_spec(self):
        for provider in ('openai','deepseek'):
            with patch.object(server,'upstream',side_effect=reviewed_upstream(envelope())) as call:
                out=server.generate({'provider':provider,'model':'test-chat','key':'test-secret','brief':BRIEF})
                args=call.call_args_list[0].args
                self.assertEqual(args[0],provider)
                self.assertIn(server.spec()[0],args[3]['messages'][0]['content'])
                self.assertIn('仙女眺望',args[3]['messages'][1]['content'])
                self.assertNotIn('test-secret',json.dumps(args[3]))
                self.assertEqual(out['spec']['version'],'v15')
                self.assertEqual(len(out['schemes']),1)
    def test_missing_language_rejected(self):
        r=result();r['schemes'][0]['en']=''
        with self.assertRaises(server.AppError):server.parse_output(envelope(r),1)
    def test_wrong_count_rejected(self):
        with self.assertRaises(server.AppError):server.parse_output(envelope(),2)
    def test_truncation_rejected(self):
        with self.assertRaises(server.AppError):server.parse_output(envelope(finish='length'),1)
    def test_clarification_is_not_success(self):
        r={'status':'clarification','questions':['必须保留的元素互相冲突，请选择优先项。']}
        self.assertEqual(server.parse_output(envelope(r),1)['status'],'clarification')
    def test_malformed_response_rejected(self):
        for value in ([],{}, {'choices':None}, {'choices':[{'message':{'content':'hello'}}]}):
            with self.subTest(value=value),self.assertRaises(server.AppError):server.parse_output(value,1)
    def test_unknown_provider_and_bad_count(self):
        for change in ({'provider':'other'},{'brief':{**BRIEF,'数量':'999条'}},{'key':''}):
            with self.assertRaises(server.AppError):server.generate({**{'provider':'openai','model':'test','key':'test','brief':BRIEF},**change})

class UpstreamTests(unittest.TestCase):
    def test_provider_url_auth_and_json_wire_format(self):
        for provider,url in server.PROVIDERS.items():
            opener=MagicMock();opener.open.return_value.__enter__.return_value.read.return_value=b'{"ok": true}'
            with patch.object(server.urllib.request,'build_opener',return_value=opener):
                self.assertEqual(server.upstream(provider,'test-key','/chat/completions',{'model':'mock'}),{'ok':True})
            request=opener.open.call_args.args[0]
            self.assertEqual(request.full_url,url+'/chat/completions')
            self.assertEqual(request.get_header('Authorization'),'Bearer test-key')
            self.assertEqual(json.loads(request.data),{'model':'mock'})
    def test_http_error_body_not_exposed(self):
        import io
        error=urllib.error.HTTPError('https://example.invalid',401,'secret-do-not-leak',{},io.BytesIO(b'secret-do-not-leak'))
        opener=MagicMock();opener.open.side_effect=error
        with patch.object(server.urllib.request,'build_opener',return_value=opener):
            with self.assertRaises(server.AppError) as caught:server.upstream('openai','test-key','/models')
        self.assertIn('认证失败',str(caught.exception))
        self.assertNotIn('secret-do-not-leak',str(caught.exception))

class ExportTests(unittest.TestCase):
    def test_zip_contains_each_bilingual_markdown_and_safe_unique_names(self):
        files=[{'name':'../云庭/测试','content':'中文提示词\n仙女\nEnglish Prompt\nCelestial maiden'}]*3
        raw=server.export_zip({'files':files})
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            self.assertEqual(len(z.namelist()),3)
            self.assertEqual(len(set(z.namelist())),3)
            for name in z.namelist():
                self.assertNotIn('/',name);self.assertTrue(name.endswith('.md'))
                self.assertEqual(z.read(name).decode(),files[0]['content'])
    def test_invalid_export_rejected(self):
        for data in ({'files':[]},{'files':[{}]}, {'files':[{'name':'test','content':'x'}]*11}):
            with self.assertRaises(server.AppError):server.export_zip(data)

class HttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.http=server.make_server(0);cls.port=cls.http.server_port
        cls.thread=threading.Thread(target=cls.http.serve_forever,daemon=True);cls.thread.start()
        cls.url=f'http://127.0.0.1:{cls.port}'
    @classmethod
    def tearDownClass(cls):cls.http.shutdown();cls.http.server_close();cls.thread.join()
    def post(self,body,origin=None,token=True,path='/api/generate'):
        headers={'Content-Type':'application/json','Origin':origin or self.url}
        if token:headers['X-Local-Token']=self.http.token
        return urllib.request.urlopen(urllib.request.Request(self.url+path,json.dumps(body).encode(),headers),timeout=5)
    def test_static_and_config(self):
        with urllib.request.urlopen(self.url+'/api/config') as r:
            data=json.load(r);self.assertEqual(data['spec']['version'],'v15');self.assertTrue(data['token'])
        with urllib.request.urlopen(self.url+'/') as r:self.assertEqual(r.status,200)
        assets=list((server.HERE/'dist/assets').glob('*'))
        self.assertTrue(assets)
        for asset in assets:
            with urllib.request.urlopen(self.url+'/assets/'+asset.name) as r:self.assertEqual(r.status,200)
        for resource in ('/server.py','/brief.mjs','/src/App.jsx','/package.json'):
            with self.assertRaises(urllib.error.HTTPError) as error:urllib.request.urlopen(self.url+resource)
            self.assertEqual(error.exception.code,404)
    def test_cross_origin_rejected(self):
        with self.assertRaises(urllib.error.HTTPError) as e:self.post({},origin='https://evil.example')
        self.assertEqual(e.exception.code,403)
    def test_missing_token_rejected(self):
        with self.assertRaises(urllib.error.HTTPError) as e:self.post({},token=False)
        self.assertEqual(e.exception.code,403)
    def test_zip_http_route(self):
        with self.post({'files':[{'name':'方案','content':'中文 English'}]},path='/api/export') as r:
            self.assertEqual(r.headers['Content-Type'],'application/zip')
            with zipfile.ZipFile(io.BytesIO(r.read())) as z:self.assertEqual(len(z.namelist()),1)
    def test_private_file_unavailable(self):
        with self.assertRaises(urllib.error.HTTPError) as e:urllib.request.urlopen(self.url+'/../../AGENTS.md')
        self.assertEqual(e.exception.code,404)
    def test_http_concepts_then_selected_generation(self):
        from test_scene import draft, concept_result, envelope as concept_envelope
        b=draft()
        with patch.object(server,'upstream',return_value=concept_envelope(concept_result())):
            with self.post({'provider':'openai','model':'mock','key':'mock','brief':b},path='/api/concepts') as response:
                ideas=json.load(response)
        self.assertEqual(ideas['status'],'concepts')
        self.assertEqual(len(ideas['concepts']),3)
        b['scene']['selected']=ideas['concepts'][0]
        with patch.object(server,'upstream',side_effect=reviewed_upstream(envelope())):
            with self.post({'provider':'deepseek','model':'mock','key':'mock','brief':b}) as response:
                generated=json.load(response)
        self.assertEqual(generated['brief']['scene']['selected'],ideas['concepts'][0])
        self.assertEqual(generated['status'],'ready')
    def test_http_concepts_uses_same_origin_token_guards(self):
        for headers in ({'origin':'https://evil.example'},{'token':False}):
            with self.assertRaises(urllib.error.HTTPError) as error:self.post({},path='/api/concepts',**headers)
            self.assertEqual(error.exception.code,403)
    def test_http_mock_generation(self):
        with patch.object(server,'upstream',side_effect=reviewed_upstream(envelope())):
            with self.post({'provider':'deepseek','model':'mock','key':'mock-key','brief':BRIEF}) as r:
                value=json.load(r);self.assertEqual(value['schemes'][0]['name'],'云上眺望')
    def test_http_current_ten_schemes_preserves_element_settings(self):
        from test_design import brief
        b=brief();b['数量']='10条';r=result();r['schemes']*=10
        with patch.object(server,'upstream',side_effect=reviewed_upstream(envelope(r))):
            with self.post({'provider':'openai','model':'mock','key':'mock','brief':b}) as response:
                value=json.load(response)
                self.assertEqual(len(value['schemes']),10)
                self.assertEqual(value['brief'],b)
                self.assertEqual(value['spec']['sha256'],server.spec()[1]['sha256'])
    def test_bad_credentials_do_not_leak(self):
        with patch.object(server,'upstream',side_effect=server.AppError('接口认证失败，请检查 API Key。',502)):
            with self.assertRaises(urllib.error.HTTPError) as e:self.post({'provider':'openai','model':'mock','key':'secret-do-not-leak','brief':BRIEF})
            self.assertNotIn('secret-do-not-leak',e.exception.read().decode())

if __name__=='__main__':unittest.main()
