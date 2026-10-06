import { Composition } from "remotion";
import { StoryVideo, type StoryVideoProps } from "./StoryVideo";

export const FPS = 30;
export const VIDEO_WIDTH = 720;
export const VIDEO_HEIGHT = 1280;
const DEFAULT_DURATION_SECONDS = 45;

const defaultProps: StoryVideoProps = {
  scenes: [],
  audioUrl: "",
  audioDurationInSeconds: DEFAULT_DURATION_SECONDS,
};

export function RemotionRoot() {
  return (
    <Composition<any, StoryVideoProps>
      id="StoryVideo"
      component={StoryVideo}
      durationInFrames={FPS * DEFAULT_DURATION_SECONDS}
      fps={FPS}
      width={VIDEO_WIDTH}
      height={VIDEO_HEIGHT}
      defaultProps={defaultProps}
      calculateMetadata={async ({ props }) => {
        const seconds = props.audioDurationInSeconds > 0 ? props.audioDurationInSeconds : DEFAULT_DURATION_SECONDS;
        return { durationInFrames: Math.max(1, Math.round(seconds * FPS)) };
      }}
    />
  );
}
