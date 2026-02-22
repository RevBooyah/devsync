import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execa } from 'execa';
import { getEffectiveProfile } from './profiles.js';
import { stripHashComment } from './merge.js';
import { getMcpsForPlatform } from '../mcp/registry.js';
import { getConfiguredMcpServers } from '../mcp/validator.js';
import { loadEnv } from './env.js';

/** @typedef {'good'|'suboptimal'|'missing'} Severity */

/**
 * @typedef {Object} Finding
 * @property {'config'|'mcp'} type
 * @property {string} id - path or MCP id
 * @property {Severity} severity
 * @property {string} message
 * @property {string} [detail]
 * @property {() => Promise<void>} [fix] - optional fix action
 */

const MIN_NON_WS = 50;
const HEADING_RE = /^#{1,6}\s+.+$/gm;

function hasMeaningfulContent(text) {
  const withoutWs = text.replace(/\s/g, '');
  if (withoutWs.length < MIN_NON_WS) return false;
  HEADING_RE.lastIndex = 0;
  return HEADING_RE.test(text);
}

/**
 * Build combined source content from profile sources (same as sync).
 * @param {string[]} sourcePaths
 * @returns {{ content: string, hash: string }}
 */
function getCombinedSourceHash(sourcePaths) {
  let content = '';
  for (const p of sourcePaths) {
    if (existsSync(p)) {
      content += readFileSync(p, 'utf8') + '\n\n';
    }
  }
  content = content.replace(/\n{3,}/g, '\n\n').trimEnd();
  const hash = createHash('sha256').update(content, 'utf8').digest('hex');
  return { content, hash };
}

/**
 * Audit config files from profile targets. Returns findings for project-level paths only (global optional).
 * @param {string} cwd
 * @param {{ path: string, tool: string, kind: string }[]} targets
 * @param {string} expectedSourceHash - hash of combined source for outdated check
 * @returns {Finding[]}
 */
function auditConfigFiles(cwd, targets, expectedSourceHash) {
  const findings = /** @type {Finding[]} */ ([]);
  for (const t of targets) {
    const path = t.path;
    const label = path.replace(cwd + '/', './').replace(cwd, '.');
    if (!existsSync(path)) {
      findings.push({
        type: 'config',
        id: path,
        severity: 'missing',
        message: label,
        detail: 'missing',
      });
      continue;
    }
    const raw = readFileSync(path, 'utf8');
    const { content, hash: storedHash } = stripHashComment(raw);
    if (!hasMeaningfulContent(content)) {
      findings.push({
        type: 'config',
        id: path,
        severity: 'suboptimal',
        message: label,
        detail: 'empty or placeholder',
      });
      continue;
    }
    const outdated = storedHash && expectedSourceHash && storedHash !== expectedSourceHash;
    if (outdated) {
      findings.push({
        type: 'config',
        id: path,
        severity: 'suboptimal',
        message: label,
        detail: 'outdated (source changed)',
      });
      continue;
    }
    findings.push({
      type: 'config',
      id: path,
      severity: 'good',
      message: label,
      detail: 'present',
    });
  }
  return findings;
}

/**
 * Parse npm outdated -g JSON output; return set of package names that have a newer version.
 * @returns {Promise<Set<string>>}
 */
async function getOutdatedGlobalPackages() {
  try {
    const { stdout } = await execa('npm', ['outdated', '-g', '--json'], { reject: false });
    const data = JSON.parse(stdout || '{}');
    return new Set(Object.keys(data));
  } catch {
    return new Set();
  }
}

/**
 * Audit MCP: recommended vs configured, env vars, outdated packages, ping status.
 * @param {Promise<Record<string, 'running'|'misconfigured'|'not installed'>>} statusPromise
 * @returns {Promise<Finding[]>}
 */
async function auditMcps(statusPromise) {
  loadEnv();
  const recommendedIds = new Set(
    getMcpsForPlatform()
      .filter((m) => m.recommended)
      .map((m) => m.id)
  );
  const configured = getConfiguredMcpServers();
  const status = await statusPromise;
  const outdated = await getOutdatedGlobalPackages();

  const findings = /** @type {Finding[]} */ ([]);

  for (const mcp of getMcpsForPlatform()) {
    const conf = configured[mcp.id];
    const st = status[mcp.id];
    const isRecommended = recommendedIds.has(mcp.id);

    if (!conf) {
      findings.push({
        type: 'mcp',
        id: mcp.id,
        severity: isRecommended ? 'missing' : 'good',
        message: mcp.id,
        detail: isRecommended ? 'not installed (recommended)' : 'not installed',
      });
      continue;
    }

    const missingVars = [];
    if (mcp.vars) {
      for (const varName of Object.keys(mcp.vars)) {
        const val = process.env[varName];
        if (val === undefined || val === '' || String(val).trim() === '') {
          missingVars.push(varName);
        }
      }
    }
    if (missingVars.length) {
      findings.push({
        type: 'mcp',
        id: mcp.id,
        severity: 'suboptimal',
        message: mcp.id,
        detail: `env var(s) not set: ${missingVars.join(', ')}`,
      });
      continue;
    }

    const pkgName = mcp.package;
    const isOutdated = pkgName && outdated.has(pkgName);
    if (isOutdated) {
      findings.push({
        type: 'mcp',
        id: mcp.id,
        severity: 'suboptimal',
        message: mcp.id,
        detail: 'package outdated',
      });
      continue;
    }

    if (st === 'running') {
      findings.push({ type: 'mcp', id: mcp.id, severity: 'good', message: mcp.id, detail: 'running' });
    } else if (st === 'misconfigured' || st === 'not installed') {
      findings.push({
        type: 'mcp',
        id: mcp.id,
        severity: 'suboptimal',
        message: mcp.id,
        detail: st,
      });
    } else {
      findings.push({ type: 'mcp', id: mcp.id, severity: 'good', message: mcp.id, detail: 'configured' });
    }
  }

  return findings;
}

/**
 * Run full audit: config files + MCP servers. Skills section left for Phase 5.
 * @param {string} cwd
 * @param {{ profile?: string }} [opts] - Profile override (--profile)
 * @returns {Promise<{ config: Finding[], mcp: Finding[], issues: number }>}
 */
export async function runAudit(cwd, opts) {
  const profileOpts = opts?.profile ? { profile: opts.profile } : undefined;
  const { sources: sourcePaths, targets } = getEffectiveProfile(cwd, profileOpts);
  const { hash: expectedSourceHash } = getCombinedSourceHash(sourcePaths);

  const configFindings = auditConfigFiles(cwd, targets, expectedSourceHash);

  const { validateAll } = await import('../mcp/validator.js');
  const statusPromise = validateAll();
  const mcpFindings = await auditMcps(statusPromise);

  const configMissingOrSub = configFindings.filter((f) => f.severity !== 'good');
  const mcpMissingOrSub = mcpFindings.filter((f) => f.severity !== 'good');
  const issues = configMissingOrSub.length + mcpMissingOrSub.length;

  return {
    config: configFindings,
    mcp: mcpFindings,
    issues,
  };
}
