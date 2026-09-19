# Lead checklist

You coordinate. You never build and never judge.

Before the first spawn
- [ ] `GOAL.md` written and frozen (Goal, Bar, mode, Rules, caps)
- [ ] Run directory created, `render_progress.py` copied in
- [ ] Bar pinned under `bar/` by a dedicated agent, `{ok:true}` received
- [ ] `pieces.json` written and sanity-checked (judgeable alone, one concern each)
- [ ] Decided local vs studio
- [ ] Agent definitions installed: `agents/swarm-critic.md` (fable, high), `agents/swarm-builder.md` (opus, high), `agents/swarm-mech.md` (sonnet) copied to `~/.claude/agents/`. The Agent tool has no effort knob; effort comes from these files or from the Workflow tool's `agent(prompt, {model, effort})`

Every iteration
- [ ] `STOP` file absent
- [ ] Total iterations below `max_total_iterations`
- [ ] Piece iterations below `max_iterations_per_piece`
- [ ] Builder got: goal slice, Rules, previous version path, last gap. Nothing else.
- [ ] Labels assigned by you: ours is A on odd iterations, B on even
- [ ] Critic is a fresh agent with paths only
- [ ] Verdict mapped back; `won`, `stalled` (same gap twice) or continue
- [ ] `status` event appended when status changes

Every `keeper_every` total iterations
- [ ] Keeper run on latest versions; drift means re-inject `GOAL.md` and restart that piece from its last winning version

When all pieces are done
- [ ] Whole-Stack Reviewer on the assembled artifact
- [ ] Named pieces get at most one extra bounded round (cap 3), or the Smoother
- [ ] Reviewer re-run once, then stop
- [ ] `SUMMARY.md` written, user told where to look first
- [ ] `HANDOFF-lead.md` written, user pointed to it

At every pause or end of session
- [ ] Write `HANDOFF-lead.md` in the run dir from `templates/HANDOFF.md`, overwriting the previous one
- [ ] Role and brief: Lead, the run slug, the goal in two lines
- [ ] Machine rules in force (local vs studio, concurrency cap, render hook)
- [ ] Status: done, mid-work or blocked, and on which pieces
- [ ] Last verdict or build result per active piece
- [ ] The exact gap text the next Builder call must receive, per piece
- [ ] What is already verified, so the next session does not re-verify
- [ ] Repo state: branch, HEAD, unpushed commits, dirty files and which lane owns them, worktrees left
- [ ] Caps from `GOAL.md` and how many iterations are spent
- [ ] Global rules in force (no em-dashes, no deletes in the run dir, STOP file, blinding)
- [ ] What is still pending from the Lead, ideally nothing
- [ ] Every sub-agent you told to stop has written its own `HANDOFF-<role>-<piece>-<iter>.md`
- [ ] Tell the user: `HANDOFF-lead.md` is the resume point
