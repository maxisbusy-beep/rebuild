// Body: weekly bodyweight / waist check-ins, optional photos, trend charts and eating guidance.
import * as db from '../db.js';
import { sortEntries, checkinDue, pointsOf, movingAverage, guidance, AIM_TEXT } from '../body.js';
import { lineChart } from '../chart.js';
import { ymd, parseYmd, prettyDate } from '../dates.js';
import { fmtKg } from '../format.js';
import { h, icon, sheet, toast, card, pageHeader, emptyState } from '../ui.js';
import { numField, dateField, chartCard } from '../fields.js';

const shortDate = (date) => prettyDate(parseYmd(date), { short: true });

/** Shrink a photo so it stores (and backs up) in a few hundred kB. */
async function fileToDataUrl(file, max = 1280) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  if (bmp.close) bmp.close();
  return canvas.toDataURL('image/jpeg', 0.82);
}

export async function render(root, { refresh }) {
  const [raw, sessions, photos] = await Promise.all([db.getAll('body'), db.getAll('sessions'), db.getAll('photos')]);
  const entries = sortEntries(raw);
  const photoById = new Map(photos.map((p) => [p.id, p]));
  const now = new Date();
  const due = checkinDue(entries, now);
  const latest = entries[entries.length - 1];
  const first = entries[0];
  const latestWaist = [...entries].reverse().find((e) => e.waist > 0);

  root.append(pageHeader('Body'));

  root.append(h('section', { class: `card ${due ? 'next' : ''}`.trim() },
    h('div', { class: 'kicker' }, due ? 'Weekly check-in due' : 'Checked in this week'),
    h('p', { class: 'dim' }, due
      ? 'Bodyweight and waist, once a week. Same day, first thing in the morning, works best.'
      : `Last check-in ${shortDate(latest.date)}. Next one is due from Monday.`),
    h('button', { class: `btn ${due ? 'primary big' : ''}`.trim(), onclick: () => edit(null) }, due ? 'Check in' : 'Add another check-in')));

  if (!entries.length) {
    root.append(
      card('Guidance', h('p', {}, AIM_TEXT)),
      emptyState({ iconName: 'scale', title: 'No check-ins yet', text: 'Your weight and waist charts appear after the first check-in.' }));
    return;
  }

  const change = latest.weight - first.weight;
  const g = guidance(entries, sessions, now);
  const weightPts = pointsOf(entries, 'weight');
  const waistPts = pointsOf(entries, 'waist');
  const chart = (pts, label) => (pts.length ? lineChart({
    label,
    series: [{ points: pts, style: 'faint' }, { points: movingAverage(pts), style: 'line' }],
  }) : '');
  const withPhotos = entries.filter((e) => e.photoId && photoById.has(e.photoId)).reverse();

  root.append(...[
    h('div', { class: 'stats' },
      stat(fmtKg(latest.weight), 'Weight kg'),
      stat(latestWaist ? fmtKg(latestWaist.waist) : '–', 'Waist cm'),
      stat(entries.length > 1 ? `${change > 0 ? '+' : ''}${fmtKg(change)}` : '–', 'Since start')),

    card('Guidance',
      h('p', {}, AIM_TEXT),
      h('p', { class: `guide ${g.tone}`.trim() }, g.text)),

    chartCard('Bodyweight', chart(weightPts, 'Bodyweight'), { legend: 'Bright line: 4-week average. Grey: each check-in.' }),
    chartCard('Waist', chart(waistPts, 'Waist'), { legend: 'Bright line: 4-week average. Grey: each check-in.', empty: 'Add a waist measurement to see this chart.' }),

    withPhotos.length ? card('Photos',
      h('div', { class: 'photos' }, withPhotos.map((e) =>
        h('button', { class: 'photo', 'aria-label': `Photo from ${shortDate(e.date)}`, onclick: () => viewPhoto(e) },
          h('img', { src: photoById.get(e.photoId).dataUrl, alt: '', loading: 'lazy' }),
          h('span', { class: 'photo-date' }, shortDate(e.date).replace(/ \d{4}$/, '')))))) : null,

    card('History',
      h('div', { class: 'prog-list' }, [...entries].reverse().map((e) =>
        h('button', { class: 'prog-item', onclick: () => edit(e) },
          h('span', { class: 'prog-text' },
            h('span', { class: 'prog-name' }, `${fmtKg(e.weight)} kg${e.waist > 0 ? ` · ${fmtKg(e.waist)} cm` : ''}`),
            h('span', { class: 'prog-rx' }, `${shortDate(e.date)}${e.photoId ? ' · photo' : ''}`)),
          icon('chevron'))))),
  ].filter(Boolean));

  function stat(value, label) {
    return h('div', { class: 'stat' }, h('div', { class: 'stat-val' }, value), h('div', { class: 'stat-label' }, label));
  }

  async function viewPhoto(e) {
    await sheet({
      title: shortDate(e.date),
      body: h('div', {},
        h('img', { class: 'photo-full', src: photoById.get(e.photoId).dataUrl, alt: `Progress photo, ${shortDate(e.date)}` }),
        h('p', { class: 'sheet-text dim' }, `${fmtKg(e.weight)} kg${e.waist > 0 ? ` · ${fmtKg(e.waist)} cm` : ''}`)),
      actions: [{ label: 'Close', value: null, kind: 'primary' }],
    });
  }

  /** Add (entry = null) or edit a check-in. */
  async function edit(entry) {
    const draft = entry ? { ...entry } : {
      date: ymd(), weight: latest ? latest.weight : null, waist: latestWaist ? latestWaist.waist : null, photoId: null,
    };
    let newPhoto = null;      // data URL chosen in this dialog
    let removePhoto = false;

    for (;;) {
      const current = newPhoto || (!removePhoto && draft.photoId && photoById.get(draft.photoId) ? photoById.get(draft.photoId).dataUrl : null);
      const preview = h('div', { class: 'photo-pick' });
      const paintPreview = (url) => {
        preview.replaceChildren(...(url
          ? [h('img', { src: url, alt: 'Selected photo' }), h('button', { class: 'link', onclick: () => { newPhoto = null; removePhoto = true; paintPreview(null); } }, 'Remove photo')]
          : [h('span', { class: 'dim' }, 'No photo (optional). Stored only on this phone.')]));
      };
      paintPreview(current);
      const file = h('input', { type: 'file', accept: 'image/*', style: 'display:none' });
      file.addEventListener('change', async () => {
        if (!file.files || !file.files[0]) return;
        try { newPhoto = await fileToDataUrl(file.files[0]); removePhoto = false; paintPreview(newPhoto); }
        catch { toast('That photo could not be read.', { tone: 'bad' }); }
      });

      const choice = await sheet({
        title: entry ? 'Edit check-in' : 'Weekly check-in',
        body: h('div', { class: 'edit-set' },
          dateField({ label: 'Date', value: draft.date, max: ymd(), onChange: (v) => { draft.date = v; } }),
          numField({ label: 'Bodyweight', value: draft.weight, unit: 'kg', min: 30, max: 300, step: 0.1, onChange: (v) => { draft.weight = v; } }),
          numField({ label: 'Waist', hint: 'At the navel, relaxed', value: draft.waist, unit: 'cm', min: 40, max: 200, step: 0.5, onChange: (v) => { draft.waist = v; } }),
          file, preview,
          h('button', { class: 'btn', onclick: () => file.click() }, 'Add progress photo')),
        actions: [
          { label: 'Save', value: 'save', kind: 'primary' },
          entry ? { label: 'Delete this check-in', value: 'delete', kind: 'danger' } : null,
          { label: 'Cancel', value: null },
        ].filter(Boolean),
      });
      if (!choice) return;

      if (choice === 'delete') {
        const sure = await sheet({
          title: 'Delete this check-in?',
          body: h('p', { class: 'sheet-text' }, 'The measurements and any photo will be removed. This cannot be undone.'),
          actions: [{ label: 'Delete', value: true, kind: 'danger' }, { label: 'Cancel', value: false }],
        });
        if (!sure) continue;
        if (entry.photoId) await db.del('photos', entry.photoId);
        await db.del('body', entry.id);
        toast('Check-in deleted.');
        return refresh();
      }

      const problem = !(draft.weight >= 30 && draft.weight <= 300) ? 'Enter your bodyweight in kg (30–300).'
        : draft.waist !== null && !(draft.waist >= 40 && draft.waist <= 200) ? 'Waist should be between 40 and 200 cm, or left empty.'
          : !/^\d{4}-\d{2}-\d{2}$/.test(draft.date || '') || draft.date > ymd() ? 'Choose a date that is today or earlier.' : null;
      if (problem) { toast(problem, { tone: 'bad', duration: 5000 }); continue; }

      if ((newPhoto || removePhoto) && draft.photoId) { await db.del('photos', draft.photoId); draft.photoId = null; }
      if (newPhoto) draft.photoId = (await db.put('photos', { dataUrl: newPhoto, date: draft.date })).id;
      await db.put('body', { ...draft, weight: Number(draft.weight), waist: draft.waist === null ? null : Number(draft.waist) });
      toast('Check-in saved.');
      return refresh();
    }
  }
}
