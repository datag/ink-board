#!/usr/bin/env node
/**
 * ink-board dashboard renderer
 *
 * Usage:
 *   node render.js [--config <path>] [--dry-run] [--debug] [--svg[=path]] [--png[=path]] [--bmp[=path]]
 *
 * Options:
 *   --config <path>   Path to dashboard.json5 (default: dashboard.json5 next to this file)
 *   --dry-run         Render and convert, but skip the upload
 *   --debug           Ignore max_age staleness checks (data files are always read)
 *   --svg[=path]      Write SVG: bare flag -> data_dir/dashboard.svg; or provide path
 *   --png[=path]      Write PNG: bare flag -> data_dir/dashboard.png; or provide path
 *   --bmp[=path]      Write BMP: bare flag -> data_dir/dashboard.bmp; or provide path
 */
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import { loadConfig }   from './src/config.js';
import { loadData }     from './src/dataLoader.js';
import { loadLayout }   from './src/layout.js';
import { layoutToSvg } from './src/renderer.js';
import { renderSvgToCanvas, canvasToBmp, canvasToPng, svgToPng } from './src/converter.js';
import { uploadBmp }    from './src/uploader.js';

const HERE = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = {
    config: resolve(HERE, 'dashboard.json5'),
    dryRun: false,
    debug: false,
    svgOut: null, // null = not requested, true = save to data_dir/dashboard.svg, string = explicit path
    pngOut: null,
    bmpOut: null
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--svg=')) {
      args.svgOut = resolve(arg.split('=')[1]);
      continue;
    }
    if (arg.startsWith('--png=')) {
      args.pngOut = resolve(arg.split('=')[1]);
      continue;
    }
    if (arg.startsWith('--bmp=')) {
      args.bmpOut = resolve(arg.split('=')[1]);
      continue;
    }

    switch (arg) {
      case '--config':  args.config  = resolve(argv[++i]); break;
      case '--dry-run': args.dryRun  = true;               break;
      case '--debug':   args.debug   = true;               break;

      case '--svg':
        if (argv[i+1] && !argv[i+1].startsWith('--')) args.svgOut = resolve(argv[++i]);
        else args.svgOut = true;
        break;
      case '--png':
        if (argv[i+1] && !argv[i+1].startsWith('--')) args.pngOut = resolve(argv[++i]);
        else args.pngOut = true;
        break;
      case '--bmp':
        if (argv[i+1] && !argv[i+1].startsWith('--')) args.bmpOut = resolve(argv[++i]);
        else args.bmpOut = true;
        break;
      case '--help': case '-h':
        console.log('Usage: node render.js [--config dashboard.json5] [--dry-run] [--debug] [--svg[=path]] [--png[=path]] [--bmp[=path]]');
        process.exit(0);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log(`[config]   ${args.config}`);
  const config = loadConfig(args.config);
  console.log(`[device]   ${config.device.url}`);
  console.log(`[layout]   ${config.device.layout}`);

  console.log('[data]     loading sources…');
  if (args.debug) console.log('[debug]    max_age ignored — all present data files will be read');
  const data = loadData(config, args.debug);
  for (const [id, val] of Object.entries(data)) {
    console.log(`           ${id} = ${val}`);
  }

  const layoutPath = resolve(config.configDir, config.device.layout);
  const layout = await loadLayout(layoutPath);
  console.log(`[layout]   ${layout.widgets.length} widgets loaded`);

  console.log('[render]   generating SVG…');
  const svg = layoutToSvg(layout, data);

  // Optional: write SVG to disk when requested (--svg)
  if (args.svgOut) {
    const svgPath = typeof args.svgOut === 'string' ? args.svgOut : resolve(config.device.data_dir, 'dashboard.svg');
    writeFileSync(svgPath, svg);
    console.log(`[svg]      saved SVG → ${svgPath}`);
  }

  console.log('[render]   rasterising SVG to canvas...');
  const canvas = await renderSvgToCanvas(svg);

  // Optional: write PNG to disk when requested (--png)
  if (args.pngOut) {
    const pngBuffer = canvasToPng(canvas);
    const pngPath = typeof args.pngOut === 'string' ? args.pngOut : resolve(config.device.data_dir, 'dashboard.png');
    writeFileSync(pngPath, pngBuffer);
    console.log(`[png]      saved PNG → ${pngPath} (${pngBuffer.length} bytes)`);
  }

  console.log('[convert]  converting canvas → BMP (4-bit)…');
  const t0 = Date.now();
  const bmpBuffer = await canvasToBmp(canvas);
  console.log(`[convert]  done in ${Date.now()-t0}ms (${bmpBuffer.length} bytes BMP)`);

  // Optional: write BMP to disk when requested (--bmp)
  if (args.bmpOut) {
    const bmpPath = typeof args.bmpOut === 'string' ? args.bmpOut : resolve(config.device.data_dir, 'dashboard.bmp');
    writeFileSync(bmpPath, bmpBuffer);
    console.log(`[bmp]      saved BMP → ${bmpPath}`);
  }

  if (args.dryRun) {
    console.log('[dry-run]  skipping upload');
    return;
  }

  console.log('[upload]   sending to device…');
  const t1 = Date.now();
  await uploadBmp(config.device.url, bmpBuffer);
  console.log(`[upload]   round-trip: ${Date.now()-t1}ms`);
}

main().catch(err => {
  console.error('[error]', err.message);
  process.exit(1);
});
