/* SAGE interactive pipeline.
   The overview is the poster's system-detail graph, rebuilt from its Penpot geometry (poster units, 72 dpi),
   with tokens flowing between the stages. Clicking a stage zooms in and plays a detail animation.
   On narrow screens the four stages stack and the connectors wrap across the right/left edge. */
(() => {
const NS = 'http://www.w3.org/2000/svg', $ = s => document.querySelector(s);
const E = (p, tag, a = {}, txt) => { const e = document.createElementNS(NS, tag); for (const k in a) if (a[k] != null) e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; if (p) p.appendChild(e); return e; };
const C = { blue: '#2b6cb0', navy: '#1f2a44', ink: '#1d1d1f', cmb: '#b03a48', bld: '#9a6a2f', oth: '#1f8a70', syn: '#b8860b', head: '#e8f0f9', note: '#555555', drop: '#8a8a8a', state: '#5e7391', peek: '#9a9a9a', tl: '#9aa5b8', hl: '#cfe0f5', ei: '#237a49', es: '#7b4fb0', A: '#A2561A', E: '#1A6B60', P: '#7E600A', S: '#11708F' };
const PH = 'Philosopher, serif', AS = '"Alegreya Sans", sans-serif', JB = '"JetBrains Mono", monospace';
const clamp = v => Math.max(0, Math.min(1, v)), ease = t => t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
// 0 before a, fades in over fi, 1 until b, fades out over fo
const env = (t, a, b, fi = .2, fo = .3) => t < a || t > b + fo ? 0 : t < a + fi ? (t - a) / fi : t <= b ? 1 : 1 - (t - b) / fo;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- drawing primitives (all coordinates in poster units) ---------- */
function marker(svg, col) {
  if (!svg._uid) svg._uid = ++marker.n; const id = `pa${svg._uid}-${col.slice(1)}`; let defs = svg.querySelector('defs') || E(svg, 'defs');
  if (!svg.querySelector('#' + id)) { const m = E(defs, 'marker', { id, viewBox: '0 0 10 10', refX: 6, refY: 5, markerWidth: 3.4, markerHeight: 3.4, orient: 'auto' }); E(m, 'path', { d: 'M0,0 L10,5 L0,10 z', fill: col }); }
  return `url(#${id})`;
}
marker.n = 0;
const rect = (g, x, y, w, h, o = {}) => E(g, 'rect', { x, y, width: w, height: h, rx: o.rx, fill: o.fill || 'none', 'fill-opacity': o.fo, stroke: o.st, 'stroke-width': o.sw, 'stroke-dasharray': o.dash });
const ell = (g, x, y, w, h, o = {}) => E(g, 'ellipse', { cx: x + w / 2, cy: y + h / 2, rx: w / 2, ry: h / 2, fill: o.fill || 'none', stroke: o.st, 'stroke-width': o.sw });
function line(g, svg, pts, o = {}) {
  return E(g, 'path', { d: 'M' + pts.map(p => p.join(',')).join('L'), fill: 'none', stroke: o.st, 'stroke-width': o.sw, 'stroke-dasharray': o.dash ? `${o.sw * 2.4} ${o.sw * 2.4}` : null,
    'stroke-linecap': o.round ? 'round' : 'butt', 'stroke-linejoin': 'round', 'marker-end': o.arrow ? marker(svg, o.st) : null });
}
// Penpot text boxes: top-left + size; we centre vertically on the box
function text(g, x, y, w, h, s, o = {}) {
  const anchor = o.al || 'middle', tx = anchor === 'middle' ? x + w / 2 : anchor === 'end' ? x + w : x, lines = String(s).split('\n'), lh = (o.fs || 16) * (o.lh || 1.15);
  const t = E(g, 'text', { x: tx, y: y + h / 2 - (lines.length - 1) * lh / 2, 'text-anchor': anchor, 'dominant-baseline': 'central', 'font-family': o.ff || AS, 'font-size': o.fs || 16,
    'font-weight': o.fw || 400, 'font-style': o.it ? 'italic' : null, fill: o.fill || C.ink });
  if (lines.length === 1) t.textContent = s; else lines.forEach((l, i) => E(t, 'tspan', { x: tx, dy: i ? lh : 0 }, l));
  return t;
}
// glyphs centred on (0,0)
function glyph(kind, s, p) {
  const g = E(p || null, 'g');
  if (kind === 'event') E(g, 'circle', { r: s / 2, fill: C.cmb });
  else if (kind === 'square') E(g, 'rect', { x: -s / 2, y: -s / 2, width: s, height: s, fill: C.bld });
  else if (kind === 'tri') E(g, 'path', { d: `M0,${-.45 * s}L${s / 2},${.45 * s}L${-s / 2},${.45 * s}Z`, fill: C.oth });
  else if (kind === 'star') { let d = ''; for (let i = 0; i < 10; i++) { const r = i % 2 ? s * .2 : s * .5, a = -Math.PI / 2 + i * Math.PI / 5; d += (i ? 'L' : 'M') + (r * Math.cos(a)).toFixed(2) + ',' + (r * Math.sin(a) + s * .04).toFixed(2); } E(g, 'path', { d: d + 'Z', fill: C.syn }); }
  else if (kind === 'estar') { E(g, 'circle', { r: s / 2, fill: '#fff', stroke: C.ei, 'stroke-width': 2.5 }); g.appendChild(glyph('star', s * .7, null)); }
  else if (kind === 'cluster' || kind === 'ghost') {
    E(g, 'circle', { r: s / 2, fill: '#fff', stroke: C.cmb, 'stroke-width': 2.5, 'stroke-dasharray': kind === 'ghost' ? '4 3' : null });
    [[.175, .225], [.566, .225], [.369, .594]].forEach(([a, b]) => E(g, 'circle', { cx: (a + .13) * s - s / 2, cy: (b + .13) * s - s / 2, r: .13 * s, fill: C.cmb }));
  } else if (kind === 'dropped' || kind === 'rejsq') {
    if (kind === 'dropped') E(g, 'circle', { r: s / 2, fill: '#fff', stroke: C.drop, 'stroke-width': 2.5 }); else E(g, 'rect', { x: -s / 2, y: -s / 2, width: s, height: s, fill: '#fff', stroke: C.drop, 'stroke-width': 2.5 });
    const k = kind === 'dropped' ? s * .35 : s / 2; E(g, 'path', { d: `M${-k},${-k}L${k},${k}M${k},${-k}L${-k},${k}`, stroke: C.drop, 'stroke-width': 2.5, 'stroke-linecap': 'round' });
  } else if (kind === 'doc' || kind === 'readable') {
    E(g, 'rect', { x: -s / 2, y: -s * .3, width: s, height: s * .6, rx: 3, fill: '#fff', stroke: C.ink, 'stroke-width': 2 });
    E(g, 'text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': JB, 'font-weight': 700, 'font-size': s * .3, fill: C.ink }, kind === 'doc' ? '{…}' : '«…»');
  } else if (kind === 'prompt') {
    E(g, 'rect', { x: -s / 2, y: -s * .22, width: s, height: s * .44, rx: s * .22, fill: '#d2d4da', stroke: C.navy, 'stroke-width': 1.9 });
    E(g, 'text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': AS, 'font-weight': 700, 'font-size': s * .3, fill: C.navy }, '✎');
  } else if (kind === 'ei' || kind === 'es') E(g, 'circle', { r: s / 2, fill: C[kind], stroke: '#fff', 'stroke-width': 2 });
  return g;
}
const place = (g, x, y, sc = 1) => g.setAttribute('transform', `translate(${x},${y}) scale(${sc})`);
const glyphAt = (p, kind, cx, cy, s) => { const g = glyph(kind, s, p); place(g, cx, cy); return g; };
function stack(g, x, y, w, h, label) {
  rect(g, x + 12, y + 12, w, h, { fill: C.head, st: C.blue, sw: 1.5 }); rect(g, x + 6, y + 6, w, h, { fill: C.head, st: C.blue, sw: 1.5 });
  rect(g, x, y, w, h, { fill: '#fff', st: C.blue, sw: 3 }); text(g, x + 4, y + 8, w - 8, 26.2, label, { ff: PH, fs: 20, fw: 700, fill: C.navy });
}
function docBox(g, x, y, w, h, s, hlFill) {
  rect(g, x, y, w, h, { rx: 3, fill: '#fff', st: C.ink, sw: 2 });
  const hl = hlFill ? rect(g, x + 1, y + 1, w - 2, h - 2, { rx: 2, fill: hlFill }) : null; if (hl) hl.setAttribute('opacity', 0);
  text(g, x, y + (h - 20.9) / 2, w, 20.9, s, { ff: JB, fs: 16, fw: 700 }); return hl;
}
function db(g, x, y, w, label, fs = 17) {
  const h = w * .44, t = w * .19;
  rect(g, x, y + t / 2, w, h, { fill: '#fff', st: C.ink, sw: 2 }); ell(g, x, y + h, w, t, { fill: '#fff', st: C.ink, sw: 2 });
  rect(g, x + 2, y + h - 2, w - 4, t * .58, { fill: '#fff' }); ell(g, x, y, w, t, { fill: '#efefef', st: C.ink, sw: 2 });
  text(g, x, y + t, w, h, label, { fs, it: true, lh: 1.1 });
}

