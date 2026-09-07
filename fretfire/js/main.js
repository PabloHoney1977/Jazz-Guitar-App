// Boot, routing, and everything that wires the play screen to real input.

import { audio } from './audio.js';
import { Listener } from './pitch.js';
import { Game } from './game.js';
import { store } from './store.js';
import { SONGS } from './songs.js';
import { STRING_NAMES, LANE_COLORS } from './theory.js';
import { h, renderIntro, renderHome, renderSongs, renderLesson, renderResults, renderTuner, renderSettings } from './ui.js';

const listener = new Listener(audio);
const canvas = document.getElementById('stage');
const game = new Game(canvas, audio, listener);

let currentScreen = null;
let leaveScreen = null;      // teardown for screens that own a loop (the tuner)

const app = {
  audio, listener, game, store,

  goto(name, arg) {
    if (leaveScreen) { leaveScreen(); leaveScreen = null; }
    if (currentScreen === 'play' && name !== 'play') game.stop();
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
    const el = document.getElementById('screen-' + name);
    if (el) el.classList.add('on');
    currentScreen = name;
    window.scrollTo(0, 0);

    if (name === 'home') renderHome(app);
    else if (name === 'songs') renderSongs(app);
    else if (name === 'intro') renderIntro(app);
    else if (name === 'settings') renderSettings(app);
    else if (name === 'tuner') leaveScreen = renderTuner(app);
    else if (name === 'lesson') renderLesson(app, arg);
  },

  // First time through a song you get the lesson. After that you have already
  // been told, and being told again is how a game turns into homework.
  openSong(id) {
    audio.init();
    if (store.starsFor(id) > 0) app.startSong(id);
    else app.goto('lesson', id);
  },

  startSong(id, override = {}) {
    const song = SONGS.find(s => s.id === id);
    if (!song) return;
    audio.init();
    audio.setVolume(store.settings.volume);
    listener.inputOffset = store.settings.inputOffset / 1000;

    const opts = {
      speed: override.speed || store.settings.speed,
      inputMode: store.settings.inputMode,
      noFail: store.settings.noFail,
      leftHanded: store.settings.leftHanded,
      metronome: store.settings.metronome,
    };
    app.goto('play');
    buildPlayChrome(song, opts);
    game.load(song, opts);
    game.onUpdate = updateHud;
    game.onEnd = (res) => {
      const delta = store.recordRun(song.id, {
        score: res.score, accuracy: res.accuracy, maxCombo: res.maxCombo,
        stars: res.stars, notesHit: res.notesHit, fullCombo: res.fullCombo,
      });
      app.goto('results');
      renderResults(app, res, delta);
    };
    requestAnimationFrame(() => { game.resize(); game.start(); });
  },

  async ensureMic() {
    audio.init();
    if (listener.running) return true;
    const ok = await listener.start();
    if (ok) await listener.calibrateNoise(700);
    return ok;
  },

  blip() { audio.init(); audio.blip(880, 0, 0.06, 'square', 0.06); },

  toast(msg) {
    const t = h('div', {
      class: 'card',
      style: {
        position: 'fixed', left: '50%', bottom: '28px', transform: 'translateX(-50%)',
        zIndex: 60, maxWidth: '90%', textAlign: 'center', fontSize: '.9rem',
        boxShadow: '0 12px 40px -12px #000',
      },
    }, msg);
    document.body.append(t);
    setTimeout(() => t.remove(), 2200);
  },
};

// ── play-screen chrome ──────────────────────────────────────────
const el = (id) => document.getElementById(id);

function buildPlayChrome(song, opts) {
  const pads = el('lane-pads');
  const strum = el('strum-bar');
  const mic = el('mic-live');
  const guitarMode = opts.inputMode === 'guitar';
  const chordSong = song.kind === 'chords';

  pads.replaceChildren();
  pads.hidden = guitarMode || chordSong;
  strum.hidden = guitarMode || !chordSong;
  mic.hidden = !guitarMode;

  if (!pads.hidden) {
    const order = opts.leftHanded ? [5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5];
    order.forEach(i => {
      const b = h('button', { class: 'lanebtn', style: { color: LANE_COLORS[i] } },
        STRING_NAMES[i], h('small', {}, i === 0 ? 'low' : i === 5 ? 'high' : ''));
      const down = (e) => { e.preventDefault(); b.classList.add('down'); game.pressLane(i); };
      const up = (e) => { e.preventDefault(); b.classList.remove('down'); game.releaseLane(i); };
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
      pads.append(b);
    });
  }
  if (!strum.hidden) {
    const down = (e) => { e.preventDefault(); strum.classList.add('down'); game.strum(); };
    const up = () => strum.classList.remove('down');
    strum.onpointerdown = down; strum.onpointerup = up; strum.onpointercancel = up;
  }
  el('hud-chord').textContent = '';
}

