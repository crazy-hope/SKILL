#!/usr/bin/env python3
"""Local prompt workspace. Python standard library only; no credentials persisted."""
import argparse
import hashlib
import json
import secrets
import socket
import urllib.error
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
SPEC_PATH = ROOT / 'versions/v4/输出/规范框架v4.md'
PROVIDERS = {'openai':'https://api.openai.com/v1', 'deepseek':'https://api.deepseek.com'}
FIELDS = ('题材','想画什么','必须包含','视觉偏好','画幅','目标模型','数量','创作自由度')
COUNTS = {'1条':1, '2条':2, '3条':3, '5条':5}
MAX_BODY = 48000

class AppError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status

def spec():
    try:
        raw = SPEC_PATH.read_bytes()
    except OSError:
        raise AppError('找不到规范 V4 文件，请保留完整项目目录。', 500)
    return raw.decode('utf-8'), {'version':'v4','sha256':hashlib.sha256(raw).hexdigest()}

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
            raw = response.read(2_000_001)
            if len(raw)>2_000_000:
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
    if not isinstance(brief,dict) or set(brief)!=set(FIELDS):
        raise AppError('请使用页面的八项输入。')
    if not all(isinstance(brief[f],str) and len(brief[f])<=3000 for f in FIELDS):
        raise AppError('每项内容请控制在 3000 字以内。')
    count=COUNTS.get(brief['数量'])
    if count is None:raise AppError('方案数量支持 1、2、3 或 5 条。')
    if not brief['题材'].strip() and not brief['想画什么'].strip():
        raise AppError('请至少选择题材或填写想画什么。')
    norm,metadata=spec()
    instructions='''你是文生图提示词设计助手。依据下面的本项目规范完成用户八项需求。
最终输出必须为 JSON 对象，禁止输出代码围栏和其他前后文字。
如果必须项存在不可兼容的关键冲突，返回 {"status":"clarification","questions":["需要用户取舍的问题"]}，不要伪造已完成方案。
其余普通选择按自由度设计，空项视为由你设计。不要照搬规范示例的题材、镜头或配色。
正常返回 {"status":"ready","schemes":[{"name":"方案名称","concept":"中文核心设计与假设","specs":"中文画幅、镜头、主体安排与美术说明","zh":"完整中文最终提示词","en":"同一画面的完整英文最终提示词","config":"中文模型配置说明","checks":"中文差异与待出图验证项"}]}。
数量是方案数量，每个方案都需要以上七个非空字符串字段，zh 与 en 是同一画面，分别独立可复制。各方案应有实质差异。
你没有联网工具，不得声称已查证最新模型参数。未核实的版本和参数不要编造；在 config 标明待确认，必要画幅在正文体现并提示平台设置。模型配置与中文、英文保持一致。
先在内部逐项检查中英文对象数量、行为、空间关系、镜头、光色、必须项和约束一致，再返回结果。
以下是完整规范：\n'''+norm
    payload={'model':model.strip(),'messages':[{'role':'system','content':instructions},{'role':'user','content':json.dumps(brief,ensure_ascii=False)}],'response_format':{'type':'json_object'},'stream':False}
    out=parse_output(upstream(provider,key,'/chat/completions',payload),count)
    out.update({'spec':metadata,'provider':provider,'model':model.strip(),'brief':brief})
    return out

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
            allowed={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.js':'app.js','/core.mjs':'core.mjs'}
            mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript'}
            if self.path not in allowed:return self.send(404,{'error':'未找到页面。'})
            p=HERE/allowed[self.path]
            return self.send(200,p.read_bytes(),mime[p.suffix]+'; charset=utf-8')
        except (AppError,OSError) as e:return self.send(500,{'error':str(e) if isinstance(e,AppError) else '页面文件缺失，请保留完整项目。'})
    def do_POST(self):
        origin='http://127.0.0.1:%d'%self.server.server_port
        if not self.valid_host() or self.headers.get('Origin')!=origin or not secrets.compare_digest(self.headers.get('X-Local-Token',''),self.server.token):
            return self.send(403,{'error':'请求来源验证失败，请从本机工作台刷新后操作。'})
        if self.path not in ('/api/generate','/api/models'):return self.send(404,{'error':'接口不存在。'})
        try:
            if self.headers.get('Content-Type','').split(';')[0]!='application/json':raise AppError('需要 JSON 请求。',415)
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<=MAX_BODY:raise AppError('请求过大或为空。',413)
            data=json.loads(self.rfile.read(size))
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
