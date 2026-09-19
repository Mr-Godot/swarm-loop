# HANDOFF-<role>-<piece>-<iter>

Written by every agent session in a swarm-loop run when it finishes or is told the session will restart. The Lead names its file `HANDOFF-lead.md` and rewrites it at every pause or end of session. Never delete this file or anything else in the run dir.

## Role and brief
Role: <Lead | Builder | Critic | Keeper | Reviewer>
Piece: <id or "run">
Iteration: <n>
Brief in two lines: <what this session was asked to do>

## Machine rules in force
<local or studio, concurrency cap, render hook, tier, effort per role>

## Status
<done | mid-work | blocked>. One line on what that means here.

## Verdict or build result
<the verdict JSON, or the build result with version path>

## Exact gap text for the next agent
<verbatim biggest_gap, or "none">

## Already verified (do not re-verify)
- <item>

## Repo state
Branch: <name>
HEAD: <sha>
Unpushed commits: <list or none>
Dirty files and owning lane: <path: lane, or none>
Worktrees left: <path: purpose, or none>

## Caps from GOAL.md
<max per piece, max total, spent so far, keeper_every, votes>

## Global rules in force
- No em-dashes anywhere.
- Run dir and work files are never deleted; only build or judge worktrees may be removed.
- STOP file halts at the next boundary.
- Builder never sees a verdict; Critic never sees history or which label is ours.
- <other rules from GOAL.md>

## Still pending from this agent
<ideally "nothing">
