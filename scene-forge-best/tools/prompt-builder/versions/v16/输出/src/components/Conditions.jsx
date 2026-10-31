import React, { useMemo, useRef, useState } from "react";
import {
  AutoComplete,
  Button,
  Checkbox,
  Collapse,
  Drawer,
  Empty,
  Input,
  Modal,
  Select,
  Space,
  Tag,
} from "antd";
import {
  PANEL_FIELDS,
  REGIONS,
  GROUPS,
  ATTRIBUTE_OPTIONS,
  CHARACTER_KEYS,
  CHARACTER_LABELS,
  PERSON_COUNTS,
  COMPOSITIONS,
  listItems,
  normalizeBrief,
  clearField,
  setElementSetting,
  requiredDependencies,
  setRequiredElements,
} from "../../brief.mjs";
import {
  optionGroups,
  filterGroups,
  supportsCharacterGender,
  resolveTopic,
} from "../../core.mjs";
const hints = {
  题材: "限定文化与世界设定",
  元素: "可选灵感；勾选必须出现才锁定",
  视觉偏好: "时间、配色、照明与氛围",
  镜头: "选择观看画面的方式",
  风格与复杂度: "表现方式与内容疏密",
  构图: "主体布局与视线",
  目标模型: "最终用于出图的模型",
  画幅: "图片宽高比",
  数量: "每个方案含完整中英文",
  大致说明: "从感觉、画面特点或模糊念头开始",
};
const labels = {
  ...CHARACTER_LABELS,
  gender: "性别（人物适用）",
  role: "角色",
  scale: "相对尺度",
  frame: "画面占比",
  count: "对象数量",
  action: "动作",
  position: "画面位置",
  depth: "前后层次",
  relation: "关系",
  target: "关系对象",
};
export function Choice({
  label,
  value,
  onChange,
  options,
  custom = true,
  maxLength = 200,
  placeholder = "自动设计",
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);
  function showOptions(next) {
    if (next) setQuery("");
    setOpen(next);
  }
  const list = options.filter(Boolean).map((v) => ({ value: v, label: v }));
  return (
    <label className="control">
      <span>{label}</span>
      {custom ? (
        <AutoComplete
          aria-label={label}
          value={value || ""}
          options={list}
          open={open}
          onOpenChange={showOptions}
          onSearch={(text) => {
            setQuery(text);
            setOpen(true);
          }}
          onSelect={() => setOpen(false)}
          onChange={(value) => onChange(value.slice(0, maxLength))}
          filterOption={(_, o) =>
            o.value.toLowerCase().includes(query.toLowerCase())
          }
          notFoundContent="没有匹配候选，可直接输入自定义内容"
        >
          <Input
            ref={inputRef}
            aria-label={label}
            maxLength={maxLength}
            placeholder={placeholder}
            allowClear
            onClick={() => showOptions(true)}
            onFocus={() => showOptions(true)}
            suffix={
              <button
                type="button"
                className="choice-arrow"
                aria-label={`展开${label}选项`}
                aria-expanded={open}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  inputRef.current?.focus();
                  showOptions(true);
                }}
              >
                ⌄
              </button>
            }
          />
        </AutoComplete>
      ) : (
        <Select
          aria-label={label}
          value={value || undefined}
          options={list}
          onChange={(v) => onChange(v || "")}
          placeholder="自动设计"
        />
      )}
    </label>
  );
}
function PickDrawer({ field, draft, onChange, onClose }) {
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [custom, setCustom] = useState(""),
    [error, setError] = useState("");
  const selected = listItems(draft[field]),
    topics = listItems(draft.题材);
  const groups = useMemo(
    () =>
      optionGroups(field === "元素" ? "必须包含" : field, topics).filter(
        ([g]) => field !== "元素" || !["空间与尺度", "服装配色"].includes(g),
      ),
    [field, draft.题材],
  );
  const filtered = filterGroups(groups, search, category);
  function update(items) {
    const values = [...new Set(items)];
    if (values.length > 100 || values.join("；").length > 3000) {
      setError("最多100项，总长度不超过3000字。");
      return false;
    }
    onChange(normalizeBrief({ ...draft, [field]: values.join("；") }));
    setError("");
    return true;
  }
  function add() {
    if (custom.trim() && update([...selected, ...listItems(custom)]))
      setCustom("");
  }
  function finish() {
    if (custom.trim() && !update([...selected, ...listItems(custom)])) return;
    onClose();
  }
  return (
    <Drawer
      open
      title={`选择${field}`}
      onClose={finish}
      size={640}
      className="picker-drawer"
      extra={
        <Button type="primary" onClick={finish}>
          完成选择
        </Button>
      }
    >
      <p className="muted">
        {field === "元素" ? "候选仅作灵感，可采用或舍弃；必须出现请在已选项旁明确勾选。也可添加库外想法。" : "选择文化与世界设定边界，也可自定义；边界内自由构思，明确要求时才跨文化融合。"}
      </p>
      <div className="picker-tools">
        <Input.Search
          aria-label={`搜索${field}`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索名称、别名或分类"
          allowClear
        />
        <Select
          aria-label={`${field}分类`}
          value={category}
          onChange={setCategory}
          options={[
            { value: "", label: "全部分类" },
            ...groups.map(([g]) => ({ value: g, label: g })),
          ]}
        />
      </div>
      <div className="chosen-summary">
        已选 {selected.length} 项 ·{" "}
        {new Set(filtered.flatMap((g) => g[1])).size} 个候选
      </div>
      <div className="selected-tags">
        {selected.map((v) => (
          <Tag
            key={v}
            closable
            onClose={(e) => {
              e.preventDefault();
              update(selected.filter((x) => x !== v));
            }}
          >
            {v}
          </Tag>
        ))}
      </div>
      <div className="custom-add">
        <Input
          aria-label={`自定义${field}`}
          value={custom}
          maxLength={1000}
          onChange={(e) => setCustom(e.target.value)}
          onPressEnter={add}
          placeholder={`输入自定义${field}，按回车添加`}
        />
        <Button onClick={add}>添加</Button>
      </div>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <div className="catalog-options">
        {filtered.length ? (
          filtered.map(([name, items]) => (
            <section key={name}>
              <h3>{name}</h3>
              <div className="option-grid">
                {items.map((v) => (
                  <Checkbox
                    key={v}
                    checked={selected.includes(v)}
                    onChange={(e) =>
                      update(
                        e.target.checked
                          ? [...selected, v]
                          : selected.filter((x) => x !== v),
                      )
                    }
                  >
                    {v}
                  </Checkbox>
                ))}
              </div>
            </section>
          ))
        ) : (
          <Empty description="没有匹配的候选，可添加自定义内容" />
        )}
      </div>
    </Drawer>
  );
}
function AttributeDrawer({ name, draft, onChange, onClose }) {
  const setting = draft.elementSettings.find((s) => s.name === name) || {};
  const isPerson =
    supportsCharacterGender(name) ||
    CHARACTER_KEYS.some((k) => Object.hasOwn(setting, k));
  const topics = listItems(draft.题材).map(resolveTopic).filter(Boolean);
  const clothes = [
    ...new Set(topics.flatMap((t) => t.categories["服装与配饰"] || [])),
  ];
  const colors = [
    ...new Set(topics.flatMap((t) => t.categories["服装配色"] || [])),
  ];
  const groups = [
    ...(isPerson
      ? [
          ["人物基本属性", ["gender", "count", "age", "hairstyle"]],
          [
            "人物服饰",
            ["clothing", "clothingColor", "clothingMaterial", "accessories"],
          ],
        ]
      : []),
    [
      "角色、动作与空间",
      Object.keys(ATTRIBUTE_OPTIONS).filter(
        (k) => !CHARACTER_KEYS.includes(k) && (!isPerson || k !== "count"),
      ),
    ],
  ];
  function optionsFor(key) {
    if (key === "count" && isPerson) return PERSON_COUNTS;
    const suggested = ["clothing", "accessories"].includes(key)
      ? clothes
      : key === "clothingColor"
        ? colors
        : [];
    return [...new Set(["自动", ...suggested, ...ATTRIBUTE_OPTIONS[key]])];
  }
  return (
    <Drawer
      title={`${name} · ${isPerson ? "人物设置" : "角色、动作与空间"}`}
      open
      onClose={onClose}
      size={560}
      extra={
        <Button type="primary" onClick={onClose}>
          完成设置
        </Button>
      }
    >
      <p className="muted">
        参考对象的属性在采用时生效；必须出现的对象在每个方案保留。未指定属性由模型设计。
        {isPerson &&
          "同一人物元素中的多人共用这些属性；不同造型请分别添加人物元素。人物数量与方案数量无关。"}
      </p>
      {groups.map(([title, keys]) => (
        <section key={title}>
          <h3>{title}</h3>
          <div className="attribute-grid">
            {keys.map((key) => (
              <Choice
                key={key}
                maxLength={80}
                label={key === "count" && isPerson ? "人物数量" : labels[key]}
                value={setting[key] || "自动"}
                options={optionsFor(key)}
                custom={!["role", "scale"].includes(key)}
                onChange={(value) =>
                  onChange(setElementSetting(draft, name, key, value || "自动"))
                }
              />
            ))}
          </div>
        </section>
      ))}
      <div className="attribute-grid">
        <label className="control">
          <span>关系对象</span>
          <Select
            aria-label="关系对象"
            allowClear
            placeholder="自动设计"
            notFoundContent="暂无其他已选元素，请先添加关系对象"
            value={setting.target || undefined}
            options={listItems(draft.元素)
              .filter((x) => x !== name)
              .map((x) => ({ value: x, label: x }))}
            onChange={(value) =>
              onChange(setElementSetting(draft, name, "target", value || ""))
            }
          />
        </label>
      </div>
    </Drawer>
  );
}
export function ConditionGrid({ draft, onChange: commit }) {
  const [pending, setPending] = useState(null);
  const [confirmed, setConfirmed] = useState([]);
  function onChange(next) {
    const missing = requiredDependencies(next);
    if (missing.length) { setPending({next, missing}); setConfirmed([]); }
    else commit(next);
  }
  function saveDependencies() {
    const existing = pending.next.elementSettings.filter(s=>s.presence==='required').map(s=>s.name);
    commit(setRequiredElements(pending.next,[...existing,...confirmed]));
    setPending(null);
  }
  const [picker, setPicker] = useState(""),
    [attribute, setAttribute] = useState("");
  const patch = (value) => onChange(normalizeBrief({ ...draft, ...value }));
  function body(field) {
    if (["题材", "元素"].includes(field)) {
      const values = listItems(draft[field]);
      return (
        <>
          <Button
            block
            className="choose-button"
            onClick={() => setPicker(field)}
          >
            {values.length
              ? `已选 ${values.length} 项 · 调整${field}`
              : `＋ 选择${field}`}
          </Button>
          <div
            className={`selected-list ${field === "元素" ? "elements" : ""}`}
            aria-label={`${field}已选项`}
          >
            {values.map((name) => (
              <div className="selected-item" key={name}>
                <button
                  type="button"
                  className="selected-name"
                  title={field === "元素" ? "设置人物属性、动作与空间" : name}
                  onClick={() =>
                    field === "元素" ? setAttribute(name) : setPicker(field)
                  }
                >
                  {name}
                  {field === "元素" && (
                    <span className="edit-hint">设置 ↗</span>
                  )}
                </button>
                {field === "元素" && <Checkbox
                  aria-label={`${name}必须出现`}
                  checked={draft.elementSettings.find(s=>s.name===name)?.presence==='required'}
                  onChange={e=>onChange(setElementSetting(draft,name,'presence',e.target.checked?'required':'reference'))}
                >必须出现</Checkbox>}
                <Button
                  type="text"
                  size="small"
                  aria-label={`移除${name}`}
                  onClick={() =>
                    patch({
                      [field]: values.filter((v) => v !== name).join("；"),
                    })
                  }
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
          {field === "题材" ? (
            <div className="region-control">
              <span className="muted">地域 · 可选</span>
              <Space size={6}>
                {REGIONS.map((value) => (
                  <Button
                    key={value}
                    size="small"
                    type={draft.地域 === value ? "primary" : "default"}
                    aria-label={value}
                    aria-pressed={draft.地域 === value}
                    onClick={() =>
                      patch({ 地域: draft.地域 === value ? "" : value })
                    }
                  >
                    {value}
                  </Button>
                ))}
              </Space>
            </div>
          ) : (
            <p className="field-note">
              元素可留空。参考不限制主体，点击名称设置采用时的属性。
            </p>
          )}
        </>
      );
    }
    if (GROUPS[field]) {
      const parts = Object.fromEntries(
        listItems(draft[field]).map((v) => {
          const i = v.indexOf("：");
          return [v.slice(0, i), v.slice(i + 1)];
        }),
      );
      return (
        <>
          {GROUPS[field].map(([g, options]) => (
            <Choice
              key={g}
              label={g}
              value={parts[g] || ""}
              options={options}
              onChange={(value) => {
                const next = { ...parts };
                if (value) next[g] = value;
                else delete next[g];
                patch({
                  [field]: Object.entries(next)
                    .map(([k, v]) => `${k}：${v}`)
                    .join("；"),
                });
              }}
            />
          ))}
        </>
      );
    }
    if (field === "大致说明")
      return (
        <>
          <Input.TextArea
            aria-label="大致说明"
            value={draft[field]}
            maxLength={3000}
            rows={3}
            onChange={(e) => patch({ [field]: e.target.value })}
            placeholder="例如：安静、辽阔，像时间停止了。只写想法也能生成。"
          />
          <Collapse
            ghost
            size="small"
            items={[
              {
                key: "freedom",
                label: "设计自由度",
                children: (
                  <>
                    <Choice
                      label="设计方式"
                      value={draft.designOptions.exploration}
                      custom={false}
                      options={["自动设计", "随机探索"]}
                      onChange={(v) =>
                        patch({
                          designOptions: {
                            ...draft.designOptions,
                            exploration: v,
                          },
                        })
                      }
                    />
                  </>
                ),
              },
            ]}
          />
        </>
      );
    if (field === "数量")
      return (
        <>
          <Select
            aria-label="数量"
            value={draft.数量}
            onChange={(v) => patch({ 数量: v })}
            options={Array.from({ length: 10 }, (_, i) => ({
              value: `${i + 1}条`,
              label: `${i + 1} 个方案 · ${i + 1} 对双语`,
            }))}
          />
          <div className="count-options">
            {[1, 3, 5, 7, 9].map((n) => (
              <Button
                key={n}
                type={draft.数量 === `${n}条` ? "primary" : "default"}
                aria-label={`${n}个方案`}
                onClick={() => patch({ 数量: `${n}条` })}
              >
                {n}
              </Button>
            ))}
          </div>
          <p className="field-note">数量指方案数，不是画面中的人数或对象数。</p>
        </>
      );
    const options =
      field === "构图"
        ? COMPOSITIONS
        : field === "目标模型"
          ? [
              "Midjourney",
              "OpenAI 图像模型",
              "FLUX",
              "Stable Diffusion",
              "Imagen",
            ]
          : ["9:16", "16:9", "1:1", "4:3", "3:4", "3:2", "2:3", "21:9"];
    return (
      <>
        <Choice
          label={field}
          value={draft[field]}
          options={options}
          onChange={(v) => patch({ [field]: v })}
        />
        {field === "画幅" ? (
          <div className="ratio-preview">
            <div
              style={{
                aspectRatio: /^\d+:\d+$/.test(draft.画幅)
                  ? draft.画幅.replace(":", " / ")
                  : "1",
              }}
            >
              ↗
            </div>
            <span>{draft.画幅 || "自动设计"}</span>
          </div>
        ) : (
          <p className="field-note">
            {field === "目标模型"
              ? "与右上角的文本接口独立。清空后使用通用描述。"
              : "选择构图方式，也可以输入自己的要求。"}
          </p>
        )}
      </>
    );
  }
  return (
    <>
      <Modal open={!!pending} title="明确必需关系" onCancel={()=>setPending(null)}
        footer={<><Button onClick={()=>setPending(null)}>取消本次修改</Button><Button type="primary" disabled={!pending || pending.missing.some(n=>!confirmed.includes(n))} onClick={saveDependencies}>保存必需关系</Button></>}>
        <p>为保留已指定的对象关系，下列目标也需要必须出现。请逐项确认；取消会保留修改前的设置。</p>
        {pending?.missing.map(name=><div key={name}><Checkbox aria-label={`${name}也必须出现`} checked={confirmed.includes(name)} onChange={e=>setConfirmed(e.target.checked?[...confirmed,name]:confirmed.filter(n=>n!==name))}>{name}也必须出现</Checkbox></div>)}
      </Modal>
      <div className="condition-grid">
        {PANEL_FIELDS.map((field, i) => (
          <section
            key={field}
            className={`condition-card field-${i + 1}`}
            aria-label={`${String(i + 1).padStart(2, "0")} ${field}`}
          >
            <div className="card-heading">
              <span className="card-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2>{field}</h2>
              <Button
                type="text"
                size="small"
                aria-label={`清空${field}`}
                onClick={() => onChange(clearField(draft, field))}
              >
                {field === "数量" ? "重置" : "清空"}
              </Button>
            </div>
            <p className="card-hint">{hints[field]}</p>
            <div className="card-body">{body(field)}</div>
          </section>
        ))}
      </div>
      {picker && (
        <PickDrawer
          key={picker}
          field={picker}
          draft={draft}
          onChange={onChange}
          onClose={() => setPicker("")}
        />
      )}
      {attribute && listItems(draft.元素).includes(attribute) && (
        <AttributeDrawer
          name={attribute}
          draft={draft}
          onChange={onChange}
          onClose={() => setAttribute("")}
        />
      )}
    </>
  );
}
