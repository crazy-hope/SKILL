"""Browser QA only. No network calls or real credentials. Run on port 8788."""
import json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'输出'))
import server

def fake(provider,key,path,payload=None):
    if path=='/models':return {'data':[{'id':'mock-text-model'}]}
    if key=='mock-error':raise server.AppError('模拟接口失败：请重试。',502)
    brief=json.loads(payload['messages'][1]['content'])
    item={'name':'模拟测试 · 云庭眺望','concept':'用于验证页面数据流的固定样例，不是真实模型生成。','specs':'16:9；侧后方中远景；人物位于左侧三分线；清晨冷灰与局部暖光。','zh':'东方天界幻想，一位仙女立于宋代风格木构殿阁的临崖露台，侧身眺望云海。古松从岩壁探出，远处瀑布穿过云层。侧后方中远景，仙女位于左侧三分线，宽阔云海向右展开。清晨冷灰天光中，一束暖光掠过衣袖与木栏。写实电影感，细腻木纹、岩石和丝绸质感。16:9 横向画面。','en':'An Eastern celestial fantasy: a celestial maiden stands on a cliffside terrace of a Song-dynasty-style timber pavilion, gazing sideways over a sea of clouds. An old pine reaches out from the rock face, and a distant waterfall descends through the clouds. A medium-long shot from slightly behind her side places her on the left third, with the vast cloud sea opening to the right. Cool gray dawn light is accented by a warm beam grazing her sleeve and the wooden railing. Cinematic realism with detailed wood, stone and silk textures. A horizontal 16:9 composition.','config':'模拟测试未核实参数。在出图平台设置 16:9。','checks':'模拟样例仅验证双语展示；真实生成后检查建筑特征、人物与环境关系。'}
    names=['云庭眺望与清晨天光','高架车站与列车进站','雨后夜市与行人穿行','街头机械师维修摩托','城市河道与巡检设备','全息鱼灯与街区巡游','屋顶调度员与无人机','楼体广告与检修平台','地下赛车与维修车间','垂直街区与快递员送货']
    schemes=[]
    for i in range(server.COUNTS[brief['数量']]):
        scheme=dict(item);scheme['name']='模拟测试 %02d · '%(i+1)+names[i]
        scheme['zh']='模拟方案 %d，仅用于交互验证。\n\n'%(i+1)+(item['zh']+'\n\n')*5
        scheme['en']='Mock scheme %d for UI verification only.\n\n'%(i+1)+(item['en']+'\n\n')*5
        schemes.append(scheme)
    out={'status':'ready','schemes':schemes}
    return {'choices':[{'finish_reason':'stop','message':{'content':json.dumps(out,ensure_ascii=False)}}]}
server.upstream=fake
if __name__=='__main__':
    http=server.make_server(8788)
    print('MOCK ONLY http://127.0.0.1:8788',flush=True)
    try:http.serve_forever()
    except KeyboardInterrupt:pass
    finally:http.server_close()
