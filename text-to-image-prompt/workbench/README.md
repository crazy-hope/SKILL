# 画外 · 提示词创作工作台 v3

基于项目中的 Midjourney 创意导演 skill v8，通过 DeepSeek 或 OpenAI 构思五个场景、选择变化方式，生成三组完整中英文提示词。工作台与 skill 均包含十项设置，情绪／氛围支持多选融合。只生成文字，不自动提交生图。

## 打开工作台

需要 Node.js 22 或更高版本。保留本目录与上一级 skill 的相对位置，不要单独移动工作台。

macOS 可以双击本目录的 **启动工作台.command**；首次启动会安装依赖。关闭启动终端会停止服务。

也可以在本目录执行：

```sh
npm install
npm run dev
```

打开 http://127.0.0.1:4317 。仅本机可访问，不向局域网公开。端口占用时可执行 `PORT=4318 npm run dev`，并访问对应端口。浏览器草稿与历史按访问地址保存，建议固定使用一个地址。

正式运行可先执行 `npm run build`，然后 `npm start`。

## 第一次使用

1. 右上角点击「连接模型」（已配置时显示服务名），选择 DeepSeek 或 OpenAI，填写对应 API Key，点击「保存并测试」。两家的配置分别保留，保存后才切换当前创作引擎。
2. 从返回的列表选择支持文本和 JSON 的模型，或手动填写你有权限使用的型号，再保存设置。连接测试仅验证模型列表读取，不代表该模型的实际生成已通过。OpenAI 列表可能包含图像、语音等其他类型，请勿将这些型号用于本工作台。
3. 填写十项设置。表现方式、具体视觉风格、题材和情绪／氛围支持多选；自定义组合可用 `＋` 或逗号分隔，按回车或加号添加。自定义输入尚未添加前不计入已选方向。整体色彩／色调单独选择配色方向、自由选择或自定义。情绪不默认勾选，可明确选择自由选择；悬停或键盘聚焦可查看含义和提示词示例。旧草稿缺少色调或情绪时需补选，历史成品仍可查看。
4. 点击「生成五个场景」，选择一个场景，再选择变化方式，生成完整提示词。
5. 在三个版本间切换，分别复制中文、英文，或复制全部、导出 MD/TXT。

创作元素可以留空。文化与内容现实性必须单独选择；不确定画幅可以请求建议后确认。填写 Midjourney 版本或明确选择沿用界面，不能把未知版本当作已确认。

