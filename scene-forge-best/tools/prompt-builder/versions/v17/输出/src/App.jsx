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
import { SceneComposer } from "./components/SceneComposer.jsx";
import { validateConcept } from "../scene.mjs";
import { ConditionGrid } from "./components/Conditions.jsx";
import { Settings } from "./components/Settings.jsx";
import { ResultView } from "./components/Results.jsx";
import { emptyBrief, normalizeBrief, validateBrief } from "../brief.mjs";
import {
  briefText,
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
    [refinement, setRefinement] = useState(false),
    [naming, setNaming] = useState(false),
    [presetName, setPresetName] = useState(""),
    [presetId, setPresetId] = useState();
  const [resultOpen, setResultOpen] = useState(false),
    [result, setResult] = useState(null),
    [phase, setPhase] = useState("idle"),
    [generationMessage, setGenerationMessage] = useState(""),
    [zipBusy, setZipBusy] = useState(false);
  const [concepts, setConcepts] = useState([]);
  const [conceptPhase, setConceptPhase] = useState("idle");
  const [conceptMessage, setConceptMessage] = useState("");
  const [busyStage, setBusyStage] = useState("");
  const revision = useRef(0);
  const inputFile = useRef(null),
    mounted = useRef(false),
    inFlight = useRef(false);
  const { draft, presets, history, provider, profiles } = workspace;
  const busy = !!busyStage;
  function replaceDraft(value, restore = false) {
    const next = normalizeBrief(value);
    const creative = (v) =>
      JSON.stringify({
        ...v,
        数量: "",
        目标模型: "",
        scene: { ...v.scene, selected: null },
      });
    if (restore || JSON.stringify(next) !== JSON.stringify(draft)) {
      revision.current += 1;
      if (restore || creative(next) !== creative(draft)) {
        if (!restore) next.scene.selected = null;
        setConcepts([]);
        setConceptPhase("idle");
        setConceptMessage(restore ? "" : "输入已更新，重新构思后再选择。 ");
      }
      if (busyStage === "final") setResultOpen(false);
      if (busyStage === "concept") {
        setConceptPhase("idle");
        setConceptMessage("输入已更新，重新构思后再选择。");
      }
    }
    setWorkspace((prev) => ({ ...prev, draft: next }));
  }
  const updateDraft = (value) => replaceDraft(value);
  function selectConcept(value) {
    if (inFlight.current) return;
    revision.current += 1;
    setWorkspace((prev) => ({
      ...prev,
      draft: {
        ...prev.draft,
        scene: { ...prev.draft.scene, selected: validateConcept(value) },
      },
    }));
  }
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
  function prepareRequest(needsSelection = false) {
    if (!keys[provider] || !profiles[provider].model.trim()) {
      setSettings(true);
      message.info("请先填写 API Key 和文本模型 ID。");
      return null;
    }
    if (
      ![
        draft.scene.core,
        draft.scene.backdrop,
        draft.scene.direction,
        draft.scene.keep,
        draft.scene.change,
        draft.题材,
        draft.元素,
        draft.大致说明,
      ].some((v) => v.trim())
    ) {
      message.info("请写下核心场景或想法，也可以在精修中选择题材或元素。");
      return null;
    }
    try {
      validateBrief(draft);
    } catch (e) {
      message.error(e.message);
      return null;
    }
    if (needsSelection && !draft.scene.selected) {
      message.info("请先构思场景并选择一条构思。");
      return null;
    }
    return {
      provider,
      model: profiles[provider].model.trim(),
      key: keys[provider],
      brief: normalizeBrief(draft),
    };
  }
  function clarification(out) {
    if (
      !Array.isArray(out.questions) ||
      !out.questions.length ||
      out.questions.some((q) => typeof q !== "string" || !q.trim())
    )
      throw Error("澄清内容格式错误，请重试。");
    return out.questions.join("；");
  }
  async function conceive() {
    if (inFlight.current) return;
    const request = prepareRequest();
    if (!request) return;
    request.brief.scene.selected = null;
    revision.current += 1;
    const current = revision.current;
    setWorkspace((prev) => ({
      ...prev,
      draft: { ...prev.draft, scene: { ...prev.draft.scene, selected: null } },
    }));
    setConcepts([]);
    setConceptPhase("loading");
    setConceptMessage("");
    inFlight.current = true;
    setBusyStage("concept");
    try {
      const out = await api("/api/concepts", request);
      if (revision.current !== current) return;
      if (out.status === "clarification") {
        setConceptMessage(clarification(out));
        setConceptPhase("clarification");
        return;
      }
      if (
        out.status !== "concepts" ||
        !Array.isArray(out.concepts) ||
        out.concepts.length !== 3
      )
        throw Error("应收到三个完整构思，请重试。");
      const items = out.concepts.map(validateConcept);
      if (new Set(items.map((v) => JSON.stringify(v))).size !== 3)
        throw Error("构思重复，请重试。");
      setConcepts(items);
      setConceptPhase("ready");
    } catch (e) {
      if (revision.current !== current) return;
      setConceptPhase("error");
      setConceptMessage(e.message);
    } finally {
      request.key = "";
      inFlight.current = false;
      setBusyStage("");
    }
  }
  async function generate() {
    if (inFlight.current) return;
    const request = prepareRequest(true);
    if (!request) return;
    const current = revision.current;
    inFlight.current = true;
    setBusyStage("final");
    setPhase("loading");
    setGenerationMessage(
      "正在展开画面并进行文本审校，通常需要两次文本模型请求，请稍候。",
    );
    setResultOpen(true);
    try {
      const out = await api("/api/generate", request);
      if (revision.current !== current) {
        setPhase("idle");
        return;
      }
      if (out.status === "clarification") {
        setGenerationMessage(clarification(out));
        setPhase("clarification");
        return;
      }
      const item = snapshot(out);
      setResult(item);
      setWorkspace((prev) => ({
        ...prev,
        history: [item, ...prev.history].slice(0, 30),
      }));
      setPhase("ready");
      setGenerationMessage("双语方案已生成并完成模型文本审校；实际图像效果尚待出图验证。");
    } catch (e) {
      if (revision.current !== current) {
        setPhase("idle");
        return;
      }
      setPhase("error");
      setGenerationMessage(e.message);
    } finally {
      request.key = "";
      inFlight.current = false;
      setBusyStage("");
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
        replaceDraft(value, true);
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
          revision.current += 1;
          setConcepts([]);
          setConceptPhase("idle");
          setConceptMessage("");
          setResultOpen(false);
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
      "清空场景与想法，恢复精修默认值与默认负面提示词，保留已读取的预设和历史。",
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
        <section className="intro scene-intro">
          <div>
            <span className="eyebrow">SCENE FIRST · DETAILS FOLLOW</span>
            <h1>让一个场景，生长出画面。</h1>
            <p>写下想法，挑选构思，让材质、光线与动作共同构成一个具体瞬间。</p>
          </div>
          <span className="intro-note">
            少一些填写
            <br />
            多一些想象
          </span>
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
        <SceneComposer
          draft={draft}
          onChange={updateDraft}
          concepts={concepts}
          conceptPhase={conceptPhase}
          conceptMessage={conceptMessage}
          busyStage={busyStage}
          connected={!!config}
          onConcepts={conceive}
          onSelect={selectConcept}
          onRefine={() => setRefinement(true)}
        />
        <footer className="dashboard-foot">
          <span>
            规范 {config?.spec.version.toUpperCase() || "—"} · 工作台 V17
          </span>
          <span>
            {blocked
              ? "原本地记录已保留，自动保存暂停"
              : "草稿自动保存在此浏览器"}
          </span>
        </footer>
      </main>
      <div className="generate-dock scene-dock">
        <div className="dock-selection">
          <strong>
            {draft.scene.selected
              ? draft.scene.selected.title
              : "选定构思，再展开"}
          </strong>
          <small>
            {draft.scene.selected
              ? "完整生成通常调用文本模型两次：展开画面与审校，会增加等待与用量"
              : "先点击「构思 3 个场景」"}
          </small>
        </div>
        <label className="dock-count">
          <span title="每次完整生成通常进行两次文本模型请求：展开与审校">展开数量</span>
          <Select
            aria-label="展开数量"
            value={draft.数量}
            options={Array.from({ length: 10 }, (_, i) => ({
              label: `${i + 1} 对双语`,
              value: `${i + 1}条`,
            }))}
            onChange={(数量) => updateDraft({ ...draft, 数量 })}
          />
        </label>
        {result && !busy && (
          <Button
            type="text"
            onClick={() => {
              setPhase("ready");
              setGenerationMessage("此处展示上次生成时保存的完整内容。");
              setResultOpen(true);
            }}
          >
            上次结果
          </Button>
        )}
        {busyStage === "final" && (
          <Button type="text" onClick={() => setResultOpen(true)}>
            查看进度
          </Button>
        )}
        <Button
          aria-label="展开双语提示词"
          type="primary"
          size="large"
          loading={busyStage === "final"}
          disabled={!config || !draft.scene.selected || busyStage === "concept"}
          onClick={generate}
        >
          {busyStage === "final" ? "正在展开与审校" : "展开双语提示词"}
        </Button>
      </div>
      <Drawer
        open={refinement}
        onClose={() => setRefinement(false)}
        title="精修条件"
        size="min(1280px, 100vw)"
        className="refinement-drawer"
        extra={
          <Button type="primary" onClick={() => setRefinement(false)}>
            完成精修
          </Button>
        }
      >
        <p className="muted">
          仅填写你想明确的细节。创作条件变化后，需要重新构思；数量与目标模型可随时调整。
        </p>
        <div className="scene-refinements">
          {[
            ["backdrop", "背景陪衬", "哪些只作陪衬，不争夺画面中心"],
            ["direction", "探索方向", "希望围绕什么动作或关系展开"],
            ["keep", "保持不变", "明确要保留的场景、对象或关系"],
            ["change", "允许变化", "可以变化的动作、空间或视点"],
          ].map(([key, label, placeholder]) => (
            <label className="scene-control" key={key}>
              <span>
                {label}
                <small>可选</small>
              </span>
              <Input.TextArea
                aria-label={label}
                rows={2}
                maxLength={1000}
                placeholder={placeholder}
                value={draft.scene[key]}
                onChange={(e) =>
                  updateDraft({
                    ...draft,
                    scene: { ...draft.scene, [key]: e.target.value },
                  })
                }
              />
            </label>
          ))}
        </div>
        <ConditionGrid draft={draft} onChange={updateDraft} />
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
            rows={4}
            onChange={(e) =>
              updateDraft({ ...draft, 负面提示词: e.target.value })
            }
            placeholder="留空表示不添加负面要求"
          />
        </div>
        <Button type="text" onClick={reset}>
          重置条件
        </Button>
      </Drawer>
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
              message.error(
                "接口配置或密钥未能完整保存；当前页面可使用，请重试保存后再刷新。",
              );
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
              if (p) replaceDraft(p.brief, true);
            }}
          />
          <Button
            onClick={() => {
              setPresetName((draft.scene.core || draft.题材).slice(0, 40));
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
          <Button type="text" onClick={reset}>
            重置条件
          </Button>
        </div>

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
          V17沿用V16的草稿、预设、最近30次结果与v5备份。旧结果保留原规范来源，不补造审校；更早记录请使用原版本查看。备份不包含API
          Key。
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
        {busyStage === "final" ? (
          <div className="generation-loading">
            <Spin size="large" />
            <h3>正在构建设计与双语提示词</h3>
            <p>完整生成通常调用文本模型两次（展开与审校），会增加等待与用量。你可以关闭弹窗，完成后从底部查看结果。</p>
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
