import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { getEffectiveProfile } from './profiles.js';
import {
  mergeMarkdown,
  withHashComment,
  stripHashComment,
  sectionsToMarkdown,
  applyConflictResolution,
} from './merge.js';

/**
 * @typedef {{ targetPath: string, heading: string, existingContent: string, sourceContent: string }} Conflict
 * @typedef {'keep'|'overwrite'|'skip'|'editor'} Resolution
 */

/**
 * Run sync: load profile, merge sources into each target, resolve conflicts, write.
 * @param {string} cwd - Project root
 * @param {{ resolveConflict: (conflict: Conflict) => Promise<Resolution>, profile?: string }} opts - resolveConflict for each conflict; optional profile override (--profile)
 * @returns {{ written: string[], skipped: string[], openedEditor: boolean }}
 */
export async function runSync(cwd, opts) {
  const profileOpts = opts.profile ? { profile: opts.profile } : undefined;
  const { sources: sourcePaths, targets } = getEffectiveProfile(cwd, profileOpts);

  let combinedSource = '';
  for (const p of sourcePaths) {
    if (existsSync(p)) {
      combinedSource += readFileSync(p, 'utf8') + '\n\n';
    }
  }
  combinedSource = combinedSource.replace(/\n{3,}/g, '\n\n').trimEnd();

  const written = [];
  const skipped = [];
  let openedEditor = false;

  for (const { path: targetPath } of targets) {
    let targetContent = '';
    if (existsSync(targetPath)) {
      targetContent = readFileSync(targetPath, 'utf8');
    }

    const { content: targetForMerge } = stripHashComment(targetContent);
    const { mergedSections, conflicts } = mergeMarkdown(
      combinedSource,
      targetForMerge,
      targetPath
    );

    let shouldSkip = false;

    for (const conflict of conflicts) {
      const resolution = await opts.resolveConflict(conflict);
      if (resolution === 'skip') {
        shouldSkip = true;
        break;
      }
      if (resolution === 'editor') {
        openedEditor = true;
        const { spawn } = await import('node:child_process');
        const editor = process.env.EDITOR || process.env.VISUAL || 'vi';
        const [cmd, ...args] = editor.split(/\s+/);
        spawn(cmd, [...args, targetPath], { stdio: 'inherit' }).on('close', () => {
          process.exit(0);
        });
        return { written, skipped, openedEditor: true };
      }
      applyConflictResolution(mergedSections, conflict, resolution);
    }

    if (shouldSkip) {
      skipped.push(targetPath);
      continue;
    }

    const finalMerged = sectionsToMarkdown(mergedSections);
    const output = withHashComment(combinedSource, finalMerged);
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, output + '\n', 'utf8');
    written.push(targetPath);
  }

  return { written, skipped, openedEditor };
}
