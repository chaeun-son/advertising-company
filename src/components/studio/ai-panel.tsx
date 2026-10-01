import { useState } from "react";
import { planAiDirections, refineAiImage, renderAiImage, suggestCopy } from "@/lib/ai/generate";
import { INDUSTRIES, sizeOf } from "@/lib/studio/catalog";
import { composeAiDraft } from "@/lib/studio/compose";
import { useStudio } from "@/lib/studio/store";
import { toast } from "sonner";

const STYLES = [
  { id: "auto", label: "AI 추천" },
  { id: "photo", label: "사진형" },
  { id: "type", label: "텍스트형" },
  { id: "illustration", label: "일러스트형" },
  { id: "public", label: "공공기관형" },
  { id: "backdrop", label: "줌배경·포토월" },
] as const;

const REFINES = [
  { id: "bolder", label: "더 강렬하게", prompt: "Increase contrast, bolder lighting, more dramatic commercial look" },
  { id: "luxury", label: "더 고급스럽게", prompt: "Make it more luxurious, refined materials, quieter lighting, premium print ad" },
  { id: "warm", label: "더 따뜻하게", prompt: "Warmer tungsten light, inviting atmosphere, softer contrast" },
  { id: "space", label: "여백 늘리기", prompt: "Open up more empty negative space for typography, simpler background" },
  { id: "photo", label: "사진 비중 확대", prompt: "Fill more of the frame with the photographic subject, less empty area" },
];

