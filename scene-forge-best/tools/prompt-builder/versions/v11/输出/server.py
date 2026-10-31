#!/usr/bin/env python3
"""Local prompt workspace. Python standard library only; no credentials persisted."""
import argparse
import hashlib
import json
import io
import re
import zipfile
import secrets
import socket
import urllib.error
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
SPEC_PATH = ROOT / 'versions/v8/输出/规范框架v8.md'
PROVIDERS = {'openai':'https://api.openai.com/v1', 'deepseek':'https://api.deepseek.com'}
FIELDS = ('题材','想画什么','必须包含','视觉偏好','画幅','目标模型','数量','创作自由度','负面提示词')
COUNTS = {str(n)+'条':n for n in range(1,11)}
MAX_BODY = 512000
import brief_v2

class AppError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status

def spec():
    try:
        raw = SPEC_PATH.read_bytes()
    except OSError:
        raise AppError('找不到规范 V8 文件，请保留完整项目目录。', 500)
    return raw.decode('utf-8'), {'version':'v8','sha256':hashlib.sha256(raw).hexdigest()}

# Names route requests; actual rules and sources are read from the specification.
TARGET_NAMES = {
    'midjourney': r'(?<![a-z0-9])(?:midjourney|mj)(?![a-z])',
    'openai-image': r'(?<![a-z0-9])(?:openai|gpt[ -]?image)(?![a-z])',
    'flux': r'(?<![a-z0-9])flux(?![a-z])',
    'stable-diffusion': r'(?<![a-z0-9])(?:stable[ -]?diffusion|sdxl|sd)(?![a-z])',
    'imagen': r'(?<![a-z0-9])imagen(?![a-z])',
}
MJ_FLAGS = re.compile(r'(?<!\w)--(?:ar|aspect|v|version|no|s|stylize|sref|sw|sv|q|quality|seed|chaos|c|weird|w|raw|style|tile|iw|oref|ow|cref|cw|niji|p|profile|personalize|draft|repeat|r|stop|fast|relax|turbo|stealth|public|hd|sd)(?=$|[\s=,.:;])', re.I)

def target_adapter(norm, requested):
    try:
        block=re.search(r'<!-- MODEL_ADAPTERS_START -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- MODEL_ADAPTERS_END -->',norm)
        registry=json.loads(block.group(1)) if block else None
        if not isinstance(registry,dict) or registry.get('schemaVersion')!=1:raise ValueError()
        rows=registry['profiles']
        profiles={p['id']:p for p in rows}
        if len(profiles)!=len(rows) or set(profiles)!=set(TARGET_NAMES)|{'generic'}:raise ValueError()
        for p in rows:
            if not all(isinstance(p.get(k),str) for k in ('id','label','scope','checkedAt')):raise ValueError()
            if not isinstance(p.get('rules'),list) or not p['rules'] or not all(isinstance(x,str) and x.strip() for x in p['rules']):raise ValueError()
            if not isinstance(p.get('sources'),list) or (p['id']!='generic' and not p['sources']):raise ValueError()
            for source in p['sources']:
                if not isinstance(source.get('title'),str) or not isinstance(source.get('url'),str) or not source['url'].startswith('https://'):raise ValueError()
    except (KeyError,TypeError,ValueError,AttributeError):
        raise AppError('规范中的目标模型登记缺失或损坏，已停止生成。请使用完整规范 V6。',500)
    matches=[key for key,pattern in TARGET_NAMES.items() if re.search(pattern,requested,re.I)]
    if len(matches)>1:return None
    p=profiles[matches[0] if matches else 'generic']
    notice=('未指定或未登记目标，采用通用自然语言；未核实该模型专用能力。' if p['id']=='generic' else
            '按模型家族规则适配；具体版本、运行平台与参数仍需核实。本次未联网读取来源页面。')
    return {**p,'requested':requested,'notice':notice}

def validate_target_output(out, target):
    if out['status']!='ready' or target['id']=='midjourney':return
    for scheme in out['schemes']:
        for lang in ('zh','en'):
            if MJ_FLAGS.search(scheme[lang]):
                raise AppError('结果混入了 Midjourney 专用参数，与所选目标模型不符；未保存为成功结果，请手动重新生成。',502)

