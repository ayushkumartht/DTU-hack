"use client";

import type { FormEvent } from "react";
import { Textarea } from "@/components/arc/textarea/textarea";
import { Button } from "@/components/arc/button/button";
import { PRESET_PROMPTS } from "../constants";
import styles from "./StoryForm.module.css";

interface StoryFormProps {
  problem: string;
  setProblem: (value: string) => void;
  isLoading: boolean;
  onSubmit: (e?: FormEvent) => void;
  selectPreset: (text: string) => void;
}

export function StoryForm({ problem, setProblem, isLoading, onSubmit, selectPreset }: StoryFormProps) {
  return (
    <>
      <div className={styles.presetContainer}>
        <span className={styles.presetLabel}>Sample Situations / उदाहरण:</span>
        <div className={styles.presetChips}>
          {PRESET_PROMPTS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              className={styles.chip}
              onClick={() => selectPreset(preset)}
            >
              {preset.length > 45 ? `${preset.substring(0, 45)}...` : preset}
            </button>
          ))}
        </div>
      </div>

      <form className={styles.form} onSubmit={onSubmit}>
        <Textarea
          label="Your situation"
          className={styles.textarea}
          placeholder="अपनी समस्या या परिस्थिति यहाँ लिखें (हिंदी या English)... e.g., 'मैं बहुत चिंता और असफलता के डर से परेशान हूँ' or 'I feel lost and lack confidence in pursuing my goals...'"
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          disabled={isLoading}
          rows={5}
        />

        <div className={styles.formFooter}>
          <Button type="submit" disabled={!problem.trim()} loading={isLoading}>
            {isLoading ? "Generating..." : "Generate Story"}
          </Button>
        </div>
      </form>
    </>
  );
}
