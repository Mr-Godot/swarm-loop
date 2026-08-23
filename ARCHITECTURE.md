# Swarm Loop

Architecture and skill specification. Version 2 (2026-08-22).

A multi-agent quality loop that turns an ambitious goal into a high-standard artifact through decomposition, Builder and Critic pairs, continuous goal fidelity, and holistic integration.

Inspired by the Gauntlet Loop pattern. Renamed and extended for long-running, controllable agentic work.

## Core principle

1. Give a Lead agent a clear Goal and a concrete, fetchable quality Bar.
2. The Lead pins the Bar (fetches it once, stores a snapshot) and decomposes the work into the smallest independently improvable pieces.
3. For each piece, run a Builder and a completely separate Critic in a loop.
4. The Lead hands the Critic the real candidate and the real Bar, labels stripped, order alternated. The Critic picks the better one and names the single biggest gap in the loser.
5. Keep going until the piece wins, stalls, or hits a hard cap.

Three rules that never bend:

- The Builder never grades itself.
- The stack never drifts from the original Goal, Bar and Rules. The Keeper enforces that.
- The human is the ultimate brake. A `STOP` file in the run directory halts everything at the next iteration boundary.

## What changed from v1

| v1 | v2 | Why |
|---|---|---|
| Critic "presents the pair to itself blind" | The Lead strips labels and alternates order before the Critic sees anything | A model cannot un-know which artifact is ours. Blinding has to happen upstream. |
| Critic fetches the Bar each time | Lead pins the Bar once into `bar/` and every Critic reads the same snapshot | A moving Bar makes verdicts incomparable and burns tokens. |
| One Critic mode | Two modes: `ab` (peer artifact) and `checklist` (spec or rubric) | Most Bars are specs, not peer artifacts. A/B against a checklist is meaningless. |
| "Diminishing returns" as an option | Stall rule: same biggest gap twice in a row means the piece is `stalled`, loop stops, human is told | Concrete and cheap. Stops the most common infinite loop. |
| Human stop as a flag | `STOP` file checked at every iteration boundary | A flag needs a channel. A file needs nothing. |
| Seven skills suggested | One skill with `roles/` prompt files and `templates/` | Shareable, loadable, versionable as one unit. |
| Progress page "somewhere" | `log.jsonl` append-only event log, `render_progress.py` turns it into `progress.html` | Agents cannot share memory; a file log is the only state that survives. |

## High-level architecture

```
+--------------------------------------------------------------+
| 0. Intake (the skill itself, in the user's session)          |
|    - Takes the raw goal, hard rules, caps                    |
|    - Proposes 2 or 3 concrete, fetchable Bars, user picks 1  |
|    - Writes GOAL.md and starts the Lead                      |
+------------------------------+-------------------------------+
                               |
+------------------------------v-------------------------------+
| 1. Lead / Orchestrator                                       |
|    - Pins the Bar into run/bar/                              |
|    - Decomposes into smallest independently improvable pieces|
|    - Spawns Builder and Critic per piece, parallel when safe |
|    - Does the blinding (strip labels, alternate order)       |
|    - Checks STOP, caps and stall at every iteration boundary |
|    - Calls Keeper every N iterations and after every wave    |
|    - Calls Whole-Stack Reviewer when all pieces are done     |
|    - Keeps log.jsonl and progress.html current               |
+--------+----------------+-------------------+-----------------+
         |                |                   |
         v                v                   v
+---------------+ +----------------+  +---------------------------+
| Keeper        | | Piece loops    |  | Whole-Stack Reviewer      |
| (Guardian)    | | Builder +      |  | (Final integrator)        |
|               | | Critic         |  |                           |
| Holds Goal,   | |                |  | Looks at the assembled    |
| Bar, Rules.   | | Fresh Critic   |  | result, not summaries.    |
| Reports drift | | every round    |  | Names holistic gaps only  |
| only.         | |                |  |                           |
+---------------+ +----------------+  +---------------------------+
                                              |
                                      +-------v-------+
                                      | Smoother      |
                                      | (optional)    |
                                      +---------------+
```

## Roles

