import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const config = [
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Token logos come from a creator's launch transaction and can point at
      // any host on the internet. next/image would need every one of those
      // hosts allowlisted in next.config, so these are plain <img> on purpose —
      // run through safeImageUrl first, which drops anything that is not
      // http(s) or ipfs.
      "@next/next/no-img-element": "off",
    },
  },
];

export default config;
