import { FONTS } from "@/lib/studio/catalog";
import { layerName } from "@/lib/studio/geom";
import { detectSubject } from "@/lib/studio/subject-focus";
import { editImage, type ImageEditKind } from "@/lib/studio/image-edit";
import { useStudio } from "@/lib/studio/store";
import type { Align, Layer, ShapeLayer, TextLayer } from "@/lib/studio/types";
import { AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, ClipboardCopy, ClipboardPaste, Copy, Eye, EyeOff, FlipHorizontal, FlipVertical, Lock, LockOpen, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";

const inputClass =
  "h-8 w-full rounded-md border border-border bg-card px-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring/30";

export function EditPanel() {
  const [panelTab, setPanelTab] = useState<"layers" | "properties">("layers");
  const drafts = useStudio((s) => s.drafts);
  const activeId = useStudio((s) => s.activeId);
  const selectedLayerId = useStudio((s) => s.selectedLayerId);
  const setSelectedLayer = useStudio((s) => s.setSelectedLayer);
  const patchLayer = useStudio((s) => s.patchLayer);
  const deleteSelected = useStudio((s) => s.deleteSelected);
  const duplicateSelected = useStudio((s) => s.duplicateSelected);
  const reorderSelected = useStudio((s) => s.reorderSelected);
  const alignSelected = useStudio((s) => s.alignSelected);
  const flipSelected = useStudio((s) => s.flipSelected);
  const copySelected = useStudio((s) => s.copySelected);
  const pasteClipboard = useStudio((s) => s.pasteClipboard);
  const createBlank = useStudio((s) => s.createBlank);
  const setMode = useStudio((s) => s.setMode);

  const draft = drafts.find((d) => d.id === activeId) ?? drafts[0];
  const layers = draft?.layers ?? [];
  const selected = layers.find((l) => l.id === selectedLayerId) ?? null;

  if (!draft) {
    return (
      <div className="px-4 py-6 text-[13px] leading-relaxed text-muted-foreground">
        <p>작업지시를 채우거나, 자료실에서 배경을 고르거나, 빈 도화지를 여세요.</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setMode("library")}
            className="h-8 rounded-md bg-primary px-3 text-[12px] font-bold text-primary-foreground"
          >
            자료실 열기
          </button>
          <button
            type="button"
            onClick={createBlank}
            className="h-8 rounded-md border border-border px-3 text-[12px] font-bold"
          >
            빈 도화지
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="reference-panel-tabs">
        <button type="button" className={panelTab === "properties" ? "active" : ""} onClick={() => setPanelTab("properties")}>속성</button>
        <button type="button" className={panelTab === "layers" ? "active" : ""} onClick={() => setPanelTab("layers")}>레이어</button>
      </div>

      <section className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 p-2.5">
          <div>
            <p className="text-[10px] font-bold text-muted-foreground">전체 작업 크기</p>
            <b className="text-[12px]">{draft.width} × {draft.height} mm</b>
          </div>
          <button
            type="button"
            onClick={() => setMode("brief")}
            className="h-8 rounded-md bg-primary px-3 text-[11px] font-black text-primary-foreground"
          >
            규격 변경
          </button>
        </div>
      </section>

      <section className={`border-b border-border px-4 py-3 ${panelTab === "properties" ? "hidden" : ""}`}>
        <p className="panel-label">레이어 목록</p>
        <ul className="mt-2 space-y-1">
          {[...layers].reverse().map((layer) => (
            <li key={layer.id}>
              <button
                type="button"
                onClick={() => setSelectedLayer(layer.id)}
                className={`flex w-full items-center gap-1.5 rounded-md border px-2 py-1.5 text-left ${
                  selectedLayerId === layer.id ? "border-primary bg-muted" : "border-border bg-card"
                }`}
              >
                <span className="text-primary/70">{layer.type === "text" ? "T" : layer.type === "image" ? "▧" : "▢"}</span>
                <span className="truncate text-[12px] font-bold">{layerName(layer)}</span>
                <span className="ml-auto flex items-center gap-1 text-muted-foreground">
                  {layer.locked ? <Lock className="size-3" /> : null}
                  {layer.hidden ? <EyeOff className="size-3" /> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {selected ? (
        <section className="px-4 py-3">
          <p className="panel-label">개체 속성</p>
          <div className="mt-2 flex flex-wrap gap-1">
            <IconBtn label="복제" onClick={duplicateSelected}><Copy className="size-3.5" /></IconBtn>
            <IconBtn label="복사" onClick={copySelected}><ClipboardCopy className="size-3.5" /></IconBtn>
            <IconBtn label="붙여넣기" onClick={pasteClipboard}><ClipboardPaste className="size-3.5" /></IconBtn>
            <IconBtn label="가로 뒤집기" onClick={() => flipSelected("h")}><FlipHorizontal className="size-3.5" /></IconBtn>
            <IconBtn label="세로 뒤집기" onClick={() => flipSelected("v")}><FlipVertical className="size-3.5" /></IconBtn>
            <IconBtn label="앞으로" onClick={() => reorderSelected("up")}><ArrowUp className="size-3.5" /></IconBtn>
            <IconBtn label="뒤로" onClick={() => reorderSelected("down")}><ArrowDown className="size-3.5" /></IconBtn>
            <IconBtn
              label={selected.locked ? "잠금 해제" : "잠금"}
              onClick={() => patchLayer(selected.id, { locked: !selected.locked })}
            >
              {selected.locked ? <LockOpen className="size-3.5" /> : <Lock className="size-3.5" />}
            </IconBtn>
            <IconBtn
              label={selected.hidden ? "보이기" : "숨기기"}
              onClick={() => patchLayer(selected.id, { hidden: !selected.hidden })}
            >
              {selected.hidden ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
            </IconBtn>
            <IconBtn label="삭제" onClick={deleteSelected}><Trash2 className="size-3.5" /></IconBtn>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            <IconBtn label="왼쪽" onClick={() => alignSelected("left")}><AlignLeft className="size-3.5" /></IconBtn>
            <IconBtn label="가운데" onClick={() => alignSelected("center")}><AlignCenter className="size-3.5" /></IconBtn>
            <IconBtn label="오른쪽" onClick={() => alignSelected("right")}><AlignRight className="size-3.5" /></IconBtn>
            <button type="button" onClick={() => alignSelected("middle")} className="h-8 rounded-md border border-border px-2 text-[11px] font-bold">세로 중앙</button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <p className="col-span-2 text-[10px] leading-relaxed text-muted-foreground">
              아래 값은 선택한 요소의 크기입니다. 전체 작업 크기는 ‘작업지시 → 규격’에서 변경하세요.
            </p>
            <NumField label="X" value={Math.round(selected.x)} onChange={(n) => patchLayer(selected.id, { x: n })} />
            <NumField label="Y" value={Math.round(selected.y)} onChange={(n) => patchLayer(selected.id, { y: n })} />
            <NumField label="너비" value={Math.round(selected.w)} onChange={(n) => patchLayer(selected.id, { w: n })} />
            <NumField label="높이" value={Math.round(selected.h)} onChange={(n) => patchLayer(selected.id, { h: n })} />
          </div>
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[11.5px] text-muted-foreground">
                회전 {Math.round(selected.rotation ?? 0)}°
              </span>
              <button
                type="button"
                onClick={() => patchLayer(selected.id, { rotation: 0 })}
                className="h-7 rounded-md bg-primary px-2.5 text-[11px] font-bold text-primary-foreground"
              >
                0°로 맞추기
              </button>
            </div>
            <input
              type="range"
              min={-180}
              max={180}
              value={selected.rotation ?? 0}
              onChange={(e) => {
                const n = Number(e.target.value);
                patchLayer(selected.id, { rotation: Math.abs(n) <= 8 ? 0 : n });
              }}
              className="w-full"
            />
            <div className="mt-2 grid grid-cols-5 gap-1">
              {[-90, -45, 0, 45, 90].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => patchLayer(selected.id, { rotation: d })}
                  className={`h-8 rounded-md text-[11px] font-bold ${
                    Math.round(selected.rotation ?? 0) === d
                      ? "bg-primary text-primary-foreground"
                      : "border border-border"
                  }`}
                >
                  {d}°
                </button>
              ))}
            </div>
            <label className="mt-2 block">
              <span className="mb-1 block text-[11.5px] text-muted-foreground">각도 숫자</span>
              <input
                className={inputClass}
                type="number"
                step={1}
                value={Math.round(selected.rotation ?? 0)}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n)) return;
                  patchLayer(selected.id, { rotation: Math.round(n) });
                }}
              />
            </label>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
              돌리다가 0° 근처면 붙습니다. Shift를 누른 채 돌리면 15° 단위.
            </p>
          </div>
          <label className="mt-2 block">
            <span className="mb-1 block text-[11.5px] text-muted-foreground">투명 {Math.round((selected.opacity ?? 1) * 100)}%</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={selected.opacity ?? 1}
              onChange={(e) => patchLayer(selected.id, { opacity: Number(e.target.value) })}
              className="w-full"
            />
          </label>

          {selected.type === "text" ? <TextProps layer={selected} /> : null}
          {selected.type === "shape" || selected.type === "rect" ? <FillStroke layer={selected} /> : null}
          {selected.type === "shape" && selected.kind === "rect" ? (
            <label className="mt-2 block">
              <span className="mb-1 block text-[11.5px] text-muted-foreground">모서리</span>
              <input
                className={inputClass}
                type="number"
                min={0}
                value={selected.radius ?? 0}
                onChange={(e) => patchLayer(selected.id, { radius: Number(e.target.value) || 0 })}
              />
            </label>
          ) : null}
          {selected.type === "shape" && selected.kind === "polygon" ? (
            <label className="mt-2 block">
              <span className="mb-1 block text-[11.5px] text-muted-foreground">꼭짓점</span>
              <input
                className={inputClass}
                type="number"
                min={3}
                max={12}
                value={selected.sides ?? 6}
                onChange={(e) => patchLayer(selected.id, { sides: Number(e.target.value) || 6 })}
              />
            </label>
          ) : null}
          {selected.type === "image" ? (
            <div className="mt-2 grid grid-cols-3 gap-1">
              {(["responsive", "cover", "contain"] as const).map((fit) => (
                <button
                  key={fit}
                  type="button"
                  onClick={() => patchLayer(selected.id, { fit })}
                  className={`h-8 rounded-md text-[11px] font-bold ${
                    (selected.fit === "adaptive" ? "responsive" : selected.fit) === fit ? "bg-primary text-primary-foreground" : "border border-border"
                  }`}
                >
                  {fit === "responsive" ? "장식 유지" : fit === "cover" ? "잘라 채움" : "전체 보기"}
                </button>
              ))}
              <p className="col-span-3 text-[10px] leading-relaxed text-muted-foreground">장식 유지는 좌우 장식을 보존합니다. 잘림 없이 보려면 전체 보기를 선택하세요.</p>
            </div>
          ) : null}
          {selected.type === "image" && selected.role !== "background" ? (
            <div className="mt-3">
              <p className="text-[11px] font-bold">중요영역 보호</p>
              <div className="mt-1 grid grid-cols-2 gap-1">
                <button type="button" className="h-8 rounded-md border border-border text-[11px] font-bold" onClick={() => {
                  patchLayer(selected.id, { protectMode: "auto", fit: selected.fit === "responsive" ? "cover" : selected.fit });
                  void detectSubject(selected.href).then((focus) => {
                    patchLayer(selected.id, { focus, protectMode: "auto", fit: "cover" });
                    toast.success("중요 피사체를 찾아 잘리지 않게 맞췄습니다.");
                  }).catch(() => toast.error("이 이미지는 자동으로 분석하지 못했습니다. 직접 지정해 주세요."));
                }}>자동</button>
                <button type="button" className="h-8 rounded-md border border-border text-[11px] font-bold" onClick={() => {
                  patchLayer(selected.id, { protectMode: "manual", fit: selected.fit === "contain" ? "cover" : selected.fit });
                  useStudio.getState().setPickingFocus(true);
                  toast.message("사진 위에서 보호할 영역을 드래그하세요.");
                }}>직접 지정</button>
              </div>
              {selected.focus ? <p className="mt-1 text-[10px] text-muted-foreground">보호영역이 저장되어 있습니다. 잘라 채움일 때도 이 부분이 프레임 안에 남습니다.</p> : null}
            </div>
          ) : null}
          {selected.type === "image" ? <ImageEdits layer={selected} /> : null}
        </section>
      ) : (
        <p className="px-4 py-3 text-[12px] text-muted-foreground">도형이나 글자를 클릭하세요. 자료실에서 배경을 먼저 깔아도 됩니다.</p>
      )}
    </div>
  );
}

