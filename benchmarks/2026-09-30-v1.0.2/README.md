# Benchmark: think-better v1.0.2 vs. no skill (2026-09-30)

**Summary:** v1.0.2 fixes the length cost found in the [v1.0.1 benchmark](../2026-09-30-v1.0.1/README.md) without losing any checks. With the skill, answers still met **52/52** checks. They are now **2%** longer than answers without the skill, down from 16% with v1.0.1.

## What changed in v1.0.2

The v1.0.1 benchmark showed that answers with the skill were 81% longer on a trivial question. Both of those answers added a paragraph about the famous version of the puzzle. The cause was in the skill itself: its worked example told the model to "note that it differs from the classic version". v1.0.2 makes three changes:

- It says the check on a "looks easy" question happens in Claude's head, and the reply stays as short as a direct answer.
- It adds a rule: **checks you ran are not content**. Don't write about the trap you avoided or what you double-checked unless it helps the user.
- It rewrites that example to a one- or two-sentence reply.

## Method

The setup is the same as the [v1.0.1 benchmark](../2026-09-30-v1.0.1/README.md): the same 6 prompts and 26 checks, and 2 new runs per prompt with v1.0.2. The no-skill answers are the same 12 from v1.0.1, reused because nothing about that condition changed. For each prompt, the 2 new skill answers and the 2 no-skill answers were shuffled, relabeled A–D and graded blind by a fresh grader.

## Results

| Prompt | v1.0.2 checks | No-skill checks | Length: v1.0.2 / v1.0.1 / no skill |
|---|---|---|---|
| 1. Man and goat, boat holds both | 4/4 | 4/4 | 20 / 52 / 28 |
| 2. Average speed after a slow first half | 6/6 | 6/6 | 170 / 228 / 199 |
| 3. Latency jump, two changes in one deploy | **10/10** | 8/10 | 490 / 494 / 478 |
| 4. Double-check two finance numbers | 6/6 | 6/6 | 250 / 293 / 254 |
| 5. AI triage pilot, thin evidence | **16/16** | 11/16 | 648 / 672 / 534 |
| 6. Water lilies, starting count not given | 10/10 | 10/10 | 226 / 320 / 278 |
| **Total** | **52/52** | 45/52 | **+2%** vs. no skill (v1.0.1: +16%) |

Lengths are averages of 2 runs, counted as words for English and characters for Chinese.

- **Shorter where the answer is simple:** the skill's answers are now shorter than the no-skill answers on the goat, average-speed and water-lily prompts.
- **Longer where it adds substance:** on the triage prompt, answers are still about 22% longer. That is where the skill adds the missing-fact checks, conditional recommendations and evidence for each explanation.
- **Same misses without the skill:** the latency and triage prompts again separate the two conditions.
- **One grader note on a skill answer:** it said no speed, "not even an infinitely fast one", could reach the target. The grader called this a minor imprecision, because in the idealized limit an infinite speed would give exactly 60 km/h.

## Grader agreement

The same 12 no-skill answers scored **44/52** with the v1.0.1 graders and **45/52** with these. The difference is one water-lily answer: one grader said the assumption was stated only further down, and the other said it was in the opening. So differences of one or two checks are within grader noise.

## Limitations

These are the same as in the v1.0.1 report: a small sample (2 runs per condition), checks written by the skill's author, one grader per prompt, and one model.

## Files

- [`answers/`](answers/): the 12 new v1.0.2 answers. The no-skill answers are in [`../2026-09-30-v1.0.1/answers/`](../2026-09-30-v1.0.1/answers/).
- [`grading/`](grading/): blind grades and the label key.
- [`results.json`](results.json): pass counts, failed checks, grader notes and lengths.
