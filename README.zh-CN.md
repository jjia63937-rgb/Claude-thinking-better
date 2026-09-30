# Claude-thinking-better

[![Latest release](https://img.shields.io/github/v/release/jjia63937-rgb/Claude-thinking-better)](https://github.com/jjia63937-rgb/Claude-thinking-better/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[English](README.md) | **简体中文**

让 Claude 想得更仔细的技能（skill）：识破"看起来眼熟"的陷阱题，把事实和假设分开，不编造精确数字，给出的建议会说明自己在哪里可能站不住。

第一个技能是 **`think-better`**。

## 它做什么

大多数推理错误出在过程，而不是知识不够：回答了一个和原题略有不同的问题，抓住第一个想法不放，用假设填补缺口，或者最后没有检查。`think-better` 给 Claude 一套简短的流程来抓住这些错误，并且按问题难度调整，简单问题依然直接回答。

| 情况 | 快速但错误的回答 | `think-better` 的目标 |
|---|---|---|
| 经典谜题改了一个条件（农夫的船能一次载下全部） | 背出来的答案：7 次 | 读懂真正的题目：1 次 |
| "前 60 公里时速 30，后 60 公里要开多快才能平均时速 60？" | 时速 90 | 不可能：2 小时的预算已经用完 |
| 题目漏掉了关键条件 | 给一个很确定的数字 | 指出缺少的条件，给出带前提的答案 |
| 证据很少的决策（"等待时间降 20%，回诊率升 15%"） | 编造基线、统计检定力，"有人工审核就安全" | 说明已知和未知，列出竞争解释以及能区分它们的证据，给出带条件的建议和一个可能改变建议的低成本验证 |
| "你确定吗？" | 马上改口，或者硬撑 | 重新推导，只有发现真正的错误才改 |

流程：

1. **校准**：这题需要多少思考；多步骤任务先决定要不要先规划。
2. **厘清**真正的问题，**区分事实和假设**，**不编造精确度**。
3. **先想出多个候选**，**分步骤、可检查地推理**，**尝试推翻**自己的答案。
4. 对重要的建议做**压力测试**：最强的反驳是什么，哪个不确定因素最可能改变决定。
5. 高风险的回答可以启用**审查代理**：由另一个子代理独立重新解题，再挑初稿的错。无法启动子代理时，Claude 用不同方法自我复查，并且不会把它说成独立审查。
6. **回答**时说明把握有多大，只给结论、关键理由和前提假设，不展示冗长的推理过程。

## 安装

从 **[Releases](https://github.com/jjia63937-rgb/Claude-thinking-better/releases/latest)** 下载最新的 `think-better.zip`（或 `think-better.skill`）。

### Claude 应用（claude.ai、桌面版）

1. 打开 **Settings → Capabilities → Skills**。
2. 点 **Upload skill**，选择 `think-better.zip`。
3. 确认它的开关是打开的。

如果在设置里找不到 Skills，可能是你的方案或组织还没有开启技能功能。请参考 [Using skills in Claude](https://support.claude.com/en/articles/12512180-using-skills-in-claude)。

### Claude Code：插件市场

```
/plugin marketplace add jjia63937-rgb/Claude-thinking-better
/plugin install think-better@claude-thinking-better
```

### Claude Code：手动安装

解压到个人技能文件夹，所有项目都能用。

macOS / Linux：

```bash
mkdir -p ~/.claude/skills
unzip think-better.zip -d ~/.claude/skills
```

Windows（PowerShell）：

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude\skills" | Out-Null
Expand-Archive think-better.zip "$env:USERPROFILE\.claude\skills" -Force
```

只想在某个项目里用的话，解压到该项目的 `.claude/skills/` 文件夹。装好后开一个新的 Claude Code 会话。

### Claude API

可以通过 API 上传自定义技能，详见 [Skills guide](https://docs.claude.com/en/api/skills-guide)。

## 使用

遇到看起来需要的问题时，Claude 会自己用上这个技能，例如像名题的谜题、数学和估算、排查问题、做决策，或者你说"请仔细想""你确定吗？"。简单问题会直接回答。

想确保它一定用上，可以直接说："用 think-better 回答：……"。在 Claude Code 里也可以输入 `/`，从列表里选它。

### 试试看

```text
一家医院试行 AI 分诊。急诊平均等待时间下降了 20%，30 天内回诊率上升了 15%。
没有其他资料。应该全面推行、暂停，还是继续小规模测试？
```

```text
三扇门，一扇后面是汽车，另外两扇是羊。你选了 1 号门。主持人"不知道"汽车在哪里，
他从剩下两扇里随便打开一扇，碰巧是羊（3 号门）。你应该换到 2 号门吗？请仔细想。
```

<details>
<summary>门的那一题，好的回答是什么样的</summary>

换门赢的概率是 **1/2**，不是经典版本的 2/3。主持人是随便开的门，这次开门排除了 3 号门，但对 1 号门和 2 号门没有偏向。答 2/3 就是套用了原题。
</details>

## 仓库内容

```
skills/think-better/
├── SKILL.md              # Claude 遵循的流程
├── agents/critic.md      # 审查代理的指示
├── references/traps.md   # 陷阱清单和各领域检查表
├── evals/evals.json      # 测试题（不包含在发布包里）
└── LICENSE.txt
.claude-plugin/marketplace.json   # Claude Code 插件市场
scripts/package.py                # 校验并生成 dist/*.skill 和 dist/*.zip
.github/workflows/                # CI 检查和自动发布
```

## 测试

`skills/think-better/evals/evals.json` 里有 6 道测试题，每题都写明了好的回答应该做到什么。它们检查的是行为，而不是固定结论，其中几题也专门测试"过度谨慎"，例如数字其实都对的核对请求。

目前只人工抽测过其中几题，还没有做过系统的"有技能 vs. 无技能"对比。想跑的话，可以用 Anthropic 的 `skill-creator` 技能，它会把每道题分别在有、无技能的情况下各跑一次，并排给你看。

## 发布新版本（维护者）

1. 更新 `.claude-plugin/marketplace.json` 里的 `metadata.version`。
2. 在 `CHANGELOG.md` 加上对应的 `## [x.y.z]` 段落。
3. 合并到 `main` 后，推送标签 `vX.Y.Z`，或在 **Actions → Release → Run workflow** 输入 `vX.Y.Z`。

工作流会校验所有技能、检查版本号是否一致、生成 `think-better.skill` 和 `think-better.zip`，并用 changelog 的内容发布 GitHub Release。

本地打包：`python3 scripts/package.py`（输出在 `dist/`）。

## 参与贡献

欢迎提交 issue 和 pull request，尤其是：

- 技能反而让 Claude 回答变差的例子（太长、太保守、答错），
- 新的测试题，并清楚说明好的回答应该是什么样，
- 适合加进 `references/traps.md` 的陷阱。

## 许可证

[MIT](LICENSE)
