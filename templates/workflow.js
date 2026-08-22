export const meta = {
  name: 'swarm-loop',
  description: 'Builder and fresh Critic per piece with blind A/B against a pinned Bar, Keeper drift checks, Whole-Stack review',
  whenToUse: 'Push an artifact up to a concrete Bar through bounded builder/critic loops',
  phases: [
    { title: 'Pin', detail: 'fetch the Bar once into run/bar' },
    { title: 'Decompose', detail: 'write pieces.json' },
    { title: 'Loop', detail: 'builder then fresh critic per piece until won, stalled or capped' },
    { title: 'Keeper', detail: 'drift check against GOAL.md' },
    { title: 'Review', detail: 'whole-stack reviewer, bounded fixes, smoother' },
  ],
}

// args: { runDir, skillDir, goal, rules, mode:'ab'|'checklist', bar:{source, checklistPath}, tier, models, caps,
//         pieces (optional, skips Pin+Decompose), assembleInstructions (optional), domain (optional) }
const A = args || {}
const runDir = A.runDir
const skillDir = A.skillDir
const mode = A.mode || 'ab'
const tier = A.tier || 'strong'
const TIER_CAPS = { absolute: { perPiece: 10, total: 60 }, strong: { perPiece: 8, total: 40 }, quick: { perPiece: 4, total: 20 } }
const caps = Object.assign(
  { perPiece: 8, total: 40, keeperEvery: 10, criticVotes: 1, allowedShould: 0, reviewFixCap: 3, requireReview: true },
  TIER_CAPS[tier] || {}, A.caps || {})

// Performance tiers. Judges are never weaker than builders.
const TIERS = {
  absolute: { lead: { model: 'fable', effort: 'high' }, builder: { model: 'fable', effort: 'xhigh' }, critic: { model: 'fable', effort: 'xhigh' }, keeper: { model: 'opus', effort: 'high' }, reviewer: { model: 'fable', effort: 'xhigh' }, scribe: { model: 'haiku', effort: 'low' }, finalVotes: 3 },
  strong:   { lead: { model: 'opus', effort: 'high' }, builder: { model: 'opus', effort: 'high' }, critic: { model: 'opus', effort: 'high' }, keeper: { model: 'sonnet', effort: 'medium' }, reviewer: { model: 'opus', effort: 'high' }, scribe: { model: 'haiku', effort: 'low' }, finalVotes: 1 },
  quick:    { lead: { model: 'sonnet', effort: 'medium' }, builder: { model: 'sonnet', effort: 'medium' }, critic: { model: 'sonnet', effort: 'medium' }, keeper: { model: 'haiku', effort: 'low' }, reviewer: { model: 'sonnet', effort: 'medium' }, scribe: { model: 'haiku', effort: 'low' }, finalVotes: 1 },
}
const T = Object.assign({}, TIERS[tier] || TIERS.strong, A.models || {})
const opt = (role, extra) => Object.assign({ model: T[role].model, effort: T[role].effort, agentType: 'general-purpose' }, extra || {})

const PIN = { type: 'object', properties: { ok: { type: 'boolean' }, paths: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' } }, required: ['ok', 'paths'] }
const PIECES = { type: 'object', properties: { pieces: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, goal_slice: { type: 'string' }, mode: { type: 'string' }, bar_slice: { type: 'string' }, artifact_path: { type: 'string' }, depends_on: { type: 'array', items: { type: 'string' } }, lane: { type: 'string' } }, required: ['id', 'title', 'goal_slice', 'bar_slice'] } } }, required: ['pieces'] }
const BUILD = { type: 'object', properties: { stopped: { type: 'boolean' }, path: { type: 'string' }, summary: { type: 'string' } }, required: [] }
const VERDICT_AB = { type: 'object', properties: { winner: { type: 'string', enum: ['A', 'B'] }, biggest_gap: { type: 'string' }, confidence: { type: 'number' }, reason: { type: 'string' } }, required: ['winner', 'biggest_gap'] }
const VERDICT_CL = { type: 'object', properties: { passed: { type: 'array', items: { type: 'string' } }, failed: { type: 'array', items: { type: 'string' } }, biggest_gap: { type: 'string' }, reason: { type: 'string' } }, required: ['passed', 'failed', 'biggest_gap'] }
const AUDIT = { type: 'object', properties: { gap_real: { type: 'boolean' }, revised_gap: { type: 'string' }, reason: { type: 'string' } }, required: ['gap_real'] }
const KEEPER = { type: 'object', properties: { ok: { type: 'boolean' }, drift: { type: 'array', items: { type: 'object', properties: { piece: { type: 'string' }, note: { type: 'string' }, reinject: { type: 'string' } } } } }, required: ['ok', 'drift'] }
const REVIEW = { type: 'object', properties: { ok: { type: 'boolean' }, gaps: { type: 'array', items: { type: 'object', properties: { piece: { type: 'string' }, note: { type: 'string' }, fix: { type: 'string', enum: ['rebuild', 'smooth'] } } } } }, required: ['ok', 'gaps'] }
const PATH = { type: 'object', properties: { path: { type: 'string' }, edits: { type: 'array', items: { type: 'string' } } }, required: ['path'] }

