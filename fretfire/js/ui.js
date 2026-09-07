// Every screen except the highway itself. Plain DOM — no framework, because a
// framework would be the largest thing in this app by a wide margin.

import { CHORDS, STRING_NAMES, STRING_LABELS, LANE_COLORS, midiOf, chordMidis, nameOf, OPEN_MIDI } from './theory.js';
import { SONGS, chordsUsed, songIndex } from './songs.js';
import { store, levelProgress } from './store.js';
import { STAR_THRESHOLDS } from './game.js';

export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  kids.flat().forEach(c => { if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c))); });
  return el;
}

const fill = (id, ...nodes) => { const el = document.getElementById(id); el.replaceChildren(...nodes); return el; };
const stars = (n, max = 5) => h('span', { class: 'stars' },
  h('span', { html: '★'.repeat(n) }), h('span', { class: 'off', html: '★'.repeat(max - n) }));

function topbar(title, onBack, right) {
  return h('div', { class: 'topbar' },
    onBack ? h('button', { class: 'back', onClick: onBack, 'aria-label': 'Back' }, '‹') : null,
    h('h2', {}, title), right || null);
}

// ── diagrams ────────────────────────────────────────────────────
const SVGNS = 'http://www.w3.org/2000/svg';
function s(tag, attrs = {}) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

// A standard chord box: strings run vertically, low E on the left, frets 1-4.
// The finger number inside each dot is the part beginners actually need.
export function chordDiagram(name, size = 1) {
  const shape = CHORDS[name];
  const W = 168 * size, H = 196 * size;
  const padX = 22 * size, padTop = 34 * size, padBot = 14 * size;
  const gw = (W - padX * 2) / 5, gh = (H - padTop - padBot) / 4;
  const svg = s('svg', { class: 'chordbox', width: W, height: H, viewBox: `0 0 ${W} ${H}` });

  // Nut — a thick bar means "open position", and every shape here is.
  svg.append(s('rect', { x: padX - 2, y: padTop - 5, width: gw * 5 + 4, height: 5, rx: 2, fill: '#f3eeff' }));
  for (let f = 1; f <= 4; f++) {
    svg.append(s('line', { x1: padX, y1: padTop + gh * f, x2: padX + gw * 5, y2: padTop + gh * f, stroke: '#4a3080', 'stroke-width': 1.5 }));
  }
  for (let i = 0; i < 6; i++) {
    const x = padX + gw * i;
    svg.append(s('line', { x1: x, y1: padTop, x2: x, y2: padTop + gh * 4, stroke: '#6b52a8', 'stroke-width': 0.6 + (5 - i) * 0.28 }));
    const fr = shape.frets[i];
    const mark = s('text', {
      x, y: padTop - 12, 'text-anchor': 'middle', fill: fr === null ? '#ff5c7a' : '#b3a4d6',
      'font-size': 14 * size, 'font-weight': 800, 'font-family': 'system-ui,sans-serif',
    });
    mark.textContent = fr === null ? '✕' : fr === 0 ? '○' : '';
    svg.append(mark);
    if (fr !== null && fr > 0) {
      const cy = padTop + gh * (fr - 0.5);
      svg.append(s('circle', { cx: x, cy, r: 11 * size, fill: LANE_COLORS[i] }));
      const t = s('text', { x, y: cy + 5 * size, 'text-anchor': 'middle', fill: '#160b25', 'font-size': 13 * size, 'font-weight': 900, 'font-family': 'system-ui,sans-serif' });
      t.textContent = shape.fingers[i] || '';
      svg.append(t);
    }
  }
  // String names along the bottom, so the diagram teaches them passively.
  for (let i = 0; i < 6; i++) {
    const t = s('text', { x: padX + gw * i, y: H - 1, 'text-anchor': 'middle', fill: '#7e6ea8', 'font-size': 10 * size, 'font-weight': 700, 'font-family': 'system-ui,sans-serif' });
    t.textContent = STRING_NAMES[i];
    svg.append(t);
  }
  return svg;
}

