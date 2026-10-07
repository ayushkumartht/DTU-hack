import { Client, handle_file } from "@gradio/client";
import { execFile } from "child_process";
import { promisify } from "util";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { getFfprobePath } from "./ffmpegPath";

const execFileAsync = promisify(execFile);

/**
 * Wan 2.1 image-to-video via the official Space `Wan-AI/Wan2.1`.
 *
 * Its API is asynchronous: `/i2v_generation_async` only SUBMITS the job (it returns timing
 * numbers, not a video), then `/status_refresh` is polled until the finished video appears.
 * Gradio ties that job to the client session, so every clip uses its own fresh client.
 *
 *   WAN_SPACE       Space id (default Wan-AI/Wan2.1)
 *   MOCK_WAN_VIDEO  anything but "false" skips Wan and uses the still image + Ken Burns pan
 */
const DEFAULT_SPACE = "Wan-AI/Wan2.1";
const POLL_MS = 6000;
const DEADLINE_MS = 270_000; // route maxDuration is 300s
const GENERATED_DIR = path.join(process.cwd(), "public", "generated");

export interface WanClipResult {
  /** Root-relative URL under /generated (stable — Space URLs expire). null = no clip. */
  videoUrl: string | null;
  durationInSeconds: number | null;
  /** True when no real clip was made (mock mode, quota, timeout, or any failure). */
  fallback: boolean;
  reason?: string;
}

const fallback = (reason: string): WanClipResult => ({ videoUrl: null, durationInSeconds: null, fallback: true, reason });

function extractVideoUrl(data: unknown): string | null {
  const first = Array.isArray(data) ? data[0] : data;
  if (typeof first === "string") return first;
  if (first && typeof first === "object") {
    const o = first as { url?: string; video?: { url?: string } };
    return o.video?.url ?? o.url ?? null;
  }
  return null;
}

/** Local /public path, or a URL the Space can fetch itself. */
function imageInput(imageUrl: string) {
  if (/^https?:\/\//i.test(imageUrl)) return handle_file(imageUrl);
  return handle_file(path.join(process.cwd(), "public", imageUrl.replace(/^\/+/, "")));
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Never throws: any failure degrades to the still image + Ken Burns, so the reel always finishes. */
export async function generateWanClip(prompt: string, imageUrl: string | null, hfToken?: string): Promise<WanClipResult> {
  if (process.env.MOCK_WAN_VIDEO !== "false") return fallback("Wan is switched off (MOCK_WAN_VIDEO is not \"false\")");
  if (!imageUrl) return fallback("no source image for image-to-video");

  const started = Date.now();
  try {
    const client = await Client.connect(process.env.WAN_SPACE || DEFAULT_SPACE, hfToken ? { token: hfToken as `hf_${string}` } : {});

    await client.predict("/i2v_generation_async", {
      prompt,
      image: imageInput(imageUrl),
      watermark_wan: false,
      seed: -1,
    });

    while (Date.now() - started < DEADLINE_MS) {
      await sleep(POLL_MS);
      const status = await client.predict("/status_refresh", {});
      const remote = extractVideoUrl(status.data);
      if (!remote) continue;

      const res = await fetch(remote);
      if (!res.ok) return fallback(`could not download the Wan clip (${res.status})`);
      await fs.mkdir(GENERATED_DIR, { recursive: true });
      const name = `clip-${crypto.randomUUID()}.mp4`;
      const file = path.join(GENERATED_DIR, name);
      await fs.writeFile(file, Buffer.from(await res.arrayBuffer()));
      return { videoUrl: `/generated/${name}`, durationInSeconds: await probeSeconds(file), fallback: false };
    }
    return fallback("Wan took longer than 4.5 minutes (free Space queue)");
  } catch (err: any) {
    const msg: string = err?.message || "Wan generation failed";
    return fallback(/quota|exceeded|gpu/i.test(msg) ? `Wan quota exhausted: ${msg}` : msg);
  }
}
