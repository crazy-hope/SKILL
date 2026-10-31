import { useEffect, useRef, useState } from "react";
import {
  freshBrief,
  resetFive,
  validateBrief,
  validateResult,
  loadWorkspace,
  saveWorkspace,
  parseBackup,
  loadConnection,
  saveConnection,
} from "../model.mjs";
import {tones} from "./tones.js";
import {applyTone,matchesTone,finishToneParameters} from "../tones.mjs";
const emptyConnection = () => ({
  provider: "openai",
  profiles: { openai: { model: "" }, deepseek: { model: "" } },
  keys: { openai: "", deepseek: "" },
});
export function useWorkbench() {
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
    [previewResult, setPreviewResult] = useState(null),
    [output, setOutput] = useState({ status: "idle", requestId: 0 }),
    [models, setModels] = useState([]);
  const outputSequence = useRef(0);
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
    const requestId = stage === "generate" ? ++outputSequence.current : null;
    const finishOutput = (next) => {
      if (stage === "generate")
        setOutput((previous) =>
          previous.requestId === requestId ? { ...next, requestId } : previous,
        );
    };
    if (stage === "generate") {
      setPreviewResult(null);
      setOutput({ status: "loading", requestId });
      setDialog("results");
    }
    setBusy(stage);
    setMessage("");
    setQuestions([]);
    try {
      const out = await post("/api/" + stage, { ...auth, brief: input });
      if (!mounted.current) return;
      if (revision.current !== stamp) {
        setMessage("条件已变更，本次返回已忽略。请按当前内容重新生成。");
        finishOutput({
          status: "error",
          error: "条件已变更，本次返回已忽略。请按当前内容重新生成。",
        });
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
        finishOutput({ status: "clarification", questions: out.questions });
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
        const clean = validateResult(finishToneParameters(validateResult(out)));
        if (
          JSON.stringify(clean.brief) !== JSON.stringify(validateBrief(input))
        )
          throw Error("结果与提交输入不一致，未保存。");
        setResult(clean);
        finishOutput({ status: "ready" });
        setData((v) => ({ ...v, history: [clean, ...v.history].slice(0, 30) }));
        setMessage("双语提示词已生成。");
      }
    } catch (e) {
      if (mounted.current) {
        const error =
          revision.current === stamp
            ? e.message
            : "条件已变更，本次返回已忽略。请按当前内容重新生成。";
        setMessage(error);
        finishOutput({ status: "error", error });
      }
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
        setPreviewResult(null);
        setOutput({ status: "idle", requestId: ++outputSequence.current });
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
    setPreviewResult(null);
    setOutput({ status: "idle", requestId: ++outputSequence.current });
    setMessage("已新建输入，历史仍保留。");
    setDialog("");
  }

  function selectTone(name) {
    const tone = tones.find(t => t.name === name);
    if (!tone) return;
    change(b => applyTone(b, tone));
    setUndo(null);
    setMessage(`已切换基调：${name}；描绘内容与其他设置保留。`);
  }
  function restoreFive() {
    change(resetFive);
    setMessage("已恢复五项默认，主体内容保留。");
  }
  function undoSubject() {
    if (!undo || brief.subject !== undo.after) return;
    change((b) => ({ ...b, subject: undo.before }));
    setUndo(null);
    setMessage("已撤销本次AI描述。");
  }
  function saveSettings() {
    try {
      saveConnection(localStorage, connection);
      setConnectionError("");
      setMessage("接口设置已保存。");
      setDialog("");
    } catch {
      setMessage("接口设置保存失败，请检查浏览器存储权限。");
    }
  }
  function viewHistory(r) {
    setPreviewResult(r);
    setDialog("results");
    setMessage("");
  }
  function reuseHistory(r) {
    change(r.brief);
    setUndo(null);
    setDialog("");
    setMessage("已将历史输入载入，生成记录保持原样。");
  }
  function openOutput() {
    setPreviewResult(null);
    setMessage("");
    setDialog("results");
  }
  return {
    tones,
    selectedTone: tones.find(t => matchesTone(brief, t))?.name,
    selectTone,
    output,
    previewResult,
    openOutput,
    data,
    brief,
    storageError,
    raw,
    connection,
    connectionError,
    config,
    dialog,
    message,
    busy,
    questions,
    undo,
    result,
    models,
    field,
    change,
    editConnection,
    generate,
    getModels,
    copy,
    restoreFile,
    reset,
    restoreFive,
    undoSubject,
    saveSettings,
    viewHistory,
    reuseHistory,
    setDialog,
    setMessage,
  };
}
