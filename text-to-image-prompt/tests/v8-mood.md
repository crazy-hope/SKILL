# v8 情绪项独立文本与对话模拟检查

日期：2026-11-03。只读项目源文件；仅写本报告。已读 CHANGELOG.md、当前 SKILL.md（metadata.version: v8）、references/visual-direction.md、references/midjourney.md，并直接读取 releases/v7.zip 内 text-to-image-prompt/SKILL.md。未联网、未调用原生提问、未生图；以下是人工编排的模拟输入、预期状态与完整文本样本，不是客户端端到端测试或 Midjourney 效果验证。

## 1. v7 / v8 分叉

模拟已有答案：表现方式=电影；具体风格=柔和光学；色调=冷青灰；题材=生活；文化=东方；现实性=现实世界。

- v7 ZIP 原文顺序：内容现实性 → 画幅 → Midjourney 版本 → Personalize。因此下一题是画幅。
- 当前 v8 原文顺序：内容现实性 → 情绪／氛围（可多选融合）→ 画幅 → Midjourney 版本 → Personalize。因此下一题必须是情绪，不能直接进入画幅或场景。
- visual-direction.md 新增情绪独立确认、全部选择保留、亲密不自动成为爱情、无人物场景不补人物及方式1冻结表情动作等约束，与入口一致。

主会话已核实真实工具 schema 为 `{questions:[{title:string,options?:string[]}]}`；本子代理未实际调用工具。按该 schema 静态核验的拟调用如下，没有伪造多选字段：

```json
{"questions":[{"title":"你希望这轮画面传达哪些情绪／氛围？可输入多项，用＋或逗号分隔，也可以直接输入偏好。","options":["轻松愉悦","亲密默契","生活化自然","温暖治愈","宁静平和","神秘不安","孤独疏离","忧伤惆怅","紧张悬疑","庄严震撼","自由选择"]}]}
```

模拟工具仅返回 accepted：状态仍为 awaiting_mood，情绪集合未填；停止本轮，不发画幅题、不输出候选、不补成品。预选、关闭、空答或超时同样不推进，也不反复重发卡片。

## 2. 单选卡片上的组合与追加

| 模拟输入／事件 | 记录与下一步 |
|---|---|
| 点击“轻松愉悦” | 保存情绪={轻松愉悦}，仍停留本项；提示当前已选，仅询问完成或继续添加 |
| 自由输入“再加亲密与生活化” | 保存={轻松愉悦,亲密默契,生活化自然}，保留第一项，不当作爱情；仍只问本项是否完成 |
| 点击“完成本项选择” | 完成情绪项；下一题只问画幅 |
| 单次直接输入“轻松＋亲密＋生活化” | 完整记录组合，视为主动明确提供该项，直接问下一个缺项；不强迫逐项点击 |

追加后的拟单题：

```json
{"questions":[{"title":"已选轻松愉悦＋亲密默契＋生活化自然；还要添加情绪，还是完成本项选择？","options":["完成本项选择","温暖治愈","宁静平和","神秘不安","孤独疏离","忧伤惆怅","紧张悬疑","庄严震撼"]}]}
```

旧设置迁移：模拟用户“沿用上次全部设置”，上次九项完整已知、没有情绪。保留这九项，只补上述情绪题；实际答完后才能进入候选，不重问画幅、版本或 Personalize，也不从旧版配色推断情绪。

自由选择边界：在情绪题答“自由选择”，只将情绪设计交给 skill。若画幅未答，仍问画幅；若十项均齐，给五候选并等待场景选择，在每个候选明确设计出的情绪。不能将其解释成授权代选场景与变化方式。场景选定后，设计出的情绪冻结。

## 3. 完整输出模拟夹具

模拟用户其余九项已答：电影、柔和光学、冷青灰、生活、东方、现实世界、16:9、版本沿用当前界面、Personalize 沿用当前界面。新增情绪为轻松＋亲密＋生活化。模拟用户已选择场景“两位朋友在无雨白昼车展共扶翻开的车型册”，并选择“同一瞬间、不同拍法”。因此此处直接交付三版是已满足全部等待条件的测试分支，并非绕过候选选择。

