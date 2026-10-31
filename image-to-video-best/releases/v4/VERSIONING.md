# 版本保存与回退

## 三种版本各自的含义

| 对象 | 当前版本 | 保存位置 | 内容 |
|---|---|---|---|
| 独立Skill规范 | v3 | `v3/` | 内容元素、题材/画风/氛围与融合分析，继承v2控制规则 |
| 网页应用 | 0.4.0 | 工作目录 `web/package.json` | macOS双击启动；默认仍加载Skill v2 |
| 完整项目 | v4 | `releases/v4/` | 独立规范v1/v2/v3、工作台与可执行启动文件 |

以后完整项目快照依次为 `releases/v5/`、`releases/v6/`。只改网页不增加Skill版本；只改规范不修改网页或自动切换其加载版本。工作台接入新版规范作为独立变更记录。项目快照内自带所需Skill目录，可独立复制运行，不依赖工作目录；收录新规范不等于工作台已接入。

`web/` 是持续开发目录；`releases/` 是不可覆盖的完整快照。releases/v1保存网页0.2.1与Skill v1，releases/v2保存网页0.3.0与Skill v1/v2。首次完整快照以前没有网页源码快照，不能声称能精确恢复0.1.0或界面配置前的状态；其历史证据仍保存在CHANGELOG与web/PROGRESS、VALIDATION中。

## 每次修改

1. 从 `Agent.md` 或自动读取的 `AGENTS.md` 进入，阅读维护规则与最近修改记录。
2. 在工作目录修改，更新 `CHANGELOG.md`；网页变化同步更新 `web/PROGRESS.md`、`web/VALIDATION.md` 和必要说明。功能增加更新minor，修复或预设增加更新patch；Skill采用独立整数版本。
3. 验证相关行为；网页代码变化运行 `npm test --prefix web`。版本工具变化运行 `python3 scripts/test_versions.py`。运行各版 `validation/check_package.py`，并核验已有项目快照。
4. 先把本次验证结果、范围、限制和即将发布版本写入记录，再创建下一快照：

```sh
python3 scripts/versions.py snapshot v5 --reason "说明本次修改目的与内容"
python3 scripts/versions.py verify releases/v5
```

这里的v5是下一次更新示例。工具不允许跳号、覆盖已有版本、在冻结包中创建新版本或继续发布已被改动的历史快照。

脚本自动保存指定源码目录、全部Skill版本及项目维护文件；排除.env真实配置、本机密钥、Git元数据、依赖缓存和日志，拒绝符号链接。新增源码顶层目录时必须先更新脚本的目录清单并测试，否则不会自动纳入快照。

从releases/v4起，根目录启动工作台.command进入快照，并保留源文件的可执行权限。SHA256检查内容，不检查权限；若外部传输工具移除执行权限，需在运行副本恢复该文件权限，不修改冻结包。

SHA-256清单用于检查文件缺失、增加和内容变化；不是签名，也不是操作系统写保护。不要通过重算旧版清单掩盖修改。

## 检查当前保存状态

```sh
python3 scripts/versions.py verify releases/v1
python3 scripts/versions.py verify releases/v2
python3 scripts/versions.py verify releases/v3
python3 scripts/versions.py verify releases/v4
python3 v1/validation/check_package.py
python3 v2/validation/check_package.py
python3 v3/validation/check_package.py
```

## 使用或回退

建议将想用的 `releases/vN/` 整个目录复制到新的运行目录，再在复制目录执行：

```sh
npm start --prefix web
```

只需Node.js22.13或更新版本，不需要npm install。启动后在网页重新配置服务地址、模型和Key。备份不保存用户密钥。若同时运行多个版本，在运行副本的 `web/.env` 设置不同PORT。

不要直接修改归档源码，也不要把旧版直接覆盖到当前工作目录。需要将旧行为恢复为当前版本时，在工作目录明确恢复相关文件、记录回退原因，并保存为新的项目快照，保留完整历史。

## Git边界

本项目位于已有父Git仓库中，父仓库有其他工作。本次采用用户要求的v1/v2文件夹快照，不暂存、提交、切换或改动父仓库；没有新建嵌套Git仓库。以后明确要求Git提交时，仅处理本项目文件，并检查已有暂存内容。
