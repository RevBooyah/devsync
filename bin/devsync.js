#!/usr/bin/env node

import { program } from 'commander';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

if (process.argv.includes('--verbose') || process.argv.includes('-v')) {
  process.env.DEVSYNC_VERBOSE = '1';
}

async function runDashboard() {
  const { render } = await import('ink');
  const { default: Dashboard } = await import('../lib/tui/Dashboard.js');
  const { default: React } = await import('react');
  render(React.createElement(Dashboard));
}

program
  .name('devsync')
  .description('AI development config manager — MCP, CLAUDE.md, Cursor rules, audit')
  .version(pkg.version)
  .option('-v, --verbose', 'verbose output');

program
  .command('init')
  .description('First-time machine setup wizard')
  .option('--dry-run', 'Show what would be copied/written without writing')
  .action(async (opts) => {
    const { ensureDataDirBootstrap, runInitWizard, initDryRun } = await import('../lib/core/init.js');
    if (opts.dryRun) {
      await initDryRun();
      return;
    }
    if (!process.stdin.isTTY) {
      ensureDataDirBootstrap();
      console.log('Bootstrap complete (~/.devsync populated). Run with TTY for full wizard (profile, MCP, sync).');
      return;
    }
    await runInitWizard(process.cwd());
  });

program
  .command('sync')
  .description('Sync config files to current project')
  .option('--dry-run', 'Show what would be written without writing')
  .option('--profile <name>', 'Use this profile instead of active')
  .action(async (opts) => {
    const { runSync } = await import('../lib/core/sync.js');
    const { select } = await import('@clack/prompts');
    const chalk = (await import('chalk')).default;

    const resolveConflict = async (conflict) => {
      if (!process.stdin.isTTY) {
        console.log(chalk.yellow(`Conflict in ${conflict.targetPath} → "${conflict.heading}"`));
        console.log('Run with TTY to resolve, or re-run after editing the file.');
        return 'keep';
      }
      const r = await select({
        message: `Conflict in ${conflict.targetPath} → "${conflict.heading}"`,
        options: [
          { value: 'keep', label: 'Keep existing' },
          { value: 'overwrite', label: 'Overwrite with source' },
          { value: 'skip', label: 'Skip this file' },
          { value: 'editor', label: 'Open in $EDITOR (then re-run sync)' },
        ],
      });
      if (r === undefined) process.exit(0);
      return r;
    };

    if (opts.dryRun) {
      const { getEffectiveProfile } = await import('../lib/core/profiles.js');
      const profileOpts = opts.profile ? { profile: opts.profile } : undefined;
      const { sources, targets } = getEffectiveProfile(process.cwd(), profileOpts);
      console.log('Would sync sources to targets (dry run):');
      if (opts.profile) console.log('  Profile:', opts.profile);
      console.log('  Sources:', sources.length);
      targets.forEach((t) => console.log('  →', t.path));
      return;
    }

    const result = await runSync(process.cwd(), { resolveConflict, profile: opts.profile });
    if (result.openedEditor) return;
    if (result.written.length) console.log('Written:', result.written.join(', '));
    if (result.skipped.length) console.log('Skipped:', result.skipped.join(', '));
    if (!result.written.length && !result.skipped.length) console.log('Nothing to sync.');
  });

const mcpCmd = program
  .command('mcp')
  .description('Manage MCP servers (list, install, remove, validate)');

mcpCmd.action(async () => {
  if (!process.stdin.isTTY) {
    const { getMcpsForPlatform } = await import('../lib/mcp/registry.js');
    const { getConfiguredMcpServers } = await import('../lib/mcp/validator.js');
    const mcps = getMcpsForPlatform();
    const configured = getConfiguredMcpServers();
    console.log('ID                     Recommended  Config');
    console.log('—'.repeat(45));
    for (const m of mcps) {
      const inst = configured[m.id] ? 'yes' : '—';
      console.log(`${m.id.padEnd(22)}  ${m.recommended ? '*' : ' '}        ${inst}`);
    }
    console.log('\nUse "devsync mcp list", "devsync mcp install <id>", "devsync mcp remove <id>", "devsync mcp validate".');
    return;
  }
  const { render } = await import('ink');
  const { default: MCPManager } = await import('../lib/tui/MCPManager.js');
  const React = (await import('react')).default;
  render(React.createElement(MCPManager));
});

