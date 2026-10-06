import type { Metadata } from "next";
import { StoryExperience } from "@/features/story/components/StoryExperience";

export const metadata: Metadata = {
  title: "Story Board · Learning of Vivekanand",
  description: "Generate a personalized wisdom story and watch it illustrated scene by scene.",
};

export default function StoryBoardPage() {
  return <StoryExperience />;
}
