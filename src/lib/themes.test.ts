import { describe, expect, it } from "vitest";
import { THEMES, getTheme, themeMetadata } from "./themes";

describe("themeMetadata", () => {
  it("titles a known theme with its own name", () => {
    expect(themeMetadata("gaming").title).toBe("Gaming — JapanPad");
  });

  it("uses the theme description as the meta description", () => {
    const theme = getTheme("gaming");
    expect(themeMetadata("gaming").description).toBe(theme?.description);
  });

  /**
   * Every theme page was rendering under the root layout's title, which is the
   * homepage's. Ten distinct pages sharing one title is wrong in a link
   * preview and wrong in a tab strip, so this asserts they are all distinct
   * rather than just spot-checking one.
   */
  it("gives every theme a distinct title", () => {
    const titles = THEMES.map((t) => themeMetadata(t.id).title);
    expect(new Set(titles).size).toBe(THEMES.length);
  });

  it("never returns the bare site title for a real theme", () => {
    for (const t of THEMES) {
      expect(themeMetadata(t.id).title).not.toBe("JapanPad");
      expect(themeMetadata(t.id).title).toContain(t.name);
    }
  });

  /**
   * The page calls notFound() for an unknown id, but generateMetadata runs
   * first and must not throw on its way there.
   */
  it("falls back without throwing on an unknown id", () => {
    expect(() => themeMetadata("not-a-theme")).not.toThrow();
    expect(themeMetadata("not-a-theme").title).toBe("Themes — JapanPad");
  });
});