共同冻结：东方生活语境的中文导视车展，只有两位成年朋友，两人并肩靠近但不拥抱；深灰外套朋友托住册子左侧下缘，浅灰衬衣朋友托住右侧下缘；打开同一跨页，双手让纸面稳定摊开；两人都微低头看跨页，嘴角轻扬、肩膀放松。背景是一辆银灰展车及低矮说明牌。无雨白昼，地面、衣物、册页干燥，天光从高侧窗进入。三版仅改变摄影机、取景与景深，不换站位、不改表情或动作。未指定制作年代，不添加具体年代。

### 版本一：正前方双人中景

中文

```text
电影画面：东方城市车展中，两位成年朋友正在共同扶稳一本翻开的车型册，正前方平视双人中景，取景从头顶到大腿，两人约占画面高度三分之二；视觉重点是两张微笑的脸与两侧承托册页的手。整体采用冷青、银灰与浅灰组成的偏冷低饱和色调，中间调明亮、阴影保留层次，冷青落在展厅玻璃反射，银灰落在展车，人物肤色保持自然。深灰外套朋友托住册子左侧下缘，浅灰衬衣朋友托住右侧下缘，册子停在两人腰部上方，保持同一跨页摊开；纸张中央略向书脊弯曲，指腹承托处形成细小折线。两人并肩靠近，肩膀放松，均微低头看着车型册，嘴角轻扬。轻松、亲密而生活化的气氛来自舒展的神态、朋友间不拘谨的距离与顺手共同扶书的默契；亲密属于友情。背景只有一辆银灰展车、低矮说明牌和中文展区导视，没有其他人物。无雨的白昼，干燥地面承接展车的淡淡反光，干燥衣料保持松软褶皱。高侧窗天光柔和地照过两人的脸和纸面，光泽纸边呈细薄亮线，车漆高光平滑渐变；柔和光学体现在高光过渡，脸部结构、可见眼睛与手部接触仍清晰，景深覆盖两位朋友和册子，非人物背景稍弱化。现实尺度与支撑关系可信。--ar 16:9
```

English

```text
A cinematic frame at an auto show in an East Asian city: two adult friends jointly steady an open car brochure. An eye-level frontal medium two-shot frames them from above their heads to their thighs, with the pair filling about two-thirds of the image height; the focal event connects their smiling faces to the hands supporting the pages. The overall palette combines cool cyan, silver gray and pale gray at low saturation, with bright midtones and layered shadows. Cool cyan appears in the hall's glass reflections, silver gray in the display car, while skin retains its natural color. The friend in a dark gray jacket supports the brochure's lower left edge; the friend in a light gray shirt supports its lower right edge. Held just above their waists, the brochure stays open to the same spread, its paper curving slightly toward the spine and making small creases where their fingertips carry it. They stand close, side by side, shoulders loose, both looking slightly downward at the pages with gently lifted mouth corners. The relaxed, close and everyday atmosphere is visible in their easy expressions, unselfconscious distance and familiar cooperation over this small shared task; their closeness is friendship. Behind them are only a silver-gray display car, a low information stand and Chinese exhibition signage, with no additional people. It is a rain-free daytime scene: the dry floor carries a faint car reflection and dry clothing falls in soft folds. Daylight from a high side window passes gently across their faces and the paper; glossy page edges catch thin highlights and the car's paint has smooth highlight transitions. Soft optics shape those highlights while both friends' visible eyes, facial structures and hand contacts stay clear. Depth of field covers both friends and the brochure, with only the unoccupied background slightly softened. Scale and physical support remain credible. --ar 16:9
```

### 版本二：前侧方双人近景

中文

```text
电影画面：东方城市车展里的两位成年朋友共同扶着翻开的车型册，摄影机移到两人前方稍偏深灰外套朋友的一侧，以略高于册子的观察位置拍双人近景，取景从头顶到腰下，完整纳入两张脸、双方承托的手和展开的跨页；两人占据画面大部分面积，册页把目光引向共同阅读的表情。整体维持冷青、银灰、浅灰的偏冷低饱和调色，明亮中间调与有层次的暗部相接；背景玻璃带冷青反射，银灰车身构成低调色块，皮肤保持本色。深灰外套朋友的手仍托住册子左侧下缘，浅灰衬衣朋友仍托住右侧下缘，两人并肩站在原位，册子仍在腰部上方打开同一跨页，纸面中央沿书脊微弯，指腹支撑处有轻微折痕。两人都微低头看纸面，嘴角轻扬、肩膀松弛，朋友间相近的距离与配合扶册的动作使画面轻松、亲密、生活化，没有情侣式拥抱或新的动作。此机位呈现一张偏侧面和一张偏正面的脸，可见眼睛及面部轮廓均清楚，不要求他们转头面向摄影机。无雨白昼，高侧窗天光照亮脸侧和册页；柔和光学让皮肤与光泽纸面的高光逐渐过渡，保留面部自然明暗和指腹接触细节，景深覆盖两张脸及册子。背景仅露银灰展车局部、低矮说明牌与中文展区导视，环境略柔化且没有其他人物；衣物与纸页干燥，现实材质与比例可信。--ar 16:9
```

