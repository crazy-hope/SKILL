import React from "react";
import { Alert, Tag, Collapse } from "antd";
export default function EffectReview({ result }) {
  const checks = result.effectChecks || [],
    warnings = result.reviewWarnings || [];
  if (!checks.length && !warnings.length) return null;
  return (
    <section className="effect-review" data-testid="effect-review">
      <h3>效果核对（模型自检）</h3>
      <p className="muted">
        程序仅核对引文出处，不代表语义完整或视频效果。自主设计与用户要求分开列出。
      </p>
      {warnings.length > 0 && (
        <Alert
          type="warning"
          showIcon
          title="以下内容需要复核"
          description={
            <ul>
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          }
        />
      )}
      <Collapse
        items={checks.map((c, i) => ({
          key: String(i),
          label: c.requirement,
          extra: (
            <Tag color={c.status === "needs_review" ? "orange" : "default"}>
              {c.status === "self_checked" ? "模型已自检" : "需复核"}
            </Tag>
          ),
          children: (
            <div>
              <Tag>{c.source === "user" ? "用户要求" : "自主设计"}</Tag>
              {c.sourceText && (
                <>
                  <h4>用户原文</h4>
                  <blockquote>{c.sourceText}</blockquote>
                </>
              )}
              <h4>正文对应</h4>
              <blockquote>{c.promptText || "未提供可核对的对应句"}</blockquote>
              {c.submissionText && (
                <>
                  <h4>提交版对应</h4>
                  <blockquote>{c.submissionText}</blockquote>
                </>
              )}
              {c.note && <p>{c.note}</p>}
              {c.issues?.length > 0 && (
                <ul>
                  {c.issues.map((x, j) => (
                    <li key={j}>{x}</li>
                  ))}
                </ul>
              )}
            </div>
          ),
        }))}
      />
    </section>
  );
}
