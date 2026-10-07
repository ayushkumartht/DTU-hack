import { NextRequest, NextResponse } from "next/server";
import path from "path";
import crypto from "crypto";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { getBinariesDirectory } from "@/lib/ffmpegPath";
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
  videoUrl: string | null;
  caption: string;
  subtitle: string;
  durationInSeconds: number;
}

export async function POST(req: NextRequest) {
  try {
    const { scenes, audioUrl } = (await req.json()) as {
      scenes: VideoRequestScene[];
      audioUrl: string;
    };

    if (!Array.isArray(scenes) || scenes.length === 0) {
      return NextResponse.json({ error: "At least one scene is required." }, { status: 400 });
    }
    if (!audioUrl || typeof audioUrl !== "string") {
      return NextResponse.json({ error: "audioUrl is required." }, { status: 400 });
    }
    const usableScenes = scenes.filter(
      (s): s is VideoRequestScene & { imageUrl: string } => Boolean(s.imageUrl) && s.durationInSeconds > 0
    );
    if (usableScenes.length === 0) {
      return NextResponse.json({ error: "No scenes have a generated image and a timed narration segment yet." }, { status: 400 });
    }

    const origin = req.nextUrl.origin;
    const videoScenes: VideoScene[] = usableScenes.map((s) => ({
      imageUrl: toAbsoluteUrl(origin, s.imageUrl),
      videoUrl: s.videoUrl ? toAbsoluteUrl(origin, s.videoUrl) : null,
      caption: s.caption,
      subtitle: s.subtitle,
      durationInSeconds: s.durationInSeconds,
    }));

    const inputProps = {
      scenes: videoScenes,
      audioUrl: toAbsoluteUrl(origin, audioUrl),
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
      binariesDirectory: getBinariesDirectory(),
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
