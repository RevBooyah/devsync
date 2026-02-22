# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`devsync` is a cross-platform CLI/TUI tool (Node.js) that serves as a single source of truth for developers using multiple AI coding environments. It manages MCP server installation/configuration, syncs AI tool config files (CLAUDE.md, Cursor rules, Copilot instructions, etc.), and audits project health.

**Status:** Pre-implementation. Only planning docs exist. Follow `BUILD_PHASES.md` in order — complete each phase fully before starting the next.

## Stack

- **CLI:** `commander` (argument parsing)
- **TUI:** `ink` + `react` (React for terminals), `@clack/prompts` (wizard-style prompts)
- **Config:** `js-yaml`, `dotenv`
- **Execution:** `execa`, `chalk`, `semver`
- **Optional:** Playwright (browser automation for skills feature, installed separately)

## Commands (once implemented)

```bash
npm install -g .        # Install globally during development
devsync --help          # List all commands
devsync init            # First-time setup wizard
devsync sync            # Sync configs to current project
devsync mcp             # Manage MCP servers
devsync skills          # Claude.ai skills checklist
devsync audit           # Scan project, report findings
devsync profile         # Switch or create profiles
```

## Architecture

### Directory Layout (planned)

```
bin/devsync.js           # CLI entry point
lib/core/
  targets.js             # OS detection + path resolution (win32/wsl/darwin)
  env.js                 # ~/.devsync/.env read/write + secret prompting
  merge.js               # Markdown section merge engine
  profiles.js            # Profile loader/switcher
  audit.js               # Project/machine config scanner
lib/mcp/
  registry.js            # Loads registry/mcp-registry.yaml, filters by platform
  installer.js           # npm install + non-destructive config injection
  validator.js           # Pings MCP servers via MCP initialize handshake
lib/tui/                 # Ink React components
  MCPManager.jsx
  AuditView.jsx
  ConflictPrompt.jsx
  SkillsChecklist.jsx
lib/skills/
  checklist.js
  browser.js             # Optional Playwright automation
registry/
  mcp-registry.yaml      # Curated MCP list (source of truth for all MCP logic)
  skills-registry.yaml
profiles/
  default.yaml / frontend.yaml / backend.yaml
sources/                 # Markdown source files merged into tool targets
templates/
```

### Core Concepts

**Profile system (two levels):**
- Global: `~/.devsync/profile.yaml` (all machines)
- Per-project: `.devsync.yaml` in project root (overrides global)

**Markdown merge engine** (`lib/core/merge.js`): Parses source and target into sections by H1/H2/H3 headings. Append new sections, skip identical, flag differing as conflicts. This makes `sync` idempotent.

**MCP config injection**: Always merge only the `mcpServers` key into `claude_desktop_config.json` — never overwrite the whole file.

**Secrets**: All secrets in `~/.devsync/.env`, never committed. MCP registry/profile YAMLs use `{{VAR_NAME}}` placeholders substituted at sync time.

**Platform detection** (`lib/core/targets.js`): Detect `win32` / `wsl` (via `/proc/version`) / `darwin`. WSL must translate Windows-side Claude Desktop config paths to `/mnt/c/Users/...`.

### OS Config Paths

| Tool | Windows | WSL/Linux | macOS |
|------|---------|-----------|-------|
| Claude Desktop | `%APPDATA%\Claude\claude_desktop_config.json` | `~/.config/Claude/` | `~/Library/Application Support/Claude/` |
| Claude Code | `%APPDATA%\Claude\.claude.json` | `~/.claude.json` | `~/.claude.json` |
| Cursor | `%APPDATA%\Cursor\` | `~/.cursor/` | `~/.cursor/` |
| devsync env | `%USERPROFILE%\.devsync\.env` | `~/.devsync/.env` | `~/.devsync/.env` |

## Key Design Rules

1. **Never overwrite** `claude_desktop_config.json` wholesale — merge `mcpServers` key only
2. **Idempotent** — every command must be safe to run multiple times
3. **Platform guards** — always separate win32/wsl/darwin code paths explicitly
4. **Graceful degradation** — skip tools not installed unless `--verbose`
5. **Registry is source of truth** — never hardcode MCP names or paths in logic files

## Implementation Order

Follow `BUILD_PHASES.md`. The phases are:
1. Project scaffold + CLI skeleton (all 6 commands stubbed, OS detection, `.env` handling)
2. MCP registry + installer + validator + MCPManager TUI
3. Config file sync (markdown merge engine + ConflictPrompt TUI)
4. Audit engine + AuditView TUI
5. Skills checklist + optional Playwright automation
6. Init wizard + profile management commands
7. Polish: `--dry-run`, `--verbose`, `devsync update`, cross-platform testing
