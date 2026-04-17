// Reads data files from the hot-folder and checks staleness per source.
import { readFileSync, statSync, existsSync } from 'fs';
import { resolve } from 'path';

const DEFAULT_PLACEHOLDER = '\u2014'; // em dash

/**
 * Resolve a nested value from an object using a dot-path string.
 * Returns undefined if any segment is missing.
 * @param {object} obj
 * @param {string} keyPath  e.g. "current.temp"
 */
function getByPath(obj, keyPath) {
  return keyPath.split('.').reduce((o, k) => (o != null ? o[k] : undefined), obj);
}

/**
 * Read one source file and return its value string, or null if stale/missing.
 * @param {string} dataDir   absolute path to hot-folder
 * @param {import('./config.js').Source} source
 * @param {boolean} ignoreMaxAge  when true, skip the staleness check
 * @returns {string|null}
 */
function readSource(dataDir, source, ignoreMaxAge = false) {
  const filePath = resolve(dataDir, source.file);

  if (!existsSync(filePath)) return null;

  // Staleness check (skipped in debug mode)
  if (!ignoreMaxAge) {
    const mtimeMs = statSync(filePath).mtimeMs;
    const ageSeconds = (Date.now() - mtimeMs) / 1000;
    if (ageSeconds > source.max_age) return null;
  }

  const content = readFileSync(filePath, 'utf8').trim();

  if (source.file.endsWith('.json')) {
    try {
      const parsed = JSON.parse(content);
      if (source.key) {
        const val = getByPath(parsed, source.key);
        return val != null ? String(val) : null;
      }
      // No key specified: return the whole value as JSON string
      return typeof parsed === 'object' ? JSON.stringify(parsed) : String(parsed);
    } catch {
      return null;
    }
  }

  // .txt (or any other extension): first non-empty line
  const line = content.split('\n').find(l => l.trim() !== '');
  return line != null ? line.trim() : null;
}

/**
 * Load all sources and return a data context object:
 *   { <source.id>: <value string or placeholder> }
 * @param {import('./config.js').Config} config
 * @param {boolean} [ignoreMaxAge=false]  skip staleness checks when true
 * @returns {Record<string, string>}
 */
export function loadData(config, ignoreMaxAge = false) {
  const context = {};
  for (const source of config.sources) {
    const value = readSource(config.device.data_dir, source, ignoreMaxAge);
    context[source.id] = value ?? (source.stale_placeholder ?? DEFAULT_PLACEHOLDER);
  }
  return context;
}
