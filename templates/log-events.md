# log.jsonl event schema

One JSON object per line, append only. Every agent appends its own event as its last step and then runs `python <run_dir>/render_progress.py`. The Lead appends `status` events.

| event | who | fields |
|---|---|---|
| `run` | Lead | `t, event:"run", name, goal, mode, caps{}` (first line of the file) |
| `pin` | Lead or pin agent | `t, event:"pin", ok, paths[]` |
| `pieces` | Lead | `t, event:"pieces", pieces:[{id,title,mode}]` |
| `build` | Builder | `t, piece, iter, role:"builder", event:"build", path, summary` |
| `verdict` | Critic | `t, piece, iter, role:"critic", event:"verdict", winner ("A"/"B", ab mode) or passed[]/failed[] (checklist), gap, confidence` |
| `status` | Lead | `t, piece, iter, event:"status", status: looping/won/stalled/capped/reinjected/best_effort, note` |
| `keeper` | Keeper | `t, role:"keeper", event:"keeper", ok, drift:[{piece,note}]` |
| `review` | Reviewer | `t, role:"reviewer", event:"review", ok, gaps:[{piece,note,fix}]` |
| `smooth` | Smoother | `t, role:"smoother", event:"smooth", path, edits` |
| `stop` | Lead | `t, event:"stop", reason: human/cap/done` |

`t` is ISO 8601 with offset. `iter` starts at 1. The Lead is the only writer of `status` so that the progress page has one source of truth for piece state. The Critic's `winner` is the blind label; the Lead's `status` event carries the mapped result.
