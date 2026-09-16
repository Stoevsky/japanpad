/**
 * Pons v2 — the launchpad JapanPad runs on.
 *
 * ---------------------------------------------------------------------------
 * PROVENANCE AND DRIFT
 * ---------------------------------------------------------------------------
 * Transcribed from stockpad/packages/shared/src/abis/ponsV2Abi.ts, which in
 * turn transcribed it from the published Pons source and then checked every
 * selector against the deployed contract.
 *
 * Pons is not ours and we do not compile it: it pulls in Uniswap v4-core,
 * v4-periphery and permit2, and vendoring that tree to obtain an ABI would mean
 * *our* build decides what Pons's interface is. So these fragments are
 * hand-written, and `npm run verify:pons` is what keeps them honest — it calls
 * every read below against Robinhood Chain and fails if any selector is missing
 * or any decode is inconsistent. Run it after touching this file.
 *
 * Source: github.com/ponsdotdev/ponsfamily, contractsV2/src/v2/
 *   PonsV2LaunchFactory.sol, PonsV2BondingCurve.sol, PonsV2LauncherToken.sol
 *
 * Only the surface JapanPad calls is transcribed. An ABI entry for a function
 * nobody calls is a maintenance cost with no user.
 */

/** `PonsV2LaunchFactory.TokenParams.socials` — five free-text fields. */
const SOCIALS_COMPONENTS = [
  { name: "twitter", type: "string", internalType: "string" },
  { name: "telegram", type: "string", internalType: "string" },
  { name: "discord", type: "string", internalType: "string" },
  { name: "website", type: "string", internalType: "string" },
  { name: "farcaster", type: "string", internalType: "string" },
] as const;

