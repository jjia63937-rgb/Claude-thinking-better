# Contributing

Thanks for helping make Claude think better. The most valuable contributions are concrete: a real prompt, what Claude answered, and what a better answer would have done.

## Reporting a bad answer

Use the **"The skill made an answer worse"** issue template. Include:

- the exact prompt,
- Claude's answer (or the part that went wrong),
- where you used it (claude.ai, Claude Code, API) and whether the skill was triggered,
- what a good answer would have done differently.

Answers that are too long, too hedged or overly cautious count as bugs too. The skill is meant to improve judgment, not add length.

## Suggesting a test prompt

Use the **"New test prompt"** issue template, or add an entry to `skills/think-better/evals/evals.json` in a pull request. A good test prompt:

- is something a real user would type,
- has a checkable description of a good answer in `expected_output`, describing behaviour rather than one memorized conclusion,
- catches a specific failure (pattern-matching a famous problem, inventing a missing fact, over-hedging a question that has one right answer, and so on).

## Changing the skill

1. Edit files under `skills/think-better/`. Keep `SKILL.md` focused on the routine. Detailed checklists belong in `references/traps.md`.
2. Keep instructions general. Don't write the answer to a specific test prompt into the skill.
3. Run the relevant test prompts with the skill before and after your change, and say in the PR what changed in the answers. Anthropic's [skill-creator](https://github.com/anthropics/skills/tree/main/skills/skill-creator) skill can run prompts with and without a skill side by side.
4. Check that everything still builds:

   ```bash
   python3 scripts/package.py
   ```

   This validates the frontmatter, checks that every referenced file exists and that the version numbers agree, and writes `dist/think-better.skill` and `dist/think-better.zip`.

## Releasing (maintainers)

1. Bump the version in `.claude-plugin/marketplace.json` (`metadata.version` and the plugin's `version`) and in `skills/think-better/SKILL.md` (`metadata.version`). Use [semantic versioning](https://semver.org/): patch for wording fixes, minor for new rules or behaviour, major for a redesign.
2. Add a `## [x.y.z] - YYYY-MM-DD` section to `CHANGELOG.md`.
3. Merge to `main`, then run **Actions → Release → Run workflow** with `vX.Y.Z` (or push the tag).
