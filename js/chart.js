// Hand-written SVG line chart. Pure: returns markup, no DOM access.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayLabel = (t) => { const d = new Date(t); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const trim = (v) => String(Number(v.toFixed(1)));

/**
 * Stacked bar chart, one bar per week.
 * bars: [{ t, a, b }] where a is drawn in the accent colour and b stacked on top in grey.
 * target: optional dashed line (for example 4 lifting sessions).
 */
export function barChart({ bars, target = null, width = 340, height = 170, label = 'Chart' }) {
  if (!bars.length) return '';
  const pad = { l: 24, r: 8, t: 14, b: 24 };
  const w = width - pad.l - pad.r, h = height - pad.t - pad.b;
  const top = Math.max(1, target || 0, ...bars.map((b) => b.a + b.b));
  const max = top + 1;
  const slot = w / bars.length, bw = Math.min(26, slot * 0.62);
  const y = (v) => pad.t + (1 - v / max) * h;
  const f = (n) => n.toFixed(1);
  const base = pad.t + h;

  const cols = bars.map((b, i) => {
    const cx = pad.l + slot * (i + 0.5), x = cx - bw / 2;
    const ya = y(b.a), yb = y(b.a + b.b);
    const total = b.a + b.b;
    return (b.a > 0 ? `<rect class="ch-bar a" x="${f(x)}" y="${f(ya)}" width="${f(bw)}" height="${f(base - ya)}" rx="3"/>` : '')
      + (b.b > 0 ? `<rect class="ch-bar b" x="${f(x)}" y="${f(yb)}" width="${f(bw)}" height="${f(ya - yb)}" rx="3"/>` : '')
      + (total > 0 ? `<text class="ch-val" x="${f(cx)}" y="${f(yb - 4)}" text-anchor="middle">${total}</text>` : '')
      + (i === 0 || i === bars.length - 1 || bars.length <= 4
        ? `<text class="ch-x" x="${f(cx)}" y="${height - 6}" text-anchor="middle">${dayLabel(b.t)}</text>` : '');
  }).join('');

  const line = target
    ? `<line class="ch-target" x1="${pad.l}" x2="${width - pad.r}" y1="${f(y(target))}" y2="${f(y(target))}"/>`
      + `<text class="ch-y" x="${pad.l - 6}" y="${f(y(target) + 4)}" text-anchor="end">${target}</text>` : '';
  const axis = `<line class="ch-grid" x1="${pad.l}" x2="${width - pad.r}" y1="${f(base)}" y2="${f(base)}"/>`;
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}">${axis}${line}${cols}</svg>`;
}

/** Value range padded so the line never touches the frame; flat data gets a sensible band. */
export function yRange(values) {
  let lo = Math.min(...values), hi = Math.max(...values);
  if (hi - lo < 1e-9) { const pad = Math.max(1, Math.abs(hi) * 0.02); lo -= pad; hi += pad; }
  const pad = (hi - lo) * 0.12;
  return { lo: lo - pad, hi: hi + pad };
}

/**
 * series: [{ points: [{ t, y }], style: 'line' | 'dots' | 'faint' }]
 *   line  = accent line with dots (main series)
 *   faint = thin grey line with small dots (raw data behind an average)
 *   dots  = dots only
 * Returns '' when there is nothing to draw.
 */
export function lineChart({ series, width = 340, height = 180, fmtY = trim, label = 'Chart' }) {
  const all = series.flatMap((s) => s.points);
  if (!all.length) return '';
  const pad = { l: 40, r: 12, t: 12, b: 24 };
  const w = width - pad.l - pad.r, h = height - pad.t - pad.b;
  const { lo, hi } = yRange(all.map((p) => p.y));
  const t0 = Math.min(...all.map((p) => p.t)), t1 = Math.max(...all.map((p) => p.t));
  const x = (t) => pad.l + (t1 === t0 ? w / 2 : ((t - t0) / (t1 - t0)) * w);
  const y = (v) => pad.t + (1 - (v - lo) / (hi - lo)) * h;
  const f = (n) => n.toFixed(1);

  const grid = [hi - (hi - lo) * 0.12 / 1.24, (lo + hi) / 2, lo + (hi - lo) * 0.12 / 1.24].map((v) =>
    `<line class="ch-grid" x1="${pad.l}" x2="${width - pad.r}" y1="${f(y(v))}" y2="${f(y(v))}"/>`
    + `<text class="ch-y" x="${pad.l - 6}" y="${f(y(v) + 4)}" text-anchor="end">${fmtY(v)}</text>`).join('');

  const body = series.map((s) => {
    const pts = s.points;
    if (!pts.length) return '';
    const path = pts.length > 1 && s.style !== 'dots'
      ? `<polyline class="ch-line ${s.style}" points="${pts.map((p) => `${f(x(p.t))},${f(y(p.y))}`).join(' ')}"/>` : '';
    const r = s.style === 'faint' ? 2.5 : 3.5;
    const dots = pts.length <= 40 || s.style === 'dots'
      ? pts.map((p) => `<circle class="ch-dot ${s.style}" cx="${f(x(p.t))}" cy="${f(y(p.y))}" r="${r}"/>`).join('') : '';
    return path + dots;
  }).join('');

  const xl = t1 === t0
    ? `<text class="ch-x" x="${f(x(t0))}" y="${height - 6}" text-anchor="middle">${dayLabel(t0)}</text>`
    : `<text class="ch-x" x="${pad.l}" y="${height - 6}">${dayLabel(t0)}</text>`
      + `<text class="ch-x" x="${width - pad.r}" y="${height - 6}" text-anchor="end">${dayLabel(t1)}</text>`;

  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}">${grid}${body}${xl}</svg>`;
}
