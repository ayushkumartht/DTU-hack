import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @remotion/bundler and @remotion/renderer pull in Node-only native
  // tooling (and an optional Studio/Whisper editor chain we never use);
  // bundling them breaks module resolution, so they run as plain Node
  // `require` instead.
  serverExternalPackages: ["@remotion/bundler", "@remotion/renderer", "remotion"],
};

export default nextConfig;
