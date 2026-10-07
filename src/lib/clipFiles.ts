import { execFile } from "child_process";
import { promisify } from "util";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { getFfmpegPath, getFfprobePath } from "./ffmpegPath";

const execFileAsync = promisify(execFile);
const GENERATED_DIR = path.join(process.cwd(), "public", "generated");

export interface SavedClip {
  /** Root-relative, served by /generated/[...file]. Stable, unlike the Space's expiring URLs. */
  videoUrl: string;
  durationInSeconds: number | null;
  /** The clip's last frame. The reel holds on it (with a slow zoom) once the clip ends. */
  stillUrl: string | null;
}

async function probeSeconds(file: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync(getFfprobePath(), [
      "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file,
    ]);
    const n = parseFloat(stdout.trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

async function extractLastFrame(videoFile: string, outFile: string): Promise<boolean> {
  try {
    await execFileAsync(getFfmpegPath(), ["-y", "-sseof", "-0.15", "-i", videoFile, "-frames:v", "1", "-q:v", "2", outFile]);
    await fs.access(outFile);
    return true;
  } catch {
    return false;
  }
}

/** Downloads a clip from a remote URL once, measures it, and saves its last frame beside it. */
export async function saveRemoteClip(remoteUrl: string, hfToken?: string): Promise<SavedClip> {
  const res = await fetch(remoteUrl, hfToken ? { headers: { Authorization: `Bearer ${hfToken}` } } : undefined);
  if (!res.ok) throw new Error(`Could not download the generated clip (${res.status}).`);

  await fs.mkdir(GENERATED_DIR, { recursive: true });
  const id = crypto.randomUUID();
  const videoFile = path.join(GENERATED_DIR, `clip-${id}.mp4`);
  await fs.writeFile(videoFile, Buffer.from(await res.arrayBuffer()));

  const stillFile = path.join(GENERATED_DIR, `clip-${id}.jpg`);
  const hasStill = await extractLastFrame(videoFile, stillFile);

  return {
    videoUrl: `/generated/clip-${id}.mp4`,
    durationInSeconds: await probeSeconds(videoFile),
    stillUrl: hasStill ? `/generated/clip-${id}.jpg` : null,
  };
}
