import { Link } from "@tanstack/react-router";
import { inspectDraft } from "@/lib/studio/compose";
import { downloadBlob, downloadText, draftToPngBlob, draftToSvgStandalone, fileStem } from "@/lib/studio/svg";
import { useStudio } from "@/lib/studio/store";
import { Download, FileCheck2, Minus, Plus, Redo2, Save, ShieldCheck, Sparkles, Undo2, Search, Image as ImageIcon, Shapes, Type, Upload, LayoutTemplate, FolderOpen, WandSparkles, MousePointer2, AlignCenter, Group, LockKeyhole, Trash2, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { saveVersion, listVersions } from "@/lib/studio/project-storage";
import { CanvasEditor } from "./canvas-editor";
import { ConvertPanel, ReviewPanel } from "./delivery-panels";
import { LibraryBrowser } from "./library-browser";
import { ToolsRail } from "./tools-rail";
import { EditPanel } from "./edit-panel";
import { DraftCanvas } from "./draft-canvas";
import { planAiDirections, renderAiImage } from "@/lib/ai/generate";
import { sizeOf } from "@/lib/studio/catalog";
import { reviewDraft } from "@/lib/studio/production-check";
import { PDFDocument } from "pdf-lib";


const WORKBENCH_STYLES = [
  { id: "auto", label: "AI 추천" },
  { id: "photo", label: "사진형" },
  { id: "type", label: "텍스트형" },
  { id: "illustration", label: "일러스트형" },
  { id: "public", label: "공공기관형" },
  { id: "backdrop", label: "줌배경·포토월" },
] as const;

const TEMPLATE_STYLES = [
  ["보훈가족 봉사활동", "따뜻한 봄 · 공공기관", "linear-gradient(135deg,#fff7f7,#fff 55%,#eaf8ff)"],
  ["함께하는 작은 손길", "감성형 · 꽃 장식", "linear-gradient(135deg,#fff0f5,#fff9e9)"],
  ["2026 온 하우스 프로젝트", "모던형 · 자연", "linear-gradient(135deg,#effcf3,#eef7ff)"],
  ["함께 만드는 행복한 세상", "신뢰형 · 블루", "linear-gradient(135deg,#eef4ff,#ffffff)"],
] as const;

export function Workbench() {
  const [printOpen, setPrintOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [templateQuery, setTemplateQuery] = useState("");
  const [category, setCategory] = useState("추천");
  const [visualStyle, setVisualStyle] = useState<(typeof WORKBENCH_STYLES)[number]["id"]>("auto");
  const drafts = useStudio((s) => s.drafts);
  const activeId = useStudio((s) => s.activeId);
  const setActive = useStudio((s) => s.setActive);
  const brief = useStudio((s) => s.brief);
  const setBrief = useStudio((s) => s.setBrief);
  const busy = useStudio((s) => s.busy);
  const zoom = useStudio((s) => s.zoom);
  const setZoom = useStudio((s) => s.setZoom);
  const undo = useStudio((s) => s.undo);
  const redo = useStudio((s) => s.redo);
  const history = useStudio((s) => s.history);
  const future = useStudio((s) => s.future);
  const setMode = useStudio((s) => s.setMode);
  const mode = useStudio((s) => s.mode);
  const showSafeArea = useStudio((s) => s.showSafeArea);
  const setShowSafeArea = useStudio((s) => s.setShowSafeArea);
  const makeTypeDrafts = useStudio((s) => s.makeTypeDrafts);
  const setTool = useStudio((s) => s.setTool);
  const aiAvailable = useStudio((s) => s.aiAvailable);
  const aiQuality = useStudio((s) => s.aiQuality);
  const setBusy = useStudio((s) => s.setBusy);
  const resetDrafts = useStudio((s) => s.resetDrafts);
  const addAiDraft = useStudio((s) => s.addAiDraft);
  const applyReferenceTemplate = useStudio((s) => s.applyReferenceTemplate);
  const setSelectedLayer = useStudio((s) => s.setSelectedLayer);
  const deleteSelected = useStudio((s) => s.deleteSelected);

  const active = drafts.find((d) => d.id === activeId) ?? drafts[0];
  const check = active && active.source !== "blank" ? inspectDraft(active, brief) : { errors: [] as string[], warnings: [] as string[] };

  async function exportPng() {
    if (!active) return;
    toast.message("PNG 렌더 중…");
    try {
      const maxSide = Math.max(active.width, active.height);
      const scale = maxSide < 400 ? 8 : maxSide < 1200 ? 2 : 1;
      const blob = await draftToPngBlob(active, scale);
      downloadBlob(`${fileStem(brief.name, active.letter)}.png`, blob);
    } catch (err) { toast.error(err instanceof Error ? err.message : "PNG 생성 실패"); }
  }

  async function exportSvg() {
    if (!active) return;
    try {
      const svg = await draftToSvgStandalone(active);
      downloadText(`${fileStem(brief.name, active.letter)}.svg`, svg, "image/svg+xml");
    } catch (err) { toast.error(err instanceof Error ? err.message : "SVG 생성 실패"); }
  }

  async function exportPdf() {
    if (!active) return;
    toast.message("PDF 시안을 만드는 중…");
    try {
      const pdf = await PDFDocument.create();
      const scale = Math.min(100 / 25.4, 10000 / Math.max(active.width, active.height));
      const png = await draftToPngBlob(active, scale);
      const image = await pdf.embedPng(await png.arrayBuffer());
      const page = pdf.addPage([active.width * 72 / 25.4, active.height * 72 / 25.4]);
      page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
      const bytes = await pdf.save();
      downloadBlob(`${fileStem(brief.name, active.letter)}.pdf`, new Blob([new Uint8Array(bytes)], { type: "application/pdf" }));
      toast.success("실제 크기 PDF 시안을 저장했습니다. 인쇄 원본은 SVG를 사용해 주세요.");
    } catch (err) { toast.error(err instanceof Error ? err.message : "PDF 생성 실패"); }
  }

  const printReady = Boolean(active) && check.errors.length === 0;

  async function generateDesigns() {
    if (!brief.headline.trim() && !brief.notes.trim()) {
      toast.error("주문내용을 먼저 입력해 주세요.");
      return;
    }
    if (!aiAvailable) {
      toast.message("AI 연결이 없어 편집 가능한 기본 시안 3종을 만듭니다.");
      makeTypeDrafts();
      return;
    }
    const { w, h } = sizeOf(brief);
    setBusy("AI가 디자인 방향을 구성하는 중…");
    try {
      const plan = await planAiDirections({ data: {
        brief: {
          industry: brief.industry, purpose: brief.purpose, mood: brief.mood,
          emphasize: brief.emphasize, name: brief.name, headline: brief.headline,
          subhead: brief.subhead, price: brief.price, date: brief.date,
          place: brief.place, phone: brief.phone, notes: brief.notes,
          baseColor: brief.baseColor, accentColor: brief.accentColor,
        }, width: w, height: h, includeText: false, visualStyle,
      } });
      if (!plan.ok) throw new Error(plan.error);
      const rendered = [];
      const failures: string[] = [];
      for (const direction of plan.directions) {
        setBusy(`${direction.letter}안 배경을 만드는 중…`);
        const result = await renderAiImage({ data: { prompt: direction.prompt, width: w, height: h, quality: aiQuality } });
        if (result.ok) rendered.push({ ...direction, image: result.image });
        else { failures.push(`${direction.letter}안: ${result.error}`); toast.error(`${direction.letter}안: ${result.error}`); }
      }
      if (!rendered.length) throw new Error(failures[0] || "AI 시안을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.");
      resetDrafts();
      rendered.forEach(addAiDraft);
      toast.success(`편집 가능한 AI 시안 ${rendered.length}종을 만들었습니다.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI 생성 중 오류가 발생했습니다.");
    } finally {
      setBusy(null);
    }
  }

  if (mode === "library") return <div className="min-h-0 flex-1"><LibraryBrowser /></div>;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#f7f8fc]">
      <div className="reference-toolbar flex h-16 flex-shrink-0 items-center gap-2 border-b border-border bg-white px-3">
        <div className="hidden items-center gap-1 lg:flex">
          {[
            {i:MousePointer2,l:"선택",a:()=>setTool("select")}, {i:Type,l:"텍스트",a:()=>setTool("text")},
            {i:Shapes,l:"도형",a:()=>setTool("rect")}, {i:ImageIcon,l:"이미지",a:()=>setMode("library")},
            {i:LayoutGrid,l:"요소",a:()=>setTool("ellipse")}, {i:AlignCenter,l:"정렬",a:()=>setSelectedLayer(null)},
            {i:Group,l:"격자",a:()=>useStudio.getState().setShowGrid(!useStudio.getState().showGrid)},
            {i:LockKeyhole,l:"잠금",a:()=>{const id=useStudio.getState().selectedLayerId; const layer=active?.layers.find(x=>x.id===id);if(id&&layer)useStudio.getState().patchLayer(id,{locked:!layer.locked});}},
            {i:Trash2,l:"삭제",a:deleteSelected},
          ].map(({i:Icon,l,a}) => <button key={l} onClick={a} className={`editor-top-tool ${useStudio.getState().tool==="select"&&l==="선택"?"is-active":""}`}><Icon className="size-4"/><span>{l}</span></button>)}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Link to="/video" className="hidden h-8 items-center rounded-md border border-border px-2 text-[11px] font-bold lg:inline-flex">영상편집실</Link>
          <button disabled={!history.length} onClick={undo} className="icon-btn"><Undo2 className="size-4"/></button>
          <button disabled={!future.length} onClick={redo} className="icon-btn"><Redo2 className="size-4"/></button>
          <div className="zoom-pill"><button onClick={() => setZoom(zoom/1.15)}><Minus className="size-3.5"/></button><b>{Math.round(zoom*100)}%</b><button onClick={() => setZoom(zoom*1.15)}><Plus className="size-3.5"/></button></div>
          <button onClick={() => { setReviewOpen((open) => !open); setConvertOpen(false); }} className={`top-action ${reviewOpen ? "is-on" : ""}`}><FileCheck2 className="size-4"/>AI 제작검수</button>
          <button onClick={() => { setConvertOpen((open) => !open); setReviewOpen(false); }} className={`top-action ${convertOpen ? "is-on" : ""}`}>다른 규격으로 변환</button>
          <button onClick={() => setShowSafeArea(!showSafeArea)} className={`top-action ${showSafeArea ? "is-on" : ""}`}><ShieldCheck className="size-4"/>안전영역</button>
          <button onClick={() => setPrintOpen(!printOpen)} className="top-action"><FileCheck2 className="size-4"/>인쇄 설정</button>
          <button onClick={()=>{ if(!active) return; saveVersion({name: brief.name || "광고물 작업", brief,drafts,activeId:active.id}); toast.success("현재 작업을 버전으로 저장했습니다."); }} className="top-action"><Save className="size-4"/>저장</button><button onClick={exportSvg} className="top-action">SVG</button><button onClick={exportPdf} className="top-action">PDF</button>
          <button onClick={exportPng} className="download-btn"><Download className="size-4"/>다운로드</button>
        </div>
      </div>

      {reviewOpen && active ? <ReviewPanel /> : null}
      {convertOpen && active ? <ConvertPanel /> : null}
      {printOpen && active ? <div className="border-b border-border bg-white px-5 py-2.5 text-xs"><b className={printReady ? "text-safe" : "text-bleed"}>{printReady ? "✓ 인쇄 검수 통과" : "인쇄 전 확인 필요"}</b><span className="ml-3 text-muted-foreground">{(active.width/10).toFixed(0)} × {(active.height/10).toFixed(0)} cm · SVG 벡터 출력 권장 · 오류 {check.errors.length} / 주의 {check.warnings.length}</span></div> : null}

      <div className="flex min-h-0 flex-1">
        <div className="reference-library hidden w-[352px] shrink-0 border-r border-border bg-white xl:block">
          <div className="flex h-full">
            <div className="w-[78px] shrink-0 border-r border-border bg-[#fbfbfe] py-2">
              {[
                {i:LayoutTemplate,l:"템플릿",a:()=>{setMode("edit"); document.querySelector<HTMLInputElement>(".template-search input")?.focus();}},
                {i:Type,l:"텍스트",a:()=>setTool("text")},
                {i:ImageIcon,l:"사진",a:()=>setMode("library")},
                {i:Shapes,l:"요소",a:()=>setTool("rect")},
                {i:WandSparkles,l:"배경",a:()=>setMode("library")},
                {i:Upload,l:"업로드",a:()=>setMode("library")},
                {i:FolderOpen,l:"자료실",a:()=>setMode("library")}
              ].map(({i:Icon,l,a},idx)=><button key={l} onClick={a} className={`side-tool ${idx===0?"active":""}`}><Icon className="size-4"/><span>{l}</span></button>)}
            </div>
            <div className="min-w-0 flex-1 overflow-y-auto p-4">
              <div className="template-search"><Search className="size-4"/><input value={templateQuery} onChange={e=>setTemplateQuery(e.target.value)} placeholder="템플릿 검색"/></div>
              <div className="mt-3 flex flex-wrap gap-1.5">{["추천","봉사활동","보훈","행사","기업"].map(x=><button key={x} onClick={()=>setCategory(x)} className={`chip ${category===x?"on":""}`}>{x}</button>)}</div>
              <h3 className="mt-5 text-[13px] font-black">카테고리</h3>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] font-bold">
                {[["💗","보훈행사"],["💕","봉사활동"],["🏢","기업/기관"],["🏫","학교/교육"],["🎊","축제/이벤트"],["🎖️","기념/행사"]].map(([icon,label])=><button key={label} onClick={()=>{setCategory(label.includes("보훈")?"보훈":label.includes("봉사")?"봉사활동":"추천")}} className="category-tile">{icon} {label}</button>)}
              </div>
              <h3 className="mt-5 text-[13px] font-black">추천 템플릿</h3>
              <button onClick={applyReferenceTemplate} className="reference-template-card mt-2 w-full text-left">
                <img src="/reference-banner.svg" alt="꽃과 태극기, 보훈가족 현수막 템플릿" />
                <strong>보훈가족 봉사활동 (기본형)</strong>
              </button>
              <div className="mt-2 space-y-2">{TEMPLATE_STYLES.filter((x,i)=>(category==="추천"||["봉사활동","보훈","행사","기업"][i]===category||x.join(" ").includes(category))&&(!templateQuery||x.join(" ").includes(templateQuery))).map(([title,sub,bg],i)=><button key={title} onClick={()=>{setBrief({headline:title,subhead:sub}); const r=makeTypeDrafts(); if(r.errors.length) toast.error(r.errors[0]); else toast.success("편집 가능한 시안을 적용했습니다.");}} className="template-card" style={{background:bg}}><div className="template-flower">✿</div><b>{title}</b><span>{sub}</span><small>시안 {i+1}</small></button>)}</div>
              <button onClick={()=>setMode("library")} className="mt-3 w-full rounded-lg border border-primary/20 bg-primary/5 py-2 text-[11px] font-bold text-primary">자료실 108개 배경 보기</button>
            </div>
          </div>
        </div>

        {active ? <ToolsRail /> : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="reference-stage relative min-h-0 flex-1 workbench-grid p-4 md:p-6">
            {busy ? <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70"><div className="rounded-xl border bg-white px-6 py-4 shadow-lg"><Sparkles className="mx-auto size-5 text-primary"/><b className="mt-2 block text-sm">{busy}</b></div></div> : null}
            {active ? <div className="mx-auto h-full max-w-[1100px]"><CanvasEditor /></div> : <div className="flex h-full items-center justify-center"><button onClick={()=>setMode("brief")} className="download-btn">작업지시부터 시작</button></div>}
          </div>

          <div className="reference-ai-dock ai-dock hidden shrink-0 border-t border-border bg-white xl:grid xl:grid-cols-[1fr_1fr]">
            <div className="border-r border-border p-4">
              <div className="flex items-center gap-2"><Sparkles className="size-4 text-primary"/><b className="text-[13px]">AI가 3가지 디자인 시안을 만들어드려요</b></div>
              <textarea value={brief.notes} onChange={e=>setBrief({notes:e.target.value})} className="mt-3 h-16 w-full resize-none rounded-lg border border-border p-3 text-[11px] outline-none focus:ring-2 focus:ring-primary/20" placeholder="예: 보훈가족 봉사활동 현수막, 250x70cm, 따뜻하고 고급스럽게, 로고 3개 포함"/>
              <div className="mt-2 grid grid-cols-3 gap-1">{WORKBENCH_STYLES.map(style=><button key={style.id} onClick={()=>setVisualStyle(style.id)} className={`h-7 rounded-md border px-1 text-[10.5px] font-bold ${visualStyle===style.id?"border-primary bg-primary text-white":"border-border bg-white text-muted-foreground"}`}>{style.label}</button>)}</div>
              <div className="mt-2 flex gap-1.5">{["더 고급스럽게","글씨를 더 크게","공공기관 느낌","따뜻한 느낌"].map(x=><button key={x} onClick={()=>setBrief({notes:`${brief.notes} ${x}`.trim()})} className="chip">{x}</button>)}</div>
              <button disabled={Boolean(busy)} onClick={() => {
                if (!brief.headline.trim() && !brief.notes.trim()) { toast.error("주문내용을 먼저 입력해 주세요."); return; }
                useStudio.getState().handToDesigner();
                const state = useStudio.getState();
                const draft = state.drafts.find((item) => item.id === state.activeId) ?? state.drafts[0];
                const notes = draft ? reviewDraft(draft, state.brief).filter((row) => !row.ok).slice(0, 2) : [];
                toast.success(notes.length
                  ? `편집 가능한 시안 3종을 만들었습니다. ${notes.map((row) => row.text).join(" ")}`
                  : "A 고급, B 강렬, C 감성 시안을 만들었습니다. 캔버스에서 바로 고칠 수 있습니다.");
              }} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#1c150e] text-sm font-black text-white">✨ 디자이너에게 맡기기</button>
              <button disabled={Boolean(busy)} onClick={generateDesigns} className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#5b3df5] to-[#8b5cf6] text-xs font-black text-white disabled:opacity-50"><Sparkles className="size-4"/>{busy || (aiAvailable ? "AI 디자인 생성하기" : "편집 시안 3종 만들기")}</button>
            </div>
            <div className="p-4">
              <b className="text-[12px]">AI가 제안한 디자인 시안 3가지</b>
              <div className="mt-2 max-h-[420px] space-y-1.5 overflow-y-auto">{drafts.map(d=><button key={d.id} onClick={()=>setActive(d.id)} className={`reference-draft-row draft-card ${d.id===active?.id?"selected":""}`}><div className="draft-thumb overflow-hidden bg-white"><DraftCanvas draft={d} selectedId={null} onSelect={()=>setActive(d.id)} showSafe={false}/></div><span>시안 {d.letter} · {d.title}</span><strong>{d.id===active?.id?"선택됨":"선택하기"}</strong></button>)}</div>
            </div>
          </div>
        </div>

        {active ? (
          <aside className="studio-properties hidden min-h-0 w-[292px] shrink-0 border-l border-border bg-white xl:flex xl:flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto"><EditPanel /></div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
