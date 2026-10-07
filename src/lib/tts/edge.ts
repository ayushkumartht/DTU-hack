import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { getFfmpegPath, getFfprobePath } from "../ffmpegPath";
import type { LangCode } from "../teachings";

const execFileAsync = promisify(execFile);

export type EdgeGender = "female" | "male";

/** Neural voices for each supported language. Indian-English is used to read the verified English quote. */
const VOICES: Record<string, Record<EdgeGender, string>> = {
  hi: { female: "hi-IN-SwaraNeural", male: "hi-IN-MadhurNeural" },
  bn: { female: "bn-IN-TanishaaNeural", male: "bn-IN-BashkarNeural" },
  ta: { female: "ta-IN-PallaviNeural", male: "ta-IN-ValluvarNeural" },
  te: { female: "te-IN-ShrutiNeural", male: "te-IN-MohanNeural" },
  mr: { female: "mr-IN-AarohiNeural", male: "mr-IN-ManoharNeural" },
  gu: { female: "gu-IN-DhwaniNeural", male: "gu-IN-NiranjanNeural" },
  kn: { female: "kn-IN-SapnaNeural", male: "kn-IN-GaganNeural" },
  en: { female: "en-IN-NeerjaNeural", male: "en-IN-PrabhatNeural" },
};

export function isEdgeLanguage(lang: LangCode): boolean {
  return lang in VOICES;
}

export interface EdgeSegment {
  text: string;
  /** Language this particular segment is written in (the verified quote may differ from the story language). */
  lang: LangCode;
}

export interface EdgeNarrationOptions {
  gender?: EdgeGender;
  /** 1 = natural. 0.9 = 10% slower. Applied by the voice itself, so pitch stays natural. */
  speed?: number;
  /** Silence after every segment except the last, so each idea can land. */
  gapSeconds?: number;
}

export interface EdgeNarrationResult {
  mp3Path: string;
  durationInSeconds: number;
  /** durationInSeconds includes the trailing pause, so beat timing matches the audio exactly. */
  segments: { text: string; durationInSeconds: number }[];
}

async function probeSeconds(file: string): Promise<number> {
  const { stdout } = await execFileAsync(getFfprobePath(), [
    "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file,
  ]);
  const n = parseFloat(stdout.trim());
  if (!Number.isFinite(n)) throw new Error("Could not measure narration length.");
  return n;
}

function rateString(speed: number): string {
  const pct = Math.round((Math.min(1.4, Math.max(0.6, speed)) - 1) * 100);
  return `${pct >= 0 ? "+" : ""}${pct}%`;
}

async function synthesizeOne(tts: MsEdgeTTS, text: string, dir: string, speed: number): Promise<string> {
  const { audioFilePath } = await tts.toFile(dir, text, { rate: rateString(speed) });
  return audioFilePath;
}

/**
 * One clip per segment (so each beat's real duration is known), joined with short pauses.
 * Free Microsoft neural voices through msedge-tts: no GPU quota, no API key.
 */
export async function generateEdgeNarration(
  segments: EdgeSegment[],
  outPath: string,
  options: EdgeNarrationOptions = {}
): Promise<EdgeNarrationResult> {
  const { gender = "female", speed = 0.92, gapSeconds = 0.5 } = options;
  if (segments.length === 0) throw new Error("At least one narration segment is required.");
  for (const s of segments) {
    if (!isEdgeLanguage(s.lang)) throw new Error(`No voice available for language '${s.lang}'.`);
  }

  const workDir = path.join(path.dirname(outPath), `edge-${crypto.randomUUID()}`);
  await fs.mkdir(workDir, { recursive: true });
  const clients = new Map<string, MsEdgeTTS>();

  try {
    const clipPaths: string[] = [];
    const clipSeconds: number[] = [];

    for (let i = 0; i < segments.length; i++) {
      const voice = VOICES[segments[i].lang][gender];
      let tts = clients.get(voice);
      if (!tts) {
        tts = new MsEdgeTTS();
        await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
        clients.set(voice, tts);
      }
      const segDir = path.join(workDir, `seg${i}`);
      await fs.mkdir(segDir, { recursive: true });
      const file = await synthesizeOne(tts, segments[i].text, segDir, speed);
      clipPaths.push(file);
      clipSeconds.push(await probeSeconds(file));
    }

    // A real silent clip with the same format, so concatenation never glitches.
    const gapPath = path.join(workDir, "gap.mp3");
    await execFileAsync(getFfmpegPath(), [
      "-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", String(gapSeconds), "-c:a", "libmp3lame", "-b:a", "96k", gapPath,
    ]);

    const list = clipPaths
      .flatMap((p, i) => (i < clipPaths.length - 1 ? [p, gapPath] : [p]))
      .map((p) => `file '${p.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`)
      .join("\n");
    const listPath = path.join(workDir, "list.txt");
    await fs.writeFile(listPath, list, "utf-8");
    await execFileAsync(getFfmpegPath(), ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c:a", "libmp3lame", "-b:a", "128k", outPath]);

    const result = segments.map((s, i) => ({
      text: s.text,
      durationInSeconds: clipSeconds[i] + (i < segments.length - 1 ? gapSeconds : 0),
    }));
    return { mp3Path: outPath, durationInSeconds: await probeSeconds(outPath), segments: result };
  } finally {
    clients.forEach((c) => c.close());
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
