// Hand-written SVG line chart. Pure: returns markup, no DOM access.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayLabel = (t) => { const d = new Date(t); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const trim = (v) => String(Number(v.toFixed(1)));

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
