import { briefText, targetText, actualDesignText } from "../core.mjs";
export const bilingualText = (s) =>
  `中文提示词\n${s.zh}\n\nEnglish Prompt\n${s.en}`;
export function resultMarkdown(result) {
  const input = briefText(result.brief),
    fence = "`".repeat(
      Math.max(3, ...[...input.matchAll(/`+/g)].map((m) => m[0].length + 1)),
    );
  return (
    `# 提示词方案\n\n生成时间：${result.createdAt}\n规范：${result.spec.version} / SHA-256 ${result.spec.sha256}\n文本生成模型：${result.provider} / ${result.model}\n\n${targetText(result.target)}\n\n## 本次工作台输入\n\n${fence}text\n${input}\n${fence}\n\n` +
    result.schemes
      .map(
        (s, i) =>
          `## ${i + 1}. ${s.name}\n\n${s.concept}\n\n画面规格：${s.specs}\n\n### 本方案实际设计\n\n${actualDesignText(s)}\n\n### 中文提示词\n\n${s.zh}\n\n### English Prompt\n\n${s.en}\n\n模型配置：${s.config}\n\n待验证：${s.checks}`,
      )
      .join("\n\n")
  );
}
export function download(name, content, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(
    content instanceof Blob ? content : new Blob([content], { type }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const active = document.activeElement,
      area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("aria-label", "待复制提示词");
    (document.querySelector(".ant-modal-content") || document.body).append(
      area,
    );
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {}
    area.remove();
    active?.focus({ preventScroll: true });
    return ok;
  }
}
