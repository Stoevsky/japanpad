# JapanPad

A Japan-themed token launchpad on Robinhood Chain, built as an interface layer
over the Pons V2 protocol.

JapanPad does not implement a launch protocol. Pons does that — the bonding
curve, the graduation into a permanently locked Uniswap v4 pool, the fees. This
repo is discovery, presentation, and transaction assembly on top of it.

## What this is not

Worth stating up front, because the name invites the wrong assumption.

**JapanPad has nothing to do with Robinhood Stock Tokens.** The original plan was
to pair each launch with a Japanese Stock Token. That premise was checked against
the live registry before any of it was built, and it does not hold: chain 4663
carries 194 active assets and **zero** with a JP ISIN. There is no Japanese Stock
Token to pair with.

So the Japan here is cultural and nothing more. Themes are gardens, craft,
folklore, food. Every curve is quoted in ETH. Nowhere does this site claim a
token is "paired" with a stock, because at the protocol level it would not be
true.

**JapanPad reviews nothing and endorses nothing.** Anyone can launch anything.
The Garden is deliberately not a leaderboard — a ranked list reads as a
recommendation no matter how it is captioned.

## Running it

```bash
npm install
cp .env.example .env.local   # then read it; the comments matter
npm run dev
```

Defaults to **testnet**. Mainnet is opt-in and requires setting the network
explicitly — see `.env.example`.

### Both network variables, always

`JAPANPAD_NETWORK` and `NEXT_PUBLIC_JAPANPAD_NETWORK` must both be set, to the
same value. Next only exposes `NEXT_PUBLIC_*` to the browser, so setting the
server one alone gives you a server rendering mainnet and a browser resolving
testnet. The app refuses to boot rather than let that happen.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on :3500 |
| `npm run build` | Production build |
| `npm test` | Unit tests (vitest) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run verify:pons` | **Checks this repo's assumptions against the live chain** |

### `verify:pons` is the important one

Every Pons value this app depends on is owner-mutable: the launch fee, the curve
fee, the graduation threshold, the supply, whether launching is enabled at all.
`verify:pons` reads them off the live chain and fails loudly when they have
drifted from what the code assumes.

Run it before a deploy. It hits the real network, so it can fail for reasons
that have nothing to do with your change — read the output rather than just the
exit code.

## Tests

Unit tests only, over pure functions: formatting, parsing, env-var guards, and
error classification. Nothing here touches the network — a test that depends on
a live RPC fails for reasons unrelated to the code. Live-chain checking is
`verify:pons`, which is a separate thing with a separate purpose.

## Architecture notes

- **`src/lib/chain.ts`** — the only place that knows a chain id, RPC, or explorer
  URL. Unrecognised environments resolve to testnet rather than guessing.
- **`src/lib/pons/read.ts`** — `server-only`, holds the indexer.
- **`src/lib/pons/client.ts`** — the read-only chain client, usable from both
  sides. Split out of `read.ts` precisely because the browser genuinely needs to
  read the chain: a quote is only true for the block it was read at.
- **`src/lib/pons/quote.ts`** — quotes by **simulating the real call**, not by
  reimplementing the curve maths. Pons has no quoter and its pricing library is
  `internal`, so it is inlined into bytecode with no address to call. Simulation
  also gets the partial-fill clamp right for free, which local arithmetic would
  not: an offer of 500 ETH against a nearly-full curve spends ~4.24 and refunds
  the rest.
- **`src/lib/pons/tag.ts`** — theme metadata rides in a description trailer,
  `[JapanPad] theme:<id>`. This is forgeable. Anyone can put that string in a
  Pons launch and appear here. It is accepted as a cosmetic tag and nothing is
  built on top of it.

### Only ETH-quoted curves

Pons supports ERC-20 quote assets. JapanPad lists only native-ETH curves, and
both `listLaunches` and `getLaunch` check `pairToken()` to enforce it.

This is not theoretical. A live Pons curve on chain 4663 rejects every ETH buy
with `UnexpectedNativeValue` because it is quoted in an ERC-20. Since the theme
tag is forgeable, such a curve could carry it — and we would have labelled its
reserves "ETH" and offered buys that always revert.

### Missing vs unavailable

`getLaunch` returns `ok` / `missing` / `unavailable`, and the distinction is
enforced rather than decorative. A 404 is a claim about the chain, and an
unanswered RPC call is not grounds for making it. Telling a holder mid-sell that
their token does not exist, because a node timed out, is a fabricated statement.

### The display font is vendored, deliberately

`src/app/fonts/` holds four Shippori Mincho `.woff2` files (113 KB total) loaded
through `next/font/local`. They are checked in rather than pulled via
`next/font/google`, and this is a build correctness fix rather than a preference.

`next/font/google` selects subsets by reading the `/* latin */` comment Google
emits above each `@font-face` block. Google's stylesheet for Shippori Mincho has
**488** `@font-face` rules, of which **8** carry that marker and the other 480
carry no subset comment at all. So `subsets: ["latin"]` matches nothing to
exclude, and next/font tries to download and self-host all 488 — several
megabytes of kana and kanji, at build time, over the network, to render English
headings. That is what made `next build` fail here, and the failure presents as
a TLS socket error, which reads like a sandbox network problem and is not one.

Vendoring the four Latin files removes the build-time dependency on Google
entirely, so `next build` works offline. Shippori Mincho is SIL OFL 1.1, which
permits this; the licence travels with the files at `src/app/fonts/OFL.txt`.

Japanese glyphs were never coming from this font — the Latin subset has no kana.
They resolve through the `.jp` stack in `globals.css` to Hiragino Mincho on macOS
and Yu Mincho on Windows, both already on the machine.

## Before deploying

- [ ] `npm test`, `npm run typecheck`, `npm run lint`
- [ ] `npm run verify:pons` against the target network
- [ ] Both network variables set, to the same value
- [ ] `NEXT_PUBLIC_RPC_URL` is **not** an authenticated endpoint — it ships in
      the bundle by definition. Use `JAPANPAD_RPC_URL` for a private one.
- [ ] Walk the wallet paths in a real browser (see below)

### The gap you should know about

Some of this has now been exercised in a real browser against mainnet, and some
of it has not. The distinction matters, so it is spelled out rather than
summarised.

**Verified in Chrome against mainnet:** `/`, `/explore`, `/garden`,
`/how-it-works`, `/themes/:id`, and the `missing` branch of `/token/:address`
all render. `WalletProvider` and `LaunchFlow` mount and hydrate with an empty
console. The launch wizard advances through all three steps, and step 3 reads
the launch fee **from the chain in the browser** — it showed 0.0005 ETH, which
is the live value. That read is the thing worth noting: it means the
client-side viem transport works, not just the server's.

**Still never executed:** `TradePanel` has not mounted, because it only renders
on a token page for a real JapanPad-tagged ETH-quoted launch and none exists.
Nothing downstream of it — the quote simulation in the browser, the buy and sell
paths, approval — has run. And **no transaction has ever been signed by this app
on any chain.** The flow has only ever been walked up to the point where it says
"Connect a wallet to sign this."

There is no verified Pons testnet deployment to rehearse against, so the only
venue is a deliberate small-value mainnet launch. Do that before trusting any of
the signing paths, and note that it is also the only way to get a token page
that renders at all — which is what unblocks testing `TradePanel`.
