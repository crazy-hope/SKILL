export const LEVEL_NAMES={short:'简短',medium:'中等',detailed:'细致',auto:'自动'};
export function toMarkdown(r,m) {
  const sections=[`# 图生视频提示词\n\n目标：${m.videoModel} · ${m.platform} · ${m.duration}秒 · ${LEVEL_NAMES[r.level]}档\n\nSkill：${m.skillVersion} · 画幅目标：${m.aspectRatio==='original'?'保持原图':m.aspectRatio}`,`## 设计依据\n\n${r.designReason}`];
  if(r.prompt)sections.push(`## 完整提示词\n\n${r.prompt}`);
  if(r.submissionPrompt)sections.push(`## 提交版\n\n${r.submissionPrompt}`);
  if(r.reviewWarnings?.length)sections.push(`## 效果复核提示\n\n${r.reviewWarnings.map(x=>`- ${x}`).join('\n')}`);
  if(r.effectChecks?.length) {
    const quote=s=>s.split('\n').map(line=>`> ${line}`).join('\n');
    const checks=r.effectChecks.map(c=>`### ${c.requirement}\n\n来源：${c.source==='user'?'用户要求':'自主设计'} · ${c.status==='self_checked'?'模型已自检':'需复核'}\n\n${c.sourceText?`用户原文：\n${quote(c.sourceText)}\n\n`:''}正文对应：\n${quote(c.promptText)}${c.submissionText?`\n\n提交版对应：\n${quote(c.submissionText)}`:''}${c.note?`\n\n说明：${c.note}`:''}${c.issues?.length?`\n\n${c.issues.map(x=>`- ${x}`).join('\n')}`:''}`);
    sections.push(`## 效果核对（模型自检）\n\n程序仅核对引文出处，不代表语义完整或视频效果。\n\n${checks.join('\n\n')}`);
  }
  if(r.settings.length)sections.push(`## 必要设置\n\n${r.settings.map(s=>`- ${s.name}：${s.value}（${s.status}）`).join('\n')}`);
  for(const [label,items] of [['合并与省略',r.omissions],['需要补充',r.clarificationQuestions],['未确认项',r.uncertainties]])if(items?.length)sections.push(`## ${label}\n\n${items.map(x=>`- ${x}`).join('\n')}`);
  sections.push(`## 来源与核查状态\n\n资料快照日期：${m.snapshotDate}。本次未在线复核。\n\n${m.sources.map(s=>`- [${s.title}](${s.url})`).join('\n')}`);
  return sections.join('\n\n')+'\n';
}

// Display-only parsing: copying and exports continue to use the original prompt.
export function splitPromptSections(text) {
  const heading=/^(?:#{1,3}\s+(.+)|(?:[1-6][.、．)]\s*)?(全局基础硬性设定|场景基底|主体动态细节|运镜规则|同期环境音效|硬性约束)[:：]?)\s*$/gm;
  const sections=[];let cursor=0,title=null;
  for(const match of text.matchAll(heading)) {
    if(match.index>cursor||title!==null)sections.push({title,body:text.slice(cursor,match.index)});
    title=match[1]||match[2];cursor=match.index+match[0].length;
  }
  if(cursor<text.length||title!==null)sections.push({title,body:text.slice(cursor)});
  return sections.length?sections:[{title:null,body:text}];
}
