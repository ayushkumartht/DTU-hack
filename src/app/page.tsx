import type { Metadata } from "next";
import { LandingPage } from "@/features/landing/components/LandingPage";

export const metadata: Metadata = {
  title: "VivekReel · Verified teachings, honest reels",
  description:
    "Turns a verified teaching of Swami Vivekananda into an honest 30–60 second Hindi reel, with the original Belur Math source always visible.",
};

export default function Home() {
  return <LandingPage />;
}
