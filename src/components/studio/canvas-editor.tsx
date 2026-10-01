import { useEffect, useRef, useState } from "react";
import {
  clientToSvg,
  GRID,
  handlePositions,
  hitTest,
  normalizeRect,
  resizeByHandle,
  snapNum,
  type HandleId,
} from "@/lib/studio/geom";
import { fittedImageBox, focalCoverBox, imageDimensions } from "@/lib/studio/image-fit";
import { useStudio } from "@/lib/studio/store";
import type { ImageLayer, Layer, ShapeKind } from "@/lib/studio/types";
import { LayerView } from "./layer-view";

type Drag =
  | { kind: "move"; id: string; ox: number; oy: number; lx: number; ly: number }
  | { kind: "resize"; id: string; handle: HandleId }
  | { kind: "draw"; tool: ShapeKind; x: number; y: number }
  | { kind: "pan"; x: number; y: number; px: number; py: number }
  | { kind: "focus"; id: string; x: number; y: number };

export function CanvasEditor() {
  const drafts = useStudio((s) => s.drafts);
  const activeId = useStudio((s) => s.activeId);
  const selectedLayerId = useStudio((s) => s.selectedLayerId);
  const setSelectedLayer = useStudio((s) => s.setSelectedLayer);
  const tool = useStudio((s) => s.tool);
  const zoom = useStudio((s) => s.zoom);
  const setZoom = useStudio((s) => s.setZoom);
  const patchLayer = useStudio((s) => s.patchLayer);
  const addShape = useStudio((s) => s.addShape);
  const addTextAt = useStudio((s) => s.addTextAt);
  const setTool = useStudio((s) => s.setTool);
  const setDrawStyle = useStudio((s) => s.setDrawStyle);
  const checkpoint = useStudio((s) => s.checkpoint);
  const fill = useStudio((s) => s.fill);
  const stroke = useStudio((s) => s.stroke);
  const strokeWidth = useStudio((s) => s.strokeWidth);
  const snap = useStudio((s) => s.snap);
  const showGrid = useStudio((s) => s.showGrid);
  const showSafeArea = useStudio((s) => s.showSafeArea);
  const editingTextId = useStudio((s) => s.editingTextId);
  const setEditingText = useStudio((s) => s.setEditingText);
  const pickingFocus = useStudio((s) => s.pickingFocus);
  const setPickingFocus = useStudio((s) => s.setPickingFocus);

  const draft = drafts.find((d) => d.id === activeId) ?? drafts[0];
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [space, setSpace] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpace(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpace(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  if (!draft) return null;

  const selected = draft.layers.find((l) => l.id === selectedLayerId) ?? null;
  const handleSize = Math.max(8, Math.min(draft.width, draft.height) * 0.012);
  const panning = tool === "pan" || space;

  function pt(e: { clientX: number; clientY: number }) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    return clientToSvg(svg, e.clientX, e.clientY);
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (!draft) return;
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
    const p = pt(e);

    if (panning || e.button === 1) {
      setDrag({ kind: "pan", x: e.clientX, y: e.clientY, px: pan.x, py: pan.y });
      return;
    }

    if (tool === "eyedropper") {
      const hit = hitTest(draft.layers, p.x, p.y, { includeLocked: true });
      const color =
        hit && "fill" in hit && typeof hit.fill === "string" && hit.fill.startsWith("#")
          ? hit.fill
          : null;
      if (color) setDrawStyle({ fill: color });
      if (selected && color) patchLayer(selected.id, { fill: color } as Partial<Layer>);
      setTool("select");
      return;
    }

    if (tool === "text") {
      addTextAt(snapNum(p.x, snap), snapNum(p.y, snap));
      return;
    }

    if (tool === "rect" || tool === "ellipse" || tool === "line" || tool === "polygon") {
      setDrag({ kind: "draw", tool, x: p.x, y: p.y });
      return;
    }

    if (pickingFocus && selected?.type === "image") {
      checkpoint();
      setDrag({ kind: "focus", id: selected.id, x: p.x, y: p.y });
      return;
    }

    if (selected && !selected.locked) {
      const handles = handlePositions(selected, handleSize);
      const hitHandle = handles.find((h) => Math.hypot(h.x - p.x, h.y - p.y) <= handleSize * 1.6);
      if (hitHandle) {
        checkpoint();
        setDrag({ kind: "resize", id: selected.id, handle: hitHandle.id });
        return;
      }
    }

    const hit = hitTest(draft.layers, p.x, p.y);
    if (hit) {
      setSelectedLayer(hit.id);
      checkpoint();
      setDrag({ kind: "move", id: hit.id, ox: p.x, oy: p.y, lx: hit.x, ly: hit.y });
    } else {
      setSelectedLayer(null);
    }
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!drag || !draft) return;
    const p = pt(e);
    if (drag.kind === "pan") {
      setPan({
        x: drag.px + (e.clientX - drag.x),
        y: drag.py + (e.clientY - drag.y),
      });
      return;
    }
    if (drag.kind === "move") {
      patchLayer(drag.id, {
        x: snapNum(drag.lx + (p.x - drag.ox), snap),
        y: snapNum(drag.ly + (p.y - drag.oy), snap),
      });
      return;
    }
    if (drag.kind === "focus") {
      const layer = draft.layers.find((item) => item.id === drag.id);
      if (!layer || layer.type !== "image") return;
      const rect = normalizeRect(drag.x, drag.y, p.x - drag.x, p.y - drag.y);
      patchLayer(drag.id, { focus: layerRectToFocus(layer, rect), protectMode: "manual", fit: layer.fit === "contain" ? "cover" : layer.fit });
      return;
    }
    if (drag.kind === "resize") {
      const layer = draft.layers.find((l) => l.id === drag.id);
      if (!layer) return;
      const nx = snapNum(p.x, snap && drag.handle !== "rot");
      const ny = snapNum(p.y, snap && drag.handle !== "rot");
      patchLayer(drag.id, resizeByHandle(layer, drag.handle, nx, ny, e.shiftKey));
    }
  }

  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    if (drag?.kind === "focus") setPickingFocus(false);
    if (drag?.kind === "draw") {
      const p = pt(e);
      const box = normalizeRect(drag.x, drag.y, p.x - drag.x, p.y - drag.y);
      if (box.w < 4 && box.h < 4) {
        box.w = 80;
        box.h = 80;
      }
      if (drag.tool === "line") {
        addShape("line", {
          x: snapNum(drag.x, snap),
          y: snapNum(drag.y, snap),
          w: snapNum(p.x, snap) - snapNum(drag.x, snap),
          h: snapNum(p.y, snap) - snapNum(drag.y, snap),
        });
      } else {
        addShape(drag.tool, {
          x: snapNum(box.x, snap),
          y: snapNum(box.y, snap),
          w: Math.max(4, snapNum(box.w, snap)),
          h: Math.max(4, snapNum(box.h, snap)),
        });
      }
    }
    setDrag(null);
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const next = zoom * (e.deltaY > 0 ? 0.92 : 1.08);
    setZoom(next);
  }

  const cursor =
    panning || drag?.kind === "pan"
      ? "grab"
      : tool === "text"
        ? "text"
        : tool === "eyedropper"
          ? "crosshair"
          : tool === "select"
            ? "default"
            : "crosshair";

  return (
    <div
      className="relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden"
      onWheel={onWheel}
    >
      <div className="reference-ruler-top">{draft.width / 10}cm (실제 크기 비율)</div>
      <div className="reference-ruler-side">{draft.height / 10}cm</div>
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "center center",
        }}
        className="flex h-full w-full items-center justify-center"
      >
        <div
          className="overflow-hidden rounded-sm bg-card shadow-[0_20px_50px_-28px_rgba(20,24,32,0.55)] ring-1 ring-border"
          style={{
            aspectRatio: `${draft.width} / ${draft.height}`,
            width: draft.width >= draft.height ? "min(94%, 1180px)" : "min(72%, 520px)",
            maxHeight: "88%",
          }}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${draft.width} ${draft.height}`}
            className="h-full w-full touch-none"
            preserveAspectRatio="xMidYMid meet"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => setDrag(null)}
            onDoubleClick={(e) => {
              const p = pt(e);
              if (selected && !selected.locked) {
                const rotHandle = handlePositions(selected, handleSize).find((h) => h.id === "rot");
                if (rotHandle && Math.hypot(rotHandle.x - p.x, rotHandle.y - p.y) <= handleSize * 2) {
                  checkpoint();
                  patchLayer(selected.id, { rotation: 0 });
                  return;
                }
              }
              const hit = hitTest(draft.layers, p.x, p.y, { includeLocked: true });
              if (hit?.type === "text" && !hit.locked) {
                setSelectedLayer(hit.id);
                setEditingText(hit.id);
              }
            }}
            style={{ cursor }}
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
              <LayerView key={layer.id} layer={layer} />
            ))}

            {showGrid ? <ArtboardGrid width={draft.width} height={draft.height} /> : null}
            {showSafeArea ? (
              <g pointerEvents="none" aria-label="인쇄 안전영역">
                <rect x={draft.width * 0.025} y={draft.height * 0.06} width={draft.width * 0.95} height={draft.height * 0.88} fill="none" stroke="var(--safe)" strokeWidth={Math.max(1, draft.width * 0.0012)} strokeDasharray="10 7" opacity={0.8} />
                <rect x={draft.width * 0.01} y={draft.height * 0.025} width={draft.width * 0.98} height={draft.height * 0.95} fill="none" stroke="var(--bleed)" strokeWidth={Math.max(0.8, draft.width * 0.0008)} strokeDasharray="4 6" opacity={0.45} />
              </g>
            ) : null}

            {drag?.kind === "draw" ? (
              <DrawPreview drag={drag} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
            ) : null}

            {selected && selected.type === "image" && selected.focus ? (
              <FocusOutline layer={selected} width={draft.width} />
            ) : null}

            {selected && !selected.hidden ? (
              <g pointerEvents="none">
                <rect
                  x={selected.x}
                  y={selected.y}
                  width={selected.w}
                  height={selected.h}
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth={Math.max(1.5, draft.width * 0.0018)}
                  strokeDasharray="8 5"
                  transform={
                    selected.rotation
                      ? `rotate(${selected.rotation} ${selected.x + selected.w / 2} ${selected.y + selected.h / 2})`
                      : undefined
                  }
                />
                {handlePositions(selected, handleSize).map((h) =>
                  h.id === "rot" ? (
                    <g key={h.id}>
                      <line
                        x1={selected.x + selected.w / 2}
                        y1={selected.y}
                        x2={h.x}
                        y2={h.y}
                        stroke="var(--primary)"
                        strokeWidth={1.5}
                      />
                      <circle cx={h.x} cy={h.y} r={handleSize * 0.7} fill="var(--card)" stroke="var(--primary)" strokeWidth={2} />
                    </g>
                  ) : (
                    <rect
                      key={h.id}
                      x={h.x - handleSize / 2}
                      y={h.y - handleSize / 2}
                      width={handleSize}
                      height={handleSize}
                      fill="var(--card)"
                      stroke="var(--primary)"
                      strokeWidth={2}
                    />
                  ),
                )}
              </g>
            ) : null}

            {editingTextId && selected?.type === "text" && selected.id === editingTextId ? (
              <foreignObject x={selected.x} y={selected.y} width={Math.max(80, selected.w)} height={Math.max(40, selected.h)}>
                <input
                  autoFocus
                  value={selected.text}
                  onChange={(e) => patchLayer(selected.id, { text: e.target.value })}
                  onBlur={() => setEditingText(null)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      setEditingText(null);
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setEditingText(null);
                    }
                  }}
                  style={{
                    width: "100%",
                    height: "100%",
                    border: "none",
                    outline: "2px solid var(--bleed)",
                    background: "color-mix(in oklab, var(--card) 88%, transparent)",
                    color: selected.fill,
                    fontFamily: selected.fontFamily,
                    fontSize: `${Math.max(12, selected.fontSize * 0.35)}px`,
                    fontWeight: selected.fontWeight,
                    padding: "4px 8px",
                  }}
                />
              </foreignObject>
            ) : null}
          </svg>
        </div>
      </div>
    </div>
  );
}

function ArtboardGrid({ width, height }: { width: number; height: number }) {
  const lines = [];
  for (let x = 0; x <= width; x += GRID) {
    lines.push(
      <line key={`v${x}`} x1={x} y1={0} x2={x} y2={height} stroke="var(--bleed)" strokeWidth={x % (GRID * 5) === 0 ? 0.8 : 0.35} opacity={0.28} />,
    );
  }
  for (let y = 0; y <= height; y += GRID) {
    lines.push(
      <line key={`h${y}`} x1={0} y1={y} x2={width} y2={y} stroke="var(--bleed)" strokeWidth={y % (GRID * 5) === 0 ? 0.8 : 0.35} opacity={0.28} />,
    );
  }
  return <g pointerEvents="none">{lines}</g>;
}

function layerRectToFocus(layer: ImageLayer, rect: { x: number; y: number; w: number; h: number }) {
  const size = imageDimensions(layer) ?? { width: layer.w, height: layer.h };
  const box = layer.focus && layer.fit !== "contain" && layer.fit !== "responsive"
    ? focalCoverBox(layer, size.width, size.height)
    : fittedImageBox(layer, size.width, size.height);
  const x = Math.min(1, Math.max(0, (rect.x - box.x) / box.w));
  const y = Math.min(1, Math.max(0, (rect.y - box.y) / box.h));
  const w = Math.min(1 - x, Math.max(0.05, rect.w / box.w));
  const h = Math.min(1 - y, Math.max(0.05, rect.h / box.h));
  return { x, y, w, h };
}

function FocusOutline({ layer, width }: { layer: ImageLayer; width: number }) {
  if (!layer.focus) return null;
  const size = imageDimensions(layer) ?? { width: layer.w, height: layer.h };
  const box = layer.fit === "contain" ? fittedImageBox(layer, size.width, size.height) : focalCoverBox(layer, size.width, size.height);
  const x = box.x + layer.focus.x * box.w;
  const y = box.y + layer.focus.y * box.h;
  const w = layer.focus.w * box.w;
  const h = layer.focus.h * box.h;
  return <rect x={x} y={y} width={w} height={h} fill="none" stroke="#ff4d4f" strokeWidth={Math.max(1.5, width * 0.002)} strokeDasharray="6 4" pointerEvents="none" />;
}

function DrawPreview({
  drag,
  fill,
  stroke,
  strokeWidth,
}: {
  drag: Extract<Drag, { kind: "draw" }>;
  fill: string;
  stroke: string;
  strokeWidth: number;
}) {
  const [now, setNow] = useState({ x: drag.x, y: drag.y });
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const svg = document.querySelector("svg[role='img']") as SVGSVGElement | null;
      if (!svg) return;
      setNow(clientToSvg(svg, e.clientX, e.clientY));
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, []);
  const box = normalizeRect(drag.x, drag.y, now.x - drag.x, now.y - drag.y);
  if (drag.tool === "line") {
    return (
      <line
        x1={drag.x}
        y1={drag.y}
        x2={now.x}
        y2={now.y}
        stroke={stroke}
        strokeWidth={strokeWidth}
        opacity={0.7}
      />
    );
  }
  if (drag.tool === "ellipse") {
    return (
      <ellipse
        cx={box.x + box.w / 2}
        cy={box.y + box.h / 2}
        rx={box.w / 2}
        ry={box.h / 2}
        fill={fill}
        fillOpacity={0.35}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    );
  }
  return (
    <rect
      x={box.x}
      y={box.y}
      width={box.w}
      height={box.h}
      fill={fill}
      fillOpacity={0.35}
      stroke={stroke}
      strokeWidth={strokeWidth}
    />
  );
}
