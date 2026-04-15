// Parses and validates a dashboard.json5 config file.
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import JSON5 from 'json5';

/**
 * @typedef {Object} Source
 * @property {string} id
 * @property {string} file
 * @property {string} [key]        - dot-path into JSON (omit for .txt)
 * @property {number} max_age      - seconds; file older than this is stale
 * @property {string} [stale_placeholder]
 */

/**
 * @typedef {Object} Config
 * @property {{ url: string, data_dir: string, layout: string }} device
 * @property {Source[]} sources
 * @property {string} configDir    - directory of the config file (for resolving layout)
 */

/**
 * Load and validate a JSON5 config file.
 * @param {string} configPath
 * @returns {Config}
 */
export function loadConfig(configPath) {
  const absPath = resolve(configPath);
  const raw = readFileSync(absPath, 'utf8');
  const cfg = JSON5.parse(raw);

  if (!cfg.device) throw new Error('Config missing "device" block');
  const { url, data_dir, layout } = cfg.device;
  if (!url)      throw new Error('Config missing device.url');
  if (!data_dir) throw new Error('Config missing device.data_dir');
  if (!layout)   throw new Error('Config missing device.layout');

  if (!Array.isArray(cfg.sources) || cfg.sources.length === 0) {
    throw new Error('Config must have at least one entry in "sources"');
  }
  for (const [i, src] of cfg.sources.entries()) {
    if (!src.id)   throw new Error(`sources[${i}] missing "id"`);
    if (!src.file) throw new Error(`sources[${i}] missing "file"`);
    if (typeof src.max_age !== 'number' || src.max_age <= 0) {
      throw new Error(`sources[${i}] "max_age" must be a positive number (seconds)`);
    }
  }

  return { ...cfg, configDir: dirname(absPath) };
}
