import { AppError } from './errors.mjs';
import { checkSelection } from './catalog.mjs';
export const DETAIL_FIELDS = ['mood','action','camera','environment','gesture','ending','sound','preserve','avoid'];
const fail = message => { throw new AppError('INVALID_INPUT',message); };
function text(value, label, max, required=false) {
  if (value===undefined && !required) return '';
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail(`${label}不能为空且不能超过${max}字符。`);
  return value.trim();
}
function dimensions(b, mime) {
  if (mime==='image/png' && b.length>=33 && b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && b.toString('ascii',12,16)==='IHDR') {
    return [b.readUInt32BE(16),b.readUInt32BE(20)];
  }
  if (mime==='image/jpeg' && b.length>=4 && b[0]===255 && b[1]===216) {
    let i=2;
    while (i+3 < b.length) {
      if (b[i++]!==255) break;
      while (b[i]===255) i++;
      const marker=b[i++];
      if (marker===217 || marker===218) break;
      if (marker===1 || (marker>=208 && marker<=215)) continue;
      if (i+2>b.length) break;
      const size=b.readUInt16BE(i);
      if (size<2 || i+size>b.length) break;
      if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker) && size>=7) return [b.readUInt16BE(i+5),b.readUInt16BE(i+3)];
      i+=size;
    }
  }
  if (mime==='image/webp' && b.length>=30 && b.toString('ascii',0,4)==='RIFF' && b.toString('ascii',8,12)==='WEBP') {
    const type=b.toString('ascii',12,16);
    if (type==='VP8X') return [1+b.readUIntLE(24,3),1+b.readUIntLE(27,3)];
    if (type==='VP8 ' && b[23]===157 && b[24]===1 && b[25]===42) return [b.readUInt16LE(26)&16383,b.readUInt16LE(28)&16383];
    if (type==='VP8L' && b[20]===47) { const bits=b.readUInt32LE(21); return [(bits&16383)+1,((bits>>>14)&16383)+1]; }
  }
  fail('图片内容与格式不符或图片头已损坏，请重新上传 PNG、JPEG 或 WebP。');
}
export function validateInput(body, {maxImageBytes=10*1024*1024}={}) {
  if (!body || typeof body!=='object' || Array.isArray(body)) fail('请求内容无效。');
  const version = body.version ?? 'v1'; const videoModel = body.videoModel;
  checkSelection(version,videoModel);
  const level = body.level ?? 'auto';
  if (!['auto','short','medium','detailed'].includes(level)) fail('请选择有效的描述等级。');
  const duration = body.duration ?? 5;
  if (typeof duration!=='number' || !Number.isFinite(duration) || duration<=0) fail('时长必须是大于零的秒数。');
  const idea=text(body.idea,'一句话需求',6000,true);
  const platform=text(body.platform,'使用平台',200,true);
  const aspectRatio=body.aspectRatio ?? 'original';
  if (!['original','16:9','9:16','1:1','4:3','3:4','21:9'].includes(aspectRatio)) fail('画幅选项无效。');
  const details={};
  if (body.details!==undefined && (!body.details || typeof body.details!=='object' || Array.isArray(body.details))) fail('细节要求无效。');
  for (const key of DETAIL_FIELDS) details[key]=text(body.details?.[key],key,2000);
  if (typeof body.image!=='string' || body.image.length>Math.ceil(maxImageBytes/3)*4+100) fail('请上传图片，且图片不能超过当前大小限制。');
  const match=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(body.image);
  if (!match) fail('图片格式无效，仅支持 PNG、JPEG 和 WebP。');
  const bytes=Buffer.from(match[2],'base64');
  if (bytes.toString('base64')!==match[2] || bytes.length>maxImageBytes) fail('图片编码或大小无效。');
  const [width,height]=dimensions(bytes,match[1]);
  if (!width || !height || width*height>80_000_000) fail('图片尺寸无效或超过本工作台的8000万像素上限。');
  return { version, videoModel, level, duration, idea, platform, aspectRatio, details, image:body.image, imageInfo:{width,height,mime:match[1],bytes:bytes.length} };
}
