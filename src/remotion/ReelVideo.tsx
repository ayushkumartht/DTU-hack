import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { buildCues } from "../lib/subtitles";
import { fontFamilyFor } from "./fonts";
import type { LangCode } from "../lib/teachings";

export interface ReelBeatProp {
  id: "hook" | "situation" | "turn" | "quote" | "takeaway";
  text: string;
  durationInSeconds: number;
  /** A still for this beat, or null: the beat then falls back to the quota-free editorial background. */
  imageUrl: string | null;
  /** Wan 2.1 clip, only on the "turn" beat. null = still image + Ken Burns. */
  videoUrl: string | null;
  /** Real length of the clip; it plays this long, then the still image + Ken Burns finishes the beat. */
  videoSeconds?: number | null;
}

export type ReelVideoProps = {
  beats: ReelBeatProp[];
  audioUrl: string | null;
  /** Language of the story, captions and labels. */
  language: LangCode;
  /** Language of the verified quotation, which can differ (a Hindi reel quotes the English original). */
  quoteLang: LangCode;
  qrDataUri: string;
  quote: { text: string; author: string; sourceWork: string; official: boolean };
  disclosure: string;
} & Record<string, unknown>;

const LABELS = {
  hi: {
    badge: "स्रोत: बेलूर मठ",
    quote: "स्वामी विवेकानंद के अपने शब्द",
    quoteOfficial: "आधिकारिक अनुवाद",
    takeaway: "आज ही आज़माओ",
    scan: "मूल प्रवचन पढ़ने के लिए स्कैन करो",
    archive: "आधिकारिक संग्रह · media.belurmath.org",
  },
  en: {
    badge: "Source: Belur Math",
    quote: "In his words",
    quoteOfficial: "In his words · official translation",
    takeaway: "Try this today",
    scan: "Scan to read the original discourse",
    archive: "Official archive · media.belurmath.org",
  },
};
const labelsFor = (lang: LangCode) => (lang === "hi" ? LABELS.hi : LABELS.en);

const GOLD = "#E8C39E";
const CREAM = "#FAF9F6";
const FADE = 8;

export function sumBeatSeconds(beats: ReelVideoProps["beats"]): number {
  const total = beats.reduce((s, b) => s + (b.durationInSeconds > 0 ? b.durationInSeconds : 0), 0);
  return total > 0 ? total : 35;
}

