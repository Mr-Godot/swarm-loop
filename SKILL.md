---
name: swarm-loop
description: Run a multi-agent quality loop that pushes an artifact (report, page, design, code, doc, dataset) up to a concrete, fetchable Bar. The Lead decomposes the goal into pieces, runs a Builder and a fresh-context Critic per piece with blind A/B against the real Bar, keeps a Keeper watching for drift, and finishes with a Whole-Stack Reviewer. Use when asked to "swarm loop this", "run the gauntlet on X", "iterate until it beats Y", "loop builder and critic", "make this as good as <reference>", or any time quality matters more than speed and a reference to compare against exists or can be built.
---

# Swarm Loop

You are the **Lead**. You do not build and you do not judge. You pin the Bar, decompose, spawn, blind, count, and stop. Read `ARCHITECTURE.md` in this folder once if the shape is unfamiliar; everything operational is below.

## When to use

- The user wants an artifact to reach a standard, not just to exist.
- A Bar exists or can be proposed: a peer artifact (`ab` mode) or a spec, rubric or test suite (`checklist` mode).
- The work splits into pieces that can be improved and judged on their own.

Do not use for a one-shot answer, a single small edit, or when no Bar can be named. Say so and fall back to normal work.

## Procedure

### 1. Intake (in the user's session, before any agent)

1. Restate the Goal in two lines.
2. Propose 2 or 3 concrete, fetchable Bars. Each one: what it is, where it lives, why it is slightly above reach, and which mode it implies (`ab` or `checklist`). The user picks one. Never start with a Bar the user has not seen. If the user already gave a Bar, confirm it is fetchable and move on.
3. Collect hard Rules (constraints that never bend: tone, stack, language, length, data that must not leave the machine).
4. Pick the **tier**, the **interaction mode** and the **domain profile** (tables in `ARCHITECTURE.md`). Tier sets model and effort for every role: `absolute` (fable everywhere, 3-vote acceptance, caps 10/60), `strong` (opus, default, caps 8/40), `quick` (sonnet, caps 4/20). Judges are never weaker than builders. Mode `ask` proposes and lets the user choose, and pauses on a stall; `autonomous` picks defaults and never pauses (always on LX). Profile `ui`, `analysis`, `code` or `doc` sets what the pieces are and what the Critic opens. Caps can be overridden per run.
   Effort: `absolute` means judges and votes run Fable at effort `high` (never `xhigh`), Builders run Opus at `high`, mechanical work (recon, classification, log rendering, sweeps, assembly) runs Sonnet. The Agent tool has no effort knob. Effort is set through the agent definitions in `~/.claude/agents/` (`swarm-critic.md` model fable effort high, `swarm-builder.md` model opus effort high, `swarm-mech.md` model sonnet) and through the Workflow tool's `agent(prompt, {model, effort})`. The three definitions ship in this skill under `agents/`; install them by copying to `~/.claude/agents/` before the first spawn.
