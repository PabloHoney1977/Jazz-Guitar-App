// Rasterise icons/icon.svg into the PNG sizes the manifest and iOS need.
// There is no ImageMagick or cairo in this environment, but there IS a browser,
// and a browser is a very good SVG renderer.
import { launch } from './browser.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const svg = await readFile(root + 'icons/icon.svg', 'utf8');
const browser = await launch();

for (const size of [180, 512, 1024]) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<body style="margin:0">${svg.replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body>`);
  const buf = await page.screenshot({ omitBackground: true });
  await writeFile(`${root}icons/icon-${size}.png`, buf);
  console.log(`icons/icon-${size}.png`);
  await page.close();
}
await browser.close();
