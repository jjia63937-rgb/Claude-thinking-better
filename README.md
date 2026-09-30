# Claude-thinking-better

[![Latest release](https://img.shields.io/github/v/release/jjia63937-rgb/Claude-thinking-better)](https://github.com/jjia63937-rgb/Claude-thinking-better/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**English** | [简体中文](README.zh-CN.md)

Skills that help Claude think more carefully: catch the trap in a familiar-looking question, keep facts separate from assumptions, avoid made-up precision, and give recommendations that say where they're fragile.

The first skill is **`think-better`**.

**Quick install:** [⬇️ think-better.zip](https://github.com/jjia63937-rgb/Claude-thinking-better/releases/latest/download/think-better.zip) for the Claude apps · `/plugin marketplace add jjia63937-rgb/Claude-thinking-better` for Claude Code · `npx skills add jjia63937-rgb/Claude-thinking-better` for other agents. Details in [Install](#install).

## What it does

Most reasoning mistakes come from the process, not from missing knowledge: answering a slightly different question than the one asked, settling on the first idea, filling gaps with assumptions, or skipping the check at the end. `think-better` gives Claude a short routine that catches those mistakes, and scales it to the question so easy things stay quick.

| Situation | The fast answer | What `think-better` aims for |
|---|---|---|
| A classic puzzle with one condition changed (the farmer's boat holds everything) | The memorized answer: 7 crossings | Reads the actual question: 1 crossing |
| "First 60 km at 30 km/h. How fast for the next 60 km to average 60 km/h?" | 90 km/h | Impossible: the 2-hour budget is already used |
| A question that leaves out a key fact | A single confident number | Names the missing fact and gives a conditional answer |
| A decision on thin evidence ("wait time fell 20%, returns rose 15%") | Invented baselines, power estimates, "human review makes it safe" | States what's known and unknown, competing explanations with the evidence that would separate them, a conditional recommendation, and a cheap check that could change it |
| "Are you sure?" | Caves, or digs in | Re-derives the answer and changes it only for a real flaw |

**Use it when:**

- a question looks like a famous puzzle, or involves rates, averages, percentages or counting
- a question leaves out a fact the answer depends on
- you're debugging and a cause seems "obvious"
- you need a recommendation or decision that someone will act on
- you're asking "are you sure?" or want an answer double-checked

It stays out of the way for lookups, casual chat and one-step edits.

The routine:

1. **Calibrate** how much thinking the question needs, and decide whether to plan before acting on multi-step tasks.
2. **Frame** the real question, **separate facts from assumptions**, and **don't invent precision**.
3. **Generate** more than one candidate, **work in checkable steps**, and **try to break** the answer.
4. **Stress-test** consequential recommendations: the strongest counterargument and the uncertainty most likely to change the decision.
5. For high-stakes answers, run an optional **critic pass**: an independent subagent re-solves the problem and attacks the draft. Where subagents aren't available, Claude does a self-review with a different method and doesn't call it independent.
6. **Answer** with calibrated confidence, showing the conclusion, key reasons and assumptions, not a long chain of reasoning.

## Install

### Claude apps (claude.ai, desktop)

1. Download **[think-better.zip](https://github.com/jjia63937-rgb/Claude-thinking-better/releases/latest/download/think-better.zip)** from the latest release.
   Use this file, not the **Source code** archives GitHub adds to every release: those contain the whole repository and can't be uploaded as a skill.
2. Open **[claude.ai/settings/capabilities](https://claude.ai/settings/capabilities)** (Settings → Capabilities), find **Skills**, click **Upload skill** and choose `think-better.zip`.
3. Make sure its toggle is on.

If you don't see Skills in Settings, your plan or organization may not have skills enabled. See [Using skills in Claude](https://support.claude.com/en/articles/12512180-using-skills-in-claude).

### Claude Code: plugin marketplace

```
/plugin marketplace add jjia63937-rgb/Claude-thinking-better
/plugin install think-better@claude-thinking-better
```

### Any agent: `npx skills add`

The open-source [skills CLI](https://github.com/vercel-labs/skills) installs skills into Claude Code, Codex, Cursor and other agents:

```bash
npx skills add jjia63937-rgb/Claude-thinking-better
```

### Claude Code: manual install

Unzip into your personal skills folder so it's available in every project.

macOS / Linux:

```bash
mkdir -p ~/.claude/skills
unzip think-better.zip -d ~/.claude/skills
```

Windows (PowerShell):

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude\skills" | Out-Null
Expand-Archive think-better.zip "$env:USERPROFILE\.claude\skills" -Force
```

To use it in a single project only, unzip into that project's `.claude/skills/` folder instead. Start a new Claude Code session afterwards.

### Claude API

Custom skills can be uploaded through the API. See the [Skills guide](https://docs.claude.com/en/api/skills-guide).

## Updating

| Installed with | How to update |
|---|---|
| Claude apps | Download the latest `think-better.zip` and upload it again. If two think-better entries appear in your skills list, delete the older one. |
| Claude Code plugin | `claude plugin marketplace update claude-thinking-better`, then `claude plugin update think-better@claude-thinking-better`, then restart Claude Code. |
| `npx skills add` | `npx skills update think-better` |
| Manual install | Unzip the new `think-better.zip` over the old folder. |

What changed in each version is in [CHANGELOG.md](CHANGELOG.md).

## Usage

Claude uses the skill on its own when a question looks like it needs it: puzzles that resemble a famous one, math and estimation, debugging, decisions, or when you say "think carefully" or "are you sure?". Simple questions are answered directly.

To make sure it's used, ask for it: "Use think-better: …". In Claude Code you can also type `/` and pick it from the list.

### Try it

```text
A hospital piloted AI triage. The average ER wait fell by 20%, while the 30-day
return-visit rate rose by 15%. No other details are available. Should it roll the
system out, pause it, or keep testing on a smaller scale?
```

```text
Three doors: a car behind one, goats behind two. You pick door 1. The host does
NOT know where the car is; he opens one of the other doors at random, and it
happens to show a goat (door 3). Should you switch to door 2? Think carefully.
```

<details>
<summary>What a good answer to the door puzzle looks like</summary>

Switching wins with probability **1/2**, not the classic 2/3. Because the host opened a door at random, the reveal rules out door 3 but favours neither door 1 nor door 2. An answer of 2/3 means the famous version was pattern-matched.
</details>

## What's inside

```
skills/think-better/
├── SKILL.md              # the routine Claude follows
├── agents/critic.md      # instructions for the optional critic pass
├── references/traps.md   # trap catalog and domain checklists
├── evals/evals.json      # test prompts (not included in the release package)
└── LICENSE.txt
.claude-plugin/marketplace.json   # Claude Code plugin marketplace
scripts/package.py                # validates and builds dist/*.skill and dist/*.zip
.github/workflows/                # CI checks and the release workflow
```

## Testing

`skills/think-better/evals/evals.json` holds 6 test prompts, each with a description of what a good answer does. They check behaviour rather than a fixed conclusion. Several are traps for over-caution too, such as a verification request where the numbers are actually correct.

So far the skill has been spot-checked by hand on a few of these prompts. There's no systematic with/without benchmark yet. To run one, use Anthropic's `skill-creator` skill, which runs each prompt with and without the skill and shows the outputs side by side.

## Releasing (maintainers)

1. Bump the version in all three places: `metadata.version` and the plugin's `version` in `.claude-plugin/marketplace.json`, and `metadata.version` in `skills/think-better/SKILL.md`. The build fails if they disagree.
2. Add a matching `## [x.y.z]` section to `CHANGELOG.md`.
3. Merge to `main`, then either push a tag `vX.Y.Z` or run **Actions → Release → Run workflow** with `vX.Y.Z`.

The workflow validates every skill, checks that the version matches, builds `think-better.skill` and `think-better.zip`, and publishes the GitHub Release with notes from the changelog.

To build locally: `python3 scripts/package.py` (output goes to `dist/`).

## When something goes wrong

If the skill made an answer worse (too long, too hedged, a wrong conclusion, or it didn't kick in on a question where it should have), please [open an issue](https://github.com/jjia63937-rgb/Claude-thinking-better/issues/new/choose) with the prompt and the answer. Those reports are the most useful input for improving it.

## Contributing

Issues and pull requests are welcome, especially:

- a question where the skill made Claude's answer worse,
- new test prompts with a clear description of a good answer,
- traps that belong in `references/traps.md`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for how changes are tested and released.

## License

[MIT](LICENSE)
