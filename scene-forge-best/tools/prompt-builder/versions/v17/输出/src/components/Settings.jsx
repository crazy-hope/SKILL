import React, { useState } from "react";
import { Alert, Button, Drawer, Input, Segmented, Space } from "antd";
import { Choice } from "./Conditions.jsx";
export function Settings({
  provider,
  profiles,
  keys,
  config,
  onSave,
  onClear,
  onClose,
  api,
}) {
  const [current, setCurrent] = useState(provider),
    [models, setModels] = useState({}),
    [draftProfiles, setProfiles] = useState(structuredClone(profiles)),
    [draftKeys, setKeys] = useState({ ...keys }),
    [loading, setLoading] = useState(false),
    [status, setStatus] = useState("");
  async function loadModels() {
    setLoading(true);
    setStatus("");
    try {
      const out = await api("/api/models", {
        provider: current,
        key: draftKeys[current],
      });
      setModels({ ...models, [current]: out.models });
      setStatus(
        `连接成功，获取 ${out.models.length} 个模型。请选择支持文本与JSON输出的模型。`,
      );
    } catch (e) {
      setStatus(e.message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <Drawer
      open
      onClose={onClose}
      title="连接文本模型"
      size={520}
      extra={
        <Button
          type="primary"
          onClick={() => onSave(current, draftProfiles, draftKeys)}
        >
          保存配置
        </Button>
      }
    >
      <p className="muted">
        这里配置编写提示词的文本模型，出图模型请在第 07 项选择。
      </p>
      <p>文本服务商：请先选择 API Key 所属的平台。</p>
      <Segmented
        block
        disabled={loading}
        value={current}
        options={[
          { label: "OpenAI", value: "openai" },
          { label: "DeepSeek", value: "deepseek" },
        ]}
        onChange={(v) => {
          setCurrent(v);
          setStatus("");
        }}
      />
      <p className="endpoint">
        {config?.providers?.[current] || "连接本地服务后显示接口地址"}
      </p>
      <label className="control settings-control">
        <span>{current === "deepseek" ? "DeepSeek" : "OpenAI"} API Key</span>
        <Input.Password
          aria-label="API Key"
          value={draftKeys[current]}
          maxLength={1024}
          autoComplete="off"
          onChange={(e) => setKeys({ ...draftKeys, [current]: e.target.value })}
          placeholder="保存在当前浏览器的独立存储"
        />
      </label>
      <Choice
        label="文本模型 ID"
        value={draftProfiles[current].model}
        options={models[current] || []}
        onChange={(model) =>
          setProfiles({
            ...draftProfiles,
            [current]: { model: model.slice(0, 200) },
          })
        }
        placeholder="输入模型ID，或先获取可用模型"
      />
      <Button
        block
        onClick={loadModels}
        loading={loading}
        disabled={!config || !draftKeys[current]}
      >
        测试连接 / 获取模型
      </Button>
      {status && (
        <Alert
          className="settings-status"
          title={status}
          type="info"
          showIcon
        />
      )}
      <div className="key-note">
        保存后，密钥会在刷新时恢复，创作备份不会包含密钥。点击生成会将本次输入与完整规范发送给所选服务商，可能产生
        API 费用。
      </div>
      <Space>
        <Button
          danger
          onClick={() => {
            if (onClear()) {
              setKeys({ openai: "", deepseek: "" });
              setStatus("两个服务商的本地密钥已清除。");
            }
          }}
        >
          清除本地密钥
        </Button>
      </Space>
    </Drawer>
  );
}
