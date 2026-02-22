# Document Review: Questions and Undefined Requirements

After going through all project documents (PLANNING.md, BUILD_PHASES.md, CLAUDE.md, README.md, CLAUDE_CODE_HANDOFF.md), here are the issues that need decisions or clearer definitions.

---

## 1. Inconsistencies (pick one and align docs)

### 1.1 Where is the active profile stored?

- **PLANNING.md** and **CLAUDE.md:** `~/.devsync/profile.yaml` — "which named profile is active"
- **BUILD_PHASES.md** Phase 6: `~/.devsync/config.yaml` — "Store active profile selection"

**Decision needed:** One canonical path. Options: (a) `profile.yaml` and use it only for `active: <name>`, or (b) `config.yaml` and add "active profile" there (optionally with other future global settings). Then update the other doc(s) to match.

### 1.2 WSL path behavior

- **PLANNING.md** (line 324): "When Claude Desktop is installed on the **Windows** side, devsync running in **WSL** must translate paths using `/mnt/c/Users/...`."
- **CLAUDE.md** (line 79): "WSL always uses `~/` paths — **no Windows-side path translation**."

**Decision needed:** Either (a) support "devsync in WSL configuring Windows-side Claude Desktop" (translate to Windows paths and write to e.g. `/mnt/c/Users/.../AppData/Roaming/Claude/`), or (b) treat WSL as its own environment and only use WSL paths (`~/.config/Claude/` etc.). Document the chosen behavior in both files.

### 1.3 Conflict resolution fourth option

- **PLANNING.md:** `[m] merge manually`
- **BUILD_PHASES.md:** `open in editor`

**Decision needed:** Define whether "merge manually" means (a) opening the file in `$EDITOR` and re-running sync after the user edits, or (b) some inline merge UI. Then use the same wording in both places.

---

## 2. Underspecified requirements

### 2.1 Claude Code MCP config injection

Docs say to merge `mcpServers` into `claude_desktop_config.json` only. Audit phase parses both `claude_desktop_config.json` and `~/.claude.json`. It is not specified whether the installer should:

- inject into **both** Claude Desktop and Claude Code configs (so both apps get the same MCPs), or
- only into `claude_desktop_config.json`.

If both: document that `.claude.json` gets the same merge treatment and add it to the installer/validator scope in BUILD_PHASES.md.

### 2.2 Audit "content quality" and "outdated" heuristics

PLANNING.md says audit should check:

- "Content quality — does it have meaningful sections or is it empty/placeholder?"
- "Version — is it older than what's in the devsync sources?"

**Needed:**

- **Meaningful content:** Define the rule (e.g. "at least N sections" or "not only boilerplate lines" or "section count + min length"). Same for "placeholder" (e.g. regex or keyword list).
- **Outdated:** Define how to compare. Options: (a) last-modified time of source in `~/.devsync/sources/` vs target file, (b) a version or hash stored in a comment/frontmatter in the source, or (c) content hash. Pick one and document it.

### 2.3 Init when `~/.devsync/` already exists

CLAUDE.md: "On first run (`devsync init`), the tool copies its bundled `sources/`, `registry/`, and `profiles/` directories here."

**Needed:** Behavior when `~/.devsync/` (or subdirs) already exist: (a) skip copy and use existing, (b) overwrite, (c) merge (e.g. copy only missing files), or (d) prompt user. Recommendation: (a) or (c) to avoid wiping user customizations; document in PLANNING and Phase 6.

### 2.4 `devsync update` upstream

BUILD_PHASES.md Phase 7: "pull latest registry from upstream git repo".

**Needed:** Define "upstream" — e.g. (a) the same repo the user installed from (npm package or git clone), (b) a dedicated "devsync-registry" repo, or (c) configurable URL in `~/.devsync/config.yaml`. Document in BUILD_PHASES and/or PLANNING.

### 2.5 Dashboard TUI

CLAUDE.md: "`devsync` (bare command): Opens Dashboard.jsx". BUILD_PHASES.md does not list creating Dashboard.jsx in any phase.

**Needed:** Either add an explicit task (e.g. in Phase 1 or 6) to implement a minimal Dashboard (e.g. welcome + links to init/sync/audit/mcp/skills), or state that the bare command is a stub until a later phase.

### 2.6 Use of `templates/new-project.yaml`

PLANNING.md directory layout includes `templates/new-project.yaml` — "Scaffold template for bootstrapping repos". No phase or flow references it.

**Needed:** Either (a) define when it is used (e.g. `devsync init` "create new" profile, or a future `devsync new` command), or (b) remove it from the planned layout until the feature is scoped.

### 2.7 MCP validator handshake

Phase 2: "Attempt to ping it (spawn process, send MCP initialize handshake)".

**Needed:** Reference or short spec: what exact JSON-RPC method/params to send (e.g. MCP `initialize` request) and how to treat success/failure. This can be a one-line reference to the MCP spec or an internal note in BUILD_PHASES.md or a short comment in the validator task.

### 2.8 Node.js version

No minimum Node version is specified.

**Needed:** Decide minimum (e.g. Node 18 LTS or 20) and add `engines` in `package.json` when scaffolding (Phase 1). Optionally mention in README/PLANNING.

### 2.9 `.devsync.yaml` and git

PLANNING.md: "gitignored or committed depending on team preference".

**Needed:** Clarify devsync's default: (a) do not add `.devsync.yaml` to `.gitignore` (user/team adds it if they want it ignored), or (b) add it to `.gitignore` when creating a new project. Document in one place (e.g. PLANNING or Phase 3).

---

## 3. Optional doc tweaks

- **Codex:** CLAUDE.md OS table does not list Codex; PLANNING.md does. For consistency, either add Codex to CLAUDE.md's table or add a note that tool set is defined in PLANNING.
- **Phase 2 MCP list:** Phase 2 requires "brave-search, sequential-thinking" in the registry; PLANNING examples don't include them. No conflict, but you could add minimal example entries in PLANNING for reference.

---

## Summary

| Category                                         | Count |
| -------------------------------------------------| ----- |
| Inconsistencies (need one decision + doc update) | 3     |
| Underspecified (need a short definition in docs) | 9     |
| Optional doc tweaks                              | 2     |

Recommend resolving **Section 1** and **Section 2.1–2.5** before or during Phase 1–2; the rest can be pinned down as each phase starts.
