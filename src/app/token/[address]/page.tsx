import Link from "next/link";
import { notFound } from "next/navigation";
import { isAddress, getAddress, type Address } from "viem";
import { CHAIN_NAME, VALUES_ARE_REAL, addressUrl } from "@/lib/chain";
import {
  formatEth,
  formatPercent,
  formatPricePerMillion,
  formatTokens,
  safeImageUrl,
  safeLinkUrl,
  shortAddress,
} from "@/lib/format";
import { getLaunch } from "@/lib/pons/read";
import { getTheme } from "@/lib/themes";
import { CurveBar } from "@/components/CurveBar";
import { TradePanel } from "@/components/TradePanel";

/**
 * One token, read straight off the chain on every request.
 *
 * Not cached. The panel below quotes against live reserves, and a header that
 * said "62% to graduation" from a minute-old snapshot next to a live quote would
 * be two different answers to the same question on one screen.
 *
 * `getLaunch` returns null for any Pons token without our theme tag, and that
 * 404s rather than rendering. JapanPad shows JapanPad launches; a Pons coin from
 * somewhere else is not ours to present as one.
 */
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ address: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { address } = await params;
  if (!isAddress(address)) return { title: "Token — JapanPad" };

  const lookup = await getLaunch(getAddress(address));
  if (lookup.status !== "ok") return { title: "Token — JapanPad" };
  const { launch } = lookup;

  return {
    title: `${launch.name} ($${launch.symbol}) — JapanPad`,
    description: launch.description.slice(0, 200) || `${launch.name} on ${CHAIN_NAME}.`,
  };
}