// "This one." A picture of six strings with one lit up.
export function stringDiagram(idx, fret = null) {
  const W = 260, H = 132;
  const top = 16, gap = 14, boxH = top + gap * 5 + 16;
  const svg = s('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
  svg.append(s('rect', { x: 0, y: 4, width: W, height: boxH, rx: 10, fill: '#1c1038' }));

  // Fret wires, so a fret number has something to be "behind".
  for (let f = 1; f <= 4; f++) {
    const x = 34 + f * 44;
    svg.append(s('line', { x1: x, y1: 8, x2: x, y2: boxH, stroke: '#3a2668', 'stroke-width': f === 1 ? 4 : 2 }));
  }
  for (let i = 0; i < 6; i++) {
    const y = top + i * gap;
    const on = i === idx;
    svg.append(s('line', {
      x1: 8, y1: y, x2: W - 8, y2: y,
      stroke: on ? LANE_COLORS[i] : '#4a3080',
      'stroke-width': on ? 4 : 1 + (5 - i) * 0.35,
    }));
  }
  if (fret != null && fret > 0) {
    const x = 34 + fret * 44 - 22;
    svg.append(s('circle', { cx: x, cy: top + idx * gap, r: 10, fill: LANE_COLORS[idx], stroke: '#fff', 'stroke-width': 1.5 }));
    const t = s('text', { x, y: top + idx * gap + 4, 'text-anchor': 'middle', fill: '#160b25', 'font-size': 11, 'font-weight': 900, 'font-family': 'system-ui,sans-serif' });
    t.textContent = fret;
    svg.append(t);
  }
  // The label goes UNDER the diagram. Printed alongside the string it names, it
  // simply overlapped it.
  const cap = s('text', {
    x: W / 2, y: H - 6, 'text-anchor': 'middle', fill: LANE_COLORS[idx],
    'font-size': 13, 'font-weight': 900, 'font-family': 'system-ui,sans-serif',
  });
  cap.textContent = STRING_LABELS[idx] + (fret ? ` · fret ${fret}` : ' · open');
  svg.append(cap);
  return svg;
}

// ── first run ───────────────────────────────────────────────────
export function renderIntro(app) {
  let step = 0;
  const steps = [
    {
      title: 'Welcome to Fretfire',
      body: 'Notes fall down the screen. Hit them in time. That is the whole game — and by the end of it you can actually play.',
      art: () => h('div', { class: 'brand', style: { fontSize: '3rem' } }, 'FRETFIRE'),
      cta: 'Sounds good',
    },
    {
      title: 'Do you have a guitar?',
      body: 'You do not need one to start. But if you have one nearby, Fretfire can listen through your microphone and hear what you actually play.',
      art: () => h('div', { style: { fontSize: '3.4rem' } }, '🎸'),
      choices: [
        { label: 'Yes — listen to me play', mode: 'guitar' },
        { label: 'Not right now — I will tap', mode: 'tap' },
      ],
    },
    {
      title: 'Hold it like this',
      body: 'Guitar on your right leg, neck tilted slightly up. Left-hand thumb behind the neck, not wrapped over the top. Sit up — slouching makes everything harder.',
      art: () => h('div', { style: { fontSize: '3.4rem' } }, '🪑'),
      cta: "Let's play",
    },
  ];

  const draw = () => {
    const st = steps[step];
    fill('screen-intro',
      h('div', { class: 'lesson-card' },
        h('div', { class: 'diagram' }, st.art()),
        h('h3', {}, st.title),
        h('p', {}, st.body),
      ),
      h('div', { class: 'stack' },
        ...(st.choices || []).map(c => h('button', {
          class: 'btn wide primary',
          onClick: () => { store.set('inputMode', c.mode); app.blip(); step++; draw(); },
        }, c.label)),
        st.cta ? h('button', {
          class: 'btn wide primary',
          onClick: () => {
            app.blip();
            if (step === steps.length - 1) { store.data.seenIntro = true; store.save(); app.goto('home'); }
            else { step++; draw(); }
          },
        }, st.cta) : null,
        h('div', { class: 'dots' }, ...steps.map((_, i) => h('i', { class: i === step ? 'on' : '' }))),
      ),
    );
  };
  draw();
}


// Chords the player has actually earned a star on — the only ones worth
// putting in front of them as revision.
export function knownChords() {
  const out = [];
  SONGS.forEach(sg => {
    if (store.starsFor(sg.id) > 0) chordsUsed(sg).forEach(c => { if (!out.includes(c)) out.push(c); });
  });
  return out;
}

// One chord per day, rotating. Deterministic from the date so it does not
// reshuffle every time the screen redraws.
function chordOfTheDay() {
  const known = knownChords();
  const d = new Date();
  const day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  if (!known.length) return { name: 'Em', preview: true };
  return { name: known[day % known.length], preview: false };
}

// ── home ────────────────────────────────────────────────────────
export function renderHome(app) {
  const lv = levelProgress(store.xp);
  const next = store.nextSong();
  const streak = store.liveStreak();

  fill('screen-home',
    h('div', { class: 'spread', style: { padding: '8px 0 18px' } },
      h('div', {},
        h('div', { class: 'brand' }, 'FRETFIRE'),
        h('div', { class: 'brand-sub' }, 'play it for real'),
      ),
      h('button', { class: 'back', style: { width: '42px', height: '42px', borderRadius: '12px', background: 'var(--panel)', display: 'grid', placeItems: 'center' }, onClick: () => app.goto('settings'), 'aria-label': 'Settings' }, '⚙'),
    ),

    h('div', { class: 'stack' },
      h('div', { class: 'stats' },
        h('div', { class: 'stat' }, h('b', {}, 'Lv ' + lv.level), h('span', {}, 'level')),
        h('div', { class: 'stat' }, h('b', {}, streak ? '🔥' + streak : '—'), h('span', {}, 'day streak')),
        h('div', { class: 'stat' }, h('b', {}, store.totalStars() + '/' + SONGS.length * 5), h('span', {}, 'stars')),
      ),
      h('div', { class: 'xpbar' }, h('i', { style: { width: Math.round(lv.pct * 100) + '%' } })),
      h('div', { class: 'tiny muted', style: { textAlign: 'right' } }, `${lv.into} / ${lv.need} XP to level ${lv.level + 1}`),

      h('div', { class: 'next-card' },
        h('div', { class: 'eyebrow' }, store.starsFor(next.id) ? 'Play again' : 'Up next'),
        h('h3', {}, next.title),
        h('div', { class: 'tiny muted' }, next.subtitle),
        h('div', { class: 'row', style: { marginTop: '8px' } },
          stars(store.starsFor(next.id)),
          h('span', { class: 'tiny muted grow' }, next.teaches.join(' · ')),
        ),
        h('button', { class: 'btn wide primary', style: { marginTop: '14px' }, onClick: () => app.openSong(next.id) },
          '▶  ' + (store.starsFor(next.id) ? 'Play' : 'Start')),
      ),

      h('button', { class: 'btn wide', onClick: () => app.goto('songs') }, '🎵  All songs'),
      h('div', { class: 'row' },
        h('button', { class: 'btn grow', onClick: () => app.goto('tuner') }, '🎚  Tuner'),
        h('button', { class: 'btn grow', onClick: () => app.goto('intro') }, '❓  How to hold it'),
      ),
      cotd(app),

      h('div', { class: 'tiny muted', style: { textAlign: 'center', marginTop: '4px', paddingBottom: '18px' } },
        store.settings.inputMode === 'guitar' ? '🎸 Guitar Mode is on — Fretfire listens to you play' : '👆 Tap Mode — switch to Guitar Mode in settings'),
    ),
  );
}

// A chord to keep your hands warm between sessions. Once you have met a chord
// it never disappears — the ladder moves on, but the shapes need revisiting.
function cotd(app) {
  const { name, preview } = chordOfTheDay();
  const shape = CHORDS[name];
  return h('div', { class: 'card row', style: { alignItems: 'center', gap: '14px' } },
    h('div', { style: { flex: 'none' } }, chordDiagram(name, 0.62)),
    h('div', { class: 'grow' },
      h('div', { class: 'tiny', style: { color: 'var(--hot)', fontWeight: 800, letterSpacing: '1.4px' } },
        preview ? 'COMING UP' : 'CHORD OF THE DAY'),
      h('h3', { style: { fontSize: '1.5rem', fontWeight: 900, margin: '2px 0 6px' } }, name),
      h('div', { class: 'tiny muted' }, shape.tip),
      h('button', {
        class: 'btn', style: { marginTop: '10px' },
        onClick: () => { app.audio.init(); app.audio.strum(chordMidis(shape), 0, 0.9); },
      }, '🔊  Hear it'),
    ),
  );
}

// ── song list ───────────────────────────────────────────────────
export function renderSongs(app) {
  const rows = SONGS.map((song, i) => {
    const unlocked = store.isUnlocked(song.id);
    const st = store.starsFor(song.id);
    return h('button', {
      class: 'songrow' + (unlocked ? '' : ' locked'),
      onClick: () => { if (unlocked) app.openSong(song.id); else app.toast('Finish ' + SONGS[i - 1].title + ' first'); },
    },
      h('div', { class: 'num' }, unlocked ? String(i + 1) : '🔒'),
      h('div', { class: 't' },
        h('b', {}, song.title),
        h('span', {}, song.subtitle),
      ),
      h('div', { style: { textAlign: 'right' } },
        stars(st),
        h('div', { class: 'pips', style: { justifyContent: 'flex-end', marginTop: '5px' } },
          ...Array.from({ length: 5 }, (_, d) => h('i', { class: d < song.difficulty ? 'on' : '' }))),
      ),
    );
  });

  fill('screen-songs',
    topbar('Songs', () => app.goto('home')),
    h('div', { class: 'stack' }, ...rows,
      h('div', { class: 'tiny muted', style: { textAlign: 'center', padding: '10px 0 20px' } },
        'Every tune here is public domain or written for Fretfire.'),
    ),
  );
}

// ── lesson (pre-song coaching) ──────────────────────────────────
export function renderLesson(app, songId) {
  const song = SONGS.find(x => x.id === songId);
  const cards = song.lesson || [];
  let i = 0;

  const demoArt = (demo) => {
    if (!demo) return null;
    if (demo.type === 'chord') return h('div', { class: 'diagram' }, chordDiagram(demo.name));
    if (demo.type === 'string') return h('div', { class: 'diagram' }, stringDiagram(demo.s));
    if (demo.type === 'note') return h('div', { class: 'diagram' }, stringDiagram(demo.s, demo.f));
    return null;
  };
  const hearIt = (demo) => {
    if (!demo) return null;
    const play = () => {
      app.audio.init();
      if (demo.type === 'chord') app.audio.strum(chordMidis(CHORDS[demo.name]), 0, 0.9);
      else app.audio.pluck(midiOf(demo.s, demo.f || 0), 0, 0.9);
    };
    return h('button', { class: 'btn', style: { alignSelf: 'center' }, onClick: play }, '🔊  Hear it');
  };

  const draw = () => {
    const card = cards[i];
    const last = i === cards.length - 1;
    fill('screen-lesson',
      topbar(song.title, () => app.goto('songs')),
      h('div', { class: 'lesson-card' },
        demoArt(card.demo),
        h('h3', {}, card.title),
        h('p', {}, card.body),
        hearIt(card.demo),
      ),
      h('div', { class: 'stack' },
        h('button', {
          class: 'btn wide primary',
          onClick: () => { app.blip(); if (last) app.startSong(songId); else { i++; draw(); } },
        }, last ? '▶  Play it' : 'Next'),
        cards.length > 1 ? h('div', { class: 'dots' }, ...cards.map((_, k) => h('i', { class: k === i ? 'on' : '' }))) : null,
        h('button', {
          class: 'btn ghost', style: { minHeight: 'auto', padding: '6px', fontSize: '.85rem', color: 'var(--faint)', border: 0 },
          onClick: () => app.startSong(songId),
        }, 'Skip the lesson'),
      ),
    );
  };
  draw();
}

// ── results ─────────────────────────────────────────────────────
export function renderResults(app, res, delta) {
  const gradeFor = (a) => a >= 0.95 ? 'S' : a >= 0.86 ? 'A' : a >= 0.70 ? 'B' : a >= 0.55 ? 'C' : a >= 0.35 ? 'D' : 'F';
  const idx = songIndex(res.song.id);
  const next = SONGS[idx + 1];
  const nextPlayable = next && store.isUnlocked(next.id);

  const starRow = h('div', { class: 'bigstars' });
  for (let i = 0; i < 5; i++) {
    const on = i < res.stars;
    const sp = h('span', { class: on ? 'star-pop' : 'off' }, '★');
    if (on) sp.style.animationDelay = (0.12 + i * 0.13) + 's';
    starRow.append(sp);
  }
  // Stagger the star chimes to match the pop animation.
  for (let i = 0; i < res.stars; i++) setTimeout(() => app.audio.blip(760 + i * 190, 0, 0.16, 'triangle', 0.11), 130 + i * 135);
  if (res.stars >= 4) setTimeout(() => app.audio.fanfare(), 130 + res.stars * 135);

  const nextStar = STAR_THRESHOLDS.find(t => t > res.accuracy);

  fill('screen-results',
    topbar(res.failed ? 'Song failed' : res.song.title, () => app.goto('songs')),
    h('div', { class: 'stack' },
      starRow,
      h('div', { class: 'grade' }, gradeFor(res.accuracy)),
      h('div', { class: 'spread card' },
        h('div', {}, h('div', { class: 'tiny muted' }, 'SCORE'), h('b', { style: { fontSize: '1.6rem' } }, res.score.toLocaleString())),
        h('div', { style: { textAlign: 'right' } },
          h('div', { class: 'tiny muted' }, 'ACCURACY'),
          h('b', { style: { fontSize: '1.6rem' } }, Math.round(res.accuracy * 100) + '%')),
      ),
      h('div', { class: 'tally' },
        h('div', {}, h('b', { style: { color: '#FFD93D' } }, res.counts[0]), h('span', {}, 'PERFECT')),
        h('div', {}, h('b', { style: { color: '#6BCB77' } }, res.counts[1]), h('span', {}, 'GREAT')),
        h('div', {}, h('b', { style: { color: '#4D96FF' } }, res.counts[2]), h('span', {}, 'GOOD')),
        h('div', {}, h('b', { style: { color: '#ff5c7a' } }, res.counts[3]), h('span', {}, 'MISS')),
      ),
      h('div', { class: 'spread tiny muted' },
        h('span', {}, 'Best streak ' + res.maxCombo),
        h('span', {}, res.speed !== 1 ? Math.round(res.speed * 100) + '% speed' : ''),
      ),
      res.fullCombo ? h('div', {
        class: 'card', style: { borderColor: 'var(--gold)', textAlign: 'center', fontWeight: 900 },
      }, '✨ FULL COMBO — not a single note missed') : null,

      delta.leveledUp ? h('div', { class: 'card', style: { borderColor: 'var(--hot)' } }, `🎉 Level ${delta.level}!`) : null,
      delta.unlockedNext ? h('div', { class: 'card', style: { borderColor: 'var(--hot)' } }, `🔓 Unlocked: ${delta.unlockedNext.title}`) : null,
      delta.streakUp ? h('div', { class: 'card' }, `🔥 ${delta.streak}-day streak`) : null,
      h('div', { class: 'spread tiny muted' }, h('span', {}, '+' + delta.xpGain + ' XP'), delta.newBest ? h('span', { style: { color: 'var(--hot)' } }, 'NEW BEST') : null),

      res.trouble ? h('div', { class: 'card' },
        h('div', { class: 'tiny muted' }, `Bar ${res.trouble.bar + 1} caught you out ${res.trouble.misses} times.`),
        h('button', { class: 'btn wide', style: { marginTop: '10px' }, onClick: () => app.startSong(res.song.id, { speed: 0.5 }) }, '🐢  Try it at half speed'),
      ) : (nextStar && !res.failed ? h('div', { class: 'tiny muted', style: { textAlign: 'center' } },
        `${Math.round(nextStar * 100)}% accuracy earns your next star.`) : null),

      h('button', { class: 'btn wide primary', onClick: () => app.startSong(res.song.id) }, '↻  Play again'),
      nextPlayable ? h('button', { class: 'btn wide', onClick: () => app.openSong(next.id) }, '▶  Next: ' + next.title) : null,
      h('button', { class: 'btn wide ghost', onClick: () => app.goto('home') }, 'Home'),
      h('div', { style: { height: '20px' } }),
    ),
  );
}

// ── tuner ───────────────────────────────────────────────────────
export function renderTuner(app) {
  let raf = null, target = null;
  const noteEl = h('div', { class: 'tuner-note' }, '—');
  const centsEl = h('i', { style: { left: 'calc(50% - 2px)' } });
  const hintEl = h('div', { class: 'tiny muted', style: { textAlign: 'center', minHeight: '20px' } }, 'Play a string');

  const picks = h('div', { class: 'stringpick' }, ...STRING_NAMES.map((n, i) =>
    h('button', {
      onClick: (e) => {
        target = target === i ? null : i;
        [...picks.children].forEach((b, k) => b.classList.toggle('on', k === target));
        app.audio.pluck(OPEN_MIDI[i], 0, 0.9);
      },
    }, n)));

  const loop = () => {
    raf = requestAnimationFrame(loop);
    const r = app.listener.poll(app.audio.now());
    if (!r) return;
    if (r.midi == null || r.confidence < 0.6) {
      noteEl.textContent = '—'; noteEl.style.color = 'var(--faint)';
      hintEl.textContent = 'Play a string';
      return;
    }
    const nearest = Math.round(r.midi);
    // With a string selected we measure against THAT string, so a badly flat
    // 6th string still reads as "your low E is flat" rather than renaming it.
    const ref = target != null ? OPEN_MIDI[target] : nearest;
    const off = (r.midi - ref) * 100;

    noteEl.textContent = nameOf(nearest);
    const inTune = Math.abs(off) < 6;
    noteEl.style.color = inTune ? 'var(--good)' : Math.abs(off) < 25 ? 'var(--gold)' : 'var(--danger)';
    centsEl.style.left = `calc(${50 + Math.max(-48, Math.min(48, off / 50 * 48))}% - 2px)`;
    centsEl.style.background = inTune ? 'var(--good)' : 'var(--hot)';
    hintEl.textContent = inTune ? 'In tune ✓' : off < 0 ? 'Too low — tighten it' : 'Too high — loosen it';
  };

  const start = async () => {
    const ok = await app.ensureMic();
    if (!ok) { hintEl.textContent = app.listener.error || 'Microphone unavailable'; return; }
    if (!raf) loop();
  };

  fill('screen-tuner',
    topbar('Tuner', () => { if (raf) cancelAnimationFrame(raf); raf = null; app.goto('home'); }),
    h('div', { class: 'stack' },
      h('div', { class: 'card', style: { textAlign: 'center' } },
        noteEl,
        h('div', { class: 'tuner-cents', style: { margin: '18px 0 10px' } }, centsEl),
        hintEl,
      ),
      h('div', { class: 'tiny muted' }, 'Tap a string name to hear the target pitch.'),
      picks,
      h('div', { class: 'card tiny muted' },
        h('b', { style: { color: 'var(--txt)' } }, 'Thick to thin: E A D G B E.'),
        h('div', { style: { marginTop: '6px' } }, 'Turn the peg slowly. If the note is too low, tighten. Strings snap when you go far past the target — go up gently and stop the moment it reads in tune.'),
      ),
    ),
  );
  start();
  return () => { if (raf) cancelAnimationFrame(raf); raf = null; };
}

// ── settings ────────────────────────────────────────────────────
export function renderSettings(app) {
  const st = store.settings;
  const seg = (opts, current, onPick) => h('div', { class: 'seg' },
    ...opts.map(o => h('button', { class: o.value === current ? 'on' : '', onClick: () => { app.blip(); onPick(o.value); } }, o.label)));

  const draw = () => fill('screen-settings',
    topbar('Settings', () => app.goto('home')),
    h('div', { class: 'stack' },
      h('div', {}, h('div', { class: 'tiny muted', style: { marginBottom: '6px' } }, 'HOW YOU PLAY'),
        seg([{ label: '👆 Tap', value: 'tap' }, { label: '🎸 Real guitar', value: 'guitar' }], st.inputMode,
          async (v) => {
            if (v === 'guitar') {
              const ok = await app.ensureMic();
              if (!ok) { app.toast(app.listener.error || 'Microphone unavailable'); return; }
            }
            store.set('inputMode', v); draw();
          })),
      st.inputMode === 'guitar' ? h('div', { class: 'card tiny muted' },
        'Fretfire listens through the mic and checks the note you actually played. Play somewhere quiet, and tune up first.',
        h('button', { class: 'btn', style: { marginTop: '10px' }, onClick: () => app.goto('tuner') }, 'Open the tuner'),
      ) : null,

      h('div', {}, h('div', { class: 'tiny muted', style: { marginBottom: '6px' } }, 'SPEED'),
        seg([{ label: '50%', value: 0.5 }, { label: '75%', value: 0.75 }, { label: 'Full', value: 1 }], st.speed,
          (v) => { store.set('speed', v); draw(); })),

      h('div', {}, h('div', { class: 'tiny muted', style: { marginBottom: '6px' } }, 'VOLUME'),
        h('input', {
          type: 'range', min: 0, max: 1, step: 0.05, value: st.volume,
          onInput: (e) => { store.set('volume', +e.target.value); app.audio.setVolume(+e.target.value); },
          onChange: () => app.audio.pluck(52, 0, 0.9),
        })),

      st.inputMode === 'guitar' ? h('div', {},
        h('div', { class: 'tiny muted', style: { marginBottom: '6px' } }, `MIC DELAY — ${st.inputOffset}ms`),
        h('input', {
          type: 'range', min: 0, max: 200, step: 5, value: st.inputOffset,
          onInput: (e) => {
            store.set('inputOffset', +e.target.value);
            app.listener.inputOffset = +e.target.value / 1000;
            e.target.previousSibling.textContent = `MIC DELAY — ${e.target.value}ms`;
          },
        }),
        h('div', { class: 'tiny muted' }, 'If your hits register late, lower this. If early, raise it.'),
      ) : null,

      h('div', { class: 'card spread' }, h('span', {}, 'Metronome click'),
        h('button', { class: 'btn', onClick: () => { store.set('metronome', !st.metronome); draw(); } }, st.metronome ? 'On' : 'Off')),
      h('div', { class: 'card spread' }, h('span', {}, 'Never fail a song'),
        h('button', { class: 'btn', onClick: () => { store.set('noFail', !st.noFail); draw(); } }, st.noFail ? 'On' : 'Off')),
      h('div', { class: 'card spread' }, h('span', {}, 'Left-handed lanes'),
        h('button', { class: 'btn', onClick: () => { store.set('leftHanded', !st.leftHanded); draw(); } }, st.leftHanded ? 'On' : 'Off')),

      h('button', {
        class: 'btn wide ghost', style: { color: 'var(--danger)' },
        onClick: () => { if (confirm('Erase all progress, stars and levels?')) { store.reset(); app.toast('Progress erased'); app.goto('home'); } },
      }, 'Reset all progress'),
      h('div', { class: 'tiny muted', style: { textAlign: 'center' } }, 'Fretfire · everything stays on this device'),
      h('div', { style: { height: '20px' } }),
    ),
  );
  draw();
}
