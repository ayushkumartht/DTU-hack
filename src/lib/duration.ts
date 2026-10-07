import type { LangCode } from "./teachings";

export const MIN_SECONDS = 30;
export const MAX_SECONDS = 60;
export const TARGET_SECONDS = 50;

const MIN_SPEED = 0.85;
const MAX_SPEED = 1.2;

/** Typical speaking rates, words per minute, per language. */
const WPM: Record<string, number> = {
  en: 165,
  // Measured with the slowed (0.92x) neural voices: about 105-115 words per minute including pauses.
  hi: 112,
  bn: 112,
  ta: 105,
  te: 105,
  mr: 112,
  gu: 112,
  kn: 105,
};

export function estimateSpokenSeconds(text: string, lang: LangCode): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return (words / (WPM[lang] ?? 150)) * 60;
}

export function targetWordCount(lang: LangCode, seconds = TARGET_SECONDS): number {
  return Math.round(((WPM[lang] ?? 150) / 60) * seconds);
}

export interface DurationFit {
  /** Total length once `suggestedSpeed` is applied. */
  totalSeconds: number;
  inRange: boolean;
  /** Playback speed that moves the total toward the window. Clamped to [0.85, 1.2]. */
  suggestedSpeed: number;
  advice: "ok" | "too-short" | "too-long";
}

export function fitToWindow(perBeatSeconds: number[]): DurationFit {
  const total = perBeatSeconds.reduce((a, b) => a + b, 0);
  if (total >= MIN_SECONDS && total <= MAX_SECONDS) {
    return { totalSeconds: total, inRange: true, suggestedSpeed: 1, advice: "ok" };
  }
  const tooLong = total > MAX_SECONDS;
  // Aim for the window edge that is nearest. Speed > 1 shortens, < 1 lengthens.
  const raw = total / (tooLong ? MAX_SECONDS : MIN_SECONDS);
  const speed = Math.min(MAX_SPEED, Math.max(MIN_SPEED, Number(raw.toFixed(3))));
  const adjusted = total / speed;
  return {
    totalSeconds: adjusted,
    inRange: adjusted >= MIN_SECONDS && adjusted <= MAX_SECONDS,
    suggestedSpeed: speed,
    advice: tooLong ? "too-long" : "too-short",
  };
}
