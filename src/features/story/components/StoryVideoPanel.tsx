"use client";

import { Player } from "@remotion/player";
import { Button } from "@/components/arc/button/button";
import { TextShimmer } from "@/components/arc/text-shimmer/text-shimmer";
import { Alert } from "@/components/arc/alert/alert";
import { StoryVideo } from "@/remotion/StoryVideo";
import { FPS, VIDEO_WIDTH, VIDEO_HEIGHT } from "@/remotion/Root";
import { useStoryVideo } from "../hooks/useStoryVideo";
import type { Scene } from "../types";
import styles from "./StoryVideoPanel.module.css";

interface StoryVideoPanelProps {
  story: string;
  problem: string;
  scenes: Scene[];
}

export function StoryVideoPanel({ story, problem, scenes }: StoryVideoPanelProps) {
  const { narration, render, createVideo } = useStoryVideo();

  const readyScenes = scenes.filter((s) => s.status === "done" && s.imageUrl);
  const canCreate = readyScenes.length > 0 && narration.status !== "writing" && render.status !== "rendering";
  const isWorking = narration.status === "writing" || render.status === "rendering";

  const handleCreate = () => createVideo(story, problem, readyScenes);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Story video</div>
          <p className={styles.subtitle}>
            Turns this story into a {readyScenes.length || "–"}-scene narrated video: an English voiceover, synced
            to the scenes above, rendered as a downloadable MP4.
          </p>
        </div>
        <Button onClick={handleCreate} disabled={!canCreate} loading={isWorking}>
          {render.status === "done" ? "Recreate video" : "Create video"}
        </Button>
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

      {render.status === "rendering" && <TextShimmer>Rendering the video...</TextShimmer>}
      {render.status === "error" && (
        <Alert tone="danger" title="Video render failed">{render.error}</Alert>
      )}

      {render.status === "done" && render.videoUrl && narration.durationInSeconds && (
        <div className={styles.playerWrap}>
          <div className={styles.playerFrame}>
            <Player
              component={StoryVideo}
              inputProps={{
                scenes: readyScenes.map((s) => ({ imageUrl: s.imageUrl as string, caption: s.caption })),
                audioUrl: narration.audioUrl as string,
                audioDurationInSeconds: narration.durationInSeconds,
              }}
              durationInFrames={Math.max(1, Math.round(narration.durationInSeconds * FPS))}
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
