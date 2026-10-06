"use client";

import Link from "next/link";
import { ResizablePanels, ResizablePanel } from "@/components/arc/resizable-panels/resizable-panels";
import { ThemeSwitch } from "@/components/arc/theme-switch/theme-switch";
import { Alert } from "@/components/arc/alert/alert";
import { useTheme } from "@/lib/useTheme";
import { useStoryExperience } from "../hooks/useStoryExperience";
import { StoryForm } from "./StoryForm";
import { StoryPane } from "./StoryPane";
import { ScenePane } from "./ScenePane";
import { StoryVideoPanel } from "./StoryVideoPanel";
import styles from "./StoryExperience.module.css";

export function StoryExperience() {
  const { theme, setTheme } = useTheme();
  const {
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
  } = useStoryExperience();

  const showSplit = story.length > 0 || isLoading;
  const hasReadyScene = scenes.some((s) => s.status === "done" && s.imageUrl);

  return (
    <div className={styles.container}>
      <div className={styles.contentWrapper}>
        <div className={styles.topbar}>
          <Link href="/" className={styles.backLink}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            learning of vivekanand
          </Link>
          <ThemeSwitch
            theme={theme}
            onThemeChange={(next) => setTheme(next)}
            iconOnly
            label="Toggle theme"
          />
        </div>

        <header className={styles.header}>
          <h1 className={styles.title}>Story board</h1>
          <p className={styles.subtitle}>
            Describe your current struggle or situation in <strong>Hindi</strong> or <strong>English</strong> and
            watch a personalized story, and its scenes, generate below.
          </p>
        </header>

        <StoryForm
          problem={problem}
          setProblem={setProblem}
          isLoading={isLoading}
          onSubmit={handleSubmit}
          selectPreset={selectPreset}
        />

        {error && (
          <Alert tone="danger" title="Something went wrong">
            {error}
          </Alert>
        )}

        {showSplit && (
          <div className={styles.splitSection}>
            <ResizablePanels label="Story and scene visuals">
              <ResizablePanel id="story" label="Story" defaultSize={55} minSize={280}>
                <StoryPane story={story} segments={segments} reference={reference} outputRef={outputRef} />
              </ResizablePanel>
              <ResizablePanel id="scenes" label="Scene visuals" defaultSize={45} minSize={260}>
                <ScenePane scenes={scenes} planLoading={planLoading} planError={planError} />
              </ResizablePanel>
            </ResizablePanels>
          </div>
        )}

        {hasReadyScene && <StoryVideoPanel story={story} problem={problem} scenes={scenes} />}
      </div>
    </div>
  );
}
