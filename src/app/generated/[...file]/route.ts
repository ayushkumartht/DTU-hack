import { NextRequest } from "next/server";
import path from "path";
import fs from "fs/promises";

export const runtime = "nodejs";

// `next start` only serves files that existed in public/ at boot, so media generated at
// runtime (narration mp3, rendered mp4, provenance json) is served from here instead.
const ROOT = path.join(process.cwd(), "public", "generated");
const TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".json": "application/json", ".webp": "image/webp", ".png": "image/png",
};

export async function GET(req: NextRequest, ctx: { params: Promise<{ file: string[] }> }) {
  const { file } = await ctx.params;
  const target = path.normalize(path.join(ROOT, ...file));
  const type = TYPES[path.extname(target).toLowerCase()];
  if (!type || !target.startsWith(ROOT + path.sep)) return new Response("Not found", { status: 404 });

  let data: Buffer;
  try {
    data = await fs.readFile(target);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const headers: Record<string, string> = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "no-cache" };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = Math.min(range[2] ? Number(range[2]) : data.length - 1, data.length - 1);
    if (start > end || start >= data.length) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${data.length}` } });
    return new Response(new Uint8Array(data.subarray(start, end + 1)), {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${data.length}`, "Content-Length": String(end - start + 1) },
    });
  }
  return new Response(new Uint8Array(data), { headers: { ...headers, "Content-Length": String(data.length) } });
}
