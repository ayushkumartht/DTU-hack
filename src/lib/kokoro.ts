import { Client } from "@gradio/client";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";

const execFileAsync = promisify(execFile);

// A public, CPU-backed (not ZeroGPU-quota-limited) Kokoro TTS Space. Handles
// a full narration script in one call, unlike a locally-run single Kokoro
// generate() call, which caps out at roughly 25-30s of audio regardless of
// input length.
const TTS_SPACE = "ysharma/Make_Custom_Voices_With_KokoroTTS";
const VOICE_FORMULA = "1.0 * af_bella";

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

export interface NarrationResult {
  mp3Path: string;
  durationInSeconds: number;
}

/** Generates speech for `text` via the Kokoro Space, transcodes it to mp3 at `outPath`, and returns its duration. */
export async function generateNarrationMp3(
  text: string,
  outPath: string,
  hfToken?: string
): Promise<NarrationResult> {
  const client = await connect(hfToken);

  const result = await client.predict("/text_to_speech", {
    text,
    formula: VOICE_FORMULA,
  });

  const data = result.data as [{ url?: string } | null];
  const audioUrl = data?.[0]?.url;
  if (!audioUrl) {
    throw new Error("Kokoro Space did not return an audio file.");
  }

  const wavPath = outPath.replace(/\.mp3$/i, ".wav");
  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) {
    throw new Error(`Failed to download narration audio (${audioRes.status}).`);
  }
  await fs.writeFile(wavPath, Buffer.from(await audioRes.arrayBuffer()));

  try {
    await execFileAsync("ffmpeg", ["-y", "-i", wavPath, "-codec:a", "libmp3lame", "-b:a", "128k", outPath]);
  } finally {
    await fs.unlink(wavPath).catch(() => {});
  }

  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    outPath,
  ]);
  const durationInSeconds = parseFloat(stdout.trim());

  return { mp3Path: outPath, durationInSeconds };
}
