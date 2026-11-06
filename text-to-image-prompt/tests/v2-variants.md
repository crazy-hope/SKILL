# v2 变化方式独立模拟测试

测试范围：只读 SKILL.md 与 references/midjourney.md，按两条独立用户选择路径生成提示词并作文本核对；未提交 Midjourney，未生成或评估图像。

两条路径共同前提：用户本轮已确认电影实拍、16:9、版本沿用界面、Personalize 关闭；硬条件为细雨、车展、两个人。用户已选定题述场景，故不重复设置、场景或变化方式问答。

参数说明：所有提示词仅附 `--ar 16:9`，省略版本参数与个人化参数。请关闭 Midjourney 界面的 Personalize 开关及默认后缀中的个人化设置；仅省略 `--p` 不能确保界面默认个人化已关闭。

## 独立路径①：用户选择“同一瞬间、不同拍法”

冻结基准：傍晚露天车展、细雨、深绿色复古车、正对车头时修复师在画面左侧而参观者在右侧；只有灰外套修复师和米色风衣参观者。修复师右手压住透明展示膜靠近自己的前角，左手垂在身侧；参观者左手掌托住刚滑过引擎盖前缘的说明卡下边，卡片上边仍接触湿膜，右手贴近自己腰侧。两人目光都落在卡片上，双脚踩在湿地面，各自微微前倾。冷色天光与车后展架暖白灯条为固定现场光源。三版只改变拍法。

### 1. 正面中景：两只手之间的倾斜卡片

中文
```text
电影实拍质感，傍晚细雨中的露天车展，深绿色复古车停在低矮展示围栏内，车后空置的车辆展位、车型展架与固定暖白灯条交代车展环境。整个画面只有两个人：正对车头时，穿灰色工作外套的修复师在左，穿米色风衣的参观者在右。两人双脚稳踩湿地面，身体略向引擎盖前倾；修复师右手掌压着透明防雨展示膜靠近自己的前角，掌下薄膜紧贴车漆，左手自然垂在身侧；参观者左手掌托住正在滑过引擎盖前缘的车型说明卡下边，卡片斜立，上边仍接触湿膜，右手收在自己腰侧。两人的视线都准确落在这张卡片上。相机位于车头前方，约胸口高度，正面中景，35毫米镜头感，从两人膝部以上取景；引擎盖下缘横贯前景，两人的脸、修复师右手、参观者左手与卡片形成清楚的视觉三角，没有遮挡关键接触。细小雨滴积在透明膜上，受压处出现放射状浅皱，卡片一角带水，风衣肩部和灰外套袖口有深色湿痕。冷蓝暮色从上方均匀照亮人物，车后固定暖白灯条沿膜边与湿车漆形成细亮反光，柔和低反差，绿色、灰色、米色为主，真实皮肤、布料与玻璃反射，像偶然捕捉到的一次默契协作。单一静态瞬间，横向构图。 --ar 16:9
```

English
```text
Live-action cinematic photography at an outdoor car exhibition in fine drizzle at dusk. A dark green vintage car sits inside a low display barrier; empty vehicle bays, a model-information stand and fixed warm-white light strips behind the car establish the exhibition. Exactly two people occupy the image: viewed facing the front of the car, a restorer in a gray work jacket stands on the left and a visitor in a beige trench coat on the right. Both have their feet planted on wet ground and lean slightly toward the hood. The restorer's right palm pins the nearest front corner of a transparent rain-protection display film against the paint; their left hand hangs at their side. The visitor's left palm supports the lower edge of a model-information card slipping past the front edge of the hood. The tilted card's upper edge still touches the wet film, while the visitor's right hand stays beside their waist. Both look directly at the card. A chest-height camera in front of the car gives a frontal medium shot with a 35 mm lens feel, framing both people from above their knees. The hood crosses the foreground; faces, both working hands and the card form a clear visual triangle, with every essential contact visible. Tiny droplets bead on the film, shallow wrinkles radiate from the pinned corner, and one card corner is wet. Darkened moisture marks appear on coat shoulders and jacket cuffs. Cool blue evening skylight provides soft illumination; the fixed warm-white strips behind the car produce narrow reflections on film and wet paint. Restrained green, gray and beige colors, natural skin and fabric, believable glass reflections, the quiet cooperation of one candid frozen instant in a horizontal composition. --ar 16:9
```

### 2. 车头右前方斜拍：让接卡的手成为近景