English

```text
A cinematic frame of two adult friends jointly holding an open car brochure at an auto show in an East Asian city. The camera moves slightly to the front side nearer the friend in the dark gray jacket, observing from a position above the brochure. This close two-shot runs from above their heads to below their waists, keeping both faces, both supporting hands and the entire spread inside the frame. The pair occupies most of the image, and the pages lead attention toward their shared reading expressions. The overall grade remains cool cyan, silver gray and pale gray at low saturation, joining bright midtones to layered dark values. The background glass holds cool cyan reflections, the silver-gray car forms a subdued color field and skin retains its own color. The dark-jacketed friend's hand still supports the brochure's lower left edge and the light-gray-shirted friend's hand its lower right edge. Both remain side by side in their original positions; the brochure stays just above their waists, open to the same spread, gently curved at its spine with slight creases at the supporting fingertips. Both look slightly downward at the paper, mouth corners lifted and shoulders relaxed. Their close distance as friends and coordinated support of the brochure make the moment relaxed, intimate in friendship and everyday, without a romantic embrace or a new action. From this camera position one face is more in profile and the other more frontal; visible eyes and facial contours remain clear, without turning either person toward the lens. In this rain-free daytime scene, light from the high side window falls across their faces and the pages. Soft optics give gradual transitions to highlights on skin and glossy paper while retaining natural facial shading and fingertip contact details. Depth of field covers both faces and the brochure. Behind them appear only part of the silver-gray display car, the low information stand and Chinese exhibition signage; the unoccupied setting is slightly softened and contains no additional people. Clothes and pages are dry, with credible real-world materials and proportions. --ar 16:9
```

### 版本三：环境广景

中文

```text
电影画面：在东方城市带中文导视的车展展厅里，两位成年朋友并肩共同扶住一本翻开的车型册，摄影机退到两人正前方，以平视环境广景呈现完整人物与旁侧银灰展车；两人约占画面高度三分之一，人物和册子的共同关系是事件中心，展车与高侧窗交代地点。整体为冷青、银灰与浅灰组成的偏冷低饱和色调，明亮中间调与深浅清楚的灰色阴影组织空间；玻璃反射带冷青，车身银灰，人物深浅灰服装与自然肤色构成简洁层次。深灰外套朋友托住册子左侧下缘，浅灰衬衣朋友托住右侧下缘，册子保持在腰部上方，打开同一跨页，纸张中央向书脊轻轻弯曲；从此距离可读的是共同承托的轮廓和展开的纸面，不要求辨读小字。两人站位不变，并肩靠近，均微低头看册页，嘴角轻扬，肩部舒展。轻松、亲密、生活化的友情氛围由放松的姿态、共同视线和协作扶册的小事体现，人物及可见面部保持清晰、表情与动作可辨，不将远处人物写成散景。展厅仅这两个人，银灰展车旁立着低矮说明牌，中文导视保持展览空间的生活语境。无雨白昼，高侧窗提供原有天光，干燥地面留浅淡车身反射，衣物和册页干燥；柔和光学以平缓车漆高光与窗边亮部过渡呈现，景深涵盖两人及关键环境，保留真实空间尺度，不新增天气、人物或事件。--ar 16:9
```

English

