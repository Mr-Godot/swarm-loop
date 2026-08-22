# swarm-loop

A Claude Code skill. Multi-agent quality loop: a Lead decomposes a goal into pieces, and for each piece a Builder and a fresh-context Critic loop until the piece beats a concrete, fetchable Bar in a blind A/B, a Keeper watches for drift from the original goal, and a Whole-Stack Reviewer judges the assembled result.

Read `ARCHITECTURE.md` for the full design. `SKILL.md` is what Claude Code loads.

## Install

Clone into your Claude Code skills folder:

```bash
# Windows (Git Bash)
git clone https://github.com/Mr-Godot/swarm-loop "$HOME/.claude/skills/swarm-loop"
# macOS / Linux
git clone https://github.com/Mr-Godot/swarm-loop ~/.claude/skills/swarm-loop
```

Start or restart Claude Code. The skill shows up as `/swarm-loop`.

Update later with `git -C ~/.claude/skills/swarm-loop pull`.

## Use

In a Claude Code session:

```
/swarm-loop
Goal: <what you want, who it is for>
Bar: <a file, URL, screenshot set, rubric or test suite that defines "good enough">
Rules: <hard constraints>
```

Or describe the job in plain words ("make this report as good as X", "iterate on this UI until it beats Y"). The skill triggers on its own when a quality loop fits.

The Lead will propose 2 or 3 Bars and a tier (`absolute`, `strong`, `quick`), then run. Progress lives in the run directory: `progress.html` refreshes every 15 seconds; create a file named `STOP` there to halt at the next boundary.

## Layout

```
SKILL.md                  what Claude Code loads
ARCHITECTURE.md           specification, roles, tiers, profiles, anti-patterns
roles/                    one prompt template per role
templates/GOAL.md         immutable goal file skeleton
templates/prompt.md       paste-ready Lead prompt for a session without the skill
templates/workflow.js     Workflow-tool engine (Claude Code)
templates/render_progress.py   log.jsonl to progress.html, stdlib only
templates/log-events.md   event schema
```

## Requirements

Claude Code with subagents. The Workflow tool makes the loop deterministic; without it, the Lead drives the same steps by hand. Python 3 for the progress page.

## License

Private. Shared by invitation. Do not redistribute without asking.
