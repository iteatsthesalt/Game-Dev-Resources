import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BRAND = '#1d4ed8';
const MASKABLE_ART = 288;

export async function renderIcons({ svgPath, outDir }) {
  const dataUrl = `data:image/svg+xml;base64,${readFileSync(svgPath).toString('base64')}`;
  const icons = [
    ['icon-192.png', 192, 192, ''],
    ['icon-512.png', 512, 512, ''],
    ['maskable-512.png', 512, MASKABLE_ART, `height:100vh;background:${BRAND};display:flex;align-items:center;justify-content:center;`],
  ];
  const browser = await chromium.launch();
  try {
    const written = [];
    for (const [name, size, art, bodyStyle] of icons) {
      const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
      await page.setContent(`<!doctype html><html><body style="margin:0;${bodyStyle}"><img id="art" src="${dataUrl}" width="${art}" height="${art}" style="display:block"></body></html>`);
      await page.evaluate(() => document.getElementById('art').decode());
      const path = join(outDir, name);
      await page.screenshot({ path, omitBackground: true });
      await page.close();
      written.push(path);
    }
    return written;
  } finally {
    await browser.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = join(APP_ROOT, 'src/assets/icons');
  for (const path of await renderIcons({ svgPath: join(dir, 'icon.svg'), outDir: dir })) console.log(path);
}
