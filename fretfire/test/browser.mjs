// The container ships Chromium 1194, which is not the build the current
// playwright package expects. Point at the real binary instead of downloading
// a second copy of a browser that is already on disk.
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const CANDIDATES = [
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome',
  process.env.CHROME_PATH,
].filter(Boolean);

export function launch(opts = {}) {
  const executablePath = CANDIDATES.find(p => existsSync(p));
  return chromium.launch({
    executablePath,
    args: [
      '--autoplay-policy=no-user-gesture-required',   // let Web Audio run headless
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--mute-audio',
    ],
    ...opts,
  });
}
