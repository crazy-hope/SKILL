export const LEVEL_NAMES={short:'简短',medium:'中等',detailed:'细致',auto:'自动'};
export function toMarkdown(r,m) {
  const sections=[`# 图生视频提示词\n\n目标：${m.videoModel} · ${m.platform} · ${m.duration}秒 · ${LEVEL_NAMES[r.level]}档\n\nSkill：${m.skillVersion} · 画幅目标：${m.aspectRatio==='original'?'保持原图':m.aspectRatio}`,`## 设计依据\n\n${r.designReason}`];
  if(r.prompt)sections.push(`## 完整提示词\n\n${r.prompt}`);
  if(r.submissionPrompt)sections.push(`## 提交版\n\n${r.submissionPrompt}`);
  if(r.settings.length)sections.push(`## 必要设置\n\n${r.settings.map(s=>`- ${s.name}：${s.value}（${s.status}）`).join('\n')}`);
  for(const [label,items] of [['合并与省略',r.omissions],['需要补充',r.clarificationQuestions],['未确认项',r.uncertainties]])if(items?.length)sections.push(`## ${label}\n\n${items.map(x=>`- ${x}`).join('\n')}`);
  sections.push(`## 来源与核查状态\n\n资料快照日期：${m.snapshotDate}。本次未在线复核。\n\n${m.sources.map(s=>`- [${s.title}](${s.url})`).join('\n')}`);
  return sections.join('\n\n')+'\n';
}
