// Scene planning data is kept separate from rendering style and delivery settings.
export const SCENE_FIELDS = ['core', 'backdrop', 'direction', 'keep', 'change'];
export const CONCEPT_FIELDS = ['title', 'summary', 'relationship', 'variation'];
export const emptyScene = () => ({core:'',backdrop:'',direction:'',keep:'',change:'',selected:null});
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value,k));
export function validateConcept(value) {
  if (!exact(value,CONCEPT_FIELDS) || CONCEPT_FIELDS.some(k=>typeof value[k]!=='string'||!value[k].trim()||value[k].length>1000)) throw Error('构思内容不完整，请重新构思。');
  return Object.fromEntries(CONCEPT_FIELDS.map(k=>[k,value[k].trim()]));
}
export function validateScene(value) {
  if (!exact(value,[...SCENE_FIELDS,'selected']) || SCENE_FIELDS.some(k=>typeof value[k]!=='string'||value[k].length>1000)) throw Error('场景设置格式错误，每项最多1000字。');
  return {...Object.fromEntries(SCENE_FIELDS.map(k=>[k,value[k]])),selected:value.selected===null?null:validateConcept(value.selected)};
}
export const LOTUS_CORE = '田野中的荷塘';
export const LOTUS_BACKDROP = '古镇周边的田野，建筑仅作远处陪衬';
export const LOTUS_DIRECTIONS = [
  {id:'rest',title:'荷上小憩',description:'叶面承托，水面轻晃，寻找一处休息的空间。',direction:'围绕荷叶承托与休息的关系构思，让支撑、重心与水面接触形成可见细节。主体按本次意图决定。'},
  {id:'shelter',title:'荷下庇护',description:'在叶下避雨或乘凉，看内外空间如何不同。',direction:'围绕荷叶形成庇护空间构思，探索遮雨或遮阳带来的内外差别；天气遵守明确要求。主体按本次意图决定。'},
  {id:'sailing',title:'荷间泛舟',description:'花叶围成水路，小舟在高低错落间穿行。',direction:'围绕小舟在荷叶荷花之间穿行构思，让通道、遮挡与前方开口决定空间关系；不默认增加乘船人物。'}
];