const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()
const ctx = `Run dir: ${runDir}\nRead ${runDir}/GOAL.md first. Hard rules: ${A.rules || 'see GOAL.md'}.`
let totalIters = 0
let stopped = false
let lastKeeperAt = 0
let keeperBusy = false
const latest = {}       // piece id -> latest path
const driftNotes = {}   // piece id -> note to inject into the next Builder
const summary = {}

// Tiny scribe: appends a status line to log.jsonl and re-renders. Cheap model.
function scribe(obj) {
  return agent(`Append exactly this one line to ${runDir}/log.jsonl (create if missing), then run: python ${runDir}/render_progress.py\n${JSON.stringify(obj)}\nReturn the word done.`, opt('scribe', { label: `scribe:${obj.piece || obj.event}`, phase: 'Loop' }))
}

// ---------- Pin ----------
let pinned = A.pinned || null
if (!pinned) {
  phase('Pin')
  pinned = await agent(`${ctx}\nFetch the Bar exactly as described in GOAL.md (source: ${JSON.stringify(A.bar || {})}) and save an exact snapshot under ${runDir}/bar/ (files, rendered HTML, screenshots, spec text). Do not summarize it. Append {"t":"<ISO>","event":"pin","ok":<bool>,"paths":[...]} to ${runDir}/log.jsonl and run python ${runDir}/render_progress.py. Return {ok, paths, notes}.`, opt('lead', { label: 'pin-bar', phase: 'Pin', schema: PIN }))
  if (!pinned || !pinned.ok) return { error: 'Bar not fetchable. No pin, no run.', pinned }
}

// ---------- Decompose ----------
let pieces = A.pieces || null
if (!pieces) {
  phase('Decompose')
  const d = await agent(`${ctx}\nPinned Bar: ${runDir}/bar/ (${(pinned.paths || []).join(', ')}).\nDecompose the Goal into the smallest pieces that can each be built and judged independently. For each: id (short slug), title, goal_slice (what this piece must achieve), mode ("${mode}" unless a piece clearly needs the other), bar_slice (the file or section under bar/ or the checklist ids it is judged against), artifact_path (where the Builder writes, under ${runDir}/pieces/<id>/), depends_on (ids that must be won first), lane (pieces sharing a lane edit the same files and run sequentially). Prefer 4 to 12 pieces. Write the same list to ${runDir}/pieces.json and append {"t":"<ISO>","event":"pieces","pieces":[{id,title,mode}]} to ${runDir}/log.jsonl, then run python ${runDir}/render_progress.py. Return {pieces}.`, opt('lead', { label: 'decompose', phase: 'Decompose', schema: PIECES }))
  if (!d || !d.pieces || !d.pieces.length) return { error: 'Decomposition returned no pieces' }
  pieces = d.pieces
}
log(`${pieces.length} pieces, tier ${tier}, caps ${caps.perPiece}/piece ${caps.total} total`)

// ---------- Prompts (role files are the source of truth) ----------
function builderPrompt(p, iter, prevPath, gap) {
  const drift = driftNotes[p.id] ? `\nA fidelity check found drift: ${driftNotes[p.id]}. Re-read GOAL.md in full and return to the goal as written.` : ''
  return `Read ${skillDir}/roles/builder.md and follow it exactly with these values.\nrun_dir=${runDir}\npiece_id=${p.id}\npiece_title=${p.title}\ngoal_slice=${p.goal_slice}\nrules=${A.rules || 'see GOAL.md'}\nn=${iter}\nprevious_path=${prevPath || '(none, first attempt)'}\nbiggest_gap=${gap || '(none)'}\nartifact_path=${p.artifact_path || runDir + '/pieces/' + p.id}${drift}\nFirst check: if ${runDir}/STOP exists return {"stopped":true} and do nothing else.`
}
function criticPrompt(p, iter, candPath, oursIsA, lens) {
  const lensLine = lens ? `\nLens for this judgement: ${lens}.` : ''
  if ((p.mode || mode) === 'checklist') {
    return `Read ${skillDir}/roles/critic.md, section "Mode checklist", and follow it exactly.\nrun_dir=${runDir}\npiece_id=${p.id}\nn=${iter}\ngoal_slice=${p.goal_slice}\nrules=${A.rules || 'see GOAL.md'}\ncandidate_path=${candPath}\nchecklist_path=${p.bar_slice}${lensLine}`
  }
  const a = oursIsA ? candPath : p.bar_slice
  const b = oursIsA ? p.bar_slice : candPath
  return `Read ${skillDir}/roles/critic.md, section "Mode ab", and follow it exactly.\nrun_dir=${runDir}\npiece_id=${p.id}\nn=${iter}\ngoal_slice=${p.goal_slice}\nrules=${A.rules || 'see GOAL.md'}\npath_A=${a}\npath_B=${b}${lensLine}`
}

