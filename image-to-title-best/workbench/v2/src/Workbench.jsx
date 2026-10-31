import React, { useEffect, useRef, useState } from 'react';
import { Alert, App, Button, Collapse, Image as AntImage, Input, Modal, Segmented, Select, Skeleton, Tag, Tooltip, Upload } from 'antd';
import { MAX_IMAGES, prepareImageBatch } from '../shared/images.mjs';
import { ArrowDownOutlined, ArrowRightOutlined, CheckCircleFilled, CheckOutlined, CopyOutlined, DownloadOutlined, FileImageOutlined, GlobalOutlined, InfoCircleOutlined, LoadingOutlined, PictureOutlined, ReloadOutlined, SettingOutlined, StarFilled, ThunderboltOutlined, UploadOutlined, CloseOutlined, EyeOutlined } from '@ant-design/icons';

const PRESETS = {
  openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4.1-mini' },
  deepseek: { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash' },
  custom: { label: '兼容接口', baseUrl: '', model: '' },
};
const STORE = 'image-to-title:settings:v1';
const defaultSettings = { provider: 'openai', baseUrl: PRESETS.openai.baseUrl, model: PRESETS.openai.model };

function readSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE));
    if (!saved || !PRESETS[saved.provider]) return defaultSettings;
    return { provider: saved.provider, baseUrl: typeof saved.baseUrl === 'string' ? saved.baseUrl : PRESETS[saved.provider].baseUrl, model: typeof saved.model === 'string' ? saved.model : PRESETS[saved.provider].model };
  } catch { return defaultSettings; }
}

function resultText(result, language = 'both') {
  const sections = result.candidates.map(c => {
    const lines = [`方案 ${c.id}｜${c.angle}${c.id === result.recommendation.candidate_id ? ' ★ 推荐' : ''}`];
    if (language !== 'en') lines.push(c.zh.title, c.zh.description);
    if (language !== 'zh') lines.push(c.en.title, c.en.description);
    return lines.join('\n\n');
  });
  return [`画面：${result.analysis.visual_summary}`, `意境：${result.analysis.mood}`, ...sections, `推荐方案 ${result.recommendation.candidate_id}：${result.recommendation.reason}`, result.hashtags.join(' ')].join('\n\n');
}

function CopyButton({ text, label = '复制', ...props }) {
  const { message } = App.useApp();
  const [copied, setCopied] = useState(false);
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true); clearTimeout(timer.current); timer.current = setTimeout(() => setCopied(false), 1800);
    } catch { message.error('未能访问剪贴板，请选中文案手动复制。'); }
  }
  return <Button {...props} icon={copied ? <CheckOutlined /> : <CopyOutlined />} onClick={copy}>{copied ? '已复制' : label}</Button>;
}

function EmptyCanvas({ ready }) {
  return <div className="empty-canvas">
    <div className="paper-stack" aria-hidden="true"><div className="paper back" /><div className="paper front"><span className="paper-icon"><PictureOutlined /></span><i /><i /><i className="short" /><div className="paper-language">中 <span>↔</span> EN</div></div><span className="float-star">✦</span></div>
    <h3>{ready ? '画面已就绪，让灵感成文' : '好文案，从一组画面开始'}</h3>
    <p>{ready ? '点击生成，寻找这组图片共同的表达。' : '上传一张或多张图片，把灵感交给模型。'}<br />五种表达角度，中英双语，一次呈现。</p>
    <div className="empty-steps"><span><span>01</span> 上传图片</span><ArrowRightOutlined /><span><span>02</span> 生成文案</span><ArrowRightOutlined /><span><span>03</span> 选择与发布</span></div>
  </div>;
}

function Candidate({ candidate, recommended, reason, language }) {
  return <article className={`candidate ${recommended ? 'recommended' : ''}`}>
    <div className="candidate-top"><div><span className="candidate-number">{String(candidate.id).padStart(2, '0')}</span><span className="candidate-angle">{candidate.angle}</span></div>{recommended && <span className="recommended-tag"><StarFilled /> 推荐方案</span>}</div>
    <div className={`bilingual ${language !== 'both' ? 'single' : ''}`}>
      {['zh', 'en'].filter(l => language === 'both' || language === l).map(l => <section className="copy-column" key={l} lang={l === 'en' ? 'en' : 'zh-CN'}>
        <div className="language-head"><span>{l === 'zh' ? '中文文案' : 'ENGLISH'}</span><CopyButton type="text" size="small" text={`${candidate[l].title}\n\n${candidate[l].description}`} label={l === 'zh' ? '复制中文' : '复制英文'} /></div>
        <h3>{candidate[l].title}</h3><p>{candidate[l].description}</p>
      </section>)}
    </div>
    {recommended && <div className="recommendation-reason"><StarFilled /><span>{reason}</span></div>}
  </article>;
}

