import React, { useState } from "react";
import { Check, Plus, X, Search, Sparkles, CircleHelp } from "lucide-react";
import { Button, cn } from "./ui/button";
import { OptionTooltip, InfoTooltip, HelpContent } from "./ui/tooltip";
import { getOptionHelp, optionHelp } from "../../shared/option-help";
import { fields, styleOptions } from "../../shared/fields";
import {
  settingKeys,
  type Settings,
  type SettingKey,
} from "../../shared/contracts";
export function MultiChoice({
  label,
  values,
  options,
  onChange,
  disabled = false,
  splitCustomInput = true,
  shortLabels = false,
  field,
}: {
  label: string;
  values: string[];
  options: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
  splitCustomInput?: boolean;
  shortLabels?: boolean;
  field?: SettingKey;
}) {
  const [query, setQuery] = useState("");
  const displayLabel = (value: string) =>
    shortLabels && options.includes(value) ? value.split("：")[0] : value;
  const add = () => {
    const pieces = (splitCustomInput ? query.split(/[＋+,，\n]/) : [query])
      .map((x) => x.trim())
      .filter(Boolean);
    if (pieces.length) {
      onChange([...new Set([...values, ...pieces])].slice(0, 20));
      setQuery("");
    }
  };
  return (
    <div className="multi-choice" role="group" aria-label={label}>
      {values.length > 0 && (
        <div className="selected-tags">
          {values.map((v) => (
            <OptionTooltip
              key={v}
              title={displayLabel(v)}
              help={getOptionHelp(field ?? "genres", v)}
            >
              <span
                className="selected-tag"
                tabIndex={0}
                aria-label={`已选${displayLabel(v)}，查看说明`}
              >
                {displayLabel(v)}
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={`移除${v}`}
                  onClick={() => onChange(values.filter((x) => x !== v))}
                >
                  <X size={12} />
                </button>
              </span>
            </OptionTooltip>
          ))}
        </div>
      )}
      <div className="search-input">
        <Search size={14} />
        <input
          aria-label={`搜索${label}`}
          placeholder="搜索或输入自定义方向"
          value={query}
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              add();
            }
          }}
        />
        {query && (
          <button
            type="button"
            aria-label={`添加${label}`}
            onClick={add}
            disabled={disabled}
          >
            <Plus size={16} />
          </button>
        )}
      </div>
      <div className="chips">
        {options
          .filter((v) => !query || v.includes(query))
          .map((v) => (
            <OptionTooltip
              key={v}
              title={displayLabel(v)}
              help={getOptionHelp(field ?? "genres", v)}
            >
              <button
                type="button"
                className={cn("chip", values.includes(v) && "chosen")}
                disabled={disabled}
                aria-pressed={values.includes(v)}
                aria-label={v}
                onClick={() =>
                  onChange(
                    values.includes(v)
                      ? values.filter((x) => x !== v)
                      : [...values, v],
                  )
                }
              >
                {values.includes(v) && <Check size={12} />} {displayLabel(v)}
              </button>
            </OptionTooltip>
          ))}
      </div>
      {query && !options.some((v) => v.includes(query)) && (
        <button className="custom-option" type="button" onClick={add}>
          添加“{query}” <span>↵</span>
        </button>
      )}
    </div>
  );
}
export function SettingsPanel({
  settings: s,
  onChange,
  onAdvice,
  errors,
  disabled,
  advice,
  styleNotice,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
  onAdvice: (field: "aspectRatio" | "mjVersion") => void;
  errors: SettingKey[];
  disabled: boolean;
  advice?: { field: "aspectRatio" | "mjVersion"; node: React.ReactNode };
  styleNotice?: boolean;
}) {
  const update = (key: keyof Settings, value: Settings[keyof Settings]) =>
    onChange({ ...s, [key]: value });
  return (
    <div className="settings-fields">
      <div className="brief-field">
        <label htmlFor="elements">
          你的创作起点 <span>选填</span>
        </label>
        <textarea
          id="elements"
          value={s.elements}
          onChange={(e) => update("elements", e.target.value)}
          placeholder={
            "一个人物、一处风景，或脑海里的一幕……\n也可以留空，让灵感从选择开始。"
          }
          rows={3}
        />
        <label htmlFor="exclusions" className="small-label">
          一定保留／避免的内容
        </label>
        <textarea
          id="exclusions"
          value={s.exclusions}
          onChange={(e) => update("exclusions", e.target.value)}
          placeholder="例如：仅两个人，不添加路人，不要超自然元素"
          rows={2}
        />
        <p className="field-hint">以上输入都会作为硬条件保留。</p>
      </div>
      {settingKeys.map((key, i) => {
        const f = fields[key];
        return (
          <section
            tabIndex={-1}
            id={`field-${key}`}
            key={key}
            className={cn(
              "setting-section",
              errors.includes(key) && "field-error",
            )}
          >
            <div className="field-heading">
              <span className="field-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <label htmlFor={key}>{f.label}</label>
              {["culture", "realism", "mjVersion", "personalize"].includes(
                key,
              ) && (
                <InfoTooltip
                  content={
                    <div className="option-help-list">
                      {Object.entries(optionHelp[key]).map(([value, help]) => (
                        <section key={value}>
                          <HelpContent
                            title={
                              value === "custom" && key === "mjVersion"
                                ? "填写实际使用的版本"
                                : ((
                                    {
                                      custom: "自定义描述",
                                      inherit: "沿用界面设置",
                                      default: "开启默认个人化",
                                      profile: "使用我的 profile / code",
                                      off: "关闭个人化",
                                    } as Record<string, string>
                                  )[value] ?? value)
                            }
                            help={help}
                          />
                        </section>
                      ))}
                      <small className="option-tooltip-disclaimer">
                        示例说明表达方向，最终措辞会随场景调整。
                      </small>
                    </div>
                  }
                >
                  <button
                    type="button"
                    className="option-help-button"
                    aria-label={`了解${f.label}各选项`}
                  >
                    <CircleHelp size={14} />
                  </button>
                </InfoTooltip>
              )}
              {[
                "media",
                "visualStyles",
                "colorTone",
                "genres",
                "mood",
              ].includes(key) && <span className="field-badge">可多选</span>}
            </div>
            <p className="field-hint">{f.hint}</p>
            {(["media", "visualStyles", "genres", "mood"] as string[]).includes(
              key,
            ) ? (
              <MultiChoice
                label={f.label}
                field={key}
                values={s[key] as string[]}
                options={
                  key === "visualStyles" ? styleOptions(s.media) : f.options
                }
                onChange={(v) => update(key, v)}
                disabled={disabled}
              />
            ) : key === "colorTone" ? (
              <MultiChoice
                label={f.label}
                field={key}
                values={s.colorTone ? s.colorTone.split("\n") : []}
                options={f.options}
                onChange={(values) => update("colorTone", values.join("\n"))}
                disabled={disabled}
                splitCustomInput={false}
                shortLabels
              />
            ) : key === "culture" || key === "realism" ? (
              <>
                <select
                  id={key}
                  value={
                    f.options.includes(s[key]) ? s[key] : s[key] ? "custom" : ""
                  }
                  onChange={(e) =>
                    update(
                      key,
                      e.target.value === "custom" ? "自定义：" : e.target.value,
                    )
                  }
                >
                  <option value="">请选择</option>
                  {f.options.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                  <option value="custom">自定义描述</option>
                </select>
                {s[key] && !f.options.includes(s[key]) && (
                  <input
                    aria-label={`自定义${f.label}`}
                    value={s[key].replace(/^自定义：/, "")}
                    placeholder="输入具体描述"
                    onChange={(e) => update(key, `自定义：${e.target.value}`)}
                  />
                )}
              </>
            ) : key === "aspectRatio" ? (
              <>
                <div className="ratio-options">
                  {f.options.slice(0, 3).map((v) => (
                    <OptionTooltip
                      key={v}
                      title={`${v} 画幅`}
                      help={getOptionHelp("aspectRatio", v)}
                    >
                      <button
                        type="button"
                        className={cn(
                          "ratio-option",
                          s.aspectRatio === v && "chosen",
                        )}
                        aria-pressed={s.aspectRatio === v}
                        onClick={() => update(key, v)}
                      >
                        <span
                          className="ratio-shape"
                          style={{ aspectRatio: v.replace(":", "/") }}
                        />
                        {v}
                        <small>
                          {v === "16:9"
                            ? "横向"
                            : v === "9:16"
                              ? "竖向"
                              : "方形"}
                        </small>
                      </button>
                    </OptionTooltip>
                  ))}
                </div>
                <div className="inline-row">
                  <input
                    id={key}
                    aria-label="自定义画幅"
                    value={s.aspectRatio}
                    onChange={(e) => update(key, e.target.value)}
                    placeholder="自定义，如 4:3"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onAdvice("aspectRatio")}
                    disabled={disabled}
                  >
                    <Sparkles size={13} />
                    请建议
                  </Button>
                </div>
              </>
            ) : key === "mjVersion" ? (
              <>
                <select
                  id={key}
                  value={
                    s.mjVersion === "inherit"
                      ? "inherit"
                      : s.mjVersion
                        ? "custom"
                        : ""
                  }
                  onChange={(e) =>
                    update(
                      key,
                      e.target.value === "custom" ? "填写版本" : e.target.value,
                    )
                  }
                >
                  <option value="">请选择</option>
                  <option value="inherit">沿用我的 Midjourney 界面设置</option>
                  <option value="custom">填写实际使用的版本</option>
                </select>
                {s.mjVersion && s.mjVersion !== "inherit" && (
                  <input
                    aria-label="实际版本号"
                    placeholder="填写实际版本号"
                    value={s.mjVersion === "填写版本" ? "" : s.mjVersion}
                    onChange={(e) => update(key, e.target.value || "填写版本")}
                  />
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onAdvice("mjVersion")}
                  disabled={disabled}
                >
                  不知道版本，协助确认
                </Button>
              </>
            ) : (
              <>
                <select
                  id={key}
                  value={s.personalize}
                  onChange={(e) =>
                    update(
                      "personalize",
                      e.target.value as Settings["personalize"],
                    )
                  }
                >
                  <option value="">请选择</option>
                  <option value="default">开启默认个人化</option>
                  <option value="profile">使用我的 profile / code</option>
                  <option value="off">关闭个人化</option>
                  <option value="inherit">沿用我的界面设置</option>
                </select>
                {s.personalize === "profile" && (
                  <input
                    aria-label="Personalize 代码"
                    value={s.profileCode}
                    onChange={(e) => update("profileCode", e.target.value)}
                    placeholder="粘贴你的真实 profile / code"
                  />
                )}
                {s.personalize === "off" && (
                  <p className="field-hint">
                    使用成品时，也请关闭 Midjourney 界面的个人化开关。
                  </p>
                )}
              </>
            )}
            {key === "visualStyles" && styleNotice && (
              <p className="notice-inline">
                表现方式已改变，已有风格仍保留，请确认融合方向。
              </p>
            )}
            {errors.includes(key) && (
              <p role="alert" className="error-inline">
                请完成{f.label}
                {key === "personalize" ? "及所需代码" : ""}
              </p>
            )}
            {advice?.field === key && (
              <div data-advice-for={key}>{advice.node}</div>
            )}
          </section>
        );
      })}
    </div>
  );
}
