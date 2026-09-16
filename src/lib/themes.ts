/**
 * JapanPad's theme taxonomy — what a creator picks instead of a stock.
 *
 * The original design had this list mirroring Japanese equity sectors, with a
 * creator choosing Toyota or Sony and the coin denominated in that Stock Token.
 * That is not buildable: the Robinhood Stock Token registry at /rhj/assets
 * carries 194 active assets on chain 4663 and zero with a JP ISIN — no Toyota,
 * no Sony, no Nintendo, not even a Japan ETF. Building the sector list anyway
 * would have meant naming companies that have no token behind them.
 *
 * So a theme here is cultural, not financial. It references no company, claims
 * no market linkage, and nothing downstream reads a price from it. It is a
 * category for discovery and a colour in the Garden, and that is all it is.
 */

export interface Theme {
  id: string;
  name: string;
  /** Rendered alongside the English name. Real Japanese, not transliteration. */
  japaneseName: string;
  description: string;
  /** Drives the accent on cards and the plant colour in the Garden. */
  accent: string;
}

export const THEMES: readonly Theme[] = [
  {
    id: "street",
    name: "City & Street",
    japaneseName: "街",
    description: "Neon, convenience stores, the last train, and everything after it.",
    accent: "#A82632",
  },
  {
    id: "anime",
    name: "Anime & Manga",
    japaneseName: "アニメ",
    description: "Frames, panels, and the characters that escaped them.",
    accent: "#DFA6AF",
  },
  {
    id: "gaming",
    name: "Gaming",
    japaneseName: "ゲーム",
    description: "Arcades, handhelds, and four decades of Japanese play.",
    accent: "#7A5C9E",
  },
  {
    id: "automotive",
    name: "Automotive",
    japaneseName: "自動車",
    description: "Touge runs, kei trucks, and the engineering underneath.",
    accent: "#2F6F8F",
  },
  {
    id: "robotics",
    name: "Robotics",
    japaneseName: "ロボット",
    description: "Factory arms, companion machines, and the mecha canon.",
    accent: "#5E7A6B",
  },
  {
    id: "semiconductors",
    name: "Semiconductors",
    japaneseName: "半導体",
    description: "Wafers, lithography, and the quiet industry behind the rest.",
    accent: "#8A7770",
  },
  {
    id: "food",
    name: "Food & Drink",
    japaneseName: "食",
    description: "Ramen counters, izakaya, matcha, and convenience-store coffee.",
    accent: "#C8A35D",
  },
  {
    id: "tradition",
    name: "Tradition & Craft",
    japaneseName: "伝統",
    description: "Ceramics, joinery, indigo, and the people still making them.",
    accent: "#6B4F3F",
  },
  {
    id: "nature",
    name: "Nature & Seasons",
    japaneseName: "自然",
    description: "Sakura, snow country, the mountains, and the sea between.",
    accent: "#7C9A6D",
  },
  {
    id: "music",
    name: "Music",
    japaneseName: "音楽",
    description: "City pop, noise, idol, and whatever Shibuya is playing now.",
    accent: "#B5654A",
  },
] as const;

const BY_ID = new Map(THEMES.map((t) => [t.id, t]));

export function getTheme(id: string): Theme | null {
  return BY_ID.get(id) ?? null;
}

export function isThemeId(id: string): boolean {
  return BY_ID.has(id);
}

/**
 * Title and description for a theme page.
 *
 * Lives here rather than inline in the route because the route imports the
 * `server-only` indexer, which makes it unimportable from a unit test. The
 * ten theme pages were otherwise inheriting the root layout's title — the
 * homepage's — so every one of them shared a tab name and a link preview.
 *
 * An unknown id falls back instead of throwing: the page calls notFound() for
 * that case, but generateMetadata runs before it gets the chance.
 */
export function themeMetadata(id: string): {
  title: string;
  description: string;
} {
  const theme = BY_ID.get(id);
  if (!theme) {
    return {
      title: "Themes — JapanPad",
      description: "Japanese cultural themes on JapanPad.",
    };
  }
  return {
    title: `${theme.name} — JapanPad`,
    description: theme.description,
  };
}
