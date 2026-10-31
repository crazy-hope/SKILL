import unittest,sys,hashlib,json
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'输出'))
import server
from test_server import envelope,BRIEF

class ReactIntegrationTests(unittest.TestCase):
    def test_v13_full_spec_and_hash_are_sent_and_recorded(self):
        text,meta=server.spec()
        self.assertEqual(meta['version'],'v13')
        self.assertEqual(meta['sha256'],hashlib.sha256(text.encode()).hexdigest())
        for provider in ('openai','deepseek'):
            with patch.object(server,'upstream',return_value=envelope()) as call:
                out=server.generate({'provider':provider,'key':'mock-key','model':'mock-model','brief':BRIEF})
                instructions=call.call_args.args[3]['messages'][0]['content']
                self.assertIn(text,instructions)
                self.assertIn('关键关系必须落到正文',instructions)
                self.assertEqual(out['spec'],meta)
    def test_static_paths_only_expose_built_assets(self):
        self.assertEqual(server.static_path('/').name,'index.html')
        self.assertEqual(server.static_path('/assets/index-abc.js').name,'index-abc.js')
        for path in ['/server.py','/../server.py','/assets/../../server.py','/assets/%2e%2e/server.py','/src/main.jsx','/package.json']:
            self.assertIsNone(server.static_path(path),path)