function won(p, v, oursIsA) {
  if ((p.mode || mode) === 'checklist') {
    const mustFail = (v.failed || []).filter(id => !/should/i.test(id)).length
    const shouldFail = (v.failed || []).filter(id => /should/i.test(id)).length
    return mustFail === 0 && shouldFail <= caps.allowedShould
  }
  return v.winner === (oursIsA ? 'A' : 'B')
}

// ---------- Keeper ----------
async function runKeeper() {
  if (keeperBusy) return
  keeperBusy = true
  lastKeeperAt = totalIters
  const list = Object.keys(latest).map(id => `- ${id}: ${latest[id]}`).join('\n')
  const k = await agent(`Read ${skillDir}/roles/keeper.md and follow it exactly.\nrun_dir=${runDir}\nLatest versions:\n${list}`, opt('keeper', { label: `keeper@${totalIters}`, phase: 'Keeper', schema: KEEPER }))
  if (k && !k.ok) {
    for (const d of k.drift || []) driftNotes[d.piece] = `${d.note} Re-inject: ${d.reinject || 'GOAL.md'}`
    log(`Keeper: drift on ${(k.drift || []).map(d => d.piece).join(', ')}`)
  }
  keeperBusy = false
}

// ---------- Piece loop ----------
async function loopPiece(p, opts) {
  const o = Object.assign({ startIter: 0, maxIter: caps.perPiece, seedGap: null, prevPath: null }, opts || {})
  let iter = o.startIter, gap = o.seedGap, prevPath = o.prevPath, lastGap = null, status = 'looping', audited = false
  while (status === 'looping') {
    if (stopped) { status = 'stopped'; break }
    if (iter - o.startIter >= o.maxIter) { status = 'capped'; break }
    if (totalIters >= caps.total) { status = 'capped'; break }
    iter++; totalIters++
    const b = await agent(builderPrompt(p, iter, prevPath, gap), opt('builder', { label: `build:${p.id}#${iter}`, phase: 'Loop', schema: BUILD }))
    driftNotes[p.id] = null
    if (!b) { status = 'capped'; break }
    if (b.stopped) { stopped = true; status = 'stopped'; break }
    prevPath = b.path; latest[p.id] = b.path
    const oursIsA = iter % 2 === 1
    const v = await agent(criticPrompt(p, iter, b.path, oursIsA), opt('critic', { label: `critic:${p.id}#${iter}`, phase: 'Loop', schema: (p.mode || mode) === 'checklist' ? VERDICT_CL : VERDICT_AB }))
    if (!v) { status = 'capped'; break }
    let isWin = won(p, v, oursIsA)
    if (isWin && T.finalVotes > 1) {
      const extra = await parallel(['a first-time reader of the finished artifact', 'correctness and completeness against the goal slice'].map(lens => () =>
        agent(criticPrompt(p, iter, b.path, oursIsA, lens), opt('critic', { label: `vote:${p.id}#${iter}`, phase: 'Loop', schema: (p.mode || mode) === 'checklist' ? VERDICT_CL : VERDICT_AB }))))
      const wins = 1 + extra.filter(Boolean).filter(x => won(p, x, oursIsA)).length
      isWin = wins >= 2
      if (!isWin) { const dissent = extra.filter(Boolean).find(x => !won(p, x, oursIsA)); v.biggest_gap = dissent ? dissent.biggest_gap : v.biggest_gap }
    }
    if (isWin) { status = 'won'; break }
    gap = v.biggest_gap
    if (lastGap && norm(gap) === norm(lastGap)) {
      if (!audited) {
        audited = true
        const au = await agent(`${ctx}\nYou are a skeptic re-checking a stalled judgement with fresh context. Piece ${p.id}: ${p.goal_slice}. Candidate: ${b.path}. Bar slice: ${p.bar_slice}. Two independent judges named the same biggest gap twice: "${gap}". Open the real files. Is this gap real and fixable inside this piece, or did the judges miss that it is already addressed or belongs elsewhere? If the gap is not real, say so. If a different gap is actually the biggest, give it as revised_gap.`, opt('critic', { label: `stall-audit:${p.id}`, phase: 'Loop', schema: AUDIT }))
        if (au && au.gap_real === false) { await scribe({ t: '', piece: p.id, iter, event: 'status', status: 'looping', note: 'stall audit: gap judged not real; one more round' }); gap = au.revised_gap || gap; lastGap = null; continue }
        if (au && au.revised_gap && norm(au.revised_gap) !== norm(gap)) { gap = au.revised_gap; lastGap = null; continue }
      }
      status = 'stalled'; break
    }
    lastGap = gap
    if (totalIters - lastKeeperAt >= caps.keeperEvery) await runKeeper()
  }
  summary[p.id] = { status, iter, lastGap: gap || lastGap || null, path: prevPath }
  await scribe({ t: '', piece: p.id, iter, event: 'status', status, note: gap || '' })
  return summary[p.id]
}

