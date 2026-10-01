import { AlertCircle, ArrowRight, CheckCircle2, ClipboardPaste, FileText, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { analysisToBrief, analyzeOrder, type OrderAnalysis } from "@/lib/studio/order-parser";
import { analyzeOrderContent } from "@/lib/ai/generate";
import { useStudio } from "@/lib/studio/store";

const SAMPLE = `2026 한마음 체육대회
10월 15일 군산체육관에서 진행합니다.
현수막 5m×90cm 1장
입구 X배너 600×1800mm 2개`;

export function OrderPanel() {
  const brief = useStudio((s) => s.brief);
  const setBrief = useStudio((s) => s.setBrief);
  const resizeDrafts = useStudio((s) => s.resizeDrafts);
  const makeTypeDrafts = useStudio((s) => s.makeTypeDrafts);
  const resetDrafts = useStudio((s) => s.resetDrafts);
  const setMode = useStudio((s) => s.setMode);
  const [source, setSource] = useState(() => localStorage.getItem("makearoad-order-v1") || "");
  const [analysis, setAnalysis] = useState<OrderAnalysis | null>(null);
  const canAnalyze = source.trim().length > 3;

  useEffect(() => {
    const pending = sessionStorage.getItem("adsmile-studio-order");
    if (!pending) return;
    sessionStorage.removeItem("adsmile-studio-order");
    setSource(pending);
    setAnalysis(null);
  }, []);

  const summary = useMemo(() => {
    if (!analysis) return "";
    return analysis.items.map((item) => `${item.label} ${item.sizeText} ${item.quantity}개`).join(" · ");
  }, [analysis]);

  async function runAnalysis() {
    if (!canAnalyze) {
      toast.error("주문내용을 먼저 입력해 주세요.");
      return;
    }
    localStorage.setItem("makearoad-order-v1", source);
    // 새 주문은 이전 주문의 문구/업종/시안을 절대 이어받지 않는다.
    resetDrafts();
    setBrief({
      name: "", headline: "", subhead: "", price: "", date: "", place: "", phone: "", address: "",
      notes: source.trim(), industry: "general", purpose: "custom", mood: "warm", emphasize: "copy",
      logoDataUrl: null, photoDataUrl: null,
    });
    toast.message("AI가 새 주문만 기준으로 내용을 분석하고 있습니다…");
    const ai = await analyzeOrderContent({ data: { source } });
    if (ai.ok) {
      const result: OrderAnalysis = {
        name: ai.analysis.name,
        headline: ai.analysis.headline,
        subhead: ai.analysis.subhead,
        date: "",
        place: "",
        phone: "",
        items: ai.analysis.items,
        missing: ai.analysis.missing,
        source: source.trim(),
      };
      setAnalysis(result);
      // 분석이 끝나는 즉시 현재 주문의 규격/문구를 작업 상태에 반영한다.
      // 사용자가 작업지시 버튼을 누르지 않고 바로 AI 생성을 눌러도 기본 규격이 남지 않게 한다.
      setBrief(analysisToBrief(result, useStudio.getState().brief));
      makeTypeDrafts();
      setMode("order");
      toast.success("주문내용을 적용해 기본 시안 3종을 바로 만들었습니다.");
      return;
    }
    // AI 연결이 잠시 unavailable한 경우에만 기본 분석으로 화면을 막지 않는다.
    const fallback = analyzeOrder(source);
    setAnalysis(fallback);
    setBrief(analysisToBrief(fallback, useStudio.getState().brief));
    makeTypeDrafts();
    setMode("order");
    toast.message(`AI 분석을 사용할 수 없어 기본 분석으로 표시했습니다. ${ai.error}`);
  }

  function createWorkOrder() {
    if (!analysis) return;
    const patch = analysisToBrief(analysis, brief);
    setBrief(patch);
    if (patch.customW && patch.customH) resizeDrafts(patch.customW, patch.customH);
    if (!analysis.headline) {
      setMode("brief");
      toast.message("메인 문구를 확인한 뒤 시안을 만들어 주세요.");
      return;
    }
    const result = makeTypeDrafts();
    if (result.errors.length) {
      setMode("brief");
      toast.message(result.errors[0]);
      return;
    }
    setMode("edit");
    toast.success("작업지시서를 적용하고 시안 3종을 만들었습니다.");
  }

  return (
    <div className="space-y-0">
      <div className="border-b border-border px-4 py-3">
        <p className="panel-label">AI 주문 접수</p>
        <h2 className="mt-1 text-base font-black tracking-tight">주문내용 분석</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          고객의 주문내용을 그대로 입력하거나 붙여넣어 주세요.
        </p>
      </div>

      <section className="border-b border-border px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11.5px] font-bold">주문내용</span>
          <button type="button" onClick={() => { setSource(SAMPLE); setAnalysis(null); }} className="text-[10.5px] font-bold text-primary hover:underline">
            예시 불러오기
          </button>
        </div>
        <div className="relative">
          <ClipboardPaste className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <textarea
            value={source}
            onChange={(event) => { setSource(event.target.value); setAnalysis(null); }}
            className="min-h-44 w-full resize-y rounded-lg border border-border bg-card py-2.5 pl-8 pr-2.5 text-xs leading-relaxed text-foreground outline-none focus:ring-2 focus:ring-ring/30"
            placeholder={'예: 10월 15일 군산체육관 체육대회\n현수막 5m×90cm 1장\n입구 X배너 2개'}
          />
        </div>
        <button
          type="button"
          onClick={runAnalysis}
          disabled={!canAnalyze}
          className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-ai text-[12px] font-black text-ai-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Sparkles className="size-4" /> 주문내용 AI 분석
        </button>
      </section>

      {analysis ? (
        <>
          <section className="border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              <div>
                <p className="panel-label">분석 결과</p>
                <h3 className="text-[13px] font-black">AI 작업지시서</h3>
              </div>
            </div>
            <dl className="mt-3 space-y-2 rounded-lg border border-border bg-card p-3 text-[11.5px]">
              <div className="grid grid-cols-[58px_1fr] gap-2"><dt className="text-muted-foreground">기관·상호</dt><dd>{analysis.name || "입력 없음"}</dd></div>
              <div className="grid grid-cols-[58px_1fr] gap-2"><dt className="text-muted-foreground">대표 문구</dt><dd className="font-bold">{analysis.headline || "확인 필요"}</dd></div>
              <div className="grid grid-cols-[58px_1fr] gap-2"><dt className="text-muted-foreground">보조 문구</dt><dd>{analysis.subhead || "자동 선택 없음"}</dd></div>
              <div className="grid grid-cols-[58px_1fr] gap-2"><dt className="text-muted-foreground">품목</dt><dd className="font-bold">{summary || "확인 필요"}</dd></div>
            </dl>
          </section>

          <section className="border-b border-border px-4 py-3">
            {analysis.missing.length ? (
              <div className="rounded-lg border border-warning/40 bg-warning/10 p-3">
                <div className="flex items-center gap-1.5 text-[11.5px] font-black text-warning"><AlertCircle className="size-4" /> 추가 확인사항</div>
                <p className="mt-1 text-[11px] text-muted-foreground">{analysis.missing.join(" · ")}</p>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-safe/30 bg-safe/10 p-3 text-[11.5px] font-bold text-safe">
                <CheckCircle2 className="size-4" /> 필수 작업정보가 모두 확인되었습니다.
              </div>
            )}
            <button type="button" onClick={createWorkOrder} className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-[12px] font-black text-primary-foreground">
              이 시안 편집하기 <ArrowRight className="size-4" />
            </button>
            <button type="button" onClick={() => { setBrief(analysisToBrief(analysis, brief)); setMode("brief"); }} className="mt-2 h-9 w-full rounded-lg border border-border bg-card text-[11.5px] font-bold">
              분석된 주문내용 확인하기
            </button>
          </section>
        </>
      ) : null}
    </div>
  );
}
