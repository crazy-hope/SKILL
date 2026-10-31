import React, { useEffect, useState } from "react";
import {
  Drawer,
  Form,
  Input,
  Button,
  Select,
  AutoComplete,
  Alert,
  Space,
  Typography,
  App,
} from "antd";
import { api } from "./workbench.js";
function serviceFor(baseUrl) {
  try {
    const url = new URL(baseUrl);
    if (
      url.protocol !== "https:" ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return "custom";
    const path = url.pathname.replace(/\/+$/, "");
    if (url.hostname === "api.deepseek.com" && ["", "/v1"].includes(path))
      return "deepseek";
    if (url.hostname === "api.openai.com" && path === "/v1") return "openai";
  } catch {}
  return "custom";
}
export default function ConnectionDrawer({ open, onClose, config, onSaved }) {
  const [form] = Form.useForm();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [models, setModels] = useState([]);
  const [notice, setNotice] = useState("");
  const [service, setService] = useState("custom");
  const { message } = App.useApp();
  useEffect(() => {
    if (open) {
      form.setFieldsValue({ ...config?.connection, apiKey: "" });
      setService(serviceFor(config?.connection?.baseUrl));
      setError("");
      setNotice("");
      setModels([]);
    }
  }, [open]);
  async function run(kind) {
    setBusy(kind);
    setError("");
    setNotice("");
    try {
      const values = form.getFieldsValue();
      if (kind !== "clear" && !values.baseUrl?.trim())
        throw Error("请填写 API 根地址。");
      if (kind === "save" && !values.model?.trim())
        throw Error(
          "请填写看图模型 ID；DeepSeek 可选择预设自动填入 deepseek-flash。",
        );
      const data = await api(
        kind === "save" ? "connection" : `connection/${kind}`,
        {
          body: kind === "clear" ? {} : values,
          signal: AbortSignal.timeout(20000),
        },
      );
      if (kind === "models") {
        setModels(data.models.map((value) => ({ value })));
        setNotice(data.message);
      } else {
        form.setFieldValue("apiKey", "");
        await onSaved();
        message.success(kind === "clear" ? "已清除本机密钥" : "连接配置已保存");
        if (kind === "save") onClose();
      }
    } catch (e) {
      setError(e.name === "TimeoutError" ? "连接超时，请重试。" : e.message);
    } finally {
      setBusy("");
    }
  }
  return (
    <Drawer
      title="连接看图写词服务"
      open={open}
      onClose={() => {
        if (!busy) {
          form.setFieldValue("apiKey", "");
          onClose();
        }
      }}
      width={460}
      maskClosable={!busy}
      closable={!busy}
      extra={<span className="muted">本机配置</span>}
    >
      <Typography.Paragraph type="secondary">
        这里配置负责理解图片、编写提示词的模型服务。可灵 / Seedance
        是提示词的目标视频模型，在编辑区选择。
      </Typography.Paragraph>
      <Form
        disabled={Boolean(busy)}
        form={form}
        layout="vertical"
        autoComplete="off"
        requiredMark={false}
        onValuesChange={() => setError("")}
      >
        <Form.Item label="服务预设">
          <Select
            aria-label="服务预设"
            value={service}
            placeholder="选择预设或自定义"
            options={[
              { value: "custom", label: "自定义 OpenAI 兼容服务" },
              { value: "openai", label: "OpenAI" },
              { value: "deepseek", label: "DeepSeek" },
            ]}
            onChange={(v) => {
              setService(v);
              setError("");
              setModels([]);
              setNotice("");
              if (v !== "custom")
                form.setFieldsValue({
                  baseUrl:
                    v === "openai"
                      ? "https://api.openai.com/v1"
                      : "https://api.deepseek.com",
                  model: v === "deepseek" ? "deepseek-flash" : "",
                  apiKey: "",
                });
            }}
          />
        </Form.Item>
        {service === "deepseek" && (
          <Alert
            showIcon
            type="info"
            className="block-gap"
            title="DeepSeek：确认地址、看图模型与 Key 后点击「保存配置」。"
            description={
              <span>
                deepseek-flash 支持图片输入，可按账号权限修改模型 ID。
                <a
                  href="https://api-docs.deepseek.com/zh-cn/guides/vision/"
                  target="_blank"
                  rel="noreferrer"
                >
                  官方图像理解说明
                </a>
                （2026-10-26 核查；尚未验证你的账号连接）。
              </span>
            }
          />
        )}
        <Form.Item
          name="baseUrl"
          label="API 根地址"
          extra="使用 HTTPS；本机接口可用 HTTP。无需填写 /chat/completions。"
        >
          <Input
            aria-label="API 根地址"
            placeholder="https://your-provider.com/v1"
            onChange={(event) => {
              setService(serviceFor(event.target.value));
              setModels([]);
              setNotice("");
            }}
          />
        </Form.Item>
        <Form.Item
          name="apiKey"
          label="API Key"
          extra={
            config?.connection?.hasKey
              ? "已保存密钥；同一接口留空即可沿用。更换地址需要重新填写。"
              : "密钥仅保存在本机后端，不会保存到浏览器。"
          }
        >
          <Input.Password
            aria-label="API Key"
            placeholder={
              config?.connection?.hasKey
                ? "已保存 · 留空沿用"
                : "输入服务商提供的密钥"
            }
            autoComplete="new-password"
          />
        </Form.Item>
        <Form.Item
          name="model"
          label="看图模型 ID"
          extra="地址、API Key 和模型 ID 必须完整并保存；只读取列表不会保存。请选支持图片输入的模型。"
        >
          <AutoComplete
            aria-label="看图模型 ID"
            options={models}
            placeholder="填写模型 ID，或先读取模型列表"
            filterOption={(input, option) =>
              option.value.toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>
      </Form>
      {error && (
        <Alert showIcon type="error" title={error} className="block-gap" />
      )}
      {notice && (
        <Alert showIcon type="info" title={notice} className="block-gap" />
      )}
      <Space wrap>
        <Button
          loading={busy === "models"}
          disabled={Boolean(busy)}
          onClick={() => run("models")}
        >
          测试并读取模型
        </Button>
        <Button
          type="primary"
          loading={busy === "save"}
          disabled={Boolean(busy)}
          onClick={() => run("save")}
        >
          保存配置
        </Button>
      </Space>
      <div className="drawer-bottom">
        <Button
          danger
          disabled={Boolean(busy) || !config?.connection?.hasKey}
          loading={busy === "clear"}
          onClick={() => run("clear")}
        >
          清除已保存密钥
        </Button>
        <p className="muted">保存或清除配置后，已有结果会标为待更新。</p>
      </div>
    </Drawer>
  );
}
