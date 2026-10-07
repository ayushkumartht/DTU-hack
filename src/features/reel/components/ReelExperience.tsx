"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/arc/button/button";
import { Textarea } from "@/components/arc/textarea/textarea";
import { Alert } from "@/components/arc/alert/alert";
import { LANGUAGES } from "@/lib/i18n/languages";
import type { LangCode, Teaching } from "@/lib/teachings";
import { useReel } from "../hooks/useReel";
import type { BeatId } from "../types";
import styles from "./ReelExperience.module.css";

type Topic = { topic: string; count: number };
const EDITABLE: { id: Exclude<BeatId, "quote">; label: string }[] = [
  { id: "hook", label: "Hook (0–3s)" },
  { id: "situation", label: "Situation" },
  { id: "turn", label: "The turn (cinematic clip)" },
  { id: "takeaway", label: "Takeaway — one action to try today" },
];

export function ReelExperience() {
  const reel = useReel();
  const [problem, setProblem] = useState("");
  const [language, setLanguage] = useState<LangCode>("hi");
  const [topic, setTopic] = useState<string | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [teachings, setTeachings] = useState<Teaching[]>([]);
  const [stats, setStats] = useState<{ reelFit: number; quarantined: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ limit: "12" });
    if (topic) params.set("topic", topic);
    fetch(`/api/reel/teachings?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setTeachings(d.teachings ?? []);
        setTopics(d.topics ?? []);
        setStats(d.stats ?? null);
      })
      .catch(() => {});
  }, [topic]);

  const busy = ["scripting", "images", "narration", "clip", "render"].includes(reel.phase);
  const canGenerate = !busy && (Boolean(selected) || problem.trim().length > 3);
  const d = reel.data;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Teaching to Reel</h1>
        <p>Pick a verified teaching of Swami Vivekananda, or describe your situation. The quotation is copied from Belur Math — never written by AI.</p>
        {stats && <p className={styles.muted}>{stats.reelFit} reel-ready verified teachings · {stats.quarantined} excluded because they could not be verified</p>}
      </header>

      <section className={styles.card}>
        <Textarea
          label="Your situation (optional)"
          placeholder="Exam me focus nahi ho raha, bohot distract hota hu…"
          rows={3}
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          disabled={busy}
        />
        <div className={styles.row}>
          <label className={styles.field}>
            Language
            <select value={language} onChange={(e) => setLanguage(e.target.value as LangCode)} disabled={busy}>
              {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.englishName} — {l.nativeName}</option>)}
            </select>
          </label>
          {language !== "en" && <span className={styles.muted}>Story, voice and subtitles in this language. The quotation is read in its verified original language.</span>}
        </div>

        <div className={styles.chips}>
          <button className={!topic ? styles.chipOn : styles.chip} onClick={() => setTopic(null)}>All</button>
          {topics.map((t) => (
            <button key={t.topic} className={topic === t.topic ? styles.chipOn : styles.chip} onClick={() => setTopic(t.topic)}>{t.topic}</button>
          ))}
        </div>

        <ul className={styles.list}>
          {teachings.map((t) => {
            const v = t.variants[t.primaryLang];
            return (
              <li key={t.id} className={selected === t.id ? styles.pickOn : styles.pick} onClick={() => setSelected(selected === t.id ? null : t.id)}>
                <q>{v?.text}</q>
                <small>{v?.sourceWork} · {Object.keys(t.variants).join("/").toUpperCase()}</small>
              </li>
            );
          })}
        </ul>

        <Button
          onClick={() => reel.generateScript({ teachingId: selected ?? undefined, problem: problem.trim() || undefined, language })}
          disabled={!canGenerate}
          loading={reel.phase === "scripting"}
        >
          {selected ? "Make a reel from this teaching" : "Find a teaching & make a reel"}
        </Button>
      </section>

      {reel.error && <Alert tone="danger" title="Something went wrong">{reel.error}</Alert>}

      {d && (
        <>
          <section className={styles.card}>
            <h2>Authenticity</h2>
            <ul className={styles.checks}>
              <li className={d.audit.quoteVerbatim ? styles.ok : styles.bad}>Quotation is verbatim from the verified source</li>
              <li className={d.audit.fabricatedQuotations.length === 0 ? styles.ok : styles.bad}>No invented quotations in the story</li>
              <li className={d.audit.unattributedClaims.length === 0 ? styles.ok : styles.bad}>Nothing but the quotation is attributed to Swami Vivekananda</li>
              <li className={styles.ok}>{d.audit.translationIsOfficial ? "Official Belur Math translation from the same card" : "Shown in the source's original language"}</li>
            </ul>
            {!d.audit.passed && <Alert tone="danger" title="Audit failed">This script contains something that could be mistaken for his words. Regenerate or edit it — rendering is blocked until it passes.</Alert>}
            <p className={styles.muted}>The story is an AI-written dramatisation. Only the quotation is Swami Vivekananda&apos;s own words.</p>
          </section>

          {d.teacherNote && (d.teacherNote.keyIdea || d.teacherNote.discussionQuestion) && (
            <section className={styles.card}>
              <h2>शिक्षक के लिए (Teacher note)</h2>
              {d.teacherNote.keyIdea && <p><strong>मुख्य विचार:</strong> {d.teacherNote.keyIdea}</p>}
              {d.teacherNote.discussionQuestion && <p><strong>चर्चा का प्रश्न:</strong> {d.teacherNote.discussionQuestion}</p>}
              {d.teacherNote.classroomActivity && <p><strong>पाँच मिनट की गतिविधि:</strong> {d.teacherNote.classroomActivity}</p>}
              <p className={styles.muted}>AI-written classroom material. It is not Swami Vivekananda&apos;s own words.</p>
            </section>
          )}
          {d.qualityIssues && d.qualityIssues.length > 0 && (
            <Alert tone="info" title="Script could be better">{d.qualityIssues.join(" · ")}</Alert>
          )}

          <section className={styles.card}>
            <h2>Script</h2>
            {EDITABLE.map(({ id, label }) => (
              <div key={id}>
                <Textarea label={label} rows={id === "hook" || id === "takeaway" ? 2 : 3} value={d.script[id]} onChange={(e) => reel.editBeat(id, e.target.value)} disabled={busy} />
                {id === "hook" && (
                  <div className={styles.hooks}>
                    <button className={styles.link} onClick={reel.loadHooks} disabled={busy}>Suggest other hooks</button>
                    {reel.hooks.map((h, i) => <button key={i} className={styles.chip} onClick={() => reel.editBeat("hook", h)}>{h}</button>)}
                  </div>
                )}
              </div>
            ))}
            <div className={styles.locked}>
              <strong>🔒 The quotation (verified, not editable)</strong>
              <q>{d.script.quote.verbatimText}</q>
              <small>— {d.script.quote.author}, {d.script.quote.sourceWork}</small>
              <a href={d.script.quote.sourceUrl} target="_blank" rel="noreferrer">Read the original on Belur Math ↗</a>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={d.qrDataUri} alt="QR code to the Belur Math source" width={120} height={120} />
            </div>
            <Button onClick={reel.makeVideo} disabled={busy || !d.audit.passed} loading={busy && reel.phase !== "scripting"}>
              {reel.phase === "done" ? "Recreate video" : "Create video"}
            </Button>
            {busy && reel.phase !== "scripting" && <p className={styles.muted}>{reel.progress}</p>}
          </section>
        </>
      )}

      {reel.result && (
        <section className={styles.card}>
          <h2>Your reel</h2>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video className={styles.video} src={reel.result.videoUrl} controls playsInline />
          <p className={styles.muted}>
            {reel.result.voiceover ? "English voiceover" : "Subtitle-only (no voiceover for this language yet)"} ·{" "}
            {reel.result.clipsMade} of 3 story scenes use an AI motion clip (LTX-Video)
          </p>
          {reel.result.clipsMade < 3 && (
            <Alert tone="info" title="Some scenes use a still frame with a slow zoom">
              {reel.result.clipReason ?? "A motion clip could not be made."} The free GPU quota resets daily.
            </Alert>
          )}
          <div className={styles.row}>
            <a className={styles.dl} href={reel.result.videoUrl} download>Download MP4</a>
            <a className={styles.dl} href={reel.result.provenanceUrl} download>Download provenance (.json)</a>
          </div>
        </section>
      )}
    </main>
  );
}
