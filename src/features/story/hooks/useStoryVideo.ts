"use client";

import { useCallback, useState } from "react";
import type { Scene } from "../types";

export type NarrationStatus = "idle" | "writing" | "done" | "error";
export type RenderStatus = "idle" | "rendering" | "done" | "error";

export interface NarrationState {
  status: NarrationStatus;
  audioUrl: string | null;
  script: string | null;
  durationInSeconds: number | null;
  error: string | null;
}

export interface RenderState {
  status: RenderStatus;
  videoUrl: string | null;
  error: string | null;
}

const IDLE_NARRATION: NarrationState = { status: "idle", audioUrl: null, script: null, durationInSeconds: null, error: null };
const IDLE_RENDER: RenderState = { status: "idle", videoUrl: null, error: null };

export function useStoryVideo() {
  const [narration, setNarration] = useState<NarrationState>(IDLE_NARRATION);
  const [render, setRender] = useState<RenderState>(IDLE_RENDER);

  const createVideo = useCallback(async (story: string, problem: string, scenes: Scene[]) => {
    setNarration({ ...IDLE_NARRATION, status: "writing" });
    setRender(IDLE_RENDER);

    let audioUrl: string;
    let durationInSeconds: number;

    try {
      const res = await fetch("/api/story/narration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ story, problem }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Narration failed (${res.status})`);

      audioUrl = data.audioUrl;
      durationInSeconds = data.durationInSeconds;
      setNarration({
        status: "done",
        audioUrl,
        script: data.script ?? null,
        durationInSeconds,
        error: null,
      });
    } catch (err: any) {
      setNarration({ ...IDLE_NARRATION, status: "error", error: err.message || "Narration failed." });
      return;
    }

    setRender({ ...IDLE_RENDER, status: "rendering" });
    try {
      const res = await fetch("/api/story/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: scenes.map((s) => ({ imageUrl: s.imageUrl, caption: s.caption })),
          audioUrl,
          durationInSeconds,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Video render failed (${res.status})`);

      setRender({ status: "done", videoUrl: data.videoUrl, error: null });
    } catch (err: any) {
      setRender({ ...IDLE_RENDER, status: "error", error: err.message || "Video render failed." });
    }
  }, []);

  const reset = useCallback(() => {
    setNarration(IDLE_NARRATION);
    setRender(IDLE_RENDER);
  }, []);

  return { narration, render, createVideo, reset };
}
