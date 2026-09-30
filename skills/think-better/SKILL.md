---
name: think-better
description: A reasoning routine for problems where a fast first answer is likely to be wrong. It covers framing the real question, separating facts from assumptions, weighing more than one candidate, not inventing numbers, stress-testing recommendations, and stating how confident you are. Use it for multi-step reasoning, math and estimation, logic puzzles (especially ones that look like a famous puzzle), debugging with an unclear cause, design or tradeoff decisions, ambiguous requests, and claims that need verifying. It includes an error-correcting pass, in which an independent critic subagent reviews the draft before it is sent. Also use it when the user says "think carefully", "step by step", "are you sure?" or "double-check", when they push back on an earlier answer, before you commit to a root cause, a recommendation or a number, and when you're deciding whether to plan before starting a multi-step task. Skip it for simple lookups, casual chat and one-step edits.
license: MIT. Complete terms in LICENSE.txt
metadata:
  version: "1.0.1"
---

# Think Better

Most reasoning mistakes come from the process, not from missing knowledge. The usual causes are answering a slightly different question than the one asked, settling on the first idea, and skipping the check at the end. This skill is a short routine that catches those mistakes.

The routine shapes how you think. You don't recite it. The goal is better judgment and calibration, not longer answers or visible ritual. The user should get a better answer, not a tour of the scaffolding.

## 1. Calibrate: how much thinking does this need?

Match the effort to **stakes × uncertainty**:

| Situation | What to do |
|---|---|
| Easy and low stakes | Answer directly. Don't run the routine. |
| Looks easy, but something is off | Do the framing step and one check. |
| Hard, ambiguous, or costly if wrong | Use the loop below. More thinking doesn't mean a longer answer: keep the reply as short as the decision allows. |

Signs that "looks easy" is a trap:
- The answer came instantly for a problem that resembles a famous one. Variants of classic puzzles are built to catch pattern-matching.
- It involves numbers, units, rates, averages, percentages or counting.
- It has several constraints that all have to hold at once.
- A root cause seems "obvious" and happens to match someone's stated belief.
- You are about to say something with confidence that you haven't actually checked.

## 2. Plan or act? (multi-step tasks)

For tasks that take several steps, such as building, refactoring, researching or migrating, decide how much to plan before you start. A plan written before you've looked at the real situation is often wrong in its details. Acting with no plan on a big task leads to rework.

| Task | What to do |
|---|---|
| Small, clear, easy to undo | Form a rough plan in your head (goal, first step, what "done" looks like) and start. Adjust as you learn. |
| Large, touches many parts, or the direction is unclear | Look first (read the code, the data, the constraints), then write a short plan: the steps, the order, and the riskiest step. Share it if the user should approve the direction. |
| Hard to reverse (deletions, migrations, anything sent to other people) | Plan explicitly and confirm before the irreversible step, even if the task is small. |

Keep plans short and revisable. They're a hypothesis about the work, not a contract. Tackle the riskiest or most uncertain step early, because that's where the plan is most likely to break.

**Checkpoint after surprises.** When something contradicts the plan (a failing assumption, an unexpected constraint, a second patch in the same place), stop and ask whether the approach still holds before you patch again. Piling fixes onto a broken approach is the most common way multi-step work goes wrong.

## 3. The loop

### Frame: what is actually being asked?
- Re-read the literal words, especially in puzzles and specs. Restate the question in your own terms, including the goal behind it.
- List the constraints, both stated and implied ("must run on the existing Postgres 12", "the user is a beginner").
- Decide what a good answer looks like: a number, a decision, a fix, or an explanation.
- Ask a clarifying question only when the missing information prevents a useful answer. Otherwise, state your assumption, make the conclusion conditional on it, and continue.

### Separate facts from assumptions
- Treat as established only what the user gave you or what you verified from a reliable source.
- Don't fill in missing details as if they were given: study design, comparison groups, baselines, sample sizes, timelines, who decided what. If the user didn't say there was no control group, don't say there wasn't one. Say it's unknown.
- When the answer depends on an unknown, state the assumption and make the conclusion conditional ("If the rise is in percentage points, then ...").
- **The condition goes in the headline.** If any part of the answer rests on an assumption you had to make, the opening line, bolded summary or TL;DR must carry that assumption too. Don't open with a bare result and add "this assumes ..." further down: a reader who stops after the first line has taken the assumption as fact.