// ---------- Run loops: lanes are sequential, independent lanes parallel ----------
phase('Loop')
const lanes = {}
for (const p of pieces) { const l = p.lane || p.id; (lanes[l] = lanes[l] || []).push(p) }
// depends_on across lanes: each piece gets a promise that resolves when it finishes. Circular deps deadlock; the Decompose prompt forbids them.
const donePromise = {}, doneResolve = {}
for (const p of pieces) donePromise[p.id] = new Promise(r => { doneResolve[p.id] = r })
async function runLane(list) {
  for (const p of list) {
    for (const dep of p.depends_on || []) { if (donePromise[dep]) await donePromise[dep] }
    if (!stopped) await loopPiece(p)
    doneResolve[p.id]()
  }
}
await parallel(Object.keys(lanes).map(l => () => runLane(lanes[l])))
log(`loops done: ${JSON.stringify(Object.fromEntries(Object.entries(summary).map(([k, v]) => [k, v.status])))}`)
if (stopped) return { stopped: true, summary }

// ---------- Whole-Stack Review ----------
let reviews = []
let assembled = A.assembledPath || runDir + '/pieces'
if (caps.requireReview) {
  phase('Review')
  if (A.assembleInstructions) {
    const as = await agent(`${ctx}\nAssemble the final artifact from the winning or latest versions of every piece: ${JSON.stringify(latest)}. Instructions: ${A.assembleInstructions}. Write it under ${runDir}/assembled/ and return {path}.`, opt('lead', { label: 'assemble', phase: 'Review', schema: PATH }))
    if (as && as.path) assembled = as.path
  }
  const reviewer = () => agent(`Read ${skillDir}/roles/reviewer.md and follow it exactly.\nrun_dir=${runDir}\nassembled_path=${assembled}`, opt('reviewer', { label: 'reviewer', phase: 'Review', schema: REVIEW }))
  let r = await reviewer()
  reviews.push(r)
  if (r && !r.ok && (r.gaps || []).length) {
    const rebuilds = r.gaps.filter(g => g.fix === 'rebuild' && pieces.find(p => p.id === g.piece))
    const smooths = r.gaps.filter(g => g.fix === 'smooth')
    await parallel(rebuilds.map(g => () => { const p = pieces.find(x => x.id === g.piece); return loopPiece(p, { startIter: summary[p.id].iter, maxIter: caps.reviewFixCap, seedGap: g.note, prevPath: latest[p.id] }) }))
    if (smooths.length) {
      const sm = await agent(`Read ${skillDir}/roles/smoother.md and follow it exactly.\nrun_dir=${runDir}\nassembled_path=${assembled}\nsmoothed_path=${runDir}/assembled/smoothed\nSeam issues:\n${smooths.map(g => `- ${g.piece}: ${g.note}`).join('\n')}`, opt('builder', { label: 'smoother', phase: 'Review', schema: PATH }))
      if (sm && sm.path) assembled = sm.path
    }
    if (A.assembleInstructions && rebuilds.length) {
      const as2 = await agent(`${ctx}\nRe-assemble the final artifact from ${JSON.stringify(latest)}. Instructions: ${A.assembleInstructions}. Write under ${runDir}/assembled/ and return {path}.`, opt('lead', { label: 'reassemble', phase: 'Review', schema: PATH }))
      if (as2 && as2.path) assembled = as2.path
    }
    r = await reviewer()
    reviews.push(r)
  }
}

await agent(`${ctx}\nWrite ${runDir}/SUMMARY.md: a table of pieces (id, status, iterations, last gap, path) from ${JSON.stringify(summary)}, the Reviewer verdicts ${JSON.stringify(reviews)}, assembled path ${assembled}, total iterations ${totalIters} of ${caps.total}, tier ${tier}. Then append {"t":"<ISO>","event":"stop","reason":"done"} to ${runDir}/log.jsonl and run python ${runDir}/render_progress.py. Return done.`, opt('scribe', { label: 'summary', phase: 'Review' }))

return { summary, reviews, assembled, totalIters, tier }