export const ponsV2FactoryAbi = [
  {
    type: "function",
    name: "launchToken",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        internalType: "struct PonsV2LaunchFactory.TokenParams",
        components: [
          { name: "name", type: "string", internalType: "string" },
          { name: "symbol", type: "string", internalType: "string" },
          { name: "logo", type: "string", internalType: "string" },
          { name: "description", type: "string", internalType: "string" },
          {
            name: "socials",
            type: "tuple",
            internalType: "struct PonsV2LauncherToken.Socials",
            components: SOCIALS_COMPONENTS,
          },
          { name: "creatorFeeRecipient", type: "address", internalType: "address" },
          { name: "creatorTaxBps", type: "uint16", internalType: "uint16" },
          { name: "buybackEnabled", type: "bool", internalType: "bool" },
          { name: "expectedEconomics", type: "bytes32", internalType: "bytes32" },
          { name: "salt", type: "bytes32", internalType: "bytes32" },
        ],
      },
      { name: "launchConfigId", type: "uint256", internalType: "uint256" },
      { name: "pairToken", type: "address", internalType: "address" },
    ],
    outputs: [
      { name: "token", type: "address", internalType: "address" },
      { name: "curve", type: "address", internalType: "address" },
    ],
  },
  {
    // Pin these terms into a launch so an owner re-peg cannot land underneath
    // an in-flight transaction. Never encode the digest by hand.
    type: "function",
    name: "previewLaunchEconomics",
    stateMutability: "view",
    inputs: [
      { name: "launchConfigId", type: "uint256", internalType: "uint256" },
      { name: "pairToken", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "", type: "bytes32", internalType: "bytes32" }],
  },
  {
    type: "function",
    name: "getLaunchConfig",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256", internalType: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct IPonsV2LaunchFactory.LaunchConfig",
        components: [
          { name: "supply", type: "uint256", internalType: "uint256" },
          { name: "curveFeeBps", type: "uint256", internalType: "uint256" },
          { name: "phantomQuote", type: "uint256", internalType: "uint256" },
          { name: "graduationThreshold", type: "uint256", internalType: "uint256" },
          { name: "poolFee", type: "uint24", internalType: "uint24" },
          { name: "tickSpacing", type: "int24", internalType: "int24" },
          { name: "enabled", type: "bool", internalType: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getLaunchedToken",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address", internalType: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct IPonsV2LaunchFactory.LaunchedToken",
        components: [
          { name: "token", type: "address", internalType: "address" },
          { name: "curve", type: "address", internalType: "address" },
          { name: "deployer", type: "address", internalType: "address" },
          { name: "creatorFeeRecipient", type: "address", internalType: "address" },
          { name: "pairToken", type: "address", internalType: "address" },
          { name: "graduationThreshold", type: "uint256", internalType: "uint256" },
          { name: "poolFee", type: "uint24", internalType: "uint24" },
          { name: "tickSpacing", type: "int24", internalType: "int24" },
          { name: "creatorTaxBps", type: "uint16", internalType: "uint16" },
          { name: "buybackEnabled", type: "bool", internalType: "bool" },
          // enum GraduationPhase: 0 NotGraduated, then the sweep/seed steps.
          { name: "phase", type: "uint8", internalType: "enum GraduationPhase" },
          { name: "sweptQuote", type: "uint256", internalType: "uint256" },
          { name: "sweptTokens", type: "uint256", internalType: "uint256" },
          { name: "sweptAt", type: "uint256", internalType: "uint256" },
          // False for any address Pons did not launch. Check this before
          // trusting any other field: a struct read for an unknown token
          // decodes fine and is entirely zeroes.
          { name: "exists", type: "bool", internalType: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "canLaunch",
    stateMutability: "view",
    inputs: [{ name: "launcher", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
  },
  {
    type: "function",
    name: "launchFee",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
  },
  {
    type: "function",
    name: "launchEnabled",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
  },
  {
    type: "function",
    name: "launchConfigCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
  },
  {
    type: "event",
    name: "TokenLaunched",
    anonymous: false,
    inputs: [
      { name: "token", type: "address", indexed: true, internalType: "address" },
      { name: "curve", type: "address", indexed: true, internalType: "address" },
      { name: "deployer", type: "address", indexed: true, internalType: "address" },
      { name: "pairToken", type: "address", indexed: false, internalType: "address" },
      { name: "launchConfigId", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "graduationThreshold", type: "uint256", indexed: false, internalType: "uint256" },
    ],
  },

  /*
   * The ways a JapanPad launch can be turned down.
   *
   * These are the errors reachable from the arguments this app actually sends,
   * and they are here so a refusal arrives as a name instead of four bytes of
   * hex. Without them viem has nothing to decode the revert against and the
   * user is shown a raw selector.
   */
  { type: "error", name: "LaunchFeeNotPaid", inputs: [] },
  {
    type: "error",
    name: "LaunchEconomicsMismatch",
    inputs: [
      { name: "expected", type: "bytes32", internalType: "bytes32" },
      { name: "actual", type: "bytes32", internalType: "bytes32" },
    ],
  },
  { type: "error", name: "LaunchConfigDisabled", inputs: [] },
  { type: "error", name: "InvalidLaunchConfigId", inputs: [] },
  { type: "error", name: "InvalidTokenParams", inputs: [] },
  { type: "error", name: "NotWhitelisted", inputs: [] },
  { type: "error", name: "PairTokenNotApproved", inputs: [] },
] as const;

/**
 * One curve per token, deployed alongside it. Every read and write here is
 * addressed to the token's own curve and takes no token argument.
 */
export const ponsV2CurveAbi = [
  {
    // `quoteIn` is the amount in the quote asset. For a native-ETH curve it
    // must equal msg.value; the curve refunds any overpay past the graduation
    // threshold rather than reverting.
    type: "function",
    name: "buy",
    stateMutability: "payable",
    inputs: [
      { name: "quoteIn", type: "uint256", internalType: "uint256" },
      { name: "minTokensOut", type: "uint256", internalType: "uint256" },
      { name: "recipient", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "tokensOut", type: "uint256", internalType: "uint256" }],
  },
  {
    type: "function",
    name: "sell",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokensIn", type: "uint256", internalType: "uint256" },
      { name: "minQuoteOut", type: "uint256", internalType: "uint256" },
      { name: "recipient", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "quoteOut", type: "uint256", internalType: "uint256" }],
  },
  {
    // Both legs include the phantom reserve, so this is the pair to price
    // against — not the contract's ETH balance, which also holds unswept fees.
    type: "function",
    name: "getReserves",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "quoteReserve_", type: "uint256", internalType: "uint256" },
      { name: "tokenReserve_", type: "uint256", internalType: "uint256" },
    ],
  },
  {
    // Reserve minus the phantom leg: what has actually been paid in, and what
    // graduationThreshold is measured against.
    type: "function",
    name: "realQuoteReserve",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
  },
  {
    type: "function",
    name: "sellableTokens",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
  },
  {
    type: "function",
    name: "token",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
  },
  {
    // address(0) means the curve quotes in native ETH.
    type: "function",
    name: "pairToken",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
  },
  {
    type: "function",
    name: "graduated",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
  },
  {
    // True once the threshold is crossed but before the pool is seeded. Selling
    // is already closed in this window even though `graduated` is still false.
    type: "function",
    name: "readyToGraduate",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
  },
  {
    type: "function",
    name: "graduationThreshold",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
  },
  {
    type: "function",
    name: "phantomQuote",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
  },
  {
    /** Protocol trade fee. Pons's own split; not JapanPad's to set. */
    type: "function",
    name: "feeBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
  },
  {
    /** Creator's surcharge on top of feeBps, chosen at launch. */
    type: "function",
    name: "creatorTaxBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
  },
  {
    // Held back for the graduation pool. Not buyable from the curve, so a
    // "how much is left" figure that ignores this overstates the supply.
    type: "function",
    name: "reservedTokens",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
  },
  {
    type: "event",
    name: "CurveBuy",
    anonymous: false,
    inputs: [
      { name: "buyer", type: "address", indexed: true, internalType: "address" },
      { name: "recipient", type: "address", indexed: true, internalType: "address" },
      { name: "quoteIn", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "tokensOut", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "fee", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "tax", type: "uint256", indexed: false, internalType: "uint256" },
    ],
  },
  {
    type: "event",
    name: "CurveSell",
    anonymous: false,
    inputs: [
      { name: "seller", type: "address", indexed: true, internalType: "address" },
      { name: "recipient", type: "address", indexed: true, internalType: "address" },
      { name: "tokensIn", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "quoteOut", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "fee", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "tax", type: "uint256", indexed: false, internalType: "uint256" },
    ],
  },
  {
    // Emitted when a buy runs past the curve's last sellable token and the
    // overpay is handed back. The trade panel names this rather than letting a
    // user wonder why they were charged less than they offered.
    type: "event",
    name: "CurveBuyRefunded",
    anonymous: false,
    inputs: [
      { name: "buyer", type: "address", indexed: true, internalType: "address" },
      { name: "amount", type: "uint256", indexed: false, internalType: "uint256" },
    ],
  },

  /*
   * The ways the curve refuses a trade.
   *
   * Transcribed from PonsV2BondingCurve.sol so viem can decode a revert into a
   * name. Without them a user who tried to sell into a graduating curve is
   * shown four bytes of hex.
   */
  {
    type: "error",
    name: "SlippageExceeded",
    inputs: [
      { name: "actual", type: "uint256", internalType: "uint256" },
      { name: "minimum", type: "uint256", internalType: "uint256" },
    ],
  },
  { type: "error", name: "CurveGraduated", inputs: [] },
  { type: "error", name: "ZeroAmount", inputs: [] },
  { type: "error", name: "ZeroAddress", inputs: [] },
  {
    // `buy` requires msg.value to equal `quoteIn` to the wei on a native-quote
    // curve — see PonsV2BondingCurve._receiveQuote.
    type: "error",
    name: "NativeValueMismatch",
    inputs: [
      { name: "sent", type: "uint256", internalType: "uint256" },
      { name: "expected", type: "uint256", internalType: "uint256" },
    ],
  },
  { type: "error", name: "UnexpectedNativeValue", inputs: [] },
  { type: "error", name: "TransferFailed", inputs: [] },
] as const;

/** The launch token itself. Standard ERC-20 plus Pons's metadata reads. */
export const ponsV2TokenAbi = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string", internalType: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string", internalType: "string" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8", internalType: "uint8" }],
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
  },
  {
    // Selling means letting the curve pull tokens with `transferFrom`, so the
    // holder has to approve it first. Approved for exactly the sale amount, not
    // unlimited — an allowance that outlives the trade leaves the curve able to
    // move these tokens forever.
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address", internalType: "address" },
      { name: "value", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address", internalType: "address" },
      { name: "spender", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
  },
  {
    /** Attribution only. Confers no privilege over the token. */
    type: "function",
    name: "deployer",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
  },
  {
    type: "function",
    name: "curve",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
  },
  {
    type: "function",
    name: "logo",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string", internalType: "string" }],
  },
  {
    type: "function",
    name: "description",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string", internalType: "string" }],
  },
  {
    type: "function",
    name: "socials",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "twitter", type: "string", internalType: "string" },
      { name: "telegram", type: "string", internalType: "string" },
      { name: "discord", type: "string", internalType: "string" },
      { name: "website", type: "string", internalType: "string" },
      { name: "farcaster", type: "string", internalType: "string" },
    ],
  },
] as const;
