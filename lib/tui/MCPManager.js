import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { getMcpsForPlatform } from '../mcp/registry.js';
import { getConfiguredMcpServers } from '../mcp/validator.js';
import { spawn } from 'node:child_process';

function useMcpState() {
  const [mcps, setMcps] = useState([]);
  const [configured, setConfigured] = useState({});
  const [status, setStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = getMcpsForPlatform();
      const config = getConfiguredMcpServers();
      setMcps(list);
      setConfigured(config);
      setStatus({});
      setSelectedIndex((i) => Math.min(i, Math.max(0, list.length - 1)));
      const { validateAll } = await import('../mcp/validator.js');
      const s = await validateAll();
      setStatus(s);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { mcps, configured, status, loading, selectedIndex, setSelectedIndex, refresh };
}

function runSubcommand(args) {
  return new Promise((resolve, reject) => {
    const bin = process.argv[1];
    const child = spawn(process.execPath, [bin, 'mcp', ...args], {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Exit ${code}`))));
    child.on('error', reject);
  });
}

export default function MCPManager() {
  const { mcps, configured, status, loading, selectedIndex, setSelectedIndex, refresh } = useMcpState();

  useInput((input, key) => {
    if (key.upArrow) setSelectedIndex((i) => Math.max(0, i - 1));
    if (key.downArrow) setSelectedIndex((i) => Math.min(mcps.length - 1, i + 1));
    if (input === 'i' || input === 'I') {
      const entry = mcps[selectedIndex];
      if (!entry || configured[entry.id]) return;
      runSubcommand(['install', entry.id]).then(refresh).catch(() => {});
    }
    if (input === 'r' || input === 'R') {
      const entry = mcps[selectedIndex];
      if (!entry || !configured[entry.id]) return;
      runSubcommand(['remove', entry.id]).then(refresh).catch(() => {});
    }
    if (input === 'v' || input === 'V') {
      refresh();
    }
  });

  if (loading && mcps.length === 0) {
    return React.createElement(Box, {}, React.createElement(Text, {}, 'Loading MCP registry...'));
  }

  const rows = mcps.map((mcp, i) => {
    const isInstalled = !!configured[mcp.id];
    const runStatus = status[mcp.id];
    const line = [
      i === selectedIndex ? '>' : ' ',
      mcp.id.padEnd(22),
      (mcp.recommended ? '*' : ' '),
      isInstalled ? 'installed' : '—',
      runStatus ? runStatus : '—',
    ].join('  ');
    return React.createElement(Text, { key: mcp.id }, line);
  });

  return React.createElement(
    Box,
    { flexDirection: 'column', padding: 1 },
    React.createElement(Box, { marginBottom: 1 },
      React.createElement(Text, { bold: true }, 'MCP Servers'),
      React.createElement(Text, {}, '  (* = recommended)')
    ),
    React.createElement(Box, { flexDirection: 'column', marginBottom: 1 }, ...rows),
    React.createElement(Text, {}, 'i: install  r: remove  v: validate  ↑/↓: select  q: quit')
  );
}
