import {
  Circle,
  Grid3x3,
  Hand,
  Hexagon,
  Magnet,
  Minus,
  MousePointer2,
  Pipette,
  Square,
  Type,
} from "lucide-react";
import { useStudio } from "@/lib/studio/store";
import type { EditorTool } from "@/lib/studio/types";

const TOOLS: { id: EditorTool; label: string; key: string; icon: typeof Square }[] = [
  { id: "select", label: "선택", key: "V", icon: MousePointer2 },
  { id: "text", label: "글자", key: "T", icon: Type },
  { id: "rect", label: "네모", key: "M", icon: Square },
  { id: "ellipse", label: "원", key: "O", icon: Circle },
  { id: "line", label: "선", key: "\\", icon: Minus },
  { id: "polygon", label: "다각", key: "P", icon: Hexagon },
  { id: "eyedropper", label: "스포", key: "I", icon: Pipette },
  { id: "pan", label: "손", key: "H", icon: Hand },
];

const SWATCHES = ["#1c2333", "#ffffff", "#b42318", "#1f7a4d", "#c2410c", "#143a5c", "#d4a756", "#111827"];

export function ToolsRail() {
  const tool = useStudio((s) => s.tool);
  const setTool = useStudio((s) => s.setTool);
  const fill = useStudio((s) => s.fill);
  const stroke = useStudio((s) => s.stroke);
  const strokeWidth = useStudio((s) => s.strokeWidth);
  const setDrawStyle = useStudio((s) => s.setDrawStyle);
  const snap = useStudio((s) => s.snap);
  const setSnap = useStudio((s) => s.setSnap);
  const showGrid = useStudio((s) => s.showGrid);
  const setShowGrid = useStudio((s) => s.setShowGrid);

  return (
    <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-border bg-panel p-1.5 max-md:border-b md:h-full md:flex-col md:overflow-y-auto md:border-r">
      {TOOLS.map((t) => {
        const Icon = t.icon;
        const on = tool === t.id;
        return (
          <button
            key={t.id}
            type="button"
            title={`${t.label} (${t.key})`}
            onClick={() => setTool(t.id)}
            className={`inline-flex size-11 shrink-0 flex-col items-center justify-center rounded-md ${
              on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <Icon className="size-4" />
            <span className="mt-0.5 text-[9px] font-bold leading-none">{t.label}</span>
          </button>
        );
      })}
      <div className="mx-1 hidden h-px w-7 bg-border md:block" />
      <label className="inline-flex size-9 shrink-0 items-center justify-center" title="채우기">
        <input
          type="color"
          value={fill.startsWith("#") ? fill : "#1c2333"}
          onChange={(e) => setDrawStyle({ fill: e.target.value })}
          className="size-6 cursor-pointer rounded-sm border border-border bg-transparent p-0"
        />
        <span className="sr-only">채우기</span>
      </label>
      <label className="inline-flex size-9 shrink-0 items-center justify-center" title="선 색">
        <input
          type="color"
          value={stroke.startsWith("#") ? stroke : "#1c2333"}
          onChange={(e) => setDrawStyle({ stroke: e.target.value })}
          className="size-6 cursor-pointer rounded-sm border border-border bg-transparent p-0"
        />
        <span className="sr-only">선 색</span>
      </label>
      <label className="hidden w-9 shrink-0 flex-col items-center md:flex" title="선 두께">
        <span className="text-[9px] font-bold text-muted-foreground">{strokeWidth}</span>
        <input
          type="range"
          min={0}
          max={24}
          value={strokeWidth}
          onChange={(e) => setDrawStyle({ strokeWidth: Number(e.target.value) })}
          className="w-8"
        />
      </label>
      <div className="hidden flex-wrap justify-center gap-0.5 px-1 md:flex">
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            onClick={() => setDrawStyle({ fill: c })}
            className="size-3.5 rounded-sm border border-border"
            style={{ background: c }}
          />
        ))}
      </div>
      <button
        type="button"
        title="격자에 붙이기"
        onClick={() => setSnap(!snap)}
        className={`inline-flex size-9 shrink-0 items-center justify-center rounded-md ${
          snap ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
        }`}
      >
        <Magnet className="size-4" />
        <span className="sr-only">격자 스냅</span>
      </button>
      <button
        type="button"
        title="격자 보기"
        onClick={() => setShowGrid(!showGrid)}
        className={`inline-flex size-9 shrink-0 items-center justify-center rounded-md ${
          showGrid ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
        }`}
      >
        <Grid3x3 className="size-4" />
        <span className="sr-only">격자 보기</span>
      </button>
    </div>
  );
}
