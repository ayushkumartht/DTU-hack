import { Client } from "@gradio/client";

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
