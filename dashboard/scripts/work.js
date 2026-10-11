#!/usr/bin/env node
/**
 * scripts/work.js
 *
 * Checks whether the configured work host is reachable via TCP connect
 * (or active ECONNREFUSED response) and writes the result to {data_dir}/work.json.
 *
 * Usage:
 *   node scripts/work.js [--config <path>]
 *
 * Config keys (in dashboard.json5 -> scripts.work):
 *   host    - hostname or IP address to check
 *   port    - optional TCP port to probe (default: 22)
 *   timeout - optional timeout in ms (default: 2000, max: 2000)
 */
import { mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import net from 'net';
import { loadConfig } from '../src/config.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = 22;
const DEFAULT_TIMEOUT_MS = 2000;

function parseArgs(argv) {
  const args = { config: resolve(HERE, '../dashboard.json5') };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--config') args.config = resolve(argv[++i]);
  }
  return args;
}

function probeHost(host, port = DEFAULT_PORT, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return new Promise(resolve => {
    const socket = new net.Socket();
    let isReachable = false;
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);

    socket.connect(port, host, () => {
      isReachable = true;
      finish(true);
    });

    socket.on('error', err => {
      // ECONNREFUSED means the host actively responded with RST -> online!
      if (err.code === 'ECONNREFUSED') {
        finish(true);
        return;
      }
      finish(false);
    });

    socket.on('timeout', () => {
      finish(false);
    });

    socket.on('close', () => {
      finish(isReachable);
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig(args.config);
  const host = config.scripts?.work?.host;
  if (!host) throw new Error('Missing scripts.work.host in config');

  const port = config.scripts?.work?.port ?? DEFAULT_PORT;
  const timeoutMs = Math.min(config.scripts?.work?.timeout ?? DEFAULT_TIMEOUT_MS, 2000);

  const dataDir = resolve(config.device.data_dir);
  mkdirSync(dataDir, { recursive: true });

  console.log(`[work]     probing ${host}:${port} (timeout ${timeoutMs}ms)…`);
  const reachable = await probeHost(host, port, timeoutMs);
  const status = reachable ? 'reachable' : 'unreachable';
  const outFile = resolve(dataDir, 'work.json');
  writeFileSync(outFile, JSON.stringify({ status }));
  console.log(`[work]     ${host} is ${status} → ${outFile}`);
}

main().catch(err => {
  console.error('[work]     error:', err.message);
  process.exit(1);
});
