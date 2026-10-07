import { Client } from "@gradio/client";
import { saveRemoteClip } from "./clipFiles";

// Official Lightricks Space for LTX-Video, their fast distilled model built
// for short image-to-video clips. Runs on ZeroGPU (shared, quota-limited)
// and caps a single clip at 8.5s regardless of request - see
// src/app/api/story/scenes/video/route.ts for how a scene's remaining time
// is filled once the clip ends.
const VIDEO_SPACE = "Lightricks/ltx-video-distilled";

export const SCENE_CLIP_WIDTH = 576;
export const SCENE_CLIP_HEIGHT = 1024;
export const SCENE_CLIP_SECONDS = 4.5;

let clientPromise: Promise<Client> | null = null;

function connect(hfToken?: string): Promise<Client> {
  if (!clientPromise) {
    clientPromise = Client.connect(VIDEO_SPACE, hfToken ? { token: hfToken as `hf_${string}` } : {}).catch((err) => {
      clientPromise = null;
      throw err;
    });
  }
  return clientPromise;
}

const NEGATIVE_PROMPT =
  "worst quality, inconsistent motion, blurry, jittery, distorted, extra limbs, text, watermark, logo, subtitles";

export interface ReelClipResult {
  videoUrl: string | null;
  durationInSeconds: number | null;
  stillUrl: string | null;
  /** True when no clip was made (switched off, quota, queue, or any failure). */
  fallback: boolean;
  reason?: string;
}

const fallbackClip = (reason: string): ReelClipResult => ({ videoUrl: null, durationInSeconds: null, stillUrl: null, fallback: true, reason });

function friendlyReason(message: string): string {
  if (/zerogpu|quota|exceeded|gpu/i.test(message)) return `LTX GPU quota used up for today: ${message}`;
  return message || "LTX generation failed";
}

/**
 * Text-to-video: the detailed English shot prompt alone makes the clip, so no still image is needed.
 * Never throws; any failure degrades to the still-image fallback so the reel always finishes.
 */
export async function generateReelClip(prompt: string, hfToken?: string): Promise<ReelClipResult> {
  if (process.env.REEL_CLIPS === "off") return fallbackClip("motion clips are switched off (REEL_CLIPS=off)");
  try {
    const client = await connect(hfToken);
    const result = await client.predict("/text_to_video", {
      prompt,
      negative_prompt: NEGATIVE_PROMPT,
      height_ui: SCENE_CLIP_HEIGHT,
      width_ui: SCENE_CLIP_WIDTH,
      mode: "text-to-video",
      duration_ui: SCENE_CLIP_SECONDS,
      seed_ui: 42,
      randomize_seed: true,
      ui_guidance_scale: 1,
      // The second texture pass costs extra GPU time from a small daily quota; skipping it buys more clips.
      improve_texture_flag: false,
    });

    const first = (result.data as unknown[])?.[0] as { url?: string; video?: { url?: string } } | string | null;
    const remote = typeof first === "string" ? first : first?.video?.url ?? first?.url ?? null;
    if (!remote) return fallbackClip("LTX returned no video");

    const saved = await saveRemoteClip(remote, hfToken);
    return { ...saved, fallback: false };
  } catch (err: any) {
    return fallbackClip(friendlyReason(err?.message ?? ""));
  }
}

export interface SceneClipResult {
  videoUrl: string | null;
  seed: number | null;
}

export async function generateSceneClip(
  imageUrl: string,
  motionPrompt: string,
  hfToken?: string
): Promise<SceneClipResult> {
  const client = await connect(hfToken);

  const result = await client.predict("/image_to_video", {
    prompt: motionPrompt,
    negative_prompt: "worst quality, inconsistent motion, blurry, jittery, distorted, extra limbs",
    input_image_filepath: { url: imageUrl },
    height_ui: SCENE_CLIP_HEIGHT,
    width_ui: SCENE_CLIP_WIDTH,
    mode: "image-to-video",
    duration_ui: SCENE_CLIP_SECONDS,
    seed_ui: 42,
    randomize_seed: true,
    ui_guidance_scale: 1,
    improve_texture_flag: true,
  });

  const data = result.data as [{ url?: string } | null, number];
  return {
    videoUrl: data?.[0]?.url ?? null,
    seed: typeof data?.[1] === "number" ? data[1] : null,
  };
}
