/**
 * Which Tokyo-listed companies a JapanPad launch can be denominated in.
 *
 * What is hardcoded here is ONLY the ticker and the theme it files under.
 * Company names, prices, currency and day change are never written down in
 * this repo — they are read live from the quote source at request time. That
 * split is deliberate: a ticker is a stable public identifier that can be
 * checked, whereas a price copied into source is stale the moment it is typed
 * and a company name copied into source is a claim nobody verified.
 *
 * `npm run verify:stocks` resolves every ticker below against the live feed and
 * fails on any that does not answer, so a delisting or a typo surfaces as a
 * build-time error rather than a blank row in the picker.
 *
 * The `.T` suffix is the Tokyo Stock Exchange. Codes are the four-digit TSE
 * securities numbers, not US ADR symbols — this list is the Japanese listing.
 */

import type { Theme } from "../themes";

export interface CatalogEntry {
  /** TSE securities code with exchange suffix, e.g. "7203.T". */
  ticker: string;
  /** Which JapanPad theme this company sits under. */
  themeId: Theme["id"];
}

export const STOCK_CATALOG: readonly CatalogEntry[] = [
  // Automotive
  { ticker: "7203.T", themeId: "automotive" }, // Toyota
  { ticker: "7267.T", themeId: "automotive" }, // Honda
  { ticker: "7201.T", themeId: "automotive" }, // Nissan
  { ticker: "7269.T", themeId: "automotive" }, // Suzuki
  { ticker: "7270.T", themeId: "automotive" }, // Subaru
  { ticker: "7211.T", themeId: "automotive" }, // Mitsubishi Motors
  { ticker: "7202.T", themeId: "automotive" }, // Isuzu
  { ticker: "6902.T", themeId: "automotive" }, // Denso
  { ticker: "5108.T", themeId: "automotive" }, // Bridgestone
  { ticker: "7272.T", themeId: "automotive" }, // Yamaha Motor

  // Gaming
  { ticker: "7974.T", themeId: "gaming" }, // Nintendo
  { ticker: "9766.T", themeId: "gaming" }, // Konami
  { ticker: "9684.T", themeId: "gaming" }, // Square Enix
  { ticker: "9697.T", themeId: "gaming" }, // Capcom
  { ticker: "6460.T", themeId: "gaming" }, // Sega Sammy
  { ticker: "7832.T", themeId: "gaming" }, // Bandai Namco
  { ticker: "3659.T", themeId: "gaming" }, // Nexon

  // Anime, media and entertainment
  { ticker: "9602.T", themeId: "anime" }, // Toho
  { ticker: "9601.T", themeId: "anime" }, // Toei
  { ticker: "4676.T", themeId: "anime" }, // Fuji Media
  { ticker: "4324.T", themeId: "anime" }, // Dentsu
  { ticker: "4816.T", themeId: "anime" }, // Toei Animation
  { ticker: "7867.T", themeId: "anime" }, // Tomy

  // Semiconductors
  { ticker: "8035.T", themeId: "semiconductors" }, // Tokyo Electron
  { ticker: "6857.T", themeId: "semiconductors" }, // Advantest
  { ticker: "4063.T", themeId: "semiconductors" }, // Shin-Etsu Chemical
  { ticker: "6146.T", themeId: "semiconductors" }, // Disco
  { ticker: "6920.T", themeId: "semiconductors" }, // Lasertec
  { ticker: "7735.T", themeId: "semiconductors" }, // Screen Holdings
  { ticker: "3436.T", themeId: "semiconductors" }, // SUMCO
  { ticker: "6723.T", themeId: "semiconductors" }, // Renesas
  { ticker: "6762.T", themeId: "semiconductors" }, // TDK
  { ticker: "6981.T", themeId: "semiconductors" }, // Murata

  // Robotics and industrial
  { ticker: "6954.T", themeId: "robotics" }, // Fanuc
  { ticker: "6861.T", themeId: "robotics" }, // Keyence
  { ticker: "6273.T", themeId: "robotics" }, // SMC
  { ticker: "6301.T", themeId: "robotics" }, // Komatsu
  { ticker: "6367.T", themeId: "robotics" }, // Daikin
  { ticker: "6326.T", themeId: "robotics" }, // Kubota
  { ticker: "7011.T", themeId: "robotics" }, // Mitsubishi Heavy
  { ticker: "7012.T", themeId: "robotics" }, // Kawasaki Heavy
  { ticker: "6841.T", themeId: "robotics" }, // Yokogawa
  { ticker: "6506.T", themeId: "robotics" }, // Yaskawa

  // City, street, transport, retail, finance
  { ticker: "9983.T", themeId: "street" }, // Fast Retailing
  { ticker: "3382.T", themeId: "street" }, // Seven & i
  { ticker: "8267.T", themeId: "street" }, // Aeon
  { ticker: "7532.T", themeId: "street" }, // Pan Pacific / Don Quijote
  { ticker: "9020.T", themeId: "street" }, // JR East
  { ticker: "9022.T", themeId: "street" }, // JR Central
  { ticker: "9201.T", themeId: "street" }, // Japan Airlines
  { ticker: "9202.T", themeId: "street" }, // ANA
  { ticker: "8306.T", themeId: "street" }, // MUFG
  { ticker: "8316.T", themeId: "street" }, // SMFG
  { ticker: "8411.T", themeId: "street" }, // Mizuho
  { ticker: "9984.T", themeId: "street" }, // SoftBank Group
  { ticker: "9432.T", themeId: "street" }, // NTT
  { ticker: "9433.T", themeId: "street" }, // KDDI
  { ticker: "8801.T", themeId: "street" }, // Mitsui Fudosan
  { ticker: "8802.T", themeId: "street" }, // Mitsubishi Estate
  { ticker: "6098.T", themeId: "street" }, // Recruit

  // Food and drink
  { ticker: "2502.T", themeId: "food" }, // Asahi
  { ticker: "2503.T", themeId: "food" }, // Kirin
  { ticker: "2914.T", themeId: "food" }, // Japan Tobacco
  { ticker: "2801.T", themeId: "food" }, // Kikkoman
  { ticker: "2802.T", themeId: "food" }, // Ajinomoto
  { ticker: "2587.T", themeId: "food" }, // Suntory Beverage
  { ticker: "2269.T", themeId: "food" }, // Meiji
  { ticker: "2871.T", themeId: "food" }, // Nichirei
  { ticker: "2897.T", themeId: "food" }, // Nissin Foods

  // Tradition and craft
  { ticker: "7951.T", themeId: "tradition" }, // Yamaha
  { ticker: "4911.T", themeId: "tradition" }, // Shiseido
  { ticker: "4922.T", themeId: "tradition" }, // Kose
  { ticker: "7731.T", themeId: "tradition" }, // Nikon
  { ticker: "7741.T", themeId: "tradition" }, // Hoya
  { ticker: "7751.T", themeId: "tradition" }, // Canon
  { ticker: "6479.T", themeId: "tradition" }, // Minebea Mitsumi
  { ticker: "5947.T", themeId: "tradition" }, // Rinnai

  // Nature and seasons
  { ticker: "4502.T", themeId: "nature" }, // Takeda
  { ticker: "4503.T", themeId: "nature" }, // Astellas
  { ticker: "4519.T", themeId: "nature" }, // Chugai
  { ticker: "4568.T", themeId: "nature" }, // Daiichi Sankyo
  { ticker: "4523.T", themeId: "nature" }, // Eisai
  { ticker: "4901.T", themeId: "nature" }, // Fujifilm
  { ticker: "3407.T", themeId: "nature" }, // Asahi Kasei
  { ticker: "5401.T", themeId: "nature" }, // Nippon Steel
  { ticker: "9501.T", themeId: "nature" }, // TEPCO
  { ticker: "9531.T", themeId: "nature" }, // Tokyo Gas

  // Music and audio
  { ticker: "6758.T", themeId: "music" }, // Sony
  { ticker: "6752.T", themeId: "music" }, // Panasonic
  { ticker: "6501.T", themeId: "music" }, // Hitachi
  { ticker: "6503.T", themeId: "music" }, // Mitsubishi Electric
  { ticker: "6702.T", themeId: "music" }, // Fujitsu
  { ticker: "6701.T", themeId: "music" }, // NEC
  { ticker: "6971.T", themeId: "music" }, // Kyocera
  { ticker: "6594.T", themeId: "music" }, // Nidec
  { ticker: "4751.T", themeId: "music" }, // CyberAgent
] as const;

export const CATALOG_TICKERS: readonly string[] = STOCK_CATALOG.map((e) => e.ticker);

export function catalogEntry(ticker: string): CatalogEntry | null {
  return STOCK_CATALOG.find((e) => e.ticker === ticker) ?? null;
}

/** Whether a ticker is one this app is willing to denominate a launch in. */
export function isCatalogTicker(ticker: string): boolean {
  return STOCK_CATALOG.some((e) => e.ticker === ticker);
}
