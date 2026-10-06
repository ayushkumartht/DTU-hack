import { NextRequest, NextResponse } from "next/server";
import path from "path";
import crypto from "crypto";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { VideoScene } from "@/remotion/StoryVideo";

export const runtime = "nodejs";
export const maxDuration = 300;

const GENERATED_DIR = path.join(process.cwd(), "public", "generated");
const COMPOSITION_ID = "StoryVideo";

// Bundling is slow (a few seconds) and the result is immutable for the life
// of this process, so every render after the first reuses it.
let bundlePromise: Promise<string> | null = null;
function getBundle(): Promise<string> {
  if (!bundlePromise) {
    bundlePromise = bundle({ entryPoint: path.join(process.cwd(), "src", "remotion", "index.ts") }).catch((err) => {
      bundlePromise = null;
      throw err;
    });
  }
  return bundlePromise;
}

function toAbsoluteUrl(origin: string, url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

interface VideoRequestScene {
  imageUrl: string | null;
  caption: string;
}

export async function POST(req: NextRequest) {
  try {
    const { scenes, audioUrl, durationInSeconds } = (await req.json()) as {
      scenes: VideoRequestScene[];
      audioUrl: string;
      durationInSeconds: number;
    };

    if (!Array.isArray(scenes) || scenes.length === 0) {
      return NextResponse.json({ error: "At least one scene is required." }, { status: 400 });
    }
    if (!audioUrl || typeof audioUrl !== "string") {
      return NextResponse.json({ error: "audioUrl is required." }, { status: 400 });
    }
    const usableScenes = scenes.filter((s): s is { imageUrl: string; caption: string } => Boolean(s.imageUrl));
    if (usableScenes.length === 0) {
      return NextResponse.json({ error: "No scenes have a generated image yet." }, { status: 400 });
    }

    const origin = req.nextUrl.origin;
    const videoScenes: VideoScene[] = usableScenes.map((s) => ({
      imageUrl: toAbsoluteUrl(origin, s.imageUrl),
      caption: s.caption,
    }));

    const inputProps = {
      scenes: videoScenes,
      audioUrl: toAbsoluteUrl(origin, audioUrl),
      audioDurationInSeconds: typeof durationInSeconds === "number" && durationInSeconds > 0 ? durationInSeconds : 45,
    };

    const serveUrl = await getBundle();
    const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps });

    const id = crypto.randomUUID();
    const outputLocation = path.join(GENERATED_DIR, `video-${id}.mp4`);

    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation,
      inputProps,
    });

    return NextResponse.json({ videoUrl: `/generated/video-${id}.mp4` });
  } catch (error: any) {
    console.error("Video render error:", error);
    return NextResponse.json(
      { error: error.message || "Video render failed." },
      { status: 500 }
    );
  }
}
