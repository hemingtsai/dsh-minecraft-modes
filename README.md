# dsh-minecraft-modes

[![GitHub](https://img.shields.io/badge/GitHub-hemingtsai%2Fdsh--minecraft--modes-181717?logo=github)](https://github.com/hemingtsai/dsh-minecraft-modes) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

DeepSeek Harness（dsh）插件：新增 **生存模式（Survival）**、**冒险模式（Adventure）**、**极限模式（Hardcore）** 与 **旁观模式（Spectator）** 四个 Agent preset，把 Harness 自带的四个模式扩成**八个模式**。

> 在 Harness 里，「模式」就是 Agent preset —— 每份 `agent.cordis.yml` 定义了一个会话的模型面向能力（工具、人格、提示词段落、技能包）。本插件用与官方 preset 完全相同的机制交付新模式，不修改任何官方文件。

## 八个模式一览

| # | 模式 | preset id | 一句话定位 |
|---|---|---|---|
| 1 | 标准模式 | `standard`（官方） | 功能完整的编码 Agent（基准） |
| 2 | PTC 模式 | `code`（官方） | 用 TypeScript 程序组合多步操作 |
| 3 | 极简模式 | `minimal`（官方） | 双工具极简编码 Agent |
| 4 | 创造模式 | `cordis`（官方） | 创作 / 自修改，用于编写 preset |
| 5 | **生存模式** | `survival`（本插件） | **离线自给自足：先采矿（摸清代码库）再合成（实现），小步验证，警惕破坏性改动** |
| 6 | **冒险模式** | `adventure`（本插件） | **探索优先、任务驱动：先绘制代码库地图，改动需任务授权，最小改动并汇报** |
| 7 | **极限模式** | `hardcore`（本插件） | **极致省 token：精简工具目录、极简输出、更早压缩与更强裁剪** |
| 8 | **旁观模式** | `spectator`（本插件） | **仅审查的只读 Agent：能读能搜能分析，禁止一切写入与执行** |

## 四个新模式的设计

前三个模式（生存/冒险/极限）都基于标准模式的完整工具集（Shell、文件编辑、检索、Skills、目标、计划、子代理、工作流），差异在于**行为准则、工具开关与随包技能**；旁观模式刻意**移除**了执行与写入类工具。

### 生存模式 `survival`

隐喻《我的世界》生存模式，落地为工程纪律：

- **先采矿，再合成** —— 动手前先通过阅读、搜索、跑测试把代码库摸清；绝不靠猜。
- **一件作品，小而可用** —— 一次只做一个功能，改完立刻验证；工作树必须始终可用。
- **苦力怕防御** —— 删除、覆盖、重构都是危险操作，动手前先看 `git status`/`git diff`；优先做加法。
- **留一张床** —— 每个已验证里程碑 `git commit` 存档，危险时回档。
- **背包管理** —— todo 记账、发现写进笔记、上下文臃肿主动压缩、平行挖掘交给子代理。
- **不搞破坏** —— 改动不得破坏已有功能。

**能力差异**：`web` 工具整体禁用 —— 这个模式是**离线生存**，所有知识都要从代码库挖出来（这也让它在敏感环境里更安全）。

随包技能（`survival/skills/`）：`mining-the-codebase`（采矿方法论）、`creeper-defense`（工作树防护）、`inventory-discipline`（上下文/背包管理）。

### 冒险模式 `adventure`

隐喻《我的世界》冒险模式（不能随意破坏方块），落地为工程纪律：

- **先绘制地图，再谈行动** —— 接手请求前先探索并理解项目，把发现整理成地图交给用户。
- **任务即契约** —— 复述任务、给出方案；**改动世界需先征得确认**（plan mode / ask_user_question）。
- **最小改动** —— 一次任务只做最小必要改动，做完验证并汇报发现与改变。
- **尊重世界** —— 不碰与任务无关的方块；发现问题记入报告，不擅自扩大改动。
- **与村民交谈** —— `web` 搜索保持可用（查文档、问情报），但答案要靠自己读代码验证。

随包技能（`adventure/skills/`）：`mapping-the-territory`（代码库测绘）、`quest-discipline`（任务五步流程）。

### 极限模式 `hardcore`

隐喻《我的世界》极限模式（一条命，没有重来的资本），落地为**极致省 token**：

- **精简工具目录** —— 每次请求都会重发全部工具 schema，少一个工具就省一笔：砍掉 web、skills 目录、goals、jobs 与整个子代理/工作流组，只留干活必需的（bash、fs、fs-search、str-replace-editor、ask-user、todo、压缩）。
- **极简输出纪律** —— 人格刻意写短（短人格每轮都省）并强制：只给结论、不重复、批量读取、先想后做。
- **更早压缩、更强裁剪** —— `thresholdRatio 0.6`（默认 0.8）/ `retainRatio 0.12`（默认 0.16），pruner 阈值 `4096/2048/512`（默认 `8192/4096/1024`），str-replace-editor 输出上限 8k（默认 16k）。
- **更短的 plan-mode 段落** —— 进入计划模式时注入的提示词也精简。

适合长会话、token 敏感或计费敏感的任务。

### 旁观模式 `spectator`

> ⚠️ **软只读，非沙箱强制。** 「旁观 = 只读」由人格与 `review-only` 技能约束，模型仍持有 `fs` 套件里的 `write`/`edit` 工具（该套件无法按行拆开）；需要**硬性只读**时，请在会话内把沙箱模式切到 `read-only`（会话级覆盖机制，preset 无法强制）。

隐喻《我的世界》旁观模式（穿过一切方块、无法与世界交互），落地为**仅审查的只读 Agent**：

- **能力边界从工具目录上砍掉**，而不是靠人格自律：无 Shell（bash/pwsh）——没有命令执行入口，杜绝 git/构建/脚本副作用；无 `str-replace-editor`；无子代理/工作流/ralph（子代理经 `composeFrom` 继承父组装，同样没有执行能力）；无 plan mode（审查产出的是报告，不是实施计划）。
- **只读审查纪律** —— 人格 + `review-only` 技能把 fs 套件里的 write/edit 定为禁区；产出证据驱动的分级报告（问题定位到文件+行号、区分事实/推断/风险、Blocking/Major/Minor）。
- **web 搜索保留**（查文档辅助审查），fetch 关闭。

随包技能（`spectator/skills/`）：`review-only`（只读边界）、`code-review-report`（结构化审查报告）。

## 安装

要求：DeepSeek Harness 已安装（本插件只提供 preset 文件，无运行时依赖）。

```bash
cd dsh-minecraft
node install.mjs          # 安装到 $DSH_HOME/.agent-presets/（默认 ~/.dsh/.agent-presets）
```

装完**无需重启服务**：roster 的发现每次读取都会重新扫描磁盘，刷新页面 / 重新打开模式选择器即可看到八个模式。

常用命令：

```bash
node install.mjs --force   # 覆盖安装（本地有同名 preset 时用）
node install.mjs --remove  # 卸载四个模式
node install.mjs --list    # 查看安装状态
```

> 手动安装也一样：把 `survival/`、`adventure/`、`hardcore/`、`spectator/` 四个目录整体复制到 `~/.dsh/.agent-presets/` 下即可（目录名即 preset id，必须保持原名）。

## 工作原理（为什么这是「插件」而不是改官方文件）

- Harness 的 Agent preset 机制：每个会话从一个 preset 组装模型面向能力；preset 目录含 `agent.cordis.yml`（组装）、可选 `preset.yml`（展示元信息）、可选 `skills/`（随包技能）。
- 官方四个 preset 位于安装目录 `config/agent-presets/`（只读、随升级覆盖）；用户自建 preset 位于 `$DSH_HOME/.agent-presets/`，roster 自动发现，**永不写入官方目录**。
- 本插件的四个 preset 使用官方机制：行内包名（`@deepseek-ai/dsh-*`）从宿主组装解析，技能目录用 `baseUrl` 相对本目录解析，因此**整个目录可整体迁移**（复制到别的机器、别的 DSH_HOME 都成立）。
- 排序：官方 preset 根目录在前、用户 preset 根目录在后，**用户根整体排在官方根之后**；`preset.yml` 的 `order: 5–8` 决定四个新模式在用户根内部（及彼此之间）的相对顺序。

## 自定义

每个 preset 都是普通目录，直接编辑：

- **人格**：`agent.cordis.yml` 里的 `persona` 行（`text` 字段）。
- **技能**：`skills/<name>/SKILL.md`，改完即生效（技能发现带 watcher）。
- **工具开关**：例如把生存模式恢复联网 —— 把 `tool-web` 行的 `disabled: true` 改为 `false`；给冒险模式加产品子代理 —— 取消 `tool-subagent-codex` 等行的 `disabled`。
- 在 GUI 里也可以把任一模式复制成新 preset 再编辑（创造模式/设置页），但**不要**直接编辑官方安装目录。

## 已知限制

- 已加入某模式的会话保持其挂载的组装不变；新选择/新建会话才用新配置。组装文件的代际以 `agent.cordis.yml` 的 mtime/size 为键——只编辑**技能文件**（`skills/` 下的 SKILL.md）会被技能目录的 watcher 实时拾取，无需触碰组装文件；但**组装文件本身**的改动只对之后创建/加入的会话生效（运行中的会话保持其启动时的组装）。
- 旁观模式的只读是人格级软约束（见上文「软只读」标注），非沙箱强制。

## 许可证

MIT。与 DeepSeek Harness 无关联；「我的世界 / Minecraft」为 Mojang 商标，此处仅为风格隐喻。
