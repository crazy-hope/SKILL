import { readFile } from 'node:fs/promises';
import { AppError } from './errors.mjs';
export const MODELS = Object.freeze([
  {id:'seedance-2.0', label:'Seedance 2.0'},
  {id:'seedance-2.5', label:'Seedance 2.5'},
  {id:'runway-gen4.5', label:'Runway Gen-4.5'},
  {id:'wan-3.0', label:'Wan 3.0'}
]);
export const CURRENT_VERSION = 'v2';
export const VERSIONS = ['v1', CURRENT_VERSION];
const root = new URL('../../', import.meta.url);
export function checkSelection(version, videoModel) {
  if (!VERSIONS.includes(version) || !MODELS.some(m=>m.id===videoModel)) throw new AppError('INVALID_SELECTION','请选择已提供资料的 Skill 版本和视频模型。');
}
export async function loadSkillContext({version, videoModel}) {
  checkSelection(version,videoModel);
  const files = ['SKILL.md','references/levels.md','references/continuity.md','references/model-verification.md',...(version==='v2'?['references/creative-fidelity.md']:[]),`references/models/${videoModel}.md`];
  const contents = await Promise.all(files.map(f=>readFile(new URL(`${version}/image-to-video-best/${f}`,root),'utf8')));
  const card = contents.at(-1);
  const sources = [...card.matchAll(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g)].map(m=>({title:m[1],url:m[2]}));
  return { files, sources, snapshotDate:'2026-10-17', text: contents.map((s,i)=>`\n<skill_document path="${files[i]}">\n${s}\n</skill_document>`).join('\n') };
}