mcpCmd
  .command('list')
  .description('List available MCPs and install status')
  .action(async () => {
    const { getMcpsForPlatform } = await import('../lib/mcp/registry.js');
    const { getConfiguredMcpServers } = await import('../lib/mcp/validator.js');
    const mcps = getMcpsForPlatform();
    const configured = getConfiguredMcpServers();
    console.log('ID                     Recommended  Config   Status');
    console.log('—'.repeat(50));
    for (const m of mcps) {
      const inst = configured[m.id] ? 'yes' : '—';
      console.log(`${m.id.padEnd(22)}  ${m.recommended ? '*' : ' '}        ${inst}`);
    }
  });

mcpCmd
  .command('install <id>')
  .description('Install an MCP server by id')
  .action(async (id) => {
    const { getMcpsForPlatform } = await import('../lib/mcp/registry.js');
    const { installMcp } = await import('../lib/mcp/installer.js');
    const { text, password } = await import('@clack/prompts');
    const mcps = getMcpsForPlatform();
    const entry = mcps.find((m) => m.id === id);
    if (!entry) {
      console.error(`Unknown MCP id: ${id}`);
      process.exit(1);
    }
    const promptVar = async (key, opts) => {
      if (opts.secret) {
        const v = await password({ message: opts.prompt ?? key, mask: '*' });
        if (v === undefined) process.exit(0);
        return v;
      }
      const v = await text({ message: opts.prompt ?? key, defaultValue: opts.default ?? '' });
      if (v === undefined) process.exit(0);
      return v;
    };
    await installMcp(entry, promptVar);
    console.log(`Installed ${entry.name} (${id}).`);
  });

mcpCmd
  .command('remove <id>')
  .description('Remove an MCP server from config')
  .action(async (id) => {
    const { removeMcpConfig } = await import('../lib/mcp/installer.js');
    removeMcpConfig(id);
    console.log(`Removed ${id} from config.`);
  });

mcpCmd
  .command('validate')
  .description('Ping all configured MCP servers')
  .action(async () => {
    const { validateAll } = await import('../lib/mcp/validator.js');
    const status = await validateAll();
    console.log('MCP Server         Status');
    console.log('—'.repeat(30));
    for (const [sid, s] of Object.entries(status)) {
      console.log(`${sid.padEnd(18)}  ${s}`);
    }
  });

program
  .command('skills')
  .description('Claude.ai skills checklist')
  .action(async () => {
    if (!process.stdin.isTTY) {
      const { getSkills } = await import('../lib/skills/checklist.js');
      const skills = getSkills();
      console.log('Claude.ai Skills (* = recommended)\n');
      for (const s of skills) {
        console.log(`  ${s.recommended ? '*' : ' '} ${s.name}`);
        if (s.notes) console.log(`    → ${s.notes}`);
      }
      console.log('\nRun with TTY for interactive checklist (space to confirm, o to open settings).');
      return;
    }
    const { render } = await import('ink');
    const { default: SkillsChecklist } = await import('../lib/tui/SkillsChecklist.js');
    const React = (await import('react')).default;
    render(React.createElement(SkillsChecklist));
  });

program
  .command('audit')
  .description('Scan project and report findings')
  .option('--profile <name>', 'Use this profile instead of active')
  .action(async (opts) => {
    const { runAudit } = await import('../lib/core/audit.js');
    const chalk = (await import('chalk')).default;
    const cwd = process.cwd();
    const auditOpts = opts.profile ? { profile: opts.profile } : undefined;

    if (!process.stdin.isTTY) {
      const result = await runAudit(cwd, auditOpts);
      console.log(`devsync audit — ${cwd}`);
      console.log('—'.repeat(50));
      console.log('Config Files');
      for (const f of result.config) {
        const sym = f.severity === 'good' ? '✓' : f.severity === 'suboptimal' ? '⚠' : '✗';
        const color = f.severity === 'good' ? chalk.green : f.severity === 'suboptimal' ? chalk.yellow : chalk.red;
        console.log(`  ${color(sym)}  ${f.message}  ${f.detail || ''}`);
      }
      console.log('');
      console.log('MCP Servers');
      for (const f of result.mcp) {
        const sym = f.severity === 'good' ? '✓' : f.severity === 'suboptimal' ? '⚠' : '✗';
        const color = f.severity === 'good' ? chalk.green : f.severity === 'suboptimal' ? chalk.yellow : chalk.red;
        console.log(`  ${color(sym)}  ${f.message}  ${f.detail || ''}`);
      }
      console.log('—'.repeat(50));
      console.log(`${result.issues} issue(s) found.`);
      if (result.issues > 0) {
        console.log('Run with TTY for interactive fix (f to run sync).');
      }
      return;
    }

    const { render } = await import('ink');
    const { default: AuditView } = await import('../lib/tui/AuditView.js');
    const React = (await import('react')).default;
    render(React.createElement(AuditView, { profileOverride: opts.profile }));
  });

