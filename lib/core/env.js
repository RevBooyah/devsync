import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { config } from 'dotenv';
import { getDataDir } from './targets.js';

const ENV_FILENAME = '.env';

/**
 * Path to ~/.devsync/.env
 * @returns {string}
 */
export function getEnvPath() {
  return join(getDataDir(), ENV_FILENAME);
}

/**
 * Load env vars from ~/.devsync/.env into process.env.
 * Does not create the file if missing. Idempotent.
 * @returns {{ parsed: Record<string, string> | undefined }}
 */
export function loadEnv() {
  const path = getEnvPath();
  if (!existsSync(path)) {
    return { parsed: undefined };
  }
  const result = config({ path });
  return { parsed: result.parsed };
}

/**
 * Escape a value for .env: double-quote and escape \ and " so parsing is unambiguous.
 * @param {string} value
 * @returns {string}
 */
function escapeEnvValue(value) {
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

/**
 * Ensure ~/.devsync exists and write a key=value line to .env.
 * Used when we prompt for a missing var and save it. Creates .env if missing.
 * Values are quoted so newlines and = are safe.
 * @param {string} key
 * @param {string} value
 */
export function setEnvVar(key, value) {
  const dir = getDataDir();
  const path = getEnvPath();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  let content = '';
  if (existsSync(path)) {
    content = readFileSync(path, 'utf8');
  }
  const line = `${key}=${escapeEnvValue(value)}`;
  const lines = content.split('\n').filter(Boolean);
  const idx = lines.findIndex((l) => l.startsWith(`${key}=`));
  if (idx >= 0) {
    lines[idx] = line;
  } else {
    lines.push(line);
  }
  writeFileSync(path, lines.join('\n') + '\n', 'utf8');
}
