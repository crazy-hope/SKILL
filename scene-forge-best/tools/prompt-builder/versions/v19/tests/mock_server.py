"""Local integration fixture; no real model or image generation."""
import sys,json,time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'输出'))
import server
from contract import DEFAULTS

def mock(provider,key,path,payload=None):
 if path=='/models':return {'data':[{'id':'mock-text-model'}]}
 brief=json.loads(payload['messages'][1]['content']);time.sleep(.35)
 if '模拟冲突' in brief['subject']:out={'status':'clarification','questions':['模拟澄清：请统一主体与瞬间状态。']}
 elif '\n当前阶段：subject\n' in payload['messages'][0]['content']:out={'status':'subject','subject':'【模拟主体描述，仅供功能测试】巨型莲池里，一朵乳白莲花下垂的厚软花瓣占据上方，湿润纵纹透出暖白日光。三名年轻古装女子位于花瓣下：左侧女子抬起花瓣，中间女子提起湿润淡青裙摆跨过积水，内侧女子回身伸手。浅粉长纱湿贴在外侧高处的绿色莲茎上；冷青雨幕在外，水滴沿花瓣边缘落下。'}
 else:
  zh='【模拟中文，仅供功能测试】'+brief['style']+'\n\n'+brief['subject']+'\n\n'+brief['color']+brief['camera']+brief['mood']+brief['moment']
  en='[Simulated English for interface testing, not a validated translation.] A cinematic live-action scene under a large ivory lotus petal. Three women in pale cyan wet robes shelter from the rain; one lifts the petal, one steps across a flooded vein, and another reaches back to help. A wet pale-pink scarf clings to a green stem outside. Cool rain light contrasts with soft warm light transmitted through the petal. A low-angle 35mm medium-wide shot, calm and intimate.'
  out={'status':'ready','schemes':[{'title':f'模拟方案 {i+1}','zh':zh,'en':en} for i in range(brief['count'])]}
 return {'choices':[{'finish_reason':'stop','message':{'content':json.dumps(out,ensure_ascii=False)}}]}
server.upstream=mock
if __name__=='__main__':
 http=server.make_server(8797);print('SIMULATED V19 http://127.0.0.1:8797',flush=True)
 try:http.serve_forever()
 finally:http.server_close()
