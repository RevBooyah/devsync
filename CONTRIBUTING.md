# Contributing to devsync

Thanks for contributing. This doc covers adding MCPs, profiles, and source content so you and your team can share config.

## Adding MCPs to the registry

The registry is the single source of truth for MCP install and config. To add an MCP for yourself or to propose it upstream:

1. **Local (your machine only)**  
   Ensure `~/.devsync/registry/` exists (run `devsync init` once). Copy the bundled registry if you haven’t already:
   - From source: `cp registry/mcp-registry.yaml ~/.devsync/registry/`
   - After that, edit `~/.devsync/registry/mcp-registry.yaml`.

2. **Entry format** (add under `mcps:`):

   ```yaml
   - id: my-mcp
     name: My MCP
     package: "npm-package-name"
     install: npm install -g npm-package-name
     config:
       command: npx
       args: ["-y", "npm-package-name", "{{MY_VAR}}"]
     vars:
       MY_VAR:
         prompt: "Enter value for MY_VAR"
         secret: false
     tags: [optional, tags]
     recommended: false
     platforms: [win32, wsl, darwin]
   ```

   - Use `{{VAR_NAME}}` in `config.args` or `config.env` for values from `~/.devsync/.env` (user is prompted on first use).
   - Set `platforms` so the MCP only appears on relevant platforms.

3. **Proposing for the main repo**  
   Open a PR that adds or edits an entry in `registry/mcp-registry.yaml`. Keep the same schema and add a short comment if the MCP needs special setup.

## Adding or changing profiles

Profiles define which sources are synced and where.

1. **Local**  
   Create or edit files in `~/.devsync/profiles/`. Use `devsync profile create` to copy from default, or copy an existing profile and rename.

2. **Profile schema**  
   - `name`, `description`  
   - `sources`: list of paths under `~/.devsync/sources/` (e.g. `sources/global-instructions.md`)  
   - `targets`: map of tool id to `global:` and/or `project:` paths  
   - `mcps.required` / `mcps.optional`: MCP ids for audit and init

3. **Proposing for the main repo**  
   Open a PR that adds or edits a file in `profiles/`. The repo ships `default`, `frontend`, and `backend`; new profiles should follow the same schema.

## Adding or changing source files

Source files are markdown that get merged into CLAUDE.md, Cursor rules, etc.

1. **Local**  
   Add or edit files in `~/.devsync/sources/`. Reference them from your profile’s `sources` list.

2. **Proposing for the main repo**  
   Open a PR that adds or edits a file in `sources/`. The merge engine uses H1/H2/H3 sections; keep headings clear so merging and conflict resolution make sense.

## Skills registry

To add or change Claude.ai skills (for `devsync skills`), edit `registry/skills-registry.yaml`. Schema: `id`, `name`, `description`, `recommended`, `notes` (navigation text). Propose changes via PR.

## Design rules (everyone)

- **Registry is source of truth** — no hardcoded MCP names or paths in code.
- **Never overwrite** `claude_desktop_config.json` or `~/.claude.json` wholesale; only merge the `mcpServers` key.
- **Secrets** stay in `~/.devsync/.env`; never commit them or substitute values into committed files.
- **Idempotent** — commands should be safe to run repeatedly.

## Running from source

```bash
git clone <repo>
cd devsync
npm install
npm install -g .
devsync --help
```

Run tests (when added): `npm test`.

## Pull requests

- Keep changes focused; one feature or fix per PR when possible.
- Follow existing style (ESM, Node 20+).
- Update README or CONTRIBUTING if you change behavior or add options.