function updateHud(hud) {
  el('hud-score').textContent = hud.score.toLocaleString();
  el('hud-acc').textContent = Math.round(hud.accuracy * 100) + '%';
  el('hud-mult').textContent = '×' + hud.mult;
  el('hud-mult').style.color = hud.fireActive > 0 ? 'var(--gold)' : 'var(--hot)';
  el('hud-fire').style.height = Math.round(hud.fire * 100) + '%';
  el('hud-health').style.height = Math.max(0, Math.round(hud.health)) + '%';

  const combo = el('hud-combo');
  combo.hidden = hud.combo < 3;
  if (!combo.hidden) combo.querySelector('b').textContent = hud.combo;

  // Name the chord that is coming, for as long as it is still coming.
  const nextChord = game.notes.find(n => !n.judged && n.type === 'chord');
  el('hud-chord').textContent = nextChord ? 'next: ' + nextChord.name : '';
}

// ── pause ───────────────────────────────────────────────────────
let pauseMenu = null;
function togglePause() {
  if (game.state === 'paused') return closePause();
  if (game.state !== 'playing' && game.state !== 'countdown') return;
  game.pause();
  pauseMenu = h('div', {
    style: {
      position: 'absolute', inset: 0, zIndex: 20, display: 'flex', flexDirection: 'column',
      justifyContent: 'center', gap: '12px', padding: '24px', background: 'rgba(8,4,20,.86)',
    },
  },
    h('h2', { style: { textAlign: 'center', fontSize: '1.6rem', fontWeight: 900 } }, 'Paused'),
    h('button', { class: 'btn wide primary', onClick: closePause }, 'Keep playing'),
    h('button', { class: 'btn wide', onClick: () => { closePause(); app.startSong(game.song.id); } }, 'Start over'),
    h('button', {
      class: 'btn wide', onClick: () => {
        const s = game.rate === 1 ? 0.75 : game.rate === 0.75 ? 0.5 : 1;
        closePause(); app.startSong(game.song.id, { speed: s });
      },
    }, 'Change speed (now ' + Math.round(game.rate * 100) + '%)'),
    h('button', { class: 'btn wide ghost', onClick: () => { closePause(); game.stop(); app.goto('songs'); } }, 'Quit to songs'),
  );
  el('screen-play').append(pauseMenu);
}
function closePause() {
  if (pauseMenu) { pauseMenu.remove(); pauseMenu = null; }
  if (game.state === 'paused') game.resume();
}

// ── keyboard ────────────────────────────────────────────────────
const KEY_LANES = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5,
                    KeyA: 0, KeyS: 1, KeyD: 2, KeyF: 3, KeyG: 4, KeyH: 5 };

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'Escape') { if (currentScreen === 'play') togglePause(); return; }
  if (currentScreen !== 'play' || game.state !== 'playing') return;
  if (e.code === 'Space') { e.preventDefault(); game.strum(); flashStrum(true); return; }
  if (e.code === 'KeyQ') { game.activateFire(); return; }
  const lane = KEY_LANES[e.code];
  if (lane != null) {
    e.preventDefault();
    game.pressLane(store.settings.leftHanded ? 5 - lane : lane);
    const pads = el('lane-pads').children;
    if (pads[lane]) pads[lane].classList.add('down');
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') flashStrum(false);
  const lane = KEY_LANES[e.code];
  if (lane != null) {
    game.releaseLane(store.settings.leftHanded ? 5 - lane : lane);
    const pads = el('lane-pads').children;
    if (pads[lane]) pads[lane].classList.remove('down');
  }
});
function flashStrum(on) {
  const s = el('strum-bar');
  if (s && !s.hidden) s.classList.toggle('down', on);
}

el('btn-pause').addEventListener('click', togglePause);
window.addEventListener('resize', () => { if (currentScreen === 'play') game.resize(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden && currentScreen === 'play' && game.state === 'playing') togglePause();
});

// Any first touch anywhere unlocks audio — browsers require a gesture, and the
// worst possible first impression is a silent rhythm game.
const unlock = () => { audio.init(); window.removeEventListener('pointerdown', unlock); };
window.addEventListener('pointerdown', unlock);

// ── go ──────────────────────────────────────────────────────────
document.getElementById('boot').remove();
window.dispatchEvent(new Event('fretfire:ready'));
app.goto(store.data.seenIntro ? 'home' : 'intro');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

window.fretfire = app;   // handy in the console and for the smoke tests
