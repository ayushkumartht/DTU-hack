"use client";

import type { CSSProperties } from "react";
import { Card } from "@/components/arc/card/card";
import { Badge } from "@/components/arc/badge/badge";
import { sceneColor } from "../lib/sceneColors";
import type { Scene } from "../types";
import styles from "./SceneCard.module.css";

interface SceneCardProps {
  scene: Scene;
  index: number;
}

const STATUS_LABEL: Record<Scene["status"], string> = {
  pending: "Waiting",
  generating: "Generating",
  done: "Ready",
  error: "Failed",
};

export function SceneCard({ scene, index }: SceneCardProps) {
  const color = sceneColor(index);
  const wrapperStyle = { "--scene-dot": color } as CSSProperties;

  const frame = (
    <div className={styles.frame}>
      {scene.status === "done" && scene.imageUrl ? (
        <>
          <img src={scene.imageUrl} alt={scene.caption} className={styles.image} />
          {scene.mock && (
            <span className={styles.mockBadge}>
              <Badge tone="warning" size="sm">Dev placeholder</Badge>
            </span>
          )}
        </>
      ) : scene.status === "error" ? (
        <div className={styles.placeholder}>Could not render this scene</div>
      ) : (
        <div className={styles.shimmerBlock} aria-hidden="true" />
      )}
    </div>
  );

  return (
    <div className={styles.wrapper} style={wrapperStyle}>
      <div className={styles.header}>
        <span className={styles.dot} />
        <span className={styles.sceneLabel}>Scene {index + 1}</span>
      </div>
      <Card title={scene.caption} media={frame} status={STATUS_LABEL[scene.status]} />
    </div>
  );
}
