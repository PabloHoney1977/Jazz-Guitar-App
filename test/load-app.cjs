// Test harness: loads app.js's pure music-theory layer in a sandboxed VM
// with minimal browser stubs, without modifying app.js. The file ends with a
// ReactDOM render wrapped in try/catch, so it fails harmlessly under stubs;
// we append a capture line to expose the module-scoped functions/data tables.
//
// This keeps app.js a single, build-free file while still making its pure
// logic unit-testable. If a captured name is renamed in app.js, the test for
// it throws "undefined", which is the signal to update this list.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APP = path.join(__dirname, '..', 'app.js');

const CAPTURE_NAMES = [
  // functions
  'getChordTones', 'getExtTones', 'getRootlessTones',
  'calcVoicing', 'calcFingering', 'getScalePos', 'getArpPos', 'getParentRoot', 'nn',
  // data tables
  'INTERVALS', 'DNAMES', 'RL_DNAMES', 'EXT_TYPES', 'CHORD_SCALES', 'INT_NAMES',
  'QTYPES', 'QSYMS', 'ROMAN', 'MAJOR_SCALE', 'OPEN_MIDI', 'OPEN_PC', 'STR_NAMES',
  'KEYS', 'FLAT_KEYS', 'N_SHARP', 'N_FLAT', 'PARENT_SC', 'ROOTLESS_OK',
  'SHELLS', 'D2_INV', 'D2_SETS', 'D3_INV', 'D3_SETS', 'ROOTLESS',
];

function noop() {}
function makeReact() {
  const R = {
    createElement: () => ({ __el: true }),
    useState: (v) => [typeof v === 'function' ? undefined : v, noop],
    useMemo: (f) => (typeof f === 'function' ? undefined : f),
    useEffect: noop,
    useRef: () => ({ current: null }),
    useCallback: (f) => f,
    useContext: () => undefined,
    useReducer: (r, s) => [s, noop],
    useLayoutEffect: noop,
    memo: (f) => f,
    forwardRef: (f) => f,
    createContext: () => ({ Provider: 'Provider', Consumer: 'Consumer' }),
    Fragment: 'Fragment',
  };
  return R;
}

function loadApp() {
  const src = fs.readFileSync(APP, 'utf8');
  const capture =
    '\n;globalThis.__JG__ = {' +
    CAPTURE_NAMES.map((n) => `${n}: (typeof ${n} !== 'undefined' ? ${n} : undefined)`).join(',') +
    '};\n';

  const sandbox = {};
  const storage = {};
  const localStorageStub = {
    getItem: (k) => (k in storage ? storage[k] : null),
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: (k) => { delete storage[k]; },
    clear: () => { for (const k of Object.keys(storage)) delete storage[k]; },
  };
  Object.assign(sandbox, {
    React: makeReact(),
    ReactDOM: { createRoot: () => ({ render: noop }), render: noop },
    document: {
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => ({ style: {}, setAttribute: noop, appendChild: noop }),
      addEventListener: noop,
      removeEventListener: noop,
      documentElement: { style: {} },
      body: { style: {}, appendChild: noop },
    },
    localStorage: localStorageStub,
    navigator: { userAgent: 'node-test', language: 'en-US', maxTouchPoints: 0 },
    location: { href: 'http://localhost/', reload: noop },
    AudioContext: function () { return {}; },
    webkitAudioContext: function () { return {}; },
    OfflineAudioContext: function () { return {}; },
    fetch: () => Promise.resolve({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)), ok: true }),
    requestAnimationFrame: (cb) => setTimeout(cb, 0),
    cancelAnimationFrame: noop,
    setTimeout, clearTimeout, setInterval, clearInterval,
    console,
    speechSynthesis: { cancel: noop, speak: noop, getVoices: () => [] },
    SpeechSynthesisUtterance: function () {},
    matchMedia: () => ({ matches: false, addEventListener: noop, addListener: noop }),
    performance: { now: () => Date.now() },
  });
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.window.matchMedia = sandbox.matchMedia;
  sandbox.window.addEventListener = noop;
  sandbox.window.removeEventListener = noop;
  sandbox.window.visualViewport = { width: 800, height: 600, addEventListener: noop, removeEventListener: noop };
  sandbox.window.scrollTo = noop;
  sandbox.window.innerWidth = 800;
  sandbox.window.innerHeight = 600;

  vm.createContext(sandbox);
  vm.runInContext(src + capture, sandbox, { filename: 'app.js' });
  if (!sandbox.__JG__) throw new Error('Harness failed: __JG__ not captured');
  return sandbox.__JG__;
}

module.exports = { loadApp, CAPTURE_NAMES };
