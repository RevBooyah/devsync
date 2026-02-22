# devsync

Cross-platform CLI/TUI for managing AI coding environment configs across Claude Desktop, Claude Code, Cursor, Copilot, and other tools. Single source of truth for MCP servers, CLAUDE.md, Cursor rules, and project health.

## Install

**From source (development):**

```bash
git clone <repo>
cd devsync
npm install
npm install -g .
```

**From npm (when published):**

```bash
npm install -g devsync
```

**Requirements:** Node.js 20+

## Quick start

1. **First-time setup**

   ```bash
   devsync init
   ```

   This populates `~/.devsync/` with sources, registry, and profiles (without overwriting existing files), then runs a wizard: choose a profile, optionally install recommended MCPs, and sync config files into the current project.

2. **Sync config files into a project**

   ```bash
   cd your-project
   devsync sync
   ```

   Writes CLAUDE.md, `.cursor/rules/base.md`, and other targets from the active profile’s sources. Idempotent; conflicts are prompted (keep / overwrite / skip / edit).

3. **Manage MCP servers**

   ```bash
   devsync mcp              # TUI: list, install, remove, validate
   devsync mcp list         # Scriptable list
   devsync mcp install <id> # e.g. devsync mcp install filesystem
   devsync mcp remove <id>
   devsync mcp validate
   ```

4. **Check project health**

   ```bash
   devsync audit            # Config files + MCP status
   devsync audit --profile frontend   # Use a different profile for the check
   ```

5. **Claude.ai skills checklist**

   ```bash
   devsync skills           # Interactive checklist; "o" opens Claude.ai settings
   ```

6. **Profiles**

   ```bash
   devsync profile list
   devsync profile use backend
   devsync profile show
   devsync profile create   # Wizard to add a new profile
   devsync sync --profile frontend   # One-off use of a profile
   ```

## Commands

| Command | Description |
|--------|-------------|
| `devsync` | Dashboard (overview + command list) |
| `devsync init` | First-time setup wizard; populates `~/.devsync` and runs profile/MCP/sync flow |
| `devsync sync` | Sync profile sources to config targets (CLAUDE.md, Cursor rules, etc.) |
| `devsync mcp` | Manage MCP servers (TUI or subcommands: list, install, remove, validate) |
| `devsync skills` | Claude.ai skills checklist and open settings |
| `devsync audit` | Scan project and machine; report missing/outdated config and MCP status |
| `devsync profile` | list, use \<name\>, show, create |
| `devsync update` | Update the devsync package and merge new registry/profile files into `~/.devsync` (no overwrites) |

**Options (where applicable):**

- `--dry-run` — `sync` / `init`: show what would be written, don’t write.
- `--profile <name>` — `sync` / `audit`: use this profile instead of the active one.
- `--verbose` — Extra logging (e.g. skipped tools, errors).

## Profile system

- **Active profile** is stored in `~/.devsync/config.yaml` as `active_profile: <name>`.
- **Profile files** live in `~/.devsync/profiles/` (user) or the bundled `profiles/` (default, frontend, backend). Each profile defines:
  - `sources`: list of markdown files under `~/.devsync/sources/`
  - `targets`: per-tool paths (e.g. claude project: `./CLAUDE.md`, cursor: `.cursor/rules/base.md`)
  - `mcps`: required / optional MCP ids (for audit and init)
- **Per-project override:** `.devsync.yaml` in the project root is deep-merged over the active profile (sources, targets, mcps). Not added to `.gitignore` by default—teams can commit it for shared config or ignore it for personal overrides.

Switch profile globally: `devsync profile use <name>`. Use a profile once: `devsync sync --profile <name>`.

## Adding your own MCPs to the registry

1. **User registry (recommended):** Copy the bundled registry into your data dir so updates don’t overwrite you:

   ```bash
   mkdir -p ~/.devsync/registry
   cp node_modules/devsync/registry/mcp-registry.yaml ~/.devsync/registry/
   # or, if running from source:
   cp registry/mcp-registry.yaml ~/.devsync/registry/
   ```

2. Edit `~/.devsync/registry/mcp-registry.yaml` and add an entry under `mcps:` (see `registry/mcp-registry.yaml` in the repo for the schema: `id`, `name`, `package`, `install`, `config`, `vars`, `platforms`, etc.).

3. Use `devsync mcp list` and `devsync mcp install <id>` as usual. Secrets are prompted and stored in `~/.devsync/.env`.

## Contributing source files and profiles

- **Sources:** Edit or add markdown under `~/.devsync/sources/`. To contribute back, copy your file into the repo’s `sources/` and open a PR.
- **Profiles:** Add or edit YAML in `~/.devsync/profiles/`. To contribute, copy into the repo’s `profiles/` and open a PR.
- **Registry:** Prefer contributing new MCP entries (or skills) via PRs to `registry/mcp-registry.yaml` or `registry/skills-registry.yaml` so others get them after `devsync update`.

See `CONTRIBUTING.md` for more detail.

## Data directory

All user data lives under **`~/.devsync/`**:

- `config.yaml` — active profile and other global settings
- `profiles/` — profile YAML files (user + copied from bundle)
- `sources/` — markdown source files merged into targets
- `registry/` — MCP and skills registry YAML (user + copied from bundle)
- `.env` — secrets (never committed); used for `{{VAR}}` substitution in MCP configs

`devsync init` and `devsync update` copy from the bundle only **missing** files; they never overwrite your changes.

## Design rules

- **MCP config:** Only the `mcpServers` key is merged into Claude Desktop and Claude Code config files; the rest of the file is left intact.
- **Idempotent:** Safe to run any command multiple times.
- **Secrets:** Stored only in `~/.devsync/.env`; never committed.

## Docs

- `PLANNING.md` — Product and architecture overview
- `BUILD_PHASES.md` — Implementation phases and acceptance criteria
- `CLAUDE.md` — Guidance for AI assistants working in this repo
- `CONTRIBUTING.md` — How to add MCPs, profiles, and contribute back

## Development

- `npm test` — run tests (when added)
- Tested on Windows (native), WSL, and macOS; path resolution is platform-aware.

## License

MIT
