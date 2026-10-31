import React from "react";
import {
  Card,
  Form,
  Input,
  Button,
  AutoComplete,
  Select,
  Collapse,
  Tag,
  Space,
  Typography,
} from "antd";
import { LABELS } from "../../model.mjs";
const imageModels = [
  "Midjourney",
  "OpenAI Image",
  "FLUX",
  "Stable Diffusion",
  "Imagen",
].map((value) => ({ value }));
const countOptions = Array.from({ length: 10 }, (_, i) => ({
  value: i + 1,
  label: `${i + 1} 对双语`,
}));
const { TextArea } = Input;
export function BriefEditor({ w }) {
  return (
    <div className="workspace">
      <section className="tone" aria-label="画面基调">
        <div className="section-title">
          <div>
            <span className="step">01</span>
            <h2>画面基调</h2>
          </div>
          <Space wrap className="tone-actions">
            <Select
              id="tone-preset"
              aria-label="选择画面基调"
              className="tone-select"
              placeholder="自定义 · 选择基调"
              value={w.selectedTone}
              options={w.tones.map(t => ({value:t.name,label:t.name}))}
              onChange={w.selectTone}
              virtual={false}
            />
          <Button type="text" size="small" onClick={w.restoreFive}>
            恢复五项默认
          </Button>
          </Space>
        </div>
        <Form component="div" layout="vertical" className="tone-grid">
          {Object.entries(LABELS).map(([key, label], i) => (
            <Card key={key} size="small" className={`tone-card ${key}`}>
              <Form.Item
                label={
                  <span>
                    <span className="field-number">0{i + 1}</span>
                    {label}
                  </span>
                }
                htmlFor={key}
              >
                <TextArea
                  id={key}
                  aria-label={label}
                  value={w.brief[key]}
                  maxLength={6000}
                  autoSize={{
                    minRows: key === "camera" || key === "mood" ? 1 : 2,
                    maxRows: 12,
                  }}
                  onChange={(e) => w.field(key, e.target.value)}
                />
              </Form.Item>
            </Card>
          ))}
        </Form>
        <p className="footnote">
          保留的文字都会参与生成；清空表示取消这一项的设定。
        </p>
      </section>
      <section className="subject" aria-label="描绘内容">
        <div className="section-title">
          <div>
            <span className="step">02</span>
            <h2>描绘内容</h2>
          </div>
          <Tag variant="filled">手写 / AI 辅助</Tag>
        </div>
        <Card size="small" className="subject-panel">
        <Form component="div" layout="vertical">
          <Form.Item
            label="描绘内容"
            htmlFor="subject"
            extra="写清元素的位置、材质、颜色、当前状态，以及彼此的联系。"
          >
            <TextArea
              id="subject"
              value={w.brief.subject}
              maxLength={12000}
              autoSize={{ minRows: 5, maxRows: 18 }}
              onChange={(e) => w.field("subject", e.target.value)}
              placeholder="可以从一句想法开始，再让 AI 补齐位置、材质、颜色、动作与环境反馈。"
            />
          </Form.Item>
          <Space wrap>
            <Button
              loading={w.busy === "subject"}
              disabled={!!w.busy || !w.config}
              onClick={() => w.generate("subject")}
            >
              {w.busy === "subject" ? "正在描述主体…" : "AI描述主体"}
            </Button>
            <Button
              aria-label="清空"
              disabled={!w.brief.subject}
              onClick={() => w.field("subject", "")}
            >
              清空
            </Button>
            {w.undo && w.brief.subject === w.undo.after && (
              <Button type="text" onClick={w.undoSubject}>
                撤销AI描述
              </Button>
            )}
          </Space>
          <p className="footnote">
            可留空让 AI 构思，也可直接手写后生成。AI 仅修改描绘内容。
          </p>
          <div className="output-options">
            <Form.Item label="目标图像模型" htmlFor="target">
              <AutoComplete
                id="target"
                aria-label="目标图像模型"
                value={w.brief.target}
                options={imageModels}
                allowClear
                onChange={(value) => w.field("target", value.slice(0, 6000))}
                placeholder="留空使用通用描述"
                filterOption={(input, option) =>
                  option.value.toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
            <Form.Item label="方案数量" htmlFor="count">
              <Select
                id="count"
                aria-label="方案数量"
                value={w.brief.count}
                options={countOptions}
                virtual={false}
                onChange={(value) => w.field("count", value)}
              />
            </Form.Item>
          </div>
          <Collapse
            className="negative"
            ghost
            items={[
              {
                key: "negative",
                label: "负面提示词",
                extra: (
                  <Typography.Text type="secondary">
                    可修改或清空
                  </Typography.Text>
                ),
                children: (
                  <TextArea
                    id="negative"
                    aria-label="负面提示词"
                    value={w.brief.negative}
                    maxLength={6000}
                    autoSize={{ minRows: 5, maxRows: 12 }}
                    onChange={(e) => w.field("negative", e.target.value)}
                  />
                ),
              },
            ]}
          />
          <Button
            className="generate"
            type="primary"
            size="large"
            block
            loading={w.busy === "generate"}
            disabled={!!w.busy || !w.config || !w.brief.subject.trim()}
            onClick={() => w.generate("generate")}
          >
            {w.busy === "generate" ? "正在生成完整提示词…" : "生成完整提示词"}
          </Button>
          <p className="footnote">
            每次操作调用一次文本模型。结果包含完整中文与英文。
          </p>
        </Form>
        </Card>
      </section>
    </div>
  );
}
