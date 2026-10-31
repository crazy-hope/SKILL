const MAX_CHECKS = 12;
const MAX_WARNINGS = 16;
const STRING_LIMITS = {requirement:1000,sourceText:3000,promptText:3000,submissionText:3000,note:2000};
const MISSING_CHECKS = '未提供效果核对记录，关键要求是否完整保留仍需复核';

function readRecord(value) {
  if (!value || typeof value!=='object' || Array.isArray(value)) return null;
  if (!['user','design'].includes(value.source) || !['self_checked','needs_review'].includes(value.status)) return null;
  const record={};
  for (const [field,max] of Object.entries(STRING_LIMITS)) {
    const text=value[field]===undefined && field!=='requirement' ? '' : value[field];
    if (typeof text!=='string' || text.length>max || (field==='requirement' && !text.trim())) return null;
    // Preserve quotations byte for byte: trimming a quote could hide a mismatch.
    record[field]=field==='requirement' || field==='note' ? text.trim() : text;
  }
  return {...record,source:value.source,status:value.status};
}

function quotedIn(quote, text) {
  return Boolean(quote.trim()) && typeof text==='string' && text.includes(quote);
}

/**
 * Check only schema and literal quotation locations. self_checked remains a
 * model claim; this function cannot establish meaning, completeness or video quality.
 * Invalid review metadata must never invalidate an otherwise usable prompt.
 */
export function reviewEffects(raw, input, result) {
  const effectChecks=[];
  const reviewWarnings=[];
  const warn=text=>{ if(reviewWarnings.length<MAX_WARNINGS) reviewWarnings.push(text); };
  if (result.status==='needs_clarification' && !result.prompt?.trim()) return {effectChecks,reviewWarnings};

  const checks=raw?.effectChecks;
  const sourceFields=[input.idea,...Object.values(input.details ?? {})].filter(value=>typeof value==='string');
  if (checks!==undefined && !Array.isArray(checks)) warn('效果核对记录格式无效，请人工复核关键要求。');
  if (Array.isArray(checks)) {
    if (checks.length>MAX_CHECKS) warn(`效果核对记录超过${MAX_CHECKS}项，仅保留前${MAX_CHECKS}项供复核。`);
    for (const [index,value] of checks.slice(0,MAX_CHECKS).entries()) {
      const check=readRecord(value);
      if (!check) {
        warn(`效果核对第${index+1}项格式无效或超过长度限制，已略过，请人工复核。`);
        continue;
      }
      const issues=[];
      if (check.source==='user' && !sourceFields.some(text=>quotedIn(check.sourceText,text))) {
        issues.push('用户原文摘录为空，或未在同一个需求字段中找到精确原文。');
      }
      if (check.source==='design' && check.sourceText!=='') {
        issues.push('自主设计不能声称具有用户原文摘录。');
      }
      if (!quotedIn(check.promptText,result.prompt)) {
        issues.push('正文摘录为空，或未在完整正文中找到精确原文。');
      }
      if (result.submissionPrompt?.trim()) {
        if (!quotedIn(check.submissionText,result.submissionPrompt)) {
          issues.push('提交版摘录为空，或未在提交版正文中找到精确原文。');
        }
      } else if (check.submissionText!=='') {
        issues.push('没有提交版正文，无法核实提交版摘录。');
      }
      if (issues.length) check.status='needs_review';
      effectChecks.push({...check,issues});
      if (check.status==='needs_review') {
        warn(`效果核对第${index+1}项需复核：${issues.length ? issues.join('') : '模型标记为仍需人工复核。'}`);
      }
    }
  }
  if (!effectChecks.length && input.version==='v6') warn(MISSING_CHECKS);
  return {effectChecks,reviewWarnings};
}
