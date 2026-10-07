import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { getBinariesDirectory } from "@/lib/ffmpegPath";
import { getTeaching, type LangCode } from "@/lib/teachings";
import { assertVerbatim, buildQuoteBlock, buildProvenance, detectFabricatedQuotes, DISCLOSURE, DISCLOSURE_HI } from "@/lib/authenticity";
import { LANGUAGES } from "@/lib/i18n/languages";
import { generateBelurQr } from "@/lib/qrcode";
import { BEAT_ORDER, type BeatId } from "@/features/reel/types";
import type { ReelBeatProp, ReelVideoProps } from "@/remotion/ReelVideo";

export const runtime = "nodejs";
export const maxDuration = 300;

const GENERATED_DIR = path.join(process.cwd(), "public", "generated");
const STORY_BEATS = new Set<BeatId>(["hook", "situation", "turn"]);

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

const abs = (origin: string, url: string) => (/^https?:\/\//i.test(url) ? url : `${origin}${url.startsWith("/") ? "" : "/"}${url}`);

interface RenderBeat { id: BeatId; text: string; durationInSeconds: number; imageUrl: string | null; videoUrl: string | null; videoSeconds?: number | null }

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { teachingId: string; language: LangCode; beats: RenderBeat[]; audioUrl: string | null };
    const teaching = getTeaching(body.teachingId);
    if (!teaching) return NextResponse.json({ error: "Unknown teaching." }, { status: 400 });
    if (!Array.isArray(body.beats) || BEAT_ORDER.some((id) => !body.beats.find((b) => b.id === id))) {
      return NextResponse.json({ error: "All five beats are required." }, { status: 400 });
    }

    // The quote and QR are rebuilt from the verified record â€” whatever the client sent is ignored.
    const quote = buildQuoteBlock(teaching, body.language in teaching.variants ? body.language : teaching.primaryLang);
    assertVerbatim(quote, teaching);

    const byId = new Map(body.beats.map((b) => [b.id, b]));
    const ordered = BEAT_ORDER.map((id) => byId.get(id) as RenderBeat);

    // Hand-edited narrative beats are re-audited: no invented quotations, no attribution claims.
    const aiText = ordered.filter((b) => b.id !== "quote").map((b) => b.text).join("\n");
    const { fabricated, attributions } = detectFabricatedQuotes(aiText, teaching);
    if (fabricated.length || attributions.length) {
      return NextResponse.json({ error: "Authenticity check failed: the story contains an invented quotation or an attribution to Swami Vivekananda.", fabricated, attributions }, { status: 422 });
    }
    if (ordered.some((b) => !(b.durationInSeconds > 0))) {
      return NextResponse.json({ error: "Every beat needs a duration." }, { status: 400 });
    }

    const storyLang: LangCode = LANGUAGES.some((l) => l.code === body.language) ? body.language : "en";
    const origin = req.nextUrl.origin;
    const beats: ReelBeatProp[] = ordered.map((b) => ({
      id: b.id,
      text: b.id === "quote" ? quote.verbatimText : b.text,
      durationInSeconds: b.durationInSeconds,
      imageUrl: b.imageUrl ? abs(origin, b.imageUrl) : null, // null = the quota-free editorial background
      // Story beats may carry a motion clip; the quote/takeaway beats keep a calm still behind the text.
      videoUrl: STORY_BEATS.has(b.id) && b.videoUrl ? abs(origin, b.videoUrl) : null,
      videoSeconds: STORY_BEATS.has(b.id) ? b.videoSeconds ?? null : null,
    }));

    const inputProps: ReelVideoProps = {
      beats,
      audioUrl: body.audioUrl ? abs(origin, body.audioUrl) : null,
      // Story, captions and labels follow the chosen language; the quote keeps its own (verified) language.
      language: storyLang,
      quoteLang: quote.lang,
      qrDataUri: await generateBelurQr(teaching.sourceUrl),
      quote: { text: quote.verbatimText, author: quote.author, sourceWork: quote.sourceWork, official: quote.officialTranslation },
      disclosure: storyLang === "hi" ? DISCLOSURE_HI : DISCLOSURE,
    };

    const serveUrl = await getBundle();
    const composition = await selectComposition({ serveUrl, id: "ReelVideo", inputProps });
    await fs.mkdir(GENERATED_DIR, { recursive: true });
    const id = crypto.randomUUID();
    await renderMedia({ composition, serveUrl, codec: "h264", outputLocation: path.join(GENERATED_DIR, `reel-${id}.mp4`), inputProps, binariesDirectory: getBinariesDirectory() });

    // Provenance sidecar travels with the MP4.
    const provenance = buildProvenance({ teachingId: teaching.id, language: quote.lang, hook: "", situation: "", turn: "", takeaway: "", quote }, teaching, "openai/gpt-oss-120b");
    await fs.writeFile(path.join(GENERATED_DIR, `reel-${id}.json`), JSON.stringify(provenance, null, 2), "utf-8");

    return NextResponse.json({ videoUrl: `/generated/reel-${id}.mp4`, provenanceUrl: `/generated/reel-${id}.json` });
  } catch (error: any) {
    console.error("Reel render error:", error);
    const integrity = /integrity check/i.test(error?.message ?? "");
    return NextResponse.json({ error: error.message || "Render failed." }, { status: integrity ? 422 : 500 });
  }
}
