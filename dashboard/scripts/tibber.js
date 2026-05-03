#!/usr/bin/env node
/**
 * scripts/tibber.js
 *
 * Fetches the current electricity price and live power consumption from the
 * Tibber GraphQL API and writes them as JSON files to the configured data_dir.
 *
 * Usage:
 *   node scripts/tibber.js [--config <path>]
 *
 * Writes:
 *   <data_dir>/tibber_price.json  — { total, level, startsAt }
 *   <data_dir>/tibber_power.json  — { power, powerProduction, powerNet, accumulatedCost }
 *                                    powerNet = power - powerProduction (negative = exporting to grid)
 *
 * Config keys (in dashboard.json5 → scripts.tibber):
 *   access_token  — Tibber personal access token
 */
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import WebSocket from 'ws';
import { loadConfig } from '../src/config.js';

const HERE = dirname(fileURLToPath(import.meta.url));

const GQL_HTTP = 'https://api.tibber.com/v1-beta/gql';
const GQL_WS   = 'wss://api.tibber.com/v1-beta/gql';
const WS_TIMEOUT_MS = 20_000;

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { config: resolve(HERE, '../dashboard.json5') };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--config') args.config = resolve(argv[++i]);
  }
  return args;
}

// ── GraphQL HTTP ──────────────────────────────────────────────────────────────

async function gqlFetch(query, token) {
  const res = await fetch(GQL_HTTP, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Tibber HTTP ${res.status}: ${await res.text()}`);
  const { data, errors } = await res.json();
  if (errors?.length) throw new Error(`Tibber GQL error: ${errors[0].message}`);
  return data;
}

// ── Price fetch ───────────────────────────────────────────────────────────────

async function fetchPrice(token) {
  const data = await gqlFetch(
    `{ viewer {
        websocketSubscriptionUrl
        homes { id currentSubscription { priceInfo { current { total level startsAt } } } }
    } }`,
    token,
  );
  const home = data.viewer.homes[0];
  const price = home.currentSubscription.priceInfo.current;
  return { homeId: home.id, wsUrl: data.viewer.websocketSubscriptionUrl, price };
}

// ── Live power fetch (WebSocket, graphql-ws protocol) ────────────────────────

function fetchPower(wsUrl, homeId, token) {
  return new Promise((resolveP, rejectP) => {
    const ws = new WebSocket(wsUrl, ['graphql-transport-ws'], {
      headers: { 'User-Agent': 'ink-board/1.0' },
    });
    let settled = false;

    const done = (val, err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      ws.close();
      err ? rejectP(err) : resolveP(val);
    };

    const timer = setTimeout(
      () => done(null, new Error('Tibber live measurement timed out (Pulse offline?)')),
      WS_TIMEOUT_MS,
    );

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'connection_init', payload: { token } }));
    });

    ws.on('message', raw => {
      const msg = JSON.parse(raw);
      switch (msg.type) {
        case 'connection_ack':
          ws.send(JSON.stringify({
            type: 'subscribe',
            id: '1',
            payload: {
              query: `subscription { liveMeasurement(homeId: "${homeId}") { power powerProduction accumulatedCost } }`,
            },
          }));
          break;
        case 'next': {
          const lm = msg.payload.data.liveMeasurement;
          const powerNet = (lm.power ?? 0) - (lm.powerProduction ?? 0);
          done({ ...lm, powerNet });
          break;
        }
        case 'error':
          done(null, new Error(`Tibber WS error: ${JSON.stringify(msg.payload)}`));
          break;
      }
    });

    ws.on('error', err => done(null, err));
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args   = parseArgs(process.argv.slice(2));
  const config = loadConfig(args.config);
  const token  = config.scripts?.tibber?.access_token;

  if (!token) throw new Error('Missing scripts.tibber.access_token in config');

  const dataDir = resolve(config.device.data_dir);

  // Price + home ID
  console.log('[tibber]   fetching price…');
  const { homeId, wsUrl, price } = await fetchPrice(token);
  writeFileSync(resolve(dataDir, 'tibber_price.json'), JSON.stringify(price));
  console.log(`[tibber]   price: ${price.total} ${price.level} (${price.startsAt})`);

  // Live power
  console.log('[tibber]   fetching live power…');
  try {
    const power = await fetchPower(wsUrl, homeId, token);
    writeFileSync(resolve(dataDir, 'tibber_power.json'), JSON.stringify(power));
    console.log(`[tibber]   power: ${power.powerNet} W net (${power.power} W consumption, ${power.powerProduction ?? 0} W production), accumulated cost: ${power.accumulatedCost}`);
  } catch (err) {
    console.warn(`[tibber]   power skipped: ${err.message}`);
  }
}

main().catch(err => {
  console.error('[tibber]  error:', err.message);
  process.exit(1);
});