const profileCmd = program
  .command('profile')
  .description('Switch or create profiles');

profileCmd
  .command('list')
  .description('List available profiles')
  .action(async () => {
    const { getAvailableProfileNames, getActiveProfileName } = await import('../lib/core/profiles.js');
    const names = getAvailableProfileNames();
    const active = getActiveProfileName();
    console.log('Available profiles:');
    for (const n of names) {
      console.log(`  ${n === active ? '*' : ' '} ${n}`);
    }
    console.log('\n* = active');
  });

profileCmd
  .command('use <name>')
  .description('Set active profile globally')
  .action(async (name) => {
    const { setActiveProfile, getAvailableProfileNames } = await import('../lib/core/profiles.js');
    const names = getAvailableProfileNames();
    if (!names.includes(name)) {
      console.error(`Profile not found: ${name}. Available: ${names.join(', ')}`);
      process.exit(1);
    }
    setActiveProfile(name);
    console.log(`Active profile set to: ${name}`);
  });

profileCmd
  .command('show')
  .description('Show current profile config')
  .action(async () => {
    const { getEffectiveProfile, getActiveProfileName } = await import('../lib/core/profiles.js');
    const active = getActiveProfileName();
    const { sources, targets } = getEffectiveProfile(process.cwd());
    console.log('Active profile:', active);
    console.log('Sources:', sources.length);
    console.log('Targets:', targets.length);
    targets.forEach((t) => console.log('  →', t.path));
  });

profileCmd
  .command('create')
  .description('Create a new profile (wizard)')
  .action(async () => {
    const { text, confirm } = await import('@clack/prompts');
    const { getDataDir } = await import('../lib/core/targets.js');
    const { readFileSync, writeFileSync, existsSync, mkdirSync } = await import('node:fs');
    const { join } = await import('node:path');
    const yaml = (await import('js-yaml')).default;
    const { getProfilePath, setActiveProfile } = await import('../lib/core/profiles.js');
    const name = await text({ message: 'Profile name (e.g. my-profile)', validate: (v) => (v && /^[a-z0-9-]+$/.test(v) ? true : 'Use lowercase letters, numbers, hyphens only') });
    if (name === undefined) process.exit(0);
    const dataDir = getDataDir();
    const profilesDir = join(dataDir, 'profiles');
    const path = join(profilesDir, `${name}.yaml`);
    if (existsSync(path)) {
      console.error(`Profile already exists: ${name}`);
      process.exit(1);
    }
    let base = { name, description: `Profile: ${name}`, sources: ['sources/global-instructions.md', 'sources/code-style.md', 'sources/git-conventions.md'], targets: { claude: { global: '~/.claude/CLAUDE.md', project: './CLAUDE.md' }, cursor: { project: '.cursor/rules/base.md' }, codex: { global: '~/.codex/instructions.md', project: './AGENTS.md' }, copilot: { project: '.github/copilot-instructions.md' }, windsurf: { project: '.windsurfrules' } }, mcps: { required: ['filesystem'], optional: ['github'] } };
    const defaultPath = getProfilePath('default');
    if (existsSync(defaultPath)) {
      try {
        base = { ...yaml.load(readFileSync(defaultPath, 'utf8')), name, description: `Profile: ${name}` };
      } catch {}
    }
    if (!existsSync(profilesDir)) mkdirSync(profilesDir, { recursive: true });
    writeFileSync(path, yaml.dump(base), 'utf8');
    console.log(`Created profile: ${name} at ${path}`);
    const setActive = await confirm({ message: 'Set as active profile?', initialValue: true });
    if (setActive) {
      setActiveProfile(name);
      console.log('Active profile set to:', name);
    }
  });

program
  .command('update')
  .description('Update devsync package and merge new registry/profile files into ~/.devsync (no overwrites)')
  .action(async () => {
    const { ensureDataDirBootstrap } = await import('../lib/core/init.js');
    const { execa } = await import('execa');
    const verbose = process.env.DEVSYNC_VERBOSE === '1';
    try {
      await execa('npm', ['update', '-g', 'devsync'], { stdio: verbose ? 'inherit' : 'pipe', reject: false });
    } catch (e) {
      if (verbose) console.error('npm update -g devsync:', e.message);
    }
    ensureDataDirBootstrap();
    console.log('Updated. New registry/profile files merged into ~/.devsync (existing files unchanged).');
  });

const args = process.argv.slice(2);
if (args.length === 0) {
  runDashboard().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  program.parse();
}
