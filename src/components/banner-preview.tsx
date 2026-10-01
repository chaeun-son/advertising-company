import { cn } from "@/lib/utils";

type Props = {
  manuscript: string;
  widthCm: number;
  heightCm: number;
  bgColor: string;
  textColor: string;
  className?: string;
  compact?: boolean;
};

function splitLines(manuscript: string): string[] {
  const lines = manuscript
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.length ? lines : ["문구를 넣으면 여기에 보입니다"];
}

export function BannerPreview({
  manuscript,
  widthCm,
  heightCm,
  bgColor,
  textColor,
  className,
  compact,
}: Props) {
  const w = Math.max(widthCm, 1);
  const h = Math.max(heightCm, 1);
  const ratio = w / h;
  const lines = splitLines(manuscript);
  const portrait = ratio < 0.85;
  const longCopy = lines.length >= 4;
  const fontSize = portrait
    ? Math.max(11, 15 - Math.min(lines.length, 6))
    : longCopy
      ? 12
      : Math.max(13, 22 - lines.length * 2);

  return (
    <div className={cn("min-w-0", className)}>
      {!compact && (
        <div className="mb-2 flex items-center justify-between text-[12px] text-muted tabular-nums">
          <span>가로 {w}cm</span>
          <span>세로 {h}cm</span>
        </div>
      )}
      <div
        className={cn(
          "relative mx-auto overflow-hidden rounded-[var(--radius-sm)] shadow-[var(--shadow-border)]",
          portrait ? "max-w-[9.5rem]" : "w-full",
        )}
        style={{
          aspectRatio: portrait ? `${w} / ${h}` : longCopy ? undefined : `${Math.min(Math.max(ratio, 4), 10)} / 1`,
          minHeight: portrait ? undefined : compact ? (longCopy ? 108 : 72) : 88,
          background: bgColor,
          color: textColor,
        }}
      >
        <div className="flex h-full flex-col items-center justify-center gap-0.5 px-3 py-2.5 text-center">
          {lines.map((line, i) => (
            <div
              key={`${i}-${line.slice(0, 16)}`}
              className="max-w-full break-keep font-semibold leading-snug tracking-tight"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: i === 0 ? fontSize : Math.max(10, fontSize - 1),
                opacity: i === 0 ? 1 : 0.9,
              }}
            >
              {line}
            </div>
          ))}
        </div>
      </div>
      {!compact && (
        <p className="mt-2 text-center text-[12px] text-subtle">
          실물 비율 미리보기 · {w} × {h} cm
        </p>
      )}
    </div>
  );
}
