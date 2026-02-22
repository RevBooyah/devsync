import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { execa } from 'execa';
import { loadEnv, setEnvVar } from '../core/env.js';
import {
  getClaudeDesktopConfigPath,
  getClaudeCodeConfigPath,
} from '../core/targets.js';

/**
 * Check if an npm package is installed globally.
 * @param {string} packageName
 * @returns {Promise<boolean>}
 */
export async function isInstalledGlobally(packageName) {
  try {
    const { stdout } = await execa('npm', ['list', '-g', '--json', packageName], {
      reject: false,
    });
    const data = JSON.parse(stdout);
    const deps = data.dependencies || {};
    return packageName in deps;
  } catch {
    return false;
  }
}

/**
 * Run the registry install command (e.g. npm install -g ...).
 * @param {string} installCmd
 * @returns {Promise<void>}
 */
export async function runInstall(installCmd) {
  const [cmd, ...args] = installCmd.trim().split(/\s+/);
  await execa(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
}

/**
 * Substitute {{VAR_NAME}} in a string using process.env (after loadEnv) or prompt.
 * @param {string} template
 * @param {Record<string,{ prompt?: string, default?: string, secret?: boolean }>} [vars]
 * @param {(key: string, options: { prompt?: string, default?: string, secret?: boolean }) => Promise<string>} promptVar
 * @returns {Promise<string>}
 */
async function substituteVars(template, vars, promptVar) {
  const re = /\{\{(\w+)\}\}/g;
  const keys = [...new Set([...template.matchAll(re)].map((m) => m[1]))];
  let out = template;
  for (const key of keys) {
    let value = process.env[key];
    if (value === undefined || value === '') {
      const def = vars?.[key];
      value = await promptVar(key, {
        prompt: def?.prompt ?? `Value for ${key}`,
        default: def?.default,
        secret: def?.secret,
      });
      setEnvVar(key, value);
      process.env[key] = value;
    }
    const placeholder = `{{${key}}}`;
    out = out.split(placeholder).join(value);
  }
  return out;
}

/**
 * Build the mcpServers config block for one MCP with {{VAR}} substituted.
 * @param {import('./registry.js').MCPEntry} entry
 * @param {(key: string, options: { prompt?: string, default?: string, secret?: boolean }) => Promise<string>} promptVar
 * @returns {Promise<{ command: string, args?: string[], env?: Record<string,string> }>}
 */
export async function buildMcpConfig(entry, promptVar) {
  loadEnv();
  const config = { ...entry.config, args: [...(entry.config.args || [])] };
  const env = entry.config.env ? { ...entry.config.env } : undefined;

  for (let i = 0; i < (config.args?.length ?? 0); i++) {
    config.args[i] = await substituteVars(config.args[i], entry.vars, promptVar);
  }
  if (env) {
    for (const k of Object.keys(env)) {
      env[k] = await substituteVars(env[k], entry.vars, promptVar);
    }
    config.env = env;
  }
  return config;
}

/**
 * Merge one MCP server entry into existing mcpServers. Mutates obj.
 * @param {Record<string, unknown>} obj - Parsed JSON config object
 * @param {string} id - MCP server id
 * @param {Record<string, unknown>} serverConfig - Config for this server
 */
function mergeMcpServer(obj, id, serverConfig) {
  if (!obj.mcpServers || typeof obj.mcpServers !== 'object') {
    obj.mcpServers = {};
  }
  obj.mcpServers[id] = serverConfig;
}

/**
 * Write JSON to path, creating parent dirs if needed. Preserves trailing newline if present in original.
 * @param {string} path
 * @param {Record<string, unknown>} data
 * @param {string} [originalContent]
 */
function writeJsonConfig(path, data, originalContent) {
  mkdirSync(dirname(path), { recursive: true });
  const json = JSON.stringify(data, null, 2);
  const content = originalContent?.endsWith('\n') ? json + '\n' : json;
  writeFileSync(path, content, 'utf8');
}

/**
 * Read config file; return parsed JSON or empty object. Never throw for missing file.
 * @param {string} path
 * @returns {{ data: Record<string, unknown>, raw: string }}
 */
function readJsonConfig(path) {
  if (!existsSync(path)) {
    return { data: {}, raw: '' };
  }
  const raw = readFileSync(path, 'utf8');
  try {
    const data = JSON.parse(raw);
    return { data: typeof data === 'object' && data !== null ? data : {}, raw };
  } catch {
    return { data: {}, raw };
  }
}

/**
 * Inject one MCP server into both Claude Desktop and Claude Code config files.
 * Merges only mcpServers key; never overwrites the rest of the file.
 * @param {string} id - MCP server id
 * @param {Record<string, unknown>} serverConfig - Resolved config (command, args, env)
 */
export function injectMcpConfig(id, serverConfig) {
  const desktopPath = getClaudeDesktopConfigPath();
  const codePath = getClaudeCodeConfigPath();

  const desktop = readJsonConfig(desktopPath);
  const code = readJsonConfig(codePath);

  mergeMcpServer(desktop.data, id, serverConfig);
  mergeMcpServer(code.data, id, serverConfig);

  writeJsonConfig(desktopPath, desktop.data, desktop.raw);
  writeJsonConfig(codePath, code.data, code.raw);
}

/**
 * Remove one MCP server from both config files (merge key only).
 * @param {string} id - MCP server id
 */
export function removeMcpConfig(id) {
  const desktopPath = getClaudeDesktopConfigPath();
  const codePath = getClaudeCodeConfigPath();

  for (const path of [desktopPath, codePath]) {
    if (!existsSync(path)) continue;
    const raw = readFileSync(path, 'utf8');
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      continue;
    }
    if (data.mcpServers && typeof data.mcpServers === 'object') {
      delete data.mcpServers[id];
      writeJsonConfig(path, data, raw);
    }
  }
}

/**
 * Install an MCP: run install command, resolve vars, inject into both configs.
 * @param {import('./registry.js').MCPEntry} entry
 * @param {(key: string, options: { prompt?: string, default?: string, secret?: boolean }) => Promise<string>} promptVar
 */
export async function installMcp(entry, promptVar) {
  await runInstall(entry.install);
  const serverConfig = await buildMcpConfig(entry, promptVar);
  injectMcpConfig(entry.id, serverConfig);
}
