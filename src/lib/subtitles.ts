export interface SubtitleCue {
  startSeconds: number;
  endSeconds: number;
  text: string;
}

function stamp(seconds: number, comma: boolean): string {
  const totalMs = Math.round(seconds * 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  const h = Math.floor(totalMs / 3_600_000);
  const m = Math.floor((totalMs % 3_600_000) / 60_000);
  const s = Math.floor((totalMs % 60_000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}${comma ? "," : "."}${pad(totalMs % 1000, 3)}`;
}

export function toSRT(cues: SubtitleCue[]): string {
  return cues
    .map((c, i) => `${i + 1}\n${stamp(c.startSeconds, true)} --> ${stamp(c.endSeconds, true)}\n${c.text}\n`)
    .join("\n");
}

export function toVTT(cues: SubtitleCue[]): string {
  const body = cues.map((c) => `${stamp(c.startSeconds, false)} --> ${stamp(c.endSeconds, false)}\n${c.text}\n`);
  return `WEBVTT\n\n${body.join("\n")}`;
}

/** Splits text into evenly-timed phrase cues of `wordsPerCue` words (kinetic-caption style). */
export function buildCues(text: string, startSeconds: number, durationSeconds: number, wordsPerCue = 3): SubtitleCue[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const groups: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerCue) groups.push(words.slice(i, i + wordsPerCue).join(" "));
  const per = durationSeconds / groups.length;
  return groups.map((g, i) => ({
    startSeconds: startSeconds + i * per,
    endSeconds: startSeconds + (i + 1) * per,
    text: g,
  }));
}