export function AiPanel() {
  const brief = useStudio((s) => s.brief);
  const drafts = useStudio((s) => s.drafts);
  const activeId = useStudio((s) => s.activeId);
  const addAiDraft = useStudio((s) => s.addAiDraft);
  const resetDrafts = useStudio((s) => s.resetDrafts);
  const replaceDraft = useStudio((s) => s.replaceDraft);
  const setBusy = useStudio((s) => s.setBusy);
  const setMode = useStudio((s) => s.setMode);
  const busy = useStudio((s) => s.busy);
  const aiAvailable = useStudio((s) => s.aiAvailable);
  const aiQuality = useStudio((s) => s.aiQuality);
  const setAiQuality = useStudio((s) => s.setAiQuality);
  const setBrief = useStudio((s) => s.setBrief);
  const [includeText, setIncludeText] = useState(false);
  const [visualStyle, setVisualStyle] = useState<(typeof STYLES)[number]["id"]>("auto");
  const [customRefine, setCustomRefine] = useState("");
  const [ideas, setIdeas] = useState<{ headlines: string[]; subheads: string[]; tone: string } | null>(null);

  const active = drafts.find((d) => d.id === activeId) ?? drafts[0];
  const { w, h } = sizeOf(brief);

  async function generate() {
    if (!brief.headline.trim() && !brief.notes.trim()) {
      toast.error("주문내용을 먼저 입력해 주세요.");
      return;
    }
    if (aiAvailable === false) {
      toast.error("AI 기능을 이 환경에서 쓸 수 없습니다.");
      return;
    }
    setBusy("AI가 시안 방향을 짜는 중…");
    try {
      const plan = await planAiDirections({
        data: {
          brief: {
            industry: brief.industry,
            purpose: brief.purpose,
            mood: brief.mood,
            emphasize: brief.emphasize,
            name: brief.name,
            headline: brief.headline,
            subhead: brief.subhead,
            price: brief.price,
            date: brief.date,
            place: brief.place,
            phone: brief.phone,
            notes: brief.notes,
            baseColor: brief.baseColor,
            accentColor: brief.accentColor,
          },
          width: w,
          height: h,
          includeText,
          visualStyle,
        },
      });
      if (!plan.ok) {
        toast.error(plan.error);
        return;
      }
      const generated: Array<Parameters<typeof addAiDraft>[0]> = [];
      const failures: string[] = [];
      for (const dir of plan.directions) {
        setBusy(`${dir.letter}안 「${dir.title}」 그리는 중…`);
        const rendered = await renderAiImage({
          data: { prompt: dir.prompt, width: w, height: h, quality: aiQuality },
        });
        if (!rendered.ok) {
          failures.push(`${dir.letter}안: ${rendered.error}`);
          toast.error(`${dir.letter}안: ${rendered.error}`);
          continue;
        }
        generated.push({ ...dir, image: rendered.image });
      }
      if (generated.length === 0) {
        toast.error(failures[0] || "시안을 만들지 못했습니다.", { duration: 12000 });
        return;
      }
      resetDrafts();
      generated.forEach(addAiDraft);
      setMode("edit");
      toast.success(`AI 시안 ${generated.length}종. 글자는 작업지시 그대로입니다.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "생성 실패");
    } finally {
      setBusy(null);
    }
  }

  async function refine(prompt: string, label: string) {
    if (!active?.aiImage) {
      toast.message("AI 시안을 먼저 만든 뒤 다듬을 수 있습니다.");
      return;
    }
    setBusy(`${label} 적용 중…`);
    try {
      const result = await refineAiImage({
        data: {
          image: active.aiImage,
          instruction: prompt,
          width: w,
          height: h,
          quality: aiQuality,
        },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const next = composeAiDraft(
        brief,
        w,
        h,
        active.letter,
        active.title,
        active.palette,
        result.image,
        prompt,
        active.textZone ?? "left",
      );
      replaceDraft({ ...next, id: active.id, letter: active.letter });
      toast.success("배경을 다듬었습니다.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "수정 실패");
    } finally {
      setBusy(null);
    }
  }

  async function suggest() {
    setBusy("카피 제안 중…");
    try {
      const industry = INDUSTRIES.find((i) => i.id === brief.industry)?.label ?? brief.industry;
      const result = await suggestCopy({
        data: { industry, purpose: brief.purpose, name: brief.name, headline: brief.headline },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setIdeas(result);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="border-b border-border px-4 py-3">
        <p className="panel-label">AI 디자인</p>
        <h2 className="mt-1 text-base font-black tracking-tight">사진·그래픽·일러스트 중 선택</h2>
        <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
          사진형만 고정하지 않고 광고물에 맞는 그래픽·일러스트·공공기관형·줌배경형을 선택할 수 있습니다. 주문내용에서 정리한 문구만 시안에 사용합니다.
        </p>
      </div>

      {aiAvailable === false ? (
        <div className="mx-4 mt-3 rounded-md border border-border bg-card px-3 py-2 text-[12px] text-muted-foreground">
          AI 기능을 이 환경에서 쓸 수 없습니다. 타이포 시안 A·B·C는 작업지시 탭에서 바로 짤 수 있습니다.
        </div>
      ) : null}

      <section className="border-b border-border px-4 py-3">
        <p className="panel-label">생성 방식</p>
        <p className="mt-2 text-[11px] font-bold">시안 스타일</p>
        <div className="mt-2 grid grid-cols-2 gap-1">
          {STYLES.map((style) => (
            <button
              key={style.id}
              type="button"
              onClick={() => setVisualStyle(style.id)}
              className={`h-8 rounded-md border text-[11px] font-bold ${visualStyle === style.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}
            >
              {style.label}
            </button>
          ))}
        </div>
        <label className="mt-2 flex items-start gap-2 text-[12px] leading-snug">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={includeText}
            onChange={(e) => setIncludeText(e.target.checked)}
          />
          <span>
            AI가 글자까지 그리기
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              참고용 목업입니다. 한글이 살짝 다를 수 있어 인쇄본은 기본(배경만)을 쓰세요.
            </span>
          </span>
        </label>
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg border border-border p-1">
          <button
            type="button"
            onClick={() => setAiQuality("fast")}
            className={`h-8 rounded-md text-[11px] font-bold ${aiQuality === "fast" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            빠르게 (1K)
          </button>
          <button
            type="button"
            onClick={() => setAiQuality("print")}
            className={`h-8 rounded-md text-[11px] font-bold ${aiQuality === "print" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            선명하게 (고화질)
          </button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">한 번에 시안 3장. 버튼은 누를 때만 호출합니다.</p>
        <button
          type="button"
          disabled={Boolean(busy) || aiAvailable === false}
          onClick={generate}
          className="mt-3 flex h-10 w-full items-center justify-center rounded-md bg-ai text-[13px] font-bold text-ai-foreground hover:brightness-110 disabled:opacity-55"
        >
          {busy ? busy : "AI 시안 A·B·C 만들기"}
        </button>
      </section>

      {drafts.length ? (
        <section className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="panel-label">AI가 제안한 시안</p>
            <span className="text-[10px] font-bold text-muted-foreground">{drafts.length}종</span>
          </div>
          <div className="mt-2 space-y-2">
            {drafts.map((draft) => (
              <button key={draft.id} type="button" onClick={() => { useStudio.getState().setActive(draft.id); setMode("edit"); }} className={`w-full rounded-lg border p-2 text-left ${draft.id === active?.id ? "border-primary bg-muted" : "border-border bg-card"}`}>
                <span className="flex items-center gap-2"><b className="inline-flex size-6 items-center justify-center rounded bg-primary text-[11px] text-primary-foreground">{draft.letter}</b><span className="min-w-0"><strong className="block truncate text-[12px]">{draft.title}</strong><small className="block text-[10px] text-muted-foreground">{draft.source === "ai" ? "AI 디자인" : draft.source === "type" ? "타이포 시안" : "빈 도화지"} · 선택해서 편집</small></span></span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="border-b border-border px-4 py-3">
        <p className="panel-label">배경 다듬기</p>
        <p className="mt-1 text-[11px] text-muted-foreground">선택된 AI 시안의 사진만 바꿉니다. 글자 레이어는 유지됩니다.</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {REFINES.map((r) => (
            <button
              key={r.id}
              type="button"
              disabled={Boolean(busy) || !active?.aiImage}
              onClick={() => refine(r.prompt, r.label)}
              className="h-8 rounded-md border border-border bg-card px-2.5 text-[11px] font-bold disabled:opacity-45"
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-1.5">
          <input value={customRefine} onChange={(e) => setCustomRefine(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && customRefine.trim()) refine(customRefine.trim(), "자연어 수정"); }} placeholder="예: 글씨 공간을 더 넓히고 고급스럽게" className="h-9 min-w-0 flex-1 rounded-md border border-border bg-card px-2.5 text-[11px] outline-none focus:ring-2 focus:ring-ring/30" />
          <button type="button" disabled={Boolean(busy) || !active?.aiImage || !customRefine.trim()} onClick={() => refine(customRefine.trim(), "자연어 수정")} className="h-9 rounded-md bg-ai px-3 text-[11px] font-bold text-ai-foreground disabled:opacity-45">AI 수정</button>
        </div>
      </section>

      <section className="px-4 py-3">
        <p className="panel-label">카피 제안</p>
        <p className="mt-1 text-[11px] text-muted-foreground">상호는 바꾸지 않습니다. 메인 문구가 비어 있을 때만 후보를 고르세요.</p>
        <button
          type="button"
          disabled={Boolean(busy) || aiAvailable === false}
          onClick={suggest}
          className="mt-2 h-8 rounded-md border border-border px-3 text-[12px] font-bold disabled:opacity-45"
        >
          문구 다듬기
        </button>
        {ideas ? (
          <div className="mt-3 space-y-2">
            {ideas.tone ? <p className="text-[12px] text-muted-foreground">{ideas.tone}</p> : null}
            {ideas.headlines.map((line) => (
              <button
                key={line}
                type="button"
                onClick={() => setBrief({ headline: line })}
                className="block w-full rounded-md border border-border bg-card px-2 py-1.5 text-left text-[12px] font-bold"
              >
                {line}
              </button>
            ))}
            {ideas.subheads.map((line) => (
              <button
                key={line}
                type="button"
                onClick={() => setBrief({ subhead: line })}
                className="block w-full rounded-md px-2 py-1 text-left text-[12px] text-muted-foreground hover:bg-muted"
              >
                {line}
              </button>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
