# devsync — Planning Document

## Overview

`devsync` is a cross-platform CLI/TUI tool for developers who use multiple AI coding environments (Claude Desktop, Claude Code, Cursor, Codex, GitHub Copilot, Windsurf, etc.) and need a single source of truth for:

1. **MCP Server management** — curated registry, install, configure, validate
2. **AI tool config sync** — CLAUDE.md, Cursor rules, Copilot instructions, etc.
3. **Claude.ai Skills reference** — checklist + optional browser automation
4. **Audit existing projects** — detect what's missing, misconfigured, or suboptimal

Target users: the developer themselves + teammates who clone the repo and run it on their own machines.

---

## Runtime & Stack

- **Runtime:** Node.js (cross-platform, team likely has it already)
- **TUI:** [Ink](https://github.com/vadimdemedes/ink) (React for terminals) for dashboard/audit views + [Clack](https://github.com/natemoo-re/clack) for wizard-style prompts
- **Config format:** YAML (human-readable, easy to extend)
- **Secrets:** `.env` file at `~/.devsync/.env`
- **Install:** `npm install -g devsync` (global CLI)

---

## Supported Platforms

- Windows (native)
- WSL / Linux
- macOS

Path resolution must handle all three. WSL paths need special handling when referencing Windows-side config files.

---

## CLI Commands

```
devsync init          # First-time machine setup wizard
devsync sync          # Sync configs to current project
devsync mcp           # Manage MCP servers (list, install, remove, validate)
devsync skills        # Claude.ai skills checklist + optional browser automation
devsync audit         # Scan existing project, report findings, offer fixes
devsync profile       # Switch or create profiles
```

---

## Directory Structure

```
devsync/
├── package.json
├── bin/
│   └── devsync.js                 # CLI entry point (commander.js)
├── lib/
│   ├── tui/
│   │   ├── Dashboard.jsx          # Main Ink TUI view
│   │   ├── AuditView.jsx          # Audit results with fix prompts
│   │   ├── MCPManager.jsx         # MCP install/toggle/status UI
│   │   ├── ConflictPrompt.jsx     # Section-level conflict resolution
│   │   └── SkillsChecklist.jsx    # Claude.ai skills reference UI
│   ├── core/
│   │   ├── audit.js               # Scans existing project configs
│   │   ├── merge.js               # Intelligent markdown section merge
│   │   ├── targets.js             # OS detection + path resolution
│   │   ├── profiles.js            # Profile loader/switcher
│   │   └── env.js                 # .env read/write + secret prompting
│   ├── mcp/
│   │   ├── registry.js            # Loads and validates mcp-registry.yaml
│   │   ├── installer.js           # npm install + config injection
│   │   └── validator.js           # Pings/checks running MCP servers
│   └── skills/
│       ├── checklist.js           # Renders skills reference in TUI
│       └── browser.js             # Optional Playwright automation
├── registry/
│   ├── mcp-registry.yaml          # Curated MCP server list (see schema below)
│   └── skills-registry.yaml       # Claude.ai skills + recommended states
├── profiles/
│   ├── default.yaml               # Default profile (all tools, core MCPs)
│   ├── frontend.yaml              # Frontend-focused profile
│   └── backend.yaml               # Backend/API-focused profile
├── sources/
│   ├── global-instructions.md     # Base AI instructions shared across tools
│   ├── code-style.md              # Coding standards section
│   └── git-conventions.md         # Git workflow section
└── templates/
    └── new-project.yaml           # Scaffold template for bootstrapping repos
```

---

## Profile System

Profiles define which source files map to which tool targets. There are two levels:

- **Global default** (`~/.devsync/profile.yaml`) — applies to all machines
- **Per-project override** (`.devsync.yaml` in project root, gitignored or committed depending on team preference)

### Profile Schema

```yaml
# profiles/default.yaml
name: default
description: Standard setup for all AI coding tools

sources:
  - sources/global-instructions.md
  - sources/code-style.md
  - sources/git-conventions.md

targets:
  claude:
    global: ~/.claude/CLAUDE.md
    project: ./CLAUDE.md
  cursor:
    project: .cursor/rules/base.md
  codex:
    global: ~/.codex/instructions.md
    project: ./AGENTS.md
  copilot:
    project: .github/copilot-instructions.md
  windsurf:
    project: .windsurfrules

mcps:
  required:
    - filesystem
    - todoist
  optional:
    - windows-mcp
    - github
```

---

## Source Merging Strategy

When multiple source files target the same output file, merge intelligently using markdown section boundaries (H1/H2/H3 headings):

1. Parse each source file into sections by heading
2. For the target file, check if a matching heading already exists
3. **If not** → append the section
4. **If yes, content identical** → skip (no duplicate)
5. **If yes, content differs** → flag as conflict, prompt user

This makes `devsync sync` idempotent — running it twice won't duplicate content, and teammates' local additions won't be blown away.

### Conflict Resolution Prompt

```
⚠  Conflict in .cursor/rules/base.md → "## Code Style"
   [k] keep existing   [o] overwrite   [m] merge manually   [s] skip file
```

---

## MCP Registry Schema

```yaml
# registry/mcp-registry.yaml
mcps:
  - id: filesystem
    name: Filesystem MCP
    package: "@modelcontextprotocol/server-filesystem"
    install: npm install -g @modelcontextprotocol/server-filesystem
    config:
      command: npx
      args: ["-y", "@modelcontextprotocol/server-filesystem", "{{ALLOWED_PATHS}}"]
    vars:
      ALLOWED_PATHS:
        prompt: "Enter allowed paths (comma separated)"
        default: "~/projects"
    tags: [core, files]
    recommended: true
    platforms: [win32, wsl, darwin]

  - id: todoist
    name: Todoist MCP
    package: "todoist-mcp"
    install: npm install -g todoist-mcp
    config:
      command: npx
      args: ["-y", "todoist-mcp"]
      env:
        TODOIST_API_KEY: "{{TODOIST_API_KEY}}"
    vars:
      TODOIST_API_KEY:
        prompt: "Enter your Todoist API key"
        secret: true
    tags: [productivity]
    recommended: true
    platforms: [win32, wsl, darwin]

  - id: windows-mcp
    name: Windows MCP
    package: "windows-mcp"
    install: npm install -g windows-mcp
    config:
      command: npx
      args: ["-y", "windows-mcp"]
    tags: [system, windows]
    recommended: false
    platforms: [win32, wsl]            # Only shown on Windows/WSL

  - id: github
    name: GitHub MCP
    package: "@modelcontextprotocol/server-github"
    install: npm install -g @modelcontextprotocol/server-github
    config:
      command: npx
      args: ["-y", "@modelcontextprotocol/server-github"]
      env:
        GITHUB_PERSONAL_ACCESS_TOKEN: "{{GITHUB_PAT}}"
    vars:
      GITHUB_PAT:
        prompt: "Enter your GitHub Personal Access Token"
        secret: true
    tags: [git, code]
    recommended: true
    platforms: [win32, wsl, darwin]
```

---

## Skills Registry Schema

```yaml
# registry/skills-registry.yaml
skills:
  - id: web_search
    name: Web Search
    description: Allows Claude to search the web in real time
    recommended: true
    notes: "Settings → Features → Web Search"

  - id: memory
    name: Memory
    description: Claude remembers context across conversations
    recommended: true
    notes: "Settings → Memory → Enable"

  - id: code_execution
    name: Code Execution & File Creation
    description: Run code and produce downloadable files
    recommended: true
    notes: "Settings → Features → Code Execution"

  - id: artifacts
    name: Artifacts
    description: Render UI components, diagrams, markdown inline
    recommended: true
    notes: "Settings → Features → Artifacts"

  - id: past_chats
    name: Search Past Chats
    description: Claude can reference previous conversations
    recommended: true
    notes: "Settings → Features → Search Past Chats"
```

---

## Audit Logic

`devsync audit` scans the current project and machine config and produces a scored report:

### What it checks

**Config files (project level):**
- Presence of `CLAUDE.md`, `AGENTS.md`, `.cursor/rules/`, `.github/copilot-instructions.md`, `.windsurfrules`
- Content quality — does it have meaningful sections or is it empty/placeholder?
- Version — is it older than what's in the devsync sources?

**MCP servers:**
- Parse `claude_desktop_config.json` (and `~/.claude.json` for Claude Code)
- Compare against registry — flag missing recommended MCPs
- Check for misconfigured paths (especially WSL vs Windows path issues)
- Check for missing or placeholder env vars
- Run `npm outdated -g` to flag stale MCP packages
- Attempt to ping each configured MCP server to verify it's actually working

**Scoring per finding:**
```
✓ good         — present and healthy
⚠ suboptimal   — present but outdated, misconfigured, or incomplete
✗ missing      — not found, recommended by active profile
```

### Audit TUI output (example)

```
devsync audit — /projects/my-app
────────────────────────────────────────
Config Files
  ✓  CLAUDE.md               present, 3 sections
  ⚠  .cursor/rules/base.md   outdated (local older than source)
  ✗  AGENTS.md               missing

MCP Servers
  ✓  filesystem               running
  ✓  todoist                  running
  ⚠  github                   env var GITHUB_PAT not set
  ✗  windows-mcp              not installed (recommended for WSL)

────────────────────────────────────────
3 issues found. Fix all? [y/n]
```

Each issue can be fixed interactively — devsync will walk through each one with prompts.

---

## OS Path Resolution

| Tool        | Windows Native                                      | WSL / Linux              | macOS                                      |
|-------------|-----------------------------------------------------|--------------------------|--------------------------------------------|
| Claude Desktop | `%APPDATA%\Claude\claude_desktop_config.json`    | `~/.config/Claude/`      | `~/Library/Application Support/Claude/`   |
| Claude Code | `%APPDATA%\Claude\.claude.json`                     | `~/.claude.json`         | `~/.claude.json`                           |
| Cursor      | `%APPDATA%\Cursor\`                                 | `~/.cursor/`             | `~/.cursor/`                               |
| Codex       | `%USERPROFILE%\.codex\`                             | `~/.codex/`              | `~/.codex/`                                |
| devsync env | `%USERPROFILE%\.devsync\.env`                       | `~/.devsync/.env`        | `~/.devsync/.env`                          |

WSL note: When Claude Desktop is installed on the Windows side, devsync running in WSL must translate paths using `/mnt/c/Users/...`.

---

## Secrets Handling

- All secrets stored in `~/.devsync/.env`
- `.env` is never committed (`.gitignore` enforced)
- On first use of a secret var, devsync prompts and saves it
- Secrets injected into MCP configs at sync time using `{{VAR_NAME}}` placeholders
- Template files in the repo only contain placeholder names, never values

---

## TUI Flow — `devsync init` (first time)

```
┌─────────────────────────────────────────┐
│  devsync  v1.0.0                        │
│  AI Development Config Manager          │
└─────────────────────────────────────────┘

? Select a profile:
  ▶ default
    frontend
    backend
    [ create new ]

? Which AI tools are you using? (space to select)
  ▶ ◉ Claude Desktop
    ◉ Claude Code
    ◉ Cursor
    ◯ GitHub Copilot
    ◯ Windsurf
    ◯ Codex

Installing recommended MCPs...
  ✓ Filesystem MCP
  ✓ Todoist MCP
  ⚠ GitHub MCP — GITHUB_PAT not set
    ? Enter your GitHub Personal Access Token: ****
  ✓ GitHub MCP

Syncing config files...
  ✓ ~/.claude/CLAUDE.md         created
  ✓ .cursor/rules/base.md       created
  ⚠ CLAUDE.md                  conflict in "## Code Style"
    [k] keep  [o] overwrite  [m] manual  [s] skip  → k

Setup complete. Run `devsync audit` anytime to check project health.
```

---

## Reference Projects (do not reinvent, borrow ideas)

| Project | URL | What to borrow |
|---|---|---|
| mcpm | https://github.com/MCP-Club/mcpm | MCP registry schema, search/install pattern |
| mcp-manager (wyattjoh) | https://github.com/wyattjoh/mcp-manager | Toggle logic, Claude Desktop + Code dual support |
| mcp-config-manager | https://github.com/holstein13/mcp-config-manager | Preset modes, backup/restore patterns |
| ai-rules-sync | https://github.com/lbb00/ai-rules-sync | Multi-tool file target mapping |
| ai-dotfiles | https://github.com/alepeh/ai-dotfiles | Service definition → tool adapter pattern |

---

## Build Order (Phased)

See `BUILD_PHASES.md` for the detailed phase-by-phase implementation plan.
