import sys,json,threading,unittest,http.client
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'输出'))
import server
class HTTPTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.http=server.make_server(0);cls.port=cls.http.server_port
  cls.thread=threading.Thread(target=cls.http.serve_forever,daemon=True);cls.thread.start()
 @classmethod
 def tearDownClass(cls):cls.http.shutdown();cls.http.server_close();cls.thread.join()
 def request(self,path,method='GET',body=None,headers=None):
  conn=http.client.HTTPConnection('127.0.0.1',self.port,timeout=3)
  conn.request(method,path,body=body,headers=headers or {});r=conn.getresponse();out=(r.status,r.read(),dict(r.getheaders()));conn.close();return out
 def headers(self):return {'Origin':f'http://127.0.0.1:{self.port}','X-Local-Token':self.http.token,'Content-Type':'application/json'}
 def test_config_and_dist_only(self):
  status,raw,headers=self.request('/api/config');self.assertEqual(status,200);self.assertEqual(json.loads(raw)['spec']['version'],'v16');self.assertIn('frame-ancestors',headers['Content-Security-Policy'])
  self.assertEqual(self.request('/')[0],200)
  for path in ('/server.py','/defaults.json','/../server.py','/assets/../../server.py','/%2e%2e/server.py'):self.assertEqual(self.request(path)[0],404)
 def test_cross_origin_host_token_and_content_type(self):
  for headers in ({},{**self.headers(),'Origin':'https://evil.invalid'},{**self.headers(),'Host':'evil.invalid'},{**self.headers(),'X-Local-Token':'wrong'}):
   self.assertEqual(self.request('/api/generate','POST','{}',headers)[0],403)
  self.assertEqual(self.request('/api/generate','POST','{}',{**self.headers(),'Content-Type':'text/plain'})[0],415)
  self.assertEqual(self.request('/api/generate','POST','{',self.headers())[0],400)
  self.assertEqual(self.request('/api/concepts','POST','{}',self.headers())[0],404)
 def test_subject_route_and_safe_errors(self):
  with patch.object(server,'run',return_value={'status':'subject','subject':'模拟描述'}) as call:
   status,raw,_=self.request('/api/subject','POST','{}',self.headers());self.assertEqual(status,200);self.assertEqual(json.loads(raw)['status'],'subject');self.assertEqual(call.call_args.args[1],'subject')
  with patch.object(server,'run',side_effect=RuntimeError('private-secret')):
   status,raw,_=self.request('/api/generate','POST','{}',self.headers());self.assertEqual(status,500);self.assertNotIn(b'private-secret',raw)
