import Link from "next/link";
import { getTheme } from "@/lib/themes";
import { formatEth, formatPercent, safeImageUrl, shortAddress } from "@/lib/format";
import type { LaunchSummary } from "@/lib/pons/read";
import { CurveBar } from "./CurveBar";

export function LaunchCard({ launch }: { launch: LaunchSummary }) {
  const theme = getTheme(launch.themeId);
  const image = safeImageUrl(launch.logo);

  return (
    <Link
      href={`/token/${launch.token}`}
      className="card card-link p-4 flex flex-col gap-3"
    >
      <div className="flex items-start gap-3">
        <div
          className="size-11 rounded-lg shrink-0 overflow-hidden border border-rule bg-ivory flex items-center justify-center"
          style={theme ? { borderColor: `${theme.accent}44` } : undefined}
        >
          {image ? (
            <img src={image} alt="" className="size-full object-cover" loading="lazy" />
          ) : (
            <span className="jp text-sm" style={{ color: theme?.accent }}>
              {theme?.japaneseName.slice(0, 1) ?? "・"}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="font-display font-semibold truncate">{launch.name || "Untitled"}</h3>
            <span className="num text-xs text-muted shrink-0">${launch.symbol}</span>
          </div>
          <p className="text-xs text-muted truncate">
            by <span className="num">{shortAddress(launch.deployer)}</span>
          </p>
        </div>

        {launch.graduated && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gold/20 text-gold border border-gold/40 shrink-0">
            Graduated
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {theme && (
          <span
            className="text-[11px] px-2 py-0.5 rounded-full border"
            style={{
              color: theme.accent,
              borderColor: `${theme.accent}55`,
              backgroundColor: `${theme.accent}12`,
            }}
          >
            {theme.name} <span className="jp opacity-70">{theme.japaneseName}</span>
          </span>
        )}
        {/*
          Ticker only, with no price and no company name.
          A card is a summary and this one is rendered dozens to a page; fetching
          a live quote for each would be dozens of upstream calls to decorate a
          grid. A stale price is not an option, so the card shows the identifier
          and the token page — which does read the live quote — shows the number.
        */}
        {launch.stockTicker && (
          <span
            className="text-[11px] px-2 py-0.5 rounded-full border border-rule text-muted font-mono"
            title={`Market cap measured against ${launch.stockTicker}. Not backed by or affiliated with the company.`}
          >
            vs {launch.stockTicker}
          </span>
        )}
      </div>

      <div className="mt-auto space-y-1.5">
        <CurveBar progress={launch.progress} accent={theme?.accent} />
        <div className="flex justify-between text-[11px] text-muted">
          <span>
            <span className="num">{formatPercent(launch.progress, 0)}</span> to
            graduation
          </span>
          <span className="num">
            {formatEth(launch.raised)} / {formatEth(launch.graduationThreshold)} ETH
          </span>
        </div>
      </div>
    </Link>
  );
}
