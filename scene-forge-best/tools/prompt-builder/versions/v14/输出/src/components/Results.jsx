import React, { useEffect, useRef, useState } from "react";
import { Button, Collapse, Space, Tag } from "antd";
import { briefText, targetText, actualDesignText } from "../../core.mjs";
import { bilingualText } from "../export.mjs";
export function ResultView({ result, onCopy, onRestore }) {
  const [active, setActive] = useState(0),
    [status, setStatus] = useState(
      "点击左侧标题，切换并复制该方案英文提示词。",
    );
  const detail = useRef(null),
    copyEpoch = useRef(0);
  useEffect(() => {
    setActive(0);
    setStatus("点击左侧标题，切换并复制该方案英文提示词。");
    copyEpoch.current++;
  }, [result]);
  const scheme = result.schemes[active] || result.schemes[0];
  async function select(i) {
    setActive(i);
    detail.current?.scrollTo({ top: 0 });
    const epoch = ++copyEpoch.current;
    setStatus(`正在复制方案 ${i + 1} 的英文…`);
    const ok = await onCopy(result.schemes[i].en);
    if (epoch === copyEpoch.current)
      setStatus(
        ok === false
          ? "复制失败，请选中文字手动复制。"
          : `已复制方案 ${i + 1} 的完整英文提示词`,
      );
  }
  return (
    <>
      <div className="result-meta">
        <Tag color="green">{result.schemes.length} 对双语</Tag>
        <span>
          {result.provider} / {result.model} · 规范 {result.spec.version}
        </span>
      </div>
      <p className="copy-status" role="status">
        {status}
      </p>
      <div className="result-workspace">
        <nav className="result-nav" aria-label="方案标题列表">
          {result.schemes.map((s, i) => (
            <button
              type="button"
              key={i}
              className={`result-tab ${active === i ? "active" : ""}`}
              aria-label={`方案${i + 1}：${s.name}`}
              aria-pressed={active === i}
              onClick={() => select(i)}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              <strong>{s.name}</strong>
              <small>切换并复制英文 ↗</small>
            </button>
          ))}
        </nav>
        <div
          ref={detail}
          className="result-detail"
          tabIndex={0}
          aria-label="当前方案详情"
        >
          <section className="input-snapshot" aria-label="本方案实际设计">
            <h3>本方案实际设计</h3>
            <pre tabIndex={0}>{actualDesignText(scheme)}</pre>
          </section>
          <div className="scheme-heading">
            <h2>{scheme.name}</h2>
            <Space wrap size={6}>
              <Button onClick={() => onCopy(scheme.zh)}>复制中文</Button>
              <Button onClick={() => onCopy(scheme.en)}>复制英文</Button>
              <Button onClick={() => onCopy(bilingualText(scheme))}>
                复制中英双语
              </Button>
            </Space>
          </div>
          <p>{scheme.concept}</p>
          <p className="muted">{scheme.specs}</p>
          <div className="bilingual">
            <section>
              <h3>中文提示词</h3>
              <pre>{scheme.zh}</pre>
            </section>
            <section>
              <h3>English Prompt</h3>
              <pre>{scheme.en}</pre>
            </section>
          </div>
          <div className="result-notes">
            <p>
              <strong>模型配置：</strong>
              {scheme.config}
            </p>
            <p>
              <strong>差异与待验证：</strong>
              {scheme.checks}
            </p>
          </div>
          <Collapse
            items={[
              {
                key: "input",
                label: "本次工作台输入（原始条件）",
                children: <pre className="source-text">{briefText(result.brief)}</pre>,
              },
              {
                key: "source",
                label: "模型适配与完整规范来源",
                children: (
                  <>
                    <pre className="source-text">
                      {targetText(result.target)}
                      {"\n\n规范 SHA-256：" + result.spec.sha256}
                    </pre>
                    {onRestore && (
                      <Button onClick={() => onRestore(result.brief)}>
                        将这次输入恢复到表单
                      </Button>
                    )}
                  </>
                ),
              },
            ]}
          />
        </div>
      </div>
    </>
  );
}