/* ---------- stages ---------- */
const STG = [
  { id: 'sa', x0: 680, w: 490, name: 'Signal Analysis', sub: 'cluster & filter', bottom: 1615 },
  { id: 'di', x0: 1190, w: 460, name: 'Data Interpretation', sub: 'enrich (A-E-P+S)', bottom: 1712 },
  { id: 'dp', x0: 1662, w: 284, name: 'Document Planning', sub: 'buffer & order', bottom: 1712 },
  { id: 'sr', x0: 1960, w: 364, name: 'Surface Realization', sub: 'LLM', bottom: 1655 },
];
const LANES = { ei: { name: 'Expert Insights', hooks: { di: 'strategy detector', sr: 'wiki facts, causal explanations' } },
                es: { name: 'Event Structuring', hooks: { dp: 'grouped parallel events', sr: 'information asymmetry' } } };
// desktop lane pills (poster geometry)
const PILL = { 'ei.di': [1202, 438], 'ei.sr': [1970, 344], 'es.dp': [1672, 260], 'es.sr': [1970, 344] };
const LANE_Y = { ei: 1718, es: 1782 };
const laneOn = { ei: true, es: true };

// connectors that cross stages: one polyline on desktop, wrapped pieces on mobile ('R'/'L' = past the right/left edge)
const X = {
  cf_en: { st: C.navy, sw: 3, arrow: 1, desk: [[927, 1542], [1260, 1542], [1260, 1513]], mob: [['sa', [[927, 1542], ['R', 1542]]], ['di', [['L', 1542], [1260, 1542], [1260, 1513]]]] },
  pt_en: { st: C.oth, sw: 3, arrow: 1, desk: [[1089, 1510], [1089, 1564], [1300, 1564], [1300, 1513]], mob: [['sa', [[1089, 1510], [1089, 1564], ['R', 1564]]], ['di', [['L', 1564], [1300, 1564], [1300, 1513]]]] },
  peek: { st: C.es, sw: 2.5, dash: 1, arrow: 1, lane: 'es', desk: [[740, 1510], [740, 1695], [1720, 1695], [1720, 1513]], mob: [['sa', [[740, 1510], [740, 1600], ['R', 1600]]], ['di', [['L', 1700], ['R', 1700]]], ['dp', [['L', 1700], [1720, 1700], [1720, 1513]]]] },
  en_pl: { st: C.navy, sw: 3, arrow: 1, desk: [[1298, 1350], [1298, 1322], [1647, 1322], [1647, 1402], [1670, 1402]], mob: [['di', [[1298, 1350], [1298, 1322], ['R', 1322]]], ['dp', [['L', 1322], [1647, 1322], [1647, 1402], [1670, 1402]]]] },
  sy_pl: { st: C.navy, sw: 3, arrow: 1, desk: [[1632, 1454], [1670, 1454]], mob: [['di', [[1632, 1454], ['R', 1454]]], ['dp', [['L', 1454], [1670, 1454]]]] },
  st_en: { st: C.state, sw: 2, dash: 1, arrow: 1, desk: [[1510, 1640], [1340, 1640], [1340, 1513]], mob: [['di', [[1510, 1640], [1340, 1640], [1340, 1513]]]] },
  st_sy: { st: C.state, sw: 2, dash: 1, arrow: 1, desk: [[1575, 1595], [1575, 1513]], mob: [['di', [[1575, 1595], [1575, 1513]]]] },
  st_pl: { st: C.state, sw: 2, dash: 1, arrow: 1, desk: [[1640, 1640], [1840, 1640], [1840, 1513]], mob: [['di', [[1640, 1640], ['R', 1640]]], ['dp', [['L', 1640], [1840, 1640], [1840, 1513]]]] },
  st_pp: { st: C.state, sw: 2, dash: 1, arrow: 1, desk: [[1840, 1640], [2053, 1640], [2053, 1513]], mob: [['dp', [[1840, 1640], ['R', 1640]]], ['sr', [['L', 1640], [2053, 1640], [2053, 1513]]]] },
  pl_re: { st: C.navy, sw: 3, arrow: 1, desk: [[1932, 1425], [1968, 1425]], mob: [['dp', [[1932, 1425], ['R', 1425]]], ['sr', [['L', 1425], [1968, 1425]]]] },
};

function makeLayout(mobile) {
  if (!mobile) return { mobile, vb: [670, 1245, 1664, 601], off: { sa: [0, 0], di: [0, 0], dp: [0, 0], sr: [0, 0] }, pillY: {} };
  const W = 550, off = {}, pillY = {}; let y = 6;
  for (const s of STG) {
    off[s.id] = [(W - s.w) / 2 - s.x0, y - 1250]; y += s.bottom - 1250;
    Object.keys(LANES).forEach(k => { if (LANES[k].hooks[s.id]) { pillY[k + '.' + s.id] = y + 8; y += 48; } });
    y += 40;
  }
  return { mobile, W, vb: [0, 0, W, y - 30], off, pillY };
}
const mapPt = (L, sid, [x, y]) => {
  const [dx, dy] = L.off[sid];
  return [x === 'R' ? L.vb[0] + L.vb[2] + 40 : x === 'L' ? L.vb[0] - 40 : x + dx, y + dy];
};
// pieces: [[stageId, pts]] in poster coords → runs in layout coords
const runs = (L, pieces) => pieces.map(([sid, pts]) => pts.map(p => mapPt(L, sid, p)));
const conn = (L, key) => L.mobile ? runs(L, X[key].mob) : [X[key].desk.slice()];
function measure(rs) {
  const segs = []; let tot = 0;
  rs.forEach(r => { for (let i = 1; i < r.length; i++) { const l = Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]); segs.push([r[i - 1], r[i], tot, l]); tot += l; } });
  return { segs, tot };
}
function along(m, f) {
  const d = f * m.tot; for (const [a, b, s0, l] of m.segs) if (d <= s0 + l || l === 0) { const k = l ? (d - s0) / l : 0; return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; }
  const last = m.segs[m.segs.length - 1]; return last ? last[1] : [0, 0];
}

