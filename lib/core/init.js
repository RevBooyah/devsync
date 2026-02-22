import { existsSync, mkdirSync, readdirSync, copyFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { getDataDir } from './targets.js';

const require = createRequire(import.meta.url);

const BUNDLE_DIRS = ['sources', 'registry', 'profiles'];

/**
 * Copy a directory recursively, only writing files that do not already exist (never overwrite).
 * @param {string} srcDir
 * @param {string} destDir
 */
function copyDirIfMissingSync(srcDir, destDir) {
  if (!existsSync(srcDir)) return;
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }
  for (const name of readdirSync(srcDir)) {
    const srcPath = join(srcDir, name);
    const destPath = join(destDir, name);
    if (statSync(srcPath).isDirectory()) {
      copyDirIfMissingSync(srcPath, destPath);
    } else if (!existsSync(destPath)) {
      copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * List paths that would be copied in bootstrap (bundle → ~/.devsync) where destination doesn't exist.
 * @returns {string[]}
 */
function bootstrapWouldCopy() {
  const dataDir = getDataDir();
  const dir = dirname(fileURLToPath(import.meta.url));
  const bundleRoot = join(dir, '..', '..');
  const wouldCopy = [];
  function scan(srcDir, destDir) {
    if (!existsSync(srcDir)) return;
    for (const name of readdirSync(srcDir)) {
      const srcPath = join(srcDir, name);
      const destPath = join(destDir, name);
      if (statSync(srcPath).isDirectory()) {
        scan(srcPath, destPath);
      } else if (!existsSync(destPath)) {
        wouldCopy.push(destPath);
      }
    }
  }
  for (const sub of BUNDLE_DIRS) {
    scan(join(bundleRoot, sub), join(dataDir, sub));
  }
  return wouldCopy;
}

/**
 * Dry-run for init: show what would be copied and what the wizard would do.
 */
export async function initDryRun() {
  const wouldCopy = bootstrapWouldCopy();
  console.log('Init dry run');
  console.log('Would ensure ~/.devsync and copy from bundle (only missing files):');
  if (wouldCopy.length) wouldCopy.forEach((p) => console.log('  →', p));
  else console.log('  (none; all files already exist)');
  console.log('Would run wizard: profile selection, optional MCP install, optional sync.');
}

/**
 * Ensure ~/.devsync exists and has sources, registry, profiles from bundle (copy only missing files).
 * Idempotent; never overwrites existing files.
 */
export function ensureDataDirBootstrap() {
  const dataDir = getDataDir();
  const dir = dirname(fileURLToPath(import.meta.url));
  const bundleRoot = join(dir, '..', '..');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  for (const sub of BUNDLE_DIRS) {
    const src = join(bundleRoot, sub);
    const dest = join(dataDir, sub);
    copyDirIfMissingSync(src, dest);
  }
}

/**
 * Run the init wizard: bootstrap, profile selection, set active, install recommended MCPs, sync, summary.
 * Uses @clack/prompts; call from devsync init.
 * @param {string} cwd
 * @returns {Promise<{ profile: string, mcpsInstalled: string[], synced: boolean }>}
 */
export async function runInitWizard(cwd) {
  const { intro, outro, select, multiselect, confirm, text, password } = await import('@clack/prompts');
  const chalk = (await import('chalk')).default;
  const pkg = require('../../package.json');

  intro(`devsync ${pkg.version}\nAI Development Config Manager`);

  ensureDataDirBootstrap();

  const profileNames = (await import('./profiles.js')).getAvailableProfileNames();
  const profileOptions = profileNames.map((n) => ({ value: n, label: n }));
  const profileChoice = await select({
    message: 'Select a profile',
    options: profileOptions,
  });
  if (profileChoice === undefined) process.exit(0);
  const profile = /** @type {string} */ (profileChoice);

  const { setActiveProfile } = await import('./profiles.js');
  setActiveProfile(profile);

  const { getMcpsForPlatform } = await import('../mcp/registry.js');
  const { installMcp } = await import('../mcp/installer.js');
  const recommended = getMcpsForPlatform().filter((m) => m.recommended);
  const toInstall = recommended.length
    ? await multiselect({
        message: 'Install recommended MCPs?',
        options: recommended.map((m) => ({ value: m.id, label: m.name })),
        initialValues: recommended.map((m) => m.id),
      })
    : [];
  if (toInstall === undefined) process.exit(0);

  const mcpsInstalled = [];
  for (const id of /** @type {string[]} */ (toInstall)) {
    const entry = recommended.find((m) => m.id === id);
    if (!entry) continue;
    try {
      const promptVar = async (key, opts) => {
        if (opts?.secret) {
          const v = await password({ message: opts.prompt ?? key, mask: '*' });
          if (v === undefined) process.exit(0);
          return v;
        }
        const v = await text({ message: opts?.prompt ?? key, defaultValue: opts?.default ?? '' });
        if (v === undefined) process.exit(0);
        return v;
      };
      await installMcp(entry, promptVar);
      mcpsInstalled.push(entry.name);
    } catch (e) {
      console.log(chalk.yellow(`  ⚠ ${entry.name}: ${e instanceof Error ? e.message : e}`));
    }
  }

  const doSync = await confirm({ message: 'Sync config files to this project?', initialValue: true });
  let synced = false;
  if (doSync) {
    const { runSync } = await import('./sync.js');
    const { select: selectConflict } = await import('@clack/prompts');
    const result = await runSync(cwd, {
      resolveConflict: async (conflict) => {
        if (!process.stdin.isTTY) return 'keep';
        const r = await selectConflict({
          message: `Conflict: ${conflict.targetPath} → "${conflict.heading}"`,
          options: [
            { value: 'keep', label: 'Keep existing' },
            { value: 'overwrite', label: 'Overwrite with source' },
            { value: 'skip', label: 'Skip this file' },
          ],
        });
        return r === undefined ? 'keep' : r;
      },
    });
    synced = result.written.length > 0;
  }

  outro(`Setup complete. Active profile: ${profile}. Run \`devsync audit\` to check health, \`devsync skills\` for Claude.ai settings.`);
  return { profile, mcpsInstalled, synced };
}
