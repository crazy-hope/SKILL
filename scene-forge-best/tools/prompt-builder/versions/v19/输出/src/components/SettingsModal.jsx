import React from "react";
import {
  Modal,
  Form,
  Select,
  AutoComplete,
  Input,
  Button,
  Space,
  Alert,
} from "antd";
export function SettingsModal({ w }) {
  const c = w.connection,
    p = c.provider;
  return (
    <Modal
      title="接口设置"
      open={w.dialog === "config"}
      onCancel={() => w.setDialog("")}
      footer={null}
      width={640}
      destroyOnHidden
      closable={{ "aria-label": "关闭窗口" }}
      className="studio-modal"
    >
      {w.message && (
        <Alert className="feedback" title={w.message} type="info" />
      )}
      <p className="hint">
        选择编写提示词的文本服务，与目标图像模型分别设置。密钥仅保存在本浏览器独立配置中，不进入创作备份。
      </p>
      {w.connectionError && (
        <Alert
          className="feedback"
          type="warning"
          title={w.connectionError + " 保存将替换接口配置。"}
        />
      )}
      <Form component="div" layout="vertical">
        <Form.Item label="文本服务" htmlFor="provider">
          <Select
            id="provider"
            aria-label="文本服务"
            value={p}
            virtual={false}
            options={[
              { value: "openai", label: "OpenAI" },
              { value: "deepseek", label: "DeepSeek" },
            ]}
            onChange={(provider) => w.editConnection({ ...c, provider })}
          />
        </Form.Item>
        <Form.Item label="文本模型 ID" htmlFor="text-model">
          <AutoComplete
            id="text-model"
            aria-label="文本模型 ID"
            value={c.profiles[p].model}
            options={w.models.map((value) => ({ value }))}
            allowClear
            onChange={(model) =>
              w.editConnection({
                ...c,
                profiles: {
                  ...c.profiles,
                  [p]: { model: model.slice(0, 200) },
                },
              })
            }
            filterOption={(input, option) =>
              option.value.toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>
        <Form.Item label="API Key" htmlFor="api-key">
          <Input.Password
            id="api-key"
            autoComplete="off"
            value={c.keys[p]}
            maxLength={1024}
            onChange={(e) =>
              w.editConnection({
                ...c,
                keys: { ...c.keys, [p]: e.target.value },
              })
            }
          />
        </Form.Item>
      </Form>
      <Space wrap>
        <Button
          loading={w.busy === "models"}
          disabled={!!w.busy || !w.config}
          onClick={w.getModels}
        >
          {w.busy === "models" ? "读取中…" : "读取可用模型"}
        </Button>
        <Button
          onClick={() => {
            w.editConnection({ ...c, keys: { ...c.keys, [p]: "" } });
            w.setMessage("密钥已从输入移除，保存设置后生效。");
          }}
        >
          清空当前密钥
        </Button>
        <Button type="primary" onClick={w.saveSettings}>
          保存设置
        </Button>
      </Space>
      <p className="footnote">
        使用支持 Chat Completions 与 JSON
        输出的文本模型。请求超时或失败不会自动重试。
      </p>
    </Modal>
  );
}
