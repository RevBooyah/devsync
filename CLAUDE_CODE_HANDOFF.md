# devsync — Claude Code Session Starter

Use this as your opening prompt when starting a Claude Code session on this project.

---

## Paste this into Claude Code to begin:

```
I'm building a tool called `devsync` — a cross-platform CLI/TUI for managing AI coding environment configs (MCP servers, CLAUDE.md, Cursor rules, etc.) across Claude Desktop, Claude Code, Cursor, Codex, and GitHub Copilot.

Please read PLANNING.md and BUILD_PHASES.md before doing anything else. Those documents contain:
- Full architecture and directory structure
- All design decisions (already finalized, don't re-ask)
- MCP and skills registry schemas
- OS path resolution table
- Phased build order with acceptance criteria

Start with Phase 1 from BUILD_PHASES.md. Complete each acceptance criteria item before moving to the next phase. Ask me before starting a new phase.

Key rules to follow throughout:
- Never overwrite claude_desktop_config.json wholesale — merge only the mcpServers key
- Never commit secrets — .env files are always gitignored
- All operations must be idempotent (safe to run multiple times)
- Always guard Windows/WSL/macOS code paths separately
- Registry files are the source of truth — no hardcoded MCP names in logic
```

---

## Tips for the session

- If Claude Code asks about a decision already covered in PLANNING.md, point it back to the doc
- At the end of each phase, run `devsync --help` and test the acceptance criteria manually
- Keep `registry/mcp-registry.yaml` updated as you add your own MCP servers
- The `sources/` folder is where your personal AI instructions live — customize these early

## Your MCP servers to add to the registry

When Phase 2 is complete, make sure to add entries for the MCPs you're already using:
- Todoist MCP (already in registry template)
- Windows-MCP (already in registry template)  
- Filesystem MCP (already in registry template)
- GitHub MCP (already in registry template)
- Any others from your current claude_desktop_config.json

## Your existing configs to reference

Before running `devsync init`, consider copying your current working configs into `sources/` as starting content:
- Any existing CLAUDE.md content
- Cursor rules you've built up
- Coding style preferences
