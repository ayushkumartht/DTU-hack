import type { Metadata } from "next";
import { ReelExperience } from "@/features/reel/components/ReelExperience";

export const metadata: Metadata = {
  title: "Teaching to Reel · Learning of Vivekanand",
  description: "Turn a verified teaching of Swami Vivekananda into an honest 30-60 second reel.",
};

export default function ReelPage() {
  return <ReelExperience />;
}
