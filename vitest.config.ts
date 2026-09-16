import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * Unit tests only, and deliberately so.
 *
 * Everything under test here is a pure function: formatting, parsing, and the
 * env-var guards. None of it touches the network, because a test that depends
 * on a live RPC fails for reasons that have nothing to do with the code. The
 * live-chain checks live in `npm run verify:pons`, which is a separate thing
 * with a separate purpose — it is allowed to fail when the chain changes.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.join(root, "src") },
  },
});