5. Create the run directory `swarm-runs/<YY-MMDD-slug>/` (local root: `C:\Users\godot\_agents\x-temp\swarm-runs\`; on LX: `~/swarm-runs/`). Copy `templates/render_progress.py` into it. Write `GOAL.md` from `templates/GOAL.md`. It is immutable from this point.
6. Decide where it runs. More than about 6 parallel agents or more than an hour of expected work: dispatch to LX with the `lx-dispatch` skill. Otherwise run locally.

### 2. Pin the Bar

Spawn one agent: fetch the Bar exactly as described in `GOAL.md` and save it under `run/bar/` (files, rendered HTML, screenshots, the spec text). It returns `{ok, paths, notes}`. If `ok` is false, stop and report. No pin, no run.

### 3. Decompose

Spawn one agent with `GOAL.md` and the pinned Bar: return `pieces.json`, the smallest set of pieces that can each be built and judged independently. Each piece: `{id, title, goal_slice, mode, bar_slice, artifact_path, depends_on[]}`. `bar_slice` points into `run/bar/` (a file, a section, a subset of checks). Review the list yourself for one minute: pieces that cannot be judged alone get merged, pieces that hide two concerns get split. Save it.

### 4. Run the loops

Preferred engine: the Workflow tool with `templates/workflow.js`. Pass as `args`: `{runDir, skillDir, goal, rules, mode, bar, tier, models?, caps?, pieces? (skip Pin and Decompose when you already have them), assembleInstructions?, assembledPath?}`. The script reads the role files from `skillDir/roles/`, so the role files stay the single source of truth. Fallback without Workflow: drive the loop yourself with Agent calls, same steps, same `model` and `effort` per role as the tier table.

Domain profile shortcuts for Decompose:
- `ui`: run swarm-ui-design phases 1 to 4 (reader cards, per-screen scenario critique, skeptic gate, punch list) and turn the slice plan into `pieces.json`. Pieces editing the same UI file share a `lane`. The Builder must render through the app's headless hook; the Critic opens the renders, never the code.
- `analysis`: one piece per dimension plus a synthesis piece that `depends_on` all; `checklist` mode with a rubric per dimension; 3 votes on the synthesis.
- `code`: `checklist` mode where the checklist is the test suite plus lint; lanes per file group; worktree isolation for parallel lanes.
- `doc`: `ab` against a peer document, one piece per section.

Per piece, per iteration:

1. **Builder** (`roles/builder.md`): gets the goal slice, Rules, the previous version path, the last biggest gap. Writes `pieces/<id>/vN/`, appends a `build` event to `log.jsonl`, runs `render_progress.py`. If `STOP` exists, it returns `{stopped:true}` and you halt.
2. **Blind**: you, not the Critic, assign labels. Ours is `A` on odd iterations and `B` on even. The Critic prompt receives only `A: <path>` and `B: <path>`.
3. **Critic** (`roles/critic.md`, fresh agent every time): opens both, returns `{winner, biggest_gap, confidence}` (`ab`) or `{passed, failed, biggest_gap}` (`checklist`). Appends a `verdict` event.
4. **Map back and decide**: win means `won`. Loss means the gap goes to the next Builder call. Same `biggest_gap` twice in a row means `stalled`. Iteration cap means `capped`. Every status change is a `status` event in the log.
5. Every `keeper_every` total iterations, run the **Keeper** (`roles/keeper.md`) on the latest version of every active piece. On `drift`, re-inject `GOAL.md` into that piece's next Builder prompt and restart its count from the last winning version.

Run independent pieces in parallel; respect `depends_on`. Never exceed `max_total_iterations` across all pieces.

### 5. Whole-Stack Review

When every piece is `won`, `stalled` or `capped`: spawn the **Reviewer** (`roles/reviewer.md`, fresh) on the assembled artifact. Findings name pieces. Route each named piece back for at most one bounded extra round (cap 3), or call the **Smoother** (`roles/smoother.md`) for cosmetic and seam issues. Re-run the Reviewer once after that. Then stop, whatever the verdict.

### 6. Close

Write `SUMMARY.md`: table of pieces with status, iterations, last gap, path; Keeper and Reviewer verdicts; the progress page path. Write `HANDOFF-lead.md` from `templates/HANDOFF.md` (status, verdicts, repo state, caps, what is pending) and point the user to it. The Lead writes `HANDOFF-lead.md` at every pause as well, not only at the end. Report to the user in the i-have-adhd format: what won, what stalled or capped and why, where the files are, what a human should look at first.

## Hard rules for the Lead

- You never read a full artifact. You read summaries, verdicts and the log. Context is for coordination.
- A Builder never sees a verdict, only the gap. A Critic never sees history, the iteration number, or which label is ours.
- `GOAL.md` never changes during a run. A changed goal is a new run.
- Caps are enforced in code or by you, never negotiated by an agent.
- `STOP` in the run directory halts everything at the next boundary. Check it before every spawn when driving by hand.
- Never let the Critic use a summary. Paths to the real files only.
- Handoff. Every agent session in the run (Lead, Builder, Critic, Keeper, Reviewer) ends by writing `HANDOFF-<role>-<piece>-<iter>.md` in the run dir, when it finishes or when it is told the session will restart. Skeleton in `templates/HANDOFF.md`. The Lead writes `HANDOFF-lead.md` at every pause or end of session and points the user to it. The run dir and every work file under it are never deleted; only git worktrees created for judging or building may be removed.
- Dispatch everything, guard your context. You are a Chief of Staff: every build, judgement, recon and mechanical step goes to an agent. You read only summaries, verdicts and the log, and keep your context for decisions.

## Files in this skill

| Path | Purpose |
|---|---|
| `ARCHITECTURE.md` | Full specification, roles, flow, anti-patterns |
| `roles/lead.md` | Checklist the Lead follows (this file in short form) |
| `roles/builder.md` | Builder prompt template |
| `roles/critic.md` | Critic prompt template, both modes |
| `roles/keeper.md` | Keeper prompt template |
| `roles/reviewer.md` | Whole-Stack Reviewer prompt template |
| `roles/smoother.md` | Smoother prompt template |
| `agents/swarm-critic.md` | Agent definition: Critic and votes, fable, effort high. Copy to `~/.claude/agents/` |
| `agents/swarm-builder.md` | Agent definition: Builder, opus, effort high. Copy to `~/.claude/agents/` |
| `agents/swarm-mech.md` | Agent definition: mechanical worker, sonnet. Copy to `~/.claude/agents/` |
| `templates/GOAL.md` | Immutable goal file skeleton |
| `templates/HANDOFF.md` | Handoff skeleton every agent session writes at its end or before a restart |
| `templates/prompt.md` | Paste-ready Lead prompt for a plain session without this skill |
| `templates/workflow.js` | Workflow tool script: the loop engine |
| `templates/render_progress.py` | Turns `log.jsonl` into `progress.html` |
| `templates/log-events.md` | Event schema for `log.jsonl` |
