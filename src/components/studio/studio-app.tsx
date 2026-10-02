import { HelpCircle, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { getAiStatus } from "@/lib/ai/generate";
import { folderCount } from "@/lib/studio/library-catalog";
import { hydrateStudio, useStudio } from "@/lib/studio/store";
import type { EditorTool, StudioMode } from "@/lib/studio/types";
import { AiPanel } from "./ai-panel";
import { BriefPanel } from "./brief-panel";
import { LibraryPanel } from "./library-panel";
import { OrderPanel } from "./order-panel";
import { Workbench } from "./workbench";
import { saveAutosave } from "@/lib/studio/project-storage";
import { BRAND, PRODUCT_NAME } from "@/lib/brand";

const MODES: { id: StudioMode; label: string }[] = [
  { id: "order", label: "주문 접수" },
  { id: "brief", label: "작업지시" },
  { id: "ai", label: "AI 생성" },
  { id: "edit", label: "손보기" },
  { id: "library", label: `자료실 ${folderCount("all")}` },
];

const TOOL_KEYS: Record<string, EditorTool> = {
  v: "select",
  t: "text",
  m: "rect",
  o: "ellipse",
  p: "polygon",
  i: "eyedropper",
  h: "pan",
};

export function StudioApp() {
  const mode = useStudio((s) => s.mode);
  const setMode = useStudio((s) => s.setMode);
  const theme = useStudio((s) => s.theme);
  const setTheme = useStudio((s) => s.setTheme);
  const setAiAvailable = useStudio((s) => s.setAiAvailable);
  const setTool = useStudio((s) => s.setTool);
  const undo = useStudio((s) => s.undo);
  const redo = useStudio((s) => s.redo);
  const deleteSelected = useStudio((s) => s.deleteSelected);
  const duplicateSelected = useStudio((s) => s.duplicateSelected);
  const nudgeSelected = useStudio((s) => s.nudgeSelected);
  const setZoom = useStudio((s) => s.setZoom);
  const zoom = useStudio((s) => s.zoom);
  const [help, setHelp] = useState(false);
  const drafts = useStudio((s) => s.drafts);
  const activeId = useStudio((s) => s.activeId);
  const brief = useStudio((s) => s.brief);

  useEffect(() => {
    if (!drafts.length) return;
    const timer = window.setTimeout(() => saveAutosave({ brief, drafts, activeId }), 900);
    return () => window.clearTimeout(timer);
  }, [brief, drafts, activeId]);

  useEffect(() => {
    hydrateStudio();
    getAiStatus().then((s) => setAiAvailable(s.available)).catch(() => setAiAvailable(false));
  }, [setAiAvailable]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      const mod = e.metaKey || e.ctrlKey;
      const s = useStudio.getState();
      if (s.editingTextId) {
        if (e.key === "Escape") s.setEditingText(null);
        return;
      }
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        if (!typing) {
          e.preventDefault();
          setHelp((v) => !v);
        }
        return;
      }
      if (e.key === "Escape") {
        setHelp(false);
        s.setSelectedLayer(null);
        return;
      }
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateSelected();
        return;
      }
      if (mod && e.key.toLowerCase() === "c") {
        if (typing) return;
        e.preventDefault();
        s.copySelected();
        return;
      }
      if (mod && e.key.toLowerCase() === "v") {
        if (typing) return;
        e.preventDefault();
        s.pasteClipboard();
        return;
      }
      if (mod && (e.key === "0" || e.code === "Digit0")) {
        e.preventDefault();
        setZoom(1);
        return;
      }
      if (mod && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        setZoom(zoom * 1.15);
        return;
      }
      if (mod && e.key === "-") {
        e.preventDefault();
        setZoom(zoom / 1.15);
        return;
      }
      if (typing) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelected();
        return;
      }
      if (e.key === "\\") {
        setTool("line");
        return;
      }
      if (e.key.toLowerCase() === "g") {
        s.setShowGrid(!s.showGrid);
        return;
      }
      if (e.key.toLowerCase() === "s" && !mod) {
        s.setSnap(!s.snap);
        return;
      }
      const tool = TOOL_KEYS[e.key.toLowerCase()];
      if (tool) setTool(tool);
      if (e.key === "ArrowLeft") nudgeSelected(-4, 0);
      if (e.key === "ArrowRight") nudgeSelected(4, 0);
      if (e.key === "ArrowUp") nudgeSelected(0, -4);
      if (e.key === "ArrowDown") nudgeSelected(0, 4);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteSelected, duplicateSelected, nudgeSelected, redo, setTool, setZoom, undo, zoom]);

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="reference-header flex flex-shrink-0 flex-wrap items-center gap-3 border-b border-border bg-panel px-3 py-2 md:px-4">
        <h1 className="flex items-center gap-2 text-[15px] font-black tracking-tight">
          <img src={BRAND.symbol} alt="" className="size-8 object-contain" />
          <span className="flex flex-col leading-none">
            <span>{PRODUCT_NAME}</span>
            <span className="mt-0.5 text-[10px] font-bold tracking-wide text-muted-foreground">편집실 · 현수막 · 배너 · 명함</span>
          </span>
        </h1>
        <div className="reference-document-title">▤ &nbsp; {brief.name || "새 광고물"} &nbsp; ✎</div>
        <nav className="flex flex-wrap gap-1.5" aria-label="작업 모드">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-[12.5px] transition-colors ${
                mode === m.id
                  ? m.id === "ai"
                    ? "border-ai bg-ai font-bold text-ai-foreground"
                    : "border-primary bg-primary font-bold text-primary-foreground"
                  : "border-border bg-card font-medium hover:border-primary"
              }`}
            >
              {m.label}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="hidden items-center gap-1 text-[11px] font-bold text-safe sm:inline-flex"><span className="size-1.5 rounded-full bg-safe" /> 로컬 설정 저장</span>
          <button
            type="button"
            onClick={() => setHelp((v) => !v)}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-[11px] font-bold text-muted-foreground"
            title="단축키"
          >
            <HelpCircle className="size-3.5" />
            <span className="hidden sm:inline">단축키</span>
          </button>
          <div className="flex rounded-md border border-border p-0.5" role="group" aria-label="화면 테마">
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={`inline-flex h-7 items-center gap-1 rounded px-2 text-[11px] font-bold ${
                theme === "light" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              <Sun className="size-3.5" />
              밝게
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={`inline-flex h-7 items-center gap-1 rounded px-2 text-[11px] font-bold ${
                theme === "dark" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              <Moon className="size-3.5" />
              어둡게
            </button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
        {mode !== "edit" ? (
          <aside className="studio-side-panel flex max-h-[42vh] min-h-0 w-full shrink-0 flex-col border-border bg-panel md:h-full md:max-h-none md:w-[320px] md:border-r max-md:border-b">
            <div className="min-h-0 flex-1 overflow-y-auto">
              {mode === "order" ? <OrderPanel /> : mode === "brief" ? <BriefPanel /> : mode === "ai" ? <AiPanel /> : <LibraryPanel />}
            </div>
          </aside>
        ) : null}
        <Workbench />
      </div>
      <Toaster position="bottom-right" richColors closeButton />
      {help ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/70 p-4" onClick={() => setHelp(false)}>
          <div
            className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-lg border border-border bg-card p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="panel-label">핵심만</p>
            <h2 className="mt-1 text-lg font-black">일러스트레이터에서 쓰는 것만</h2>
            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
              펜·패스·패스파인더는 뺐습니다. 현수막 손보기에 필요한 선택·글자·도형·정렬·격자만 남겼습니다.
            </p>
            <ul className="mt-3 space-y-1.5 text-[12px]">
              {[
                ["V", "선택 · 옮기기 · 크기 · 위쪽 점 회전"],
                ["0°로", "손보기에서 한 번에 반듯하게. 회전 점 두 번 눌러도 0°"],
                ["T", "글자. 두 번 누르면 바로 고칩니다"],
                ["M / O / P / \\", "네모 · 원 · 다각형 · 선"],
                ["I / H", "스포이트 · 손바닥"],
                ["Ctrl+Z / Y", "실행 취소 · 다시"],
                ["Ctrl+C / V / D", "복사 · 붙여넣기 · 복제"],
                ["G / S", "격자 보기 · 격자에 붙이기"],
                ["Delete", "선택 삭제"],
                ["휠 · Ctrl + −", "확대 · 축소"],
              ].map(([k, v]) => (
                <li key={k} className="flex gap-3">
                  <kbd className="w-28 shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] font-bold">{k}</kbd>
                  <span className="text-muted-foreground">{v}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setHelp(false)}
              className="mt-4 h-9 w-full rounded-md bg-primary text-[12px] font-bold text-primary-foreground"
            >
              닫기
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
