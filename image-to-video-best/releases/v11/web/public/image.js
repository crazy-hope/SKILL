export function assertImageSignature(bytes,mime) {
  const matches=(signature,offset=0)=>signature.every((v,i)=>bytes[offset+i]===v);
  const valid=(mime==='image/png'&&bytes.length>=8&&matches([137,80,78,71,13,10,26,10]))
    ||(mime==='image/jpeg'&&bytes.length>=3&&matches([255,216,255]))
    ||(mime==='image/webp'&&bytes.length>=12&&matches([82,73,70,70])&&matches([87,69,66,80],8));
  if(!valid)throw new Error('图片真实格式与声明类型不一致或文件已损坏，请重新导出 PNG、JPEG 或 WebP。');
}
