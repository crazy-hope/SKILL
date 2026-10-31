# v1 独立内容审查

审查日期：2026-10-17。范围为技能包全部文本与案例图片、根 README、v1/RELEASE.md、validation/scenarios.md；没有读取 baseline 或 with-skill 答案，没有调用生成服务、安装或修改技能文件。REPORT 与 SHA256SUMS 的生成状态不计为缺陷。

## 发现的问题

### [P2] Seedance 两张模型卡遗漏了会阻止人物素材直接使用的输入限制

位置：`/Users/lijundong/ALL/personal/github/SKILL/image-to-video-best/v1/image-to-video-best/references/models/seedance-2.0.md:18`（图片限制表，18—22行），以及 `/Users/lijundong/ALL/personal/github/SKILL/image-to-video-best/v1/image-to-video-best/references/models/seedance-2.5.md:21`。

两张卡列出尺寸、体积、数量等输入限制，但没有记录火山方舟对含真人人脸参考图/视频的直接上传限制。官方创建任务 API 和两个模型教程均明确列出该限制，并指向受信任模型产物、预置虚拟人像及已授权真人素材等专门路径。对“上传真人肖像，离线用快照给适配提示词及设置”的正常任务，当前快照容易让助手只校验尺寸并交付看似可用的素材方案，随后在入口审核处失败。这里只涉及方舟，不应外推到即梦或其他网页。

建议：两张卡加入一条入口范围明确的事实与[肖像素材指南](https://docs.volcengine.com/docs/ark/seedance-portrait-asset-guide?lang=zh)，在涉及真人肖像素材时核查当前支持的素材来源/接入路径；无法确认时保留可写的运动设计，把素材可提交性列为待确认。不要仅凭当前案例看起来写实就断言它是真人，也不要将限制解释为所有人物画面均不支持。增加一条真人肖像离线适配测试可避免漏回归。

依据：2026-10-17通过[官方创建任务 API](https://docs.volcengine.com/docs/ark/create-video-generation-task-api?lang=zh)、[2.0教程](https://docs.volcengine.com/docs/ark/seedance-2-0?lang=zh)、[2.5教程](https://docs.volcengine.com/docs/ark/seedance-2-5?lang=zh)官方搜索索引复核，直接页面有 JavaScript 壳，因此仍按索引证据标注。

## 未发现重大问题的部分

- 没有发现 P0/P1 问题。默认中文5秒、用户指定等级/时长优先、三级按控制需求选取、完整设计与超限提交版分离，逻辑一致。
- 四模型版本与网页/API边界明确；抽查 Runway 时长/分辨率/FPS、Wan3.0参数、Seedance 2.0的4k与2.5的adaptive/时长，均有对应官方支持，没有发现跨版本借字段。
- 原图已实际查看，案例观察与可见画面一致，遮挡、手型、脚部与新增设计的区分准确。原提示词和分析独立存放，原文保留其矛盾并由分析另述。
- 技能包内11个相对资源链接全部存在且没有逃出技能目录，未发现符号链接。图片和原提示词的实际SHA-256均与metadata.json一致。未在本次独立审查中获取最初消息原文，因此不将内部哈希一致性当作已独立证明原始消息逐字无缺。
- 未发现自动调用生成、安装、日常修改历史版本的指令。L场景明确用户新指令优先，不属于应拦截用户维护的禁令。

## 结论边界

这是静态审查、素材检查和官方规则抽查，不证明模型真实执行每条提示词，也不替代生成对照。除了上述肖像输入路径遗漏，未发现需要阻止发布的实质性问题。
