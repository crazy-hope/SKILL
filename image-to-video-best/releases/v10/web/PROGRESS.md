# Execution ledger — docs/superpowers/plans/2026-10-17-prompt-workbench.md

用户已回复“按计划执行”。当前代理直接实现，最后独立审查。

Pre-flight: Task1→Task2: normalized input/context/config match generation parameters. Task2→Task3: generation returns result; HTTP owns trusted metadata. Task3→Task4: config/options and {result,metadata} agree. Task4→Task5: pure Markdown export and documented startup/test commands agree.

Ruling: 按用户批准的计划在独立 web/ 子目录实现，使用本记录保存执行证据，不运行会写父仓库的工作树、提交和临时台账脚本 — 保护父仓库已有改动，并遵守不提交约定 — 代价是没有独立Git分支隔离。

Task 1 RED: node --test web/test/input.test.mjs web/test/catalog.test.mjs；已观察Not implemented导致失败，原始日志 /tmp/i2v-web-task1-red.log。

Task 1 complete: 29/29 tests passed; read-only Skill loading, inputs, config. Added shared errors module for consistent safe failures.
Task 2 complete: real image request + structured result + sanitized failures, 44/44 full suite passed. RED /tmp/i2v-web-task2-red.log → GREEN /tmp/i2v-web-task2-green.log.
Task 3 RED: initial run blocked by local socket sandbox (not counted as behavior failure); authorized local loopback test rerun observed 501 against expected contract statuses.

Task 3 complete: 49/49 full tests passed. Host测试改用原生http.request，因本机fetch实现不保留自定义Host；图片上限测试使用101字节夹具，避免先撞请求体上限。属于测试边界修正，不改变需求。
Task 4 RED: Markdown导出与并发修订令牌测试已观察失败。页面使用独立state.js，确保旧结果不会覆盖新输入。

Task 4 complete: desktop1280/mobile390 browser QA covered upload, detailed7s fixture success, result tabs, copy, export, stale-result notice, cancellation, failure input retention, image removal, keyboard tabs. Export returned actual download path. Before final review the whole suite passed52/52.

Final review: fresh agent web_final_review (gpt-6-astra), read-only. No Critical or Minor. One Important: client MIME/signature consistency.
Final: fixed browser format consistency — browser rejects JPEG bytes declared as PNG before accepting preview and disguised/truncated bytes, RED→GREEN, full suite55/55. Added public/image.js, served only through fixed whitelist. No second review needed.

Final: Ruling: reviewer did not judge live model compatibility/output quality — keep explicitly unverified without credentials — cost if wrong: provider may reject the minimal Chat Completions format or produce invalid structure.
Final: Ruling: reviewer did not judge video results — app does not generate video, preserve that boundary — cost if wrong: prompt quality cannot imply generated video stability.
Final: Ruling: final docs/QA were underway at review — author completes and records these, no second independent doc review — cost if wrong: a documentation mismatch could remain.
Final: Ruling: reviewer did not independently inspect visual UI — author CUA evidence covers it — cost if wrong: other devices may display differently.
Final: Ruling: reviewer HTTP tests hit sandbox EPERM — use author's authorized loopback full-suite55/55 evidence; reviewer separately passed47 other tests — cost if wrong: reviewer did not independently reproduce socket integration.

Task 5 complete: config/startup/data-flow documentation, browser evidence, independent-review fix, v1 22-file SHA256 integrity all recorded. No API keys read, no paid calls, no installs, no commits or deployment. Full execution record retained because Git commits were explicitly excluded.


## 2026-10-17 界面配置扩展（web 0.2.0）

用户要求参考本机8787工作台的配置方式。实际查看其“连接你的大模型”面板后，将原先.env说明展开区改为配置弹窗：服务商、自定义根地址、密码输入、模型输入/列表、测试、保存、清除。用户明确要求界面可配，直接在已授权本地应用范围实施；未创建技能新版本。

本机后端保存配置（0600临时文件原子替换），GET只返回非敏感信息。配置立即生效；旧密钥不发送到新地址；清除覆盖.env默认值以免重启恢复。只请求/models测试列表，未知图像能力明确标注。