/* ---------- overview: the poster graph ---------- */
function buildOverview(L) {
  const svg = E(null, 'svg', { viewBox: L.vb.join(' '), class: 'pipe-svg', role: 'img', 'aria-label': 'Animated SAGE pipeline: game events are copied from the event stream through Signal Analysis, Data Interpretation, Document Planning and Surface Realization into a text summary of recent events.' });
  E(svg, 'defs');
  const root = E(svg, 'g'), wires = E(root, 'g'), G = {}, still = [], ov = [], toks = [], grows = [];
  const P = (sid, x, y) => mapPt(L, sid, [x, y]);
  STG.forEach(s => { G[s.id] = E(root, 'g', { class: 'stg', 'data-stage': s.id, transform: `translate(${L.off[s.id][0]},${L.off[s.id][1]})` }); });
  const sa = G.sa, di = G.di, dp = G.dp, sr = G.sr, T = 16;
  const head = (g, s) => { const r = rect(g, s.x0, 1255, s.w, 40, { rx: 6, fill: C.head }); r.classList.add('hd'); text(g, s.x0, 1261, s.w, 31.2, s.name, { ff: PH, fs: 24, fw: 700, fill: C.blue }); };
  STG.forEach(s => head(G[s.id], s));
  // overlay helper: element whose opacity follows time windows
  const O = (el, wins, lane) => { el.setAttribute('opacity', 0); ov.push({ el, wins, lane }); return el; };

  // Signal Analysis
  text(sa, 692, 1302, 474, 20.9, 'event stream from the game (damage, death, entity lifecycle, upgrades)', { al: 'start', it: 1, fill: C.note });
  line(sa, svg, [[692, 1340], [1166, 1340]], { st: C.navy, sw: 2.5, arrow: 1 });
  [[708, 'event'], [734, 'event'], [808, 'event'], [846, 'square'], [965, 'square'], [1008, 'tri'], [1045, 'event'], [1130, 'event']].forEach(([x, k]) => still.push(glyphAt(sa, k, x, 1340, 18)));
  [[765, C.cmb, 'event', 797], [927, C.bld, 'square', 959], [1089, C.oth, 'tri', 1121]].forEach(([x, col, k, gx]) => {
    E(sa, 'path', { d: `M${x},1332L${x + 8},1340L${x},1348L${x - 8},1340Z`, fill: C.navy });
    line(sa, svg, [[x, 1350], [x, 1388]], { st: col, sw: 2.5, dash: 1, arrow: 1 });
    text(sa, x + 8, 1352, 20, 26.2, '∈', { fs: 20, fw: 700, fill: col, al: 'start' }); glyphAt(sa, k, gx, 1366, 12);
  });
  [[717.7, 1354.5], [879.7, 1356.4], [1042.7, 1356.4]].forEach(([x, y]) => text(sa, x, y, 42, 20.9, 'copies', { it: 1, fill: C.note, al: 'start' }));
  const boxCl = rect(sa, 690, 1390, 150, 120, { fill: '#fff', st: C.blue, sw: 3 }); text(sa, 690, 1396, 150, 26.2, 'Cluster', { ff: PH, fs: 20, fw: 700, fill: C.navy });
  rect(sa, 852, 1390, 150, 120, { fill: '#fff', st: C.blue, sw: 3 }); text(sa, 852, 1396, 150, 26.2, 'Property Filter', { ff: PH, fs: 20, fw: 700, fill: C.navy });
  rect(sa, 1014, 1390, 150, 120, { fill: '#fff', st: C.blue, sw: 3 }); text(sa, 1014, 1396, 150, 26.2, 'Passthrough', { ff: PH, fs: 20, fw: 700, fill: C.navy }); text(sa, 1104, 1446, 56, 20.9, 'by type', { it: 1, fill: C.note, al: 'start' });
  glyphAt(sa, 'event', 710, 1442, 14); glyphAt(sa, 'event', 728, 1442, 14); line(sa, svg, [[740, 1442], [772, 1442]], { st: C.ink, sw: 2, arrow: 1 });
  glyphAt(sa, 'dropped', 786, 1442, 18); text(sa, 798, 1432, 42, 20.9, 'noise', { it: 1, fill: C.note, al: 'start' });
  const clGlow = O(E(sa, 'g'), [[3.0, 3.9]]); [735, 795].forEach(x => E(clGlow, 'circle', { cx: x, cy: 1482, r: 22, fill: C.cmb, opacity: .18 }));
  glyphAt(sa, 'cluster', 735, 1482, 32); glyphAt(sa, 'cluster', 795, 1482, 32);
  [885, 917, 949].forEach(x => glyphAt(sa, 'rejsq', x, 1440, 18));
  line(sa, svg, [[864, 1458], [990, 1458]], { st: C.drop, sw: 1.5, dash: 1, round: 1 });
  text(sa, 852, 1462, 150, 20.9, 'Castle · TC · Tower', { it: 1, fill: C.note }); glyphAt(sa, 'square', 927, 1496, 14);
  line(sa, svg, [[1089, 1422], [1089, 1502]], { st: C.oth, sw: 2, dash: 1, arrow: 1 }); glyphAt(sa, 'tri', 1089, 1457, 22);
  line(sa, svg, [[927, 1510], [927, 1542]], { st: C.bld, sw: 3, round: 1 });
  line(sa, svg, [[765, 1510], [765, 1542], [927, 1542]], { st: C.cmb, sw: 3, round: 1 });

  // Data Interpretation
  stack(di, 1202, 1350, 190, 150, 'Context Enrichment');
  glyphAt(di, 'square', 1232, 1424, 16); glyphAt(di, 'tri', 1256, 1420.1, 18); glyphAt(di, 'cluster', 1246, 1442, 30); line(di, svg, [[1264, 1442], [1290, 1442]], { st: C.ink, sw: 2, arrow: 1 });
  const docEn = docBox(di, 1296, 1422, 76, 40, '{…}', C.hl); text(di, 1202, 1468, 190, 20.9, 'transforms', { it: 1, fill: C.note });
  stack(di, 1430, 1350, 190, 150, 'Event Synthesis');
  E(di, 'circle', { cx: 1464, cy: 1441, r: 11, fill: '#fff', stroke: C.navy, 'stroke-width': 2.5 }); E(di, 'path', { d: 'M1464,1434V1441L1469,1444', fill: 'none', stroke: C.navy, 'stroke-width': 2.5, 'stroke-linecap': 'round' });
  line(di, svg, [[1480, 1442], [1502, 1442]], { st: C.ink, sw: 2, arrow: 1 });
  const starGlow = O(E(di, 'circle', { cx: 1522, cy: 1441, r: 20, fill: C.syn, opacity: .25 }), [[7.8, 8.4]]);
  glyphAt(di, 'star', 1522, 1441, 25); const docSy = docBox(di, 1540, 1422, 70, 40, '{…}', C.hl); text(di, 1430, 1468, 190, 20.9, 'injects time anchors', { it: 1, fill: C.note });
  db(di, 1510, 1595, 130, 'game state\nsnapshots');
  const strat = E(di, 'g'); glyphAt(strat, 'estar', 1610, 1540, 26); text(strat, 1580, 1554, 60, 20.9, 'strategy', { it: 1, fs: 15, fw: 700, fill: C.ei });

  // Document Planning
  stack(dp, 1672, 1350, 248, 150, 'Content Collector');
  const slot = {}; [[1696, 1386], [1802, 1386], [1696, 1422], [1802, 1422], [1696, 1458], [1802, 1458]].forEach(([x, y], i) => { slot[i] = docBox(dp, x, y, 90, 30, '{…}', C.hl); });
  const bracket = O(rect(dp, 1688, 1379, 212, 80, { rx: 8, st: C.es, sw: 3.5 }), [[10.6, 11.2]], 'es');

  // Surface Realization
  stack(sr, 1970, 1350, 166, 150, 'Pre-Processor');
  const rd = [[1984, 1386], [2058, 1386], [1984, 1422], [2058, 1422]].map(([x, y]) => docBox(sr, x, y, 66, 30, '«…»', C.hl));
  rect(sr, 1984, 1460, 140, 28, { rx: 14, fill: C.navy, fo: .2, st: C.navy, sw: 1.9 });
  const chipGlow = O(rect(sr, 1984, 1460, 140, 28, { rx: 14, fill: C.navy, fo: .35, st: C.blue, sw: 3 }), [[13.0, 13.5]]);
  text(sr, 1984, 1463, 140, 20.9, '✎ LLM prompt', { fw: 700, fill: C.navy });
  rect(sr, 2182, 1350, 142, 150, { fill: C.head, st: C.blue, sw: 3 }); text(sr, 2186, 1358, 134, 26.2, 'Text', { ff: PH, fs: 20, fw: 700, fill: C.navy });
  text(sr, 2190, 1384, 20, 39.1, '“', { ff: PH, fs: 30, fw: 700, fill: C.blue });
  [[1398, 100], [1416, 104], [1434, 100], [1452, 62]].forEach(([y, w], i) => {
    const r = rect(sr, 2212, y, w, 8, { rx: 4, fill: C.tl }); grows.push({ el: r, w, a: 13.95 + i * .4, b: 15.7 });
  });
  text(sr, 2182, 1510, 142, 41.8, 'summary of\nrecent events', { it: 1, fill: C.note });
  O(text(sr, 2182, 1510, 142, 41.8, 'summary of\nrecent events', { it: 1, fw: 700, fill: C.blue }), [[15.4, 15.9]]);

  // modules change what a step does: its border takes the module colour (both on: hard split)
  const gid = 'modg' + (++marker.n), lg = E(svg.querySelector('defs'), 'linearGradient', { id: gid, x1: 0, y1: 0, x2: 1, y2: 0 });
  [[0, C.ei], [.5, C.ei], [.5, C.es], [1, C.es]].forEach(([o, c]) => E(lg, 'stop', { offset: o, 'stop-color': c }));
  const modB = [[di, 1202, ['ei']], [di, 1430, ['ei']], [dp, 1672, ['es'], 248], [sr, 1970, ['ei', 'es'], 166]].map(([g, x, mods, w = 190]) => ({ el: rect(g, x, 1350, w, 150, { sw: 6 }), mods }));

  // cross-stage wires and the state-query overlays
  const stateOv = {}, laneW = {};  // laneW: wires that exist only with a module on (peek: Event Structuring)
  for (const k in X) {
    const x = X[k], rs = conn(L, k);
    const wg = x.lane ? (laneW[x.lane] = E(wires, 'g')) : wires;
    rs.forEach((pts, i) => line(wg, svg, pts, { st: x.st, sw: x.sw, dash: x.dash, arrow: x.arrow && i === rs.length - 1 }));
    if (k.startsWith('st_')) stateOv[k] = rs.map((pts, i) => line(wires, svg, pts, { st: C.blue, sw: 3.2, dash: 1, arrow: i === rs.length - 1 }));
  }
  if (!L.mobile) text(laneW.es, 800, 1670, 400, 20.9, 'peek at buffered / open clusters for parallel reporting', { it: 1, fill: C.es, al: 'start' });
  else { const [x, y] = P('sa', 752, 1578); text(laneW.es, x, y, 300, 20.9, 'peek at open clusters', { it: 1, fill: C.es, al: 'start' }); }
  // tokens on the wires when the animation is not running
  [['cluster', 'sa', 836, 1542, 22], ['square', 'sa', 1040, 1542, 16], ['tri', 'sa', L.mobile ? 1130 : 1190, 1564, 18]].forEach(([k, sid, x, y, s]) => { const [a, b] = P(sid, x, y); still.push(glyphAt(wires, k, a, b, s)); });
  [['st_en', 5.5, 6.3], ['st_en', 7.1, 7.9], ['st_sy', 7.4, 8.1], ['st_pl', 9.6, 10.4], ['st_pp', 11.9, 12.6]].forEach(([k, a, b]) => stateOv[k].forEach(el => (el._w = el._w || []).push([a, b])));
  Object.values(stateOv).flat().forEach(el => O(el, el._w || []));
  conn(L, 'st_sy').forEach((pts, i, rs) => O(line(wires, svg, pts, { st: C.ei, sw: 3.2, dash: 1, arrow: i === rs.length - 1 }), [[8.8, 9.5]], 'ei'));

  // lanes
  const laneG = {};
  for (const k in LANES) {
    const g = laneG[k] = E(root, 'g', { class: 'lane' }), col = C[k];
    if (!L.mobile) {
      rect(g, 680, LANE_Y[k], 1644, 54, { rx: 27, fill: col, fo: .08, st: col, sw: 2 }); text(g, 704, LANE_Y[k] + 11, 420, 33.8, LANES[k].name, { ff: PH, fs: 26, fw: 700, fill: col, al: 'start' });
      for (const sid in LANES[k].hooks) { const [x, w] = PILL[k + '.' + sid]; rect(g, x, LANE_Y[k] + 8, w, 38, { rx: 19, fill: col }); text(g, x, LANE_Y[k] + 16, w, 23.5, LANES[k].hooks[sid], { fs: 18, fw: 700, fill: '#fff' }); }
    } else for (const sid in LANES[k].hooks) {
      const y = L.pillY[k + '.' + sid]; rect(g, 20, y, L.W - 40, 38, { rx: 19, fill: col });
      text(g, 20, y + 8, L.W - 40, 23.5, `${LANES[k].name}: ${LANES[k].hooks[sid]}`, { fs: 18, fw: 700, fill: '#fff' });
    }
  }

  /* tokens: kind, size, start, legs [[runs, seconds]] */
  const lay = (sid, pts) => [pts.map(p => mapPt(L, sid, p))];
  const tok = (kind, s, t0, legs, o = {}) => { const g = glyph(kind, s, root); g.setAttribute('opacity', 0); toks.push({ g, t0, legs: legs.map(([r, d]) => [measure(r), d]), fo: o.fo ?? .25, op: o.op ?? 1, lane: o.lane, wrap: o.wrap, lin: o.lin }); };
  // the stream loops with period T; every event runs to the end of the arrow, the matching filter takes a copy as it passes
  // half speed, one event every 0.8 s; the three story events are placed so their copies leave the filters on cue (t0 may wrap)
  const V = 60, SX0 = 692, SX1 = 1158, KIND = { E: 'event', S: 'square', T: 'tri' }, BR = { E: 765, S: 927, T: 1089 };
  const SEQ = [...'SEETESEEETESEETEETSE'].map((c, k) => [c, k * .8]), story = {};
  SEQ[0][1] = 3.96 - (BR.S - SX0) / V; SEQ[17][1] = 4.11 - (BR.T - SX0) / V; SEQ[18][1] = 2.36 - (BR.S - SX0) / V;
  SEQ.forEach(([c, t0], i) => {
    const tb = t0 + (BR[c] - SX0) / V, bx = BR[c];
    tok(KIND[c], 16, t0, [[lay('sa', [[SX0, 1340], [SX1, 1340]]), (SX1 - SX0) / V]], { fo: .3, wrap: 1, lin: 1 });
    story[i] = tb; if (![0, 17, 18].includes(i)) tok(KIND[c], 16, tb, [[lay('sa', [[bx, 1340], [bx, 1420]]), .9]], { fo: .3, wrap: 1 });
  });
  // copies that the story follows: a building passes the filter, one is rejected, an upgrade passes through
  tok('square', 16, story[18], [[lay('sa', [[927, 1340], [927, 1404]]), .4], [lay('sa', [[927, 1404], [927, 1510], [927, 1542]]), .75], [conn(L, 'cf_en'), 2.0], [lay('di', [[1260, 1513], [1240, 1440]]), .3]]);
  tok('square', 16, story[0], [[lay('sa', [[927, 1340], [927, 1420]]), .4]], { fo: .1 });
  tok('rejsq', 18, story[0] + .4, [[lay('sa', [[927, 1420], [927, 1420]]), .6]], { fo: .4 });
  tok('tri', 18, story[17], [[lay('sa', [[1089, 1340], [1089, 1404]]), .4], [lay('sa', [[1089, 1404], [1089, 1510]]), .6], [conn(L, 'pt_en'), 1.6], [lay('di', [[1300, 1513], [1262, 1432]]), .3]]);
  tok('cluster', 28, 4.0, [[lay('sa', [[765, 1460], [765, 1510]]), .3], [lay('sa', [[765, 1510], [765, 1542], [927, 1542]]), .7], [conn(L, 'cf_en'), 2.0], [lay('di', [[1260, 1513], [1250, 1452]]), .3]]);
  tok('ghost', 24, 6.0, [[conn(L, 'peek'), 3.2]], { op: .75, lane: 'es' });
  tok('doc', 46, 6.3, [[lay('di', [[1334, 1442], [1298, 1380], [1298, 1350]]), .4], [conn(L, 'en_pl'), 1.6], [lay('dp', [[1670, 1402], [1741, 1401]]), .3]], { fo: .15 });
  tok('doc', 46, 7.9, [[lay('di', [[1334, 1442], [1298, 1380], [1298, 1350]]), .4], [conn(L, 'en_pl'), 1.6], [lay('dp', [[1670, 1402], [1847, 1401]]), .3]], { fo: .15 });
  tok('doc', 46, 8.5, [[lay('di', [[1575, 1442], [1632, 1454]]), .25], [conn(L, 'sy_pl'), .4], [lay('dp', [[1670, 1454], [1741, 1437]]), .3]], { fo: .15 });
  // Expert Insights: the strategy detector reads the snapshots and adds a synthetic strategy event
  tok('estar', 26, 9.1, [[lay('di', [[1575, 1520], [1575, 1442]]), .5]], { fo: .2, lane: 'ei' });
  tok('doc', 46, 9.8, [[lay('di', [[1575, 1442], [1632, 1454]]), .25], [conn(L, 'sy_pl'), .4], [lay('dp', [[1670, 1454], [1741, 1473]]), .3]], { fo: .15, lane: 'ei' });
  tok('doc', 58, 11.2, [[lay('dp', [[1796, 1440], [1932, 1425]]), .3], [conn(L, 'pl_re'), .35], [lay('sr', [[1968, 1425], [2017, 1401]]), .25]], { fo: .15 });
  tok('prompt', 50, 13.4, [[lay('sr', [[2054, 1474], [2148, 1425]]), .3], [lay('sr', [[2148, 1425], [2200, 1425]]), .25]], { fo: .15 });

  // highlights
  O(docEn, [[6.0, 6.5], [7.6, 8.1]]); O(docSy, [[8.2, 8.6]]); const docSy2 = docSy.cloneNode(); docSy.after(docSy2); O(docSy2, [[9.5, 9.9]], 'ei');
  O(slot[4], [[10.45, 11.2]], 'ei'); O(slot[0], [[8.6, 11.2]]); O(slot[1], [[10.2, 11.2]]); O(slot[2], [[9.45, 11.2]]); O(slot[3], [[9.2, 11.2]], 'es');
  slot[3].setAttribute('fill', '#efe0e2');
  rd.forEach((el, i) => O(el, [[12.1 + i * .2, 14.2]]));
  const boxGlow = O(rect(sa, 690, 1390, 150, 120, { st: C.cmb, sw: 5 }), [[3.0, 3.9]]);
  void boxCl; void starGlow; void bracket; void chipGlow; void boxGlow;

  // hit areas
  STG.forEach(s => {
    const g = G[s.id], hit = rect(g, s.x0 - 6, 1250, s.w + 12, s.bottom - 1250 - (L.mobile ? 0 : 100), { fill: 'transparent' });
    hit.classList.add('hit'); g.setAttribute('tabindex', 0); g.setAttribute('role', 'button'); g.setAttribute('aria-label', `${s.name}: show details`);
  });

  function update(t, animating) {
    still.forEach(g => g.setAttribute('opacity', animating ? 0 : 1));
    for (const o of ov) o.el.setAttribute('opacity', !animating || (o.lane && !laneOn[o.lane]) ? 0 : Math.max(0, ...o.wins.map(([a, b]) => env(t, a, b))));
    for (const k in laneG) laneG[k].classList.toggle('on', laneOn[k]);
    for (const k in laneW) laneW[k].setAttribute('opacity', laneOn[k] ? 1 : 0);
    for (const b of modB) { const on = b.mods.filter(k => laneOn[k]); b.el.setAttribute('stroke', on.length > 1 ? `url(#${gid})` : on.length ? C[on[0]] : 'none'); }
    strat.setAttribute('opacity', laneOn.ei ? 1 : 0);
    for (const q of toks) {
      let e = q.wrap ? ((t - q.t0) % T + T) % T : t - q.t0, pos = null, total = q.legs.reduce((s, l) => s + l[1], 0), op = 1;
      if (!animating || (q.lane && !laneOn[q.lane]) || e < 0 || e > total + q.fo) { q.g.setAttribute('opacity', 0); continue; }
      if (e >= total) { pos = along(q.legs[q.legs.length - 1][0], 1); op = 1 - (e - total) / q.fo; }
      else for (const [m, d] of q.legs) { if (e <= d) { pos = along(m, q.lin ? e / d : ease(e / d) * .3 + (e / d) * .7); break; } e -= d; }
      op *= clamp((q.wrap ? e : t - q.t0) / .15);
      place(q.g, pos[0], pos[1]); q.g.setAttribute('opacity', (op * q.op).toFixed(3));
    }
    for (const r of grows) { const k = !animating ? 1 : t < r.a ? 0 : clamp((t - r.a) / .45); r.el.setAttribute('width', (r.w * k).toFixed(1)); r.el.setAttribute('opacity', animating ? 1 - clamp((t - r.b) / .3) : 1); }
  }
  return { svg, G, T, update };
}

