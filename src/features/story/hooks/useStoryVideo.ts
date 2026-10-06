"use client";

import { useCallback, useState } from "react";
import type { Scene } from "../types";

export type NarratorVoice = "female" | "male";
export type NarrationStatus = "idle" | "writing" | "done" | "error";
export type ClipStatus = "pending" | "generating" | "done" | "skipped" | "error";
export type RenderStatus = "idle" | "rendering" | "done" | "error";

export interface NarrationSegment {
  text: string;
  durationInSeconds: number;
}

export interface NarrationState {
  status: NarrationStatus;
  audioUrl: string | null;
  segments: NarrationSegment[];
  durationInSeconds: number | null;
  error: string | null;
}

export interface SceneClipState {
  status: ClipStatus;
  videoUrl: string | null;
  mock: boolean;
}

export interface RenderState {
  status: RenderStatus;
  videoUrl: string | null;
  error: string | null;
}

const IDLE_NARRATION: NarrationState = { status: "idle", audioUrl: null, segments: [], durationInSeconds: null, error: null };
const IDLE_RENDER: RenderState = { status: "idle", videoUrl: null, error: null };

export function useStoryVideo() {
  const [narration, setNarration] = useState<NarrationState>(IDLE_NARRATION);
  const [clips, setClips] = useState<SceneClipState[]>([]);
  const [render, setRender] = useState<RenderState>(IDLE_RENDER);

  const updateClip = useCallback((index: number, patch: Partial<SceneClipState>) => {
    setClips((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }, []);

  const createVideo = useCallback(
    async (story: string, problem: string, scenes: Scene[], voice: NarratorVoice, speed: number) => {
      setNarration({ ...IDLE_NARRATION, status: "writing" });
      setClips(scenes.map(() => ({ status: "pending", videoUrl: null, mock: false })));
      setRender(IDLE_RENDER);

      // 1. Write + voice the per-scene narration segments, so each scene's
      // video time can match exactly how long its dialogue takes to speak.
      let segments: NarrationSegment[];
      let audioUrl: string;
      try {
        const res = await fetch("/api/story/narration", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ story, problem, sceneCount: scenes.length, voice, speed }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Narration failed (${res.status})`);

        segments = data.segments || [];
        audioUrl = data.audioUrl;
        setNarration({ status: "done", audioUrl, segments, durationInSeconds: data.durationInSeconds, error: null });
      } catch (err: any) {
        setNarration({ ...IDLE_NARRATION, status: "error", error: err.message || "Narration failed." });
        return;
      }

      // 2. Generate each scene's motion clip one at a time (never in
      // parallel - same sequential pattern as scene image generation).
      const clipUrls: (string | null)[] = [];
      for (let i = 0; i < scenes.length; i++) {
        updateClip(i, { status: "generating" });
        try {
          const res = await fetch("/api/story/scenes/video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageUrl: scenes[i].imageUrl, motionPrompt: scenes[i].imagePrompt }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || `Scene clip failed (${res.status})`);

          clipUrls.push(data.videoUrl ?? null);
          updateClip(i, {
            status: data.videoUrl ? "done" : "skipped",
            videoUrl: data.videoUrl ?? null,
            mock: Boolean(data.mock),
          });
        } catch (err: any) {
          clipUrls.push(null);
          updateClip(i, { status: "error", videoUrl: null });
        }
      }

      // 3. Render the final video: each scene's image + optional clip +
      // subtitle, timed to that scene's own narration segment.
      setRender({ ...IDLE_RENDER, status: "rendering" });
      try {
        const renderScenes = scenes.map((scene, i) => ({
          imageUrl: scene.imageUrl,
          videoUrl: clipUrls[i] ?? null,
          caption: scene.caption,
          subtitle: segments[i]?.text ?? "",
          durationInSeconds: segments[i]?.durationInSeconds ?? 0,
        }));

        const res = await fetch("/api/story/video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenes: renderScenes, audioUrl }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Video render failed (${res.status})`);

        setRender({ status: "done", videoUrl: data.videoUrl, error: null });
      } catch (err: any) {
        setRender({ ...IDLE_RENDER, status: "error", error: err.message || "Video render failed." });
      }
    },
    [updateClip]
  );

  const reset = useCallback(() => {
    setNarration(IDLE_NARRATION);
    setClips([]);
    setRender(IDLE_RENDER);
  }, []);

  return { narration, clips, render, createVideo, reset };
}
