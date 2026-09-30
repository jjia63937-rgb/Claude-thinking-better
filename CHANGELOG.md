# Changelog

All notable changes to this project are documented here. Versions follow [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-09-30

First public release of the `think-better` skill.

### Added
- **Reasoning routine**: calibrate effort to stakes and uncertainty; decide whether to plan before acting; frame the real question; generate alternatives before choosing; work in checkable steps; try to break your own answer; answer with calibrated confidence.
- **Facts vs. assumptions**: treat only given or verified information as fact, never fill in unstated details such as study design, baselines or sample sizes, and make conclusions conditional on stated assumptions.
- **No invented precision**: no power, sample-size, risk or effect estimates without real inputs; label illustrative numbers; keep "no evidence of harm" separate from "shown to be safe".
- **Decision-relevant self-critique**: name the strongest counterargument and the uncertainty most likely to change the decision, and revise only for real weaknesses. Safeguards such as human review are not treated as proof of safety.
- **Critic agent** (`agents/critic.md`): an optional independent review pass for high-stakes answers, with a self-review fallback when subagents aren't available.
- **Trap catalog** (`references/traps.md`): checklists for reading the question, math, debugging, decisions, factual claims, code and self-review.
- **Test prompts** (`evals/evals.json`): 6 prompts covering puzzle variants, math traps, debugging, verification, a decision under thin evidence, and a missing-assumption puzzle.
- Claude Code plugin marketplace (`.claude-plugin/marketplace.json`) and packaged `.skill` / `.zip` release assets.
