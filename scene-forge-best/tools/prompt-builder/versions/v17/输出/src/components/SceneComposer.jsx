import React from "react";
import { Alert, Button, Input, Spin } from "antd";
import { LOTUS_CORE, LOTUS_BACKDROP, LOTUS_DIRECTIONS } from "../../scene.mjs";

export function SceneComposer({
  draft,
  onChange,
  concepts,
  conceptPhase,
  conceptMessage,
  busyStage,
  connected,
  onConcepts,
  onSelect,
  onRefine,
}) {
  const scene = draft.scene;
  const cards = concepts.length
    ? concepts
    : scene.selected
      ? [scene.selected]
      : [];
  const setScene = (key, value) => {
    const next = { ...scene, [key]: value };
    if (key === "core" && value !== LOTUS_CORE && scene.core === LOTUS_CORE) {
      if (LOTUS_DIRECTIONS.some((item) => item.direction === scene.direction))
        next.direction = "";
      if (scene.backdrop === LOTUS_BACKDROP) next.backdrop = "";
    }
    onChange({ ...draft, scene: next });
  };
  return (
    <div className="scene-composer">
      <section className="scene-entry" aria-labelledby="scene-entry-title">
        <div className="section-heading">
          <span className="step-number">01</span>
          <div>
            <h2 id="scene-entry-title">先有一处场景</h2>
            <p>一个地方、一种感觉，或一个还没想完整的念头；也可以写下想要的电影、摄影或绘画质感。</p>
          </div>
          <Button onClick={onRefine}>精修条件</Button>
        </div>
        <div className="scene-inputs">
          <label className="scene-control">
            <span>
              核心场景 <small>可选</small>
            </span>
            <Input
              aria-label="核心场景"
              value={scene.core}
              maxLength={1000}
              onChange={(e) => setScene("core", e.target.value)}
              placeholder="这幅画发生在哪里？"
            />
          </label>
          <label className="scene-control">
            <span>
              想法 <small>只写这一项也可以</small>
            </span>
            <Input.TextArea
              aria-label="想法"
              value={draft.大致说明}
              maxLength={3000}
              onChange={(e) => onChange({ ...draft, 大致说明: e.target.value })}
              rows={3}
              placeholder="例如：水面很静，花叶之间藏着一条曲折的水路。无人。"
            />
          </label>
        </div>
        {(scene.backdrop || scene.direction) && (
          <div className="applied-scene-context">
            {scene.backdrop && (
              <p>
                <strong>背景陪衬</strong>
                {scene.backdrop}
              </p>
            )}
            {scene.direction && (
              <p>
                <strong>探索方向</strong>
                {scene.direction}
              </p>
            )}
          </div>
        )}
        <div className="direction-heading">
          <span>从荷塘开始</span>
          <small>可选的三个方向 · 点击采用，再次点击取消</small>
        </div>
        <div className="lotus-directions">
          {LOTUS_DIRECTIONS.map((item, i) => {
            const selected = scene.direction === item.direction;
            return (
              <button
                type="button"
                key={item.id}
                className={`direction-card ${selected ? "is-selected" : ""}`}
                aria-pressed={selected}
                onClick={() =>
                  onChange({
                    ...draft,
                    scene: selected
                      ? { ...scene, direction: "" }
                      : {
                          ...scene,
                          core: LOTUS_CORE,
                          backdrop: LOTUS_BACKDROP,
                          direction: item.direction,
                        },
                  })
                }
              >
                <span className="direction-index">0{i + 1}</span>
                <strong>{item.title}</strong>
                <span>{item.description}</span>
                <i aria-hidden="true">{selected ? "✓" : "↗"}</i>
              </button>
            );
          })}
        </div>
        <div className="scene-entry-actions">
          <span>
            {scene.direction
              ? "已采用参考方向，可在精修中修改。"
              : "也可以写自己的场景，不必选择参考方向。"}
          </span>
          <Button
            aria-label="构思 3 个场景"
            type="primary"
            size="large"
            loading={busyStage === "concept"}
            disabled={!connected || busyStage === "final"}
            onClick={onConcepts}
          >
            {busyStage === "concept" ? "正在构思场景" : "构思 3 个场景"}
          </Button>
        </div>
      </section>
      <section
        className="concept-section"
        aria-labelledby="concept-section-title"
        aria-busy={busyStage === "concept"}
      >
        <div className="section-heading">
          <span className="step-number">02</span>
          <div>
            <h2 id="concept-section-title">选一个值得展开的构思</h2>
            <p>先看表现方向、当前瞬间与相互影响，再展开每个元素的位置、材质状态、颜色和光线。</p>
          </div>
          {scene.selected && (
            <span className="selection-badge">已选定构思</span>
          )}
        </div>
        {conceptPhase === "error" || conceptPhase === "clarification" ? (
          <Alert
            showIcon
            type={conceptPhase === "error" ? "error" : "warning"}
            title={
              conceptPhase === "error" ? "构思失败，输入已保留" : "需要调整输入"
            }
            description={conceptMessage}
          />
        ) : null}
        {busyStage === "concept" ? (
          <div className="concept-placeholder" role="status">
            <Spin />
            <span>正在寻找三个值得展开的画面瞬间…</span>
          </div>
        ) : cards.length ? (
          <div
            className={`concept-grid ${cards.length === 1 ? "restored-concept" : ""}`}
          >
            {cards.map((item, i) => {
              const selected =
                JSON.stringify(item) === JSON.stringify(scene.selected);
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={`选择构思：${item.title}`}
                  aria-pressed={selected}
                  className={`concept-card ${selected ? "is-selected" : ""}`}
                  disabled={busyStage === "final"}
                  onClick={() => onSelect(item)}
                >
                  <span className="concept-topline">
                    <span>
                      {cards.length === 1 ? "已保存的构思" : `构思 0${i + 1}`}
                    </span>
                    <span>{selected ? "✓ 已选择" : "选择此构思"}</span>
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.summary}</p>
                  <dl>
                    <dt>关键关系</dt>
                    <dd>{item.relationship}</dd>
                    <dt>画面变化</dt>
                    <dd>{item.variation}</dd>
                  </dl>
                </button>
              );
            })}
          </div>
        ) : conceptPhase !== "error" && conceptPhase !== "clarification" ? (
          <div className="concept-placeholder">
            <span className="placeholder-line" aria-hidden="true">
              ○ ─ ○ ─ ○
            </span>
            <span>
              {conceptMessage || "写下想法，三个场景构思将在这里出现。"}
            </span>
          </div>
        ) : null}
      </section>
    </div>
  );
}
