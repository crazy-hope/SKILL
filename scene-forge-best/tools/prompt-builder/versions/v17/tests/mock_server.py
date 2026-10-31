"""Browser QA only. No network calls or real credentials. Run on port 8795."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / '输出'))
import server
from review_fixture import fake_review


def envelope(output):
    return {'choices': [{'finish_reason': 'stop', 'message': {'content': json.dumps(output, ensure_ascii=False)}}]}


def fake(provider, key, path, payload=None):
    if path == '/models':
        return {'data': [{'id': 'mock-text-model'}]}
    if key == 'mock-error':
        raise server.AppError('模拟接口失败：请重试。', 502)
    if key == 'mock-clarification':
        return envelope({'status': 'clarification', 'questions': ['模拟澄清：请确认要保留的核心关系。']})
    if key == 'mock-invalid':
        return envelope({'status': 'concepts', 'concepts': []})
    if '[TEXT_REVIEW_STAGE]' in payload['messages'][0]['content']:
        data = json.loads(payload['messages'][1]['content'])
        review = fake_review(data['schemes'])
        if key == 'mock-review-fail':
            review['reviews'][0]['checks']['elements'].update(status='fail',reason='模拟审校拒绝：元素缺少材质状态与颜色。')
        return envelope(review)
    brief = json.loads(payload['messages'][1]['content'])
    core = brief['scene']['core'] or brief['题材'] or '自定义场景'
    if '【短构思阶段：只提供候选】' in payload['messages'][0]['content']:
        # Explicit simulated fixtures only; this does not demonstrate creative quality.
        ideas = [
            {'title': '模拟构思 · 低处庇护', 'summary': '模拟短构思：围绕'+core[:100]+'观察下方遮蔽空间。',
             'relationship': '上方结构遮蔽下方开口，让边缘透入的光形成明暗边界。', 'variation': '低位视点，强调上下包覆关系。'},
            {'title': '模拟构思 · 交错通路', 'summary': '模拟短构思：在'+core[:100]+'中保留一条连续通路。',
             'relationship': '近处对象分开形成通道，开口引向远处背景。', 'variation': '强调穿行路径与纵深，不增添默认人物。'},
            {'title': '模拟构思 · 悬停承托', 'summary': '模拟短构思：在'+core[:100]+'中观察相互承托的轮廓。',
             'relationship': '上方对象接触下方支点，以留白显出承托关系。', 'variation': '侧面视点，强调接触点和悬空距离。'}
        ]
        return envelope({'status': 'concepts', 'concepts': ideas})
    selected = brief['scene']['selected']
    schemes = []
    for index in range(server.COUNTS[brief['数量']]):
        schemes.append({
            'name': '模拟测试 %02d · %s' % (index + 1, selected['title']),
            'concept': '模拟展开，保留选中构思：'+selected['summary']+' 关键关系：'+selected['relationship'],
            'specs': '模拟交互样例；画幅 '+(brief['画幅'] or '自动设计')+'；侧面视点。',
            'zh': '模拟方案 %d，仅用于交互验证，并非真实模型提示词。核心场景：%s。选中画面：%s 关键关系：%s 差异方向：%s。' % (index+1, core, selected['summary'], selected['relationship'], selected['variation']),
            'en': 'Mock scheme %d for UI verification only, not real model output. Expand the selected scene while retaining its core subject and relationship. Source scene: %s. Selected idea: %s. Key relationship: %s. Variation: %s.' % (index+1, core, selected['summary'], selected['relationship'], selected['variation']),
            'config': '模拟响应未验证目标模型参数或图像效果。',
            'checks': '模拟仅检查两阶段数据流，真实双语语义和图像效果待验证。',
            'design': {'题材': brief['题材'] or core, '地域': brief.get('地域') or '模拟不额外限定地域',
                       '元素': '模拟采用选中构思中的对象：'+selected['relationship'],
                       '视觉偏好': '模拟中性漫射光与柔和阴影', '镜头': '模拟侧面中景',
                       '风格与复杂度': '模拟简洁写实结构', '构图': '模拟围绕选中关系组织主体与背景'}
        })
    return envelope({'status': 'ready', 'schemes': schemes})


if __name__ == '__main__':
    server.upstream = fake
    http = server.make_server(8795)
    print('MOCK ONLY http://127.0.0.1:8795', flush=True)
    try:
        http.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        http.server_close()