```text
A cinematic frame inside an auto-show hall in an East Asian city with Chinese exhibition signage. Two adult friends stand side by side and jointly support an open car brochure. The camera retreats directly in front of them for an eye-level environmental wide shot that includes their full figures and a silver-gray display car beside them. The pair fills about one-third of the image height; their shared connection to the brochure remains the central event, while the car and high side window establish the setting. The overall palette combines cool cyan, silver gray and pale gray at low saturation, organizing space through bright midtones and clearly layered gray shadows. Glass reflections carry cool cyan, the car remains silver gray, and the friends' contrasting gray clothes and natural skin colors form simple tonal layers. The dark-gray-jacketed friend supports the brochure's lower left edge, while the light-gray-shirted friend supports its lower right edge. It stays just above their waists, open to the same spread, with the paper curving gently toward the spine. At this distance the readable details are their shared supporting gestures and the open sheet, without demanding legible small print. Their positions remain unchanged: they stand close together, both looking slightly down at the pages, mouth corners gently lifted and shoulders at ease. The relaxed, intimate-in-friendship and everyday mood is carried by their loose posture, shared gaze and cooperation over the brochure. Both figures and their visible faces remain clear, with readable expressions and actions rather than being reduced to distant bokeh. These are the only two people in the hall. A low information stand stands beside the silver-gray car, and Chinese signage anchors the ordinary exhibition setting. It is rain-free daytime; the same high side window supplies daylight, the dry floor holds a faint reflection of the car, and clothing and pages remain dry. Soft optics appear in gradual car-paint highlights and smooth bright transitions near the window. Depth of field includes both friends and the key surroundings, preserving real spatial scale without adding weather, people or events. --ar 16:9
```

## 4. 六段逐一复核

| 段落 | 全部情绪显式概括 | 可见依据 | 色调／硬条件／方式1 |
|---|---|---|---|
| 一中文 | 轻松、亲密、生活化 | 放松肩部、微笑、朋友距离、双人扶册 | 冷青灰；两人；无雨白昼；同跨页与动作 |
| 一英文 | relaxed, close and everyday | easy expressions, distance, cooperation | 对应中文；友情明确 |
| 二中文 | 轻松、亲密、生活化 | 原有表情、同向看册、双手承托 | 只改前侧机位与近景，不转头或移人 |
| 二英文 | relaxed, intimate in friendship and everyday | lifted mouth corners, relaxed shoulders, coordinated support | 对应中文；不强改暖色或恋爱 |
| 三中文 | 轻松、亲密、生活化 | 放松姿态、共同视线、扶册小事 | 只退远；人物清晰且不要求微小文字可读 |
| 三英文 | relaxed, intimate-in-friendship and everyday | loose posture, shared gaze, cooperation | 对应中文；无雨、无额外人物或新事件 |

参数六段均为 --ar 16:9；版本与个人化明确沿用界面，因此不编造 --v 或 profile。参数检查仅对照本地规则，不作最新外部兼容性声明。三个景别都独立写清媒介、整体配色、情绪、人物数量与接触、自然光来源；没有把柔和光学变成面部模糊，没有附加纪实标签或具体制作年代。场景未使用暖黄色调、雨水或爱情关系制造亲密。

## 5. 黑白静物短测

模拟输入：黑白静物、宁静＋神秘、现实世界、仅空杯与折叠纸张，不要人物。输出片段：

中文：黑白静物画面，一只空陶杯与一张折叠纸摆在石面上，整体以浅灰、炭黑和纸白组织低反差中间调，杯口内侧保留深黑层次。气氛宁静而神秘：物件之间宽阔的留白使画面安定，侧窗投下的矩形光斑在纸折处中断，杯内被遮挡的暗部留下无法一眼看尽的深度。纸张保持干燥，陶杯边缘呈柔和明暗渐变；画面没有人物，不出现彩色、超自然发光或新增剧情。

English: A monochrome still life of an empty ceramic cup and a folded sheet of paper on a stone surface. Pale gray, charcoal and paper white form low-contrast midtones, with layered deep black inside the cup. The mood is tranquil and mysterious: generous empty space between the objects creates stillness, a rectangular patch of side-window light breaks across the paper fold, and the cup's occluded interior holds a depth that is not immediately visible. The paper stays dry and the ceramic rim has a gentle tonal transition. There are no people, colors, supernatural glows or added story events.

结果：两种情绪被明确写出并由空间和光影支撑；没有用人物、爱情、雨或幻想替代情绪，也未由“神秘”强制增加“不安”。此短测是情绪边界片段检查，不冒充完整三版交付。

## 结论与范围

所读规则支持预期的 v7→v8 分叉、单题与 accepted 等待、多选追加、旧设置补问和仅本项自由选择；本报告模拟样本六段的情绪、冷青灰调色、友情和同瞬间动作对齐。未发现本次限定场景的规则冲突。该结论只覆盖静态规则审阅与上述人工文本／状态模拟；没有真实工具交互、自动化运行时断言、客户端弹窗端到端或 Midjourney 出图效果证据。
