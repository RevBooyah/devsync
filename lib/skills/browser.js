import { execa } from 'execa';

const CLAUDE_SETTINGS_URL = 'https://claude.ai/settings';

/**
 * Check if Playwright is available (npx playwright --version).
 * @returns {Promise<boolean>}
 */
export async function isPlaywrightAvailable() {
  try {
    const result = await execa('npx', ['playwright', '--version'], { reject: false });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Open Claude.ai settings in the default browser (no Playwright required).
 * Warns that UI automation is fragile; does not auto-toggle (would require Playwright and is brittle).
 * @returns {Promise<void>}
 */
export async function openClaudeSettings() {
  const { spawn } = await import('node:child_process');
  const { platform } = await import('node:os');
  const opener = platform() === 'darwin' ? 'open' : platform() === 'win32' ? 'start' : 'xdg-open';
  return new Promise((resolve, reject) => {
    const child = spawn(opener, [CLAUDE_SETTINGS_URL], { stdio: 'ignore', shell: platform() === 'win32' });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Exit ${code}`))));
  });
}

/**
 * If Playwright is installed, could run browser automation to toggle skills (fragile).
 * Not implemented: Claude.ai UI changes would break selectors. Use manual checklist instead.
 */
export async function openClaudeSettingsWithPlaywright() {
  const available = await isPlaywrightAvailable();
  if (!available) {
    console.log('Playwright not installed. Run: npm install -g playwright');
    console.log('Opening settings in default browser instead.');
    await openClaudeSettings();
    return;
  }
  console.log('Browser automation is optional and fragile (Claude.ai UI may change).');
  console.log('Opening settings in default browser. Use the checklist to verify each skill.');
  await openClaudeSettings();
}
