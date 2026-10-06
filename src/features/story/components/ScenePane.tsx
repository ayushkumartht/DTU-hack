"use client";

import { Progress } from "@/components/arc/progress/progress";
import { TextShimmer } from "@/components/arc/text-shimmer/text-shimmer";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { Alert } from "@/components/arc/alert/alert";
import { SceneCard } from "./SceneCard";
import type { Scene } from "../types";
import styles from "./ScenePane.module.css";

interface ScenePaneProps {
  scenes: Scene[];
  planLoading: boolean;
  planError: string | null;
}

export function ScenePane({ scenes, planLoading, planError }: ScenePaneProps) {
  const doneCount = scenes.filter((s) => s.status === "done" || s.status === "error").length;
  const activeIndex = scenes.findIndex((s) => s.status === "generating");
  const isGenerating = activeIndex !== -1;

  return (
    <div className={styles.pane}>
      <div className={styles.header}>
        <span className={styles.title}>Scene visuals</span>

        {scenes.length > 0 && (
          <>
            <Progress
              value={doneCount}
              max={scenes.length}
              showValue
              label={
                isGenerating
                  ? `Scene ${activeIndex + 1} of ${scenes.length}`
                  : doneCount === scenes.length
                  ? "All scenes rendered"
                  : "Queued"
              }
            />
            {isGenerating && (
              <TextShimmer>{`Painting scene ${activeIndex + 1} in Ghibli style...`}</TextShimmer>
            )}
          </>
        )}
      </div>

      {planLoading && (
        <div className={styles.planningSkeleton}>
          <Skeleton label="Planning scenes" lines={5} />
        </div>
      )}

      {planError && <Alert tone="danger" title="Couldn't plan scene visuals">{planError}</Alert>}

      <div className={styles.list}>
        {scenes.map((scene, index) => (
          <SceneCard key={index} scene={scene} index={index} />
        ))}
      </div>
    </div>
  );
}
