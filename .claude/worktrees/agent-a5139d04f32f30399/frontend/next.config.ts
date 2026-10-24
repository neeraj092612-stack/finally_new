import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  // Next 16.3 `next dev` otherwise writes frontend/AGENTS.md + CLAUDE.md into the repo.
  agentRules: false,
  // Dev-only proxy to the local backend; the static export has no server and no proxy.
  ...(isDev
    ? {
        async rewrites() {
          return [{ source: "/api/:path*", destination: "http://127.0.0.1:8000/api/:path*" }];
        },
      }
    : {}),
};

export default nextConfig;
