import React, { useEffect, useRef, useState } from "react";
import {
  App as AntApp,
  Alert,
  Button,
  Collapse,
  ConfigProvider,
  Form,
  Input,
  InputNumber,
  Select,
  Segmented,
  Space,
  Tag,
  Tooltip,
} from "antd";
import zhCN from "antd/locale/zh_CN";
import {
  PlusOutlined,
  CopyOutlined,
  SettingOutlined,
  PlayCircleOutlined,
  PauseOutlined,
  PictureOutlined,
  ArrowRightOutlined,
  VideoCameraOutlined,
  CheckOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import {
  makeTask,
  canGenerate,
  batchCandidates,
  api,
  DETAIL_FIELDS,
} from "./workbench.js";
import { assertImageSignature } from "../public/image.js";
import ConnectionDrawer from "./ConnectionDrawer.jsx";
import ResultPane from "./ResultPane.jsx";
import "./styles.css";
const levels = [
  { label: "自动", value: "auto" },
  { label: "简短", value: "short" },
  { label: "中等", value: "medium" },
  { label: "细致", value: "detailed" },
];
function Workbench() {
  const [, render] = useState(0);
  const redraw = () => render((n) => n + 1);
  const [config, setConfig] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [active, setActive] = useState(1);
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState("edit");
  const tasks = useRef(null);
  const nextId = useRef(5);
  const imageInput = useRef(null);
  const { message } = AntApp.useApp();
  if (!tasks.current)
    tasks.current = [1, 2, 3, 4].map((id) => makeTask(id, redraw));
  const task = tasks.current.find((t) => t.id === active);
  const g = task.generation;
  async function load() {
    try {
      const data = await api("config");
      setConfig(data);
      setLoadError("");
      return data;
    } catch (e) {
      setLoadError(e.message);
    }
  }
  useEffect(() => {
    load();
    return () => tasks.current.forEach((t) => t.generation.cancel());
  }, []);
  useEffect(() => {
    const warn = (e) => {
      if (
        tasks.current.some(
          (t) =>
            t.image || t.input.idea || t.generation.busy || t.generation.record,
        )
      ) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  function change(field, value) {
    task.input[field] = value;
    g.changed();
    redraw();
  }
  function detail(field, value) {
    task.input.details[field] = value;
    g.changed();
  }
  function add(source) {
    const t = makeTask(nextId.current++, redraw, source);
    tasks.current.push(t);
    setActive(t.id);
    setMobileTab("edit");
  }
  async function readImage(file) {
    if (!file) return;
    const target = task;
    const sequence = ++target.imageSequence;
    target.imageLoading = true;
    target.generation.changed();
    redraw();
    try {
      if (file.size > (config?.maxImageBytes || 10485760))
        throw Error("图片超过本机大小上限，请压缩后重试。");
      const bytes = new Uint8Array(await file.arrayBuffer());
      assertImageSignature(bytes, file.type);
      const bitmap = await createImageBitmap(file);
      const pixels = bitmap.width * bitmap.height;
      bitmap.close();
      if (pixels > 80000000) throw Error("图片像素过大，请缩小后重试。");
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(Error("图片读取失败"));
        reader.readAsDataURL(file);
      });
      if (sequence !== target.imageSequence) return;
      target.image = data;
      target.imageName = file.name;
      target.generation.changed();
    } catch (e) {
      if (sequence === target.imageSequence) message.error(e.message);
    } finally {
      if (sequence === target.imageSequence) {
        target.imageLoading = false;
        redraw();
      }
    }
  }
  function clearImage() {
    task.imageSequence++;
    task.imageLoading = false;
    task.image = "";
    task.imageName = "";
    g.changed();
  }
  function generate(t) {
    if (!canGenerate(t, config)) return;
    const payload = {
      ...structuredClone(t.input),
      image: t.image,
      version: config.skillVersion,
    };
    t.generation.run((signal) => api("generate", { body: payload, signal }));
  }
  const batch = batchCandidates(tasks.current, config);
  const running = tasks.current.filter((t) => t.generation.busy).length;
  const phase = (t) =>
    t.generation.busy
      ? "生成中"
      : t.generation.error
        ? "待重试"
        : t.generation.stale
          ? "待更新"
          : t.generation.record
            ? "已完成"
            : t.image
              ? "待生成"
              : "待上传";
  return (
    <div className="workbench">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <VideoCameraOutlined />
          </span>
          <div>
            <strong>
              成镜 <span>FRAME / MOTION</span>
            </strong>
            <small>图生视频提示词工作台</small>
          </div>
        </div>
        <div className="topbar-actions">
          {new URLSearchParams(location.search).has("mock") && (
            <Tag color="orange">本地模拟 · 无真实生成</Tag>
          )}
          <span className="version-label">
            {config?.appVersion || "—"} · {config?.skillVersion || "…"}
          </span>
          <Button
            aria-label={config?.ready ? "连接设置" : "配置服务"}
            icon={<SettingOutlined />}
            onClick={() => setConnectionOpen(true)}
          >
            <span
              className={`connection-dot ${config?.ready ? "ready" : ""}`}
            />
            {config?.ready ? "连接设置" : "配置服务"}
          </Button>
        </div>
      </header>
      {new URLSearchParams(location.search).has("mock") && (
        <div className="mock-banner">本地模拟预览 · 未调用真实模型</div>
      )}
      {loadError && (
        <Alert
          type="error"
          showIcon
          title={loadError}
          action={<Button onClick={load}>重新连接</Button>}
        />
      )}
      <div className="workspace">
        <nav className="task-rail" aria-label="镜头任务">
          <div className="rail-heading">
            <span>
              我的镜头 <em>{tasks.current.length}</em>
            </span>
            <Tooltip title="新增镜头">
              <Button
                aria-label="新增镜头"
                size="small"
                type="text"
                icon={<PlusOutlined />}
                onClick={() => add()}
              />
            </Tooltip>
          </div>
          <div className="task-list">
            {tasks.current.map((t) => (
              <button
                key={t.id}
                className={`task-item ${active === t.id ? "selected" : ""}`}
                data-testid={`task-${t.id}`}
                aria-current={active === t.id ? "true" : undefined}
                onClick={() => {
                  setActive(t.id);
                  setMobileTab("edit");
                }}
              >
                <div className="task-thumbnail">
                  {t.image ? <img src={t.image} alt="" /> : <PictureOutlined />}
                  {t.generation.busy && (
                    <span className="thumb-loading">
                      <LoadingOutlined />
                    </span>
                  )}
                </div>
                <div className="task-label">
                  <strong>{t.title}</strong>
                  <span className={t.generation.error ? "error-text" : ""}>
                    {phase(t)}
                  </span>
                </div>
                {t.generation.record &&
                  !t.generation.stale &&
                  !t.generation.busy && (
                    <CheckOutlined className="completed-icon" />
                  )}
              </button>
            ))}
          </div>
          <div className="rail-bottom">
            <Button
              block
              icon={<PlayCircleOutlined />}
              disabled={!batch.length}
              onClick={() => batch.forEach(generate)}
              data-testid="generate-all"
            >
              全部生成{batch.length ? ` · ${batch.length}` : ""}
            </Button>
            <p>
              {running
                ? `${running} 个镜头正在生成`
                : "各镜头独立生成，互不干扰"}
            </p>
          </div>
        </nav>
        <main className="main-work">
          <div className="mobile-switch">
            <Segmented
              block
              options={[
                { label: "编辑镜头", value: "edit" },
                { label: "查看结果", value: "result" },
              ]}
              value={mobileTab}
              onChange={setMobileTab}
            />
          </div>
          <div className={`editor-result mobile-${mobileTab}`}>
            <section className="editor-pane" aria-label="镜头编辑">
              <div className="pane-heading">
                <div>
                  <span className="eyebrow">CREATE YOUR SHOT</span>
                  <h2>
                    {task.title} <span>创作设置</span>
                  </h2>
                </div>
                <Tooltip title="复制图片和要求，创建新镜头">
                  <Button
                    aria-label="复制镜头"
                    type="text"
                    icon={<CopyOutlined />}
                    onClick={() => add(task)}
                  />
                </Tooltip>
              </div>
              <div className="editor-scroll">
                <div
                  className={`image-upload ${task.image ? "has-image" : ""}`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    readImage(e.dataTransfer.files[0]);
                  }}
                  onPaste={(e) => {
                    const file = [...e.clipboardData.items]
                      .find((x) => x.type.startsWith("image/"))
                      ?.getAsFile();
                    if (file) {
                      e.preventDefault();
                      readImage(file);
                    }
                  }}
                  tabIndex={0}
                  aria-label="首帧图片，可拖放或粘贴"
                >
                  <input
                    ref={imageInput}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    hidden
                    data-testid="image-input"
                    onChange={(e) => {
                      readImage(e.target.files[0]);
                      e.target.value = "";
                    }}
                  />
                  {task.image ? (
                    <>
                      <img src={task.image} alt={`${task.title}首帧参考图`} />
                      <div className="image-tools">
                        <span title={task.imageName}>{task.imageName}</span>
                        <Button
                          size="small"
                          onClick={() => imageInput.current.click()}
                        >
                          替换
                        </Button>
                        <Button size="small" onClick={clearImage}>
                          移除
                        </Button>
                      </div>
                    </>
                  ) : (
                    <button
                      className="upload-trigger"
                      onClick={() => imageInput.current.click()}
                    >
                      <span className="upload-icon">
                        <PictureOutlined />
                      </span>
                      <strong>把故事的第一帧放在这里</strong>
                      <span>点击上传，也可拖入或粘贴图片</span>
                      <small>
                        PNG / JPEG / WebP · 最大{" "}
                        {Math.round(
                          (config?.maxImageBytes || 10485760) / 1048576,
                        )}{" "}
                        MB
                      </small>
                    </button>
                  )}
                  {task.imageLoading && (
                    <div className="image-loading">
                      <LoadingOutlined /> 正在读取图片
                    </div>
                  )}
                </div>
                <Form
                  layout="vertical"
                  requiredMark={false}
                  className="creation-form"
                >
                  <Form.Item
                    label={
                      <span>
                        你希望画面如何发生？{" "}
                        <small className="muted">可选</small>
                      </span>
                    }
                    extra="留空时根据图片自动构思；填写后优先保留你的动作、速度和收尾要求。"
                  >
                    <Input.TextArea
                      aria-label="创作要求"
                      data-testid="idea"
                      value={task.input.idea}
                      onChange={(e) => change("idea", e.target.value)}
                      placeholder="例如：人物缓缓回眸，长发随风持续摆动，镜头向后退，最后停留在远景。"
                      autoSize={{ minRows: 3, maxRows: 8 }}
                      maxLength={6000}
                    />
                  </Form.Item>
                  <div className="form-row">
                    <Form.Item label="目标视频模型">
                      <Select
                        aria-label="目标视频模型"
                        data-testid="video-model"
                        value={task.input.videoModel}
                        onChange={(v) => change("videoModel", v)}
                        options={(config?.models || []).map((m) => ({
                          value: m.id,
                          label: m.label,
                        }))}
                      />
                    </Form.Item>
                    <Form.Item label="提示词详细程度">
                      <Segmented
                        options={levels}
                        value={task.input.level}
                        onChange={(v) => change("level", v)}
                      />
                    </Form.Item>
                  </div>
                  <div className="form-row timing-row">
                    <Form.Item label="视频时长">
                      <InputNumber
                        aria-label="视频时长"
                        value={task.input.duration}
                        onChange={(v) => change("duration", v)}
                        min={0.1}
                        step={1}
                        suffix="秒"
                        style={{ width: "100%" }}
                      />
                    </Form.Item>
                    <Form.Item label="画面比例">
                      <Select
                        aria-label="画面比例"
                        value={task.input.aspectRatio}
                        onChange={(v) => change("aspectRatio", v)}
                        options={[
                          "original",
                          "16:9",
                          "9:16",
                          "1:1",
                          "4:3",
                          "3:4",
                          "21:9",
                        ].map((x) => ({
                          value: x,
                          label: x === "original" ? "保持原图" : x,
                        }))}
                      />
                    </Form.Item>
                  </div>
                  <Collapse
                    ghost
                    className="details-collapse"
                    items={[
                      {
                        key: "details",
                        label: "细化动作、运镜与声音",
                        extra: <span className="muted">按需填写</span>,
                        children: (
                          <>
                            {Object.entries(DETAIL_FIELDS).map(
                              ([field, label]) => (
                                <Form.Item key={field} label={label}>
                                  <Input.TextArea
                                    aria-label={label}
                                    value={task.input.details[field]}
                                    onChange={(e) =>
                                      detail(field, e.target.value)
                                    }
                                    autoSize={{ minRows: 2, maxRows: 5 }}
                                    maxLength={2000}
                                  />
                                </Form.Item>
                              ),
                            )}
                          </>
                        ),
                      },
                      {
                        key: "platform",
                        label: "平台入口",
                        children: (
                          <Form.Item
                            label="使用的平台或 API"
                            extra="规则按实际入口适配；尚未确定时会标注待确认项。"
                          >
                            <Input
                              aria-label="平台入口"
                              value={task.input.platform}
                              onChange={(e) =>
                                change("platform", e.target.value)
                              }
                              placeholder="例如：快手可灵网页 / 火山方舟 API"
                            />
                          </Form.Item>
                        ),
                      },
                    ]}
                  />
                </Form>
              </div>
              <div className="editor-actions">
                {!config?.ready && config && (
                  <div className="connection-hint">
                    先连接一个支持看图的模型服务{" "}
                    <Button
                      type="link"
                      size="small"
                      onClick={() => setConnectionOpen(true)}
                    >
                      去配置 <ArrowRightOutlined />
                    </Button>
                  </div>
                )}
                {g.message && !g.busy && !g.record && (
                  <p className="muted" role="status">
                    {g.message}
                  </p>
                )}
                <div className="generate-row">
                  <span className="muted">首帧图生视频 · 单镜头</span>
                  {g.busy ? (
                    <Button
                      icon={<PauseOutlined />}
                      onClick={() => g.cancel()}
                      data-testid="cancel"
                    >
                      取消等待
                    </Button>
                  ) : (
                    <Button
                      type="primary"
                      icon={<PlayCircleOutlined />}
                      size="large"
                      disabled={!canGenerate(task, config)}
                      onClick={() => {
                        generate(task);
                        setMobileTab("result");
                      }}
                      data-testid="generate"
                    >
                      {g.error
                        ? "重试生成"
                        : g.record
                          ? "重新生成"
                          : "生成提示词"}
                    </Button>
                  )}
                </div>
              </div>
            </section>
            <ResultPane task={task} key={task.id} />
          </div>
        </main>
      </div>
      <ConnectionDrawer
        open={connectionOpen}
        onClose={() => setConnectionOpen(false)}
        config={config}
        onSaved={async () => {
          tasks.current.forEach((t) => t.generation.changed());
          await load();
        }}
      />
    </div>
  );
}
export default function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        // Other React roots (including extensions) can share the default useId.
        // A stable app-owned key keeps their CSS-in-JS token writes separate.
        cssVar: { key: "chengjing-workbench-theme" },
        token: {
          colorPrimary: "#6355cb",
          colorInfo: "#6355cb",
          borderRadius: 9,
          fontFamily:
            'Inter, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
          colorText: "#25283b",
          colorTextSecondary: "#7a7f90",
          colorBorder: "#dfe2ec",
          controlHeight: 38,
        },
        components: {
          Button: { primaryShadow: "0 3px 8px rgba(99,85,203,.16)" },
          Form: { itemMarginBottom: 20 },
          Tabs: { horizontalItemGutter: 24 },
        },
      }}
    >
      <AntApp>
        <Workbench />
      </AntApp>
    </ConfigProvider>
  );
}