中文
```text
电影实拍，傍晚的露天车展持续落着细雨，一辆深绿色复古车位于低矮展示围栏中，车后可见空置车辆展位、车型展架以及固定暖白灯条。整个画面只有两人：以正对车头的方向为准，灰色工作外套修复师站左侧，米色风衣参观者站右侧。两人脚踩湿地面，身体略前倾；修复师用右手掌压住透明防雨展示膜靠近自己的前角，左手垂在身侧；参观者用左手掌托着刚滑过引擎盖前缘的车型说明卡下边，卡片上边仍触着湿膜，右手停在腰侧。两人的目光同时落在倾斜的卡片上，动作尚未完成。相机位于车头右前方、参观者的外侧，保持胸口高度，以50毫米镜头感作斜向中近景；从侧面看见参观者的左手和卡片，参观者躯干位于画面右缘，不遮挡手部；沿引擎盖斜线向后看见修复师压膜的右手及低头的脸，两张脸和两处手部接触均清晰可辨。前景车灯边缘带柔软虚化，卡片和手部最清楚，背景展架仍可识别。透明膜上的细雨水珠、右手掌下浅浅的放射皱纹、卡片湿角、肩部及袖口深色湿痕构成可信反馈。上方冷蓝暮色与车后固定暖白灯条共同照明，改变观察角度让膜边反光成为细窄斜线，保留柔和低反差和绿色、灰色、米色主调，呈现真实皮肤、湿漆和布料。一张静止画面，横向构图。 --ar 16:9
```

English
```text
Live-action cinematic photography of an outdoor car exhibition in fine drizzle at dusk. A dark green vintage car stands within a low display barrier; empty vehicle bays, a model-information stand and fixed warm-white light strips remain visible behind it. Exactly two people are present: facing the front of the car, the restorer in a gray work jacket stands on the left and the visitor in a beige trench coat on the right. Their feet are planted on wet ground and both lean slightly forward. The restorer's right palm pins the nearest front corner of the transparent rain-protection display film; their left hand hangs at their side. The visitor's left palm supports the lower edge of a model-information card just slipping past the front edge of the hood, its upper edge still touching the wet film; their right hand rests beside their waist. Both look at the tilted card, the intervention still unfinished. The chest-height camera stands diagonally in front of the car on its right, outside the visitor, with a 50 mm lens feel and a medium-close framing. The visitor's torso stays at the right edge without hiding their left hand or the card. The hood's diagonal leads toward the restorer's pressing right hand and lowered face. Both faces and both hand contacts remain legible. A softly blurred headlamp edge occupies the foreground; the card and hands are sharpest, with the exhibition stand still recognizable behind them. Rain beads, shallow radial film wrinkles under the restorer's palm, a damp card corner and dark moisture marks on shoulders and cuffs provide material detail. Cool blue skylight and the fixed warm-white strips behind the car preserve soft low-contrast lighting; the oblique viewpoint turns film-edge reflections into narrow diagonal lines. Green, gray and beige dominate, with believable skin, wet paint and cloth. One frozen instant, horizontal composition. --ar 16:9
```

### 3. 前方略高机位：雨膜上的动作关系

中文
```text
傍晚露天车展的电影实拍画面，细雨落在深绿色复古车的引擎盖上，车辆被低矮展示围栏环绕，车后是空置车辆展位、车型展架和固定暖白灯条。整个画面恰好两个人：正对车头时左侧是灰色工作外套修复师，右侧是米色风衣参观者。两人双脚踩稳湿地面，略微向前倾；修复师右手掌压住透明防雨展示膜靠近自己的前角，左手垂在身侧；参观者左手掌接住正在滑过引擎盖前缘的车型说明卡下边，斜立卡片的上边仍与湿膜接触，右手贴近腰侧。两个人都低头看着卡片，保持这一个未完成的接卡瞬间。摄影机置于车头正前方、比两人眼睛略高的位置，小角度向下观察，以40毫米镜头感取横向中景，把两人头部到膝上、整片引擎盖前半部和下方一小条湿地面纳入画面；不是垂直俯拍，仍能看清两张侧低的脸与视线。卡片位于画面下部中央，左右两只工作中的手清晰分开，压膜点与接卡点通过膜上浅皱和水痕连接，关键手指不被车缘遮住。细雨颗粒附着于膜面，掌下薄膜贴紧漆面，卡片一角浸湿，衣肩和袖口出现较深湿斑。冷蓝天光从上方柔和覆盖全景，车后固定暖白灯条在湿漆与透明膜上投下克制亮边，保持低反差及绿色、灰色、米色主调，真实胶片般层次、皮肤纹理和织物重量，以清楚的空间关系表达短暂协作。 --ar 16:9
```

