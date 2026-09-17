import { THEMES } from "@/lib/themes";
import { listLaunches } from "@/lib/pons/read";
import { ThemeCard } from "@/components/ThemeCard";
import { PageHeader } from "@/components/PageHeader";

export const revalidate = 60;

export const metadata = {
  title: "Themes — JapanPad",
  description: "The categories a JapanPad launch can be filed under.",
};

export default async function Themes() {
  const { launches, complete } = await listLaunches({ limit: 200 });

  const counts = new Map<string, number>();
  if (complete) {
    for (const l of launches) counts.set(l.themeId, (counts.get(l.themeId) ?? 0) + 1);
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <PageHeader jp="テーマ" title="Themes">
        A theme is how a launch files itself for discovery. It is cultural, not
        financial — it references no company and carries no market linkage.
      </PageHeader>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {THEMES.map((t) => (
          <ThemeCard
            key={t.id}
            theme={t}
            count={complete ? (counts.get(t.id) ?? 0) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
