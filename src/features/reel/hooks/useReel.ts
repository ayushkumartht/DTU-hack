"use client";

import { useCallback, useState } from "react";
import type { Teaching, LangCode } from "@/lib/teachings";
import { BEAT_ORDER, type AuthenticityReport, type BeatId, type ReelScript, type ReelVisuals, type TeacherNote } from "../types";

export type Phase = "idle" | "scripting" | "script" | "images" | "narration" | "clip" | "render" | "done" | "error";

interface ScriptResponse {
  script: ReelScript;
  visuals: ReelVisuals;
  audit: AuthenticityReport;
  teacherNote?: TeacherNote;
  /** Style problems that remained after the automatic retries (empty = clean). */
  qualityIssues?: string[];
  qrDataUri: string;
  teaching: Teaching;
  error?: string;
}

/** The three scenes that get a motion clip. Quote and takeaway sit on a calm blurred frame. */
const STORY_BEATS: BeatId[] = ["hook", "situation", "turn"];

interface ClipOut {
  videoUrl: string | null;
  stillUrl: string | null;
  durationInSeconds: number | null;
  reason?: string;
}

const post = async <T,>(url: string, body: unknown): Promise<T> => {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
};

export function useReel() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ScriptResponse | null>(null);
  const [hooks, setHooks] = useState<string[]>([]);
  const [result, setResult] = useState<{
    videoUrl: string; provenanceUrl: string; voiceover: boolean; clipsMade: number; clipReason: string | null;
  } | null>(null);

  const fail = (err: unknown) => {
    setError(err instanceof Error ? err.message : "Something went wrong.");
    setPhase("error");
  };

  /** Pick a teaching (or let the problem text choose one) and write the 5-beat script. */
  const generateScript = useCallback(async (input: { teachingId?: string; problem?: string; language: LangCode }) => {
    setPhase("scripting");
    setError(null);
    setResult(null);
    setHooks([]);
    try {
      setData(await post<ScriptResponse>("/api/reel/script", input));
      setPhase("script");
    } catch (err) {
      fail(err);
    }
  }, []);

  /** Edit one narrative beat. The quote beat is not editable: it is rebuilt from the record. */
  const editBeat = useCallback((id: Exclude<BeatId, "quote">, text: string) => {
    setData((d) => (d ? { ...d, script: { ...d.script, [id]: text } } : d));
  }, []);

  const loadHooks = useCallback(async () => {
    if (!data) return;
    try {
      const r = await post<{ hooks: string[] }>("/api/reel/hooks", { teachingId: data.script.teachingId, language: data.script.language });
      setHooks(r.hooks);
    } catch (err) {
      fail(err);
    }
  }, [data]);

  /** images (one at a time) -> narration -> Wan clip -> render. */
  const makeVideo = useCallback(async () => {
    if (!data) return;
    const { script, visuals } = data;
    setError(null);
    setResult(null);
    try {
      // Narration first: it is quick, and it fixes how long each scene lasts.
      setPhase("narration");
      setProgress("Writing voiceover and timing each beat…");
      const narr = await post<{ audioUrl: string | null; segments: { text: string; durationInSeconds: number }[]; voiceover: boolean }>(
        "/api/reel/narration", { script }
      );

      // One motion clip per story scene, one at a time (the free GPU is shared). Never fatal:
      // once the daily quota is gone the remaining scenes simply fall back to a still frame.
      setPhase("clip");
      const clips: Record<string, ClipOut | null> = {};
      let clipsDown = false;
      let clipReason: string | null = null;
      for (let i = 0; i < STORY_BEATS.length; i++) {
        const id = STORY_BEATS[i];
        if (clipsDown) {
          clips[id] = null;
          continue;
        }
        setProgress(`Making motion scene ${i + 1} of ${STORY_BEATS.length}… (about a minute each)`);
        const prompt = id === "turn"
          ? `${visuals.turn} ${visuals.motion}`
          : `${visuals[id]} Slow smooth camera movement, subtle natural motion, no cuts.`;
        const c = await post<ClipOut>("/api/reel/clip", { prompt }).catch(() => null);
        clips[id] = c?.videoUrl ? c : null;
        if (!clips[id]) {
          clipReason = c?.reason ?? "clip request failed";
          if (/quota|used up/i.test(clipReason)) clipsDown = true;
        }
      }

      setPhase("render");
      setProgress("Rendering your reel…");
      // A scene's still is the last frame of its own clip; the quote/takeaway scenes sit on a calm blurred frame.
      // With no clip at all there is no still either: the renderer then uses its own editorial background.
      const anyStill = STORY_BEATS.map((id) => clips[id]?.stillUrl).find(Boolean) ?? null;
      const beats = BEAT_ORDER.map((id, i) => {
        const clip = clips[id] ?? null;
        const isStory = STORY_BEATS.includes(id);
        return {
          id,
          text: narr.segments[i]?.text ?? "",
          durationInSeconds: narr.segments[i]?.durationInSeconds ?? 0,
          imageUrl: isStory ? clip?.stillUrl ?? anyStill : clips.turn?.stillUrl ?? anyStill,
          videoUrl: isStory ? clip?.videoUrl ?? null : null,
          videoSeconds: isStory ? clip?.durationInSeconds ?? null : null,
        };
      });
      const out = await post<{ videoUrl: string; provenanceUrl: string }>("/api/reel/render", {
        teachingId: script.teachingId, language: script.language, beats, audioUrl: narr.audioUrl,
      });
      const clipsMade = STORY_BEATS.filter((id) => clips[id]).length;
      setResult({ ...out, voiceover: narr.voiceover, clipsMade, clipReason: clipsMade < STORY_BEATS.length ? clipReason : null });
      setPhase("done");
    } catch (err) {
      fail(err);
    }
  }, [data]);

  return { phase, progress, error, data, hooks, result, generateScript, editBeat, loadHooks, makeVideo };
}
