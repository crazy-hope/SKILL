import { readFile } from 'node:fs/promises';
import { AppError } from './errors.mjs';
export const MODELS = Object.freeze([
  {id:'seedance-2.0', label:'Seedance 2.0'},
  {id:'seedance-2.5', label:'Seedance 2.5'},
  {id:'kling-o3', label:'Kling O3'},
  {id:'kling-4.0', label:'Kling 4.0'}
]);
const historicalModels = [
  ...MODELS.slice(0,2),
  {id:'runway-gen4.5', label:'Runway Gen-4.5'},
  {id:'wan-3.0', label:'Wan 3.0'}
];
export const CURRENT_VERSION = 'v6';
export const VERSIONS = ['v1', 'v2', 'v5', CURRENT_VERSION];
export const APP_VERSION = '0.7.1';
export function modelsForVersion(version) { return ['v5',CURRENT_VERSION].includes(version) ? MODELS : historicalModels; }
const root = new URL('../../', import.meta.url);
export function checkSelection(version, videoModel) {
  if (!VERSIONS.includes(version) || !modelsForVersion(version).some(m=>m.id===videoModel)) throw new AppError('INVALID_SELECTION','请选择已提供资料的 Skill 版本和视频模型。');
}
export async function loadSkillContext({version, videoModel}) {
  checkSelection(version,videoModel);
  const modelCard=videoModel==='kling-o3'?'kling-video-3.0-omni':videoModel;
  const files = ['SKILL.md','references/levels.md','references/continuity.md','references/model-verification.md',
    ...(version!=='v1'?['references/creative-fidelity.md']:[]),
    ...(['v5',CURRENT_VERSION].includes(version)?['references/visual-analysis.md','references/prompt-structure.md','references/scene-direction.md']:[]),
    ...(version===CURRENT_VERSION?['references/effect-direction.md']:[]),
    `references/models/${modelCard}.md`];
  const contents = await Promise.all(files.map(f=>readFile(new URL(`${version}/image-to-video-best/${f}`,root),'utf8')));
  const card = contents.at(-1);
  const sources = [...card.matchAll(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g)].map(m=>({title:m[1],url:m[2]}));
  const snapshotDate = /核查日期：\s*(\d{4}-\d{2}-\d{2})/.exec(card)?.[1] ?? '未记录';
  return { files, sources, snapshotDate, text: contents.map((s,i)=>`\n<skill_document path="${files[i]}">\n${s}\n</skill_document>`).join('\n') };
}
