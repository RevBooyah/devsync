<!-- devsync-hash: 90d1c07137b983233f0a395045bf38b207032bc51006ed1ac6ea5001fd14a224 -->
# CLAUDE.md
# CLAUDE.md

# CLAUDE.md
# CLAUDE.md

# CLAUDE.md
# CLAUDE.md

# CLAUDE.md
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
## Project Overview

## Project Overview
## Project Overview

## Project Overview
## Project Overview

## Project Overview
## Project Overview

`devsync` is a cross-platform CLI/TUI tool (Node.js) that serves as a single source of truth for developers using multiple AI coding environments. It manages MCP server installation/configuration, syncs AI tool config files (CLAUDE.md, Cursor rules, Copilot instructions, etc.), and audits project health.

**Status:** Pre-implementation. Only planning docs exist. Follow `BUILD_PHASES.md` in order — complete each phase fully before starting the next.

## Stack
## Stack

## Stack
## Stack

## Stack
## Stack

## Stack
## Stack

- **Runtime:** Node.js 20 LTS minimum (uses native fetch); set `engines` in `package.json`
- **CLI:** `commander` (argument parsing)
- **TUI:** `ink` + `react` (React for terminals), `@clack/prompts` (wizard-style prompts)
- **Config:** `js-yaml`, `dotenv`
- **Execution:** `execa`, `chalk`, `semver`
- **Optional:** Playwright (browser automation for skills feature, installed separately)

## Commands (once implemented)
## Commands (once implemented)

## Commands (once implemented)
## Commands (once implemented)

## Commands (once implemented)
## Commands (once implemented)

## Commands (once implemented)
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
## Architecture

## Architecture
## Architecture

## Architecture
## Architecture

## Architecture
## Architecture

### Directory Layout (planned)
### Directory Layout (planned)

### Directory Layout (planned)
### Directory Layout (planned)

### Directory Layout (planned)
### Directory Layout (planned)

