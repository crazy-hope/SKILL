# v5 验证记录

日期：2026-10-25（Asia/Shanghai）。归属：Skill v5、工作台0.6.0、完整项目releases/v7。

## 请求与改动

用户要求四独立型号Seedance 2.0/2.5、快手可灵O3/4.0及React工作台。v5完整继承v4，只新增Kling 4.0模型卡及Skill目录索引；创作与案例规则不改写。工作台接入完整v5规则，旧v1/v2显式调用兼容。

## 已执行验证

- 后端按先测试后实施：当前资料、自动构思与原需求测试初次54项中8项预期失败（v5未支持、空需求被拒绝）；实施后54/54通过。追加auto/三档完整细节转发测试后58/58通过。
- HTTP与启动测试先观察4项预期失败：模型列表、版本元数据及CSP仍为旧版。完成后端后全量运行共90项，87项通过，3项因React构建产物尚未生成而访问根页面返回404：`serves built entry/assets with safe CSP while refusing source, secrets and traversal`、`a second launcher opens the existing workbench without owning or stopping it`、`browser launch failure leaves the new service available and reports a safe message`。该次未记通过；React构建完成后再次执行`npm test --prefix web`，90/90通过，包括上述3项。
- HTTP使用临时回环模拟服务；测试覆盖密钥持久化与不回传、Origin/Host限制、四型号资料、历史v1/v2标签、逐卡资料日期及本次未在线复核。没有真实上游模型调用。
- 系统python3运行官方quick_validate.py时因缺少PyYAML中止（ModuleNotFoundError: yaml），随后使用已有PyYAML依赖路径复测，官方检查输出`Skill is valid!`，退出码0。
- 文件逐字节比较确认：v4继承文件仅发布说明、Skill模型索引和当前验证报告发生修改，其余原始规则、卡片与学习资源保持一致；新增Kling4卡和历史v4报告。
- 发布收尾：工作目录和无node_modules候选副本91/91 Node测试通过；新版50文件清单、68本地链接、图片头与官方格式检查通过；候选副本3项图片头回归、v5目录shasum通过。v1—v4清单与releases/v1—v6完整性核验通过，未重算旧清单。正式项目快照创建后再verify，不把准备记录当作快照命令结果。

## 资料与证据范围

2026-10-25核对[官方Kling 4.0指南](https://kling.ai/quickstart/kling-4-model-user-guide)搜索索引；直接页面抓取曾超时，按“官方索引摘录核对，全文未直接读取”记录。模型可选值、Keyframes与Omni Reference区分据索引；未确认具体账号/地区界面开放、API模型ID、负面字段或帧率。O3与Seedance卡原有证据日期保留。

## 验证边界

上述测试是资源选择、输入保留和请求链路验证，不是独立大模型对创作规则的语义遵循测试。本版没有真实视频生成、重复稳定性实验或视频对照，不把用户反馈当复现结果。继承[v4报告](v4-report.md)与历史样本仅为先前版本证据；两张水下图和原始提示词是一组学习参考。