def credentials(data):
    if not isinstance(data, dict):
        raise AppError('请求格式错误。')
    provider, key = data.get('provider'), data.get('key')
    if provider not in PROVIDERS:
        raise AppError('请选择 OpenAI 或 DeepSeek。')
    if not isinstance(key, str) or not key.strip() or len(key)>1024 or any(ord(c)<33 or ord(c)>126 for c in key.strip()):
        raise AppError('请在接口配置中填写有效的 API Key。')
    return provider, key.strip()

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

def upstream(provider, key, path, payload=None):
    request = urllib.request.Request(PROVIDERS[provider]+path,
        data=None if payload is None else json.dumps(payload,ensure_ascii=False).encode(),
        headers={'Authorization':'Bearer '+key,'Content-Type':'application/json','Accept':'application/json'})
    try:
        with urllib.request.build_opener(NoRedirect()).open(request, timeout=180) as response:
            raw = response.read(10_000_001)
            if len(raw)>10_000_000:
                raise AppError('接口返回内容过大，请减少方案数量。',502)
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        e.close()
        messages = {401:'接口认证失败，请检查当前服务商的 API Key。',403:'接口拒绝访问，请检查账户权限和可用地区。',429:'接口限流或余额不足，请检查账户后重试。',404:'未找到模型或接口，请检查模型 ID。',400:'接口不接受此请求，请选择支持 Chat Completions 和 JSON 输出的文本模型。'}
        raise AppError(messages.get(e.code, '上游接口失败（HTTP %s），请稍后手动重试。'%e.code),502)
    except (urllib.error.URLError, TimeoutError, socket.timeout, OSError):
        raise AppError('连接模型服务失败或超时，请检查网络后手动重试；超时请求可能已产生费用。',502)
    except (ValueError, UnicodeError):
        raise AppError('接口没有返回有效 JSON。',502)

def parse_output(data, count):
    try:
        choice=data['choices'][0]
        if choice.get('finish_reason')!='stop':
            raise AppError('模型输出未完整结束，请减少方案数量或检查模型限制后重试。',502)
        text=choice['message']['content']
        if not isinstance(text,str):raise ValueError()
        text=text.strip()
        if text.startswith('```') and text.endswith('```'):
            text=text.split('\n',1)[1].rsplit('```',1)[0]
        output=json.loads(text)
        if not isinstance(output,dict):raise ValueError()
        if output.get('status')=='clarification':
            qs=output.get('questions')
            if not isinstance(qs,list) or not 1<=len(qs)<=5 or not all(isinstance(q,str) and 0<len(q)<=1000 for q in qs):raise ValueError()
            return {'status':'clarification','questions':qs}
        schemes=output.get('schemes')
        if output.get('status')!='ready' or not isinstance(schemes,list) or len(schemes)!=count:
            raise AppError('返回方案数量不符合要求，未保存为成功结果，请重试。',502)
        clean=[]
        for item in schemes:
            if not isinstance(item,dict):raise ValueError()
            for field in ('name','concept','specs','zh','en','config','checks'):
                if not isinstance(item.get(field),str) or not item[field].strip() or len(item[field])>20000:
                    raise AppError('模型未完整提供中英文提示词及方案说明，请重试。',502)
            # Structural language check is deliberately separate from semantic review.
            if not any('\u4e00'<=c<='\u9fff' for c in item['zh']) or not any(c.isascii() and c.isalpha() for c in item['en']):
                raise AppError('返回内容缺少对应语言的提示词，请重试。',502)
            clean.append({k:item[k].strip() for k in ('name','concept','specs','zh','en','config','checks')})
        return {'status':'ready','schemes':clean}
    except (KeyError,IndexError,TypeError,ValueError):
        raise AppError('模型返回格式无法解析，请换用支持 JSON 输出的文本模型或手动重试。',502)

