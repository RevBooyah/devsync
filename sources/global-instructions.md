# Global instructions

Use this file as the base for AI assistant behavior across tools.

## General

- Be concise unless the user asks for detail or the task requires it.
- Prefer small, focused edits. Explain briefly when making larger changes.
- When debugging, expand logging or add checks rather than guessing.

## Output

- Prefer plain text and markdown. Use code blocks with language tags when showing code.
- For file paths, use the format appropriate to the project (Unix or Windows).
