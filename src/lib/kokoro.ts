import { Client } from "@gradio/client";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execFileAsync = promisify(execFile);

// A public, CPU-backed (not ZeroGPU-quota-limited) Kokoro TTS Space. Handles
// a full narration script in one call, unlike a locally-run single Kokoro
// generate() call, which caps out at roughly 25-30s of audio regardless of
// input length.
const TTS_SPACE = "ysharma/Make_Custom_Voices_With_KokoroTTS";

export type NarratorVoice = "female" | "male";

// This Space's older Kokoro v0.19 voice set doesn't include the newer
// af_heart/am_* v1.0 names - these are what it actually has loaded.
const VOICE_FORMULAS: Record<NarratorVoice, string> = {
  female: "1.0 * af_bella",
  male: "1.0 * am_michael",
};

let clientPromise: Promise<Client> | null = null;

function connect(hfToken?: string): Promise<Client> {
  if (!clientPromise) {
    clientPromise = Client.connect(TTS_SPACE, hfToken ? { token: hfToken as `hf_${string}` } : {}).catch((err) => {
      clientPromise = null;
      throw err;
    });
  }
  return clientPromise;
}

async function probeDuration(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  return parseFloat(stdout.trim());
}

async function synthesizeSegmentWav(client: Client, text: string, voice: NarratorVoice, wavPath: string): Promise<void> {
  const result = await client.predict("/text_to_speech", {
    text,
    formula: VOICE_FORMULAS[voice],
  });
  const data = result.data as [{ url?: string } | null];
  const audioUrl = data?.[0]?.url;
  if (!audioUrl) throw new Error("Kokoro Space did not return an audio file.");

  const res = await fetch(audioUrl);
  if (!res.ok) throw new Error(`Failed to download narration audio (${res.status}).`);
  await fs.writeFile(wavPath, Buffer.from(await res.arrayBuffer()));
}

export interface NarrationSegmentResult {
  text: string;
  durationInSeconds: number;
}

export interface NarrationResult {
  mp3Path: string;
  durationInSeconds: number;
  segments: NarrationSegmentResult[];
}

export interface GenerateNarrationOptions {
  hfToken?: string;
  voice?: NarratorVoice;
  /** Playback speed applied after synthesis via ffmpeg's atempo filter (0.5-2.0). 1 = unchanged. */
  speed?: number;
}

/**
 * Synthesizes one clip per segment - so each scene's spoken duration can be
 * measured individually and used to size that scene's video time exactly -
 * concatenates them into a single track, optionally retimes it, and
 * transcodes the result to mp3.
 */
export async function generateNarrationMp3(
  segments: string[],
  outPath: string,
  options: GenerateNarrationOptions = {}
): Promise<NarrationResult> {
  const { hfToken, voice = "female", speed = 1 } = options;
  if (segments.length === 0) throw new Error("At least one narration segment is required.");

  const client = await connect(hfToken);
  const dir = path.dirname(outPath);
  const base = path.basename(outPath, path.extname(outPath));

  const segmentWavPaths: string[] = [];
  const rawSegments: NarrationSegmentResult[] = [];
  const concatListPath = path.join(dir, `${base}-concat.txt`);
  const concatWavPath = path.join(dir, `${base}-concat.wav`);

  try {
    for (let i = 0; i < segments.length; i++) {
      const wavPath = path.join(dir, `${base}-seg${i}.wav`);
      await synthesizeSegmentWav(client, segments[i], voice, wavPath);
      const durationInSeconds = await probeDuration(wavPath);
      segmentWavPaths.push(wavPath);
      rawSegments.push({ text: segments[i], durationInSeconds });
    }

    const concatList = segmentWavPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
    await fs.writeFile(concatListPath, concatList);
    await execFileAsync("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", concatListPath, "-c", "copy", concatWavPath]);

    const clampedSpeed = Math.min(2, Math.max(0.5, speed));
    const speedFilter = clampedSpeed !== 1 ? ["-filter:a", `atempo=${clampedSpeed.toFixed(3)}`] : [];
    await execFileAsync("ffmpeg", ["-y", "-i", concatWavPath, ...speedFilter, "-codec:a", "libmp3lame", "-b:a", "128k", outPath]);

    const durationInSeconds = await probeDuration(outPath);
    // atempo retimes the whole track uniformly, so each segment's share of
    // it scales by the same factor.
    const segmentResults = clampedSpeed !== 1
      ? rawSegments.map((s) => ({ ...s, durationInSeconds: s.durationInSeconds / clampedSpeed }))
      : rawSegments;

    return { mp3Path: outPath, durationInSeconds, segments: segmentResults };
  } finally {
    await Promise.all(segmentWavPaths.map((p) => fs.unlink(p).catch(() => {})));
    await fs.unlink(concatListPath).catch(() => {});
    await fs.unlink(concatWavPath).catch(() => {});
  }
}
