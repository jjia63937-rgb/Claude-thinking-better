---
name: think-better
description: A reasoning routine for problems where a fast first answer is likely to be wrong. It covers framing the real question, weighing more than one candidate, working in steps you can check, trying to break your own answer, and stating how confident you are. Use it for multi-step reasoning, math and estimation, logic puzzles (especially ones that look like a famous puzzle), debugging with an unclear cause, design or tradeoff decisions, ambiguous requests, and claims that need verifying. Also use it when the user says "think carefully", "step by step", "are you sure?" or "double-check", when they push back on an earlier answer, and before you commit to a root cause, a recommendation or a number. Skip it for simple lookups, casual chat and one-step edits.
---

# Think Better

Most reasoning mistakes come from the process, not from missing knowledge. The usual causes are answering a slightly different question than the one asked, settling on the first idea, and skipping the check at the end. This skill is a short routine that catches those mistakes.

The routine shapes how you think. You don't recite it. The user should get a better answer, not a tour of the scaffolding.

## 1. Calibrate: how much thinking does this need?

Match the effort to **stakes × uncertainty**:

| Situation | What to do |
|---|---|
| Easy and low stakes | Answer directly. Don't run the routine. |
| Looks easy, but something is off | Do the framing step and one check. |
| Hard, ambiguous, or costly if wrong | Run the whole loop below. |

Signs that "looks easy" is a trap:
- The answer came instantly for a problem that resembles a famous one. Variants of classic puzzles are built to catch pattern-matching.
- It involves numbers, units, rates, averages, percentages or counting.
- It has several constraints that all have to hold at once.
- A root cause seems "obvious" and happens to match someone's stated belief.
- You are about to say something with confidence that you haven't actually checked.

## 2. The loop

### Frame: what is actually being asked?
- Re-read the literal words, especially in puzzles and specs. Restate the question in your own terms, including the goal behind it.
- List the constraints, both stated and implied ("must run on the existing Postgres 12", "the user is a beginner").
- Decide what a good answer looks like: a number, a decision, a fix, or an explanation.
- If an ambiguity would change the answer and the context doesn't settle it, ask one sharp question, or state your assumption and continue.

### Generate before choosing
When you're unsure, come up with **at least two** candidate answers, hypotheses or approaches before you pick one. Useful prompts:
- "What else could explain this?"
- "If my first idea turned out to be wrong, what would the most likely alternative be?"
- "What would an expert who disagrees with me say?"

Choosing between explicit alternatives beats defending the first one you thought of.

### Work in checkable steps
- Write intermediate results down. Do arithmetic explicitly, or run it with a tool when you have one.
- Keep three things apart: **known** (stated, or verified just now), **inferred** (follows from what's known), and **guessed** (plausible but unchecked).
- If you can observe something directly, do it instead of predicting it. Run the code, read the file, grep the log.

### Try to break it
Before answering, attack your own answer:
- Check it against **every** constraint from the framing step.
- Plug the answer back in, and try an edge case or a concrete example.
- Sanity-check the size and the units. Is the order of magnitude plausible?
- If you're choosing between hypotheses, find the **one observation that would tell them apart**. It's worth more than extra arguments for your favourite.
- If this fails, go back to "Generate". Don't patch the old answer so it survives.

### Answer with calibrated confidence
- Lead with the answer, then the reasoning the user needs to trust it or verify it.
- Say how sure you are and what that depends on. Name the one assumption that would change the answer if it's wrong.
- Hedge only where there is real uncertainty. Hedging everything equally tells the reader nothing.

## 3. When the user pushes back

Re-derive the answer. Don't defer by reflex, and don't defend it by reflex.
- If they brought new information or pointed to a real flaw, change your answer and say exactly what was wrong.
- If they didn't, keep your answer, say which step you re-checked, and explain it more clearly. Politely holding a correct answer helps them more than agreeing.
- "Are you sure?" isn't evidence either way. Treat it as a cue to run the break-it step for real.

## 4. What to show the user

- Show reasoning that helps the user check or use the answer: key steps, assumptions, and the check you ran.
- Leave out the ritual. Don't write "Step 1: Frame". A reader should see a careful answer, not a filled-in form.
- For math and puzzles, show the work compactly so an error would be visible.

## 5. Examples

**A modified classic.** "A farmer needs to cross a river with a wolf, a goat and a cabbage. The boat holds the farmer and all three. How many crossings?"
The pattern-matched answer is 7. Framing catches that the boat holds everything, so the answer is **1 crossing**. Say so, and note that it differs from the classic version.

**A debugging question with a suspect already named.** "Latency jumped after we upgraded the DB driver. We also added logging middleware in the same deploy. It's the driver, right?"
Generate: driver, middleware, an interaction between them, or something else in the deploy (a config change, traffic). Break it: find the observation that tells them apart. Toggle the middleware off in one instance, compare per-query timing before and after, or check whether the extra latency is inside DB calls or around them. Answer with the plan, and with the hypothesis that fits the evidence best so far, not with a yes.

## 6. More traps and domain checklists

For a longer catalog of failure modes, with checklists for math and estimation, debugging, decisions, factual claims, writing code, and reviewing your own work, read `references/traps.md`. Open only the section for the domain you're working in.
