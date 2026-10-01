import type { ComponentType, ReactNode } from "react";
import type { PrintGuideFigureId } from "@/lib/catalog";

function Frame({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <figure className="overflow-hidden rounded-[var(--radius-md)] bg-elevated shadow-[var(--shadow-border)]">
      <div className="bg-[#efe6d6] p-3 sm:p-4">{children}</div>
      <figcaption className="border-t border-border px-3 py-2 text-[12px] leading-snug text-muted">
        {caption}
      </figcaption>
    </figure>
  );
}

function NewDocFigure() {
  return (
    <div className="mx-auto max-w-lg">
      <p className="mb-2 text-center text-[12px] font-semibold text-stamp">사방 여백 3mm</p>
      <div className="rounded-md border-2 border-dashed border-stamp/70 bg-stamp/10 p-3">
        <div className="relative grid h-[9.5rem] grid-cols-2 border border-fg bg-surface sm:h-44">
          <span className="absolute top-1 left-1 text-[10px] font-semibold text-stamp">3mm</span>
          <span className="absolute top-1 right-1 text-[10px] font-semibold text-stamp">3mm</span>
          <div className="flex items-center justify-center border-r border-dashed border-primary text-[12px] text-muted sm:text-sm">
            A4 210mm
          </div>
          <div className="flex items-center justify-center text-[12px] text-muted sm:text-sm">A4 210mm</div>
        </div>
      </div>
      <p className="mt-2 text-center text-[13px] font-semibold">420 × 297 mm · 단위 mm</p>
    </div>
  );
}

function PaletteFigure() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-stretch gap-3 sm:flex-row">
      <div className="flex-1 rounded-[10px] border border-border bg-surface p-3">
        <div className="flex h-32 items-center justify-center rounded-md bg-[#efe6d6] text-sm text-subtle sm:h-40">
          작업 화면
        </div>
      </div>
      <div className="w-full rounded-[10px] border border-fg bg-surface sm:w-52">
        <div className="flex items-center justify-between rounded-t-[9px] bg-primary px-3 py-2 text-primary-fg">
          <span className="text-sm font-bold">대지</span>
          <span className="grid size-8 place-items-center rounded-full bg-[#fff4d6] text-fg ring-2 ring-stamp">
            <span className="flex flex-col gap-0.5" aria-hidden>
              <span className="h-0.5 w-3.5 bg-fg" />
              <span className="h-0.5 w-3.5 bg-fg" />
              <span className="h-0.5 w-3.5 bg-fg" />
            </span>
          </span>
        </div>
        <ul className="space-y-2 p-3 text-sm">
          <li className="rounded-md bg-[#efe6d6] px-2 py-2">대지 1</li>
          <li className="rounded-md bg-[#efe6d6] px-2 py-2">대지 2</li>
          <li className="rounded-md bg-[#efe6d6] px-2 py-2">대지 3</li>
        </ul>
        <p className="px-3 pb-3 text-[12px] font-semibold text-stamp">여기 삼선(≡)을 누름</p>
      </div>
    </div>
  );
}

function ArrangeFigure() {
  return (
    <div className="mx-auto grid max-w-xl gap-3 sm:grid-cols-2">
      <div className="rounded-[12px] border border-border bg-surface p-3">
        <p className="text-center text-sm font-bold">1쪽 · 아래로</p>
        <div className="mx-auto mt-3 flex w-28 flex-col gap-2">
          <div className="h-10 border border-fg bg-elevated" />
          <div className="h-10 border-2 border-primary bg-elevated" />
          <div className="h-10 border border-fg bg-elevated" />
        </div>
        <p className="mt-3 text-center text-[12px] text-accent">한 장씩 쌓기</p>
      </div>
      <div className="rounded-[12px] border border-border bg-surface p-3">
        <p className="text-center text-sm font-bold">8~10쪽 · 옆으로</p>
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={i}
              className={`h-12 bg-elevated ${i === 0 ? "border-2 border-primary" : "border border-fg"}`}
            />
          ))}
        </div>
        <p className="mt-3 text-center text-[12px] text-accent">가로로 펼치기</p>
      </div>
    </div>
  );
}

function BleedFigure() {
  return (
    <div className="mx-auto grid max-w-xl gap-3 sm:grid-cols-2">
      <div className="rounded-[12px] border border-border bg-surface p-3">
        <p className="text-center text-sm font-bold text-stamp">잘못 · 흰 선</p>
        <div className="relative mx-auto mt-3 h-28 w-40 border border-dashed border-stamp">
          <div className="absolute inset-y-2 left-2 right-2 bg-[#d9e7f5]" />
          <div className="absolute inset-y-2 left-2 w-1.5 bg-surface" />
          <div className="absolute inset-y-2 right-2 w-1.5 bg-surface" />
        </div>
        <p className="mt-3 text-center text-[12px] text-muted">재단선에 색이 멈춤</p>
      </div>
      <div className="rounded-[12px] border border-border bg-surface p-3">
        <p className="text-center text-sm font-bold text-ok">맞음 · 밖으로</p>
        <div className="relative mx-auto mt-3 h-28 w-40 bg-[#9ec4e8]">
          <div className="absolute inset-[10px] border-[1.6px] border-fg" />
          <p className="absolute inset-0 grid place-items-center text-[12px]">재단선</p>
        </div>
        <p className="mt-3 text-center text-[12px] text-muted">색이 3mm 여백까지</p>
      </div>
    </div>
  );
}

