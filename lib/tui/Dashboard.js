import React from 'react';
import { Text, Box } from 'ink';
import { getDataDir, getPlatform } from '../core/targets.js';

const COMMANDS = [
  'init   — First-time setup wizard',
  'sync   — Sync configs to current project',
  'mcp    — Manage MCP servers',
  'skills — Claude.ai skills checklist',
  'audit  — Scan project, report findings',
  'profile — Switch or create profiles',
];

export default function Dashboard() {
  const dataDir = getDataDir();
  const platform = getPlatform();
  const activeProfile = '(not set)'; // Phase 6: read from ~/.devsync/config.yaml

  return React.createElement(
    Box,
    { flexDirection: 'column', padding: 1 },
    React.createElement(
      Box,
      { marginBottom: 1 },
      React.createElement(Text, { bold: true }, 'devsync'),
      React.createElement(Text, {}, ' — AI development config manager')
    ),
    React.createElement(
      Box,
      { flexDirection: 'column', marginBottom: 1 },
      React.createElement(Text, {}, `Data dir:   ${dataDir}`),
      React.createElement(Text, {}, `Platform:  ${platform}`),
      React.createElement(Text, {}, `Profile:   ${activeProfile}`)
    ),
    React.createElement(
      Box,
      { flexDirection: 'column' },
      React.createElement(Text, { bold: true }, 'Commands'),
      ...COMMANDS.map((line) =>
        React.createElement(Text, { key: line }, `  ${line}`)
      )
    )
  );
}
