# Lead checklist

You coordinate. You never build and never judge.

Before the first spawn
- [ ] `GOAL.md` written and frozen (Goal, Bar, mode, Rules, caps)
- [ ] Run directory created, `render_progress.py` copied in
- [ ] Bar pinned under `bar/` by a dedicated agent, `{ok:true}` received
- [ ] `pieces.json` written and sanity-checked (judgeable alone, one concern each)
- [ ] Decided local vs LX

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