def celestial_direction(topic):
    # Match selected topic tokens, not mentions inside arbitrary user prose.
    names={name.strip() for name in re.split(r'[；;，,、\n]',topic) if name.strip()}
    if not names.intersection({'东方天界幻想','东方天界','东方幻想世界'}):return ''
    return '''【东方天界幻想专属方向】
这是工作台的题材美术方向，只用于东方天界幻想（别名：东方天界、东方幻想世界）。混合题材时仅作用于采用本题材的方案或部分，不把其他题材全部仙境化。
默认仙境感与巨构主导：用东方殿阁、飞檐、山门、仙山等视觉语言构造宏大空间，明确巨构的承托、跨越、悬浮或依山关系；避免只是普通小亭加雾，也不把东方巨构机械替换为西式城堡或科幻摩天楼。结合当前已选内容设计，不固定必须使用某一种建筑、宋代断代或全部候选。
安排前景、中景、远景，通过遮挡、云层分隔、近大远小、重复构件与远景减弱对比表达纵深和垂直落差。镜头按本次场景选择，不固定焦段、画幅、机位、清晨或配色。
人物渺小：出现人物时，以可辨认的小轮廓作为巨构尺度参照，让建筑与山体明显压倒人物尺度；避免人物特写、大半身像或靠脸部细节传达主题。默认人物类型从仙女、多个仙女、男性仙人中按已选内容与方案选配，不要求三类同时出现；多个仙女的人数在未指定时由你设计。明确无人场景保持无人。
仙女服装：本题材中的仙女或多个仙女，默认穿东方古代长袍长裙，完整衣身连接宽大、层叠的裙摆，裙摆垂落地面并向身后拖曳。轻纱仅作外层，披帛仅作配饰，不能替代完整衣裙；不要默认成短裙、现代礼服或仅有飘带的造型，不指定未经要求的历史朝代。男性仙人不套用仙女裙装；无人场景不补人物或衣服。
服装配色：先遵循本次明确选择；未指定时从红色、白色、金色、深绿色中选一种主色，或选择协调的间色组合，例如红白相间、白金相间、深绿配金、红金相间。这些是备选，不默认把全部颜色堆在同一套衣服上。多位仙女可用同一配色系统中的衣裙区分，不要求每人一种颜色；服装颜色不自动变为全场景配色，金色衣裙也不等于金属盔甲。
服装与尺度共同落实：远景仍保持人物渺小，通过长袍长裙的完整轮廓、拖地裙摆与少量色块辨识人物，不为展示服装而拉近成肖像；只写与远景可读性相称的细节。中英文最终提示词均写明本方案实际采用的衣裙形制、拖地长度及配色，不仅写在设计说明中。
具体输入优先：本方向是用户授权的题材默认设计，若本次明确指定肖像、人数、人物身份、服装、颜色、风格或尺度则按具体要求执行，在 concept 简述偏离默认方向的原因；既有硬性要求之间的真实矛盾仍按原规则处理。自定义人物与旧输入不静默删除或改写。
不自动加入未选中的整套元素库，也不把候选变为全部必须。将本方案的巨构与人物相对尺度、空间层次和仙境氛围写入完整 zh/en，双语一致；仅在 concept/specs 解释而最终提示词遗漏不算落实。'''

