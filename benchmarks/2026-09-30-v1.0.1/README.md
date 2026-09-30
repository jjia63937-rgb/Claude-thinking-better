# Benchmark: think-better v1.0.1 vs. no skill (2026-09-30)

**Summary:** with the skill, answers met **52/52** grading checks. Without it, they met **44/52**. All 8 misses came from the no-skill runs, on three of the six prompts. Answers with the skill were about **16% longer**. This is a small test (2 runs per condition), and the checks were written by the skill's author, so read it as evidence that the skill does what it's designed to do, not as a general quality score.

## Method

- **Prompts:** the 6 prompts in [`skills/think-better/evals/evals.json`](../../skills/think-better/evals/evals.json), each with 2–8 pass/fail checks (26 checks in total).
- **Conditions:**
  - *with skill*: the model read `skills/think-better/SKILL.md` and followed it;
  - *without skill*: it was told not to read files or use any skill.

  It was the same model in both conditions, with 2 independent runs per prompt per condition, so 24 answers in total.
- **Blind grading:** the 4 answers to each prompt were shuffled and relabeled A–D, and a separate grader checked each one against the prompt's checks without knowing which condition produced it. The label key is in [`grading/blind_key.json`](grading/blind_key.json).
- **Length:** counted as words for English text and characters for Chinese text.

## Results

| Prompt | What it tests | With skill | Without skill | Length change |
|---|---|---|---|---|
| 1. Man and goat, boat holds both | A famous puzzle with one condition changed | 4/4 | 4/4 | +81% (52 vs 28 words) |
| 2. Average speed after a slow first half | Math trap: the target is impossible | 6/6 | 6/6 | +15% |
| 3. Latency jump, two changes in one deploy | Not agreeing with a named suspect | **10/10** | 8/10 | +3% |
| 4. Double-check two finance numbers | Confirming correct work without inventing errors | 6/6 | 6/6 | +15% |
| 5. AI triage pilot, thin evidence | Facts vs. assumptions, conditional recommendation | **16/16** | 11/16 | +26% |
| 6. Water lilies, starting count not given | Naming a missing fact in the headline | **10/10** | 9/10 | +15% |
| **Total** | | **52/52 (100%)** | **44/52 (85%)** | **+16%** |

### What the skill changed

All 8 misses were in the no-skill answers:

- **Latency (2 of 2 runs):** both considered only the driver and the middleware. Neither considered a third explanation, such as an interaction between them or another change in the deploy.
- **Hospital triage (5 checks across 2 runs):**
  - neither run noted that "15%" could mean relative change or percentage points;
  - neither paired its explanations with evidence that would tell them apart;
  - one run described the evidence as "uncontrolled", although the prompt said nothing about the study design.
- **Water lilies (1 run):** gave the conditional answer, but stated the assumption only further down, not in the opening line.

### What it didn't change

- **Prompts 1, 2 and 4:** both conditions passed every check. The model without the skill already avoided these traps, so these prompts don't distinguish the two conditions at this model's level.
- **Baseline quality:** the no-skill answers were generally strong. For example, both no-skill hospital answers recommended a smaller, monitored pilot with a concurrent control group and kept clinicians in charge. The skill's advantage showed up in specific habits, not in the overall recommendation.

### Costs and issues seen

- **Length:** answers with the skill were longer on every prompt. The biggest relative jump was on the trivial goat question (52 vs. 28 words), where the skill's own rules say to answer directly. This is worth tightening.
- **Grader notes on skill answers:**
  - one average-speed answer stated a rough "mid-40s km/h" figure without support;
  - one triage answer inferred that the pilot "looks like a before-and-after comparison", though it hedged this.

## Limitations

- **Small sample:** 2 runs per prompt per condition. The difference in misses (8 vs. 0) is consistent, but this is not a statistically powered comparison.
- **Checks written by the skill's author:** they measure the behaviours the skill targets, such as naming missing facts and pairing explanations with evidence. A neutral benchmark could weigh things differently, for example by rewarding shorter answers.
- **One grader per prompt, no human review of every grade.** The raw answers and grades are included so anyone can check them.
- **One model, in one environment.** Results may differ for other models, or in claude.ai, where the skill triggers on its own instead of being loaded explicitly.

## Files

- [`answers/`](answers/): all 24 raw answers, organized by prompt, condition and run.
- [`grading/`](grading/): each grader's blind grades (`*.blind.json`, labels A–D) and the label key.
- [`results.json`](results.json): pass counts per prompt and condition, failed checks, grader notes and lengths.
