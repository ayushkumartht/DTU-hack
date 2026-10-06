import { AbsoluteFill, Audio, Img, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

export interface VideoScene {
  imageUrl: string;
  caption: string;
}

export type StoryVideoProps = {
  scenes: VideoScene[];
  audioUrl: string;
  // Only read by Root.tsx's calculateMetadata to size the composition; the
  // component itself derives per-scene timing from the resolved duration.
  audioDurationInSeconds: number;
} & Record<string, unknown>;

const FADE_FRAMES = 12;

function SceneClip({ scene, durationInFrames }: { scene: VideoScene; durationInFrames: number }) {
  const frame = useCurrentFrame();
  // A slow, constant zoom (Ken Burns) over the scene's own duration.
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.12], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Fades to black between scenes instead of a hard cut.
  const fadeOutStart = Math.max(FADE_FRAMES, durationInFrames - FADE_FRAMES);
  const opacity = interpolate(
    frame,
    [0, FADE_FRAMES, fadeOutStart, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ opacity, backgroundColor: "#0F0F0F" }}>
      <Img
        src={scene.imageUrl}
        style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})` }}
      />
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          padding: "0 56px 88px",
          background: "linear-gradient(to top, rgba(0,0,0,0.6), rgba(0,0,0,0) 42%)",
        }}
      >
        <div
          style={{
            color: "#FAF9F6",
            fontSize: 34,
            fontWeight: 600,
            fontFamily: "Georgia, serif",
            lineHeight: 1.3,
            textShadow: "0 2px 10px rgba(0,0,0,0.6)",
          }}
        >
          {scene.caption}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

export function StoryVideo({ scenes, audioUrl }: StoryVideoProps) {
  const { durationInFrames } = useVideoConfig();
  const count = Math.max(scenes.length, 1);
  const perScene = Math.floor(durationInFrames / count);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0F0F0F" }}>
      {scenes.map((scene, index) => {
        const isLast = index === scenes.length - 1;
        const from = index * perScene;
        const length = isLast ? durationInFrames - from : perScene;
        return (
          <Sequence key={index} from={from} durationInFrames={length}>
            <SceneClip scene={scene} durationInFrames={length} />
          </Sequence>
        );
      })}
      <Audio src={audioUrl} />
    </AbsoluteFill>
  );
}