def topic_direction(topic):
    directions=[celestial_direction(topic)]
    names={name.strip() for name in re.split(r'[；;，,、\n]',topic) if name.strip()}
    if '云上天宫' in names:
        directions.append('''【云上天宫专属方向】
这是独立题材，只作用于“云上天宫”方案；混合题材时，不向未采用云上天宫的其他方案强加这一方向。
空间与对象分开：主场景必须在云海之上，保留东方天界的宏大空间、纵深和仙境感。题材名称不自动指定宫殿、建筑、巨岩、山峰、岩台、石阶或人物；不要因为名字含“天宫”就补一套宫殿与巨岩。若本次明确要求主场景在云海之下等不可兼容的必须项，返回 clarification，不静默改写本次要求。
主体由本次选择决定：先读取采用的 02 核心场景和 03 必须包含，确定具体主体、行为与环境关系。02 只有“叙事场景”等画面类型时，不把它解释为某个内置宫殿场景，也不自动抽取未选候选；03 中的具体对象应进入核心设计，不能预先降为默认宫殿的陪衬。比如只选叙事场景和仙鹤时，围绕仙鹤与云上空间组织画面，不额外添加宫殿、巨岩或仙人；具体动作与数量在用户自由度内设计，方案数不等于对象数量。选了多个具体对象时按实际关系设计主次，不机械要求所有对象都做主角，也不自动把普通仙鹤或灵宠放大成巨兽。
建筑与山石有条件启用：本次所选具体场景、必须包含或明确要求涉及宫殿、建筑、巨岩等对象时，才落实对应对象和结构关系；选了建筑环境时可以设计相应建筑类型，但仍不绑定宫殿加巨岩的固定组合。只有实际采用的建筑或山石才需要解释承托、跨越、悬浮等空间关系，未选这些对象时不补充其结构或尺度。涉及巨构的方案要通过主体自身的体量、轮廓与可见参照表达震撼，而非只放大无关背景；一座主殿可以具有巨构尺度，多个宫殿也不等于宏大。历史候选中的具体宫阙、岩柱、阶道关系只适用于选用它的方案。
宏大而简约：以一个清晰视觉中心和少量必要关系组织画面，依据已选主体用体量差、远近距离、遮挡、云层分隔和明暗层次表达纵深与震撼。主视觉可以来自所选生物、建筑、自然景观或其关系，不能固定为宫殿或巨岩；不要求每张图都有实体建筑巨构。大片云海与天空留白用来衬托本次主体，不靠建筑数量、成群生物或过量装饰填满画面；空间层次不要求补齐前景岩台、中景宫殿、远景孤峰。
人物启用条件：只有 02 所选具体场景、03 必须包含或本次明确要求已经包含人物时，才设计人物；场景标签明确写仙女或仙人也算选中人物。未选人物时，不新增仙女、仙人、人影或人群，不在 zh/en、concept、specs 中补小人物、衣裙、人体参照或人物占比描述；checks 也不添加未启用的人物检查项。“叙事场景”“宏伟”“其余由你设计”、方案数量和单纯的镜头尺度偏好都不构成人物选择，仙鹤等动物名称也不代表选择了仙人。无需为了尺度参照新增人物或门柱，使用本次已有对象之间的距离、体量、遮挡和云层关系即可。明确要求无人时继续保持无人。
人物选中后的尺度：只有人物已启用且本次未明确指定尺度时，以每个可见人物的全身投影高度约占画面高度 1%—3% 为设计目标，结合构图选择具体数值，在两份提示词中一致写明；这是单个人物高度占画面高度，不是面积、人数或画幅比例。人物呈渺小全身轮廓，衬托当前主视觉与空间，不能为衣服和配饰拉近成肖像。主体位于画面上方三分之一只表示位置，不能代替大小占比。未指定镜头时选择能表达当前主体和尺度关系的环境远景或超远景，机位按场景选择。用户明确指定的人物尺度优先，不能把 1%—3% 当成其他题材的全局默认或实际出图保证。
人物选中后的服装：仅对已启用的仙女采用完整古代长袍长裙与拖地裙摆，轻纱和披帛作外搭配饰，远景以衣裙轮廓和少量色块辨识；服装颜色优先按输入，未指定时设计协调配色。男性仙人不套用女装，其他明确身份按本次要求设计。未选人物则跳过本段，不添加服装描述。
配色协调：每个方案选一套主色、辅色与小面积强调色的关系，控制大面积色相数量、饱和度和明度层次。用户明确指定的颜色优先，主体与云海背景保持可辨层次，不固定清晨或金色光。可选配色只是颜色关系，不因配色名称出现石壁、屋面、衣裙等词就补入未选对象；已选具体场景或必须项中的对象仍须保留，真正的硬性冲突才澄清。
双语最终提示词必须同时落实本次实际采用的主体、云海上方的空间关系、主次与尺度、层次、简约构图及配色。开头先建立本次主体与核心关系，再展开必要细节；人物未启用时不写人物相关段落，人物已启用时核对其占比与当前主体的尺度对照。每条一个核心场景，多方案围绕已选对象在结构、动作或空间关系上形成差异，不仅换颜色。具体输入优先，不擅自删除已选对象；checks 只列本次实际采用对象的待出图检查项，不能声称文本已验证图像效果。''')
    return '\n\n'.join(direction for direction in directions if direction)

