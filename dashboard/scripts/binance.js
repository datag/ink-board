#!/usr/bin/env node
/**
 * scripts/binance.js
 *
 * Fetches the current spot price for a given symbol from the Binance REST API
 * and writes the response JSON to {data_dir}/binance_{symbol_lower}.json.
 *
 * Usage:
 *   node scripts/binance.js <SYMBOL> [--config <path>]
 *   node scripts/binance.js BTCUSDT
 *
 * Writes:
 *   <data_dir>/binance_btcusdt.json  — { symbol, price }
 *
 * Config keys (in dashboard.json5 → scripts.binance):
 *   api_key  — Binance API key (optional; null means unauthenticated)
 */
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadConfig } from '../src/config.js';

const HERE = dirname(fileURLToPath(import.meta.url));

const BINANCE_TICKER = 'https://api.binance.com/api/v3/ticker/price';

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { config: resolve(HERE, '../dashboard.json5'), symbol: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--config') args.config = resolve(argv[++i]);
    else if (!argv[i].startsWith('--')) args.symbol = argv[i].toUpperCase();
  }
  return args;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.symbol) throw new Error('Usage: node scripts/binance.js <SYMBOL>');

  const config  = loadConfig(args.config);
  const apiKey  = config.scripts?.binance?.api_key ?? null;
  const dataDir = resolve(config.device.data_dir);

  const url     = `${BINANCE_TICKER}?symbol=${args.symbol}`;
  const headers = apiKey ? { 'X-MBX-APIKEY': apiKey } : {};

  console.log(`[binance]  fetching ${args.symbol}…`);
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Binance HTTP ${res.status}: ${await res.text()}`);

  const data     = await res.json();
  const outFile  = resolve(dataDir, `binance_${args.symbol.toLowerCase()}.json`);
  writeFileSync(outFile, JSON.stringify(data));
  console.log(`[binance]  ${data.symbol}: ${data.price} → ${outFile}`);
}

main().catch(err => {
  console.error('[binance]  error:', err.message);
  process.exit(1);
});