新增HTTP用例先得到预期404失败（5通过、2失败）；默认沙箱初次监听EPERM，随后使用回环监听许可重跑。边界回归发现“未配置即清除”保存的空配置无法重启，修正允许加载合法未完成配置。完整测试63/63通过。

浏览器用临时3211应用和3212模型列表模拟服务验证保存、刷新恢复、密钥不回显、地址变更缺Key错误、清除；未调用真实服务。生产3210页面已重启并可打开空配置弹窗。小屏390px弹窗350px内容无横向溢出。原始v1只读保持。

## DeepSeek 预设

按用户要求新增DeepSeek服务商，官网图像理解文档确认当前deepseek-flash支持图片；不使用过时的纯文本能力判断。沿用已有配置保存及生成链路，无新增运行依赖。现有63项测试通过，浏览器验证DeepSeek与OpenAI切换。真实服务调用未执行。


## 项目统一记录与版本保存

用户要求所有修改由Agent.md管理记录与版本。新增根Agent.md入口（规则唯一源仍为AGENTS.md）、CHANGELOG、VERSIONING及完整项目快照工具；网页DeepSeek预设明确记为0.2.1。首次完整项目快照releases/v1包含当前web及Skill v1，旧网页阶段只有记录，没有补造源码版本。项目快照排除密钥；未操作父Git仓库。版本工具4项测试通过。

完整项目独立复制验收：网页63/63通过，复制包与原包Skill v1清单通过。随后将最终文档一并封存为releases/v1并执行整体校验。

## 2026-10-17 细致档展开与创作忠实（web 0.3.0 / Skill v2）

用户补充实际需求并要求修改Skill和网页。分析区分动作主题与描述深度：旧输出大体包含托掌、手指微动、向右上环绕和俯身看镜头，但自行安排后段加速，“不换机位”与移动冲突，材质、波浪传递和氛围展开不足。参考案例的云手与360度转身不属于此次用户要求。原始需求、旧输出和分析单独保存至新Skill案例。

完整复制Skill v1为v2，新增creative-fidelity.md，并更新正文、分级、连续性与验证记录；既有模型卡和原始流体神女资源逐字节不变。网页CURRENT_VERSION统一为v2，配置API、输入默认值、请求和徽标同步；新规则完整注入模型上下文。system契约要求保留动作、方向、速度、顺序与收尾，细致档增加材质、分层动态、动作牵引、连续与遮挡、光影氛围。没有增加付费重试或声称自动验证语义的检查器。

新增测试先观察默认v1/缺少v2的预期失败，再完成实现。工作目录68/68通过；独立临时复制的完整源码包再次68/68通过，包内Skill v1和v2清单分别22文件/20链接、29文件/33链接通过。Skill官方格式校验通过。独立代理v1新基线未重现用户旧输出全部问题，如实记录；v2复测覆盖三档、实际需求、固定机位刚性产品和互斥景别要求，详见v2/validation/REPORT.md。没有进行统计重复或真实视频验证。

本机服务已重启，独立验收页确认SKILL v2、细致档“材质、动态与氛围”及新需求提示。保存screenshots/skill-v2-workbench.jpg。未提交生成、未查看或覆盖本机密钥配置。更新根维护规则、版本索引与修改记录后，将全部交付文件保存为releases/v2；旧快照保持不变。

## 2026-10-17 macOS双击启动（web 0.4.0）

用户要求.command启动入口。根目录新增启动工作台.command，动态定位web并查找可用Node，保留现有.env与界面配置。服务启动逻辑提取到lib/startup.mjs，--open在监听成功后调用macOS默认浏览器；EADDRINUSE只在确认同端口已有兼容工作台时打开已有服务，否则明确报错，不终止其他进程。服务器处理SIGINT、SIGTERM和SIGHUP；重复启动不取得原服务所有权。

