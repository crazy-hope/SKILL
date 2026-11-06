import React, { useEffect, useRef, useState } from "react";
import {
  Check,
  KeyRound,
  LoaderCircle,
  PlugZap,
  Trash2,
  ExternalLink,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button, cn } from "./ui/button";
import { api } from "../api";
import type { PublicConfig } from "../../shared/contracts";
import {
  providers,
  providerIds,
  type ProviderId,
} from "../../shared/providers";
export function ModelDialog({
  open,
  onOpenChange,
  config,
  onConfig,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  config: PublicConfig | null;
  onConfig: (v: PublicConfig) => void;
}) {
  const [provider, setProvider] = useState<ProviderId>("deepseek");
  const [saved, setSaved] = useState<PublicConfig | null>(null);
  const [baseUrl, setBaseUrl] = useState(providers.deepseek.baseUrl);
  const [model, setModel] = useState("");
  const [key, setKey] = useState("");
  const [models, setModels] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  function begin() {
    request.current?.abort();
    const current = new AbortController();
    request.current = current;
    setBusy(true);
    setError("");
    setMessage("");
    return current;
  }
  function apply(c: PublicConfig) {
    setProvider(c.provider);
    setSaved(c);
    setBaseUrl(c.baseUrl);
    setModel(c.model);
    setKey("");
    setModels([]);
  }
  async function selectProvider(id?: ProviderId) {
    const current = begin();
    setKey("");
    setModels([]);
    setSaved(null);
    if (id) {
      setProvider(id);
      setBaseUrl(providers[id].baseUrl);
      setModel("");
    }
    try {
      const next = await api<PublicConfig>(
        id ? `config?provider=${id}` : "config",
        { signal: current.signal },
      );
      if (current.signal.aborted) return;
      apply(next);
      if (!id) onConfig(next);
    } catch (e) {
      if (!current.signal.aborted) setError((e as Error).message);
    } finally {
      if (!current.signal.aborted) setBusy(false);
    }
  }
  useEffect(() => {
    if (open) void selectProvider();
    else {
      request.current?.abort();
      setKey("");
    }
    return () => {
      request.current?.abort();
    };
  }, [open]);
  async function save(test = false) {
    const current = begin();
    try {
      const next = await api<PublicConfig>("config", {
        method: "PUT",
        signal: current.signal,
        body: JSON.stringify({
          provider,
          baseUrl,
          model,
          ...(key ? { apiKey: key } : {}),
        }),
      });
      if (current.signal.aborted) return;
      onConfig(next);
      setSaved(next);
      setKey("");
      if (test) {
        const result = await api<{ models: { id: string; name: string }[] }>(
          "models",
          {
            method: "POST",
            signal: current.signal,
            body: JSON.stringify({ provider }),
          },
        );
        if (current.signal.aborted) return;
        setModels(result.models);
        setMessage(
          `连接成功，读取到 ${result.models.length} 个模型。请选择文本模型后保存；本次未测试实际生成。`,
        );
      } else setMessage(`已保存，当前使用 ${providers[provider].name}。`);
    } catch (e) {
      if (!current.signal.aborted) setError((e as Error).message);
    } finally {
      if (!current.signal.aborted) setBusy(false);
    }
  }
  async function remove() {
    const current = begin();
    try {
      const next = await api<PublicConfig>("config/key", {
        method: "DELETE",
        signal: current.signal,
        body: JSON.stringify({ provider }),
      });
      if (current.signal.aborted) return;
      setSaved(next);
      setKey("");
      setModels([]);
      if (config?.provider === provider) onConfig(next);
      setMessage(
        `${providers[provider].name} 的密钥已删除，另一服务的配置仍保留。`,
      );
    } catch (e) {
      if (!current.signal.aborted) setError((e as Error).message);
    } finally {
      if (!current.signal.aborted) setBusy(false);
    }
  }
  const info = providers[provider];
  const keyApplies =
    !!saved?.hasKey &&
    baseUrl.replace(/\/$/, "") === saved.baseUrl.replace(/\/$/, "");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="model-dialog">
        <div className="model-dialog-body">
          <div className="modal-icon">
            <PlugZap size={22} />
          </div>
          <DialogTitle className="dialog-title">连接你的创作引擎</DialogTitle>
          <DialogDescription className="dialog-description">
            选择模型服务生成场景与提示词，创作规则来自本地 skill。
          </DialogDescription>
          <div className="provider-options" role="group" aria-label="模型服务">
            {providerIds.map((id) => (
              <button
                key={id}
                type="button"
                className={cn("provider-choice", provider === id && "chosen")}
                aria-pressed={provider === id}
                aria-label={providers[id].name}
                disabled={busy}
                onClick={() => selectProvider(id)}
              >
                <span className="provider-mark">
                  {id === "openai" ? "O" : "D"}
                </span>
                <span>
                  <strong>{providers[id].name}</strong>
                  <small>
                    {id === "openai"
                      ? "使用 OpenAI API Key"
                      : "使用 DeepSeek API Key"}
                  </small>
                </span>
                {provider === id && <Check size={15} />}
              </button>
            ))}
          </div>
          <p className="field-hint">
            两家的配置分别保留；保存后切换当前创作引擎。
          </p>
          <label className="control-label" htmlFor="base-url">
            接口地址
          </label>
          <input
            id="base-url"
            disabled={busy}
            value={baseUrl}
            onChange={(e) => {
              setBaseUrl(e.target.value);
              setModels([]);
              setMessage("");
            }}
          />
          <label className="control-label" htmlFor="api-key">
            API Key{" "}
            {keyApplies && (
              <span className="success-text">
                <Check size={12} />
                已保存
              </span>
            )}
          </label>
          <input
            id="api-key"
            disabled={busy}
            type="password"
            autoComplete="off"
            value={key}
            placeholder={
              keyApplies
                ? "已保存密钥；留空则保留"
                : `输入你的 ${info.name} API Key`
            }
            onChange={(e) => setKey(e.target.value)}
          />
          <a
            className="text-link"
            href={info.keyUrl}
            target="_blank"
            rel="noreferrer"
          >
            前往 {info.name} 获取 API Key <ExternalLink size={12} />
          </a>
          <label className="control-label" htmlFor="model-name">
            模型名称
          </label>
          {models.length > 0 && (
            <select
              disabled={busy}
              aria-label="可用模型"
              value={models.some((x) => x.id === model) ? model : ""}
              onChange={(e) => setModel(e.target.value)}
            >
              <option value="">从可用模型中选择</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
          <input
            id="model-name"
            disabled={busy}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="测试连接后选择，也可手动填写"
          />
          {provider === "openai" && (
            <p className="field-hint">
              请选择支持文本与 JSON
              输出的模型。列表可能包含图像、语音等其他型号。
            </p>
          )}
          <p className="field-hint">
            <KeyRound size={12} /> 密钥仅保存在本机，不写入创作历史或导出文件。
          </p>
          {error && (
            <p className="error-box" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="success-box" role="status">
              {message}
            </p>
          )}
        </div>
        <div className="modal-actions">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`删除 ${info.name} 密钥`}
            disabled={!saved?.hasKey || busy}
            onClick={remove}
          >
            <Trash2 size={16} />
          </Button>
          <span className="spacer" />
          <Button
            variant="outline"
            disabled={busy || !saved}
            onClick={() => save(true)}
          >
            {busy ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <PlugZap size={16} />
            )}
            保存并测试
          </Button>
          <Button disabled={busy || !saved} onClick={() => save()}>
            保存设置
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