English
```text
A live-action cinematic image of an outdoor car exhibition in fine drizzle at dusk. A dark green vintage car stands within a low display barrier; empty vehicle bays, a model-information stand and fixed warm-white light strips sit behind the car. Exactly two people are visible. Facing the car's front, the restorer in a gray work jacket is on the left and the visitor in a beige trench coat is on the right. Both plant their feet on wet ground and lean slightly forward. The restorer's right palm pins the nearest front corner of a transparent rain-protection display film against the hood, with their left hand hanging at their side. The visitor's left palm catches the lower edge of a model-information card slipping beyond the hood's front edge. The tilted card's upper edge still contacts the wet film, and the visitor's right hand stays beside their waist. Both look down at the card in this single unfinished catching moment. Place the camera directly in front of the car, slightly above the subjects' eye level, looking gently downward with a 40 mm lens feel. A horizontal medium shot includes their heads to above their knees, the front half of the hood and a narrow strip of wet ground. This is not an overhead view; both lowered faces and their gaze directions remain visible. The card sits near the lower center, the two working hands clearly separated. Shallow film wrinkles and moisture trails connect the pressing point and catching point, with essential fingers visible beyond the car edge. Fine droplets coat the film, the pinned section lies flat against the paint, one card corner is damp and darker wet patches mark shoulders and cuffs. Cool blue skylight softly covers the scene; the fixed warm-white strips behind the car add restrained bright edges to wet paint and film. Low contrast, green, gray and beige colors, film-like tonal depth, authentic skin texture and weighty cloth convey quiet cooperation through clear spatial relationships. --ar 16:9
```

## 独立路径②：用户选择“同一场景、不同故事瞬间”

本路径不继承路径①的动作冻结。保持同一傍晚细雨露天车展、两位相同人物、相同服装与深绿色复古车；以说明卡防雨处理形成三个有关联、各自可独立出图的静态瞬间。左手接卡及右手压膜属于已选场景的初始互动，不误当作此模式不可变的用户输入硬条件。

### 1. 接住将落的说明卡

中文
```text
电影实拍，傍晚细雨中的露天车展，一辆深绿色复古车停在低矮围栏内，空置车辆展位和车型展架向后延伸，车后固定暖白灯条亮起，整个画面只有两个人。以正对车头的方向观察，灰色工作外套修复师在车头左侧，米色风衣参观者在右侧。透明防雨展示膜覆盖引擎盖，车型说明卡正从湿滑膜面滑过前缘；修复师双脚分开站稳，身体略向车身前倾，用右手掌压住靠近自己的膜角，左手垂在身侧；参观者略微屈膝前倾，左手掌刚托住倾斜卡片的下边，卡片上边仍搭在膜上，右手贴近腰侧。两人的目光同时落在卡片上，手部都没有遮住卡片轮廓。相机位于车头前方胸口高度，35毫米镜头感的横向中景，把两人膝上身体、引擎盖和车展展架同时纳入，卡片是两人之间的视觉落点。雨滴凝聚在膜面，压住的膜角形成浅皱，卡片一角吸水略微卷曲，衣肩、袖口呈现局部湿痕，湿地反射车后灯条。冷蓝暮色作为柔和环境光，暖白灯条在车漆和膜边留下细亮反射，灰、米、深绿构成沉静色彩。真实面部、手部与织物细节，通过相互配合的接触表达及时接应的紧张与专注，单张画面只冻结接卡这一瞬间。 --ar 16:9
```

English
```text
Live-action cinematic photography at an outdoor car exhibition in fine drizzle at dusk. A dark green vintage car sits within a low barrier; empty vehicle bays and a model-information stand extend behind it, illuminated by fixed warm-white strips behind the car. Exactly two people are in the image. Facing the front of the car, a restorer in a gray work jacket stands on the left and a visitor in a beige trench coat on the right. A transparent rain-protection display film covers the hood. A model-information card is slipping over the front edge of the wet film. With feet spaced securely and torso leaning slightly toward the car, the restorer presses the nearest film corner with their right palm while their left hand hangs at their side. The visitor bends their knees slightly and leans forward, their left palm just supporting the tilted card's lower edge. Its upper edge still rests on the film; their right hand stays beside their waist. Both gaze at the card, its outline unobscured by their hands. A chest-height frontal camera with a 35 mm lens feel provides a horizontal medium shot including both subjects above the knees, the hood and the exhibition stand. The card is the visual meeting point between them. Rain beads cover the film, shallow wrinkles gather at the pinned corner, one damp card corner curls slightly, and darker wet patches mark shoulders and cuffs. Wet ground reflects the rear light strips. Cool blue evening ambient light stays soft; warm-white strips leave thin reflections on paint and film. Restrained gray, beige and dark green, realistic faces, hands and textiles convey the concentration of a timely intervention. Freeze only this catching moment in one image. --ar 16:9
```

