// Credentials intentionally use a separate local store, excluded from all backups.
export const KEY_STORAGE='scene-forge-api-keys-v1';
function cleanKeys(value){return Object.fromEntries(['openai','deepseek'].map(p=>[p,typeof value?.[p]==='string'?value[p].trim().slice(0,1024):'']));}
export function loadKeys(storage){const raw=storage.getItem(KEY_STORAGE);return raw?cleanKeys(JSON.parse(raw)):cleanKeys({});}
export function saveKeys(storage,keys){storage.setItem(KEY_STORAGE,JSON.stringify(cleanKeys(keys)));}
export function clearKeys(storage){storage.removeItem(KEY_STORAGE);}
export function closeOutsidePickers(pickers,target){for(const picker of pickers)if(picker.details?.open&&(!target||!picker.details.contains(target)))picker.details.open=false;}
export function wireAccordion(rows){
 let active=rows.length?0:-1;
 function paint(){rows.forEach((r,i)=>{const open=i===active;r.panel.hidden=!open;for(const b of [r.title,r.toggle])b.setAttribute('aria-expanded',String(open));r.toggle.textContent=open?'⌃':'⌄';r.toggle.setAttribute('aria-label',`${open?'收起':'展开'}方案${i+1}`);});}
 rows.forEach((r,i)=>{const toggle=()=>{active=active===i?-1:i;paint();};r.title.addEventListener('click',toggle);r.toggle.addEventListener('click',toggle);});paint();
}