| Role | Responsibility | Constraints |
|---|---|---|
| Lead / Orchestrator | Pins the Bar, decomposes, spawns agents, blinds the pair, keeps state, enforces caps, routes Reviewer findings back to pieces | Never builds or judges a piece. Stays context-lean: reads summaries and verdicts, not artifacts. |
| Builder | Produces the artifact for one piece | Receives the goal slice, the previous attempt and the last gap. Never sees a verdict as "good" or "bad", only the gap. Never self-grades. |
| Critic | Fresh context every round. Judges the real candidate against the real Bar. Returns a winner (`A` or `B`) and the single biggest gap in the loser | Never sees Builder history, reasoning or iteration count. Never knows which label is ours. Must open the real files. |
| Keeper (Goal Guardian) | Holds the immutable Goal, Bar and Rules. Detects and reports drift. Recommends re-injection | Never builds. Never suggests creative improvements. Fidelity only. |
| Whole-Stack Reviewer | Judges the fully assembled artifact for coherence, consistency and continued alignment with Goal and Bar | Fresh context. Sees the real assembled result. Does not re-litigate pieces that passed unless they cause a systemic problem. |
| Smoother (optional) | Light polish and conflict resolution after Reviewer feedback | Fresh context. Minimal changes. Cannot change meaning or scope. |

## The Bar

The Bar is the load-bearing element. A vague Bar collapses the loop into self-approval.

A good Bar is:

- Concrete: a file, a URL, a screenshot set, a reference repo, a rubric with measurable checks.
- Fetchable: the Lead can pull it once into `run/bar/` and a Critic can open it without asking anyone.
- Same kind as the output when possible: HTML against HTML, a report against a report, code against code.
- Slightly above reach. A Bar we already beat teaches nothing; a Bar we cannot approach stalls every piece.

Two Critic modes follow from the Bar type:

| Mode | Bar type | Critic question | Win condition |
|---|---|---|---|
| `ab` | A peer artifact (a page, a doc, a design, a repo) | "Which of A and B is better at the goal slice?" | Critic picks ours |
| `checklist` | A spec, rubric, acceptance list or test suite | "Which of these checks does the candidate pass? What is the biggest miss?" | Every `must` check passes, and at most `allowedShould` misses |

Intake proposes 2 or 3 candidate Bars and the user picks one. Never start with a Bar the user has not seen.

## Execution flow

### Per piece

1. Builder produces candidate `vN` under `pieces/<id>/vN/`, plus a 3-line summary.
2. Lead checks `STOP`, caps and stall.
3. Lead blinds: candidate and Bar slice become `A` and `B`. Ours is `A` on odd iterations, `B` on even (or by a parity the script chooses; never by the Critic).
4. Critic (fresh context) opens both, returns `{winner, biggest_gap, confidence}` for `ab`, or `{passed[], failed[], biggest_gap}` for `checklist`.
5. Lead maps the verdict back. Win means the piece is `won`. Loss means the gap goes to the Builder for `vN+1`.
6. Repeat until `won`, `stalled` (same biggest gap twice in a row) or `capped` (`max_iterations_per_piece`).

Optional: `critic_votes: 3` runs three Critics with different lenses on the same pair and takes the majority. Use it for the final acceptance round, not every round.

### Global

1. Intake writes `GOAL.md` (Goal, Bar, Rules, caps). It is immutable for the run.
2. Lead pins the Bar. If the Bar cannot be fetched, the run stops here and says so.
3. Lead decomposes and writes `pieces.json`. Each piece has `id, title, goal_slice, mode, bar_slice, artifact_path, depends_on`.
4. Piece loops run, parallel where `depends_on` allows.
5. Every `keeper_every` total iterations, and after every wave: Keeper reviews the latest outputs against `GOAL.md`. Drift means the Lead re-injects the canonical constraints into the offending piece and restarts its loop from the last winning version.
6. When every piece is `won`, `stalled` or `capped`: Whole-Stack Reviewer examines the assembled artifact. Findings route specific pieces back for one bounded extra round, or to the Smoother.
7. Optional final Smoother pass.
8. Lead writes `SUMMARY.md`: per-piece status, iteration counts, final gaps, paths.

## Termination and caps

First-class parameters. The Lead respects them without exception.

```yaml
termination:
  win_condition: critic_picks_ours        # or checklist_pass
  max_iterations_per_piece: 8
  max_total_iterations: 40
  stall_rule: same_gap_twice              # marks piece stalled
  keeper_every: 10                        # total iterations between Keeper checks
  critic_votes: 1                         # 3 for majority on final acceptance
  require_whole_stack_review: true
  max_wall_time: null                     # optional, enforced by the human or LX
  human_stop: STOP                        # file name in the run dir
```

When a cap or stall is hit: mark the piece `best_effort`, record the last verdict and gap, continue with the others. Never silently loop past a cap.

## Run directory

