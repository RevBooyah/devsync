import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { spawn } from 'node:child_process';
import { runAudit } from '../core/audit.js';

function severitySymbol(severity) {
  if (severity === 'good') return { symbol: '✓', color: 'green' };
  if (severity === 'suboptimal') return { symbol: '⚠', color: 'yellow' };
  return { symbol: '✗', color: 'red' };
}

function AuditReport({ result, cwd }) {
  const configRows = result.config.map((f) => {
    const { symbol, color } = severitySymbol(f.severity);
    return React.createElement(Text, { key: f.id },
      `  ${symbol}  `,
      React.createElement(Text, { color }, f.message),
      React.createElement(Text, {}, `  ${f.detail || ''}`)
    );
  });
  const mcpRows = result.mcp.map((f) => {
    const { symbol, color } = severitySymbol(f.severity);
    return React.createElement(Text, { key: f.id },
      `  ${symbol}  `,
      React.createElement(Text, { color }, f.message),
      React.createElement(Text, {}, `  ${f.detail || ''}`)
    );
  });

  const fixLine = result.issues > 0
    ? React.createElement(Text, {}, '  f: fix all (run sync, then prompt for MCP installs)  q: quit')
    : React.createElement(Text, {}, '  q: quit');

  return React.createElement(
    Box,
    { flexDirection: 'column', padding: 1 },
    React.createElement(Text, { bold: true }, `devsync audit — ${cwd}`),
    React.createElement(Text, {}, '─'.repeat(50)),
    React.createElement(Text, { bold: true }, 'Config Files'),
    ...configRows,
    React.createElement(Text, {}),
    React.createElement(Text, { bold: true }, 'MCP Servers'),
    ...mcpRows,
    React.createElement(Text, {}),
    React.createElement(Text, {}, '─'.repeat(50)),
    React.createElement(Text, {}, `${result.issues} issue(s) found.`),
    React.createElement(Text, {}),
    fixLine
  );
}

function runFixAll(cwd) {
  const bin = process.argv[1];
  const child = spawn(process.execPath, [bin, 'sync'], { stdio: 'inherit', cwd });
  child.on('close', (code) => {
    if (code !== 0) process.exit(code);
    process.exit(0);
  });
}

export default function AuditView({ profileOverride }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const cwd = process.cwd();
  const auditOpts = profileOverride ? { profile: profileOverride } : undefined;

  useEffect(() => {
    runAudit(cwd, auditOpts)
      .then(setResult)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [cwd, profileOverride]);

  useInput((input) => {
    if (input === 'q' || input === 'Q') process.exit(0);
    if (input === 'f' || input === 'F') {
      if (result && result.issues > 0) runFixAll(cwd);
    }
  });

  if (loading) {
    return React.createElement(Box, {}, React.createElement(Text, {}, 'Running audit...'));
  }
  if (error) {
    return React.createElement(Box, {}, React.createElement(Text, { color: 'red' }, error));
  }
  return React.createElement(AuditReport, { result, cwd });
}
