"use client";

import { useState, useRef, useCallback, FormEvent } from "react";
import type { Scene, ScenePlanResponse } from "../types";

export function useStoryExperience() {
  const [problem, setProblem] = useState("");
  const [story, setStory] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [segments, setSegments] = useState<string[]>([]);
  const [reference, setReference] = useState<string | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const outputRef = useRef<HTMLDivElement>(null);

  const updateScene = useCallback((index: number, patch: Partial<Scene>) => {
    setScenes((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }, []);

  // Generates scene images strictly one at a time: each await must settle before
  // the next call starts, so the right-hand pane fills in order, not all at once.
  const generateScenesSequentially = useCallback(async (planned: Scene[]) => {
    for (let i = 0; i < planned.length; i++) {
      updateScene(i, { status: "generating" });
      try {
        const res = await fetch("/api/story/scenes/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imagePrompt: planned[i].imagePrompt }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || `Image generation failed (${res.status})`);
        }
        updateScene(i, { status: "done", imageUrl: data.imageUrl ?? null, mock: Boolean(data.mock) });
      } catch (err: any) {
        updateScene(i, {
          status: "error",
          imageUrl: null,
          error: err.message || "Image generation failed for this scene.",
        });
      }
    }
  }, [updateScene]);

  const planAndGenerateScenes = useCallback(async (storyText: string, problemText: string) => {
    setPlanLoading(true);
    setPlanError(null);
    setScenes([]);
    setSegments([]);
    setReference(null);

    try {
      const res = await fetch("/api/story/scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ story: storyText, problem: problemText }),
      });
      const data: ScenePlanResponse & { error?: string } = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        throw new Error(data.error || `Failed to plan scenes (${res.status})`);
      }

      setSegments(data.segments || []);
      setReference(data.reference ?? null);

      const planned: Scene[] = (data.scenes || []).map((s) => ({
        ...s,
        status: "pending",
        imageUrl: null,
      }));
      setScenes(planned);
      setPlanLoading(false);

      await generateScenesSequentially(planned);
    } catch (err: any) {
      console.error("Scene planning error:", err);
      setPlanError(err.message || "An error occurred while planning scene visuals.");
      setPlanLoading(false);
    }
  }, [generateScenesSequentially]);

  const handleSubmit = useCallback(async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!problem.trim() || isLoading) return;

    setIsLoading(true);
    setStory("");
    setError(null);
    setScenes([]);
    setSegments([]);
    setReference(null);
    setPlanError(null);

    let fullStory = "";

    try {
      const response = await fetch("/api/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to generate story (${response.status})`);
      }
      if (!response.body) {
        throw new Error("No response stream received.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullStory += chunk;
        setStory((prev) => prev + chunk);

        if (outputRef.current) {
          outputRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
        }
      }

      if (fullStory.trim()) {
        planAndGenerateScenes(fullStory, problem);
      }
    } catch (err: any) {
      console.error("Story generation error:", err);
      setError(err.message || "An error occurred while generating the story. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [problem, isLoading, planAndGenerateScenes]);

  const selectPreset = useCallback((text: string) => setProblem(text), []);

  return {
    problem,
    setProblem,
    story,
    isLoading,
    error,
    outputRef,
    segments,
    reference,
    scenes,
    planLoading,
    planError,
    handleSubmit,
    selectPreset,
  };
}
