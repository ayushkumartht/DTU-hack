"use client";

import { useState } from "react";
import { Player } from "@remotion/player";
import { Button } from "@/components/arc/button/button";
import { TextShimmer } from "@/components/arc/text-shimmer/text-shimmer";
import { Alert } from "@/components/arc/alert/alert";
import { Progress } from "@/components/arc/progress/progress";
import { StoryVideo } from "@/remotion/StoryVideo";
import { VIDEO_WIDTH, VIDEO_HEIGHT, FPS, sumSceneSeconds } from "@/remotion/Root";
import { useStoryVideo, type NarratorVoice } from "../hooks/useStoryVideo";
import type { Scene } from "../types";
import styles from "./StoryVideoPanel.module.css";

interface StoryVideoPanelProps {
  story: string;
  problem: string;
  scenes: Scene[];
}

const SPEED_OPTIONS: { label: string; value: number }[] = [
  { label: "Slower", value: 0.85 },
  { label: "Normal", value: 1 },
  { label: "Faster", value: 1.15 },
];

export function StoryVideoPanel({ story, problem, scenes }: StoryVideoPanelProps) {
  const { narration, clips, render, createVideo } = useStoryVideo();
  const [voice, setVoice] = useState<NarratorVoice>("female");
  const [speed, setSpeed] = useState(1);

  const readyScenes = scenes.filter((s) => s.status === "done" && s.imageUrl);
  const stillGeneratingScenes = scenes.some((s) => s.status === "pending" || s.status === "generating");
  const busy = narration.status === "writing" || clips.some((c) => c.status === "generating") || render.status === "rendering";
  // Narration is split one-to-one across whatever scenes exist at creation
  // time, so starting before every scene has settled would silently bake a
  // partial scene count into the video instead of waiting for all of them.
  const canCreate = readyScenes.length > 0 && !stillGeneratingScenes && !busy;

  const handleCreate = () => createVideo(story, problem, readyScenes, voice, speed);

  const clipIndex = clips.findIndex((c) => c.status === "generating");
  const clipsDone = clips.filter((c) => c.status === "done" || c.status === "skipped" || c.status === "error").length;

  const playerScenes = render.videoUrl
    ? readyScenes.map((s, i) => ({
        imageUrl: s.imageUrl as string,
        videoUrl: clips[i]?.videoUrl ?? null,
        caption: s.caption,
        subtitle: narration.segments[i]?.text ?? "",
        durationInSeconds: narration.segments[i]?.durationInSeconds ?? 0,
      }))
    : [];

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Story video</div>
          <p className={styles.subtitle}>
            {stillGeneratingScenes
              ? `Waiting for all scenes to finish (${readyScenes.length}/${scenes.length} ready) before starting...`
              : `A ${readyScenes.length || "–"}-scene narrated video (~45-60s): English voiceover, subtitles timed to the
            dialogue, scene motion where available, rendered as a downloadable MP4.`}
          </p>
        </div>
        <Button onClick={handleCreate} disabled={!canCreate} loading={busy}>
          {render.status === "done" ? "Recreate video" : "Create video"}
        </Button>
      </div>

      <div className={styles.controls}>
        <div className={styles.controlGroup}>
          <span className={styles.controlLabel}>Narrator</span>
          <div className={styles.controlButtons}>
            <Button
              size="sm"
              variant={voice === "female" ? "primary" : "secondary"}
              disabled={busy}
              onClick={() => setVoice("female")}
            >
              Female
            </Button>
            <Button
              size="sm"
              variant={voice === "male" ? "primary" : "secondary"}
              disabled={busy}
              onClick={() => setVoice("male")}
            >
              Male
            </Button>
          </div>
        </div>

        <div className={styles.controlGroup}>
          <span className={styles.controlLabel}>Pace</span>
          <div className={styles.controlButtons}>
            {SPEED_OPTIONS.map((opt) => (
              <Button
                key={opt.label}
                size="sm"
                variant={speed === opt.value ? "primary" : "secondary"}
                disabled={busy}
                onClick={() => setSpeed(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {narration.status === "writing" && <TextShimmer>Writing and voicing the narration...</TextShimmer>}
      {narration.status === "error" && (
        <Alert tone="danger" title="Narration failed">{narration.error}</Alert>
      )}

      {narration.audioUrl && (
        <div className={styles.audioRow}>
          <span className={styles.audioLabel}>Voiceover</span>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio className={styles.audio} src={narration.audioUrl} controls />
        </div>
      )}

      {clips.length > 0 && narration.status === "done" && render.status !== "done" && (
        <div className={styles.clipProgress}>
          <Progress
            value={clipsDone}
            max={clips.length}
            showValue
            label={clipIndex !== -1 ? `Scene ${clipIndex + 1} of ${clips.length}` : "Scene motion"}
          />
          {clipIndex !== -1 && <TextShimmer>{`Animating scene ${clipIndex + 1}...`}</TextShimmer>}
        </div>
      )}

      {render.status === "rendering" && <TextShimmer>Rendering the video...</TextShimmer>}
      {render.status === "error" && (
        <Alert tone="danger" title="Video render failed">{render.error}</Alert>
      )}

      {render.status === "done" && render.videoUrl && playerScenes.length > 0 && (
        <div className={styles.playerWrap}>
          <div className={styles.playerFrame}>
            <Player
              component={StoryVideo}
              inputProps={{ scenes: playerScenes, audioUrl: narration.audioUrl as string }}
              durationInFrames={Math.max(1, Math.round(sumSceneSeconds(playerScenes) * FPS))}
              compositionWidth={VIDEO_WIDTH}
              compositionHeight={VIDEO_HEIGHT}
              fps={FPS}
              style={{ width: "100%" }}
              controls
              loop
            />
          </div>
          <div className={styles.actions}>
            <a className={styles.downloadLink} href={render.videoUrl} download>
              Download video
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
