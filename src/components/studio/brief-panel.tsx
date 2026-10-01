import type { ReactNode } from "react";
import { FONTS, INDUSTRIES, KIND_LABEL, MOODS, PURPOSES, SIZES } from "@/lib/studio/catalog";
import { useStudio } from "@/lib/studio/store";
import type { Industry, Mood, ProductKind } from "@/lib/studio/types";
import { toast } from "sonner";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-2.5 block">
      <span className="mb-1 block text-[11.5px] leading-tight text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "h-8 w-full rounded-md border border-border bg-card px-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring/30";
const areaClass =
  "min-h-16 w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring/30";

export function BriefPanel() {
  const brief = useStudio((s) => s.brief);
  const setBrief = useStudio((s) => s.setBrief);
  const makeTypeDrafts = useStudio((s) => s.makeTypeDrafts);
  const resizeDrafts = useStudio((s) => s.resizeDrafts);
  const fillSample = useStudio((s) => s.fillSample);
  const setMode = useStudio((s) => s.setMode);

  const kinds: ProductKind[] = ["banner", "zoom", "web", "card", "flyer", "sticker", "custom"];
  const activeKind = SIZES.find((s) => s.id === brief.sizeId)?.kind ?? "banner";
  const kindSizes = SIZES.filter((s) => s.kind === activeKind || s.kind === "custom");

  function applySize(sizeId: string, width: number, height: number) {
    setBrief({ sizeId, customW: width, customH: height });
    resizeDrafts(width, height);
    setMode("edit");
  }

  function applyCustomSize() {
    const width = Math.max(40, brief.customW);
    const height = Math.max(40, brief.customH);
    setBrief({ sizeId: "custom", customW: width, customH: height });
    resizeDrafts(width, height);
    setMode("edit");
    toast.success(`작업 크기를 ${width} × ${height} mm로 변경했습니다.`);
  }

  function generate() {
    if (!brief.headline.trim() && !brief.notes.trim()) {
      toast.error("주문내용이 없어 시안을 만들 수 없습니다. 주문 접수에서 주문내용을 먼저 넣어 주세요.");
      return;
    }
    setBrief({ emphasize: "copy" });
    const check = makeTypeDrafts();
    if (check.errors.length) toast.message(check.errors[0]);
    else toast.success("주문내용 기준으로 시안 A·B·C를 만들었습니다.");
  }

  return (
    <div className="space-y-0">
      <div className="border-b border-border px-4 py-3">
        <p className="panel-label">작업지시서</p>
        <h2 className="mt-1 text-base font-black tracking-tight">광고물 작업실</h2>
      </div>

      <section className="border-b border-border px-4 py-3">
        <p className="panel-label">1. 규격</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                const first = SIZES.find((s) => s.kind === k);
                if (first) applySize(first.id, first.wMm, first.hMm);
              }}
              className={`h-8 rounded-md px-2.5 text-[11px] font-bold ${
                activeKind === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1">
          {kindSizes.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => applySize(s.id, s.wMm, s.hMm)}
              className={`rounded-md border px-2 py-1.5 text-left ${
                brief.sizeId === s.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
              }`}
            >
              <span className="block text-[11px] font-bold">{s.label}</span>
              {s.note ? <span className="mt-0.5 block text-[10px] opacity-80">{s.note}</span> : null}
            </button>
          ))}
        </div>
        {brief.sizeId === "custom" ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Field label="가로 (mm)">
              <input className={inputClass} type="number" value={brief.customW} onChange={(e) => setBrief({ customW: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="세로 (mm)">
              <input className={inputClass} type="number" value={brief.customH} onChange={(e) => setBrief({ customH: Number(e.target.value) || 0 })} />
            </Field>
            <button
              type="button"
              onClick={applyCustomSize}
              className="col-span-2 h-9 rounded-md bg-primary text-[12px] font-black text-primary-foreground"
            >
              현재 시안에 크기 적용
            </button>
          </div>
        ) : null}
        <Field label="읽는 거리 (m)">
          <input
            className={inputClass}
            type="number"
            min={1}
            max={40}
            value={brief.readDistanceM}
            onChange={(e) => setBrief({ readDistanceM: Number(e.target.value) || 8 })}
          />
        </Field>
      </section>

      <section className="border-b border-border px-4 py-3">
        <p className="panel-label">2. 기본</p>
        <p className="mb-1 mt-2 text-[11.5px] text-muted-foreground">업종</p>
        <div className="grid grid-cols-3 gap-1">
          {INDUSTRIES.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => setBrief({ industry: it.id as Industry })}
              className={`h-8 rounded-md px-1 text-[11px] font-bold ${
                brief.industry === it.id ? "bg-primary text-primary-foreground" : "bg-card text-foreground border border-border"
              }`}
            >
              {it.label}
            </button>
          ))}
        </div>
        <p className="mb-1 mt-3 text-[11.5px] text-muted-foreground">사용 목적</p>
        <div className="flex flex-wrap gap-1">
          {PURPOSES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setBrief({ purpose: p.id })}
              className={`h-8 rounded-md px-2 text-[11px] font-bold ${
                brief.purpose === p.id ? "bg-primary text-primary-foreground" : "border border-border bg-card"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>

      <section className="border-b border-border px-4 py-3">
        <p className="panel-label">3. 분위기 · 색상</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {MOODS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setBrief({ mood: m.id as Mood })}
              className={`h-8 rounded-md px-2.5 text-[11px] font-bold ${
                brief.mood === m.id ? "bg-primary text-primary-foreground" : "border border-border bg-card"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
          문구는 개별 입력칸 없이 주문 접수의 주문내용을 자동 분석해서 넣습니다.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Field label="기본 색">
            <input type="color" className="h-8 w-full cursor-pointer rounded border border-border" value={brief.baseColor} onChange={(e) => setBrief({ baseColor: e.target.value })} />
          </Field>
          <Field label="강조색">
            <input type="color" className="h-8 w-full cursor-pointer rounded border border-border" value={brief.accentColor} onChange={(e) => setBrief({ accentColor: e.target.value })} />
          </Field>
          <Field label="제목 글꼴">
            <select className={inputClass} value={brief.titleFont} onChange={(e) => setBrief({ titleFont: e.target.value })}>
              {FONTS.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </Field>
          <Field label="본문 글꼴">
            <select className={inputClass} value={brief.bodyFont} onChange={(e) => setBrief({ bodyFont: e.target.value })}>
              {FONTS.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="rounded-md border border-border p-2" style={{ background: brief.baseColor }}>
          <p style={{ fontFamily: brief.titleFont, fontWeight: 800, fontSize: 16, color: "#f8f5f0" }}>제목 미리보기</p>
          <p style={{ fontFamily: brief.bodyFont, color: brief.accentColor, fontSize: 12 }}>본문 · 강조색 미리보기</p>
        </div>
      </section>

      <section className="border-b border-border px-4 py-3">
        <p className="panel-label">4. 주문내용 기반 문구</p>
        <div className="mt-2 rounded-lg border border-border bg-card p-3 text-[11.5px]">
          <div className="grid grid-cols-[64px_1fr] gap-2">
            <span className="text-muted-foreground">대표 문구</span>
            <span className="font-bold">{brief.headline || "주문내용에서 자동 추출"}</span>
          </div>
          <div className="mt-2 grid grid-cols-[64px_1fr] gap-2">
            <span className="text-muted-foreground">보조 문구</span>
            <span>{brief.subhead || "필요 시 자동 추출"}</span>
          </div>
          <div className="mt-2 grid grid-cols-[64px_1fr] gap-2">
            <span className="text-muted-foreground">주문 원문</span>
            <span className="whitespace-pre-wrap break-words text-[11px] text-muted-foreground">{brief.notes || "주문 접수에서 주문내용을 먼저 입력해 주세요."}</span>
          </div>
        </div>
      </section>

      <section className="border-b border-border px-4 py-3">
        <p className="panel-label">5. 로고 · 사진</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-[11.5px] text-muted-foreground">로고</span>
            <input
              type="file"
              accept="image/*"
              className="w-full text-[11px]"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => setBrief({ logoDataUrl: String(reader.result) });
                reader.readAsDataURL(file);
              }}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11.5px] text-muted-foreground">사진</span>
            <input
              type="file"
              accept="image/*"
              className="w-full text-[11px]"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => setBrief({ photoDataUrl: String(reader.result) });
                reader.readAsDataURL(file);
              }}
            />
          </label>
        </div>
      </section>

      <div className="sticky bottom-0 space-y-2 border-t border-border bg-panel px-4 py-3">
        <button
          type="button"
          onClick={generate}
          className="flex h-10 w-full items-center justify-center rounded-md bg-primary text-[13px] font-bold text-primary-foreground hover:brightness-110"
        >
          시안 A·B·C 만들기
        </button>
        <button
          type="button"
          onClick={() => setMode("ai")}
          className="flex h-10 w-full items-center justify-center rounded-md bg-ai text-[13px] font-bold text-ai-foreground hover:brightness-110"
        >
          AI 디자인 생성으로
        </button>
        <button
          type="button"
          onClick={() => {
            fillSample();
            toast("예시 문구를 넣었습니다. 상단 주문 접수 없이도 빠르게 테스트할 수 있습니다.");
          }}
          className="h-8 w-full rounded-md border border-border text-[12px] font-medium text-muted-foreground hover:bg-muted"
        >
          예시 채우기
        </button>
      </div>
    </div>
  );
}
