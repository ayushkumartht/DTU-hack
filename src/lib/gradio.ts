import { Client } from "@gradio/client";

const GHIBLI_SPACE = "alvarobartt/FLUX.1-Studio-Ghibli-LoRA";

// Portrait "mobile phone" frame (9:16), kept within the Space's 256-1024 slider bounds.
export const SCENE_IMAGE_WIDTH = 576;
export const SCENE_IMAGE_HEIGHT = 1024;

let clientPromise: Promise<Client> | null = null;

function connect(hfToken: string): Promise<Client> {
  if (!clientPromise) {
    clientPromise = Client.connect(GHIBLI_SPACE, { token: hfToken as `hf_${string}` }).catch((err) => {
      clientPromise = null;
      throw err;
    });
  }
  return clientPromise;
}

export interface GhibliImageResult {
  imageUrl: string | null;
  seed: number | null;
}

export async function generateGhibliImage(
  prompt: string,
  hfToken: string
): Promise<GhibliImageResult> {
  const client = await connect(hfToken);
  const finalPrompt = /^ghibli style/i.test(prompt.trim()) ? prompt : `Ghibli style, ${prompt}`;

  const result = await client.predict("/inference", {
    prompt: finalPrompt,
    seed: 0,
    randomize_seed: true,
    width: SCENE_IMAGE_WIDTH,
    height: SCENE_IMAGE_HEIGHT,
    guidance_scale: 3.5,
    num_inference_steps: 28,
  });

  const data = result.data as [{ url?: string } | null, number];
  return {
    imageUrl: data?.[0]?.url ?? null,
    seed: typeof data?.[1] === "number" ? data[1] : null,
  };
}