/* ---------- stage details (each its own 640 × 440 scene) ---------- */
const DETAIL = {};
const card = (g, x, y, w, h, title) => { rect(g, x, y, w, h, { fill: '#fff', st: C.blue, sw: 3 }); if (title) text(g, x, y + 6, w, 26, title, { ff: PH, fs: 20, fw: 700, fill: C.navy }); };
const fadeAll = (t, T) => 1 - clamp((t - (T - .5)) / .5);

DETAIL.sa = {
  T: 9.5, steps: [[0, 'Events stream in from the game engine: damage, death, entity lifecycle, research.'],
    [1.0, 'ST-DBSCAN (Birant & Kut 2007) groups damage and death events that lie within ε = 14 tiles and τ = 60 s of each other, once a neighbourhood holds minPts = 10 events. Stray events are noise.'],
    [2.4, 'Other events do not wait: a property filter keeps constructions such as Castles, Town Centers and Towers, and other events pass through by type, such as research.'],
    [3.4, 'Only battles wait. Events arrive in order, so once a battle has been quiet for τ it is closed and released: it can be reported live.']],
  build(svg) {
    const g = E(svg, 'g');
    text(g, 20, 8, 200, 24, 'game map (top-down)', { it: 1, fs: 17, fill: C.note, al: 'start' });
    const clock = text(g, 250, 8, 100, 24, '16:00', { ff: JB, fs: 17, fw: 700, fill: C.navy, al: 'end' });
    rect(g, 20, 40, 330, 300, { rx: 12, fill: '#eef2e7', st: '#c5cfb8', sw: 1.5 });
    for (let i = 1; i < 10; i++) { E(g, 'path', { d: `M${20 + i * 33},42V338`, stroke: '#dde4d2', 'stroke-width': 1 }); E(g, 'path', { d: `M22,${40 + i * 30}H348`, stroke: '#dde4d2', 'stroke-width': 1 }); }
    card(g, 390, 40, 230, 100, 'Cluster'); card(g, 390, 160, 230, 100, 'Property Filter'); card(g, 390, 280, 230, 100, 'Passthrough'); text(g, 530, 329, 80, 22, 'by type', { fs: 16, it: 1, fill: C.note, al: 'start' });
    const boxes = [[390, 40], [390, 160], [390, 280]].map(([x, y]) => { const r = rect(g, x, y, 230, 100, { st: C.blue, sw: 7 }); r.setAttribute('opacity', 0); return r; });
    [90, 210, 330].forEach(y => line(g, svg, [[354, y], [384, y]], { st: C.navy, sw: 2.5, arrow: 1 }));
    rect(g, 20, 352, 330, 12, { rx: 6, fill: '#e3e6ec' }); const bar = rect(g, 20, 352, 0, 12, { rx: 6, fill: C.cmb });
    text(g, 20, 368, 330, 22, 'quiet for τ = 60 s → release', { fs: 16, it: 1, fill: C.note, al: 'start' });
    text(g, 20, 404, 600, 26, 'ST-DBSCAN  ·  ε = 14 tiles  ·  τ = 60 s  ·  minPts = 10', { ff: JB, fs: 16, fw: 700, fill: C.navy, al: 'start' });
    const A = [130, 165], pts = [[-22, -14], [10, -26], [26, 4], [-6, 8], [-30, 18], [14, 26], [0, -6], [-16, -30], [32, -18], [-2, 30]];
    const circ = E(g, 'circle', { cx: A[0], cy: A[1], r: 50, fill: C.cmb, 'fill-opacity': .06, stroke: C.cmb, 'stroke-width': 2 });
    const eps = text(g, A[0] + 36, A[1] - 66, 150, 22, 'ε = 14 tiles', { fs: 17, fw: 700, fill: C.cmb, al: 'start' });
    const cnt = text(g, A[0] - 70, A[1] + 58, 140, 22, '', { fs: 17, fw: 700, fill: C.cmb });
    const evs = pts.map(() => glyph('event', 13, g));
    const noise = glyph('event', 13, g), noiseX = glyph('dropped', 16, g), noiseT = text(g, 300, 300, 50, 22, 'noise', { it: 1, fs: 16, fill: C.note, al: 'start' });
    const lab = (kind, s, label) => { const k = E(g, 'g'); glyph(kind, s, k); text(k, -50, s / 2 + 2, 100, 22, label, { fs: 16, it: 1, fill: C.note }); return k; };
    const castle = lab('square', 18, 'Castle'), house = lab('square', 18, 'House'), houseX = glyph('rejsq', 18, g), tri = lab('tri', 20, 'research');
    const clus = glyph('cluster', 34, g);
    const at = (el, x, y, op, sc = 1) => { place(el, x, y, sc); el.setAttribute('opacity', op); };
    const mv = (a, b, k) => [a[0] + (b[0] - a[0]) * ease(clamp(k)), a[1] + (b[1] - a[1]) * ease(clamp(k))];
    return t => {
      const f = fadeAll(t, this.T), secs = 16 * 60 + t * 30;
      clock.textContent = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(Math.floor(secs % 60)).padStart(2, '0')}`;
      let n = 0;
      evs.forEach((e, i) => {
        const t0 = .3 + .28 * i; if (t >= t0) n++;
        const p = t < 5.4 ? [A[0] + pts[i][0], A[1] + pts[i][1]] : mv([A[0] + pts[i][0], A[1] + pts[i][1]], A, (t - 5.4) / .6);
        at(e, p[0], p[1], t < t0 ? 0 : t < 6 ? 1 : 0, ease(clamp((t - t0) / .2)));
      });
      circ.setAttribute('opacity', t < 1 || t > 6 ? 0 : clamp((t - 1) / .3) * f); circ.setAttribute('stroke-dasharray', n >= 10 ? 'none' : '6 5'); circ.setAttribute('stroke-width', n >= 10 ? 3 : 2);
      eps.setAttribute('opacity', circ.getAttribute('opacity'));
      cnt.textContent = n >= 10 ? 'battle ✓' : `${n} / minPts 10`; cnt.setAttribute('opacity', t > .3 && t < 6 ? f : 0);
      bar.setAttribute('width', (330 * (t < 3.4 ? 0 : t < 6 ? clamp((t - 3.4) / 2) : 0)).toFixed(1));
      at(noise, 285, 290, t < 1.8 ? 0 : t < 6 ? 1 : 0, ease(clamp((t - 1.8) / .2)));
      at(noiseX, 285, 290, t < 6 ? 0 : f); noiseT.setAttribute('opacity', t < 6 ? 0 : f);
      at(clus, ...(t < 6 ? A : mv(A, [505, 102], (t - 6))), t < 5.7 ? 0 : f, t < 6 ? clamp((t - 5.7) / .3) : 1);
      at(castle, ...mv([275, 85], [505, 100 + 120], (t - 2.6)), t < 2.2 ? 0 : f, ease(clamp((t - 2.2) / .2)));
      at(house, ...mv([75, 285], [560, 220], (t - 3.4) / .8), t < 3.0 ? 0 : t < 4.2 ? f : 0, ease(clamp((t - 3.0) / .2)));
      at(houseX, 560, 220, t < 4.2 ? 0 : f * (t < 5.7 ? 1 : .35));
      at(tri, ...mv([245, 230], [505, 340], (t - 4.4) / .8), t < 4 ? 0 : f, ease(clamp((t - 4) / .2)));
      boxes.forEach((b, i) => b.setAttribute('opacity', env(t, [6, 2.6, 4.4][i], [6.4, 3.0, 4.8][i]) * .5));
    };
  },
};

DETAIL.di = {
  T: 14, steps: [[0, 'Event Synthesis injects events of its own into the event stream: a time anchor at each full minute of the game clock.'],
    [2.0, 'With Expert Insights on, a fuzzy-logic strategy detector reads the game state snapshot at each time anchor and adds a synthetic strategy event, such as Red’s “Scout Rush” (Blue may be going for a “Fast Castle”).'],
    [3.6, 'Context Enrichment takes every event type: battle clusters, filtered constructions and passed-through events. Here: a battle.'],
    [4.6, 'It queries the snapshot current at event time (or an earlier cached one).'],
    [5.4, 'Facts are added as data following A-E-P+S: the Actuator (the event), its Environment (the location, but also other persistent facts about the world, such as researched technologies), Performance (who leads) and Sensors (what each side can see).'],
    [10.0, 'With Expert Insights on, the event is linked to the strategy its player is executing (the strategy event above): here Red’s Scout Rush.']],
  build(svg) {
    const g = E(svg, 'g'), R1 = 64, R2 = 118, OY = 170;
    svg.setAttribute('viewBox', '0 0 640 500');
    // Event Synthesis: time anchors, and (Expert Insights) strategy events derived at each anchor
    text(g, 20, 14, 300, 26, 'Event Synthesis', { ff: PH, fs: 20, fw: 700, fill: C.navy, al: 'start' });
    const clk = E(g, 'g'); E(clk, 'circle', { cx: 34, cy: R1, r: 11, fill: '#fff', stroke: C.navy, 'stroke-width': 2.5 }); E(clk, 'path', { d: `M34,${R1 - 7}V${R1}L39,${R1 + 3}`, fill: 'none', stroke: C.navy, 'stroke-width': 2.5, 'stroke-linecap': 'round' });
    const clkT = text(g, 50, R1 - 12, 120, 24, 'game clock', { fs: 16, it: 1, fill: C.note, al: 'start' });
    const ar = line(g, svg, [[150, R1], [196, R1]], { st: C.ink, sw: 2.5, arrow: 1 });
    const st = glyph('star', 26, g); place(st, 222, R1); const stT = text(g, 242, R1 - 12, 220, 24, 'time anchor · 16:00', { fs: 17, fw: 700, fill: C.syn, al: 'start' });
    const ar2 = line(g, svg, [[420, R1], [462, R1]], { st: C.ink, sw: 2.5, arrow: 1 }); const d2 = glyph('doc', 52, g); place(d2, 500, R1);
    const d2T = text(g, 450, R1 - 42, 100, 20, 'event stream', { fs: 14, it: 1, fill: C.note });
    const ei = E(g, 'g'); db(ei, 20, R2 - 18, 76, 'snapshots', 13); line(ei, svg, [[104, R2], [196, R2]], { st: C.ei, sw: 2.5, dash: 1, arrow: 1 }); text(ei, 104, R2 - 24, 92, 20, 'strategy detector', { fs: 13, fw: 700, fill: C.ei });
    line(ei, svg, [[222, R1 + 15], [222, R2 - 17]], { st: C.syn, sw: 2.5, arrow: 1 });
    glyphAt(ei, 'estar', 222, R2, 28); text(ei, 242, R2 - 12, 220, 24, 'strategy · “Scout Rush” (Red)', { fs: 17, fw: 700, fill: C.ei, al: 'start' });
    line(ei, svg, [[462, R2], [500, R2], [500, R1 + 20]], { st: C.ink, sw: 2.5, arrow: 1 });
    // Context Enrichment
    text(g, 20, OY - 18, 300, 26, 'Context Enrichment', { ff: PH, fs: 20, fw: 700, fill: C.navy, al: 'start' });
    const cl = E(g, 'g'); glyphAt(cl, 'square', 50, 56 + OY, 18); glyphAt(cl, 'tri', 88, 54 + OY, 20); glyphAt(cl, 'cluster', 70, 80 + OY, 40); text(cl, 10, 104 + OY, 120, 22, 'any event type', { fs: 16, it: 1, fill: C.note });
    line(cl, svg, [[98, 80 + OY], [164, 80 + OY]], { st: C.ink, sw: 2.5, arrow: 1 });
    db(g, 20, 222 + OY, 100, 'snapshot\n16:32', 15);
    rect(g, 170, 20 + OY, 450, 300, { rx: 6, fill: '#fff', st: C.ink, sw: 2 });
    const L = [[null, '{ type: "battle", fightType: "raid",', 4.4], ['A', 'actor: 3 Scouts (Red) kill 1 Villager', 5.4], ['E', 'location: (112, 64)', 6.2], ['E', 'techs: Forging (Red)', 6.8],
      ['P', 'villagers: Red 31 · Blue 28', 8.4], ['S', 'visibleTo: Red ✓ · Blue ✓', 9.2], ['EI', 'strategy: Red is executing a Scout Rush', 10.0], [null, '}', 10.8]];
    const col = { A: C.A, E: C.E, P: C.P, S: C.S, EI: C.ei }, rows = [], q = [];
    L.forEach(([tag, s, t0], i) => {
      const y = 52 + OY + i * 34, r = E(g, 'g');
      if (tag) { rect(r, 182, y - 12, 30, 24, { rx: 4, fill: col[tag] }); text(r, 182, y - 12, 30, 24, tag, { fs: 14, fw: 700, fill: '#fff' }); }
      const tx = text(r, tag ? 222 : 186, y - 12, 380, 24, s, { ff: JB, fs: 16, al: 'start' });
      rows.push({ r, t0, lane: tag === 'EI' ? 'ei' : null, tx });
      if (tag && tag !== 'EI') q.push([line(g, svg, [[120, 252 + OY], [146, 252 + OY], [146, y], [178, y]], { st: C.blue, sw: 2.5, dash: 1, arrow: 1 }), t0]);
    });
    // the strategy event feeds the Expert Insights row
    const eiw = line(g, svg, [[500, R2], [630, R2], [630, 52 + OY + 6 * 34], [624, 52 + OY + 6 * 34]], { st: C.ei, sw: 2.5, dash: 1, arrow: 1 });
    return t => {
      const f = fadeAll(t, this.T);
      [[clk, .3], [clkT, .3], [ar, .7], [st, 1.0], [stT, 1.0], [ar2, 1.4], [d2, 1.7], [d2T, 1.7], [cl, 3.6]].forEach(([el, t0]) => el.setAttribute('opacity', clamp((t - t0) / .3) * f));
      ei.setAttribute('opacity', laneOn.ei ? clamp((t - 2.0) / .4) * f : 0);
      rows.forEach(({ r, t0, lane }) => { const k = lane && !laneOn[lane] ? 0 : clamp((t - t0) / .3); r.setAttribute('opacity', k * f); r.setAttribute('transform', `translate(${(1 - k) * -10},0)`); });
      q.forEach(([el, t0]) => el.setAttribute('opacity', env(t, t0 - .5, t0, .2, .3)));
      eiw.setAttribute('opacity', laneOn.ei ? env(t, 9.6, 12.4, .3, .4) : 0);
    };
  },
};

DETAIL.dp = {
  T: 13, steps: [[0, 'The planner opens with two introductions: the players and civilizations, and the map.'],
    [2.6, 'Enriched events are buffered as they arrive.'],
    [5.2, 'With Event Structuring on, it can peek at an open battle cluster to report an ongoing fight.'],
    [6.0, 'When a pending battle’s cooldown expires (or the game ends), the buffer is flushed as one content unit for the realizer.'],
    [7.0, 'With Event Structuring on, the buffer holds at most 180 game seconds or five events, and overlapping events are grouped so the realizer can link causes and effects.']],
  build(svg) {
    const g = E(svg, 'g');
    E(g, 'path', { d: 'M40,404H600', stroke: C.navy, 'stroke-width': 2 });
    ['16:20', '16:25', '16:30', '16:35', '16:40'].forEach((s, i) => { const x = 40 + i * 140; E(g, 'path', { d: `M${x},398V410`, stroke: C.navy, 'stroke-width': 2 }); text(g, x - 30, 412, 60, 22, s, { ff: JB, fs: 14, fill: C.note }); });
    const head = E(g, 'path', { d: 'M0,390V418', stroke: C.blue, 'stroke-width': 3 });
    const marks = [];
    text(g, 150, 118, 200, 26, 'buffer', { ff: PH, fs: 20, fw: 700, fill: C.navy, al: 'start' });
    rect(g, 150, 150, 330, 120, { rx: 10, fill: C.head, fo: .5, st: C.navy, sw: 2, dash: '7 6' });
    rect(g, 150, 290, 330, 10, { rx: 5, fill: '#e3e6ec' }); const bar = rect(g, 150, 290, 330, 10, { rx: 5, fill: C.navy });
    const barT = text(g, 150, 304, 330, 22, '', { fs: 16, it: 1, fill: C.note, al: 'start' });
    line(g, svg, [[540, 210], [612, 210]], { st: C.navy, sw: 3, arrow: 1 }); text(g, 500, 222, 140, 44, 'to Surface\nRealization', { fs: 16, it: 1, fill: C.note });
    const lab = (kind, s, label, glyphK) => { const k = E(g, 'g'); glyph(kind, s, k); if (glyphK) { const q = glyph(glyphK, 12, k); place(q, -s / 2 - 12, 0); } if (label) text(k, -70, s * .3 + 2, 140, 22, label, { fs: 15, it: 1, fill: C.note }); return k; };
    const intro1 = lab('doc', 70, 'players & civs'), intro2 = lab('doc', 70, 'map');
    const dA = lab('doc', 70, 'battle', 'cluster'), dB = lab('doc', 70, 'Castle', 'square'), dC = lab('doc', 70, 'time anchor', 'star'), dD = lab('doc', 70, 'next battle', 'cluster');
    const unit = E(g, 'g'); [[12, 12], [6, 6], [0, 0]].forEach(([o, p], i) => E(unit, 'rect', { x: -50 + o, y: -22 + p, width: 100, height: 44, rx: 4, fill: i < 2 ? C.head : '#fff', stroke: i < 2 ? C.blue : C.ink, 'stroke-width': 2 }));
    E(unit, 'text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': JB, 'font-weight': 700, 'font-size': 18 }, '{…}'); text(unit, -80, 30, 160, 22, 'content unit', { fs: 15, it: 1, fill: C.note });
    const ghost = glyph('ghost', 30, g); place(ghost, 80, 210); const gl = line(g, svg, [[98, 210], [144, 210]], { st: C.es, sw: 2.5, dash: 1, arrow: 1 }); const gT = text(g, 20, 236, 120, 22, 'peek: open battle', { fs: 15, it: 1, fill: C.es });
    const br = rect(g, 166, 166, 222, 54, { rx: 10, st: C.es, sw: 3.5 }); const brT = text(g, 250, 122, 230, 22, 'grouped parallel events', { fs: 16, fw: 700, fill: C.es, al: 'end' });
    const at = (el, p, op) => { place(el, p[0], p[1]); el.setAttribute('opacity', op); };
    const mv = (a, b, k) => [a[0] + (b[0] - a[0]) * ease(clamp(k)), a[1] + (b[1] - a[1]) * ease(clamp(k))];
    const tx = t => 40 + 560 * t / this.T;
    [[0.3, C.navy], [1.0, C.navy], [2.6, C.cmb], [3.6, C.bld], [4.6, C.syn], [8.8, C.cmb]].forEach(([t0, c]) => marks.push([E(g, 'circle', { cx: tx(t0), cy: 404, r: 6, fill: c }), t0]));
    return t => {
      const f = fadeAll(t, this.T), es = laneOn.es;
      head.setAttribute('transform', `translate(${tx(t)},0)`); marks.forEach(([m, t0]) => m.setAttribute('opacity', t >= t0 ? f : 0));
      at(intro1, t < .8 ? [70, 50] : mv([70, 50], [600, 210], (t - .8)), t < .3 ? 0 : t < 1.8 ? 1 : 0);
      at(intro2, t < 1.6 ? [70, 110] : mv([70, 110], [600, 210], (t - 1.6)), t < 1.0 ? 0 : t < 2.6 ? 1 : 0);
      const slotP = [[210, 194], [320, 194], [430, 194]], flush = (t - 7.0) / .6;
      [[dA, 2.6, 0], [dB, 3.6, 1], [dC, 4.6, 2]].forEach(([d, t0, i]) => {
        const p = t < 7 ? mv([slotP[i][0], 40], slotP[i], (t - t0) / .5) : mv(slotP[i], [330, 210], flush);
        at(d, p, t < t0 ? 0 : t < 7.6 ? clamp((t - t0) / .2) : 0);
      });
      at(unit, t < 7.6 ? [330, 210] : mv([330, 210], [560, 210], (t - 7.6) / .9), t < 7.4 ? 0 : t < 8.6 ? clamp((t - 7.4) / .2) : 1 - clamp((t - 8.6) / .3));
      at(dD, mv([210, 40], slotP[0], (t - 8.8) / .5), t < 8.8 ? 0 : f);
      const cd = t < 2.6 ? 0 : t < 7 ? 1 - (t - 2.6) / 4.4 : t < 8.8 ? 0 : 1 - (t - 8.8) / 4.4;
      bar.setAttribute('width', (330 * clamp(cd)).toFixed(1)); barT.textContent = es ? 'battle cooldown · at most 180 s or 5 events' : 'battle cooldown';
      [ghost, gl, gT].forEach(el => el.setAttribute('opacity', es ? env(t, 5.2, 6.6) : 0));
      [br, brT].forEach(el => el.setAttribute('opacity', es ? env(t, 6.0, 7.1) : 0));
    };
  },
};

DETAIL.sr = {
  T: 16, steps: [[0, 'The Pre-Processor swaps numerical identifiers for names, such as unit IDs for unit names, and game time for human-friendly timestamps.'],
    [3.2, 'The prompt is assembled: a system instruction and a communicative goal (both depend on the module set-up: border colours), writing-style instructions for the live-update register, module prompts (only for enabled modules: wiki facts with causal explanations, information asymmetry) and the preprocessed JSON. All earlier text is given as prior turns.'],
    [6.6, 'Gemini 2.5 Flash (temperature 1, fixed seed) realizes one text block per prompt: a summary of the recent events, not live coverage.'],
    [7.4, 'The LLM also turns map coordinates into narrative location anchors, such as “on the forward woodline” (example adapted from the paper).']],
  build(svg) {
    const g = E(svg, 'g');
    text(g, 20, 4, 260, 22, '{…} content unit', { fs: 16, it: 1, fill: C.note, al: 'start' }); text(g, 360, 4, 260, 22, '«…» human-readable', { fs: 16, it: 1, fill: C.note, al: 'start' });
    rect(g, 20, 30, 260, 112, { rx: 6, fill: '#fff', st: C.ink, sw: 2 }); rect(g, 360, 30, 260, 112, { rx: 6, fill: '#fff', st: C.ink, sw: 2 });
    line(g, svg, [[288, 86], [350, 86]], { st: C.navy, sw: 3, arrow: 1 }); text(g, 280, 54, 80, 22, 'Pre-\nProcessor', { fs: 15, fw: 700, fill: C.blue, lh: 1.05 });
    const ids = ['actor: unit 448', 'pos: (112, 64)', 't: 992000 ms'], nm = ['actor: Scout Cavalry', 'pos: (112, 64)', 'time: 16:32'];
    ids.forEach((s, i) => text(g, 32, 40 + i * 32, 240, 24, s, { ff: JB, fs: 15, al: 'start' }));
    const right = nm.map((s, i) => text(g, 372, 40 + i * 32, 240, 24, s, { ff: JB, fs: 15, al: 'start', fw: 700, fill: C.navy }));
    const flies = nm.map(() => glyph('readable', 34, g));
    text(g, 20, 154, 200, 22, 'prompt', { fs: 16, it: 1, fill: C.note, al: 'start' });
    const chips = [['system instruction', C.navy, null, 1], ['communicative goal', C.navy, null, 1], ['style: live-update register', C.navy], ['Expert Insights: wiki facts, causal explanations', C.ei, 'ei'], ['Event Structuring: information asymmetry', C.es, 'es'], ['JSON «…»', C.navy], ['prior turns', '#6e6e6e']]
      .filter(c => !c[2] || laneOn[c[2]]);
    // module set-up shapes the system instruction and goal: same border language as the overview (one colour, or a hard split)
    const on = ['ei', 'es'].filter(k => laneOn[k]), gid = 'srmod' + (++marker.n);
    const lg = E(svg.querySelector('defs'), 'linearGradient', { id: gid, x1: 0, y1: 0, x2: 1, y2: 0 }); [[0, C.ei], [.5, C.ei], [.5, C.es], [1, C.es]].forEach(([o, c]) => E(lg, 'stop', { offset: o, 'stop-color': c }));
    const modSt = on.length > 1 ? `url(#${gid})` : on.length ? C[on[0]] : null;
    let cx = 20, cy = 180; const chipEls = chips.map(([s, col, , mod], i) => {
      const w = s.length * 7.9 + 26; if (cx + w > 620) { cx = 20; cy += 38; }
      const k = E(g, 'g'); rect(k, cx, cy, w, 30, { rx: 15, fill: col, st: mod ? modSt : null, sw: 4 }); text(k, cx, cy + 3, w, 24, s, { fs: 15, fw: 700, fill: '#fff' }); cx += w + 8; return [k, 3.2 + i * .45];
    });
    const ly = cy + 46; line(g, svg, [[320, cy + 34], [320, ly - 2]], { st: C.navy, sw: 2.5, arrow: 1 });
    const llm = E(g, 'g'); rect(llm, 120, ly, 400, 34, { rx: 8, fill: C.navy }); text(llm, 120, ly + 5, 400, 24, 'Gemini 2.5 Flash · temperature 1 · fixed seed', { fs: 16, fw: 700, fill: '#fff' });
    const glow = rect(g, 116, ly - 4, 408, 42, { rx: 10, st: C.blue, sw: 4 });
    const oy = ly + 48, fo = E(g, 'foreignObject', { x: 20, y: oy, width: 600, height: 116 });
    svg.setAttribute('viewBox', `0 0 640 ${Math.max(440, oy + 120)}`);
    const div = document.createElement('div'); div.className = 'pipe-out'; fo.appendChild(div);
    const SEG = [['E', '16:32 — With Forging now in, '], ['A', 'Red’s three scouts '], ['A', 'waste no time — they spot a Villager', 1], ['A', ' '], ['E', 'on the forward woodline! '], ['P', 'Red '], ['P', 'surges ahead with', 1], ['P', ' a three-Villager advantage. '], ['S', 'Meanwhile Blue raids Red’s gold mine, unseen by Red.']];
    const total = SEG.reduce((s, q) => s + q[1].length, 0); let shown = -1;
    return t => {
      const f = fadeAll(t, this.T);
      right.forEach((el, i) => el.setAttribute('opacity', clamp((t - (1.6 + i * .6)) / .3) * f));
      flies.forEach((el, i) => { const t0 = 1.0 + i * .6, k = clamp((t - t0) / .6); place(el, 150 + 340 * ease(k), 52 + i * 32); el.setAttribute('opacity', t < t0 || k >= 1 ? 0 : 1); });
      chipEls.forEach(([k, t0]) => { const a = clamp((t - t0) / .3); k.setAttribute('opacity', a * f); k.setAttribute('transform', `translate(0,${(1 - a) * 8})`); });
      llm.setAttribute('opacity', clamp((t - 6.2) / .3) * f); glow.setAttribute('opacity', env(t, 6.6, 7.2));
      const n = Math.round(total * clamp((t - 7.4) / 5.4) * (f > 0 ? 1 : 0));
      if (n !== shown) { shown = n; let left = n, h = '';
        for (const [, s] of SEG) { if (left <= 0) break; const part = s.slice(0, left); left -= part.length; h += part; }
        div.innerHTML = h + (n > 0 && n < total ? '<span class="caret">▍</span>' : ''); }
      div.style.opacity = f;
    };
  },
};

/* ---------- controller ---------- */
const STAGE_TEXT = {
  sa: { data: '{ type: "battle",\n  startTimeMs, endTimeMs, worldX, worldY,\n  data: InstantEvent[] }   // clustered damage + death events' },
  di: { data: '// every event type is enriched; with Expert Insights also the detected strategy + synthetic strategy events\n{ type: "battle", location: { x: 112, y: 64 }, fightType: "raid",\n  player1: { participants, casualties, survivors },\n  player2: { … },\n  startPlayerInfo / endPlayerInfo: [{ gameState: { totalEcoUnits, technologies, … } }] }' },
  dp: { data: '{ type: "multipleEvents", startTimeMs, endTimeMs,\n  battles: [ … ], constructions: [ … ],\n  strategyUpdate: { … } }   // strategyUpdate only with Expert Insights' },
  sr: { data: 'system · goal · style · module prompts · preprocessed JSON · prior turns\n→ one text block: “16:32 — With Forging now in, Red’s three scouts waste no time …”' },
};
let OVR = null, mode = 'overview', cur = null, playing = !reduced, clockT = 0, last = null, visible = true, detailUpd = null, detailSvg = null;
const box = () => $('#pipe');
function render() {
  const mobile = box().clientWidth < 720, L = makeLayout(mobile);
  OVR = buildOverview(L); OVR.L = L;
  const host = $('#pipeOverview'); host.innerHTML = ''; host.appendChild(OVR.svg);
  OVR.svg.style.aspectRatio = `${L.vb[2]} / ${L.vb[3]}`;
  STG.forEach(s => { const g = OVR.G[s.id]; g.onclick = () => openStage(s.id); g.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openStage(s.id); } }; });
  OVR.update(clockT % OVR.T, playing);
  if (mode === 'detail') buildDetail();
}
function animateVB(svg, from, to, ms, done) {
  if (reduced) { svg.setAttribute('viewBox', to.join(' ')); done && done(); return; }
  const t0 = performance.now(); const step = now => { const k = ease(clamp((now - t0) / ms)); svg.setAttribute('viewBox', from.map((v, i) => v + (to[i] - v) * k).join(' ')); if (k < 1) requestAnimationFrame(step); else done && done(); }; requestAnimationFrame(step);
}
function stageBox(sid) {
  const s = STG.find(q => q.id === sid), L = OVR.L, [dx, dy] = L.off[sid];
  return [s.x0 + dx - 16, 1245 + dy, s.w + 32, (L.mobile ? s.bottom : 1530) - 1235];
}
function openStage(sid) {
  cur = sid; mode = 'detail'; markTabs();
  OVR.svg.querySelectorAll('.stg').forEach(g => g.classList.toggle('dim', g.dataset.stage !== sid));
  OVR.svg.classList.add('zooming');
  animateVB(OVR.svg, OVR.L.vb, stageBox(sid), 650, () => { buildDetail(); $('#pipe').classList.add('show-detail'); $('#pipeDetail').focus({ preventScroll: true }); });
}
function closeStage() {
  mode = 'overview'; markTabs(); $('#pipe').classList.remove('show-detail'); const from = stageBox(cur);
  box().scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  OVR.svg.querySelectorAll('.stg').forEach(g => g.classList.remove('dim'));
  animateVB(OVR.svg, from, OVR.L.vb, 650, () => OVR.svg.classList.remove('zooming'));
}
function buildDetail() {
  const s = STG.find(q => q.id === cur), D = DETAIL[cur], i = STG.indexOf(s);
  $('#pipeDetailTitle').textContent = `${i + 1} · ${s.name}`; $('#pipeDetailSub').textContent = s.sub;
  markTabs();
  const host = $('#pipeScene'); host.innerHTML = '';
  detailSvg = E(null, 'svg', { viewBox: '0 0 640 440', class: 'scene-svg', role: 'img', 'aria-label': `${s.name} animation` }); E(detailSvg, 'defs'); host.appendChild(detailSvg);
  detailUpd = D.build.call(D, detailSvg); D._t = 0;
  $('#pipeSteps').innerHTML = D.steps.map(([t, txt], k) => `<li data-k="${k}">${txt}</li>`).join('');
  $('#pipeData').textContent = STAGE_TEXT[cur].data;
  detailUpd(reduced ? D.T - .6 : 0); markStep(reduced ? D.T : 0);
}
function markTabs() { $('#pipeTabs').querySelectorAll('button').forEach(b => { const on = b.dataset.stage === (mode === 'detail' ? cur : 'all'); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }); }
function markStep(t) { const D = DETAIL[cur]; let k = 0; D.steps.forEach(([t0], j) => { if (t >= t0) k = j; }); $('#pipeSteps').querySelectorAll('li').forEach((li, j) => li.classList.toggle('on', j === k)); }
function tick(now) {
  const dt = last == null ? 0 : Math.min(.1, (now - last) / 1000); last = now;
  if (playing && visible) {
    clockT += dt;
    if (mode === 'overview' && OVR) OVR.update(clockT % OVR.T, true);
    if (mode === 'detail' && detailUpd) { const D = DETAIL[cur]; D._t = (D._t + dt) % D.T; detailUpd(D._t); markStep(D._t); }
  }
  requestAnimationFrame(tick);
}
function setPlaying(p) {
  playing = p; const b = $('#pipePlay'); b.innerHTML = p ? '<span class="ms">pause</span> Pause' : '<span class="ms">play_arrow</span> Play'; b.setAttribute('aria-pressed', String(!p));
  if (OVR) OVR.update(clockT % OVR.T, p);
}
function init() {
  $('#pipeTabs').innerHTML = `<button type="button" data-stage="all">All stages</button>` + STG.map((s, i) => `<button type="button" data-stage="${s.id}">${i + 1} · ${s.name}</button>`).join('');
  $('#pipeTabs').onclick = e => { const b = e.target.closest('button'), sid = b && b.dataset.stage; if (!sid) return;
    if (sid === 'all') { if (mode === 'detail') closeStage(); } else if (mode === 'detail') { cur = sid; buildDetail(); } else openStage(sid); };
  markTabs();
  $('#pipePlay').onclick = () => setPlaying(!playing);
  document.querySelectorAll('[data-lane]').forEach(b => b.onclick = () => { const k = b.dataset.lane; laneOn[k] = !laneOn[k]; b.classList.toggle('on', laneOn[k]); b.setAttribute('aria-pressed', String(laneOn[k])); if (OVR) OVR.update(clockT % OVR.T, playing); if (mode === 'detail') buildDetail(); });
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(box());
  setPlaying(playing); render(); requestAnimationFrame(tick);
  let rz, w = box().clientWidth; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (Math.abs(box().clientWidth - w) > 4) { w = box().clientWidth; render(); } }, 150); });
}
window.drawPipe = () => { if (OVR) render(); };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
