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
SPEC_PATH = ROOT / 'versions/v9/输出/规范框架v9.md'
PROVIDERS = {'openai':'https://api.openai.com/v1', 'deepseek':'https://api.deepseek.com'}
COUNTS = {str(n)+'条':n for n in range(1,11)}
MAX_BODY = 512000
import brief as brief_contract

class AppError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status

def spec():
    try:
        raw = SPEC_PATH.read_bytes()
    except OSError:
        raise AppError('找不到规范 V9 文件，请保留完整项目目录。', 500)
    return raw.decode('utf-8'), {'version':'v9','sha256':hashlib.sha256(raw).hexdigest()}

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
        raise AppError('规范中的目标模型登记缺失或损坏，已停止生成。请使用完整规范 V9。',500)
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

def generate(data):
    provider,key=credentials(data)
    model=data.get('model')
    if not isinstance(model,str) or not model.strip() or len(model)>200:
        raise AppError('请填写生成提示词所用的文本模型 ID。')
    brief=data.get('brief')
    count=brief_contract.validate(brief,AppError)
    norm,metadata=spec()
    target=target_adapter(norm,brief['目标模型'])
    if target is None:
        return {'status':'clarification','questions':['目标模型中包含多个模型家族，请选择本次实际用于出图的一个模型，再分别生成其他模型版本。']}
    instructions=brief_contract.instructions(brief,count,norm)
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
            name=re.sub(r'[<>:"/\\|?*\x00-\x1f\x7f]','-',item['name']).strip(' .') or '提示词方案'
            name=name.encode('utf-8')[:200].decode('utf-8',errors='ignore').rstrip(' .') or '提示词方案'
            archive.writestr('%s_%02d.md'%(name,index),item['content'].encode('utf-8'))
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
            allowed={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.js':'app.js','/core.mjs':'core.mjs','/ui.mjs':'ui.mjs','/catalog.mjs':'catalog.mjs','/brief.mjs':'brief.mjs','/form.mjs':'form.mjs'}
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
