# Reasoning traps and domain checklists

Read the section for the domain you're working in. Each trap comes with the check that catches it.

## Contents
1. Reading the question
2. Math, numbers and estimation
3. Debugging and root cause
4. Decisions and recommendations
5. Factual claims
6. Writing code
7. Reviewing your own work

---

## 1. Reading the question

| Trap | Check |
|---|---|
| **Pattern-matching a famous problem.** The question looks like a classic, so you give the classic answer. | Re-read each noun and number. What changed from the version you remember? |
| **Answering the easier question next to it.** You were asked "should we?" and answered "can we?" | Restate the question in one sentence and compare it with your answer's first sentence. |
| **Losing the goal behind the question.** You fix the literal ask when the real need is different. | Ask why they want this, and whether your answer serves that. |
| **Silent assumptions.** You filled a gap without noticing. | List the assumptions. State any that would change the answer. |

## 2. Math, numbers and estimation

- **Averages of rates.** An average speed over equal distances is not the mean of the speeds. Work with total distance over total time.
- **Percentages.** Is it a percentage of the original or of the new value? Up 50% then down 50% is not zero.
- **Off-by-one.** Fence posts versus fence sections, and inclusive versus exclusive ranges. Count a small case by hand.
- **Units.** Carry the units through every line. If they don't cancel to what you expect, there's an error.
- **Impossible premises.** Sometimes the correct answer is "this can't be done". Check whether the constraints can all be met at all.
- **Estimation.** Break it into factors you can bound. Write each one down with a range, and sanity-check the result against a reference point you know.
- **Invented precision.** A power calculation, sample size or risk estimate built on made-up inputs looks rigorous and misleads. Compute only from given or verified inputs. Otherwise, list the inputs needed, or label the whole calculation as illustrative.
- **Relative versus absolute.** "Rose by 15%" may mean relative or percentage points. If it matters and isn't stated, say both readings and how the conclusion differs.
- **Arithmetic.** For anything beyond one step, write it out or compute it with a tool. Don't do it in your head and report only the result.

## 3. Debugging and root cause

- **Stop at the first plausible cause.** List at least three candidates, including "the environment changed" and "the test or measurement is wrong".
- **Correlation from the same deploy.** When several things changed together, find a way to vary one at a time.
- **Distinguishing evidence.** For each hypothesis, ask what you would expect to see if it were true, and look for an observation where the hypotheses predict different things.
- **Reproduce first.** A fix you can't show working against a reproduction is a guess.
- **Read the actual error.** Read the full message and the stack trace before forming theories. The first line of a trace is often not where the cause is.
- **Suspect named by the user.** Weigh it as one hypothesis among several. Don't confirm it just because they said it.

## 4. Decisions and recommendations

- **Name the criteria before comparing.** Examples: cost, risk, reversibility, time, and who maintains it. Otherwise you tend to pick first and justify afterwards.
- **Include "do nothing" or "wait" as an option** when it's realistic.
- **Reversibility.** Cheap, reversible choices deserve less analysis than one-way doors.
- **Steelman the option you're rejecting.** In one sentence, what is the strongest case for it?
- **Give a recommendation.** A list of options with no pick is usually less useful. Say which one, why, and what would change your mind. When key facts are unknown, make it conditional on them instead of withholding it.
- **Strongest counterargument.** Before finalizing, name the best case against your pick and the unknown most likely to flip it. Revise if it holds up, not for show.
- **Safeguards aren't proof.** "A human reviews it" can become a rubber stamp through automation bias, time pressure, or missing information. Specify who decides, whether they can overrule, and what they see to judge independently.
- **Evidence design.** Before-and-after and non-randomized comparisons are open to seasonality, selection, other simultaneous changes, and regression to the mean. Prefer a concurrent comparison with randomized or balanced allocation when it's feasible, and state what it still can't show (for example, rare harms in a short trial).
- **Absence of evidence.** "No harm detected" in a small or short study is weak evidence of safety. Say how large a harm the study could plausibly have missed, or that this can't be judged without its size.

## 5. Factual claims

- **Known versus recalled.** Separate what you verified in this session from what you remember. For recalled specifics like dates, versions, API names and figures, either check them or mark them as unverified.
- **Stale knowledge.** Anything that changes over time may have moved since training: prices, versions, people's roles, laws.
- **Plausible fabrication.** Specific-sounding details such as a citation, a function name or a statistic are the most dangerous kind to invent. If you can't source it, say so.
- **Filling gaps in a scenario.** When a user gives a short scenario, the missing details (how the study was run, whether there was a control group, the baseline) are unknown, not absent. Don't state them either way.
- **Claimed process.** Don't say you ran a tool, calculation, agent or review unless you did.

## 6. Writing code

- **Trace one concrete input** through the code by hand, including one edge case: empty input, a single element, the maximum size, or null.
- **Check the contract.** Does it do what was asked, and nothing extra that changes behavior?
- **Run it when you can.** Execute the tests or a quick script. Don't argue that it would pass.
- **Match the surroundings.** Existing helpers, naming and error handling. A correct but foreign-looking solution costs the reader.

## 7. Reviewing your own work

Before sending a substantial answer, re-read it as a sharp, skeptical reader:
- Does the first sentence answer the question that was asked?
- Is every claim either supported, verified or marked as uncertain?
- Is there a step where you skipped from A to C?
- If this is wrong, which part is most likely to be wrong? Check that part once more.
- Does any number rest on an input nobody gave you?
- Is the answer longer than the decision needs? Cut what the reader won't use.
