#!/usr/bin/env node
/**
 * scripts/weather.js
 *
 * Fetches the current temperature and weather condition from Open-Meteo
 * (free, no API key, DWD-backed data for Germany) and writes the result
 * as JSON to {data_dir}/weather.json.
 *
 * Usage:
 *   node scripts/weather.js [--config <path>]
 *
 * Writes:
 *   <data_dir>/weather.json  — { temp_c, weather_code, description }
 *
 * Config keys (in dashboard.json5 → scripts.weather):
 *   lat  — latitude
 *   lon  — longitude
 */
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadConfig } from '../src/config.js';

const HERE = dirname(fileURLToPath(import.meta.url));

const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast';

// WMO weather code → German description
const WMO_DE = {
  0:  'Klar',
  1:  'Überwiegend klar',
  2:  'Leicht bewölkt',
  3:  'Bedeckt',
  45: 'Nebel',
  48: 'Nebel',
  51: 'Nieselregen',
  53: 'Nieselregen',
  55: 'Nieselregen',
  61: 'Regen',
  63: 'Regen',
  65: 'Starkregen',
  71: 'Schneefall',
  73: 'Schneefall',
  75: 'Starker Schnee',
  77: 'Eiskörnchen',
  80: 'Regenschauer',
  81: 'Regenschauer',
  82: 'Starke Schauer',
  85: 'Schneeschauer',
  86: 'Schneeschauer',
  95: 'Gewitter',
  96: 'Gew. + Hagel',
  99: 'Gew. + Hagel',
};

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { config: resolve(HERE, '../dashboard.json5') };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--config') args.config = resolve(argv[++i]);
  }
  return args;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args   = parseArgs(process.argv.slice(2));
  const config = loadConfig(args.config);
  const { lat, lon } = config.scripts?.weather ?? {};

  if (lat == null || lon == null) throw new Error('Missing scripts.weather.lat / .lon in config');

  const dataDir = resolve(config.device.data_dir);
  const url = `${OPEN_METEO}?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=Europe%2FBerlin`;

  console.log(`[weather]  fetching ${lat}, ${lon}…`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}: ${await res.text()}`);

  const { current } = await res.json();
  const temp_c      = current.temperature_2m;
  const weather_code = current.weather_code;
  const description = WMO_DE[weather_code] ?? `Code ${weather_code}`;

  const data = { temp_c, weather_code, description };
  writeFileSync(resolve(dataDir, 'weather.json'), JSON.stringify(data));
  console.log(`[weather]  ${temp_c} °C, ${description} (code ${weather_code})`);
}

main().catch(err => {
  console.error('[weather]  error:', err.message);
  process.exit(1);
});
