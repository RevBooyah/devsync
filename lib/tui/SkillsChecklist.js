import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { getSkills } from '../skills/checklist.js';

function SkillsList({ skills, selectedIndex, confirmedIds }) {
  const rows = skills.map((skill, i) => {
    const isSelected = i === selectedIndex;
    const isConfirmed = confirmedIds.has(skill.id);
    const rec = skill.recommended ? ' *' : '';
    const check = isConfirmed ? '✓' : ' ';
    const line = `${isSelected ? '>' : ' '} [${check}] ${skill.name}${rec}`;
    return React.createElement(Text, { key: skill.id }, line);
  });
  return React.createElement(Box, { flexDirection: 'column' }, ...rows);
}

export default function SkillsChecklist() {
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [confirmedIds, setConfirmedIds] = useState(new Set());
  const [showNotes, setShowNotes] = useState(false);

  const load = useCallback(() => {
    try {
      setSkills(getSkills());
      setSelectedIndex(0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useInput((input, key) => {
    if (key.upArrow) setSelectedIndex((i) => Math.max(0, i - 1));
    if (key.downArrow) setSelectedIndex((i) => Math.min(skills.length - 1, i + 1));
    if (input === ' ' || input === 'c' || input === 'C') {
      const skill = skills[selectedIndex];
      if (skill) {
        setConfirmedIds((prev) => {
          const next = new Set(prev);
          if (next.has(skill.id)) next.delete(skill.id);
          else next.add(skill.id);
          return next;
        });
      }
    }
    if (input === 'n' || input === 'N') setShowNotes((v) => !v);
    if (input === 'o' || input === 'O') {
      import('../skills/browser.js').then(({ openClaudeSettings }) => {
        openClaudeSettings().catch(() => {});
      });
    }
    if (input === 'q' || input === 'Q') process.exit(0);
  });

  if (loading) {
    return React.createElement(Box, {}, React.createElement(Text, {}, 'Loading skills registry...'));
  }
  if (error) {
    return React.createElement(Box, {}, React.createElement(Text, { color: 'red' }, error));
  }

  const selected = skills[selectedIndex];
  const notesLine = showNotes && selected
    ? React.createElement(Text, { dim: true }, `  → ${selected.notes || '—'}`)
    : null;

  return React.createElement(
    Box,
    { flexDirection: 'column', padding: 1 },
    React.createElement(Box, { marginBottom: 1 },
      React.createElement(Text, { bold: true }, 'Claude.ai Skills'),
      React.createElement(Text, {}, '  (* = recommended)')
    ),
    React.createElement(SkillsList, { skills, selectedIndex, confirmedIds }),
    notesLine,
    React.createElement(Box, { marginTop: 1 },
      React.createElement(Text, { dim: true }, '  space: confirm  n: notes  o: open settings  ↑/↓: select  q: quit')
    )
  );
}
