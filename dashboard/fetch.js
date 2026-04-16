#!/usr/bin/env node
/**
 * fetch.js
 *
 * Orchestrates all enabled data-fetching scripts.
 * Reads scripts.{key}.enabled from config; for each enabled entry, spawns
 * `node scripts/{key}.js --config <path>` and streams its output.
 * A failing script prints an error but does not abort the run.
 *
 * Usage:
 *   node fetch.js [--config <path>]
 */
import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadConfig } from './src/config.js';

const HERE = dirname(fileURLToPath(import.meta.url));

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { config: resolve(HERE, 'dashboard.json5') };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--config') args.config = resolve(argv[++i]);
  }
  return args;
}

// ── Run one script ────────────────────────────────────────────────────────────

function runScript(key, configPath) {
  return new Promise(resolve => {
    const scriptPath = new URL(`scripts/${key}.js`, import.meta.url).pathname;
    const child = spawn(process.execPath, [scriptPath, '--config', configPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout.on('data', chunk => process.stdout.write(chunk));
    child.stderr.on('data', chunk => process.stderr.write(chunk));

    child.on('close', code => resolve(code));
    child.on('error', err => {
      console.error(`[fetch]    could not start ${key}: ${err.message}`);
      resolve(1);
    });
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args   = parseArgs(process.argv.slice(2));
  const config = loadConfig(args.config);
  const scripts = config.scripts ?? {};

  const enabled = Object.keys(scripts).filter(key => scripts[key]?.enabled === true);

  if (enabled.length === 0) {
    console.log('[fetch]    no scripts with enabled:true found in config');
    return;
  }

  console.log(`[fetch]    running ${enabled.length} script(s): ${enabled.join(', ')}`);

  let passed = 0;
  let failed = 0;

  for (const key of enabled) {
    process.stdout.write(`\n[fetch]    ── ${key} ${'─'.repeat(Math.max(0, 50 - key.length))}\n`);
    const code = await runScript(key, args.config);
    if (code === 0) {
      console.log(`[fetch]    ✓ ${key}`);
      passed++;
    } else {
      console.error(`[fetch]    ✗ ${key} (exit ${code})`);
      failed++;
    }
  }

  console.log(`\n[fetch]    done — ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main().catch(err => {
  console.error('[fetch]    fatal:', err.message);
  process.exit(1);
});