### Directory Layout (planned)
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
```

### Core Concepts
### Core Concepts

### Core Concepts
### Core Concepts

### Core Concepts
### Core Concepts

### Core Concepts
### Core Concepts

**Data directory** (`~/.devsync/`): `devsync init` copies the bundled `sources/`, `registry/`, and `profiles/` directories here on first run — skipping any files that already exist so user customizations are never overwritten. All subsequent reads/writes use `~/.devsync/` as the working copy. `lib/core/targets.js` exposes a `getDataDir()` helper that always resolves to this path.

**Profile system (two levels):**
- Global: `~/.devsync/config.yaml` — stores the active profile name and other global settings (e.g. `active_profile: default`)
- Per-project: `.devsync.yaml` in project root — deep-merged on top of the active profile using the same schema as a profile YAML. Any field can be overridden (sources list, targets, mcps). Use `profile: <name>` to inherit from a named base, or define everything standalone. Not added to `.gitignore` by default — teams may commit it for shared per-project config.

**Markdown merge engine** (`lib/core/merge.js`): Parses source and target into sections by H1/H2/H3 headings. Append new sections, skip identical, flag differing as conflicts. This makes `sync` idempotent. Conflict resolution options: `[k] keep` / `[o] overwrite` / `[s] skip file` / `[e] open in $EDITOR` (re-run sync after editing).

**MCP config injection**: Merge only the `mcpServers` key into **both** `claude_desktop_config.json` (Claude Desktop) and `~/.claude.json` (Claude Code) — never overwrite either file wholesale. Both files get the same MCP entries.

**Audit heuristics**: "Meaningful content" = at least 1 markdown heading + 50 non-whitespace characters. "Outdated" = content hash stored as a comment header in the target file (`<!-- devsync-hash: <sha256> -->`) differs from the hash of the current source; mtime is not used.

**Secrets**: All secrets in `~/.devsync/.env`, never committed. MCP registry/profile YAMLs use `{{VAR_NAME}}` placeholders substituted at sync time.

**Platform detection** (`lib/core/targets.js`): Detect `win32` / `wsl` (via `/proc/version`) / `darwin`. WSL always uses `~/` paths — devsync does not write to Windows-side paths when running in WSL.

**`devsync mcp` — dual interface**: Bare `devsync mcp` opens the Ink TUI (MCPManager.jsx). Subcommands (`devsync mcp list`, `devsync mcp install <id>`, `devsync mcp remove <id>`, `devsync mcp validate`) are scriptable and call the same underlying logic without launching the TUI.

**`devsync` (bare command)**: Opens Dashboard.jsx — the main Ink TUI view showing overall system status. Implemented as a stub in Phase 1 (prints summary + available commands); full implementation in Phase 6.

**`devsync update`**: Pulls the latest registry files by running `npm update -g devsync` (the npm package is the upstream source of truth). Does not overwrite user-customized files in `~/.devsync/` — only adds new registry entries that don't already exist.

### OS Config Paths
### OS Config Paths

### OS Config Paths
### OS Config Paths

### OS Config Paths
### OS Config Paths

### OS Config Paths
### OS Config Paths

| Tool | Windows | WSL/Linux | macOS |
|------|---------|-----------|-------|
| Claude Desktop | `%APPDATA%\Claude\claude_desktop_config.json` | `~/.config/Claude/claude_desktop_config.json` | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Code | `%APPDATA%\Claude\.claude.json` | `~/.claude.json` | `~/.claude.json` |
| Cursor | `%APPDATA%\Cursor\` | `~/.cursor/` | `~/.cursor/` |
| Codex | `%USERPROFILE%\.codex\` | `~/.codex/` | `~/.codex/` |
| devsync env | `%USERPROFILE%\.devsync\.env` | `~/.devsync/.env` | `~/.devsync/.env` |

## Key Design Rules
## Key Design Rules

## Key Design Rules
## Key Design Rules

## Key Design Rules
## Key Design Rules

## Key Design Rules
## Key Design Rules

1. **Never overwrite** `claude_desktop_config.json` or `~/.claude.json` wholesale — merge `mcpServers` key only, into both
2. **Idempotent** — every command must be safe to run multiple times
3. **Platform guards** — always separate win32/wsl/darwin code paths explicitly
4. **Graceful degradation** — skip tools not installed unless `--verbose`
5. **Registry is source of truth** — never hardcode MCP names or paths in logic files

## Implementation Order
## Implementation Order

## Implementation Order
## Implementation Order

## Implementation Order
## Implementation Order

## Implementation Order
## Implementation Order

Follow `BUILD_PHASES.md`. The phases are:
1. Project scaffold + CLI skeleton (all 6 commands stubbed, OS detection, `.env` handling)
2. MCP registry + installer + validator + MCPManager TUI
3. Config file sync (markdown merge engine + ConflictPrompt TUI)
4. Audit engine + AuditView TUI
5. Skills checklist + optional Playwright automation
6. Init wizard + profile management commands
7. Polish: `--dry-run`, `--verbose`, `devsync update`, cross-platform testing

# Global instructions
# Global instructions

# Global instructions
# Global instructions

# Global instructions
# Global instructions

# Global instructions
# Global instructions

Use this file as the base for AI assistant behavior across tools.

## General
## General

## General
## General

## General
## General

## General
## General

- Be concise unless the user asks for detail or the task requires it.
- Prefer small, focused edits. Explain briefly when making larger changes.
- When debugging, expand logging or add checks rather than guessing.

## Output
## Output

## Output
## Output

## Output
## Output

## Output
## Output

- Prefer plain text and markdown. Use code blocks with language tags when showing code.
- For file paths, use the format appropriate to the project (Unix or Windows).

# Code style
# Code style

# Code style
# Code style

# Code style
# Code style

# Code style
# Code style

## When debugging
## When debugging

## When debugging
## When debugging

## When debugging
## When debugging

## When debugging
## When debugging

- Prefer adding logs or assertions over large refactors to “see what happens.”
- Isolate the failing case before changing behavior.

## Naming
## Naming

## Naming
## Naming

## Naming
## Naming

## Naming
## Naming

- Use consistent naming with the rest of the codebase.
- Prefer descriptive names for public APIs and config; short names are fine for locals where scope is small.

# Git conventions
# Git conventions

# Git conventions
# Git conventions

# Git conventions
# Git conventions

# Git conventions
# Git conventions

## Commit messages
## Commit messages

## Commit messages
## Commit messages

## Commit messages
## Commit messages

## Commit messages
## Commit messages

- Use present tense and imperative: “Add feature” not “Added feature.”
- First line: short summary (about 50 chars). Optionally add a body after a blank line.
- Reference issues or tickets when relevant.

## Branches
## Branches

## Branches
## Branches

## Branches
## Branches

## Branches
## Branches

- Use a consistent prefix (e.g. `feature/`, `fix/`, `docs/`) if the team uses one.
- Keep branch names short and descriptive.

## Before committing
## Before committing

## Before committing
## Before committing

## Before committing
## Before committing

## Before committing
## Before committing

- Run tests and the linter if the project defines them.
- Avoid committing commented-out code, debug logs, or local paths.