```
swarm-runs/<YY-MMDD-slug>/
  GOAL.md            immutable Goal, Bar, Rules, caps
  bar/               pinned snapshot of the Bar
  pieces.json        decomposition
  pieces/<id>/vN/    every candidate, never overwritten
  verdicts/<id>-vN.json
  keeper/<n>.json
  review/final.json
  log.jsonl          append-only events, one JSON object per line
  progress.html      rendered from log.jsonl by render_progress.py
  SUMMARY.md         written at the end
  HANDOFF-lead.md    Lead's resume point, rewritten at every pause or end of session
  HANDOFF-<role>-<piece>-<iter>.md   one per agent session that ended or was told to restart
  STOP               human creates it to halt the run
```

On this machine the default root is `C:\Users\godot\_agents\x-temp\swarm-runs\`. On LX it is `~/swarm-runs/`.

The run directory and every work file under it are never deleted. Only git worktrees created for judging or building may be removed.

### Handoff

Every agent session (Lead, Builder, Critic, Keeper, Reviewer) ends by writing `HANDOFF-<role>-<piece>-<iter>.md` in the run dir, when it finishes or when it is told the session will restart. The Lead writes `HANDOFF-lead.md` at every pause or end of session and points the user to it. Skeleton: `templates/HANDOFF.md`. Contents: role and brief; machine rules in force; status (done, mid-work, blocked); the verdict or build result; the exact gap text for the next agent; what is already verified (do not re-verify); repo state (branch, HEAD, unpushed commits, dirty files and which lane owns them, worktrees left); caps from `GOAL.md`; global rules in force; what is still pending from this agent (ideally nothing).

## Claude Code mapping

| Concept | Implementation |
|---|---|
| Lead | The Workflow script (`templates/workflow.js`) when the Workflow tool is available; otherwise the session itself, spawning Agent subagents by hand |
| Fresh context | A new `agent()` or Agent call. Nothing from a prior call reaches it unless the prompt carries it |
| Builder and Critic prompts | `roles/builder.md`, `roles/critic.md`, filled by the script |
| Blinding | Done in script code. The Critic prompt receives paths labelled A and B only |
| Progress page | Each agent appends to `log.jsonl` and runs `render_progress.py` as its last step |
| Human stop | `STOP` file. Every Builder prompt starts with "if STOP exists, return stopped" |
| Heavy runs | Dispatch to LX with the lx-dispatch skill. Wide local fan-out bluescreens the laptop |

## Performance tiers

One knob sets the model and effort for every role. Judges are never weaker than builders: a Critic below the Builder makes the loop converge on the Critic's taste, not the Bar.

| Tier | Use for | Lead | Builder | Critic | Keeper | Reviewer | Final votes | Default caps |
|---|---|---|---|---|---|---|---|---|
| `absolute` | Ship-grade, commercial, cost is not the constraint | fable high | opus high | fable high | opus high | fable high | 3 | 10 per piece, 60 total |
| `strong` (default) | Serious work that a human will act on | opus high | opus high | opus high | sonnet medium | opus high | 1 | 8 per piece, 40 total |
| `quick` | Drafts, exploration, cheap first pass | sonnet medium | sonnet medium | sonnet medium | haiku low | sonnet medium | 1 | 4 per piece, 20 total |

Overrides: `models: {critic: {model:'fable', effort:'high'}}` on top of any tier. The scribe (log lines, summary) is always haiku low. Effort `xhigh` is never used. Mechanical work (recon, classification, log rendering, sweeps, assembly) runs sonnet in every tier.

The Agent tool has no effort knob. Effort is set through the agent definitions shipped under `agents/` (`swarm-critic.md` fable high, `swarm-builder.md` opus high, `swarm-mech.md` sonnet), installed by copying to `~/.claude/agents/`, and through the Workflow tool's `agent(prompt, {model, effort})`.

"Final votes 3" means the first Critic that picks ours triggers two more fresh Critics with different lenses (first-time reader, correctness). Majority decides. The dissenter's gap feeds the next round.

## Interaction modes

| Mode | Intake | During the run | Stall |
|---|---|---|---|
| `ask` (default when a human is present) | Proposes 2 or 3 Bars and a tier, user picks | Runs without questions | Lead asks the human (AskUserQuestion) whether to accept best effort, change the gap, or stop |
| `autonomous` (default on LX, cron, dispatch) | Picks the first proposed Bar and `strong` unless told otherwise, records the choice in GOAL.md | Never pauses | Marks `stalled`, moves on, reports at the end |

`STOP` works in both modes.

## Domain profiles

Same loop, different Bar, pieces and Critic evidence. The profile is set at Intake.

| Profile | Bar | Pieces | Builder output | What the Critic opens | Borrowed from |
|---|---|---|---|---|---|
| `ui` | Peer product screenshots plus a rubric (`checklist`), or a reference design (`ab`) | Screens and flows from a swarm-ui-design critique: `brokenNow[]` first, then slices. Pieces in one big UI file share a `lane` and run sequentially | Code plus fresh renders from the app's headless render hook (`--render-ui <dir>` on WPF, Playwright or the `browse` skill on web) | The PNG renders, never the code | swarm-ui-design phases 1 to 4 produce `pieces.json`; phase 6 is the render hook |
| `analysis` | A rubric per dimension with `must` and `should` checks (`checklist`), or a reference memo (`ab`) | One piece per dimension (market, pricing, moat, unit economics, channel, timing, risk, execution), plus a synthesis piece that depends on all | A JSON or Markdown section with facts, sources and a score | The section and its sources. Three-lens voting on the synthesis piece | venture-validation stages 1, 2 and 2b (three lenses, skeptic re-check) |
| `code` | The test suite, lint and a spec (`checklist`) | Modules or features; files in common share a `lane` | Code in a worktree, tests green | Runs the tests and reads the diff | orchestrating-swarms; `isolation: 'worktree'` for parallel lanes |
| `doc` | A peer document of the same kind (`ab`) or a house format rubric (`checklist`) | Sections | The section file | The section, rendered if HTML | editorial-html-report for house HTML |

### First planned run: talk2me UI/UX for commercial distribution

Profile `ui`, tier `absolute`, mode `ask`. Bar candidates to propose at Intake: (1) three best-in-class Windows utility onboarding and settings flows captured as screenshots plus a rubric (first-run to first success in under 2 minutes, no state lie, one accent colour, every setting reachable in 2 clicks), (2) a competitor dictation product's flow, (3) the talk2me design spec once locked. Decompose through swarm-ui-design: reader cards, per-screen critique with user scenarios, skeptic gate, punch list. Builder renders through `--render-ui`. Critic judges renders. Reviewer runs all user scenarios against fresh renders (swarm-ui-design phase 7 GO gate). Rules: WPF, functional changes only where a scenario is broken, no new features without a scenario, French and English copy.

## Cross-pollination

Taken from `venture-validation`: staged Workflow calls with the orchestrator adapting between stages, full results to disk and compact digests back, three-lens refutation (`finalVotes: 3`), the skeptic re-check (`stall audit`), `codex exec` as an external engine when tokens must be offloaded, and "a NO-GO is a successful outcome" (a `stalled` piece is honest output, never rounded up).

Taken from `swarm-ui-design`: reader agents returning cards not dumps, per-screen scenario critique, the skeptic gate that defaults to reject, LOCKED decisions in one file every agent reads (`GOAL.md` plus `pieces.json`), the headless render hook so judges see the real UI, and sequential lanes where parallel edits collide.

What those two skills can take back from here: the `STOP` file, `log.jsonl` plus `render_progress.py` for a live page, Bar pinning, the tier table, and the Builder-never-sees-the-verdict rule.

## Anti-patterns

- Letting the Critic see "this is iteration 6". Count leaks bias.
- Passing the Builder a verdict instead of a gap. The Builder needs one thing to fix, not a grade.
- A Bar that is a sentence ("make it premium"). Not fetchable, not comparable.
- Summaries instead of artifacts for the Critic or the Reviewer. They judge the real thing or they judge nothing.
- Re-running the Keeper on every iteration. It is a periodic check, not a gate.
- Over-specifying the Builder. Give it the slice, the gap and the Rules. Let it work.
- A session that ends without a handoff loses the run state. Every agent writes `HANDOFF-<role>-<piece>-<iter>.md`; the Lead writes `HANDOFF-lead.md` at every pause.
- The Lead doing work itself. It is a Chief of Staff: it dispatches everything, reads summaries, verdicts and the log, and keeps its context for decisions.

## Design notes

- Fresh context for Critics and the Reviewer is non-negotiable.
- The Keeper exists because long-running stacks reliably lose the original intent.
- The Whole-Stack Reviewer is optional for loosely coupled work and mandatory for interdependent artifacts.
- Surface counters, status and remaining gaps on the progress page so the human can intervene intelligently.
- Prefer minimal prompts. Over-specified architecture reduces the model's ability to make good local decisions.
