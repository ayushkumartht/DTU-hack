import { Composition } from "remotion";
import { StoryVideo, type StoryVideoProps } from "./StoryVideo";
import { ReelVideo, sumBeatSeconds, type ReelVideoProps } from "./ReelVideo";

export const FPS = 30;
export const VIDEO_WIDTH = 720;
export const VIDEO_HEIGHT = 1280;
const DEFAULT_DURATION_SECONDS = 45;

const defaultProps: StoryVideoProps = {
  scenes: [],
  audioUrl: "",
};

export function sumSceneSeconds(scenes: StoryVideoProps["scenes"]): number {
  const total = scenes.reduce((sum, s) => sum + (s.durationInSeconds > 0 ? s.durationInSeconds : 0), 0);
  return total > 0 ? total : DEFAULT_DURATION_SECONDS;
}

const defaultReelProps: ReelVideoProps = {
  beats: [],
  audioUrl: null,
  language: "en",
  quoteLang: "en",
  qrDataUri: "",
  quote: { text: "", author: "", sourceWork: "", official: false },
  disclosure: "",
};

export function RemotionRoot() {
  return (
    <>
    <Composition<any, ReelVideoProps>
      id="ReelVideo"
      component={ReelVideo}
      durationInFrames={FPS * 35}
      fps={FPS}
      width={VIDEO_WIDTH}
      height={VIDEO_HEIGHT}
      defaultProps={defaultReelProps}
      calculateMetadata={async ({ props }) => ({ durationInFrames: Math.max(1, Math.round(sumBeatSeconds(props.beats) * FPS)) })}
    />
    <Composition<any, StoryVideoProps>
      id="StoryVideo"
      component={StoryVideo}
      durationInFrames={FPS * DEFAULT_DURATION_SECONDS}
      fps={FPS}
      width={VIDEO_WIDTH}
      height={VIDEO_HEIGHT}
      defaultProps={defaultProps}
      calculateMetadata={async ({ props }) => {
        return { durationInFrames: Math.max(1, Math.round(sumSceneSeconds(props.scenes) * FPS)) };
      }}
    />
    </>
  );
}
