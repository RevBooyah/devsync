import { spawn } from 'node:child_process';
import { getClaudeDesktopConfigPath, getClaudeCodeConfigPath } from '../core/targets.js';
import { readFileSync, existsSync } from 'node:fs';

const INITIALIZE_REQUEST = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'devsync', version: '1.0.0' },
  },
});

const PING_TIMEOUT_MS = 8000;

/**
 * Get merged mcpServers from both Claude Desktop and Claude Code configs.
 * Keys present in both are taken from Claude Code (later) so we have one list of configured servers.
 * @returns {Record<string, { command: string, args?: string[], env?: Record<string, string> }>}
 */
export function getConfiguredMcpServers() {
  const out = {};
  const paths = [getClaudeDesktopConfigPath(), getClaudeCodeConfigPath()];
  for (const path of paths) {
    if (!existsSync(path)) continue;
    try {
      const raw = readFileSync(path, 'utf8');
      const data = JSON.parse(raw);
      const servers = data.mcpServers;
      if (servers && typeof servers === 'object') {
        Object.assign(out, servers);
      }
    } catch {
      // skip invalid or unreadable
    }
  }
  return out;
}

/**
 * Ping one MCP server: spawn process, send initialize, expect valid result. Resolves to status string.
 * @param {string} id - Server id (for logging)
 * @param {{ command: string, args?: string[], env?: Record<string, string> }} config
 * @returns {Promise<'running'|'misconfigured'|'not installed'>}
 */
export function pingMcpServer(id, config) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (proc) proc.kill('SIGKILL');
      resolve('misconfigured');
    }, PING_TIMEOUT_MS);

    let proc;
    try {
      const env = { ...process.env, ...config.env };
      proc = spawn(config.command, config.args || [], {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      clearTimeout(timeout);
      resolve('not installed');
      return;
    }

    let buffer = '';
    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', (chunk) => {
      buffer += chunk;
      if (buffer.includes('\n')) {
        clearTimeout(timeout);
        proc.kill('SIGKILL');
        try {
          const line = buffer.split('\n')[0];
          const msg = JSON.parse(line);
          if (msg.result != null) {
            resolve('running');
          } else {
            resolve('misconfigured');
          }
        } catch {
          resolve('misconfigured');
        }
      }
    });

    proc.stderr.on('data', () => {});
    proc.on('error', () => {
      clearTimeout(timeout);
      resolve('not installed');
    });
    proc.on('exit', (code, signal) => {
      if (buffer.includes('\n')) return;
      clearTimeout(timeout);
      resolve(code === 0 ? 'running' : 'misconfigured');
    });

    proc.stdin.write(INITIALIZE_REQUEST + '\n', (err) => {
      if (err) {
        clearTimeout(timeout);
        if (proc) proc.kill('SIGKILL');
        resolve('misconfigured');
      }
    });
    proc.stdin.end();
  });
}

/**
 * Get status for each configured MCP server.
 * @returns {Promise<Record<string, 'running'|'misconfigured'|'not installed'>>}
 */
export async function validateAll() {
  const servers = getConfiguredMcpServers();
  const result = {};
  await Promise.all(
    Object.entries(servers).map(async ([id, config]) => {
      result[id] = await pingMcpServer(id, config);
    })
  );
  return result;
}
