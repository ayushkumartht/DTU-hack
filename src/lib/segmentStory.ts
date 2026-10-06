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
 * Groups the narrative's paragraphs into `count` contiguous, char-length-balanced
 * chunks, in original order, so each chunk stays valid standalone markdown.
 */
export function segmentNarrative(narrative: string, count: number): string[] {
  const paragraphs = narrative
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return [];

  // Never promise more groups than there are paragraphs to fill them with.
  const groupCount = Math.min(count, paragraphs.length);
  if (groupCount <= 1) return [paragraphs.join("\n\n")];

  const totalLength = paragraphs.reduce((sum, p) => sum + p.length, 0);
  const target = totalLength / groupCount;

  const groups: string[][] = [];
  let current: string[] = [];
  let currentLength = 0;

  paragraphs.forEach((paragraph, index) => {
    current.push(paragraph);
    currentLength += paragraph.length;

    const paragraphsRemaining = paragraphs.length - index - 1;
    const groupsStillNeeded = groupCount - 1 - groups.length;
    const canCloseMore = groupsStillNeeded > 0;
    // Close early once at the target length, or force a close the moment there are
    // exactly as many paragraphs left as groups left, so every group gets at least one.
    const shouldClose = canCloseMore && (currentLength >= target || paragraphsRemaining <= groupsStillNeeded);

    if (shouldClose) {
      groups.push(current);
      current = [];
      currentLength = 0;
    }
  });
  if (current.length) groups.push(current);

  return groups.map((g) => g.join("\n\n"));
}
