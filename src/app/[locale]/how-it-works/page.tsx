import { Link } from "@/i18n/routing";
import { CHAIN_NAME, EXPLORER_URL, IS_MAINNET, NATIVE_SYMBOL, VALUES_ARE_REAL } from "@/lib/chain";
import { formatEth, formatPercent, formatTokens } from "@/lib/format";
import { PONS_FACTORY } from "@/lib/pons/deployment";
import { readLaunchTerms } from "@/lib/pons/terms";
import { THEMES } from "@/lib/themes";
import { PageHeader } from "@/components/PageHeader";

/**
 * What actually happens, in order, with the live numbers.
 *
 * The fee and the curve's terms are read from Pons on every request rather than
 * written into the copy, because they are Pons's to change and a page that
 * quoted them from memory would eventually be lying. When the read fails the
 * page says the number is unavailable instead of printing a plausible one.
 */

export const dynamic = "force-dynamic";

export const metadata = {
  title: "How it works — JapanPad",
  description:
    "What JapanPad does, what Pons does, and what happens when you launch or trade a token.",
};

export default async function HowItWorks() {
  const terms = await readLaunchTerms();

  const steps = [
    {
      n: "01",
      jp: "選ぶ",
      title: "Pick a theme",
      body: `Every JapanPad token is filed under one of ${THEMES.length} cultural themes — anime, ramen counters, kei trucks, city pop. A theme is a label for finding things, chosen by whoever launches. It is not a sector, not an index, and it is not connected to any company's shares or to any market.`,
    },
    {
      n: "02",
      jp: "作る",
      title: "Create your token",
      body: "Name, ticker, an image, a description, and links if you want them. JapanPad writes its theme tag into the description field so the token can be found here later. Everything else is exactly what you typed, and all of it lands on chain where anyone can read it.",
    },
    {
      n: "03",
      jp: "発行",
      title: "Launch through Pons",
      body: `Your wallet signs one transaction to Pons's launch factory. Pons mints the supply, deploys a bonding curve, and charges its launch fee${
        terms ? ` — currently ${formatEth(terms.launchFeeWei, 6)} ${NATIVE_SYMBOL}` : ""
      }. JapanPad does not take a cut, does not hold your funds, and never has custody of the token.`,
    },
    {
      n: "04",
      jp: "取引",
      title: "Trade on the curve",
      body: "Anyone can buy from the curve or sell back to it. The price rises as tokens are bought and falls as they are sold; every quote on this site is produced by simulating the real trade against the live curve, not by our own arithmetic.",
    },
  ];

  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <PageHeader jp="仕組み" title="How it works">
        JapanPad is an interface. The launching and the trading are done by Pons,
        a protocol on {CHAIN_NAME} that this site does not own or control.
      </PageHeader>

      <ol className="space-y-4">
        {steps.map((step) => (
          <li key={step.n} className="card p-5 flex gap-5">
            <div className="shrink-0 text-center w-12">
              <div className="num text-2xl text-vermilion">{step.n}</div>
              <div className="jp text-xs text-muted mt-1">{step.jp}</div>
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold">{step.title}</h2>
              <p className="text-sm text-sumi/85 mt-1.5 leading-relaxed">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">The curve, and graduation</h2>
        <p className="text-sm text-sumi/85 mt-2 leading-relaxed">
          A new token has no market maker, so Pons gives it one: a bonding curve holding
          the whole supply, pricing it by a fixed formula. Buying moves the price up along
          that curve and selling moves it back down. There is no order book and no
          counterparty other than the curve itself.
        </p>
        <p className="text-sm text-sumi/85 mt-3 leading-relaxed">
          Once the curve has taken in its graduation amount, Pons closes it and moves the
          liquidity into a Uniswap v4 pool that is permanently locked. From that point the
          token trades on the pool rather than on the curve, and JapanPad stops pricing it.
          Both buying and selling are paused for the short window between the curve filling
          and the pool being seeded — anyone can trigger that step.
        </p>

        <div className="card p-5 mt-5">
          <h3 className="font-display text-sm mb-3">
            Pons&rsquo;s current terms{" "}
            <span className="text-muted font-normal">
              — read from the contract just now
            </span>
          </h3>
          {terms ? (
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Row label="Launch fee">{formatEth(terms.launchFeeWei, 6)} {NATIVE_SYMBOL}</Row>
              <Row label="Trade fee">
                {formatPercent(terms.curveFeeBps / 10_000, 2)}
              </Row>
              <Row label="Supply per token">{formatTokens(terms.supply)}</Row>
              <Row label="Graduation at">
                {formatEth(terms.graduationThresholdWei, 5)} {NATIVE_SYMBOL}
              </Row>
              <Row label="Launching">
                {terms.launchEnabled && terms.configEnabled
                  ? "Open"
                  : "Paused by Pons"}
              </Row>
              <Row label="Quote asset">{NATIVE_SYMBOL}</Row>
            </dl>
          ) : (
            <p className="text-sm text-muted leading-relaxed">
              Pons could not be read right now, so its terms are not shown. They are not
              guessed here — the launch form reads them again immediately before you sign,
              and refuses to open a wallet without them.
            </p>
          )}
          <p className="text-xs text-muted/90 mt-4 pt-4 border-t border-rule leading-relaxed">
            Every one of these is Pons&rsquo;s to set and Pons&rsquo;s to change. JapanPad
            takes no fee of its own on a launch or a trade.
          </p>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">What JapanPad is not</h2>
        <ul className="mt-3 space-y-3 text-sm text-sumi/85">
          <Point>
            <strong>Not a broker or a custodian.</strong> Every action is a transaction
            your own wallet signs. JapanPad never holds your {NATIVE_SYMBOL} or your tokens and cannot
            move either. It will never ask for a recovery phrase — nothing that does is
            this site.
          </Point>
          <Point>
            <strong>Not connected to any company.</strong> A token themed around anime,
            cars, or ramen is a crypto token someone made. It is not a share, confers no
            ownership, dividends, or voting rights, and is not affiliated with or endorsed
            by any company its creator may reference.
          </Point>
          <Point>
            <strong>Not a curator.</strong> Anything launched through Pons with our theme
            tag appears here. Nothing is reviewed, vetted, or approved, and appearing on
            this site is not a signal of anything. The Garden sorts by curve stage, which
            is a fact about a contract and not a judgement about a token.
          </Point>
          <Point>
            <strong>Not the protocol.</strong> Pons deploys the token, prices it, holds
            the liquidity, and graduates it. If Pons changes its terms or pauses launching,
            that happens whether this site knows about it or not — which is why the numbers
            above are read from the contract rather than written into the page.
          </Point>
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">Risk, plainly</h2>
        <p className="text-sm text-sumi/85 mt-2 leading-relaxed">
          These tokens have no business behind them and no floor under them. A creator can
          sell everything they hold at any time, a curve can go to nothing, and there is
          nobody to appeal to when it does. Trades are irreversible. Treat anything you put
          in as money you are prepared to lose entirely, and read the token&rsquo;s contract
          on the explorer before you trade it.
        </p>
        {!VALUES_ARE_REAL ? (
          <p className="text-sm text-sumi/85 mt-3 leading-relaxed border-l-2 border-vermilion/40 pl-4">
            This deployment is pointed at {CHAIN_NAME}, a test network. Every balance,
            price, and token here is play money with no worth, and nothing you do on it
            touches mainnet.
          </p>
        ) : null}
      </section>

      <section className="mt-12 card p-5">
        <h2 className="font-display text-base">Check it yourself</h2>
        <p className="text-sm text-muted mt-1.5 leading-relaxed">
          Nothing on this site has to be taken on trust. Every launch and trade is a
          transaction on {CHAIN_NAME}, and the contracts behind them are public.
        </p>
        <div className="flex flex-wrap gap-2 mt-4 text-xs">
          {PONS_FACTORY && EXPLORER_URL ? (
            <a
              href={`${EXPLORER_URL}/address/${PONS_FACTORY}`}
              target="_blank"
              rel="noreferrer noopener"
              className="px-3 py-1.5 rounded-full border border-rule text-muted hover:border-vermilion hover:text-vermilion transition-colors"
            >
              Pons launch factory ↗
            </a>
          ) : null}
          {EXPLORER_URL ? (
            <a
              href={EXPLORER_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="px-3 py-1.5 rounded-full border border-rule text-muted hover:border-vermilion hover:text-vermilion transition-colors"
            >
              {IS_MAINNET ? "Robinhood Chain explorer" : "Testnet explorer"} ↗
            </a>
          ) : null}
          <Link
            href="/explore"
            className="px-3 py-1.5 rounded-full border border-rule text-muted hover:border-vermilion hover:text-vermilion transition-colors"
          >
            Explore launches
          </Link>
        </div>
      </section>

      <div className="mt-12 flex flex-wrap gap-3">
        <Link
          href="/launch"
          className="px-6 py-3 rounded-full bg-vermilion text-paper hover:bg-vermilion-soft transition-colors"
        >
          Launch a token
        </Link>
        <Link
          href="/themes"
          className="px-6 py-3 rounded-full border border-sumi/25 hover:border-vermilion hover:text-vermilion transition-colors"
        >
          Browse themes
        </Link>
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

function Point({ children }: { children: React.ReactNode }) {
  return (
    <li className="border-l-2 border-rule pl-4 leading-relaxed">{children}</li>
  );
}
