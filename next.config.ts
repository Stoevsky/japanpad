import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

/**
 * Images can point anywhere a creator chose, so they are never optimised
 * through our own loader — an unoptimised <img> cannot be used to make our
 * origin fetch an arbitrary URL on a visitor's behalf.
 */
const nextConfig: NextConfig = {
  images: { unoptimized: true },
  // Pinned because there is a stray package-lock.json in the home directory
  // above this repo, and Next's root inference picks the outermost lockfile it
  // finds — which had it tracing build output against ~/ rather than here.
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),
  // Five routes prerender against the live chain, so the budget has to cover a
  // slow RPC rather than a healthy one. The transport is capped well under this
  // (see lib/pons/client.ts); the headroom is here so that a page which does
  // several reads still gets to finish and render its "unavailable" state
  // rather than failing the whole build.
  staticPageGenerationTimeout: 180,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
