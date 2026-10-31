import React from "react";
import { Alert, Button, Empty, Space, Spin, Tabs, Tag, App } from "antd";
import {
  CopyOutlined,
  DownloadOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { toMarkdown, LEVEL_NAMES } from "../public/result.js";
function Prompt({ text, testId = "prompt-output" }) {
  return (
    <div className="prompt-prose" data-testid={testId}>
      {text.split(/\n(?=#{1,3}\s)/).map((part, i) => {
        const match = part.match(/^#{1,3}\s+([^\n]+)\n?([\s\S]*)/);
        return match ? (
          <section key={i}>
            <h3>
              <span>{String(i + 1).padStart(2, "0")}</span>
              {match[1]}
            </h3>
            <p>{match[2]}</p>
          </section>
        ) : (
          <p key={i}>{part}</p>
        );
      })}
    </div>
  );
}
export default function ResultPane({ task }) {
  const g = task.generation;
  const data = g.record?.data;
  const r = data?.result;
  const m = data?.metadata;
  const { message } = App.useApp();
  async function copy(value) {
    try {
      await navigator.clipboard.writeText(value);
      message.success("已复制");
    } catch {
      message.error("复制失败，请选中文字手动复制。");
    }
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([toMarkdown(r, m)], { type: "text/markdown;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `镜头${task.id}-提示词-${m.skillVersion}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const notices = (
    <>
      {g.stale && (
        <Alert
          data-testid="stale-notice"
          title="输入或连接已改变，以下为上一次结果。"
          type="warning"
          showIcon
          className="block-gap"
        />
      )}
      {g.error && (
        <Alert title={g.error} type="error" showIcon className="block-gap" />
      )}
      {r?.status === "needs_clarification" && (
        <Alert
          title="需要补充信息"
          description={r.clarificationQuestions.join("；")}
          type="warning"
          showIcon
          className="block-gap"
        />
      )}
    </>
  );
  return (
    <aside className="result-pane" aria-label="生成结果">
      <div className="pane-heading">
        <div>
          <span className="eyebrow">OUTPUT</span>
          <h2>提示词预览</h2>
        </div>
        {r && <Tag color="purple">{LEVEL_NAMES[r.level]}档</Tag>}
      </div>
      {notices}
      {g.busy && (
        <div className="generation-progress">
          <Spin size="small" />
          <span>正在读图与编写，你可以切换到其他镜头…</span>
        </div>
      )}
      {!r ? (
        <div className="result-empty">
          <div className="result-symbol">
            <FileTextOutlined />
          </div>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <>
                <h3>
                  {g.busy ? "让画面开始流动" : "下一段故事，从这一帧开始"}
                </h3>
                <p>
                  上传图片，写下你想发生的事。
                  <br />
                  这里会呈现可直接复制的分段提示词。
                </p>
              </>
            }
          />
          <div className="structure-tags">
            {["画面设定", "场景基底", "主体动态", "运镜", "声音", "约束"].map(
              (x) => (
                <span key={x}>{x}</span>
              ),
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="result-meta">
            <strong>{m.videoModel}</strong>
            <span>
              {m.duration} 秒 ·{" "}
              {m.aspectRatio === "original" ? "原图比例" : m.aspectRatio} ·{" "}
              {m.skillVersion}
            </span>
          </div>
          <Tabs
            className="result-tabs"
            defaultActiveKey="prompt"
            items={[
              {
                key: "prompt",
                label: "完整提示词",
                children: (
                  <>
                    <Prompt text={r.prompt || "等待补充信息后生成。"} />
                    {r.submissionPrompt && (
                      <div className="submission">
                        <h3>提交版</h3>
                        <Prompt
                          text={r.submissionPrompt}
                          testId="submission-output"
                        />
                        <Button onClick={() => copy(r.submissionPrompt)}>
                          复制提交版
                        </Button>
                      </div>
                    )}
                  </>
                ),
              },
              {
                key: "design",
                label: "设计与设置",
                children: (
                  <div className="result-details">
                    <h3>设计依据</h3>
                    <p>{r.designReason}</p>
                    <h3>必要设置</h3>
                    {r.settings.map((s, i) => (
                      <div className="setting-row" key={i}>
                        <span>{s.name}</span>
                        <strong>{s.value}</strong>
                        <Tag>{s.status}</Tag>
                      </div>
                    ))}
                    {[
                      ["未确认项", r.uncertainties],
                      ["合并与省略", r.omissions],
                      ["需要补充", r.clarificationQuestions],
                    ]
                      .filter(([, list]) => list.length)
                      .map(([label, list]) => (
                        <section key={label}>
                          <h3>{label}</h3>
                          <ul>
                            {list.map((x, i) => (
                              <li key={i}>{x}</li>
                            ))}
                          </ul>
                        </section>
                      ))}
                  </div>
                ),
              },
              {
                key: "sources",
                label: "资料来源",
                children: (
                  <div className="result-details">
                    <Alert
                      type="info"
                      showIcon
                      title="资料快照 · 本次未在线复核"
                      description={`资料日期：${m.snapshotDate}。目标入口与账号实际能力仍需确认。`}
                    />
                    <ul>
                      {m.sources.map((s, i) => (
                        <li key={i}>
                          <a href={s.url} target="_blank" rel="noreferrer">
                            {s.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
              },
            ]}
          />
          <div className="result-actions">
            <Button
              type="primary"
              aria-label="复制提示词"
              icon={<CopyOutlined />}
              onClick={() => copy(r.prompt)}
              disabled={!r.prompt}
            >
              复制提示词
            </Button>
            <Button onClick={() => copy(toMarkdown(r, m))}>复制全部</Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={download}
              aria-label="下载 Markdown"
            >
              导出
            </Button>
          </div>
        </>
      )}
    </aside>
  );
}
