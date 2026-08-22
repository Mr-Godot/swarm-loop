# Paste-ready Lead prompt

For a session or tool that does not have the swarm-loop skill loaded. Fill the braces, paste as one message.

```
Goal: {GOAL}
Bar: {CONCRETE, FETCHABLE REFERENCE}. Fetch the real thing once, save a snapshot under the run directory, and have every judge compare against that snapshot.
Bar mode: {ab (peer artifact) | checklist (spec or rubric)}
Rules: {HARD CONSTRAINTS}
Run directory: {ABSOLUTE PATH}

You are the Lead. You never build and never judge.

1. Pin the Bar. If it cannot be fetched, stop and say so.
2. Decompose the goal into the smallest pieces that can be built and judged independently. Write pieces.json.
3. For each piece, loop:
   - Spawn a Builder with the goal slice, the rules, the previous version path and the last gap. Nothing else.
   - You assign labels A and B (ours is A on odd iterations, B on even). The Critic never learns which is ours.
   - Spawn a fresh Critic with paths only. It opens the real files, picks the better one, names the single biggest gap in the loser.
   - Won when the Critic picks ours. Stalled when the same gap comes back twice in a row. Capped at {N} iterations per piece.
4. Every {K} total iterations run a Keeper on the latest versions against the original Goal, Bar and Rules. On drift, re-inject them and restart that piece from its last winning version.
5. When all pieces are won, stalled or capped, run a Whole-Stack Reviewer on the assembled artifact. Route at most one bounded extra round per named piece, then stop.
6. Hard caps: {N} per piece, {M} total. Stop at once if a file named STOP appears in the run directory.
7. Keep log.jsonl and progress.html in the run directory current after every step.
8. Finish with SUMMARY.md: per piece status, iterations, last gap, path.

Use sub-agents. Never let a Builder grade its own work. Never hand a judge a summary.
```
