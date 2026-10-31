export function fixture(version = 'v1') {
  return {
    skill_version: version, analysis: { visual_summary: '窗边红色杯子。', mood: '安静明亮。' },
    candidates: Array.from({ length: 5 }, (_, i) => ({ id: i + 1, angle: `配色角度${i + 1}`, zh: { title: `红杯与蓝窗的配色${i + 1}`, description: '红色杯子摆在蓝色窗户旁，明亮的色彩为这个日常角落添了一点温暖。' }, en: { title: `Red and blue, idea ${i + 1}`, description: 'A red cup beside a blue window brings a little warmth to this everyday corner.' } })),
    recommendation: { candidate_id: 2, reason: '红蓝配色突出主体。' }, hashtags: ['#色彩搭配', '#日常角落', '#杯子设计'],
  };
}