function EpsFigure() {
  return (
    <div className="mx-auto flex max-w-xl flex-wrap items-center justify-center gap-2 py-2">
      <div className="rounded-[12px] border border-fg bg-surface px-5 py-5 text-sm font-bold">작업 파일</div>
      <span className="text-lg font-bold text-primary">→</span>
      <div className="rounded-[12px] bg-primary px-5 py-5 text-center text-primary-fg">
        <p className="text-base font-bold">EPS</p>
        <p className="text-[12px] opacity-90">CS5 이하</p>
      </div>
      <span className="text-lg font-bold text-primary">→</span>
      <div className="rounded-md border border-fg bg-[#efe6d6] px-3 py-5 text-[12px] font-medium">넘김</div>
      <p className="w-full text-center text-[13px] font-semibold text-stamp">재단 여분(3mm)을 빼고 저장</p>
    </div>
  );
}

function Key({ children, accent }: { children: ReactNode; accent?: boolean }) {
  return (
    <span
      className={`inline-flex min-w-12 items-center justify-center rounded-md px-2 py-1.5 text-[12px] font-semibold ${
        accent ? "bg-primary text-primary-fg" : "bg-fg text-primary-fg"
      }`}
    >
      {children}
    </span>
  );
}

function FontFigure() {
  return (
    <div className="mx-auto grid max-w-xl gap-3 sm:grid-cols-2">
      <div className="overflow-hidden rounded-[12px] border border-border bg-surface">
        <p className="bg-primary px-3 py-2 text-sm font-bold text-primary-fg">글꼴 찾기</p>
        <div className="space-y-3 p-3">
          <div className="rounded-md border border-stamp bg-[#fff4d6] px-3 py-2 text-[13px] text-warn">
            노란 경고 · 없는 서체
          </div>
          <div className="flex gap-2">
            <span className="flex-1 rounded-md bg-[#efe6d6] py-2 text-center text-[13px]">찾기</span>
            <span className="flex-1 rounded-md bg-fg py-2 text-center text-[13px] text-primary-fg">모두 바꾸기</span>
          </div>
          <p className="text-[12px] leading-relaxed text-muted">
            한 글자씩 마우스로 바꾸지 말 것.
            <br />
            시스템 글꼴에서 고른다.
          </p>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center rounded-[12px] border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Key>Ctrl</Key>
          <Key>A</Key>
          <span className="text-primary">→</span>
          <Key>Ctrl</Key>
          <Key>Shift</Key>
          <Key accent>O</Key>
        </div>
        <p className="mt-3 text-sm font-bold">윤곽선 만들기</p>
        <p className="mt-1 text-center text-[12px] text-muted">
          서체를 도형으로 깬다.
          <br />
          깨면 글꼴 찾기에 안 보인다.
        </p>
      </div>
    </div>
  );
}

function ProofFigure() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-2 sm:flex-row sm:items-stretch">
      <div className="w-full rounded-md border border-fg bg-surface p-4 sm:w-1/2">
        <p className="text-center text-[13px] font-bold">출력용</p>
        <p className="mt-3 text-center font-display text-lg font-bold">애드스마일</p>
        <div className="mx-auto mt-3 space-y-2">
          <div className="h-2.5 rounded-sm bg-border" />
          <div className="h-2.5 w-4/5 rounded-sm bg-border" />
          <div className="h-2.5 w-5/6 rounded-sm bg-border" />
        </div>
        <p className="mt-6 text-center text-[12px] font-medium text-ok">지정 서체</p>
      </div>
      <p className="hidden text-2xl text-primary sm:grid sm:place-items-center">↔</p>
      <div className="w-full rounded-md border border-fg bg-surface p-4 sm:w-1/2">
        <p className="text-center text-[13px] font-bold">건축용</p>
        <p className="mt-3 rounded bg-[#ffe566] py-1 text-center text-lg" style={{ fontFamily: "serif" }}>
          애드스마일
        </p>
        <div className="mx-auto mt-3 space-y-2">
          <div className="h-2.5 rounded-sm bg-border" />
          <div className="h-2.5 w-4/5 rounded-sm bg-border" />
          <div className="rounded bg-[#ffe566] p-1">
            <div className="h-2.5 w-5/6 rounded-sm bg-[#c4b49e]" />
          </div>
        </div>
        <p className="mt-6 text-center text-[12px] font-medium text-stamp">굴림으로 바뀜 · 노란 체크</p>
      </div>
    </div>
  );
}

const FIGURES: Record<PrintGuideFigureId, ComponentType> = {
  "new-doc": NewDocFigure,
  palette: PaletteFigure,
  arrange: ArrangeFigure,
  bleed: BleedFigure,
  eps: EpsFigure,
  font: FontFigure,
  proof: ProofFigure,
};

export function PrintGuideFigure({ id, caption }: { id: PrintGuideFigureId; caption: string }) {
  const Figure = FIGURES[id];
  return (
    <Frame caption={caption}>
      <Figure />
    </Frame>
  );
}
