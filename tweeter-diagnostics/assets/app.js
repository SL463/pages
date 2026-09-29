
const D = window.REPORT_DATA;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const NS = 'http://www.w3.org/2000/svg';
const el = (t, a = {}, p) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
const fmtF = f => f >= 1000 ? (f / 1000).toFixed(f >= 10000 ? 1 : 2).replace(/\.?0+$/, '') + ' kHz' : Math.round(f) + ' Hz';
const fmtTick = f => f >= 1000 ? (f / 1000) + 'k' : String(f);

function chart(host, o) {
  let hover = null;
  function draw() {
    host.innerHTML = '';
    const W = Math.max(300, host.clientWidth), H = Math.round(Math.min(o.maxH || 420, Math.max(o.minH || 280, W * (o.ratio || 0.5))));
    const m = { l: 46, r: 12, t: 14, b: 32 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const lx0 = Math.log10(o.x[0]), lx1 = Math.log10(o.x[1]);
    const X = f => m.l + (Math.log10(f) - lx0) / (lx1 - lx0) * iw;
    const yv = v => o.ylog ? Math.log10(v) : v;
    const y0 = yv(o.y[0]), y1 = yv(o.y[1]);
    const Y = v => m.t + ih - (yv(Math.min(Math.max(v, o.y[0]), o.y[1])) - y0) / (y1 - y0) * ih;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': o.label }, host);
    if (o.shade) {
      const xs = X(Math.max(o.x[0], o.shade[0])), xe = X(o.shade[1]);
      el('rect', { x: xs, y: m.t, width: xe - xs, height: ih, fill: css('--shade') }, svg);
      const t = el('text', { x: xs + 8, y: m.t + 16, class: 'shade-lab' }, svg); t.textContent = o.shadeLabel;
    }
    for (const v of o.yt) {
      el('line', { x1: m.l, x2: m.l + iw, y1: Y(v), y2: Y(v), stroke: css('--grid'), 'stroke-width': 1 }, svg);
      const t = el('text', { x: m.l - 8, y: Y(v) + 4, 'text-anchor': 'end' }, svg); t.textContent = o.yfmt ? o.yfmt(v) : v;
    }
    for (const f of o.xt) {
      el('line', { x1: X(f), x2: X(f), y1: m.t, y2: m.t + ih, stroke: css('--grid'), 'stroke-width': 1 }, svg);
      const t = el('text', { x: X(f), y: H - 10, 'text-anchor': 'middle' }, svg); t.textContent = fmtTick(f);
    }
    el('line', { x1: m.l, x2: m.l + iw, y1: m.t + ih, y2: m.t + ih, stroke: css('--line'), 'stroke-width': 1 }, svg);
    const series = o.series();
    for (const s of series) {
      let d = '', pen = false;
      for (const [f, v] of s.pts) {
        if (f < o.x[0] || f > o.x[1] || v == null || (o.ylog && v <= 0)) { pen = false; continue; }
        d += (pen ? 'L' : 'M') + X(f).toFixed(1) + ',' + Y(v).toFixed(1); pen = true;
      }
      el('path', { d, fill: 'none', stroke: css(s.c), 'stroke-width': s.w || 2, 'stroke-dasharray': s.dash || 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
      if (o.markers) for (const [f, v] of s.pts) if (v != null && v > 0 && f <= o.x[1])
        el('circle', { cx: X(f), cy: Y(v), r: 4, fill: css(s.c), stroke: css('--surface'), 'stroke-width': 2 }, svg);
    }
    const g = el('g', { opacity: 0 }, svg);
    const vl = el('line', { y1: m.t, y2: m.t + ih, stroke: css('--ink-3'), 'stroke-width': 1, 'stroke-dasharray': '3 3' }, g);
    const dots = series.map(s => el('circle', { r: 5, fill: css(s.c), stroke: css('--surface'), 'stroke-width': 2 }, g));
    const tip = document.createElement('div'); tip.className = 'tip'; host.appendChild(tip);
    const hit = el('rect', { x: m.l, y: 0, width: iw, height: H, fill: 'transparent' }, svg);
    const near = (pts, f) => { let b = null, bd = Infinity; for (const p of pts) { if (p[1] == null) continue; const dd = Math.abs(Math.log(p[0] / f)); if (dd < bd) { bd = dd; b = p; } } return bd < 0.03 ? b : null; };
    function show(px) {
      const f = 10 ** (lx0 + (px - m.l) / iw * (lx1 - lx0));
      const hits = series.map(s => near(s.pts.filter(p => p[0] >= o.x[0] && p[0] <= o.x[1]), f));
      const fx = hits[0] ? hits[0][0] : f;
      vl.setAttribute('x1', X(fx)); vl.setAttribute('x2', X(fx));
      hits.forEach((h, i) => { if (h && !(o.ylog && h[1] <= 0)) { dots[i].setAttribute('cx', X(h[0])); dots[i].setAttribute('cy', Y(h[1])); dots[i].style.display = ''; } else dots[i].style.display = 'none'; });
      g.setAttribute('opacity', 1);
      tip.innerHTML = `<div>${fmtF(fx)}</div>` + series.map((s, i) => `<div><span class="sw" style="background:${css(s.c)}"></span>${s.n}  ${hits[i] ? o.vfmt(hits[i][1]) : '—'}</div>`).join('');
      const sx = X(fx) / W * host.clientWidth;
      tip.style.left = Math.min(Math.max(sx, 70), host.clientWidth - 70) + 'px';
      tip.style.top = (m.t + 4) + 'px'; tip.style.opacity = 1;
    }
    const pos = e => { const r = svg.getBoundingClientRect(); return (e.clientX - r.left) / r.width * W; };
    hit.addEventListener('pointermove', e => { hover = pos(e); show(hover); });
    hit.addEventListener('pointerdown', e => { hover = pos(e); show(hover); });
    hit.addEventListener('pointerleave', () => { hover = null; g.setAttribute('opacity', 0); tip.style.opacity = 0; });
  }
  draw();
  return draw;
}

const XT = [100, 200, 500, 1000, 2000, 5000, 10000, 20000];
const redraw = [];
redraw.push(chart(document.getElementById('p-imp'), {
  label: 'Impedance magnitude of FL and FR tweeters from 100 Hz to 20 kHz',
  x: [100, 20000], y: [2.5, 6.5], yt: [3, 4, 5, 6], xt: XT, vfmt: v => v.toFixed(2) + ' Ω',
  series: () => [{ n: 'FL', c: '--fl', pts: D.imp_FL }, { n: 'FR', c: '--fr', pts: D.imp_FR }]
}));
redraw.push(chart(document.getElementById('p-spl'), {
  label: 'SPL of FL and FR tweeters from 1 kHz to 20 kHz',
  x: [1000, 20000], y: [50, 100], yt: [50, 60, 70, 80, 90, 100], xt: [1000, 2000, 3500, 5000, 10000, 20000],
  shade: [1000, 3500], shadeLabel: 'Below crossover', vfmt: v => v.toFixed(1) + ' dB',
  series: () => [{ n: 'FL', c: '--fl', pts: D.spl_FL }, { n: 'FR', c: '--fr', pts: D.spl_FR }]
}));
// REW-style distortion: columns are [f, fundamental dB, THD, noise, H2, H3, H4, H5]
const CURVES = [
  { n: 'Fundamental', col: 1, c: '--ink', w: 2.25, dbOnly: true },
  { n: 'THD', col: 2, c: '--c-thd' },
  { n: 'H2', col: 4, c: '--c-h2', w: 1.5 },
  { n: 'H3', col: 5, c: '--c-h3', w: 1.5 },
  { n: 'H4', col: 6, c: '--c-h4', w: 1.5 },
  { n: 'H5', col: 7, c: '--c-h5', w: 1.5 },
  { n: 'Noise', col: 3, c: '--ink-3', w: 1.25, dash: '4 3' }
];
let unit = 'dz';
const on = new Set(CURVES.map(c => c.n));
const keys = document.getElementById('d-keys');
keys.innerHTML = CURVES.map((c, i) => `<button type="button" id="dk-${i}" data-n="${c.n}" aria-pressed="true"><b class="${c.dash ? 'dash' : ''}" style="background:var(${c.c})"></b>${c.n}</button>`).join('');
// REW reports THD as 0 once no harmonics are in band; drop those points instead of plotting a false floor
const curvePts = (rows, c) => rows.map(r => [r[0], (c.col === 2 && r[4] == null) ? null : r[c.col]]);
const distOpts = rows => () => ({
  ...(unit === 'dz'
    ? { ylog: false, y: [-10, 100], yt: [0, 20, 40, 60, 80, 100], yfmt: v => v, vfmt: v => v.toFixed(1) + ' dB' }
    : { ylog: true, y: [0.01, 100], yt: [0.01, 0.1, 1, 10, 100], yfmt: v => v + '%', vfmt: v => (v < 0.1 ? v.toFixed(3) : v < 10 ? v.toFixed(2) : v.toFixed(1)) + '%' }),
  series: CURVES.filter(c => on.has(c.n) && !(unit === 'dp' && c.dbOnly)).map(c => ({ n: c.n, c: c.c, w: c.w, dash: c.dash, pts: curvePts(D[unit + rows], c) }))
});
function distChart(host, side) {
  const base = { maxH: 340, minH: 260, ratio: 0.4, label: `Distortion of the ${side} tweeter, fundamental and harmonics, 1 kHz to 20 kHz`, x: [1000, 20000], xt: [1000, 2000, 3500, 5000, 10000, 20000], shade: [1000, 3500], shadeLabel: 'Below crossover' };
  const opts = { ...base };
  const sync = () => Object.assign(opts, distOpts('_' + side)());
  sync();
  opts.series = () => distOpts('_' + side)().series;
  const draw = chart(host, opts);
  return () => { sync(); opts.series = () => distOpts('_' + side)().series; draw(); };
}
const distDraws = [distChart(document.getElementById('p-dist-fl'), 'FL'), distChart(document.getElementById('p-dist-fr'), 'FR')];
redraw.push(...distDraws);
keys.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const n = b.dataset.n; on.has(n) ? on.delete(n) : on.add(n);
  b.setAttribute('aria-pressed', on.has(n));
  distDraws.forEach(f => f());
});
document.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => {
  unit = b.dataset.u;
  document.querySelectorAll('.seg button').forEach(x => x.setAttribute('aria-pressed', x === b));
  const label = unit === 'dz' ? 'dB SPL' : '% of fundamental (log scale)';
  document.getElementById('d-unit-l').textContent = label; document.getElementById('d-unit-r').textContent = label;
  distDraws.forEach(f => f());
}));


let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => redraw.forEach(f => f()), 120); });
if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => redraw.forEach(f => f()));
new MutationObserver(() => redraw.forEach(f => f())).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

// Lightbox for REW originals
const lb = document.getElementById('lb'), lbImg = document.getElementById('lb-img'), lbCap = document.getElementById('lb-cap');
let lastThumb = null;
document.querySelectorAll('.thumb').forEach(b => b.addEventListener('click', () => {
  lastThumb = b; lbImg.src = b.dataset.src; lbImg.alt = b.dataset.cap; lbCap.textContent = b.dataset.cap + ' · tap anywhere to close';
  lb.hidden = false; document.getElementById('lb-x').focus();
}));
const closeLb = () => { lb.hidden = true; if (lastThumb) lastThumb.focus(); };
lb.addEventListener('click', closeLb);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !lb.hidden) closeLb(); });

