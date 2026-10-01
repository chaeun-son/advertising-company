import type { Draft } from "@/lib/studio/types";
import { LayerView } from "./layer-view";

export function DraftCanvas({
  draft,
  selectedId,
  onSelect,
  showSafe = true,
}: {
  draft: Draft;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  showSafe?: boolean;
}) {
  const m = Math.max(8, Math.min(draft.width, draft.height) * 0.04);
  return (
    <svg
      viewBox={`0 0 ${draft.width} ${draft.height}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      onClick={() => onSelect(null)}
      role="img"
      aria-label={`${draft.letter}안 ${draft.title}`}
    >
      <defs>
        {draft.layers
          .filter((l) => l.type === "image")
          .map((l) => (
            <clipPath id={`img-${l.id}`} key={l.id}>
              <rect x={l.x} y={l.y} width={l.w} height={l.h} />
            </clipPath>
          ))}
      </defs>
      {draft.layers.map((layer) => (
        <g
          key={layer.id}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(layer.id);
          }}
        >
          <LayerView layer={layer} />
          {selectedId === layer.id ? (
            <rect
              x={layer.x}
              y={layer.y}
              width={layer.w}
              height={layer.h}
              fill="none"
              stroke="var(--bleed)"
              strokeWidth={Math.max(2, layer.w * 0.004)}
              strokeDasharray="6 4"
              pointerEvents="none"
            />
          ) : null}
        </g>
      ))}
      {showSafe ? (
        <rect
          x={m}
          y={m}
          width={draft.width - m * 2}
          height={draft.height - m * 2}
          fill="none"
          stroke="var(--safe)"
          strokeOpacity="0.45"
          strokeWidth={Math.max(1, draft.width * 0.0015)}
          strokeDasharray="8 6"
          pointerEvents="none"
        />
      ) : null}
    </svg>
  );
}
