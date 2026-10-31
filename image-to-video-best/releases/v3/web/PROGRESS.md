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
