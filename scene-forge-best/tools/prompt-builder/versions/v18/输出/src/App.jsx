import React, { useEffect, useRef, useState } from "react";
import {
  LABELS,
  freshBrief,
  resetFive,
  validateBrief,
  validateResult,
  loadWorkspace,
  saveWorkspace,
  backup,
  parseBackup,
  loadConnection,
  saveConnection,
  markdown,
} from "../model.mjs";
import "./style.css";
const emptyConnection = () => ({
  provider: "openai",
  profiles: { openai: { model: "" }, deepseek: { model: "" } },
  keys: { openai: "", deepseek: "" },
});
const saveFile = (name, text, type = "text/plain;charset=utf-8") => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
function Modal({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.querySelector("button")?.focus();
    return () => previous?.focus?.();
  }, []);
  return (
    <div
      className="veil"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Tab") {
            const all = [
              ...ref.current.querySelectorAll("button,input,select,textarea,a"),
            ].filter((x) => !x.disabled && x.tabIndex !== -1);
            if (e.shiftKey && document.activeElement === all[0]) {
              e.preventDefault();
              all.at(-1)?.focus();
            } else if (!e.shiftKey && document.activeElement === all.at(-1)) {
              e.preventDefault();
              all[0]?.focus();
            }
          }
        }}
      >
        <header>
          <h2>{title}</h2>
          <button onClick={onClose} aria-label="关闭窗口">
            关闭
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export default function App() {
  const [loaded] = useState(() => loadWorkspace(localStorage));
  const [data, setData] = useState(loaded.data),
    [storageError, setStorageError] = useState(loaded.error),
    [raw, setRaw] = useState(loaded.raw);
  const [initialConnection] = useState(() => {
    try {
      return { value: loadConnection(localStorage), error: "" };
    } catch (e) {
      return { value: emptyConnection(), error: e.message };
    }
  });
  const [connection, setConnection] = useState(initialConnection.value),
    [connectionError, setConnectionError] = useState(initialConnection.error);
  const [config, setConfig] = useState(null),
    [dialog, setDialog] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(""),
    [questions, setQuestions] = useState([]),
    [undo, setUndo] = useState(null),
    [result, setResult] = useState(null),
    [models, setModels] = useState([]);
  const revision = useRef(0),
    modelRevision = useRef(0),
    mounted = useRef(true);
  const brief = data.draft;
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    fetch("/api/config", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw Error("无法连接本地服务，请重新打开工作台。");
        const v = await r.json();
        if (typeof v.token !== "string" || !v.spec)
          throw Error("本地配置格式错误。");
        if (mounted.current) setConfig(v);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setMessage(e.message);
      });
    return () => {
      mounted.current = false;
      controller.abort();
    };
  }, []);
  useEffect(() => {
    if (storageError) return;
    try {
      saveWorkspace(localStorage, data);
    } catch (e) {
      setStorageError(
        "自动保存已暂停，原记录不会被覆盖。请在记录与备份中导出或恢复。",
      );
    }
  }, [data, storageError]);
  function change(next) {
    revision.current++;
    setData((v) => ({
      ...v,
      draft: typeof next === "function" ? next(v.draft) : next,
    }));
    setQuestions([]);
  }
  function field(k, v) {
    if (k === "subject") setUndo(null);
    change((b) => ({ ...b, [k]: v }));
  }
  function editConnection(next) {
    revision.current++;
    modelRevision.current++;
    setConnection(next);
    setModels([]);
  }
  async function post(path, body) {
    if (!config) throw Error("本地服务尚未就绪，请稍候或刷新页面。");
    const r = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Local-Token": config.token,
      },
      body: JSON.stringify(body),
    });
    let out;
    try {
      out = await r.json();
    } catch {
      throw Error("服务返回格式错误，请手动重试。");
    }
    if (!r.ok) throw Error(out.error || "请求失败，请手动重试。");
    return out;
  }
  function credentials() {
    const { provider, profiles, keys } = connection;
    const model = profiles[provider].model.trim(),
      key = keys[provider].trim();
    if (!key || !model) {
      setDialog("config");
      throw Error("请先填写文本模型ID和API Key。");
    }
    return { provider, model, key };
  }
  async function generate(stage) {
    let input, auth;
    try {
      input = validateBrief(brief);
      if (stage === "generate" && !input.subject.trim())
        throw Error("请先填写主体内容，或使用AI描述主体。");
      auth = credentials();
    } catch (e) {
      setMessage(e.message);
      return;
    }
    const stamp = revision.current;
    setBusy(stage);
    setMessage("");
    setQuestions([]);
    try {
      const out = await post("/api/" + stage, { ...auth, brief: input });
      if (!mounted.current) return;
      if (revision.current !== stamp) {
        setMessage("条件已变更，本次返回已忽略。请按当前内容重新生成。");
        return;
      }
      if (out.status === "clarification") {
        if (
          !Array.isArray(out.questions) ||
          !out.questions.length ||
          out.questions.some((q) => typeof q !== "string")
        )
          throw Error("澄清格式错误。");
        setQuestions(out.questions);
        return;
      }
      if (stage === "subject") {
        if (
          out.status !== "subject" ||
          typeof out.subject !== "string" ||
          !out.subject.trim() ||
          out.subject.length > 12000
        )
          throw Error("模型没有返回有效主体描述。");
        change({ ...input, subject: out.subject });
        setUndo({ before: input.subject, after: out.subject });
        setMessage("主体描述已填入，可继续修改。");
      } else {
        const clean = validateResult(out);
        if (
          JSON.stringify(clean.brief) !== JSON.stringify(validateBrief(input))
        )
          throw Error("结果与提交输入不一致，未保存。");
        setResult(clean);
        setData((v) => ({ ...v, history: [clean, ...v.history].slice(0, 30) }));
        setMessage("双语提示词已生成。");
      }
    } catch (e) {
      if (mounted.current)
        setMessage(
          revision.current === stamp
            ? e.message
            : "条件已变更，本次返回已忽略。请按当前内容重新生成。",
        );
    } finally {
      if (mounted.current) setBusy("");
    }
  }
  async function getModels() {
    let auth;
    try {
      auth = credentials();
    } catch {
      const p = connection.provider;
      if (!connection.keys[p].trim()) {
        setMessage("请先填写API Key。");
        return;
      }
      auth = { provider: p, key: connection.keys[p].trim() };
    }
    const stamp = modelRevision.current;
    setBusy("models");
    try {
      const out = await post("/api/models", auth);
      if (stamp !== modelRevision.current) return;
      if (
        !Array.isArray(out.models) ||
        out.models.some((m) => typeof m !== "string")
      )
        throw Error("模型列表格式错误。");
      setModels(out.models);
      setMessage("已读取模型列表，可从下拉中选择。");
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy("");
    }
  }
  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("已复制。");
    } catch {
      setMessage("浏览器未允许复制，请选中提示词手动复制。");
    }
  }
  function restoreFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    revision.current++;
    setUndo(null);
    if (file.size > 25_000_000) {
      setMessage("备份过大，请使用25MB以内的v6备份。");
      return;
    }
    const stamp = revision.current;
    file
      .text()
      .then((text) => {
        const restored = parseBackup(text);
        if (stamp !== revision.current) {
          setMessage("读取备份期间内容已改变，未覆盖。");
          return;
        }
        saveWorkspace(localStorage, restored, { replace: true });
        setStorageError("");
        setRaw(null);
        revision.current++; // Applying the asynchronously read backup invalidates newer requests too.
        setData(restored);
        setResult(null);
        setQuestions([]);
        setMessage("已恢复v6备份。");
        setDialog("");
      })
      .catch((e) => setMessage("恢复失败：" + e.message));
  }
  function reset() {
    change(freshBrief());
    setUndo(null);
    setResult(null);
    setMessage("已新建输入，历史仍保留。");
    setDialog("");
  }
  const resultBrief = result
    ? Object.entries(LABELS)
        .map(([k, label]) => `${label}：${result.brief[k]}`)
        .join("\n\n") +
      "\n\n主体内容：" +
      result.brief.subject
    : "";
  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#top">
          <span className="brand-mark">景</span>
          <span>
            画面工作台<small>SCENE FORGE / 18</small>
          </span>
        </a>
        <nav>
          <button onClick={() => setDialog("records")}>
            记录与备份 <span>{data.history.length}</span>
          </button>
          <button onClick={() => setDialog("config")}>接口设置</button>
        </nav>
      </header>
      <main id="top">
        <div className="intro">
          <div>
            <p className="eyebrow">从一段想法，到一个具体画面</p>
            <h1>先定基调，再描绘主体。</h1>
            <p>
              五项设定都可以修改。写下画面中的主体，或让 AI 帮你把细节描述完整。
            </p>
          </div>
          <span className="version">
            {config ? "规范 V16" : "连接本地服务…"}
          </span>
        </div>
        {storageError && (
          <div className="alert warning" role="alert">
            {storageError}{" "}
            <button onClick={() => setDialog("records")}>处理记录</button>
          </div>
        )}
        {message && (
          <div className="alert" role="status">
            {message}
          </div>
        )}
        {questions.length > 0 && (
          <div className="alert warning" role="alert">
            <strong>有几项设定需要统一</strong>
            <ul>
              {questions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
            <p>请修改对应段落后重新生成。</p>
          </div>
        )}
        <div className="workspace">
          <section className="tone">
            <div className="section-title">
              <div>
                <span className="step">01</span>
                <h2>画面基调</h2>
              </div>
              <button
                className="text-button"
                onClick={() => {
                  change(resetFive);
                  setMessage("已恢复五项默认，主体内容保留。");
                }}
              >
                恢复五项默认
              </button>
            </div>
            <div className="tone-grid">
              {Object.entries(LABELS).map(([k, label], i) => (
                <div className={"field " + k} key={k}>
                  <label htmlFor={k}>
                    <span>0{i + 1}</span>
                    {label}
                  </label>
                  <textarea
                    id={k}
                    aria-label={label}
                    value={brief[k]}
                    rows={
                      k === "style"
                        ? 5
                        : k === "color"
                          ? 4
                          : k === "moment"
                            ? 3
                            : 2
                    }
                    maxLength={6000}
                    onChange={(e) => field(k, e.target.value)}
                  />
                </div>
              ))}
            </div>
            <p className="footnote">
              保留的文字都会参与生成；清空表示取消这一项的设定。
            </p>
          </section>
          <section className="subject-panel">
            <div className="section-title">
              <div>
                <span className="step">02</span>
                <h2>描绘主体</h2>
              </div>
              <span className="tag">手写 / AI 辅助</span>
            </div>
            <label htmlFor="subject" className="subject-label">
              主体内容
            </label>
            <p className="hint">
              写清什么元素，在什么地方，什么材质和颜色，正处于什么状态，以及彼此如何联系。
            </p>
            <textarea
              id="subject"
              value={brief.subject}
              maxLength={12000}
              onChange={(e) => field("subject", e.target.value)}
              placeholder="可以从一句想法开始，再让 AI 补齐位置、材质、颜色、动作与环境反馈。"
            />
            <div className="subject-actions">
              <button
                className="secondary"
                disabled={!!busy || !config}
                onClick={() => generate("subject")}
              >
                {busy === "subject" ? "正在描述主体…" : "AI描述主体"}
              </button>
              {undo && brief.subject === undo.after && (
                <button
                  className="text-button"
                  onClick={() => {
                    change((b) => ({ ...b, subject: undo.before }));
                    setUndo(null);
                    setMessage("已撤销本次AI描述。");
                  }}
                >
                  撤销AI描述
                </button>
              )}
            </div>
            <p className="footnote">
              可留空让 AI 构思，也可直接手写后生成。AI 仅修改主体内容。
            </p>
            <div className="output-options">
              <label htmlFor="target">
                目标图像模型
                <input
                  id="target"
                  list="image-models"
                  value={brief.target}
                  maxLength={6000}
                  onChange={(e) => field("target", e.target.value)}
                  placeholder="留空使用通用描述"
                />
              </label>
              <datalist id="image-models">
                {[
                  "Midjourney",
                  "OpenAI Image",
                  "FLUX",
                  "Stable Diffusion",
                  "Imagen",
                ].map((x) => (
                  <option key={x} value={x} />
                ))}
              </datalist>
              <label htmlFor="count">
                方案数量
                <select
                  id="count"
                  aria-label="方案数量"
                  value={brief.count}
                  onChange={(e) => field("count", Number(e.target.value))}
                >
                  {Array.from({ length: 10 }, (_, i) => (
                    <option key={i} value={i + 1}>
                      {i + 1} 对双语
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <details className="negative">
              <summary>
                负面提示词 <span>可修改或清空</span>
              </summary>
              <label htmlFor="negative" className="sr-only">
                负面提示词
              </label>
              <textarea
                id="negative"
                value={brief.negative}
                maxLength={6000}
                rows={7}
                onChange={(e) => field("negative", e.target.value)}
              />
            </details>
            <button
              className="primary generate"
              disabled={!!busy || !config || !brief.subject.trim()}
              onClick={() => generate("generate")}
            >
              {busy === "generate" ? "正在生成完整提示词…" : "生成完整提示词"}
              <span aria-hidden="true">↗</span>
            </button>
            <p className="footnote">
              每次操作调用一次文本模型。结果包含完整中文与英文。
            </p>
          </section>
        </div>
        {result && (
          <section className="results">
            <div className="section-title">
              <div>
                <span className="step">03</span>
                <h2>完整提示词</h2>
              </div>
              <button
                onClick={() => saveFile("完整提示词.md", markdown(result))}
              >
                下载全部
              </button>
            </div>
            <p className="hint">
              以下是这次生成的结果，可分别复制。文本与实际出图效果仍需核验。
            </p>
            {result.schemes.map((s, i) => (
              <article className="scheme" key={i}>
                <h3>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  {s.title}
                </h3>
                <div className="bilingual">
                  {[
                    ["zh", "中文"],
                    ["en", "English"],
                  ].map(([k, label]) => (
                    <section key={k}>
                      <header>
                        <h4>{label}</h4>
                        <button onClick={() => copy(s[k])}>
                          复制{label === "中文" ? "中文" : "英文"}
                        </button>
                      </header>
                      <pre>{s[k]}</pre>
                    </section>
                  ))}
                </div>
                {s.usage && (
                  <p className="usage">
                    <strong>使用说明：</strong>
                    {s.usage}
                  </p>
                )}
              </article>
            ))}
            <details className="source">
              <summary>查看本次输入与来源</summary>
              <pre>{resultBrief}</pre>
              <p>负面提示词：{result.brief.negative || "已清空"}</p>
              <p>
                目标：{result.target.requested || "通用"} · 数量：
                {result.brief.count} · 文本服务：{result.provider} /{" "}
                {result.model}
              </p>
              <p>
                规范：{result.spec.version} · SHA-256：{result.spec.sha256}
              </p>
              <p>
                适配范围：{result.target.scope} · 来源查阅日期：
                {result.target.checkedAt}，本次未联网核实。
              </p>
            </details>
          </section>
        )}
        <footer>
          画面工作台 V18 <span>·</span> 主体细节与五项基调共同决定画面
        </footer>
      </main>
      {dialog === "config" && (
        <Modal title="接口设置" onClose={() => setDialog("")}>
          {message && (
            <p className="alert" role="status">
              {message}
            </p>
          )}
          <p className="hint">
            选择编写提示词的文本服务，与目标图像模型分别设置。密钥仅保存在本浏览器独立配置中，不进入创作备份。
          </p>
          {connectionError && (
            <div className="alert warning">
              {connectionError} 保存将替换接口配置。
            </div>
          )}
          <label>
            文本服务
            <select
              value={connection.provider}
              onChange={(e) =>
                editConnection({ ...connection, provider: e.target.value })
              }
            >
              <option value="openai">OpenAI</option>
              <option value="deepseek">DeepSeek</option>
            </select>
          </label>
          <label>
            文本模型 ID
            <input
              list="text-models"
              value={connection.profiles[connection.provider].model}
              maxLength={200}
              onChange={(e) =>
                editConnection({
                  ...connection,
                  profiles: {
                    ...connection.profiles,
                    [connection.provider]: { model: e.target.value },
                  },
                })
              }
            />
          </label>
          <datalist id="text-models">
            {models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <label>
            API Key
            <input
              type="password"
              autoComplete="off"
              value={connection.keys[connection.provider]}
              maxLength={1024}
              onChange={(e) =>
                editConnection({
                  ...connection,
                  keys: {
                    ...connection.keys,
                    [connection.provider]: e.target.value,
                  },
                })
              }
            />
          </label>
          <div className="button-row">
            <button disabled={!!busy || !config} onClick={getModels}>
              {busy === "models" ? "读取中…" : "读取可用模型"}
            </button>
            <button
              onClick={() => {
                editConnection({
                  ...connection,
                  keys: { ...connection.keys, [connection.provider]: "" },
                });
                setMessage("密钥已从输入移除，保存设置后生效。");
              }}
            >
              清空当前密钥
            </button>
            <button
              className="primary"
              onClick={() => {
                try {
                  saveConnection(localStorage, connection);
                  setConnectionError("");
                  setMessage("接口设置已保存。");
                  setDialog("");
                } catch {
                  setMessage("接口设置保存失败，请检查浏览器存储权限。");
                }
              }}
            >
              保存设置
            </button>
          </div>
          <p className="footnote">
            使用支持 Chat Completions 与 JSON
            输出的文本模型。请求超时或失败不会自动重试。
          </p>
        </Modal>
      )}
      {dialog === "records" && (
        <Modal title="记录与备份" onClose={() => setDialog("")}>
          {message && (
            <p className="alert" role="status">
              {message}
            </p>
          )}
          {storageError && <p className="alert warning">{storageError}</p>}
          <div className="button-row">
            <button onClick={reset}>新建输入</button>
            <button
              onClick={() =>
                saveFile(
                  "画面工作台-v6备份.json",
                  JSON.stringify(backup(data), null, 2),
                  "application/json",
                )
              }
            >
              导出当前备份
            </button>
            <label className="file-button">
              恢复v6备份
              <input
                type="file"
                accept=".json,application/json"
                onChange={restoreFile}
              />
            </label>
            {raw !== null && storageError && (
              <button onClick={() => saveFile("原始损坏记录.txt", raw)}>
                导出原始记录
              </button>
            )}
          </div>
          <p className="hint">
            恢复将替换当前草稿和本版历史。旧工作台的记录保留在旧版本中；本版不读取或转换。
          </p>
          <h3>
            生成历史 <span>最近30次</span>
          </h3>
          {data.history.length === 0 ? (
            <p className="empty">还没有生成记录。</p>
          ) : (
            <div className="history">
              {data.history.map((r) => (
                <article key={r.id}>
                  <div>
                    <strong>{r.schemes[0].title}</strong>
                    <small>
                      {new Date(r.createdAt).toLocaleString()} ·{" "}
                      {r.schemes.length}对
                    </small>
                  </div>
                  <button
                    onClick={() => {
                      setResult(r);
                      setDialog("");
                      setMessage("正在查看历史结果；当前输入保持原样。");
                    }}
                  >
                    查看
                  </button>
                  <button
                    onClick={() => {
                      change(r.brief);
                      setUndo(null);
                      setDialog("");
                      setMessage("已将历史输入载入，生成记录保持原样。");
                    }}
                  >
                    复用输入
                  </button>
                </article>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
