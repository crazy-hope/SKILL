export const MAX_IMAGES = 9;
export const MAX_IMAGE_BYTES = 100 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 100 * 1024 * 1024;
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

// Shared by selection and request validation so appending cannot bypass limits.
export function validateImageBatch(items) {
  if (!Array.isArray(items) || !items.length) throw new Error('请至少选择一张图片。');
  if (items.length > MAX_IMAGES) throw new Error(`一次最多 ${MAX_IMAGES} 张图片，请移除部分图片后重试。`);
  let total = 0;
  items.forEach((item, i) => {
    if (!IMAGE_TYPES.includes(item.type)) throw new Error(`第 ${i + 1} 张格式不支持，请选择 JPG、PNG 或 WebP 图片。`);
    if (!Number.isSafeInteger(item.size) || item.size <= 0) throw new Error(`第 ${i + 1} 张图片为空或无法读取。`);
    if (item.size > MAX_IMAGE_BYTES) throw new Error(`第 ${i + 1} 张过大，单张图片不能超过 100 MB。`);
    total += item.size;
  });
  if (total > MAX_TOTAL_BYTES) throw new Error('图片合计不能超过 100 MB，请移除部分图片或压缩后重试。');
}

export async function prepareImageBatch(existing, files, read) {
  validateImageBatch([...existing, ...files]);
  const additions = [];
  for (const [index, file] of files.entries()) {
    try { additions.push(await read(file)); }
    catch { throw new Error(`第 ${existing.length + index + 1} 张（${file.name}）无法读取或像素过大。本次选择未添加，请移除该文件后重新选择。`); }
  }
  return [...existing, ...additions];
}