function KenBurns({ src, frames, blur = 0, dim = 0 }: { src: string; frames: number; blur?: number; dim?: number }) {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, Math.max(frames, 1)], [1, 1.12], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: "#0F0F0F" }}>
      <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})`, filter: blur ? `blur(${blur}px)` : undefined }} />
      {dim > 0 && <AbsoluteFill style={{ backgroundColor: `rgba(0,0,0,${dim})` }} />}
    </AbsoluteFill>
  );
}

/**
 * Quota-free background, in the calm editorial style of Belur Math's own videos: warm cream, soft
 * drifting light, one thin accent line. Used whenever a scene has neither a clip nor a still.
 */
function EditorialBackground({ dark = false }: { dark?: boolean }) {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 70);
  const a = dark ? "rgba(232,195,158,0.16)" : "rgba(214,176,128,0.38)";
  const b = dark ? "rgba(120,110,160,0.14)" : "rgba(150,140,190,0.22)";
  return (
    <AbsoluteFill style={{ background: dark ? "linear-gradient(165deg,#1d1914,#0f0f0f)" : "#F6F2EA" }}>
      <AbsoluteFill style={{ background: `radial-gradient(60% 45% at ${30 + drift * 12}% ${28 + drift * 6}%, ${a}, transparent 70%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(55% 40% at ${72 - drift * 10}% ${78 - drift * 6}%, ${b}, transparent 70%)` }} />
      {!dark && <div style={{ position: "absolute", left: 70, top: 170, width: 90, height: 5, borderRadius: 3, background: GOLD }} />}
    </AbsoluteFill>
  );
}

/** Large centred 3-word kinetic captions: readable with the sound off. */
function KineticCaption({ text, seconds, lang, onLight = false }: { text: string; seconds: number; lang: LangCode; onLight?: boolean }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const cues = buildCues(text, 0, seconds, 3);
  const cue = cues.find((c) => t >= c.startSeconds && t < c.endSeconds) ?? cues[cues.length - 1];
  if (!cue) return null;
  const local = (t - cue.startSeconds) * fps;
  const pop = interpolate(local, [0, 4], [0.86, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 56px" }}>
      <div style={{
        color: onLight ? "#2E2B3A" : CREAM, fontFamily: fontFamilyFor(lang), fontWeight: 600, fontSize: 76, lineHeight: 1.15, textAlign: "center",
        transform: `scale(${pop})`, textShadow: onLight ? "none" : "0 4px 24px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.9)",
      }}>
        {cue.text}
      </div>
    </AbsoluteFill>
  );
}

function SourceBadge({ lang }: { lang: LangCode }) {
  return (
    <div style={{
      position: "absolute", top: 40, right: 40, padding: "8px 16px", borderRadius: 999,
      background: "rgba(0,0,0,0.55)", color: GOLD, fontSize: 22, fontWeight: 600, fontFamily: fontFamilyFor(lang),
      border: `1px solid ${GOLD}`,
    }}>
      {labelsFor(lang).badge}
    </div>
  );
}

function QrCard({ qr, lang }: { qr: string; lang: LangCode }) {
  return (
    <div style={{
      position: "absolute", left: 60, right: 60, bottom: 70, background: "#fff", borderRadius: 28,
      padding: 24, display: "flex", alignItems: "center", gap: 24, boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
    }}>
      <Img src={qr} style={{ width: 210, height: 210 }} />
      <div style={{ fontFamily: fontFamilyFor(lang), color: "#111" }}>
        <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.3 }}>{labelsFor(lang).scan}</div>
        <div style={{ fontSize: 22, marginTop: 10, color: "#555" }}>{labelsFor(lang).archive}</div>
      </div>
    </div>
  );
}

function Act3Card({ children, lang, label }: { children: React.ReactNode; lang: LangCode; label: string }) {
  return (
    <div style={{
      position: "absolute", left: 50, right: 50, top: 150, border: `3px solid ${GOLD}`, borderRadius: 28,
      background: "rgba(10,10,10,0.72)", padding: "36px 38px", fontFamily: fontFamilyFor(lang),
    }}>
      <div style={{ color: GOLD, fontSize: 22, letterSpacing: 3, textTransform: "uppercase", marginBottom: 18, fontFamily: "sans-serif" }}>{label}</div>
      {children}
    </div>
  );
}

function BeatView({ beat, frames, props }: { beat: ReelBeatProp; frames: number; props: ReelVideoProps }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [0, FADE, Math.max(FADE, frames - FADE), frames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const lang = props.language;
  const seconds = frames / fps;
  const { quote } = props;
  const quoteSize = quote.text.length > 230 ? 34 : quote.text.length > 140 ? 40 : 48;

  const isAct3 = beat.id === "quote" || beat.id === "takeaway";
  // Story beats play their motion clip in slow motion (never faster than real time) so it fills as
  // much of the beat as possible; whatever time is left holds on the clip's last frame with a slow zoom.
  // The quote/takeaway beats keep a calm blurred still behind the text.
  const hasClip = Boolean(beat.videoUrl) && !isAct3;
  const clipSeconds = beat.videoSeconds && beat.videoSeconds > 0 ? beat.videoSeconds : 4;
  const rate = Math.max(0.5, Math.min(1, clipSeconds / seconds));
  const clipFrames = hasClip ? Math.min(frames, Math.max(1, Math.round((clipSeconds / rate) * fps))) : 0;
  const stillFrames = frames - clipFrames;

  return (
    <AbsoluteFill style={{ opacity }}>
      {clipFrames > 0 && (
        <Sequence from={0} durationInFrames={clipFrames} layout="none">
          <OffthreadVideo src={beat.videoUrl as string} playbackRate={rate} muted style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        </Sequence>
      )}
      {stillFrames > 0 && (
        <Sequence from={clipFrames} durationInFrames={stillFrames} layout="none">
          {beat.imageUrl ? (
            <KenBurns src={beat.imageUrl} frames={stillFrames} blur={isAct3 ? 14 : 0} dim={isAct3 ? 0.45 : 0.25} />
          ) : (
            <EditorialBackground dark={isAct3} />
          )}
        </Sequence>
      )}

      {!isAct3 && <KineticCaption text={beat.text} seconds={seconds} lang={lang} onLight={!beat.imageUrl && !hasClip} />}

      {beat.id === "quote" && (
        <Act3Card lang={props.quoteLang} label={quote.official ? labelsFor(lang).quoteOfficial : labelsFor(lang).quote}>
          <div style={{ color: CREAM, fontSize: quoteSize, lineHeight: 1.4, fontWeight: 600 }}>&ldquo;{quote.text}&rdquo;</div>
          <div style={{ color: GOLD, fontSize: 26, marginTop: 22 }}>— {quote.author}</div>
          <div style={{ color: "rgba(250,249,246,0.7)", fontSize: 19, marginTop: 6, fontFamily: "sans-serif" }}>{quote.sourceWork}</div>
        </Act3Card>
      )}
      {beat.id === "takeaway" && (
        <Act3Card lang={lang} label={labelsFor(lang).takeaway}>
          <div style={{ color: CREAM, fontSize: 44, lineHeight: 1.35, fontWeight: 600 }}>{beat.text}</div>
          <div style={{ color: "rgba(250,249,246,0.6)", fontSize: 18, marginTop: 24, fontFamily: "sans-serif" }}>{props.disclosure}</div>
        </Act3Card>
      )}
      {isAct3 && <QrCard qr={props.qrDataUri} lang={lang} />}
    </AbsoluteFill>
  );
}

export function ReelVideo(props: ReelVideoProps) {
  const { fps } = useVideoConfig();
  let cursor = 0;
  const placed = props.beats.map((beat) => {
    const frames = Math.max(1, Math.round(beat.durationInSeconds * fps));
    const from = cursor;
    cursor += frames;
    return { beat, from, frames };
  });
  return (
    <AbsoluteFill style={{ backgroundColor: "#0F0F0F" }}>
      {placed.map(({ beat, from, frames }) => (
        <Sequence key={beat.id} from={from} durationInFrames={frames}>
          <BeatView beat={beat} frames={frames} props={props} />
        </Sequence>
      ))}
      <SourceBadge lang={props.language} />
      {props.audioUrl && <Audio src={props.audioUrl} />}
    </AbsoluteFill>
  );
}
