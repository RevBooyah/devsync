import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { getDataDir, getPlatform } from '../core/targets.js';

const REGISTRY_FILENAME = 'mcp-registry.yaml';

/**
 * Resolve path to mcp-registry.yaml: prefer ~/.devsync/registry/, else bundled.
 * @returns {string}
 */
function getRegistryPath() {
  const dataDir = getDataDir();
  const userPath = join(dataDir, 'registry', REGISTRY_FILENAME);
  if (existsSync(userPath)) {
    return userPath;
  }
  const dir = dirname(fileURLToPath(import.meta.url));
  return join(dir, '..', '..', 'registry', REGISTRY_FILENAME);
}

/**
 * Load and parse mcp-registry.yaml. Throws if file missing or invalid.
 * @returns {{ mcps: MCPEntry[] }}
 */
export function loadRegistry() {
  const path = getRegistryPath();
  if (!existsSync(path)) {
    throw new Error(`Registry not found: ${path}`);
  }
  const raw = readFileSync(path, 'utf8');
  const data = yaml.load(raw);
  if (!data || typeof data !== 'object' || !Array.isArray(data.mcps)) {
    throw new Error('Invalid registry: expected { mcps: [...] }');
  }
  return data;
}

/**
 * Filter registry entries by current platform (win32, wsl, darwin).
 * linux is treated as wsl for display (both use ~/ paths).
 * @param {{ mcps: MCPEntry[] }} registry
 * @returns {MCPEntry[]}
 */
export function filterByPlatform(registry) {
  const platform = getPlatform();
  const key = platform === 'linux' ? 'wsl' : platform;
  return registry.mcps.filter((mcp) => {
    const platforms = mcp.platforms;
    if (!Array.isArray(platforms)) return true;
    return platforms.includes(key) || platforms.includes(platform);
  });
}

/**
 * Get MCP entries for the current platform (load + filter). Idempotent.
 * @returns {MCPEntry[]}
 */
export function getMcpsForPlatform() {
  const registry = loadRegistry();
  return filterByPlatform(registry);
}

/**
 * @typedef {Object} MCPEntry
 * @property {string} id
 * @property {string} name
 * @property {string} package
 * @property {string} install
 * @property {{ command: string, args?: string[], env?: Record<string,string> }} config
 * @property {Record<string,{ prompt?: string, default?: string, secret?: boolean }>} [vars]
 * @property {string[]} [tags]
 * @property {boolean} [recommended]
 * @property {string[]} [platforms]
 */
