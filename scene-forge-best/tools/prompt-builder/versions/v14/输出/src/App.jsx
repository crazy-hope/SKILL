import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  App as AntApp,
  Button,
  Collapse,
  Drawer,
  Empty,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Tag,
} from "antd";
import { ConditionGrid } from "./components/Conditions.jsx";
import { Settings } from "./components/Settings.jsx";
import { ResultView } from "./components/Results.jsx";
import { emptyBrief, normalizeBrief, listItems } from "../brief.mjs";
import {
  TOPICS,
  briefText,
  topicGuidance,
  snapshot,
  readBackup,
  MAX_BACKUP_BYTES,
  promptDownloadBase,
} from "../core.mjs";
import {
  STORAGE,
  loadWorkspace,
  saveWorkspace,
  saveConnection,
  backupPayload,
} from "./workspace.mjs";
import { loadKeys, saveKeys, clearKeys } from "./credentials.mjs";
import {
  download,
  resultMarkdown,
  copyText,
  bilingualText,
} from "./export.mjs";

export default function Workbench() {
  const { message, modal } = AntApp.useApp();
  const [initial] = useState(() => loadWorkspace(localStorage));
  const [workspace, setWorkspace] = useState(initial.data),
    [blocked, setBlocked] = useState(!!initial.error),
    [notice, setNotice] = useState(initial.error);
  const [keyInitial] = useState(() => {
    try {
      return { keys: loadKeys(localStorage), error: "" };
    } catch {
      return {
        keys: { openai: "", deepseek: "" },
        error: "无法读取密钥，请在配置中重新填写。",
      };
    }
  });
  const [keys, setKeys] = useState(keyInitial.keys),
    [config, setConfig] = useState(null),
    [configError, setConfigError] = useState(initial.connectionError);
  const [settings, setSettings] = useState(false),
    [library, setLibrary] = useState(false),
    [naming, setNaming] = useState(false),
    [presetName, setPresetName] = useState(""),
    [presetId, setPresetId] = useState();
  const [resultOpen, setResultOpen] = useState(false),
    [result, setResult] = useState(null),
    [phase, setPhase] = useState("idle"),
    [generationMessage, setGenerationMessage] = useState(""),
    [zipBusy, setZipBusy] = useState(false);
  const inputFile = useRef(null),
    mounted = useRef(false),
    inFlight = useRef(false);
  const { draft, presets, history, provider, profiles } = workspace;
  const busy = phase === "loading";
  const updateDraft = (value) =>
    setWorkspace((prev) => ({ ...prev, draft: normalizeBrief(value) }));
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (blocked) return;
    try {
      saveWorkspace(localStorage, workspace);
    } catch {
      setNotice(
        "浏览器未能保存记录。当前输入仍可使用，请导出备份后检查存储空间。",
      );
    }
  }, [workspace, blocked]);
  useEffect(() => {
    let active = true;
    fetch("/api/config")
      .then(async (r) => {
        if (!r.ok) throw Error("本地服务未连接，请通过项目启动器打开。");
        return r.json();
      })
      .then((v) => {
        if (active) setConfig(v);
      })
      .catch((e) => {
        if (active) setConfigError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function api(path, body, blob = false) {
    if (!config) throw Error("本地服务尚未连接，请刷新页面。");
    let response;
    try {
      response = await fetch(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Local-Token": config.token,
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw Error("本地服务连接中断，请检查启动终端后重试。");
    }
    if (!response.ok) {
      let error;
      try {
        error = await response.json();
      } catch {}
      throw Error(error?.error || "请求失败，请重试。");
    }
    return blob ? response.blob() : response.json();
  }
  async function copy(text) {
    const ok = await copyText(text);
    if (ok) message.success("已复制");
    else message.error("复制失败，请选中文字手动复制。");
    return ok;
  }
  function confirmAction(title, content, onOk) {
    modal.confirm({ title, content, okText: "确认", cancelText: "取消", onOk });
  }
  async function generate() {
    if (inFlight.current) return;
    if (!keys[provider] || !profiles[provider].model.trim()) {
      setSettings(true);
      message.info("请先填写 API Key 和文本模型 ID。");
      return;
    }
    if (![draft.题材, draft.元素, draft.大致说明].some((v) => v.trim())) {
      message.info("请选择题材或元素，或填写大致说明。");
      return;
    }
    inFlight.current = true;
    setPhase("loading");
    setGenerationMessage("正在依据完整规范设计，通常需要数十秒。");
    setResultOpen(true);
    const request = {
      provider,
      model: profiles[provider].model.trim(),
      key: keys[provider],
      brief: normalizeBrief(draft),
    };
    try {
      const out = await api("/api/generate", request);
      if (out.status === "clarification") {
        setPhase("clarification");
        setGenerationMessage(out.questions.join("；"));
        return;
      }
      const item = snapshot(out);
      setResult(item);
      setWorkspace((prev) => ({
        ...prev,
        history: [item, ...prev.history].slice(0, 30),
      }));
      setPhase("ready");
      setGenerationMessage("双语方案已生成；实际图像效果尚待出图验证。");
    } catch (e) {
      setPhase("error");
      setGenerationMessage(e.message);
    } finally {
      request.key = "";
      inFlight.current = false;
    }
  }
  function showResult(item) {
    setResult(item);
    setPhase("ready");
    setGenerationMessage("此处展示生成时保存的完整内容。");
    setLibrary(false);
    setResultOpen(true);
  }
  function restoreInput(value) {
    confirmAction(
      "恢复这次输入？",
      "将替换当前表单，已保存的预设与历史保留。",
      () => {
        updateDraft(value);
        setResultOpen(false);
        setPresetId(undefined);
      },
    );
  }
  function savePreset() {
    const name = presetName.trim();
    if (!name) {
      message.info("请填写预设名称。");
      return;
    }
    if (presets.length >= 100) {
      message.error("预设已达100个，请先导出并删除不需要的预设。");
      return;
    }
    const item = {
      id: crypto.randomUUID(),
      name: name.slice(0, 80),
      brief: normalizeBrief(draft),
    };
    setWorkspace((prev) => ({ ...prev, presets: [...prev.presets, item] }));
    setPresetId(item.id);
    setNaming(false);
  }
  async function importBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES)
        throw Error("备份超过320MB，请选择有效备份。");
      const data = readBackup(await file.text());
      confirmAction(
        "恢复备份？",
        "将替换当前草稿、预设和历史，接口配置与密钥保持原样。建议先导出当前备份。",
        () => {
          setWorkspace((prev) => ({
            ...prev,
            ...data,
            history: data.history.slice(0, 30),
          }));
          setBlocked(false);
          setNotice("");
          setPresetId(undefined);
          message.success("备份已恢复");
        },
      );
    } catch (e) {
      message.error("恢复失败：" + e.message);
    } finally {
      event.target.value = "";
    }
  }
  async function downloadZip() {
    setZipBusy(true);
    try {
      const base = promptDownloadBase(result);
      const files = result.schemes.map((s) => ({
        name: base,
        content: resultMarkdown({ ...result, schemes: [s] }),
      }));
      download(base + ".zip", await api("/api/export", { files }, true));
    } catch (e) {
      message.error(e.message);
    } finally {
      setZipBusy(false);
    }
  }
  function reset() {
    confirmAction(
      "重置创作条件？",
      "恢复十面板默认值与默认负面提示词，保留已读取的预设和历史。",
      () => {
        updateDraft(emptyBrief());
        setPresetId(undefined);
      },
    );
  }
  const ready = !!keys[provider] && !!profiles[provider].model;
  return (
    <div className="workbench">
      <header className="topbar">
        <a href="/" className="brand">
          <span className="brand-symbol">✦</span>
          <span>
            SCENE FORGE<small>提示词工作台</small>
          </span>
        </a>
        <div className="top-actions">
          <Tag className="spec-tag">
            {config ? `规范 ${config.spec.version.toUpperCase()}` : "连接中"}
          </Tag>
          <Button onClick={() => setLibrary(true)}>
            记录与备份 <span className="number-badge">{history.length}</span>
          </Button>
          <Button
            className={ready ? "connection ready" : "connection"}
            onClick={() => setSettings(true)}
          >
            <span className="status-dot" />
            {ready
              ? `${provider === "openai" ? "OpenAI" : "DeepSeek"} 已配置`
              : "配置模型接口"}
          </Button>
        </div>
      </header>
      <main className="dashboard">
        <section className="intro">
          <div>
            <span className="eyebrow">FROM AN IDEA TO A SCENE</span>
            <h1>定好方向，构建下一幅画面。</h1>
            <p>
              {topicGuidance(listItems(draft.题材)) ||
                "选择你在意的条件，其余交给设计。每个方案，中英文各一份。"}
            </p>
          </div>
          <div className="negative-field">
            <div>
              <label htmlFor="negative">负面提示词</label>
              <Button
                type="text"
                size="small"
                onClick={() => updateDraft({ ...draft, 负面提示词: "" })}
              >
                清空负面
              </Button>
            </div>
            <Input.TextArea
              id="negative"
              aria-label="负面提示词"
              value={draft.负面提示词}
              maxLength={3000}
              rows={2}
              onChange={(e) =>
                updateDraft({ ...draft, 负面提示词: e.target.value })
              }
              placeholder="留空表示不添加负面要求"
            />
          </div>
        </section>
        {(notice || configError || keyInitial.error) && (
          <Alert
            className="workspace-notice"
            type="warning"
            showIcon
            title={notice || configError || keyInitial.error}
            action={
              blocked ? (
                <Button
                  size="small"
                  danger
                  onClick={() =>
                    confirmAction(
                      "重置无法读取的本地记录？",
                      "原存储内容将被当前显示的数据替换。若需保留原文，请先下载原记录。",
                      () => {
                        setBlocked(false);
                        setNotice("");
                        setWorkspace((prev) => ({ ...prev }));
                      },
                    )
                  }
                >
                  重置本地记录
                </Button>
              ) : undefined
            }
          />
        )}
        {blocked && (
          <Button
            size="small"
            onClick={() =>
              download(
                "SceneForge-原记录.json",
                localStorage.getItem(STORAGE) || "",
                "application/json",
              )
            }
          >
            下载原记录
          </Button>
        )}
        <div className="preset-bar">
          <span className="toolbar-label">创作预设</span>
          <Select
            aria-label="选择创作预设"
            value={presetId}
            placeholder="选择已保存的创作要求"
            allowClear
            options={presets.map((p) => ({ label: p.name, value: p.id }))}
            onChange={(id) => {
              setPresetId(id);
              const p = presets.find((x) => x.id === id);
              if (p) updateDraft(p.brief);
            }}
          />
          <Button
            onClick={() => {
              setPresetName(draft.题材.slice(0, 40));
              setNaming(true);
            }}
          >
            保存预设
          </Button>
          <Button
            disabled={!presetId}
            type="text"
            aria-label="删除选中的预设"
            onClick={() =>
              confirmAction("删除所选预设？", "此操作仅删除当前预设。", () => {
                setWorkspace((prev) => ({
                  ...prev,
                  presets: prev.presets.filter((p) => p.id !== presetId),
                }));
                setPresetId(undefined);
              })
            }
          >
            删除
          </Button>
          <span className="toolbar-note">
            {Object.keys(TOPICS).length} 个题材 · 分类元素可搜索
          </span>
          <Button type="text" onClick={reset}>
            重置条件
          </Button>
        </div>
        <ConditionGrid draft={draft} onChange={updateDraft} />
        <footer className="dashboard-foot">
          <span>
            规范 {config?.spec.version.toUpperCase() || "—"} · 工作台 V14
          </span>
          <span>
            {blocked
              ? "原本地记录已保留，自动保存暂停"
              : "草稿自动保存在此浏览器"}
          </span>
        </footer>
      </main>
      <div className="generate-dock">
        <div>
          <strong>
            {draft.数量.replace("条", " 个方案")} <span>· 中英双语</span>
          </strong>
          <small>
            {profiles[provider].model
              ? `${provider === "openai" ? "OpenAI" : "DeepSeek"} / ${profiles[provider].model}`
              : "先选条件，再生成提示词"}
          </small>
        </div>
        {(result || busy) && (
          <Button type="text" onClick={() => setResultOpen(true)}>
            查看结果
          </Button>
        )}
        <Button
          type="primary"
          size="large"
          loading={busy}
          disabled={!config}
          onClick={generate}
        >
          {busy ? "正在设计双语提示词" : "生成双语提示词"} {!busy && "↗"}
        </Button>
      </div>
      {settings && (
        <Settings
          provider={provider}
          profiles={profiles}
          keys={keys}
          config={config}
          api={api}
          onClose={() => setSettings(false)}
          onSave={(p, profiles, newKeys) => {
            setKeys(newKeys);
            setWorkspace((prev) => ({ ...prev, provider: p, profiles }));
            try {
              saveConnection(localStorage, { provider: p, profiles });
              saveKeys(localStorage, newKeys);
              setConfigError("");
              setSettings(false);
              message.success("配置已保存");
            } catch {
              message.error("接口配置或密钥未能完整保存；当前页面可使用，请重试保存后再刷新。");
            }
          }}
          onClear={() => {
            try {
              clearKeys(localStorage);
              setKeys({ openai: "", deepseek: "" });
              return true;
            } catch {
              message.error("清除密钥失败，请检查浏览器存储权限。");
              return false;
            }
          }}
        />
      )}
      <Drawer
        open={library}
        onClose={() => setLibrary(false)}
        title="创作记录与备份"
        size={620}
        className="library-drawer"
      >
        <div className="library-actions">
          <Button
            onClick={() =>
              download(
                "SceneForge-备份-" +
                  new Date().toISOString().slice(0, 10) +
                  ".json",
                JSON.stringify(backupPayload(workspace), null, 2),
                "application/json",
              )
            }
          >
            导出备份
          </Button>
          <Button onClick={() => inputFile.current?.click()}>恢复备份</Button>
          <input
            hidden
            ref={inputFile}
            type="file"
            accept=".json,application/json"
            onChange={importBackup}
          />
        </div>
        <p className="muted">
          保留最近30次结果，与V12共享当前格式数据。备份不包含API
          Key，不支持V11及更早格式。
        </p>
        <div className="history-list">
          {history.length ? (
            history.map((item) => (
              <div className="history-item" key={item.id}>
                <button
                  type="button"
                  className="history-link"
                  onClick={() => showResult(item)}
                  disabled={busy}
                >
                  <strong>{item.schemes[0].name || "未命名方案"}</strong>
                  <small>
                    {new Date(item.createdAt).toLocaleString("zh-CN")} ·{" "}
                    {item.schemes.length} 对 · {item.spec.version}
                  </small>
                </button>
                <Button
                  type="text"
                  danger
                  onClick={() =>
                    confirmAction(
                      "删除这条生成记录？",
                      "仅删除本地记录。",
                      () =>
                        setWorkspace((prev) => ({
                          ...prev,
                          history: prev.history.filter((x) => x.id !== item.id),
                        })),
                    )
                  }
                >
                  删除
                </Button>
              </div>
            ))
          ) : (
            <Empty description="还没有生成记录，下一次灵感会留在这里。" />
          )}
        </div>
        <Collapse
          items={[
            {
              key: "input",
              label: "查看当前完整输入",
              children: (
                <>
                  <pre className="source-text">{briefText(draft)}</pre>
                  <Space wrap>
                    <Button onClick={() => copy(briefText(draft))}>
                      复制完整输入
                    </Button>
                    <a href="/api/spec" target="_blank" rel="noreferrer">
                      查看完整规范 ↗
                    </a>
                  </Space>
                </>
              ),
            },
          ]}
        />
      </Drawer>
      <Modal
        open={naming}
        title="保存为创作预设"
        onCancel={() => setNaming(false)}
        onOk={savePreset}
        okText="保存"
        cancelText="取消"
      >
        <label className="control">
          <span>预设名称</span>
          <Input
            aria-label="预设名称"
            value={presetName}
            maxLength={80}
            onChange={(e) => setPresetName(e.target.value)}
            onPressEnter={savePreset}
          />
        </label>
      </Modal>
      <Modal
        open={resultOpen}
        onCancel={() => setResultOpen(false)}
        width="calc(100vw - 40px)"
        style={{ maxWidth: 1480, top: 20 }}
        footer={null}
        title="你的提示词方案"
        className="results-modal"
        destroyOnHidden
      >
        <p className="generation-message">{generationMessage}</p>
        {busy ? (
          <div className="generation-loading">
            <Spin size="large" />
            <h3>正在构建设计与双语提示词</h3>
            <p>你可以关闭弹窗继续查看条件，生成完成后从底部查看结果。</p>
          </div>
        ) : phase === "error" || phase === "clarification" ? (
          <Alert
            type={phase === "error" ? "error" : "warning"}
            showIcon
            title={phase === "error" ? "生成失败，输入已保留" : "需要调整输入"}
            description={generationMessage}
            action={
              <Button onClick={() => setResultOpen(false)}>返回调整</Button>
            }
          />
        ) : result ? (
          <>
            <div className="result-actions">
              <Button
                onClick={() =>
                  copy(
                    result.schemes
                      .map(
                        (s, i) =>
                          `方案 ${i + 1} · ${s.name}\n\n${bilingualText(s)}`,
                      )
                      .join("\n\n────────\n\n"),
                  )
                }
              >
                复制全部提示词
              </Button>
              <Button
                onClick={() =>
                  download(
                    promptDownloadBase(result) + ".md",
                    resultMarkdown(result),
                  )
                }
              >
                下载全部 .md
              </Button>
              <Button loading={zipBusy} onClick={downloadZip}>
                下载全部（单独）
              </Button>
            </div>
            <ResultView
              key={result.id}
              result={result}
              onCopy={copy}
              onRestore={restoreInput}
            />
          </>
        ) : null}
      </Modal>
    </div>
  );
}