### 2. 把说明卡送进透明防雨袋

中文
```text
电影实拍质感的傍晚露天车展，细雨不停，深绿色复古车仍停在低矮展示围栏内，车后空置展位、车型展架与固定暖白灯条清晰交代同一展区，整个画面只有灰色工作外套修复师和米色风衣参观者两个人。正对车头时，修复师站左，参观者站右，两人靠近引擎盖前缘，脚稳踩湿地。透明展示膜已经平铺在引擎盖上，一枚小型展示夹扣住靠修复师的膜角。修复师在引擎盖上方用双手分别捏住透明防雨文件袋袋口两端，将袋口保持张开；参观者右手拇指与食指捏住车型说明卡上边，卡片下半部已经插入袋中，上半部仍露在袋口外，左手平托袋底支撑其重量。修复师看着袋口，参观者看着卡片进入袋口的交界，两人身体略向中间倾，正在保护那张边角受潮的卡片。相机在车头左前方以50毫米镜头感拍摄中近景，包含两人腰部以上与引擎盖局部，袋口、卡片和四只手按不同高度清楚分开，关键接触无遮挡；前景深绿车漆有柔软水光，后景展架轻微虚化。薄袋受指尖牵拉出现细窄褶皱，袋壁透出卡片轮廓，卡角稍卷，膜上有细雨水珠，衣肩与袖口有湿痕。冷蓝天光覆盖场景，车后暖白灯条沿透明袋边形成柔和亮线，灰、米、深绿主色，可信皮肤与湿布料质感。一张静态画面，只呈现卡片插入一半的瞬间。 --ar 16:9
```

English
```text
Live-action cinematic photography of an outdoor car exhibition at dusk in continuing fine drizzle. The same dark green vintage car stands within a low display barrier. Empty bays, a model-information stand and fixed warm-white light strips behind the car establish the exhibition area. Exactly two people are present: a restorer in a gray work jacket on the left and a visitor in a beige trench coat on the right when viewed facing the car's front. They stand securely on wet ground beside the front edge of the hood. The transparent display film now lies flat on the hood, with a small display clip securing the corner nearest the restorer. Above the hood, the restorer pinches the two ends of a clear waterproof document pouch opening with both hands, holding it open. The visitor's right thumb and index finger grip the top edge of the model-information card; its lower half is inside the pouch and its upper half remains outside. Their left palm supports the pouch bottom. The restorer watches the opening while the visitor watches where the card enters it, both leaning slightly inward as they protect the damp-edged card. A camera diagonally in front of the car on the left gives a medium-close shot with a 50 mm lens feel, framing both people from the waist up and part of the hood. The opening, card and four hands occupy distinct heights, with essential contacts unobscured. Soft water reflections cover the green paint in front; the exhibition stand is gently blurred behind. Fingertip tension creates narrow folds in the thin pouch, its clear walls reveal the card, and one card corner curls slightly. Rain beads dot the film; shoulders and cuffs carry wet marks. Cool blue skylight illuminates the scene, while the rear warm-white strips trace soft lines along the pouch edges. Gray, beige and dark green colors, credible skin and damp fabric. One static image showing only the card halfway inside the pouch. --ar 16:9
```

### 3. 将防雨卡袋固定回展架

中文
```text
傍晚细雨里的露天车展，电影实拍，深绿色复古车被低矮展示围栏围住，透明防雨展示膜平铺在引擎盖上，靠原先修复师一侧的前角由小型展示夹固定；空置车辆展位延伸至背景，固定暖白灯条位于车后。整个画面只有穿灰色工作外套的修复师和穿米色风衣的参观者，两人此刻并肩站在复古车右前侧的低矮车型展架旁，修复师靠车，参观者在外侧，双脚稳踏湿地，身体朝展架轻微前倾。车型说明卡完整装在已经封口的透明防雨袋里，袋面正贴着倾斜的展架面板；参观者用左手按住袋子左下角，右手轻扶展架侧框，修复师左手稳住袋子上边，右手拇指压开金属弹簧夹，夹口张开并对准袋子与面板的上边缘，尚未夹紧。两人的目光都落在金属夹与袋边交界。相机位于展架正前方略偏外侧，40毫米镜头感的中景收进两人膝上身体，展架在前景中央，复古车前灯与覆盖薄膜的引擎盖占据左后方，确保所有手部接触及夹口可见。透明袋外壁挂着小雨珠，袋内卡片略带受潮卷角但没有直接淋雨，金属夹反射细亮光，衣肩与袖口有深浅不同的湿痕。冷蓝暮色提供柔和光线，车后固定暖白灯条在湿车漆、袋边和金属夹上形成克制高光，灰、米、深绿主调，真实肌肤和布料重量，紧张消退后的细致协作。单张静态横向画面，冻结夹口尚未闭合的一刻。 --ar 16:9
```

