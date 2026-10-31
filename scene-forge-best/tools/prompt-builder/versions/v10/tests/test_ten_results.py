import unittest,io,zipfile,json
from unittest.mock import patch
from test_server import server,BRIEF,result,envelope

class TenResultsTests(unittest.TestCase):
    def test_all_counts_through_ten_generate_and_wrong_counts_still_fail(self):
        for n in range(1,11):
            brief={**BRIEF,'数量':str(n)+'条'};mock=result();mock['schemes']=[dict(mock['schemes'][0]) for _ in range(n)]
            with patch.object(server,'upstream',return_value=envelope(mock)) as call:
                out=server.generate({'provider':'deepseek','model':'mock','key':'mock','brief':brief})
            self.assertEqual(len(out['schemes']),n)
            self.assertEqual(json.loads(call.call_args.args[3]['messages'][1]['content'])['数量'],str(n)+'条')
        with self.assertRaises(server.AppError):
            server.generate({'provider':'deepseek','model':'mock','key':'mock','brief':{**BRIEF,'数量':'11条'}})
        with self.assertRaises(server.AppError):server.parse_output(envelope(),10)

    def test_ten_individual_markdowns_export_without_loss_and_eleven_rejected(self):
        files=[{'name':'同名方案','content':'中文 %d\nEnglish %d'%(i,i)} for i in range(10)]
        with zipfile.ZipFile(io.BytesIO(server.export_zip({'files':files}))) as z:
            self.assertEqual(len(z.namelist()),10)
            self.assertEqual(len(set(z.namelist())),10)
            self.assertEqual(z.read(z.namelist()[9]).decode(),files[9]['content'])
        with self.assertRaises(server.AppError):server.export_zip({'files':files+[files[0]]})