def generate(data):
    provider,key=credentials(data)
    model=data.get('model')
    if not isinstance(model,str) or not model.strip() or len(model)>200:
        raise AppError('请填写生成提示词所用的文本模型 ID。')
    brief=data.get('brief')
    is_v2=isinstance(brief,dict) and 'schemaVersion' in brief
    if is_v2:
        count=brief_v2.validate(brief,AppError)
    else:
        if not isinstance(brief,dict) or set(brief)!=set(FIELDS):
            raise AppError('请使用页面的九项输入。')
        if not all(isinstance(brief[f],str) and len(brief[f])<=3000 for f in FIELDS):
            raise AppError('每项内容请控制在 3000 字以内。')
        count=COUNTS.get(brief['数量'])
        if count is None:raise AppError('方案数量支持 1 至 10 条。')
        if not brief['题材'].strip() and not brief['想画什么'].strip():
            raise AppError('请至少选择题材或填写想画什么。')
    norm,metadata=spec()
    target=target_adapter(norm,brief['目标模型'])
    if target is None:
        return {'status':'clarification','questions':['目标模型中包含多个模型家族，请选择本次实际用于出图的一个模型，再分别生成其他模型版本。']}
    if is_v2:
        instructions=brief_v2.instructions(brief,count,norm)
    else:
        instructions='''你是文生图提示词设计助手。依据下面的本项目规范完成用户九项需求。
    最终输出必须为 JSON 对象，禁止输出代码围栏和其他前后文字。
    输入分工：02“想画什么”描述画面类型或主体、行为、环境关系；03“必须包含”补充或强调不可遗漏的对象与特征；04“视觉偏好”描述表现方式。02 已明确的主体不需要在 03 再次指定。
    工作台多选语义：02 多选默认是候选范围，不是每条都必须独立成图，也不是每张图必须全部包含；07 数量是最终方案数，两者不要求一一对应。画面类型不机械算作独立场景，例如建筑环境可与车站场景共同描述一条方案。
    先按 03 硬性要求及用户自由度筛选相容候选，再选配所需数量的不同方案。候选多于方案数时可择优选用，不必请求用户再选编号或逐条分组；候选少于方案数时围绕已选内容设计动作、结构、视角或关系差异，不能只换色。只有一个具体场景时围绕该场景展开，不擅自换题。
    每条保持一个清晰核心画面；可自然结合相容内容，不为覆盖候选而把无关场景硬拼在同一张图，也不擅自改成拼贴或分屏。03 必须包含始终是硬性要求，除用户明确限定某方案外，每个方案都须满足；不得把 03 降级为候选。用户明确要求“全部必须体现”“每个各自独立成图”或指定固定组合时，按明确要求执行；不能用默认候选解释静默省略。
    生成前先对齐跨字段对象：重复强调同一主体不自动增加人数或物件数；但不能仅因同名就合并不同对象。用户明确写“另一名”“另外两人”等新增关系时必须保留，明确数量优先于提及次数。不要把“提示词数量”当成人数。
    未填写人数不等于数量冲突。没有锁定的人数、配角身份、服装、镜头和场景组织等，按创作自由度与画面可读性补齐，不要求用户逐项再授权；空项或“其余由你设计”视为开放设计，“仅补齐缺项”也允许补缺，不允许修改明确要求。允许无人场景保持无人。不得把自己补齐的设计说成用户指定。
    仅当明确的硬性数量要求不可兼容，或关键指代歧义无法在用户自由度内消解且会改变明确要求时返回 clarification；不得静默删除要求或改写已指定人数。缺省细节、候选项多于方案数、画面类型与场景并列，本身都不是追问理由。检查中文与英文对齐后的对象数量和关系一致。
    如果必须项存在不可兼容的关键冲突，返回 {"status":"clarification","questions":["需要用户取舍的问题"]}，不要伪造已完成方案。
    其余普通选择按自由度设计，除负面提示词外，空项视为由你设计。不要照搬规范示例的题材、镜头或配色。
    用户负面提示词字段是本次实际排除要求：非空时在 zh 与 en 中完整、语义一致地落实；为空或只有空白时不添加默认负面要求。若与必须项冲突，要求澄清，不擅自删项。根据目标模型转换排除项或使用正向替代表述，不编造负面参数；不要只在 config 中提及而从可复制提示词中遗漏。
    正常返回 {"status":"ready","schemes":[{"name":"方案名称","concept":"中文核心设计与假设","specs":"中文画幅、镜头、主体安排与美术说明","zh":"完整中文最终提示词","en":"同一画面的完整英文最终提示词","config":"中文模型配置说明","checks":"中文差异与待出图验证项"}]}。
    数量是方案数量，每个方案都需要以上七个非空字符串字段，zh 与 en 是同一画面，分别独立可复制。各方案应有实质差异。
    每条 concept 简短说明采用的候选及关键设计假设。首条 concept 同时概括本批次选配依据，并说明未采用候选仅保留在本次输入范围，未在本批次体现；不声称全部已覆盖，也不声称已自动安排后续批次。若全部采用则如实说明，不编造未采用项。候选范围说明不写进可复制的 zh/en 正文。
    你没有联网工具，不得声称已查证最新模型参数。未核实的版本和参数不要编造；在 config 标明待确认，必要画幅在正文体现并提示平台设置。模型配置与中文、英文保持一致。
    先在内部逐项检查中英文对象数量、行为、空间关系、镜头、光色、必须项和约束一致，再返回结果。
    以下是完整规范：\n'''+norm
        instructions+='\n\n本次必须输出 %d 个方案、%d 对完整中英文。按上述工作台候选分配规则组织 02，不把候选项数量当作必须输出数量；只有无法满足明确硬性要求时才澄清。'%(count,count)
        direction=topic_direction(brief['题材'])
        if direction:instructions+='\n\n'+direction
        instructions+='''\n\n【可选字段与场景疏密】
    空项表示相应设计没有额外限制，由你结合已填内容设计，不表示要从元素库随机抽取，也不表示必须补齐人物、建筑、交通、设施等所有分类。03 为空表示无额外必须项，不等于禁止画面中出现对象。题材只限定创作范围，不要求展示该世界的完整系统。
    当采用的 02 场景或 04 视觉偏好明确要求空旷、简约、留白、疏朗或低细节时，以一个清晰视觉中心和少量必要关系组织画面，减少自行添加的配角、生物、建筑、道具、纹饰与光效；不为填满前中远景而增加一套新对象。宏大尺度通过体块、相对尺度和空间距离表达，不靠对象数量堆叠。简约是减少视觉信息，不是仅缩短提示词。
    留白是画面内低细节、低视觉竞争的空间，可由适合当前题材的天空、云海、水面、暗部或平整背景承担；不机械添加这些环境，不等于纯白背景、空白黑边或画布外框，不固定留白百分比。保留必要的空间连续性与主体可读性。无人空景不添加人物，但不因此删除已明确要求的非人物主体。
    02 中空旷简约选项描述场景组织方式，可与相容的具体场景共同构成一条方案，不机械计作额外独立场景。若只在 02 作为多个候选之一，则只约束采用它的方案；04 中未限定方案的简约偏好适用于本批各方案。未选择也未要求简约时，不自动改写为极简场景。
    03 已选对象及明确数量、关系仍是硬要求，题材明确的空间关系仍保留（例如云上天宫的主场景在云海之上），但空间方向不授权新增未选中的建筑、山石或人物。简约不授权删除必须项，也不把元素标签括号内的明确关系悄悄丢弃；先用减少非必要背景和疏朗布局满足偏好，只有明确要求确实不可兼容时才澄清。明确要求繁复或密集时尊重该要求。把本方案实际采用的简约组织、留白区域与必要关系同时落实到完整 zh/en，而非仅在说明中提及。'''
    instructions+='\n\n目标图像模型与当前文本服务无关。只执行下列所选分支，不混用完整规范中的其他家族规则或示例。保留 requested 原值，不能擅自换模型或假装已核实具体版本。config 必须写明适用范围、待确认设置和输入栏使用方式。负面要求的语义保留，但表达形式按分支转换；明确清空时不添加默认。\n本次目标模型适配（仅使用这一分支）：\n'+json.dumps(target,ensure_ascii=False)
    payload={'model':model.strip(),'messages':[{'role':'system','content':instructions},{'role':'user','content':json.dumps(brief,ensure_ascii=False)}],'response_format':{'type':'json_object'},'stream':False}
    out=parse_output(upstream(provider,key,'/chat/completions',payload),count)
    validate_target_output(out,target)
    provenance={k:target[k] for k in ('id','label','requested','scope','checkedAt','sources','notice')}
    out.update({'spec':metadata,'provider':provider,'model':model.strip(),'brief':brief,'target':provenance})
    return out

