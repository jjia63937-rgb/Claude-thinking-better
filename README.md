# Claude-thinking-better
let claude better thinking

## `think-better` skill

A Claude skill that makes Claude reason more carefully on problems where a quick first answer is likely to be wrong: puzzles that look like famous ones, math and estimation, debugging, tradeoff decisions, and pushback ("are you sure?").

The routine: **calibrate → frame → generate alternatives → work in checkable steps → try to break it → answer with calibrated confidence.**

- `.claude/skills/think-better/SKILL.md` is the skill. Claude Code loads it automatically when you work in this repo.
- `.claude/skills/think-better/references/traps.md` has the trap catalog and domain checklists.
- `.claude/skills/think-better/evals/evals.json` has the test prompts.
- `dist/think-better.skill` is the packaged skill, which you can upload in claude.ai under Settings → Capabilities → Skills.
