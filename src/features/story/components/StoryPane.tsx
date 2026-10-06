"use client";

import type { CSSProperties, RefObject } from "react";
import ReactMarkdown from "react-markdown";
import { sceneColor } from "../lib/sceneColors";
import styles from "./StoryPane.module.css";

interface StoryPaneProps {
  story: string;
  segments: string[];
  reference: string | null;
  outputRef: RefObject<HTMLDivElement | null>;
}

export function StoryPane({ story, segments, reference, outputRef }: StoryPaneProps) {
  if (segments.length === 0) {
    return (
      <div className={styles.pane} ref={outputRef}>
        <div className={styles.markdown}>
          <ReactMarkdown>{story}</ReactMarkdown>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pane} ref={outputRef}>
      {/* One continuous passage: each scene's portion is colored only by an
          inline underline, not separated into its own block or divider. */}
      <div className={styles.markdown}>
        {segments.map((segment, index) => {
          const style = { "--segment-accent": sceneColor(index) } as CSSProperties;
          return (
            <div key={index} className={styles.segmentText} style={style}>
              <ReactMarkdown>{segment}</ReactMarkdown>
            </div>
          );
        })}
      </div>

      {reference && (
        <div className={styles.referenceBox}>
          <div className={styles.markdown}>
            <ReactMarkdown>{reference}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
