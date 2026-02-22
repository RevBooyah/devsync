# devsync — Build Phases

This document is the implementation roadmap for Claude Code.
Work through phases in order. Each phase should be fully functional before starting the next.

---

## Phase 1 — Project Scaffold & CLI Skeleton

**Goal:** Runnable CLI with all commands registered, no logic yet.

### Tasks
- [ ] Initialize `package.json` with dependencies:
  - `commander` — CLI argument parsing
  - `ink` + `react` — TUI framework
  - `@clack/prompts` — wizard-style prompts
  - `js-yaml` — YAML parsing
  - `dotenv` — .env loading
  - `chalk` — terminal colors (fallback for non-Ink output)
  - `execa` — shell command execution
  - `semver` — version comparison for outdated checks
- [ ] Create `bin/devsync.js` entry point with all 6 commands registered via `commander`
- [ ] Stub out each command handler with placeholder output
- [ ] Create `lib/core/targets.js` — OS detection (`process.platform`, WSL detection via `/proc/version`)
- [ ] Create `lib/core/env.js` — load `~/.devsync/.env`, prompt + save missing vars
- [ ] Add `.gitignore` (node_modules, .env files, *.local.yaml)
- [ ] Add `README.md` skeleton
- [ ] Create stub `lib/tui/Dashboard.jsx` — prints system summary (active profile, data dir path, list of available commands) without launching a full TUI; replaced with full implementation in Phase 6

### Acceptance criteria
- `devsync --help` lists all commands
- `devsync init` prints "init not yet implemented"
- OS detection correctly identifies win32 / wsl / darwin

---

## Phase 2 — MCP Registry & Installer

**Goal:** `devsync mcp` fully functional.

### Tasks
- [ ] Create `registry/mcp-registry.yaml` with at minimum these entries:
  - filesystem, todoist, windows-mcp, github, brave-search, sequential-thinking
- [ ] Create `lib/mcp/registry.js` — load, validate, filter by current platform
- [ ] Create `lib/mcp/installer.js`:
  - Check if package already installed globally (`npm list -g`)
  - Run install command via `execa`
  - Inject config block into **both** `claude_desktop_config.json` (Claude Desktop) and `~/.claude.json` (Claude Code) — merge `mcpServers` key only, never overwrite either file wholesale
  - Substitute `{{VAR_NAME}}` placeholders from `.env` or prompt user
- [ ] Create `lib/mcp/validator.js`:
  - Read both `claude_desktop_config.json` and `~/.claude.json`
  - For each configured MCP, attempt to ping it: spawn the process, send a JSON-RPC `initialize` request (`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"devsync","version":"1.0.0"}}}`), and expect a valid `result` response. Any error or timeout = unhealthy.
  - Report status: running / misconfigured / not installed
- [ ] Create `lib/tui/MCPManager.jsx` — Ink component:
  - List all registry MCPs with install status
  - Checkbox selection to install/remove
  - Live status indicators during install
- [ ] Wire `devsync mcp` command to MCPManager TUI

### Acceptance criteria
- `devsync mcp` shows list of available MCPs with current install status
- Can install a new MCP, secrets get prompted and saved to `~/.devsync/.env`
- Config correctly injected into `claude_desktop_config.json` without breaking existing entries
- Validator correctly reports running/not-running for installed MCPs

---

## Phase 3 — Config File Sync (Markdown Merge Engine)

**Goal:** `devsync sync` distributes source files to tool targets with intelligent merge.

### Tasks
- [ ] Create `sources/` directory with starter content:
  - `global-instructions.md` — general AI assistant instructions
  - `code-style.md` — coding standards (concise code, expand for debugging, etc.)
  - `git-conventions.md` — commit messages, branch naming
- [ ] Create `profiles/default.yaml`, `profiles/frontend.yaml`, `profiles/backend.yaml`
- [ ] Create `lib/core/profiles.js` — load profile, resolve source list, resolve target paths via `targets.js`
- [ ] Create `lib/core/merge.js` — the markdown merge engine:
  - Parse markdown into sections using heading hierarchy
  - Identify matching sections between source and target by heading text
  - Merge strategy: append new, skip identical, flag differing
  - Return: merged content + list of conflicts
- [ ] Create `lib/tui/ConflictPrompt.jsx` — per-conflict resolution UI:
  - Show diff of conflicting section
  - Options: `[k] keep` / `[o] overwrite` / `[s] skip file` / `[e] open in $EDITOR`
  - For `[e]`: open target file in `$EDITOR`, wait for exit, then exit devsync with a message to re-run `devsync sync` to continue
- [ ] Wire `devsync sync` to profile loader → merge engine → conflict prompt → write files
- [ ] Support per-project override via `.devsync.yaml` in project root

### Acceptance criteria
- `devsync sync` in a fresh project creates all target files from profile sources
- Running `devsync sync` twice does not duplicate any content
- Conflict prompt works correctly — keeps/overwrites as instructed
- Per-project `.devsync.yaml` overrides global profile settings

---

## Phase 4 — Audit Engine

**Goal:** `devsync audit` scans current project and machine, produces scored report with fix prompts.