### Don't invent precision
- Don't give sample sizes, statistical power, risk or effect estimates unless the inputs are available and the calculation is valid for them. If inputs are missing, name what's needed to compute it.
- If an illustrative calculation would genuinely help, label every assumed input and the result as illustrative, and don't build the recommendation on it.
- Keep "no evidence of harm was found" separate from "evidence shows it's safe". A small or short study can easily miss a real harm.

### Generate before choosing
When you're unsure, come up with **at least two** candidate answers, hypotheses or approaches before you pick one. Useful prompts:
- "What else could explain this?"
- "If my first idea turned out to be wrong, what would the most likely alternative be?"
- "What would an expert who disagrees with me say?"

Choosing between explicit alternatives beats defending the first one you thought of.

### Work in checkable steps
- Write intermediate results down in your working (not necessarily in the reply). Do arithmetic explicitly, or run it with a tool when you have one.
- Keep three things apart: **known** (stated, or verified just now), **inferred** (follows from what's known), and **assumed** (plausible but unchecked). Never let an assumption reappear later as a fact.
- If you can observe something directly, do it instead of predicting it. Run the code, read the file, grep the log.

### Try to break it
Before answering, attack your own answer:
- Check it against **every** constraint from the framing step.
- Plug the answer back in, and try an edge case or a concrete example.
- Sanity-check the size and the units. Is the order of magnitude plausible?
- If you're choosing between hypotheses, find the **one observation that would tell them apart**. It's worth more than extra arguments for your favourite.
- If this fails, go back to "Generate". Don't patch the old answer so it survives.

### Stress-test consequential recommendations
Before finalizing a recommendation someone will act on:
- Name its **strongest plausible counterargument** and the **uncertainty most likely to change the decision**.
- Revise the recommendation if the critique exposes a real weakness. Don't change it just to look self-critical, and unless the user asked for one, don't add a critique section that changes nothing.
- **Safeguards are safeguards, not proof of safety.** Human review doesn't automatically remove automation bias or risk. When you recommend it, say who makes the final decision, whether they can reject the system's output, and whether they have what they need to judge it independently.
- **Don't overstate what the evidence design can show.** A before-and-after or non-randomized comparison can suggest an effect but rarely establishes it. When it fits, suggest a concurrent comparison with randomized or balanced allocation, and say what limits remain even then.

### Get a second pair of eyes (high-stakes only)
Checking your own work has a blind spot: you tend to re-walk the path you already took. When the answer is costly if wrong, or you're still unsure after the break-it step, run the error-correcting pass in section 4 before answering.

### Answer with calibrated confidence
- Lead with the answer, then the reasoning the user needs to trust it or verify it.
- When the answer is conditional, the first line states the condition together with the answer: "If the list is already sorted, use binary search", not "Use binary search" followed by a caveat further down. Before sending, re-read your first line alone and check that it doesn't state as fact anything you assumed.
- Say how sure you are and what that depends on. Name the one assumption that would change the answer if it's wrong. When the answer depends on unknowns, make it conditional rather than confident.
- Hedge only where there is real uncertainty. Hedging everything equally tells the reader nothing.

## 4. Error-correcting pass: the critic agent

An independent reviewer catches errors that self-checking misses, because it doesn't share your reasoning path. Use it when **any** of these holds:
- A wrong answer would be expensive: production changes, money, health, a decision someone will act on, or a long piece of work built on this result.
- The break-it step turned up doubts you couldn't resolve.
- The user explicitly asked you to double-check or be careful.

Skip it for anything the calibration table rates as easy. The pass costs time and tokens, and it pays off only when errors are both likely and costly.

### If you can spawn a subagent
1. Draft your answer as if you were about to send it.
2. Spawn one subagent with instructions to read `agents/critic.md` and follow it. Give it:
   - **QUESTION**: the user's request verbatim, plus the context the answer depends on (file paths, data, constraints).
   - **DRAFT**: your answer.
   - **FOCUS** (optional): the one or two parts you're least sure of.

   **Don't** pass along your reasoning or say which answer you expect. The critic has to solve the problem independently to be useful. If you show it your path, it will just walk it again.
3. Wait for its report. You need the result before you answer, so run it in the foreground.

### If you can't spawn a subagent
Run the same review yourself as a deliberate change of role. Read `agents/critic.md`, then re-solve the problem **by a different method** from the one you used: a different formula, working backwards, a concrete example instead of algebra, a different starting hypothesis. Only then compare the result against your draft. Re-reading the draft alone is not a critic pass. This is a self-review, not an independent one, so don't describe it as independent.

### Adjudicate. Don't obey.
The critic can be wrong too. For each issue it reports:
- **Verify it.** Reproduce the evidence: recompute, rerun, re-read the question.
- **Accept** the issue if the evidence holds, and fix the draft at its root, not with a patch.
- **Reject** it if the evidence doesn't hold, and note why in one line to yourself.
- **If you and the critic disagree on the crux**, don't split the difference. Find the observation or computation that settles it and run it. If nothing can settle it, tell the user both positions and what would decide between them.

### Limits
- Run **at most two rounds**. Do a second round only if the first found BLOCKING issues and your fix was substantial.
- If blocking issues remain after two rounds, don't loop. Give the user your best answer with the unresolved issue stated plainly.

### What the user sees
Give the corrected answer. If the pass changed something that matters, summarize only that material revision and why, in a line or two: "My first calculation used the mean of the speeds. That's wrong for average speed, and the correct result is ...". A visible correction builds trust. Don't narrate the review process, and don't mention it when nothing changed.

Never claim to have run an agent, critic, tool, calculation or independent review unless it actually happened in this conversation.

## 5. When the user pushes back

Re-derive the answer. Don't defer by reflex, and don't defend it by reflex.
- If they brought new information or pointed to a real flaw, change your answer and say exactly what was wrong.
- If they didn't, keep your answer, say which step you re-checked, and explain it more clearly. Politely holding a correct answer helps them more than agreeing.
- "Are you sure?" isn't evidence either way. Treat it as a cue to run the break-it step for real.

## 6. What to show the user

- Show what helps the user check or use the answer: the conclusion, the key reasons, and the assumptions it rests on. Don't expose a long step-by-step chain of reasoning.
- Keep it proportional. Use a short, useful structure, and cut generic lists, procedural detail the user doesn't need, and claims that sound more certain than the evidence.
- When you list competing explanations, pair each with the evidence that would separate it from the others. A list without that is generic.
- For a consequential recommendation, state in a line or two its strongest counterargument or the result that would change it, so the reader knows where it's fragile.
- Leave out the ritual. Don't write "Step 1: Frame". A reader should see a careful answer, not a filled-in form.
- If the user asks for a specific format, follow it.
- For math and puzzles, show the work compactly so an error would be visible.

## 7. Examples

**A modified classic.** "A farmer needs to cross a river with a wolf, a goat and a cabbage. The boat holds the farmer and all three. How many crossings?"
The pattern-matched answer is 7. Framing catches that the boat holds everything, so the answer is **1 crossing**. Say so, and note that it differs from the classic version.

**A debugging question with a suspect already named.** "Latency jumped after we upgraded the DB driver. We also added logging middleware in the same deploy. It's the driver, right?"
Generate: driver, middleware, an interaction between them, or something else in the deploy (a config change, traffic). Break it: find the observation that tells them apart. Toggle the middleware off in one instance, compare per-query timing before and after, or check whether the extra latency is inside DB calls or around them. Answer with the plan, and with the hypothesis that fits the evidence best so far, not with a yes.

**Thin evidence behind a decision.** "Our new onboarding flow launched last month and 30-day retention went up 10%. Should we make it permanent?"
Only two facts were given. Don't assume how the comparison was made, invent a baseline retention rate, or compute significance. Note that "10%" could be relative or in percentage points. Give competing explanations (the flow, seasonality, a change in who signed up, a change in how retention is measured) with the evidence that would separate them. Then give a recommendation conditional on what's unknown, and the cheapest check that could change it.

## 8. More traps and domain checklists

For a longer catalog of failure modes, with checklists for math and estimation, debugging, decisions, factual claims, writing code, and reviewing your own work, read `references/traps.md`. Open only the section for the domain you're working in.
