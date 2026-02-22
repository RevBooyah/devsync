# Code style

## General

- Write clear, readable code. Prefer simple control flow.
- Use project conventions (linter, formatter, naming) when present.
- Add brief comments only where intent is not obvious.

## When debugging

- Prefer adding logs or assertions over large refactors to “see what happens.”
- Isolate the failing case before changing behavior.

## Naming

- Use consistent naming with the rest of the codebase.
- Prefer descriptive names for public APIs and config; short names are fine for locals where scope is small.
