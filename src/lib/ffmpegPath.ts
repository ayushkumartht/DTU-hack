import path from "path";
import fs from "fs";

export function getFfmpegPath(): string {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  
  const possiblePaths = [
    path.join(process.cwd(), "node_modules", "@ffmpeg-installer", "win32-x64", "ffmpeg.exe"),
    path.join(process.cwd(), "node_modules", "@ffmpeg-installer", "ffmpeg", "ffmpeg.exe"),
    "ffmpeg",
  ];

  for (const p of possiblePaths) {
    if (p === "ffmpeg" || fs.existsSync(p)) return p;
  }
  return "ffmpeg";
}

export function getFfprobePath(): string {
  if (process.env.FFPROBE_PATH) return process.env.FFPROBE_PATH;

  const possiblePaths = [
    path.join(process.cwd(), "node_modules", "@ffprobe-installer", "win32-x64", "ffprobe.exe"),
    path.join(process.cwd(), "node_modules", "@ffprobe-installer", "ffprobe", "ffprobe.exe"),
    "ffprobe",
  ];

  for (const p of possiblePaths) {
    if (p === "ffprobe" || fs.existsSync(p)) return p;
  }
  return "ffprobe";
}

/**
 * Remotion's `binariesDirectory` option: a folder containing BOTH ffmpeg and ffprobe.
 * Returns null when they are not found together, so Remotion falls back to its bundled binaries.
 */
export function getBinariesDirectory(): string | null {
  const ffmpeg = getFfmpegPath();
  const ffprobe = getFfprobePath();
  if (!path.isAbsolute(ffmpeg) || !path.isAbsolute(ffprobe)) return null;
  const dir = path.dirname(ffmpeg);
  return dir === path.dirname(ffprobe) ? dir : null;
}