English
```text
Live-action cinematic photography at an outdoor car exhibition in fine drizzle at dusk. A dark green vintage car sits within a low display barrier. A transparent rain-protection display film lies flat over its hood, secured at the front corner nearest the restorer's former position by a small display clip. Empty vehicle bays recede into the background, with fixed warm-white light strips behind the car. Exactly two people occupy the image: a restorer in a gray work jacket and a visitor in a beige trench coat. They now stand side by side at a low model-information stand near the car's front-right side, the restorer closer to the car and the visitor farther outside. Both plant their feet on wet ground and lean slightly toward the stand. The model-information card is entirely inside a sealed transparent waterproof pouch lying against the stand's inclined panel. The visitor's left hand presses the pouch's lower-left corner while their right hand lightly steadies the stand's side frame. The restorer's left hand holds the pouch's top edge, and their right thumb presses open a metal spring clip. The open jaws align with the top edges of pouch and panel but have not yet closed. Both gaze at the meeting point of clip and pouch. A camera in front of the stand, offset slightly outward, provides a medium shot with a 40 mm lens feel, framing the people above their knees. The stand occupies the central foreground; the car's headlamp and film-covered hood remain behind on the left. Every hand contact and the open clip are visible. Tiny rain beads hang on the pouch exterior; the card inside retains a slightly curled damp corner while sheltered from direct rain. The clip catches a fine bright reflection, and wet patches vary across shoulders and cuffs. Soft cool blue evening light combines with restrained highlights from the rear warm-white strips on paint, pouch edges and metal. Gray, beige and dark green colors, authentic skin and weighted cloth convey careful cooperation after the initial urgency. One static horizontal image, frozen before the clip closes. --ar 16:9
```

## 文本核对结果

- 交付数量：两条独立路径各 3 版，共 6 版、12 段独立完整提示词；每版中文先于英文，无“同上”、无占位符、无精简附版。
- 共同硬条件：全部段落保留细雨、露天车展、恰好两个人；人物身份与电影实拍媒介一致。无路人、无新增第三人。
- 设置：12 段均只带 `--ar 16:9`；沿用界面版本而不附 `--v`，Personalize 关闭而不附 `--p`，在正文外提醒关闭界面默认设置；未擅加 stylize、quality、seed 等参数。
- 路径①：三版保持左右站位、服装、右手压膜、左手接卡、另一只手的位置、卡片两条边的接触状态、双脚支撑、两人视线、时间、天气与现场光源一致；变化只有观察方向、景别、构图、景深及因观察位置产生的反光。关键动作均要求可见。
- 路径②：三个独立静态瞬间形成“接卡—装袋—固定展架”的合理因果关系。每段只描写一个定格瞬间。允许改变动作、人物在同一展区内的位置及道具状态，未误冻结场景初始手部动作。新增防雨袋和展示夹属于合理场景道具，不覆盖输入硬条件。
- 中英核对：各对语言的人数、服装、动作、用手、视线、空间方向、道具状态、媒介、镜头与参数一致。
- 结论：该样例的提示词层面流程与约束检查通过；未作生图测试，不能判断生成图的双手正确性、文字可读性、人数或精确动作遵循率。

## 发现的具体问题及边界

1. 未发现本测试范围内阻止执行的规则矛盾。方式①和方式②的冻结范围在文件中区分明确，能够产生两种不同且有效的输出。
2. 方式①对用户未指定的细节仍需要建立共同基准，例如复古车颜色、现场灯源和空闲手位置。本测试在首版建立后保持一致；SKILL.md 没有显式要求先建立共享基准表，实际执行者可能出现“首版没写、次版新增且无意改变”的漂移风险。这是改进建议，不是本次输出失败。
3. 方式②可改变动作，但用户选中场景内的具体动作与“输入硬条件”的边界需要从来源判定。本样例用户明确硬条件仅为“细雨、车展、两个人”，故可改变初始接卡动作；若用户把“修复师必须右手压膜”另列硬条件，则方式②也必须保持。当前规则已要求保留输入硬条件，但可补充一句说明这种来源差异，减少误读。
4. 本次只按本地已核验参数参考执行保守参数，没有重新联网核验参考所列版本或高级参数；不对参考中“当前默认版本”作独立真实性背书。
