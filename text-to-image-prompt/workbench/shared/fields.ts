import type { SettingKey } from "./contracts";
export const fields: Record<
  SettingKey,
  { label: string; hint: string; source: string; options: string[] }
> = {
  media: {
    label: "表现方式",
    hint: "可以融合多种媒介，电影与纪实分别选择",
    source: "条件与设置 / 表现方式",
    options: [
      "电影画面",
      "纪实摄影",
      "插画",
      "油画",
      "动画／卡通",
      "微缩模型",
      "自由选择",
    ],
  },
  visualStyles: {
    label: "具体视觉风格",
    hint: "选择画面质感，不限定题材或年代",
    source: "references/visual-direction.md / 具体视觉风格的选择",
    options: ["柔和光学", "清晰通透", "浓郁明暗", "低反差细腻", "自由选择"],
  },
  colorTone: {
    label: "整体色彩／色调",
    hint: "选择整体配色方向，或自定义主色、冷暖与明暗；自由选择交给模型设计",
    source: "条件与设置 / 整体色彩／色调",
    options: [
      "清冷青绿：玉绿、冷青、乳白，少量淡粉",
      "温暖柔和：米白、琥珀、浅赭，暖调低饱和",
      "自然中性：保留物体本色，冷暖平衡",
      "明亮淡彩：浅色为主，通透明亮",
      "浓郁鲜明：饱和色块，明确色彩对比",
      "深沉暗调：深色为主，少量亮色点缀",
      "黑白灰阶：以明暗层次组织画面",
      "自由选择",
    ],
  },
  genres: {
    label: "题材",
    hint: "已选题材会共同融入每一个场景",
    source: "条件与设置 / 题材",
    options: [
      "东方仙侠",
      "古典神话",
      "科幻",
      "奇幻冒险",
      "生活",
      "历史",
      "产品",
      "建筑",
      "自由选择",
    ],
  },
  culture: {
    label: "文化背景",
    hint: "独立于人物长相、媒介和现实性",
    source: "条件与设置 / 文化背景",
    options: ["东方", "西方", "东西融合", "无文化指向", "自由选择"],
  },
  realism: {
    label: "内容现实性",
    hint: "摄影质感不代表内容必须属于现实世界",
    source: "条件与设置 / 内容现实性",
    options: ["现实世界", "写实奇幻", "自由选择"],
  },
  aspectRatio: {
    label: "画幅",
    hint: "选择比例，或让模型提供建议后确认",
    source: "条件与设置 / 画幅",
    options: ["16:9", "9:16", "1:1", "4:3", "3:2"],
  },
  mood: {
    label: "情绪／氛围",
    hint: "选择希望观众感受到的情绪；会融入场景细节，并在提示词正文末尾收束",
    source: "条件与设置 / 情绪／氛围",
    options: [
      "温暖治愈",
      "宁静平和",
      "轻松愉悦",
      "浪漫亲密",
      "亲密默契",
      "生活化自然",
      "孤独疏离",
      "忧伤惆怅",
      "紧张悬疑",
      "庄严震撼",
      "自由选择",
    ],
  },
  mjVersion: {
    label: "Midjourney 版本",
    hint: "这是生图版本，与生成提示词的大模型不同",
    source: "条件与设置 / 版本",
    options: [],
  },
  personalize: {
    label: "Personalize",
    hint: "个人化设置，代码仅使用你实际提供的值",
    source: "references/midjourney.md / 使用决策",
    options: [],
  },
};
export function styleOptions(media: string[]) {
  const options: string[] = [];
  if (media.includes("电影画面"))
    options.push("柔和光学", "清晰通透", "浓郁明暗", "低反差细腻");
  if (media.includes("纪实摄影")) options.push("自然光清晰", "细腻黑白");
  if (media.includes("油画"))
    options.push("细腻平滑", "厚涂有触感", "概括大色块");
  if (media.includes("插画")) options.push("清透线描", "平面几何", "手绘纸感");
  if (media.includes("动画／卡通"))
    options.push("清晰线条", "平涂色块", "立体体积");
  if (media.includes("微缩模型")) options.push("手工材质", "精细模型");
  return [
    ...new Set([
      ...(options.length
        ? options
        : ["柔和层次", "鲜明反差", "细腻纹理", "简洁色块"]),
      "自由选择",
    ]),
  ];
}
