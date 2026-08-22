# GOAL (immutable for this run)

Run: {YY-MMDD-slug}
Created: {ISO date}
Run dir: {absolute path}

## Goal
{Two lines. What the finished artifact is and who it is for.}

## Bar
Type: {peer artifact | spec | rubric | test suite}
Mode: {ab | checklist}
Source: {URL, path, or how to fetch}
Pinned at: bar/{...}
Why this Bar: {one line: slightly above reach because ...}

## Rules (never bend)
- {constraint}
- {constraint}

## Caps
```yaml
max_iterations_per_piece: 8
max_total_iterations: 40
keeper_every: 10
critic_votes: 1
allowed_should: 0
require_whole_stack_review: true
human_stop: STOP
```

## Out of scope
- {anything the loop must not touch}