const IMAGE_EDITS: { id: ImageEditKind; label: string }[] = [
  { id: "remove-bg", label: "배경 제거" },
  { id: "sharpen", label: "화질 개선" },
  { id: "upscale", label: "저해상도 보정" },
  { id: "erase", label: "물체 지우기" },
  { id: "extend", label: "바깥 확장" },
  { id: "face", label: "얼굴 선명" },
  { id: "product", label: "제품 선명" },
  { id: "color", label: "색감 보정" },
  { id: "brighten", label: "밝기 보정" },
  { id: "blur-bg", label: "배경 흐림" },
  { id: "shadow", label: "그림자" },
];

function ImageEdits({ layer }: { layer: Extract<Layer, { type: "image" }> }) {
  const patchLayer = useStudio((s) => s.patchLayer);
  const [busy, setBusy] = useState<ImageEditKind | null>(null);
  async function run(kind: ImageEditKind) {
    setBusy(kind);
    try {
      const original = layer.originalHref || layer.href;
      const edited = await editImage(layer.href, kind, layer.focus);
      patchLayer(layer.id, { href: edited.href, originalHref: original, intrinsicWidth: edited.width, intrinsicHeight: edited.height, fit: kind === "shadow" || kind === "extend" ? "contain" : layer.fit });
      toast.success("이미지에 반영했습니다. 원본은 그대로 남아 있습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "이미지 편집에 실패했습니다.");
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="mt-3">
      <p className="text-[11px] font-bold">AI 이미지 편집</p>
      <div className="mt-1 grid grid-cols-2 gap-1">
        {IMAGE_EDITS.map((item) => (
          <button key={item.id} type="button" disabled={Boolean(busy)} onClick={() => void run(item.id)} className="h-8 rounded-md border border-border text-[11px] font-bold disabled:opacity-40">
            {busy === item.id ? "처리 중" : item.label}
          </button>
        ))}
      </div>
      <button type="button" disabled={!layer.originalHref || layer.originalHref === layer.href} onClick={() => { if (layer.originalHref) patchLayer(layer.id, { href: layer.originalHref }); }} className="mt-1 h-8 w-full rounded-md border border-border text-[11px] font-bold disabled:opacity-40">
        원본으로 되돌리기
      </button>
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className="inline-flex h-8 items-center justify-center rounded-md border border-border px-2 text-muted-foreground hover:bg-muted"
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label>
      <span className="mb-1 block text-[11.5px] text-muted-foreground">{label}</span>
      <input
        className={inputClass}
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function TextProps({ layer }: { layer: TextLayer }) {
  const patchLayer = useStudio((s) => s.patchLayer);
  const draftH = useStudio((s) => s.drafts.find((d) => d.id === s.activeId)?.height ?? 600);
  return (
    <>
      <label className="mt-2 block">
        <span className="mb-1 block text-[11.5px] text-muted-foreground">문구</span>
        <input className={inputClass} value={layer.text} onChange={(e) => patchLayer(layer.id, { text: e.target.value })} />
      </label>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label>
          <span className="mb-1 block text-[11.5px] text-muted-foreground">색</span>
          <input
            type="color"
            className="h-8 w-full cursor-pointer rounded border border-border"
            value={layer.fill.startsWith("#") && layer.fill.length === 7 ? layer.fill : "#ffffff"}
            onChange={(e) => patchLayer(layer.id, { fill: e.target.value })}
          />
        </label>
        <label>
          <span className="mb-1 block text-[11.5px] text-muted-foreground">크기 {Math.round(layer.fontSize)}</span>
          <input
            type="range"
            min={8}
            max={Math.max(40, draftH * 0.5)}
            value={layer.fontSize}
            onChange={(e) => patchLayer(layer.id, { fontSize: Number(e.target.value) })}
            className="mt-2 w-full"
          />
        </label>
      </div>
      <label className="mt-2 block">
        <span className="mb-1 block text-[11.5px] text-muted-foreground">글꼴</span>
        <select className={inputClass} value={layer.fontFamily} onChange={(e) => patchLayer(layer.id, { fontFamily: e.target.value })}>
          {FONTS.map((f) => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
      </label>
      <div className="mt-2 grid grid-cols-2 gap-1">
        {(["start", "middle", "end"] as Align[]).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => patchLayer(layer.id, { align: a })}
            className={`h-8 rounded-md text-[11px] font-bold ${
              layer.align === a ? "bg-primary text-primary-foreground" : "border border-border"
            }`}
          >
            {a === "start" ? "왼쪽" : a === "middle" ? "가운데" : "오른쪽"}
          </button>
        ))}
      </div>
    </>
  );
}

function FillStroke({ layer }: { layer: Layer }) {
  const patchLayer = useStudio((s) => s.patchLayer);
  const fill = "fill" in layer ? layer.fill : "#1c2333";
  const stroke = "stroke" in layer ? (layer.stroke ?? "#1c2333") : "#1c2333";
  const strokeWidth = "strokeWidth" in layer ? (layer.strokeWidth ?? 0) : 0;
  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      <label>
        <span className="mb-1 block text-[11.5px] text-muted-foreground">채우기</span>
        <input
          type="color"
          className="h-8 w-full cursor-pointer rounded border border-border"
          value={fill.startsWith("#") ? fill : "#1c2333"}
          onChange={(e) => patchLayer(layer.id, { fill: e.target.value } as Partial<Layer>)}
        />
      </label>
      <label>
        <span className="mb-1 block text-[11.5px] text-muted-foreground">선</span>
        <input
          type="color"
          className="h-8 w-full cursor-pointer rounded border border-border"
          value={stroke.startsWith("#") ? stroke : "#1c2333"}
          onChange={(e) => patchLayer(layer.id, { stroke: e.target.value } as Partial<Layer>)}
        />
      </label>
      <label className="col-span-2">
        <span className="mb-1 block text-[11.5px] text-muted-foreground">선 두께 {strokeWidth}</span>
        <input
          type="range"
          min={0}
          max={40}
          value={strokeWidth}
          onChange={(e) => patchLayer(layer.id, { strokeWidth: Number(e.target.value) } as Partial<ShapeLayer>)}
          className="w-full"
        />
      </label>
    </div>
  );
}