def export_zip(data):
    files=data.get('files') if isinstance(data,dict) else None
    if not isinstance(files,list) or not 1<=len(files)<=10:
        raise AppError('独立下载支持 1 至 10 个方案。')
    output=io.BytesIO()
    with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as archive:
        for index,item in enumerate(files,1):
            if not isinstance(item,dict) or not isinstance(item.get('name'),str) or not isinstance(item.get('content'),str) or not 0<len(item['content'])<=160000:
                raise AppError('下载内容格式不正确或单份内容过大。')
            name=re.sub(r'[^\w\s.-]','',item['name']).strip(' .')[:60] or '提示词方案'
            archive.writestr('%02d-%s.md'%(index,name),item['content'].encode('utf-8'))
    return output.getvalue()

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass  # Never log headers, request bodies, prompts or provider errors.
    def send(self, status, body, content_type='application/json; charset=utf-8'):
        if isinstance(body,dict):body=json.dumps(body,ensure_ascii=False).encode()
        if isinstance(body,str):body=body.encode()
        self.send_response(status)
        self.send_header('Content-Type',content_type)
        self.send_header('Content-Length',str(len(body)))
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Referrer-Policy','no-referrer')
        self.send_header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
        self.end_headers()
        try:self.wfile.write(body)
        except (BrokenPipeError,ConnectionResetError):pass
    def valid_host(self):
        return self.headers.get('Host')=='127.0.0.1:%d'%self.server.server_port
    def do_GET(self):
        if not self.valid_host():return self.send(403,{'error':'仅支持本机地址访问。'})
        try:
            if self.path=='/api/config':
                _,meta=spec()
                return self.send(200,{'token':self.server.token,'spec':meta,'providers':PROVIDERS})
            if self.path=='/api/spec':return self.send(200,spec()[0],'text/plain; charset=utf-8')
            allowed={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.js':'app.js','/core.mjs':'core.mjs','/ui.mjs':'ui.mjs','/catalog.mjs':'catalog.mjs','/brief-v2.mjs':'brief-v2.mjs','/form-v2.mjs':'form-v2.mjs'}
            mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript'}
            if self.path not in allowed:return self.send(404,{'error':'未找到页面。'})
            p=HERE/allowed[self.path]
            return self.send(200,p.read_bytes(),mime[p.suffix]+'; charset=utf-8')
        except (AppError,OSError) as e:return self.send(500,{'error':str(e) if isinstance(e,AppError) else '页面文件缺失，请保留完整项目。'})
    def do_POST(self):
        origin='http://127.0.0.1:%d'%self.server.server_port
        if not self.valid_host() or self.headers.get('Origin')!=origin or not secrets.compare_digest(self.headers.get('X-Local-Token',''),self.server.token):
            return self.send(403,{'error':'请求来源验证失败，请从本机工作台刷新后操作。'})
        if self.path not in ('/api/generate','/api/models','/api/export'):return self.send(404,{'error':'接口不存在。'})
        try:
            if self.headers.get('Content-Type','').split(';')[0]!='application/json':raise AppError('需要 JSON 请求。',415)
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<=(10_000_000 if self.path=='/api/export' else MAX_BODY):raise AppError('请求过大或为空。',413)
            data=json.loads(self.rfile.read(size))
            if self.path=='/api/export':return self.send(200,export_zip(data),'application/zip')
            if self.path=='/api/models':
                provider,key=credentials(data)
                response=upstream(provider,key,'/models')
                if not isinstance(response,dict) or not isinstance(response.get('data'),list):raise AppError('模型列表格式异常，请手动填写模型 ID。',502)
                models=[m['id'] for m in response['data'] if isinstance(m,dict) and isinstance(m.get('id'),str)]
                return self.send(200,{'models':sorted(models)})
            return self.send(200,generate(data))
        except AppError as e:return self.send(e.status,{'error':str(e)})
        except (ValueError,UnicodeError):return self.send(400,{'error':'请求格式错误。'})
        except Exception:return self.send(500,{'error':'本地服务处理失败，请刷新后重试。'})

def make_server(port):
    http=ThreadingHTTPServer(('127.0.0.1',port),Handler)
    http.token=secrets.token_urlsafe(32)
    http.daemon_threads=True
    return http

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--port',type=int,default=8787)
    parser.add_argument('--open',action='store_true')
    args=parser.parse_args()
    try:server=make_server(args.port)
    except OSError:
        print('端口已占用。请关闭旧工作台窗口对应的终端，或使用 --port 指定其他端口。')
        return
    url='http://127.0.0.1:%d'%server.server_port
    print('提示词工作台：'+url+'\n保持此终端运行；按 Control+C 关闭。',flush=True)
    if args.open:webbrowser.open(url)
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:server.server_close()
if __name__=='__main__':main()
