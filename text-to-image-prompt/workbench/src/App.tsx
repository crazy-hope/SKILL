import { providers } from "../shared/providers";
import React, { useEffect, useRef, useState } from "react";
import {
  Aperture,
  ArrowDownToLine,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronRight,
  Clapperboard,
  Copy,
  Frame,
  History,
  Layers3,
  LoaderCircle,
  MapPin,
  Menu,
  Moon,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Trash2,
  WandSparkles,
  X,
  Camera,
  Film,
  AlertCircle,
} from "lucide-react";
import { Button, cn } from "./components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./components/ui/dialog";
import { SettingsPanel } from "./components/SettingsPanel";
import { ModelDialog } from "./components/ModelDialog";
import { api } from "./api";
import {
  deleteHistory,
  loadDraft,
  loadHistory,
  saveDraft,
  saveHistory,
} from "./storage";
import {
  acceptPrompts,
  acceptScenes,
  editSettings,
  exportText,
  freshSession,
  selectScene,
  type Session,
} from "../shared/session";
import {
  missingSettings,
  settingKeys,
  type Clarification,
  type GenerationRequest,
  type GenerationResponse,
  type PublicConfig,
  type RuleStatus,
  type SettingKey,
  type Settings,
} from "../shared/contracts";
type Pending = Clarification & {
  stage: GenerationRequest["stage"];
  adviceField?: "aspectRatio" | "mjVersion";
};
type Advice = {
  field: "aspectRatio" | "mjVersion";
  explanation: string;
  value: string;
};
export default function App() {
  const [session, setSession] = useState<Session>(freshSession);
  const current = useRef(session);
  const [narrow, setNarrow] = useState(window.innerWidth < 1000);
  const [hydrated, setHydrated] = useState(false);
  const [rules, setRules] = useState<RuleStatus | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [modelOpen, setModelOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<Session[]>([]);
  const [lastSettings, setLastSettings] = useState<Settings | null>(null);
  const [errors, setErrors] = useState<SettingKey[]>([]);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState<GenerationRequest["stage"] | null>(null);
  const [started, setStarted] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [active, setActive] = useState<"scenes" | "prompts">("scenes");
  const [version, setVersion] = useState(0);
  const [amendment, setAmendment] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [answer, setAnswer] = useState("");
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [styleNotice, setStyleNotice] = useState(false);
  const [dark, setDark] = useState(
    () => localStorage.getItem("prompt-theme") === "dark",
  );
  const controller = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  const commit = (value: Session) => {
    current.current = value;
    setSession(value);
  };
  async function refreshStatus() {
    try {
      const [r, c] = await Promise.all([
        api<RuleStatus>("rules"),
        api<PublicConfig>("config"),
      ]);
      setRules(r);
      setConfig(c);
    } catch (e) {
      setError((e as Error).message);
      setRules(null);
    }
  }
  useEffect(() => {
    let disposed = false;
    Promise.all([loadDraft(), loadHistory()])
      .then(([draft, records]) => {
        if (disposed) return;
        if (draft) {
          current.current = draft;
          setSession(draft);
          if (draft.outputRevision === draft.revision && draft.versions.length)
            setActive("prompts");
        }
        setHistory(records);
        setLastSettings(records[0]?.settings ?? null);
      })
      .catch(() => {
        if (!disposed) setError("无法读取本地草稿。可继续创作，但请及时导出。");
      })
      .finally(() => {
        if (!disposed) setHydrated(true);
      });
    void refreshStatus();
    const focus = () => void refreshStatus();
    window.addEventListener("focus", focus);
    return () => {
      disposed = true;
      window.removeEventListener("focus", focus);
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    const resize = () => {
      const small = window.innerWidth < 1000;
      setNarrow(small);
      if (!small) setMobileOpen(false);
    };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(
      () =>
        void saveDraft(session).catch(() =>
          setError("自动保存失败，请及时导出当前结果。"),
        ),
      350,
    );
    return () => clearTimeout(timer);
  }, [session, hydrated]);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem("prompt-theme", dark ? "dark" : "light");
    } catch {
      /* theme remains usable in memory */
    }
  }, [dark]);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [busy, started]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(timer);
  }, [toast]);
  const cancel = () => {
    requestId.current++;
    controller.current?.abort();
    controller.current = null;
    setBusy(null);
  };
  function changeSettings(next: Settings) {
    const s = current.current;
    cancel();
    if (
      JSON.stringify(next.media) !== JSON.stringify(s.settings.media) &&
      s.settings.visualStyles.length
    )
      setStyleNotice(true);
    commit(editSettings(s, next));
    setErrors([]);
    setPending(null);
    setAdvice(null);
    setError("");
  }
  function reset() {
    cancel();
    setLastSettings(current.current.settings);
    commit(freshSession());
    setActive("scenes");
    setPending(null);
    setAdvice(null);
    setAmendment("");
    setErrors([]);
    setError("");
    setStyleNotice(false);
  }
  async function run(
    stage: GenerationRequest["stage"],
    opts: {
      adviceField?: "aspectRatio" | "mjVersion";
      answers?: Session["answers"];
    } = {},
  ) {
    if (busy) return;
    let s = current.current;
    if (stage === "scenes" && amendment.trim()) {
      const addition = `补充要求：${amendment.trim()}`;
      if (!s.settings.elements.includes(addition)) {
        s = editSettings(s, {
          ...s.settings,
          elements: [s.settings.elements, addition].filter(Boolean).join("\n"),
        });
        commit(s);
      }
    }
    if (stage !== "advice") {
      const missing = missingSettings(s.settings);
      setErrors(missing);
      if (missing.length) {
        setMobileOpen(window.innerWidth < 1000);
        setTimeout(
          () => document.getElementById(`field-${missing[0]}`)?.focus(),
          100,
        );
        setError("还有设置未完成，请查看左侧标记的项目。");
        return;
      }
    }
    if (!config?.hasKey || !config.model) {
      setModelOpen(true);
      setError("请先连接模型服务并选择模型。");
      return;
    }
    if (!rules?.synced) {
      setError("skill 尚未完成同步检查，请查看顶部规则状态。");
      return;
    }
    if (
      stage === "prompts" &&
      (s.scenesRevision !== s.revision ||
        s.ruleHash !== rules.hash ||
        !s.selectedId ||
        !s.mode)
    ) {
      setError("请根据当前设置重新选择场景和变化方式。");
      return;
    }
    const id = ++requestId.current;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(stage);
    setStarted(Date.now());
    setElapsed(0);
    setError("");
    setAdvice(null);
    setPending(null);
    setAnswer("");
    const answers = opts.answers ?? s.answers;
    if (opts.answers) {
      s = { ...s, answers };
      commit(s);
    }
    const input: GenerationRequest = {
      stage,
      settings: s.settings,
      revision: s.revision,
      ruleHash: rules.hash,
      scene:
        stage === "prompts"
          ? (s.scenes.find((x) => x.id === s.selectedId) ?? null)
          : null,
      mode: stage === "prompts" ? s.mode : null,
      previousScenes: [
        ...s.previousScenes,
        ...s.scenes.map((x) => `${x.title}: ${x.event}`.slice(0, 500)),
      ].slice(-100),
      amendment,
      answers,
      adviceField: opts.adviceField,
    };
    try {
      const result = await api<GenerationResponse>("generate", {
        method: "POST",
        body: JSON.stringify(input),
        signal: abort.signal,
      });
      if (id !== requestId.current || current.current.revision !== s.revision)
        return;
      const output = result.output;
      if (output.kind === "clarification") {
        setPending({ ...output, stage, adviceField: opts.adviceField });
        return;
      }
      if (output.kind === "advice") {
        setAdvice({
          field: opts.adviceField!,
          explanation: output.explanation,
          value: output.value,
        });
        return;
      }
      if (output.kind === "scenes") {
        commit({
          ...acceptScenes(
            current.current,
            output.scenes,
            result.revision,
            result.ruleHash,
          ),
          ruleVersion: result.ruleVersion,
        });
        setAmendment("");
        setActive("scenes");
        setMobileOpen(false);
        setToast("五个场景已就绪，选一个继续创作。");
      }
      if (output.kind === "prompts") {
        const next = {
          ...acceptPrompts(
            current.current,
            output.versions,
            result.revision,
            result.ruleHash,
            result.model,
          ),
          id: crypto.randomUUID(),
          ruleVersion: result.ruleVersion,
        };
        commit(next);
        setActive("prompts");
        setVersion(0);
        setLastSettings(next.settings);
        try {
          await saveHistory(next);
          setHistory(await loadHistory());
        } catch {
          setError("生成已完成，但历史保存失败，请导出结果。");
        }
        setToast("三个完整双语版本已生成。");
      }
    } catch (e) {
      if (id !== requestId.current) return;
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      if (id === requestId.current) {
        setBusy(null);
        controller.current = null;
      }
    }
  }
  function reply(value: string) {
    if (!pending || !value.trim()) return;
    void run(pending.stage, {
      adviceField: pending.adviceField,
      answers: [
        ...current.current.answers,
        { question: pending.question, answer: value.trim() },
      ],
    });
  }
  function chooseScene(id: string) {
    cancel();
    try {
      commit(selectScene(current.current, id));
      setPending(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setToast("已复制，可直接粘贴使用。");
    } catch {
      setError("复制未成功，请选中文本手动复制。");
    }
  }
  function download(markdown: boolean) {
    const blob = new Blob([exportText(session, markdown)], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `画外-${session.createdAt.slice(0, 10)}.${markdown ? "md" : "txt"}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function restore(record: Session) {
    cancel();
    commit(record);
    setActive(record.versions.length ? "prompts" : "scenes");
    setVersion(0);
    setHistoryOpen(false);
    setPending(null);
    setAdvice(null);
    setAmendment("");
    setErrors([]);
    setError("");
    setToast("已恢复历史创作。");
  }
  const missing = missingSettings(session.settings);
  const total = settingKeys.length;
  const count = total - missing.length;
  const selected = session.scenes.find((x) => x.id === session.selectedId);
  const scenesFresh =
    session.scenesRevision === session.revision &&
    session.ruleHash === rules?.hash;
  const outputFresh =
    session.outputRevision === session.revision &&
    session.ruleHash === rules?.hash;
  const step =
    session.versions.length && outputFresh
      ? 3
      : selected && scenesFresh
        ? 2
        : session.scenes.length && scenesFresh
          ? 1
          : 0;
  const panel = (
    <>
      <div className="panel-heading">
        <div>
          <SlidersHorizontal size={17} />
          <strong>创作设定</strong>
        </div>
        <span>
          {count}
          <span className="muted"> / {total}</span>
        </span>
      </div>
      <div
        className="completion-track"
        role="progressbar"
        aria-label="创作设置完成度"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={count}
      >
        <span style={{ width: `${(count / total) * 100}%` }} />
      </div>
      <div className="panel-tools">
        <span>十项选择，一次构思</span>
        <button
          disabled={!lastSettings}
          onClick={() => {
            if (lastSettings) changeSettings({ ...lastSettings });
          }}
        >
          沿用上次设置
        </button>
      </div>
      <SettingsPanel
        settings={session.settings}
        onChange={changeSettings}
        onAdvice={(f) => void run("advice", { adviceField: f })}
        errors={errors}
        disabled={false}
        styleNotice={styleNotice}
        advice={
          advice
            ? {
                field: advice.field,
                node: (
                  <div className="advice-box">
                    <strong>建议：{advice.value}</strong>
                    <p>{advice.explanation}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        changeSettings({
                          ...session.settings,
                          [advice.field]: advice.value,
                        })
                      }
                    >
                      确认采用
                    </Button>
                  </div>
                ),
              }
            : undefined
        }
      />
      <div className="panel-footer">
        <Button
          className="full-width"
          disabled={!!busy || !hydrated || !rules?.synced}
          onClick={() => void run("scenes")}
        >
          <WandSparkles size={16} />
          {session.scenes.length ? "重新构思场景" : "生成五个场景"}
          <ArrowRight size={16} />
        </Button>
        <p>选择决定方向，skill 负责展开画面。</p>
      </div>
    </>
  );
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" onClick={(e) => e.preventDefault()}>
          <span className="brand-icon">
            <Aperture size={24} />
          </span>
          <div>
            <strong>
              画外<span className="brand-dot">.</span>
            </strong>
            <span>PROMPT STUDIO</span>
          </div>
        </a>
        <div className="topbar-divider" />
        <span className="app-caption">
          提示词创作工作台 <small>v3</small>
        </span>
        <div className="top-actions">
          <Button
            variant="ghost"
            size="sm"
            aria-label="新建创作"
            onClick={reset}
          >
            <Plus size={16} />
            <span className="desktop-label">新建创作</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="历史"
            onClick={() => setHistoryOpen(true)}
          >
            <History size={16} />
            <span className="desktop-label">历史</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={dark ? "切换浅色主题" : "切换深色主题"}
            onClick={() => setDark(!dark)}
          >
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setModelOpen(true)}
          >
            <span
              className={cn(
                "status-dot",
                config?.hasKey && config.model && "connected",
              )}
            />
            <span>
              {config?.hasKey && config.model
                ? `${providers[config.provider ?? "deepseek"].name} 已配置`
                : "连接模型"}
            </span>
            <Settings2 size={14} />
          </Button>
        </div>
      </header>
      <div className="body-layout">
        {!narrow && <aside className="settings-panel">{panel}</aside>}
        <main className="workspace">
          <div className="workspace-top">
            <div className="workspace-label">
              <span className="eyebrow">CREATIVE WORKSPACE</span>
              <span className="muted">让想象，有据可循</span>
            </div>
            <button
              className={cn("rule-status", rules && !rules.synced && "warning")}
              onClick={() => void refreshStatus()}
              title={rules?.changedFiles.join("\n") || "点击刷新同步状态"}
            >
              {rules?.synced ? (
                <ShieldCheck size={14} />
              ) : (
                <AlertCircle size={14} />
              )}
              <span>
                Skill {rules?.version ?? "…"} ·{" "}
                {rules?.synced ? "已同步" : rules ? "需要同步检查" : "正在读取"}
              </span>
              <RefreshCw size={11} />
            </button>
          </div>
          <nav className="steps" aria-label="创作流程">
            {["填写设定", "选择场景", "选择变化", "完整提示词"].map(
              (label, i) => (
                <div
                  key={label}
                  className={cn(
                    "step",
                    step === i && "current",
                    step > i && "done",
                  )}
                >
                  <span className="step-circle">
                    {step > i ? <Check size={13} /> : i + 1}
                  </span>
                  <span>{label}</span>
                  {i < 3 && <ChevronRight size={14} className="step-arrow" />}
                </div>
              ),
            )}
          </nav>
          <div className="workspace-content">
            <Button
              variant="outline"
              className="mobile-settings"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={16} />
              创作设定{" "}
              <span>
                {count}/{total}
              </span>
            </Button>
            {rules && !rules.synced && (
              <div className="error-box">
                <strong>skill 已变化，需要同步检查</strong>
                <p>草稿和历史仍可查看。请先同步面板与流程，再继续生成。</p>
                <small>{rules.changedFiles.join("、")}</small>
              </div>
            )}
            {error && (
              <div className="error-box" role="alert">
                <AlertCircle size={16} />
                <span>{error}</span>
                <button aria-label="关闭提示" onClick={() => setError("")}>
                  <X size={15} />
                </button>
              </div>
            )}
            {busy && (
              <div className="generating" role="status">
                <span className="generating-icon">
                  <LoaderCircle size={21} className="spin" />
                </span>
                <div>
                  <strong>
                    {busy === "scenes"
                      ? "正在构思五个不同场景"
                      : busy === "prompts"
                        ? "正在展开完整双语提示词"
                        : "正在分析你的设置"}
                  </strong>
                  <p>结合当前选择与 skill 创作规则 · 已等待 {elapsed} 秒</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    cancel();
                    setToast("已取消，当前内容已保留。");
                  }}
                >
                  取消
                </Button>
              </div>
            )}
            {pending && (
              <div className="clarification">
                <span className="eyebrow">需要你决定</span>
                <h3>{pending.question}</h3>
                <p>原有条件保持不变；你的回答会作为本轮明确取舍。</p>
                {pending.settingField ? (
                  <div className="parameter-resolution">
                    <p>
                      这个取舍会改变实际参数，请修改设置面板中的版本或个人化选项，再重新生成场景。文字回答不会替换已选参数。
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setMobileOpen(window.innerWidth < 1000);
                        setTimeout(
                          () =>
                            document
                              .getElementById(`field-${pending.settingField}`)
                              ?.focus(),
                          100,
                        );
                      }}
                    >
                      修改对应设置
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="chips">
                      {pending.options.map((v) => (
                        <Button
                          variant="outline"
                          key={v}
                          disabled={!!busy}
                          onClick={() => reply(v)}
                        >
                          {v}
                        </Button>
                      ))}
                    </div>
                    <div className="inline-row">
                      <input
                        aria-label="补充回答"
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder="也可以输入自己的决定"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.nativeEvent.isComposing)
                            reply(answer);
                        }}
                      />
                      <Button
                        disabled={!answer.trim() || !!busy}
                        onClick={() => reply(answer)}
                      >
                        继续
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
            {session.answers.length > 0 && (
              <details className="answers-summary">
                <summary>本轮已确认 {session.answers.length} 项取舍</summary>
                {session.answers.map((a, i) => (
                  <p key={i}>
                    {a.question}
                    <br />
                    <strong>{a.answer}</strong>
                  </p>
                ))}
              </details>
            )}
            {!session.scenes.length && !busy && !pending ? (
              <div className="empty-workspace">
                <div className="empty-art" aria-hidden="true">
                  <div className="art-dots" />
                  <div className="art-frame back">
                    <span />
                  </div>
                  <div className="art-frame front">
                    <span className="art-sun" />
                    <span className="art-mountain one" />
                    <span className="art-mountain two" />
                    <span className="art-cross top" />
                    <span className="art-cross bottom" />
                    <div className="art-frame-label">YOUR NEXT FRAME</div>
                  </div>
                  <span className="art-spark">
                    <Sparkles size={22} />
                  </span>
                  <span className="art-label">从一个念头开始</span>
                </div>
                <span className="eyebrow">
                  A LITTLE DIRECTION. ENDLESS POSSIBILITY.
                </span>
                <h1>
                  你的下一幅画，
                  <br />
                  从这里开始<span>。</span>
                </h1>
                <p>
                  在左侧留下几个选择，或一个模糊的念头。
                  <br />
                  把灵感交给创作规则，把决定留给自己。
                </p>
                <div className="empty-flow">
                  <span>
                    <Layers3 size={16} />5 个场景构思
                  </span>
                  <span className="flow-line" />
                  <span>
                    <Frame size={16} />1 个选定场景
                  </span>
                  <span className="flow-line" />
                  <span>
                    <Copy size={16} />3 组双语提示词
                  </span>
                </div>
                <div className="empty-note">
                  <ShieldCheck size={13} />
                  只生成提示词，保留你的每一项硬条件。
                </div>
              </div>
            ) : (
              <>
                {(session.scenes.length > 0 || session.versions.length > 0) && (
                  <div className="content-tabs">
                    <button
                      className={cn(active === "scenes" && "active")}
                      onClick={() => setActive("scenes")}
                    >
                      <Layers3 size={16} />
                      场景构思<span>{session.scenes.length}</span>
                    </button>
                    <button
                      disabled={!session.versions.length}
                      className={cn(active === "prompts" && "active")}
                      onClick={() => setActive("prompts")}
                    >
                      <Clapperboard size={16} />
                      提示词成品{session.versions.length > 0 && <span>3</span>}
                    </button>
                  </div>
                )}
                {active === "scenes" && session.scenes.length > 0 && (
                  <>
                    <div className="section-intro">
                      <div>
                        <span className="eyebrow">FIND YOUR SCENE</span>
                        <h2>哪一个瞬间，让你想停下来？</h2>
                        <p>五种不同构思，共同保留你的创作条件。</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!!busy || !rules?.synced}
                        onClick={() => void run("scenes")}
                      >
                        <RefreshCw size={14} />
                        换一批
                      </Button>
                    </div>
                    {!scenesFresh && (
                      <p className="stale-banner">
                        以下是旧条件下的场景。设置或规则已变化，请重新构思后选择。
                      </p>
                    )}
                    <div className="scene-grid">
                      {session.scenes.map((scene, i) => (
                        <button
                          key={scene.id}
                          className={cn(
                            "scene-card",
                            session.selectedId === scene.id &&
                              scenesFresh &&
                              "selected",
                          )}
                          disabled={!scenesFresh || !!busy}
                          onClick={() => chooseScene(scene.id)}
                          aria-pressed={
                            session.selectedId === scene.id && scenesFresh
                          }
                        >
                          <div className="scene-card-top">
                            <span className="scene-index">
                              SCENE{" "}
                              <strong>{String(i + 1).padStart(2, "0")}</strong>
                            </span>
                            <span className="scene-check">
                              {session.selectedId === scene.id && (
                                <Check size={14} />
                              )}
                            </span>
                          </div>
                          <h3>{scene.title}</h3>
                          <div className="scene-location">
                            <MapPin size={12} />
                            {scene.location}
                          </div>
                          <p className="scene-event">{scene.event}</p>
                          <p>
                            <strong>互动</strong>
                            {scene.interaction}
                          </p>
                          <p>
                            <strong>看点</strong>
                            {scene.highlight}
                          </p>
                          <div className="scene-style">
                            <Sparkles size={13} />
                            <span>{scene.style}</span>
                          </div>
                          <div className="scene-tags">
                            <span>{scene.reality}</span>
                            <span>{scene.culture}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="amendment">
                      <label htmlFor="amendment">再靠近你的想法一点</label>
                      <div className="inline-row">
                        <input
                          id="amendment"
                          value={amendment}
                          onChange={(e) => {
                            cancel();
                            setAmendment(e.target.value);
                          }}
                          placeholder="补充修改意见，将保留为本轮硬条件"
                        />
                        <Button
                          variant="outline"
                          disabled={
                            !amendment.trim() || !!busy || !rules?.synced
                          }
                          onClick={() => void run("scenes")}
                        >
                          修改构思
                        </Button>
                      </div>
                    </div>
                    {selected && scenesFresh && (
                      <section className="variation-section">
                        <span className="eyebrow">
                          ONE SCENE, THREE EXPRESSIONS
                        </span>
                        <h2>同一个场景，想怎样展开？</h2>
                        <p className="muted">已选：{selected.title}</p>
                        <div className="variation-grid">
                          {(
                            [
                              {
                                id: "camera",
                                icon: Camera,
                                title: "同一瞬间，不同拍法",
                                desc: "人物、动作和事件保持不变，只改变机位、景别、构图与焦点。",
                              },
                              {
                                id: "story",
                                icon: Film,
                                title: "同一场景，不同故事瞬间",
                                desc: "保留人物与世界设定，展开三个不同的互动、动作与瞬间。",
                              },
                            ] as const
                          ).map((item) => (
                            <button
                              key={item.id}
                              className={cn(
                                "variation-card",
                                session.mode === item.id && "selected",
                              )}
                              aria-pressed={session.mode === item.id}
                              onClick={() => {
                                cancel();
                                commit({
                                  ...current.current,
                                  mode: item.id,
                                  outputRevision: -1,
                                });
                              }}
                            >
                              <item.icon size={23} />
                              <strong>{item.title}</strong>
                              <p>{item.desc}</p>
                              <span className="scene-check">
                                {session.mode === item.id && (
                                  <Check size={14} />
                                )}
                              </span>
                            </button>
                          ))}
                        </div>
                        <div className="generate-final">
                          <span>完整中文 + English · 三个独立可用版本</span>
                          <Button
                            disabled={
                              !session.mode ||
                              !!busy ||
                              !rules?.synced ||
                              !!amendment.trim()
                            }
                            onClick={() => void run("prompts")}
                          >
                            <Sparkles size={16} />
                            生成完整提示词
                            <ArrowRight size={16} />
                          </Button>
                        </div>
                      </section>
                    )}
                  </>
                )}
                {active === "prompts" && session.versions.length > 0 && (
                  <>
                    <div className="section-intro">
                      <div>
                        <span className="eyebrow">
                          READY FOR YOUR NEXT IMAGE
                        </span>
                        <h2>让画面，从文字里发生。</h2>
                        <p>
                          {selected?.title ?? "完整双语提示词"} ·{" "}
                          {session.mode === "camera"
                            ? "同一瞬间，不同拍法"
                            : "同一场景，不同故事瞬间"}
                        </p>
                      </div>
                    </div>
                    {!outputFresh && (
                      <p className="stale-banner">
                        这是之前设置下的结果，可复制或导出；新条件需要重新生成。
                      </p>
                    )}
                    <div className="result-toolbar">
                      <div
                        className="version-tabs"
                        role="tablist"
                        aria-label="提示词版本"
                      >
                        {session.versions.map((_v, i) => (
                          <button
                            key={i}
                            role="tab"
                            aria-selected={version === i}
                            onClick={() => setVersion(i)}
                          >
                            版本 {String(i + 1).padStart(2, "0")}
                          </button>
                        ))}
                      </div>
                      <div className="result-actions">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void copy(exportText(session, false))}
                        >
                          <Copy size={14} />
                          复制全部
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => download(true)}
                        >
                          <ArrowDownToLine size={14} />
                          MD
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => download(false)}
                        >
                          TXT
                        </Button>
                      </div>
                    </div>
                    <article className="prompt-result">
                      <div className="prompt-result-heading">
                        <span className="eyebrow">
                          VERSION {String(version + 1).padStart(2, "0")}
                        </span>
                        <h3>{session.versions[version]?.title}</h3>
                        <span className="badge">
                          <CheckCheck size={12} />
                          完整双语
                        </span>
                      </div>
                      {(["zh", "en"] as const).map((lang) => (
                        <section key={lang} className="language-block">
                          <div>
                            <span>
                              {lang === "zh" ? "中文" : "English"}
                              <small>
                                {lang === "zh"
                                  ? "CHINESE PROMPT"
                                  : "ENGLISH PROMPT"}
                              </small>
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                void copy(session.versions[version][lang])
                              }
                            >
                              <Copy size={14} />
                              复制
                            </Button>
                          </div>
                          <pre>{session.versions[version]?.[lang]}</pre>
                        </section>
                      ))}
                    </article>
                    <div className="result-footnote">
                      <ShieldCheck size={13} />
                      规则版本 {session.ruleVersion} · {session.model} · 请在
                      Midjourney 中自行提交生图。
                    </div>
                    {session.settings.personalize === "off" && (
                      <p className="notice-inline">
                        你选择了关闭 Personalize。请同时关闭 Midjourney
                        界面的个人化开关；省略参数本身不会关闭默认设置。
                      </p>
                    )}
                  </>
                )}
              </>
            )}
          </div>
          <footer className="workspace-footer">
            <span>画外 · 提示词创作工作台</span>
            <span>灵感自由，条件清晰。</span>
          </footer>
        </main>
      </div>
      <ModelDialog
        open={modelOpen}
        onOpenChange={setModelOpen}
        config={config}
        onConfig={setConfig}
      />
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent className="settings-drawer">
          <DialogTitle className="sr-only">创作设定</DialogTitle>
          <DialogDescription className="sr-only">
            填写十项创作设置
          </DialogDescription>
          {panel}
        </DialogContent>
      </Dialog>
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="history-dialog">
          <DialogTitle className="dialog-title">创作历史</DialogTitle>
          <DialogDescription className="dialog-description">
            保存在此浏览器，最多保留最近 50 次完成记录。
          </DialogDescription>
          {!history.length ? (
            <div className="history-empty">
              <History size={32} />
              <p>完成第一次创作后，它会出现在这里。</p>
            </div>
          ) : (
            <div className="history-list">
              {history.map((record) => (
                <div className="history-row" key={record.id}>
                  <button onClick={() => restore(record)}>
                    <strong>
                      {record.scenes.find((s) => s.id === record.selectedId)
                        ?.title ??
                        record.versions[0]?.title ??
                        "未命名创作"}
                    </strong>
                    <span>
                      {new Date(record.createdAt).toLocaleString("zh-CN")} ·{" "}
                      {record.ruleVersion}
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`删除${record.versions[0]?.title ?? "记录"}`}
                    onClick={() =>
                      void deleteHistory(record.id)
                        .then(() => loadHistory())
                        .then(setHistory)
                        .catch(() => setError("历史删除失败，请重试"))
                    }
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
      {toast && (
        <div role="status" className="toast">
          <Check size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}
