#!/usr/bin/env python3
"""Render progress.html from log.jsonl in the same directory.

Usage: python render_progress.py [run_dir]
Stdlib only. Safe to run after every event. Never raises on a bad line; it skips it.
"""
import html
import json
import os
import sys
from datetime import datetime

run_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
log_path = os.path.join(run_dir, "log.jsonl")
out_path = os.path.join(run_dir, "progress.html")
stop_path = os.path.join(run_dir, "STOP")

events = []
if os.path.exists(log_path):
    with open(log_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                events.append(json.loads(line))
            except Exception:
                continue

run = next((e for e in events if e.get("event") == "run"), {})
caps = run.get("caps", {}) or {}
pieces = {}
order = []
for e in events:
    if e.get("event") == "pieces":
        for p in e.get("pieces", []):
            pid = p.get("id")
            if pid and pid not in pieces:
                pieces[pid] = {"id": pid, "title": p.get("title", ""), "mode": p.get("mode", ""),
                               "iter": 0, "status": "pending", "gap": "", "path": "", "verdicts": 0, "wins": 0}
                order.append(pid)

for e in events:
    pid = e.get("piece")
    if not pid or e.get("event") not in ("build", "verdict", "status"):
        continue
    if pid not in pieces:
        pieces[pid] = {"id": pid, "title": "", "mode": "", "iter": 0, "status": "looping",
                       "gap": "", "path": "", "verdicts": 0, "wins": 0}
        order.append(pid)
    p = pieces[pid]
    ev = e.get("event")
    it = e.get("iter")
    if isinstance(it, int) and it > p["iter"]:
        p["iter"] = it
    if ev == "build":
        p["path"] = e.get("path", p["path"])
        if p["status"] == "pending":
            p["status"] = "looping"
    elif ev == "verdict":
        p["verdicts"] += 1
        if e.get("gap"):
            p["gap"] = e["gap"]
    elif ev == "status":
        p["status"] = e.get("status", p["status"])
        if e.get("note"):
            p["note"] = e["note"]

total_iters = sum(p["iter"] for p in pieces.values())
keepers = [e for e in events if e.get("event") == "keeper"]
reviews = [e for e in events if e.get("event") == "review"]
stops = [e for e in events if e.get("event") == "stop"]
stopped_by_file = os.path.exists(stop_path)
last_t = events[-1].get("t", "") if events else ""

counts = {}
for p in pieces.values():
    counts[p["status"]] = counts.get(p["status"], 0) + 1

def esc(x):
    return html.escape(str(x if x is not None else ""))

rows = []
for pid in order:
    p = pieces[pid]
    cap = caps.get("max_iterations_per_piece", "")
    rows.append(
        "<tr class='s-%s'><td><code>%s</code></td><td>%s</td><td>%s</td><td class='num'>%s%s</td>"
        "<td><span class='pill'>%s</span></td><td>%s</td><td class='path'>%s</td></tr>" % (
            esc(p["status"]), esc(pid), esc(p["title"]), esc(p["mode"]), esc(p["iter"]),
            (" / %s" % esc(cap)) if cap != "" else "", esc(p["status"]), esc(p["gap"]), esc(p["path"])))

tail = []
for e in events[-40:][::-1]:
    t = esc(e.get("t", ""))[11:19]
    who = esc(e.get("role") or e.get("event"))
    what = e.get("event")
    detail = ""
    if what == "build":
        detail = e.get("summary", "")
    elif what == "verdict":
        detail = "winner %s | gap: %s" % (e.get("winner", ",".join(e.get("failed", []) or []) or "?"), e.get("gap", ""))
    elif what == "status":
        detail = "%s %s" % (e.get("status", ""), e.get("note", ""))
    elif what == "keeper":
        detail = "ok" if e.get("ok") else "DRIFT: " + "; ".join("%s: %s" % (d.get("piece"), d.get("note")) for d in e.get("drift", []))
    elif what == "review":
        detail = "ok" if e.get("ok") else "; ".join("%s: %s (%s)" % (g.get("piece"), g.get("note"), g.get("fix")) for g in e.get("gaps", []))
    elif what == "stop":
        detail = "STOP: %s" % e.get("reason", "")
    else:
        detail = json.dumps({k: v for k, v in e.items() if k not in ("t", "event", "role")}, ensure_ascii=False)[:200]
    tail.append("<tr><td class='t'>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>" % (
        t, esc(e.get("piece", "")), esc(e.get("iter", "")), who, esc(detail)))

banner = ""
if stopped_by_file:
    banner = "<div class='banner stop'>STOP file present. Run halts at the next boundary.</div>"
elif stops:
    banner = "<div class='banner done'>Run ended: %s</div>" % esc(stops[-1].get("reason", ""))

keeper_line = "no Keeper run yet" if not keepers else ("last Keeper: %s" % ("ok" if keepers[-1].get("ok") else "DRIFT"))
review_line = "no Reviewer run yet" if not reviews else ("last Reviewer: %s" % ("ok" if reviews[-1].get("ok") else "%d gaps" % len(reviews[-1].get("gaps", []))))

page = """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta http-equiv="refresh" content="15">
<title>Swarm Loop: %(name)s</title>
<style>
:root{--bg:#fbfbfa;--fg:#1c1c1c;--mute:#6b6b6b;--line:#e4e2dc;--card:#fff;--won:#1f7a3e;--loop:#8a5a00;--bad:#a12a2a;--pend:#6b6b6b}
@media (prefers-color-scheme:dark){:root{--bg:#141414;--fg:#ececec;--mute:#9a9a9a;--line:#2a2a2a;--card:#1c1c1c}}
body{margin:0;padding:28px;background:var(--bg);color:var(--fg);font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:1200px}
h1{font-size:22px;margin:0 0 4px}.sub{color:var(--mute);margin:0 0 18px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:0 0 20px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px 12px}
.kpi b{display:block;font-size:22px}.kpi span{color:var(--mute);font-size:12px}
table{width:100%%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:8px;overflow:hidden;margin-bottom:22px}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}th{font-size:12px;color:var(--mute);font-weight:600}
td.num{text-align:right;white-space:nowrap}td.path{font-family:ui-monospace,Consolas,monospace;font-size:12px;color:var(--mute);word-break:break-all}
td.t{font-family:ui-monospace,Consolas,monospace;color:var(--mute);white-space:nowrap}
.pill{display:inline-block;padding:1px 8px;border-radius:999px;font-size:12px;border:1px solid var(--line)}
.s-won .pill{color:var(--won);border-color:var(--won)}.s-looping .pill,.s-reinjected .pill{color:var(--loop);border-color:var(--loop)}
.s-stalled .pill,.s-capped .pill,.s-best_effort .pill{color:var(--bad);border-color:var(--bad)}.s-pending .pill{color:var(--pend)}
.banner{padding:10px 14px;border-radius:8px;margin:0 0 16px;font-weight:600}.banner.stop{background:#fbe9e9;color:#7a1f1f}.banner.done{background:#e7f3ea;color:#1f5a33}
h2{font-size:15px;margin:0 0 8px;color:var(--mute);font-weight:600}
</style></head><body>
<h1>Swarm Loop: %(name)s</h1>
<p class="sub">%(goal)s</p>
%(banner)s
<div class="kpis">
<div class="kpi"><b>%(npieces)d</b><span>pieces</span></div>
<div class="kpi"><b>%(won)d</b><span>won</span></div>
<div class="kpi"><b>%(looping)d</b><span>looping</span></div>
<div class="kpi"><b>%(bad)d</b><span>stalled or capped</span></div>
<div class="kpi"><b>%(total)d%(totalcap)s</b><span>total iterations</span></div>
<div class="kpi"><b>%(last)s</b><span>last event</span></div>
</div>
<p class="sub">%(keeper)s. %(review)s. Mode %(mode)s. Page refreshes every 15 s. To halt: create a file named STOP in %(dir)s</p>
<h2>Pieces</h2>
<table><thead><tr><th>id</th><th>title</th><th>mode</th><th>iter</th><th>status</th><th>last gap</th><th>latest path</th></tr></thead><tbody>
%(rows)s
</tbody></table>
<h2>Recent events (newest first)</h2>
<table><thead><tr><th>time</th><th>piece</th><th>iter</th><th>who</th><th>detail</th></tr></thead><tbody>
%(tail)s
</tbody></table>
</body></html>""" % {
    "name": esc(run.get("name", os.path.basename(run_dir.rstrip("/\\")))),
    "goal": esc(run.get("goal", "")),
    "banner": banner,
    "npieces": len(pieces),
    "won": counts.get("won", 0),
    "looping": counts.get("looping", 0) + counts.get("reinjected", 0) + counts.get("pending", 0),
    "bad": counts.get("stalled", 0) + counts.get("capped", 0) + counts.get("best_effort", 0),
    "total": total_iters,
    "totalcap": (" / %s" % esc(caps["max_total_iterations"])) if "max_total_iterations" in caps else "",
    "last": esc(last_t[11:19] or "none"),
    "keeper": esc(keeper_line),
    "review": esc(review_line),
    "mode": esc(run.get("mode", "")),
    "dir": esc(run_dir),
    "rows": "\n".join(rows) or "<tr><td colspan='7'>no pieces yet</td></tr>",
    "tail": "\n".join(tail) or "<tr><td colspan='5'>no events yet</td></tr>",
}

with open(out_path, "w", encoding="utf-8") as f:
    f.write(page)
print(out_path)
