import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

export interface VideoScene {
  imageUrl: string;
  /** A short real motion clip for this scene, or null to use the static image only. */
  videoUrl: string | null;
  caption: string;
  /** The exact narration text spoken during this scene - shown as a subtitle. */
  subtitle: string;
  /** This scene's own slice of the narration, in seconds - drives its timeline share directly. */
  durationInSeconds: number;
}

export type StoryVideoProps = {
  scenes: VideoScene[];
  audioUrl: string;
} & Record<string, unknown>;

const FADE_FRAMES = 12;
// Requested duration for a motion clip (src/lib/ltxVideo.ts); the clip is
// trimmed to whichever is shorter, that or the scene's own duration.
const CLIP_SECONDS = 4.5;

function useFade(frame: number, durationInFrames: number) {
  const fadeOutStart = Math.max(FADE_FRAMES, durationInFrames - FADE_FRAMES);
  return interpolate(frame, [0, FADE_FRAMES, fadeOutStart, durationInFrames], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

function KenBurnsImage({ imageUrl, durationInFrames }: { imageUrl: string; durationInFrames: number }) {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, Math.max(durationInFrames, 1)], [1, 1.12], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <Img src={imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})` }} />
  );
}

function Subtitle({ text }: { text: string }) {
  if (!text) return null;
  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        padding: "0 44px 64px",
        background: "linear-gradient(to top, rgba(0,0,0,0.68), rgba(0,0,0,0) 46%)",
      }}
    >
      <div
        style={{
          color: "#FAF9F6",
          fontSize: 27,
          fontWeight: 600,
          fontFamily: "Georgia, serif",
          lineHeight: 1.4,
          textShadow: "0 2px 10px rgba(0,0,0,0.65)",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
}

function SceneClip({ scene, durationInFrames }: { scene: VideoScene; durationInFrames: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = useFade(frame, durationInFrames);

  const clipFrames = scene.videoUrl
    ? Math.min(durationInFrames, Math.round(CLIP_SECONDS * fps))
    : 0;
  const stillFrames = durationInFrames - clipFrames;

  return (
    <AbsoluteFill style={{ opacity, backgroundColor: "#0F0F0F" }}>
      {scene.videoUrl && clipFrames > 0 && (
        <Sequence from={0} durationInFrames={clipFrames} layout="none">
          <OffthreadVideo
            src={scene.videoUrl}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        </Sequence>
      )}
      {stillFrames > 0 && (
        <Sequence from={clipFrames} durationInFrames={stillFrames} layout="none">
          <KenBurnsImage imageUrl={scene.imageUrl} durationInFrames={stillFrames} />
        </Sequence>
      )}
      <Subtitle text={scene.subtitle} />
    </AbsoluteFill>
  );
}

export function StoryVideo({ scenes, audioUrl }: StoryVideoProps) {
  const { fps } = useVideoConfig();

  let cursor = 0;
  const placed = scenes.map((scene) => {
    const durationInFrames = Math.max(1, Math.round(scene.durationInSeconds * fps));
    const from = cursor;
    cursor += durationInFrames;
    return { scene, from, durationInFrames };
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0F0F0F" }}>
      {placed.map(({ scene, from, durationInFrames }, index) => (
        <Sequence key={index} from={from} durationInFrames={durationInFrames}>
          <SceneClip scene={scene} durationInFrames={durationInFrames} />
        </Sequence>
      ))}
      <Audio src={audioUrl} />
    </AbsoluteFill>
  );
}
