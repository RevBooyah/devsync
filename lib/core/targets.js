import { homedir, platform } from 'node:os';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PLATFORM_WIN32 = 'win32';
const PLATFORM_DARWIN = 'darwin';
const WSL_VERSION_PATH = '/proc/version';

/**
 * Detect current platform: 'win32' | 'wsl' | 'darwin' (macOS).
 * WSL is detected by reading /proc/version for "Microsoft" or "WSL".
 * @returns {'win32'|'wsl'|'darwin'}
 */
export function getPlatform() {
  if (platform() === PLATFORM_DARWIN) {
    return 'darwin';
  }
  if (platform() === PLATFORM_WIN32) {
    return 'win32';
  }
  try {
    const content = readFileSync(WSL_VERSION_PATH, 'utf8');
    if (/Microsoft|WSL/i.test(content)) {
      return 'wsl';
    }
  } catch {
    // /proc/version not present (e.g. non-Linux)
  }
  return 'linux';
}

/**
 * Resolve the devsync data directory (~/.devsync).
 * On Windows: %USERPROFILE%\.devsync
 * On WSL/Linux/macOS: ~/.devsync
 * @returns {string} Absolute path to ~/.devsync
 */
export function getDataDir() {
  const home = homedir();
  return join(home, '.devsync');
}

/**
 * Path to Claude Desktop config (mcpServers are merged here).
 * Windows: %APPDATA%\Claude\claude_desktop_config.json
 * WSL/Linux: ~/.config/Claude/claude_desktop_config.json
 * macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
 * @returns {string}
 */
export function getClaudeDesktopConfigPath() {
  const home = homedir();
  const p = getPlatform();
  if (p === 'win32') {
    const appData = process.env.APPDATA || join(home, 'AppData', 'Roaming');
    return join(appData, 'Claude', 'claude_desktop_config.json');
  }
  if (p === 'darwin') {
    return join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  }
  return join(home, '.config', 'Claude', 'claude_desktop_config.json');
}

/**
 * Path to Claude Code config (~/.claude.json on non-Windows).
 * Windows: %APPDATA%\Claude\.claude.json
 * @returns {string}
 */
export function getClaudeCodeConfigPath() {
  const home = homedir();
  const p = getPlatform();
  if (p === 'win32') {
    const appData = process.env.APPDATA || join(home, 'AppData', 'Roaming');
    return join(appData, 'Claude', '.claude.json');
  }
  return join(home, '.claude.json');
}
