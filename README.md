# Claude-thinking-better
let claude better thinking

## `think-better` skill

A Claude skill that makes Claude reason more carefully on problems where a quick first answer is likely to be wrong: puzzles that look like famous ones, math and estimation, debugging, tradeoff decisions, and pushback ("are you sure?").

The routine: **calibrate → frame → generate alternatives → work in checkable steps → try to break it → (critic pass) → answer with calibrated confidence.**

For high-stakes answers, the skill runs an **error-correcting pass**. An independent critic subagent (`agents/critic.md`) solves the problem on its own, attacks the draft, and reports issues with evidence. The main Claude verifies each issue before accepting it, and runs at most two rounds. Without subagents, Claude does the same review itself by re-solving the problem with a different method.

- `.claude/skills/think-better/SKILL.md` is the skill. Claude Code loads it automatically when you work in this repo.
- `.claude/skills/think-better/agents/critic.md` has the critic agent's instructions and report format.
- `.claude/skills/think-better/references/traps.md` has the trap catalog and domain checklists.
- `.claude/skills/think-better/evals/evals.json` has the test prompts.
- `dist/think-better.skill` is the packaged skill, which you can upload in claude.ai under Settings → Capabilities → Skills.
