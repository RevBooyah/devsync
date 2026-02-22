import React from 'react';
import { Box, Text } from 'ink';

/**
 * Displays one conflict and resolution options.
 * Used when sync is run with TTY; resolution is handled via @clack/prompts in the sync command.
 * This component can be used by an Ink-based sync flow to show conflict details.
 *
 * @param {{ targetPath: string, heading: string, existingContent: string, sourceContent: string }} conflict
 */
export default function ConflictPrompt({ conflict }) {
  return React.createElement(
    Box,
    { flexDirection: 'column', padding: 1 },
    React.createElement(Text, { color: 'yellow' }, `Conflict in ${conflict.targetPath} → "${conflict.heading}"`),
    React.createElement(Text, {}, '  [k] keep existing  [o] overwrite  [s] skip file  [e] open in $EDITOR')
  );
}
