// The system prompt in /api/story always appends the reference section as:
// \n---\n### Reference...  Pulling it out before segmenting keeps scene highlighting
// confined to the narrative, and the reference list renders as a plain, uncolored block.
const REFERENCE_SPLIT = /\n(?=-{3,}\s*\n#{1,6}[^\n]*reference)/i;

export interface SplitStoryResult {
  narrative: string;
  reference: string | null;
}

export function splitStory(story: string): SplitStoryResult {
  const index = story.search(REFERENCE_SPLIT);
  if (index === -1) {
    return { narrative: story.trim(), reference: null };
  }
  return {
    narrative: story.slice(0, index).trim(),
    reference: story.slice(index).trim(),
  };
}

/**
 * Groups `units` (in order) into `count` contiguous, length-balanced chunks,
 * joined with `joiner`. Never promises more groups than there are units to
 * fill them with, and always closes the moment the remaining units exactly
 * match the remaining groups, so every group gets at least one unit.
 */
function balanceIntoGroups(units: string[], count: number, joiner: string): string[] {
  if (units.length === 0) return [];

  const groupCount = Math.min(count, units.length);
  if (groupCount <= 1) return [units.join(joiner)];

  const totalLength = units.reduce((sum, u) => sum + u.length, 0);
  const target = totalLength / groupCount;

  const groups: string[][] = [];
  let current: string[] = [];
  let currentLength = 0;

  units.forEach((unit, index) => {
    current.push(unit);
    currentLength += unit.length;

    const unitsRemaining = units.length - index - 1;
    const groupsStillNeeded = groupCount - 1 - groups.length;
    const canCloseMore = groupsStillNeeded > 0;
    const shouldClose = canCloseMore && (currentLength >= target || unitsRemaining <= groupsStillNeeded);

    if (shouldClose) {
      groups.push(current);
      current = [];
      currentLength = 0;
    }
  });
  if (current.length) groups.push(current);

  return groups.map((g) => g.join(joiner));
}

/**
 * Groups the narrative's paragraphs into `count` contiguous, char-length-balanced
 * chunks, in original order, so each chunk stays valid standalone markdown.
 */
export function segmentNarrative(narrative: string, count: number): string[] {
  const paragraphs = narrative
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return balanceIntoGroups(paragraphs, count, "\n\n");
}

/**
 * Splits plain prose into sentences (a simple period/!/? + whitespace
 * boundary - good enough for narration text, which has no abbreviations or
 * markdown) and groups them into `count` length-balanced chunks. Used as a
 * deterministic fallback when an LLM won't reliably split its own narration
 * into evenly-sized, exactly-N pieces (see src/app/api/story/narration/route.ts).
 */
export function segmentIntoSentenceGroups(text: string, count: number): string[] {
  const sentences = (text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [text])
    .map((s) => s.trim())
    .filter(Boolean);
  return balanceIntoGroups(sentences, count, " ");
}