DeepSeek 默认地址为 `https://api.deepseek.com`，使用 Chat Completions；OpenAI 默认地址为 `https://api.openai.com/v1`，使用 Responses，并设置 `store:false`。两者都使用 JSON 模式和本地结构校验。自定义中转或本机服务需要支持所选服务对应的接口协议。OpenAI 实现依据 [Responses 迁移说明](https://developers.openai.com/api/docs/guides/migrate-to-responses)、[JSON 输出说明](https://developers.openai.com/api/docs/guides/structured-outputs)与[模型列表接口](https://developers.openai.com/api/reference/resources/models/methods/list)（2026-11-03 核对）。

如果浏览器能访问模型服务、工作台却连接超时，请确认代理已开启。工作台会读取 macOS 已启用的系统 HTTP／HTTPS 代理；从终端启动时也支持 `HTTP_PROXY`、`HTTPS_PROXY`、`NO_PROXY`（小写优先，代理环境变量优先于系统设置）。本机模型接口始终直连，证书校验保持开启。系统代理每次请求重新读取，无需在工作台填写代理密码；仅开启 PAC 或 SOCKS 的设置暂不自动识别，请使用代理软件提供的 HTTP 代理设置。更新代码后先执行一次 `npm install`，再重新启动工作台。

「换一批」保留条件。修改意见会追加为本轮硬条件；可在左侧创作起点中修改或删除。改变设置后旧结果保留可读，但不能作为当前场景继续生成。请求失败时不会自动重试；可再次点击相应生成按钮。等待时可取消，或修改设置取消失效请求。

内容冲突一次澄清一处，回答会显示在「本轮已确认取舍」。版本／Personalize 参数冲突要求直接修改对应设置，避免文字取舍与实际后缀不一致。关闭个人化时，还需要自行关闭 Midjourney 界面的个人化开关。

## 数据保存

- API Key 保存在 `workbench/.local/config.json`，是本机明文配置（非加密保险库），文件权限 `600`、目录权限 `700`。浏览器只获得已配置状态，不会读取已保存密钥。设置窗口可删除密钥。
- `.local/`、环境文件、依赖及构建产物已排除 Git。开发服务也阻止通过文件 URL 读取 `.local/` 和环境文件。
- 两家的配置分别保存在同一本机文件的 profiles 中，旧格式读取兼容、下次保存时迁移。更改接口地址但没有填写新密钥时，只清除该服务原密钥，避免将它发给不同地址；删除一家密钥不影响另一家。
- 草稿与最近 50 次完成记录保存在当前浏览器 IndexedDB，不含密钥。历史可恢复、删除；清理浏览器数据会清除它们，重要结果请导出。
- 新建任务为空白设置；「沿用上次设置」需要明确点击。
- 发起生成时，创作设置及所需 skill 规则将发给配置的模型服务；界面勾选本身不调用模型。

## 与 skill 一起维护

工作台独立版本，不改 skill 的 `metadata.version`。根目录 `AGENTS.md` 已加入同步要求。

独立情绪选择现已与 skill v8 对齐；v3 的固定成品顺序仍属于用户授权的工作台定制，在 `server/prompts.ts` 明确覆盖来源中的相关条款。后续维护需同时检查这层定制与新来源的兼容性，不将工作台专属成品包装反写到 skill。修改前的工作台源快照保存在 `releases/workbench-v2.2.zip`，不含本机配置或依赖。

### 成品顺序与负面提示词

三版中文和英文都按 **题材 → 表现方式 → 视觉风格 → 整体色调 → 具体主体内容 → 情绪 → 镜头** 组织正文。模型分别填写七项，工作台将前四项连成自然的开场，文化背景融入题材。镜头收尾说明怎样取景、主体位于何处、焦点落在哪里。已确认的参数与负面词接在镜头之后。重新生成时使用这个顺序，历史成品按保存时的文本展示。

负面词从明确排除项整理为中英对应的对象列表，统一放在末尾的 `--no` 中，三版保持一致。没有可安全表达的排除对象时不凭空补词，也不输出空 `--no`。“仅两个人”等数量要求和清晰度要求写入正向正文，不将主体本身列为排除对象。这遵循 [Midjourney 的 No 文档](https://docs.midjourney.com/hc/en-us/articles/32173351982093-No)（2026-11-03 核对）；多词排除可能被逐词解读，不能把长否定句直接塞入参数。

程序校验七项内容齐全并按固定顺序拼接。自然语言是否完整表达所有选择、中英是否语义一致仍取决于真实模型，不能把模拟响应测试视为语义质量保证。复制、导出与保存使用同一份组装后的完整文本。

运行来源是 `SKILL.md`、`references/visual-direction.md`、`references/creative-engine.md`、`references/midjourney.md`。字段集中在 `shared/fields.ts`，类型与参数在 `shared/contracts.ts`，阶段在 `shared/session.ts`，输出适配在 `server/prompts.ts`。`skill-manifest.json` 是已核对来源的指纹，不是 skill 副本。

1. 审查 skill 差异，判断字段、选项、阶段、变化方式、参数和输出结构的影响；必要时更新工作台和测试。
2. 新增运行参考文件时，同步 `server/rules.ts` 的列表；不要漏掉被新规则要求读取的资料。
3. 完成审查与相关修改后，按下面命令更新指纹。**不能只更新指纹来消除同步提示。**
4. 运行 `npm run check`，更新工作台 CHANGELOG 和验证记录。

```sh
node --import tsx --input-type=module -e 'import {readSources} from "./server/rules.ts"; import {writeFile} from "node:fs/promises"; const s=await readSources(".."); await writeFile("skill-manifest.json", JSON.stringify({version:s.version,hash:s.hash,files:s.files},null,2)+"\n");'
npm run check
```

未核对的源文件变化会暂停新生成；草稿、历史、复制与导出仍可用。生成期间再次发生变化也不会交付混用版本的结果。面板不会由模型自动重建。

## 验证范围

`npm run check` 包含 Vitest/React Testing Library 流程与接口测试、TypeScript/生产构建、规则指纹检查。接口测试使用临时回环端口和模拟 DeepSeek／OpenAI 响应，不消耗真实 API 额度。

本次未调用真实 DeepSeek／OpenAI 生成；模型对艺术内容和双语语义的实际遵循仍需真实使用评估。浏览器验证与自动测试记录见 `docs/verification.md`。这些是文本、软件和交互验证，不是 Midjourney 生图效果验证。