先新增启动与版本打包测试，确认新模块缺失、启动文件未归档的失败；实现后网页72/72与版本工具5项通过，独立复制完整源码包再次72/72通过。zsh -n通过；中文空格目录及异地cwd调用的模拟Node检查通过，最初比较发现/var和/private/var别名，使用resolve确认路径等价。没有进行Finder实际双击或真实默认浏览器唤起。

归档工具改为copy2保留权限，启动文件纳入顶层清单，规范v1/v2/v3不变，工作台仍加载v2。更新记录后保存releases/v4，旧版本哈希保持通过。未读取密钥内容、调用模型、自动安装Node或强制重启用户已有工作台。

## 2026-10-23 四任务并行与结果详情（web 0.5.0）

用户确认默认4个入口、结果点击详情查看后复制。沿用后端独立请求能力，将前端单一状态拆为每任务请求、图片读取序号、输入版本及结果；表单由同一模板生成，ID/标签/数据列表关系按任务唯一化。新增任务卡与全部生成，折叠模型/时长/等级等设置，详情弹窗保留完整设计、来源、提交版和导出能力。任务间取消、失败与修改互不干扰，配置变化仍使全页旧请求失效。

4项状态测试先失败后实现，最终工作目录与独立复制包均76/76通过。实际Chrome模拟验收验证4请求同时到达、独立设置、乱序返回、失败/取消、单独重试、详情复制/导出、旧结果标记、新增入口和移动端布局。截图位于screenshots/multitask-desktop.png、multitask-detail.png、multitask-mobile.png，均为明确标注模拟的测试内容。

完整项目归属releases/v5，下一快照v6；Skill规范仍v3、工作台仍读取v2。旧Skill及releases/v1—v4完整性通过，版本工具未改动，启动权限保留。没有真实模型/视频调用、密钥变更、服务强制重启或父Git操作。

## 2026-10-25 React重构 / 网页0.6.0 / 项目releases/v7

用户确认四型号与任务列表＋并排编辑结果；执行计划为docs/superpowers/plans/2026-10-25-react-workbench.md。父代理实施React/Vite/Ant Design界面，model_backend独立负责v5资料及后端，react_review只读审阅。文件职责分离，未操作父Git。

后端测试先观察旧版不识别v5/四型号、拒绝空需求等8项失败；实现后并入完整测试。基线沙箱HTTP被阻后允许回环运行76/76；新构建完成后90/90；代理修复加回归后91/91。候选独立副本不含node_modules、密钥，91/91通过，可用构建静态页面与启动逻辑。

React保留任务修订令牌；改善上传、设置、详细要求折叠、结果阅读/复制/导出、窄屏切换。源码格式化，移除与旧快照字节一致的废弃页面文件，public中仅保留复用的纯函数。Vite打包源/lock/dist交付；构建体积提示保留。JSX和Vite配置初次构建问题修复，浏览器定位冲突修复；截图检查发现Ant Design6类名变更造成结果区无内边距，按实际DOM修正并增加位置断言。

独立审查两项P2：开发代理同源POST、连接请求期间可编辑。验证来源后改写开发Origin，保持生产校验；配置Form在请求期间禁用。实际Vite代理测试与Chrome配置读取/保存测试均通过。真实Chrome模拟验收4并发、乱序失败/取消/重试、修改隔离、空需求、复制下载、新建/复制、密钥输入关闭清除与390px布局，无pageerror。截图标记模拟，不调用真实服务。

规范v5新增Kling4卡，六段与创作规则继承v4；实际加载v5与产品0.6.0分别记录。包50文件/68链接、格式、独立复制、旧版哈希通过；旧版不重算。记录完成后归档releases/v7并verify，下一快照v8。真实模型遵循、并发配额与视频效果未测。

## 2026-10-25 效果保真 / 网页0.7.0 / Skill v6 / releases/v8

用户接受逐项分析并要求继续。按docs/superpowers/plans/2026-10-25-effect-fidelity.md实施。规范新增效果优先、强度独立、景别可读及约束取舍；工作台单次生成请求要求模型自检摘录，不增加调用或自动重试。结构验证与精确引文出处可程序检查，语义完整/视频表现明确不在其能力范围。用户坏输出原文与分析分开保留，没有原表单/成片，不能声称复现原因。

