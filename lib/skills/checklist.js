import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { getDataDir } from '../core/targets.js';

const REGISTRY_FILENAME = 'skills-registry.yaml';

/**
 * Resolve path to skills-registry.yaml: prefer ~/.devsync/registry/, else bundled.
 * @returns {string}
 */
function getSkillsRegistryPath() {
  const dataDir = getDataDir();
  const userPath = join(dataDir, 'registry', REGISTRY_FILENAME);
  if (existsSync(userPath)) {
    return userPath;
  }
  const dir = dirname(fileURLToPath(import.meta.url));
  return join(dir, '..', '..', 'registry', REGISTRY_FILENAME);
}

/**
 * Load skills registry. Throws if file missing or invalid.
 * @returns {{ skills: SkillEntry[] }}
 */
export function loadSkillsRegistry() {
  const path = getSkillsRegistryPath();
  if (!existsSync(path)) {
    throw new Error(`Skills registry not found: ${path}`);
  }
  const raw = readFileSync(path, 'utf8');
  const data = yaml.load(raw);
  if (!data || typeof data !== 'object' || !Array.isArray(data.skills)) {
    throw new Error('Invalid skills registry: expected { skills: [...] }');
  }
  return data;
}

/**
 * Get skills list for display (load registry).
 * @returns {SkillEntry[]}
 */
export function getSkills() {
  const registry = loadSkillsRegistry();
  return registry.skills;
}

/**
 * @typedef {Object} SkillEntry
 * @property {string} id
 * @property {string} name
 * @property {string} [description]
 * @property {boolean} [recommended]
 * @property {string} [notes]
 */