### Tasks
- [ ] Create `lib/core/audit.js`:
  - Check presence + content of all expected config files
  - Parse `claude_desktop_config.json` and `~/.claude.json`
  - Compare installed MCPs against registry recommended list
  - Check for placeholder/empty env vars in MCP configs
  - Run `npm outdated -g` and parse output for MCP packages
  - Call `validator.js` to ping each configured MCP
  - Return structured findings array with severity: good / suboptimal / missing
- [ ] Create `lib/tui/AuditView.jsx` — Ink component:
  - Grouped display: Config Files / MCP Servers / Skills
  - Color-coded: green ✓ / yellow ⚠ / red ✗
  - Summary line with issue count
  - "Fix all?" prompt that walks through each issue
  - Per-issue fix actions call the appropriate installer/sync/prompt logic
- [ ] Wire `devsync audit` command to AuditView

### Acceptance criteria
- `devsync audit` correctly identifies missing CLAUDE.md in a project with none
- Correctly flags misconfigured MCP (missing env var)
- Correctly flags outdated MCP package version
- "Fix all" successfully resolves at least missing files and env vars

---

## Phase 5 — Skills Checklist & Browser Automation

**Goal:** `devsync skills` helps user verify Claude.ai skill settings.

### Tasks
- [ ] Create `registry/skills-registry.yaml` with all known Claude.ai toggleable features
- [ ] Create `lib/skills/checklist.js` — load skills registry, render as interactive checklist
- [ ] Create `lib/tui/SkillsChecklist.jsx` — Ink component:
  - List all skills with recommended state
  - Show navigation instructions for each (e.g. "Settings → Features → Web Search")
  - Allow user to mark each as confirmed
- [ ] Create `lib/skills/browser.js` — **optional, install Playwright separately:**
  - Check if Playwright is available (`npx playwright --version`)
  - If available, offer to open claude.ai settings and auto-toggle recommended skills
  - If not available, show manual instructions only
  - Warn user this is fragile and may break with Claude.ai UI updates
- [ ] Wire `devsync skills` command to SkillsChecklist TUI

### Acceptance criteria
- `devsync skills` shows all skills with recommended states and navigation instructions
- Manual checklist can be stepped through and confirmed
- Browser automation (if Playwright installed) successfully opens claude.ai settings page

---

## Phase 6 — Init Wizard & Profile Management

**Goal:** `devsync init` provides a guided first-time setup, `devsync profile` lets users switch.

### Tasks
- [ ] Create full `devsync init` wizard flow using `@clack/prompts`:
  - Welcome screen
  - Profile selection (default / frontend / backend / create new)
  - Tool selection (which AI tools are you using?)
  - MCP install for recommended servers (calls Phase 2 logic)
  - Config file sync (calls Phase 3 logic)
  - Skills checklist (calls Phase 5 logic)
  - Summary of what was done
- [ ] Create `devsync profile` command:
  - `devsync profile list` — show available profiles
  - `devsync profile use <name>` — switch active profile globally
  - `devsync profile create` — wizard to create new profile
  - `devsync profile show` — show current profile config
- [ ] Store active profile selection in `~/.devsync/config.yaml` (key: `active_profile`)
- [ ] Add `--profile <name>` flag to `devsync sync` and `devsync audit`

### Acceptance criteria
- `devsync init` on a fresh machine completes the full setup flow
- `devsync profile use backend` switches profile and subsequent sync uses backend sources/targets
- Profile flag overrides work: `devsync sync --profile frontend`

---

## Phase 7 — Polish & Team Sharing

**Goal:** Clean it up for public GitHub release, teammate onboarding.

### Tasks
- [ ] Write full `README.md`:
  - Install instructions
  - Quick start
  - Profile system explanation
  - How to add your own MCPs to the registry
  - How to contribute source files / profiles back
- [ ] Add `devsync update` command — runs `npm update -g devsync` to pull the latest package (the npm package is the upstream source of truth), then copies any new registry/profile files from the updated bundle into `~/.devsync/` without overwriting existing user-modified files
- [ ] Add `--dry-run` flag to `sync` and `init` — show what would change without writing
- [ ] Add `--verbose` flag globally
- [ ] Error handling audit — every file write, npm exec, and config parse should have a clear error message
- [ ] Test on all three platforms: Windows native, WSL, macOS
- [ ] Add `CONTRIBUTING.md` explaining how teammates can add their own MCP entries and profiles
- [ ] Publish to npm (optional)

---

## Key Design Rules (remind Claude Code throughout)

1. **Never overwrite** `claude_desktop_config.json` or `~/.claude.json` wholesale — always merge the `mcpServers` key only, into both
2. **Never commit secrets** — `.env` files and any file containing `{{VAR_NAME}}` substituted values must be gitignored
3. **Idempotent operations** — every command should be safe to run multiple times
4. **Platform checks** — always guard Windows-only and WSL-only code paths
5. **Graceful degradation** — if a tool isn't installed (Cursor, Codex, etc.), skip it silently unless `--verbose`
6. **Registry is the source of truth** — never hardcode MCP names or paths in logic files
