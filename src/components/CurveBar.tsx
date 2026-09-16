export function CurveBar({
  progress,
  accent,
  height = 6,
}: {
  progress: number;
  accent?: string;
  height?: number;
}) {
  const pct = Math.min(100, Math.max(0, progress * 100));
  return (
    <div
      className="w-full rounded-full bg-rule/60 overflow-hidden"
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Bonding curve progress toward graduation"
    >
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{
          width: `${pct}%`,
          backgroundColor: accent ?? "var(--color-vermilion)",
        }}
      />
    </div>
  );
}
