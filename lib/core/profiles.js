import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import yaml from 'js-yaml';
import { getDataDir } from './targets.js';

const CONFIG_FILENAME = 'config.yaml';
const PROFILES_DIR = 'profiles';

/**
 * Deep-merge b into a. Arrays are replaced (not concatenated). Other values from b override a.
 * @param {Record<string, unknown>} a
 * @param {Record<string, unknown>} b
 * @returns {Record<string, unknown>}
 */
function deepMerge(a, b) {
  const out = { ...a };
  for (const key of Object.keys(b)) {
    const vb = b[key];
    if (vb != null && typeof vb === 'object' && !Array.isArray(vb) && typeof out[key] === 'object' && out[key] != null && !Array.isArray(out[key])) {
      out[key] = deepMerge(/** @type {Record<string, unknown>} */ (out[key]), /** @type {Record<string, unknown>} */ (vb));
    } else {
      out[key] = vb;
    }
  }
  return out;
}

/**
 * Resolve a path that may be ~/... or relative. Relative is resolved against cwd.
 * @param {string} path
 * @param {string} cwd
 * @returns {string}
 */
export function resolvePath(path, cwd) {
  const home = homedir();
  const trimmed = path.trim();
  if (trimmed.startsWith('~/') || trimmed === '~') {
    return join(home, trimmed.slice(1));
  }
  if (trimmed.startsWith('./') || !trimmed.startsWith('/')) {
    return join(cwd, trimmed);
  }
  return trimmed;
}

/**
 * Get path to config.yaml (~/.devsync/config.yaml).
 * @returns {string}
 */
export function getConfigPath() {
  return join(getDataDir(), CONFIG_FILENAME);
}

/**
 * Load ~/.devsync/config.yaml; return { active_profile: string } or default.
 * @returns {{ active_profile: string }}
 */
function loadGlobalConfig() {
  const path = getConfigPath();
  if (!existsSync(path)) {
    return { active_profile: 'default' };
  }
  try {
    const raw = readFileSync(path, 'utf8');
    const data = yaml.load(raw);
    const profile = data?.active_profile;
    return { active_profile: typeof profile === 'string' ? profile : 'default' };
  } catch {
    return { active_profile: 'default' };
  }
}

/** Get the currently active profile name. */
export function getActiveProfileName() {
  return loadGlobalConfig().active_profile;
}

/**
 * Write active_profile to ~/.devsync/config.yaml. Creates data dir if needed.
 * @param {string} profileName
 */
export function setActiveProfile(profileName) {
  const dataDir = getDataDir();
  const path = getConfigPath();
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  let data = {};
  if (existsSync(path)) {
    try {
      const raw = readFileSync(path, 'utf8');
      data = yaml.load(raw) || {};
    } catch {}
  }
  data.active_profile = profileName;
  writeFileSync(path, yaml.dump(data), 'utf8');
}

/**
 * List profile names: from ~/.devsync/profiles/ and bundled (unique).
 * @returns {string[]}
 */
export function getAvailableProfileNames() {
  const dataDir = getDataDir();
  const userDir = join(dataDir, PROFILES_DIR);
  const dir = dirname(fileURLToPath(import.meta.url));
  const bundledDir = join(dir, '..', '..', PROFILES_DIR);
  const names = new Set();
  if (existsSync(bundledDir)) {
    for (const f of readdirSync(bundledDir)) {
      if (f.endsWith('.yaml')) names.add(f.slice(0, -5));
    }
  }
  if (existsSync(userDir)) {
    for (const f of readdirSync(userDir)) {
      if (f.endsWith('.yaml')) names.add(f.slice(0, -5));
    }
  }
  return [...names].sort();
}

/**
 * Get path to a profile file (~/.devsync/profiles/<name>.yaml or bundled).
 * @param {string} name
 * @returns {string}
 */
export function getProfilePath(name) {
  const dataDir = getDataDir();
  const userPath = join(dataDir, PROFILES_DIR, `${name}.yaml`);
  if (existsSync(userPath)) return userPath;
  const dir = dirname(fileURLToPath(import.meta.url));
  return join(dir, '..', '..', PROFILES_DIR, `${name}.yaml`);
}

/**
 * Load a single profile YAML by name.
 * @param {string} name
 * @returns {Record<string, unknown>}
 */
function loadProfileByName(name) {
  const path = getProfilePath(name);
  if (!existsSync(path)) {
    throw new Error(`Profile not found: ${name} (${path})`);
  }
  const raw = readFileSync(path, 'utf8');
  const data = yaml.load(raw);
  if (!data || typeof data !== 'object') {
    throw new Error(`Invalid profile: ${path}`);
  }
  return data;
}

/**
 * Load .devsync.yaml from cwd if present.
 * @param {string} cwd
 * @returns {Record<string, unknown> | null}
 */
function loadProjectOverride(cwd) {
  const path = join(cwd, '.devsync.yaml');
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf8');
    const data = yaml.load(raw);
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

/**
 * Resolve source path (under data dir or bundled sources/).
 * @param {string} sourceRel - e.g. "sources/global-instructions.md"
 * @returns {string} Absolute path
 */
function resolveSourcePath(sourceRel) {
  const dataDir = getDataDir();
  const userPath = join(dataDir, sourceRel);
  if (existsSync(userPath)) return userPath;
  const dir = dirname(fileURLToPath(import.meta.url));
  return join(dir, '..', '..', sourceRel);
}

/**
 * Get effective profile (active + optional override + project override merged) and resolve all paths.
 * @param {string} cwd - Project root (e.g. process.cwd())
 * @param {{ profile?: string }} [opts] - If profile is set, use it instead of global active_profile
 * @returns {{ sources: string[], targets: Array<{ tool: string, path: string, kind: 'global'|'project' }> }}
 */
export function getEffectiveProfile(cwd, opts) {
  const profileOverride = opts?.profile;
  const globalConfig = loadGlobalConfig();
  const profileName = profileOverride ?? globalConfig.active_profile;
  let profile = loadProfileByName(profileName);
  const override = loadProjectOverride(cwd);
  if (override) {
    profile = deepMerge(profile, override);
  }
  const sources = Array.isArray(profile.sources) ? profile.sources : [];
  const sourcePaths = sources.map((s) => resolveSourcePath(String(s)));

  const targets = [];
  const targetMap = profile.targets;
  if (targetMap && typeof targetMap === 'object') {
    for (const [tool, spec] of Object.entries(targetMap)) {
      if (!spec || typeof spec !== 'object') continue;
      const s = /** @type {{ global?: string, project?: string }} */ (spec);
      if (s.global) {
        targets.push({ tool, path: resolvePath(s.global, cwd), kind: 'global' });
      }
      if (s.project) {
        targets.push({ tool, path: resolvePath(s.project, cwd), kind: 'project' });
      }
    }
  }

  return { sources: sourcePaths, targets };
}