effect_review_code仅实现纯核对模块/测试；父代理负责规则、集成、展示与导出。模块20项先缺文件失败、集成3项先缺契约/版本/字段失败、导出1项先缺记录失败；最终完整119/119通过。浏览器真实Chrome+模拟HTTP验收新增记录/警告/导出、既有4并发和配置流程、1440与390px布局通过；构建通过，vendor体积提示沿用。

v5与v6独立上下文按共同7请求作答，父代理全文比较：两版在明确需求下均能保留主要控制，旧版并非必然降级。v6初轮A3有写作纠错话术混入正文，补充边界并另作定向复测，保留初轮原文。独立代码审阅未发现实质缺陷。具体行为、格式、复制与哈希证据归入v6/validation/REPORT.md及web/VALIDATION.md。

当前Skill v6、工作台0.7.0、实际加载v6，旧v1/v2/v5显式调用兼容；记录后归档releases/v8，下一项目快照v9。保留真实密钥、旧进程和父Git状态。真实外部模型/视频效果仍未验证。

收尾补充：同图本地代理契约试写返回11项有出处的核对记录，0条引文警告，原始JSON通过实际结果解析器的模拟回放；不代表用户外部服务或视频效果。发现纯标题未分段显示，先观察新测试缺导出失败，再支持纯/编号/Markdown标题，共新增4项；复制与导出仍保留原始正文。最终119/119通过，浏览器再次检查六标题和核对区。

## 2026-10-25 · 0.7.1 刷新样式修复

- 用户报告刷新后整体错乱/组件样式丢失。独立Chrome初次及三次刷新截图完全一致；实际用户Chrome页面外框正常、组件边框和颜色丢失。
- 首页CSP允许当前动态样式，无相关控制台错误。DevTools观察到默认主题节点data-css-hash=1sssysb、data-token-hash=css-var-_r_0_内变成另一扩展的--qingai-extension-*变量。核对已安装cssinjs源码：写入标识仅从cssVar.key生成，同一默认React根ID可互相覆盖。
- 增加工作台专用cssVar.key=chengjing-workbench-theme，不改CSS选择器、扩展设置或安全策略。先新增复现脚本，修复前主题主色为空断言失败；修复后桌面/窄屏6次加载刷新与外来主题覆盖通过。用户原浏览器保持扩展开启，刷新后组件样式恢复，已实际截图观察。
- 119/119完整测试和独立候选副本通过；第一次全量因旧产品版本断言0.7.0失败，更新为0.7.1后通过。构建成功，vendor体积提示保持。Skill v6及所有历史规范、快照未改。
- 归属web0.7.1，完整项目releases/v9，下一快照v10。只改主题隔离、测试、构建产物与维护记录，无密钥或生成行为变动。

## 2026-10-26 · 0.8.0 / releases/v10 · 10镜头并行

用户要求同时处理10个。原默认4个，新增并不受限；默认改为10后Chrome模拟测试仍卡在6个后端请求，证实长连接是额外瓶颈。新增本机内存异步任务：提交后立即释放浏览器连接，400ms查询进度，结果/取消后删除，120秒无人查询自动清理，最多100条记录。默认10个，新增/复制继续使用独立ID。

实现前数量断言4≠10、仅改数量后peak=6均已观察失败；最终真实Chrome模拟peak=10，两轮取消/失败/重试/修改隔离、复制下载、配置与390px回归通过。完整127/127及无node_modules独立候选副本127/127通过；构建成功。查询请求体边界先失败再修复；APP_VERSION旧断言首次失败后修正。独立只读审阅未发现阻断缺陷。

当前网页0.8.0，Skill与加载版本v6。记录后保存releases/v10，下一快照v11。v1—v6与releases/v1—v9原始清单校验通过，旧版未修改。尚未实测真实服务配额/视频效果；没有操作用户配置或旧服务进程，需重启工作台加载新后端。
