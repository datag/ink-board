#!/usr/bin/env node
/**
 * scripts/work.js
 *
 * Checks whether the configured work host responds to one short ping and
 * writes the result to {data_dir}/work.json.
 *
 * Usage:
 *   node scripts/work.js [--config <path>]
 *
 * Config keys (in dashboard.json5 -> scripts.work):
 *   host - hostname or IP address to check
 */
import { mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { loadConfig } from '../src/config.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PING_TIMEOUT_SECONDS = '1';

function parseArgs(argv) {
  const args = { config: resolve(HERE, '../dashboard.json5') };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--config') args.config = resolve(argv[++i]);
  }
  return args;
}

function pingHost(host) {
  return new Promise(resolve => {
    execFile('ping', ['-c', '1', '-W', PING_TIMEOUT_SECONDS, host], error => {
      if (!error) {
        resolve(true);
        return;
      }
      if (typeof error.code !== 'number') {
        console.warn(`[work]     ping unavailable (${error.message}); treating host as unreachable`);
      }
      resolve(false);
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig(args.config);
  const host = config.scripts?.work?.host;
  if (!host) throw new Error('Missing scripts.work.host in config');

  const dataDir = resolve(config.device.data_dir);
  mkdirSync(dataDir, { recursive: true });

  console.log(`[work]     pinging ${host}…`);
  const reachable = await pingHost(host);
  const status = reachable ? 'reachable' : 'unreachable';
  const outFile = resolve(dataDir, 'work.json');
  writeFileSync(outFile, JSON.stringify({ status }));
  console.log(`[work]     ${host} is ${status} → ${outFile}`);
}

main().catch(err => {
  console.error('[work]     error:', err.message);
  process.exit(1);
});
