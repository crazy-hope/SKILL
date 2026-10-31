// Credentials intentionally use a separate local store, excluded from all backups.
export const KEY_STORAGE='scene-forge-api-keys-v1';
function cleanKeys(value){return Object.fromEntries(['openai','deepseek'].map(p=>[p,typeof value?.[p]==='string'?value[p].trim().slice(0,1024):'']));}
export function loadKeys(storage){const raw=storage.getItem(KEY_STORAGE);return raw?cleanKeys(JSON.parse(raw)):cleanKeys({});}
export function saveKeys(storage,keys){storage.setItem(KEY_STORAGE,JSON.stringify(cleanKeys(keys)));}
export function clearKeys(storage){storage.removeItem(KEY_STORAGE);}
export function closeOutsidePickers(pickers,target){for(const picker of pickers)if(picker.details?.open&&(!target||!picker.details.contains(target)))picker.details.open=false;}
export function wireResultNavigation(rows,onActivate){
 function select(index){rows.forEach((r,i)=>{const active=i===index;r.panel.hidden=!active;r.button.setAttribute('aria-pressed',String(active));});}
 rows.forEach((r,i)=>r.button.addEventListener('click',()=>{select(i);onActivate(i);}));
 select(rows.length?0:-1);
}