export default async function TokenPage({ params }: PageProps) {
  const { address } = await params;
  if (!isAddress(address)) notFound();

  // Checksummed before use so a lowercase URL and a checksummed one are the
  // same token to every downstream comparison, including the balance reads.
  const token = getAddress(address) as Address;
  const lookup = await getLaunch(token);

  // A 404 is a claim about the chain, so it is only made when the chain
  // actually answered. When it did not, the page says it could not read rather
  // than telling a holder their token does not exist.
  if (lookup.status === "unavailable") return <Unreadable token={token} />;
  if (lookup.status === "missing") notFound();
  const launch = lookup.launch;

  const theme = getTheme(launch.themeId);
  const image = safeImageUrl(launch.logo);
  const accent = theme?.accent ?? "var(--color-vermilion)";
  const price = formatPricePerMillion(launch.spotPrice);

  // Creator-supplied, so every one is run through safeLinkUrl and anything that
  // is not plain http(s) is dropped rather than rendered as an anchor.
  const socials: Array<{ label: string; href: string }> = (
    [
      ["Website", launch.socials.website],
      ["X", launch.socials.twitter],
      ["Telegram", launch.socials.telegram],
      ["Discord", launch.socials.discord],
      ["Farcaster", launch.socials.farcaster],
    ] as Array<[string, string]>
  ).flatMap(([label, uri]) => {
    const href = safeLinkUrl(uri);
    return href ? [{ label, href }] : [];
  });

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <Link href="/explore" className="text-sm text-muted hover:text-vermilion">
        ← Explore
      </Link>

      <div className="mt-6 grid lg:grid-cols-[1fr_360px] gap-8 items-start">
        <div className="space-y-6">
          <header className="flex items-start gap-4">
            <div
              className="size-16 rounded-xl shrink-0 overflow-hidden border border-rule bg-ivory flex items-center justify-center"
              style={{ borderColor: `${accent}44` }}
            >
              {image ? (
                <img src={image} alt="" className="size-full object-cover" />
              ) : (
                <span className="jp text-2xl" style={{ color: accent }}>
                  {theme?.japaneseName.slice(0, 1) ?? "・"}
                </span>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h1 className="font-display text-3xl font-bold break-words">
                  {launch.name || "Untitled"}
                </h1>
                <span className="num text-muted">${launch.symbol}</span>
                {launch.graduated ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-gold/20 text-gold border border-gold/40">
                    Graduated
                  </span>
                ) : launch.readyToGraduate ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-sakura/25 text-sumi border border-sakura/50">
                    Graduating
                  </span>
                ) : null}
              </div>

              {theme && (
                <Link
                  href={`/themes/${theme.id}`}
                  className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full border transition-opacity hover:opacity-80"
                  style={{
                    color: theme.accent,
                    borderColor: `${theme.accent}55`,
                    backgroundColor: `${theme.accent}12`,
                  }}
                >
                  {theme.name} <span className="jp opacity-70">{theme.japaneseName}</span>
                </Link>
              )}
            </div>
          </header>

          {launch.description ? (
            <p className="text-sumi/85 leading-relaxed whitespace-pre-wrap break-words">
              {launch.description}
            </p>
          ) : null}

          {socials.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer noopener nofollow"
                  className="text-xs px-3 py-1.5 rounded-full border border-rule text-muted hover:border-vermilion hover:text-vermilion transition-colors"
                >
                  {s.label} ↗
                </a>
              ))}
            </div>
          ) : null}

          <section className="card p-5">
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="font-display text-base">
                {launch.graduated ? "Graduated" : "Progress to graduation"}
              </h2>
              <span className="num text-sm text-muted">
                {formatPercent(launch.progress, 1)}
              </span>
            </div>
            <CurveBar progress={launch.progress} accent={theme?.accent} />
            <p className="mt-2 text-sm text-muted">
              <span className="num">
                {formatEth(launch.raised, 5)} of{" "}
                {formatEth(launch.graduationThreshold, 5)} ETH
              </span>{" "}
              raised on the curve.
            </p>
            <p className="mt-3 text-xs text-muted/90 leading-relaxed">
              {launch.graduated
                ? "The curve has finished. Its liquidity moved into a permanently locked Uniswap v4 pool, so it trades there now rather than here."
                : "When the curve reaches its threshold, Pons moves the liquidity into a permanently locked Uniswap v4 pool. Reaching it is not a milestone JapanPad judges — it is the point at which the curve stops pricing this token."}
            </p>
          </section>

          <section className="card p-5">
            <h2 className="font-display text-base mb-3">On chain</h2>
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Row label="Token">
                <Explorer address={launch.token} />
              </Row>
              <Row label="Bonding curve">
                <Explorer address={launch.curve} />
              </Row>
              <Row label="Creator">
                <Explorer address={launch.deployer} />
              </Row>
              <Row label="Total supply">
                {formatTokens(launch.totalSupply)} {launch.symbol}
              </Row>
              <Row label="Still on the curve">
                {formatTokens(launch.sellableTokens)} {launch.symbol}
              </Row>
              <Row label="Trade fee">
                {formatPercent(Number(launch.feeBps) / 10_000, 2)}
              </Row>
              <Row label="Creator fee">
                {launch.creatorTaxBps > 0n
                  ? formatPercent(Number(launch.creatorTaxBps) / 10_000, 2)
                  : "None"}
              </Row>
              <Row label="Price per 1M tokens">
                {price === null ? "Unavailable" : `${price} ETH`}
              </Row>
            </dl>
            <p className="mt-4 text-xs text-muted/90 leading-relaxed">
              Fees are the curve&rsquo;s own, read from it just now. JapanPad takes no cut
              of a trade and no cut of a launch — Pons charges its launch fee and its trade
              fee directly, and this site adds nothing on top.
            </p>
          </section>
        </div>

        <div className="lg:sticky lg:top-6 space-y-4">
          <TradePanel
            token={launch.token}
            curve={launch.curve}
            symbol={launch.symbol || "tokens"}
            graduated={launch.graduated}
            readyToGraduate={launch.readyToGraduate}
          />

          <p className="text-xs text-muted/90 leading-relaxed px-1">
            {VALUES_ARE_REAL
              ? "This token was created by whoever launched it, not by JapanPad. A theme is a label its creator chose. Nothing here is a recommendation, and nothing about it is reviewed."
              : `This is ${CHAIN_NAME}. Everything on this page is test data.`}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * The chain could not be read, and that is all this says.
 *
 * Deliberately not a 404. "This token does not exist" is a claim about the
 * chain, and an unanswered RPC call is not grounds for making it — the address
 * is echoed back so the reader can go and check for themselves.
 */
function Unreadable({ token }: { token: Address }) {
  return (
    <div className="mx-auto max-w-2xl px-5 py-20 text-center">
      <h1 className="font-display text-2xl">This token could not be read</h1>
      <p className="mt-3 text-sm text-muted leading-relaxed">
        {CHAIN_NAME} did not answer in time, so nothing about this token is being
        shown rather than something wrong. This is not a statement that the token
        does not exist. Reload in a moment, or check it on the explorer.
      </p>
      <p className="mt-6 font-mono text-xs text-muted break-all">{token}</p>
      <div className="mt-4">
        <Explorer address={token} />
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="label">{label}</dt>
      <dd className="num mt-1 truncate">{children}</dd>
    </div>
  );
}

/** An address, linked to the explorer when this network has one. */
function Explorer({ address }: { address: string }) {
  const href = addressUrl(address);
  if (!href) return <span className="num text-xs">{shortAddress(address)}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="num text-xs underline decoration-rule hover:text-vermilion"
      title={address}
    >
      {shortAddress(address)} ↗
    </a>
  );
}