export default function Workbench() {
  const { message } = App.useApp();
  const [boot, setBoot] = useState(null);
  const [bootError, setBootError] = useState('');
  const [settings, setSettings] = useState(readSettings);
  const [apiKey, setApiKey] = useState('');
  const [draft, setDraft] = useState({ ...settings, apiKey: '' });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [images, setImages] = useState([]);
  const [imageReading, setImageReading] = useState(false);
  const imagesRef = useRef([]);
  const readingRef = useRef(false);
  const [description, setDescription] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [probe, setProbe] = useState('');
  const [busy, setBusy] = useState('');
  const [language, setLanguage] = useState('both');
  const [elapsed, setElapsed] = useState(0);
  const controller = useRef(null);
  const selection = useRef(0);
  const resultsRef = useRef(null);
  const hasKey = Boolean(apiKey || boot?.configured?.[settings.provider]);

  async function loadConfig(signal) {
    setBootError('');
    try {
      const response = await fetch('/api/config', { signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setBoot(data);
    } catch (e) { if (e.name !== 'AbortError') setBootError(e.message || '无法连接本地服务。'); }
  }
  useEffect(() => { const ac = new AbortController(); loadConfig(ac.signal); return () => ac.abort(); }, []);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!busy) return;
    setElapsed(0); const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  function openSettings() { setDraft({ ...settings, apiKey }); setSettingsOpen(true); }
  function saveSettings() {
    if (!draft.model.trim() || (draft.provider === 'custom' && !draft.baseUrl.trim())) { message.warning('请填写模型名称和 API 地址。'); return; }
    if (draft.provider === 'custom') {
      try { const u = new URL(draft.baseUrl); if (u.protocol !== 'https:' && !(u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname))) throw new Error(); }
      catch { message.warning('请填写 HTTPS API 地址；本机接口可使用 HTTP。'); return; }
    }
    const next = { provider: draft.provider, model: draft.model.trim(), baseUrl: draft.baseUrl.trim() };
    setSettings(next); setApiKey(draft.apiKey.trim()); setProbe('');
    try { localStorage.setItem(STORE, JSON.stringify(next)); } catch { /* storage may be unavailable; session settings still work */ }
    setSettingsOpen(false); message.success('模型设置已更新');
  }

  function replaceImages(next) {
    selection.current++;
    imagesRef.current = next; setImages(next);
    setResult(null); setError(''); setProbe('');
  }

  async function selectFile(file, files) {
    // Ant Upload invokes beforeUpload once per file. Consume the batch only once.
    if (file.uid !== files[0]?.uid || readingRef.current || controller.current) return Upload.LIST_IGNORE;
    readingRef.current = true; setImageReading(true);
    try {
      const next = await prepareImageBatch(imagesRef.current, files, async selected => {
        const url = await new Promise((ok, fail) => { const reader = new FileReader(); reader.onload = () => ok(reader.result); reader.onerror = () => fail(new Error()); reader.readAsDataURL(selected); });
        const img = new Image(); img.src = url;
        try {
          await img.decode();
          if (img.width * img.height > 40000000) throw new Error();
          return { uid: selected.uid, url, type: selected.type, name: selected.name, size: selected.size, width: img.width, height: img.height };
        } finally { img.src = ''; }
      });
      replaceImages(next);
    } catch (error) { message.error(error.message); }
    finally { readingRef.current = false; setImageReading(false); }
    return Upload.LIST_IGNORE;
  }

  async function run(purpose) {
    if (!imagesRef.current.length || !boot || controller.current || readingRef.current) return;
    if (!hasKey) { openSettings(); message.info('请先填写 API Key，再开始生成。'); return; }
    if (purpose === 'generate') setResult(null);
    setError(''); setProbe(''); setBusy(purpose);
    const ac = new AbortController(); controller.current = ac;
    const requestSelection = selection.current;
    try {
      const response = await fetch(`/api/${purpose}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Workbench-Token': boot.token },
        body: JSON.stringify({ images: imagesRef.current.map(image => image.url), description, config: { ...settings, apiKey } }), signal: ac.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '请求失败，请稍后重试。');
      if (requestSelection !== selection.current || ac.signal.aborted) return;
      if (purpose === 'probe') setProbe(data.summary);
      else { setResult(data); setLanguage('both'); message.success('5 组双语文案已生成'); if (window.innerWidth < 900) resultsRef.current?.scrollIntoView({ behavior: 'smooth' }); }
    } catch (e) {
      if (e.name === 'AbortError') message.info('已停止等待本次结果');
      else setError(e.message || '连接失败，请检查本地服务。');
    } finally { if (controller.current === ac) { controller.current = null; setBusy(''); } }
  }
  function download() {
    const blob = new Blob([resultText(result, language)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `画语-${images.length}张合辑-${language}.txt`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <div className="app-shell">
    <header className="topbar"><div className="topbar-inner">
      <a className="brand" href="/" aria-label="画语工作台首页"><span className="brand-symbol"><PictureOutlined /></span><span>画语<span className="brand-en">FRAME & WORDS</span></span></a>
      <nav><span className="nav-active">创作工作台</span><button onClick={() => setGuideOpen(true)}>使用指南</button></nav>
      <Button icon={<SettingOutlined />} onClick={openSettings} disabled={Boolean(busy)}>模型设置</Button>
    </div></header>

    <main>
      <div className="intro-row"><div><div className="eyebrow"><span /> IMAGES TO ONE STORY</div><h1>让画面，成为好故事<span>。</span></h1><p>把多张图片放在一起，找到共同的表达。为一个短视频，创作五组中英双语文案。</p></div><div className="intro-badge"><GlobalOutlined /><span>多图一起分析<br /><strong>中英双语表达</strong></span></div></div>
      {bootError && <Alert className="top-alert" type="error" showIcon title="本地服务连接失败" description={bootError} action={<Button size="small" onClick={() => loadConfig()}>重新连接</Button>} />}

      <div className="workspace">
        <aside className="input-column">
          <section className="input-panel">
            <div className="section-title"><span><span className="section-index">01</span> 创作素材</span><span className="quiet-label">多张图片 · 一起分析</span></div>
            <Upload.Dragger className={`uploader ${images.length ? 'has-collection' : ''}`} accept={{ format: 'image/png,image/jpeg,image/webp', filter: () => true }} multiple fileList={[]} showUploadList={false} beforeUpload={selectFile} disabled={Boolean(busy) || imageReading || images.length >= MAX_IMAGES} pastable>
              <div className="upload-content"><div className="upload-illustration"><PictureOutlined /><span><UploadOutlined /></span></div><h3>{images.length ? images.length >= MAX_IMAGES ? '已达到 9 张上限' : '继续添加图片' : '把这一组灵感放在这里'}</h3><p>可同时选择多张，或<span>拖入一组图片</span></p><div className="file-types">最多 9 张 · 单张 10 MB · 合计 30 MB</div></div>
            </Upload.Dragger>
            {images.length > 0 && <div className="image-collection">
              <div className="collection-heading"><span>已选 {images.length} / {MAX_IMAGES} 张 <small>· {(images.reduce((n, image) => n + image.size, 0) / 1024 / 1024).toFixed(1)} MB</small></span><Button type="text" size="small" disabled={Boolean(busy) || imageReading} onClick={() => replaceImages([])}>清空图片</Button></div>
              <AntImage.PreviewGroup><div className="thumbnail-grid">{images.map((image, i) => <figure key={image.uid} className="image-thumbnail"><AntImage src={image.url} alt={`图片 ${i + 1}：${image.name}`} height={92} width="100%" /><span className="thumbnail-index">{i + 1}</span><Button className="thumbnail-remove" size="small" type="text" icon={<CloseOutlined />} aria-label={`移除图片 ${i + 1}`} disabled={Boolean(busy) || imageReading} onClick={() => replaceImages(imagesRef.current.filter(item => item.uid !== image.uid))} /><figcaption title={image.name}>{image.name}</figcaption></figure>)}</div></AntImage.PreviewGroup>
              <p className="collection-note">全部图片作为一个视频素材集合，综合生成一套文案。</p>
            </div>}

            <div className="description-label"><label htmlFor="description">给这组画面补充一点故事</label><span>选填</span></div>
            <Input.TextArea id="description" placeholder="例如：这组照片是同一次旅行，想表达慢下来的生活。也可以说明各张图片的关联或想突出的细节……" value={description} onChange={e => { setDescription(e.target.value); setResult(null); setError(''); }} maxLength={2000} showCount autoSize={{ minRows: 4, maxRows: 8 }} disabled={Boolean(busy)} />
            <div className="input-hint"><InfoCircleOutlined /> 不填写也可以，模型会从画面本身寻找灵感。</div>

            <div className="model-strip"><div><span className={`status-dot ${hasKey ? 'ready' : ''}`} /><span>{PRESETS[settings.provider].label}</span><span className="model-name">{settings.model || '未设置模型'}</span></div><Button type="link" size="small" onClick={openSettings} disabled={Boolean(busy)}>{hasKey ? '更改' : '配置密钥'}</Button></div>
            <Button className="generate-button" type="primary" block size="large" icon={busy === 'generate' || imageReading ? <LoadingOutlined /> : <ThunderboltOutlined />} disabled={!images.length || !boot || Boolean(busy) || imageReading} onClick={() => run('generate')}>{imageReading ? '正在读取图片…' : busy === 'generate' ? `正在创作 · ${elapsed}s` : result ? '重新生成 5 组文案' : '生成 5 组双语文案'}{!busy && !imageReading && <ArrowRightOutlined />}</Button>
            <div className="secondary-actions"><Button type="text" size="small" icon={busy === 'probe' ? <LoadingOutlined /> : <EyeOutlined />} disabled={!images.length || !boot || Boolean(busy) || imageReading} onClick={() => run('probe')}>{busy === 'probe' ? `正在看图 · ${elapsed}s` : '测试模型看图'}</Button>{busy && <Button size="small" onClick={() => controller.current?.abort()}>取消请求</Button>}</div>
            <p className="privacy-note">生成或测试时，图片与描述会发送至所选模型服务，并消耗 API 额度。</p>
            {probe && <Alert className="probe-alert" type="success" showIcon title="模型已返回图片说明" description={<><p>{probe}</p><small>请核对说明是否符合图片，再生成完整文案。</small></>} />}
            {error && <Alert className="probe-alert" role="alert" type="error" showIcon title="本次请求未完成" description={error} closable onClose={() => setError('')} />}
          </section>

          <section className="output-note"><div className="note-icon"><GlobalOutlined /></div><div><h4>五种角度，两种语言</h4><p>画面亮点、意境共鸣、代入体验……<br />从不同角度表达，为你推荐更贴合的一组。</p><div className="note-tags"><span>自然表达</span><span>轻互动</span><span>即选即用</span></div></div></section>
          <div className="version-note"><CheckCircleFilled /> 工作台 {boot?.appVersion || 'v2'} <span>·</span> Skill {boot?.skillVersion || '加载中'}<span className="local-label">本地运行</span></div>
        </aside>

        <section className="results-panel" ref={resultsRef}>
          <div className="section-title results-heading"><span><span className="section-index">02</span> 文案灵感 {result && <span className="result-count">5</span>}</span><span className="quiet-label">{busy === 'generate' ? '正在读懂你的画面' : result ? '让喜欢的表达，直接被使用' : images.length ? `${images.length} 张图片已就绪，一起分析` : '等待你的第一张图片'}</span></div>
          {busy === 'generate' ? <div className="loading-results" aria-live="polite"><div className="loading-caption"><LoadingOutlined /><div><h3>正在寻找画面里的表达</h3><p>图片分析、双语创作与结果检查 · 已等待 {elapsed} 秒</p></div></div>{[1, 2, 3].map(i => <div className="skeleton-card" key={i}><Skeleton active title paragraph={{ rows: 3 }} /></div>)}</div> : !result ? <EmptyCanvas ready={images.length > 0} /> : <div className="results-content">
            <Collapse className="analysis-collapse" defaultActiveKey={['analysis']} items={[{ key: 'analysis', label: <span><EyeOutlined /> 画面解读</span>, children: <div className="analysis-content"><div><span>画面要点</span><p>{result.analysis.visual_summary}</p></div><div><span>意境感受</span><p>{result.analysis.mood}</p></div></div> }]} />
            <div className="results-toolbar"><Segmented aria-label="文案显示语言" options={[{ label: '中英对照', value: 'both' }, { label: '中文', value: 'zh' }, { label: 'English', value: 'en' }]} value={language} onChange={setLanguage} /><Tooltip title="下载当前语言文案"><Button type="text" icon={<DownloadOutlined />} onClick={download} aria-label="下载文案">下载</Button></Tooltip></div>
            <div className="candidate-list">{result.candidates.map(c => <Candidate key={c.id} candidate={c} recommended={c.id === result.recommendation.candidate_id} reason={result.recommendation.reason} language={language} />)}</div>
            <div className="hashtags-panel"><div className="hashtags-title"><h4><span>#</span> 相关话题</h4><CopyButton type="text" size="small" label="复制标签" text={result.hashtags.join(' ')} /></div><div className="hashtags">{result.hashtags.map(tag => <Tag key={tag}>{tag}</Tag>)}</div></div>
            <div className="results-footer"><span><CheckCircleFilled /> 已按 Skill {result.skill_version} 检查结构</span><CopyButton text={resultText(result, language)} label="复制全部文案" /></div>
          </div>}
        </section>
      </div>
      <footer className="page-footer"><span>画语 FRAME & WORDS</span><p>让每一帧，都有自己的表达。</p><span>图片 → 灵感 → 好故事</span></footer>
    </main>

    <Modal title={<span><SettingOutlined /> 模型设置</span>} open={settingsOpen} onCancel={() => setSettingsOpen(false)} onOk={saveSettings} okText="保存设置" cancelText="取消" width={540} destroyOnHidden>
      <div className="settings-form"><p className="modal-intro">连接你自己的模型服务，使用支持图片输入的模型。</p>
        <label htmlFor="provider">模型服务</label><Select id="provider" value={draft.provider} options={Object.entries(PRESETS).map(([value, p]) => ({ value, label: p.label }))} onChange={provider => setDraft({ provider, model: PRESETS[provider].model, baseUrl: PRESETS[provider].baseUrl, apiKey: '' })} />
        <label htmlFor="api-base">API Base URL</label><Input id="api-base" value={draft.baseUrl} disabled={draft.provider !== 'custom'} placeholder="https://your-api.example/v1" onChange={e => setDraft({ ...draft, baseUrl: e.target.value })} />
        <label htmlFor="model-name">模型名称</label><Input id="model-name" value={draft.model} maxLength={150} placeholder="填写支持图片输入的模型名称" onChange={e => setDraft({ ...draft, model: e.target.value })} />
        <small>{draft.provider === 'custom' ? '需兼容 Chat Completions、image_url 图片输入及 JSON 输出。' : `预设 ${PRESETS[draft.provider].model} 的图像支持已按官方文档核对；可填写账号可用的其他视觉模型。`}</small>
        <label htmlFor="api-key">API Key {boot?.configured?.[draft.provider] && <span className="env-key-hint">本地环境文件已配置</span>}</label><Input.Password id="api-key" autoComplete="off" value={draft.apiKey} placeholder={boot?.configured?.[draft.provider] ? '留空使用本地环境文件中的密钥' : '粘贴你的 API Key'} onChange={e => setDraft({ ...draft, apiKey: e.target.value })} />
        <p className="key-note"><InfoCircleOutlined /> 密钥仅用于当前页面会话，刷新后清除。服务和模型选择会保存在本机浏览器。</p>
      </div>
    </Modal>

    <Modal title="三步，找到画面的表达" open={guideOpen} onCancel={() => setGuideOpen(false)} footer={<Button type="primary" onClick={() => setGuideOpen(false)}>开始创作</Button>}>
      <div className="guide"><h3>01 上传一组图片</h3><p>一次选择或拖入多张 JPG、PNG 或 WebP，也可继续追加。最多 9 张，单张 10 MB、合计 30 MB。缩略图可预览和移除，补充描述可说明图片之间的关联。</p><h3>02 连接模型并生成</h3><p>在模型设置中选择服务并填写 API Key。可先“测试模型看图”，核对它是否读懂全部图片，再综合生成一套五组双语文案。</p><h3>03 选择、复制与发布</h3><p>查看画面解读和推荐理由；按中文、英文或中英对照浏览，复制单组文案或下载全部结果。发布前结合实际视频核对内容。</p><div className="guide-footnote">刷新页面会清除当前图片、结果与页面输入的密钥。请及时复制或下载喜欢的文案。</div></div>
    </Modal>
  </div>;
}
