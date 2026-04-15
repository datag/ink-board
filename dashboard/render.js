#!/usr/bin/env node
/**
 * ink-board dashboard renderer
 *
 * Usage:
 *   node render.js [--config <path>] [--dry-run] [--out <path>]
 *
 * Options:
 *   --config <path>   Path to dashboard.json5 (default: dashboard.json5 next to this file)
 *   --dry-run         Render and convert, but skip the upload
 *   --out <path>      Save a copy of the generated BMP to <path>
 */
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import { loadConfig }    from './src/config.js';
import { loadData }      from './src/dataLoader.js';
import { renderTemplate } from './src/renderer.js';
import { pngToBmp }      from './src/converter.js';
import { uploadBmp }     from './src/uploader.js';

const HERE = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = { config: resolve(HERE, 'dashboard.json5'), dryRun: false, out: null };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--config':   args.config  = resolve(argv[++i]); break;
      case '--dry-run':  args.dryRun  = true;               break;
      case '--out':      args.out     = resolve(argv[++i]); break;
      case '--help': case '-h':
        console.log(
          'Usage: node render.js [--config dashboard.json5] [--dry-run] [--out out.bmp]'
        );
        process.exit(0);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log(`[config]      ${args.config}`);
  const config = loadConfig(args.config);
  console.log(`[device]      ${config.device.url}`);
  console.log(`[data_dir]    ${config.device.data_dir}`);
  console.log(`[template]    ${config.device.template}`);

  console.log('[data]        loading sources…');
  const data = loadData(config);
  for (const [id, val] of Object.entries(data)) {
    console.log(`              ${id} = ${val}`);
  }

  console.log('[render]      launching Puppeteer…');
  const templatePath = resolve(config.configDir, config.device.template);
  const pngBuffer = await renderTemplate(templatePath, data);
  console.log(`[render]      screenshot done (${pngBuffer.length} bytes PNG)`);

  const debugPng = resolve(HERE, 'debug.png');
  writeFileSync(debugPng, pngBuffer);
  console.log(`[debug]       PNG saved → ${debugPng}`);

  console.log('[convert]     running png2bmp.sh --4bit…');
  const bmpBuffer = await pngToBmp(pngBuffer);
  console.log(`[convert]     done (${bmpBuffer.length} bytes BMP)`);

  if (args.out) {
    writeFileSync(args.out, bmpBuffer);
    console.log(`[out]         saved BMP → ${args.out}`);
  }

  if (args.dryRun) {
    console.log('[dry-run]     skipping upload');
    return;
  }

  console.log('[upload]      sending to device…');
  await uploadBmp(config.device.url, bmpBuffer);
}

main().catch(err => {
  console.error('[error]', err.message);
  process.exit(1);
});
