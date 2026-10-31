import React, { useEffect, useState } from "react";
import { Button, Card, Collapse, Alert, Modal, Spin, Tabs, Tag } from "antd";
import { LABELS, markdown } from "../../model.mjs";
import { saveFile } from "../io.js";
export function Results({ w }) {
  const [active, setActive] = useState("0");
  const r = w.previewResult || w.result;
  const status = w.previewResult ? "ready" : w.output.status;
  useEffect(() => {
    setActive("0");
  }, [r?.id]);
  const scheme = r?.schemes[Number(active)] || r?.schemes[0];
  const ready = status === "ready" && !!scheme;
  const brief = r
    ? Object.entries(LABELS)
        .map(([key, label]) => `${label}：${r.brief[key]}`)
        .join("\n\n") +
      "\n\n主体内容：" +
      r.brief.subject
    : "";
  return (
    <Modal
      title={
        <span className="result-title">
          完整提示词{" "}
          {ready && (
            <Tag>
              {w.previewResult ? "历史记录" : `${r.schemes.length} 对双语`}
            </Tag>
          )}
        </span>
      }
      open={w.dialog === "results"}
      aria-label="完整提示词"
      onCancel={() => w.setDialog("")}
      width={1180}
      centered
      destroyOnHidden
      closable={{ "aria-label": "关闭窗口" }}
      className="result-modal"
      footer={
        <div className="result-footer">
          <span>
            {status === "loading"
              ? "关闭窗口后仍会继续生成，可随时查看进度。"
              : ready
                ? "完整中英文可分别复制；实际出图效果需另行核验。"
                : "请返回修改输入后重新生成。"}
          </span>
          <div>
            {ready && (
              <Button onClick={() => saveFile("完整提示词.md", markdown(r))}>
                下载全部
              </Button>
            )}
            <Button onClick={() => w.setDialog("")}>返回编辑</Button>
          </div>
        </div>
      }
    >
      {status === "loading" ? (
        <div className="generation-state" role="status">
          <Spin size="large" />
          <h3>正在生成完整提示词…</h3>
          <p>正在结合五项基调与主体内容展开中英文画面。</p>
          <p>可以关闭窗口继续编辑；修改条件后本次返回将不再采用。</p>
        </div>
      ) : status === "error" ? (
        <div className="generation-state">
          <Alert
            showIcon
            type="error"
            title="本次生成未完成"
            description={w.output.error}
          />
        </div>
      ) : status === "clarification" ? (
        <div className="generation-state">
          <Alert
            showIcon
            type="warning"
            title="有几项设定需要统一"
            description={
              <ul>
                {w.output.questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            }
          />
        </div>
      ) : ready ? (
        <>
          {w.message.includes("复制") && (
            <Alert
              className="copy-feedback"
              role="status"
              type="info"
              title={w.message}
            />
          )}
          <Tabs
            className="scheme-tabs"
            activeKey={active}
            onChange={setActive}
            size="small"
            items={r.schemes.map((s, i) => ({
              key: String(i),
              label: (
                <span className="scheme-tab-label" title={s.title}>
                  {i + 1}. {s.title}
                </span>
              ),
            }))}
          />
          <div className="result-scroll">
            <h3 className="result-scheme-title">{scheme.title}</h3>
            <div className="bilingual">
              {[
                ["zh", "中文"],
                ["en", "English"],
              ].map(([key, label]) => (
                <Card
                  className="prompt-panel"
                  key={key}
                  title={label}
                  size="small"
                  extra={
                    <Button size="small" onClick={() => w.copy(scheme[key])}>
                      复制{key === "zh" ? "中文" : "英文"}
                    </Button>
                  }
                >
                  <pre>{scheme[key]}</pre>
                </Card>
              ))}
            </div>
            {scheme.usage && (
              <Alert
                className="usage"
                type="info"
                title="使用说明"
                description={scheme.usage}
              />
            )}
            <Collapse
              className="source"
              ghost
              items={[
                {
                  key: "source",
                  label: "查看本次输入与来源",
                  children: (
                    <div>
                      <pre>{brief}</pre>
                      <p>负面提示词：{r.brief.negative || "已清空"}</p>
                      <p>
                        目标：{r.target.requested || "通用"} · 数量：
                        {r.brief.count} · 文本服务：{r.provider} / {r.model}
                      </p>
                      <p>
                        规范：{r.spec.version} · SHA-256：{r.spec.sha256}
                      </p>
                      <p>
                        适配范围：{r.target.scope} · 来源查阅日期：
                        {r.target.checkedAt}，本次未联网核实。
                      </p>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        </>
      ) : (
        <div className="generation-state">
          <p>填写主体后开始生成提示词。</p>
        </div>
      )}
    </Modal>
  );
}
