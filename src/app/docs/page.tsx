import type { Metadata } from "next";
import { DocsPage } from "@/features/docs/components/DocsPage";

export const metadata: Metadata = {
  title: "Docs · VivekReel architecture and tech stack",
  description: "Interactive diagrams of how VivekReel turns a verified teaching into an honest Hindi reel: architecture, pipeline, authenticity, data and tech stack.",
};

export default function Docs() {
  return <DocsPage />;
}
