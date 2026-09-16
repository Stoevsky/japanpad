"use client";

import { useEffect } from "react";
import { logClientError } from "@/lib/report";

/**
 * The last boundary, for when the root layout itself throws.
 *
 * `assertChainConfig()` runs in that layout and is meant to throw — a network
 * misconfiguration should stop the site rather than serve a page that signs on
 * the wrong chain. Without this file that deliberate throw renders as Next's
 * bare "server-side exception" screen, which tells an operator nothing about
 * what to fix.
 *
 * This replaces the whole document, so it carries its own <html> and <body> and
 * cannot use anything from the layout it is standing in for — including the
 * fonts and the stylesheet. Hence the inline styling.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    logClientError("global", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#faf7f2",
          color: "#1c1917",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: "32rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", margin: 0 }}>JapanPad could not start</h1>
          <p style={{ marginTop: "0.75rem", lineHeight: 1.6, color: "#57534e" }}>
            The site failed before it could render anything. This is usually a
            configuration problem rather than a chain problem — if you are running
            this deployment, the reason is in the server logs.
          </p>
          <p style={{ marginTop: "0.75rem", lineHeight: 1.6, color: "#57534e" }}>
            Nothing was signed and nothing was sent.
          </p>
          {error.digest ? (
            <p
              style={{
                marginTop: "1.5rem",
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.75rem",
                color: "#a8a29e",
              }}
            >
              Reference: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
