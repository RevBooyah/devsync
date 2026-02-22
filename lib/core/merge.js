import { createHash } from 'node:crypto';

const SECTION_RE = /^(#{1,3})\s+(.+)$/gm;

/**
 * @typedef {{ level: number, heading: string, body: string }} Section
 */

/**
 * Parse markdown into sections by H1/H2/H3. Top-level content before the first heading is section 0 with heading ''.
 * @param {string} markdown
 * @returns {Section[]}
 */
export function parseSections(markdown) {
  const sections = [];
  let lastIndex = 0;
  let lastLevel = 0;
  let lastHeading = '';
  let lastBody = '';
  let match;
  SECTION_RE.lastIndex = 0;
  while ((match = SECTION_RE.exec(markdown)) !== null) {
    const level = match[1].length;
    const heading = match[2].trim();
    lastBody = markdown.slice(lastIndex, match.index).replace(/\n+$/, '');
    if (lastLevel > 0 || lastHeading !== '' || lastBody) {
      sections.push({ level: lastLevel, heading: lastHeading, body: lastBody });
    }
    lastLevel = level;
    lastHeading = heading;
    lastBody = '';
    lastIndex = match.index;
  }
  lastBody = markdown.slice(lastIndex).replace(/\n+$/, '');
  sections.push({ level: lastLevel, heading: lastHeading, body: lastBody });
  return sections;
}

/**
 * Normalize heading for matching: trim and use exact string (case-sensitive).
 * @param {string} heading
 * @returns {string}
 */
function normHeading(heading) {
  return heading.trim();
}

/**
 * @typedef {{ targetPath: string, heading: string, existingContent: string, sourceContent: string }} Conflict
 */

/**
 * Deduplicate sections by heading: keep first level, concatenate bodies for same heading.
 * @param {Section[]} sections
 * @returns {Section[]}
 */
function dedupeSectionsByHeading(sections) {
  const byHeading = new Map();
  for (const s of sections) {
    const key = normHeading(s.heading);
    if (!key) {
      if (!byHeading.has('')) byHeading.set('', { ...s });
      else byHeading.get('').body += '\n\n' + s.body;
      continue;
    }
    if (!byHeading.has(key)) {
      byHeading.set(key, { ...s });
    } else {
      const existing = byHeading.get(key);
      existing.body = (existing.body + '\n\n' + s.body).trim();
    }
  }
  return [...byHeading.values()];
}

/**
 * Merge source sections into target sections. Target order preserved; new source sections appended; same heading + same body skipped; same heading + different body = conflict (keep target).
 * @param {Section[]} sourceSections
 * @param {Section[]} targetSections
 * @param {string} targetPath - For conflict reporting
 * @returns {{ merged: Section[], conflicts: Conflict[] }}
 */
export function mergeSections(sourceSections, targetSections, targetPath) {
  const sourceDeduped = dedupeSectionsByHeading(sourceSections);
  const merged = targetSections.map((s) => ({ ...s }));
  const seenHeadings = new Set();
  for (const t of targetSections) {
    const k = normHeading(t.heading);
    if (k) seenHeadings.add(k);
  }

  const conflicts = /** @type {Conflict[]} */ ([]);

  for (const src of sourceDeduped) {
    const key = normHeading(src.heading);
    if (!seenHeadings.has(key)) {
      merged.push({ ...src });
      if (key) seenHeadings.add(key);
      continue;
    }
    const existing = merged.find((m) => normHeading(m.heading) === key);
    if (!existing) continue;
    const existingBody = existing.body.trim();
    const sourceBody = src.body.trim();
    if (existingBody !== sourceBody) {
      conflicts.push({
        targetPath,
        heading: src.heading,
        existingContent: existingBody,
        sourceContent: sourceBody,
      });
    }
  }

  return { merged, conflicts };
}

/**
 * Apply one conflict resolution to merged sections (mutates sections in place).
 * @param {Section[]} sections
 * @param {Conflict} conflict
 * @param {'keep'|'overwrite'} resolution
 */
export function applyConflictResolution(sections, conflict, resolution) {
  if (resolution === 'keep') return;
  const key = normHeading(conflict.heading);
  const s = sections.find((m) => normHeading(m.heading) === key);
  if (s) s.body = conflict.sourceContent;
}

/**
 * Serialize sections back to markdown.
 * @param {Section[]} sections
 * @returns {string}
 */
export function sectionsToMarkdown(sections) {
  const out = [];
  for (const s of sections) {
    if (s.level === 0 && s.heading === '') {
      if (s.body) out.push(s.body);
      continue;
    }
    const prefix = '#'.repeat(s.level);
    out.push(`${prefix} ${s.heading}`);
    if (s.body) out.push(s.body);
    out.push('');
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}

const DEVSYNC_HASH_COMMENT_RE = /^<!--\s*devsync-hash:\s*([a-f0-9]+)\s*-->\s*\n?/i;

/**
 * Strip devsync-hash comment from the start of content if present.
 * @param {string} content
 * @returns {{ content: string, hash: string | null }}
 */
export function stripHashComment(content) {
  const match = content.match(DEVSYNC_HASH_COMMENT_RE);
  if (match) {
    return { content: content.slice(match[0].length), hash: match[1] };
  }
  return { content, hash: null };
}

/**
 * Prepend devsync-hash comment. Hash is of the source content (for audit outdated check).
 * @param {string} sourceContent - Combined source used to build this output
 * @param {string} mergedMarkdown - Merged markdown to write
 * @returns {string}
 */
export function withHashComment(sourceContent, mergedMarkdown) {
  const hash = createHash('sha256').update(sourceContent, 'utf8').digest('hex');
  return `<!-- devsync-hash: ${hash} -->\n${mergedMarkdown}`;
}

/**
 * Merge combined source markdown into existing target file content. Returns merged sections, conflicts, and hash.
 * @param {string} combinedSource - Concatenated content of all source files
 * @param {string} targetContent - Current target file content (without hash comment for parsing)
 * @param {string} targetPath
 * @returns {{ mergedSections: Section[], conflicts: Conflict[], sourceHash: string }}
 */
export function mergeMarkdown(combinedSource, targetContent, targetPath) {
  const srcSections = parseSections(combinedSource);
  const { content: targetWithoutHash } = stripHashComment(targetContent);
  const tgtSections = parseSections(targetWithoutHash);
  const { merged: mergedSections, conflicts } = mergeSections(srcSections, tgtSections, targetPath);
  const sourceHash = createHash('sha256').update(combinedSource, 'utf8').digest('hex');
  return { mergedSections, conflicts, sourceHash };
}
