import { TITLE_STYLE_BG, type TitleCard } from "@/lib/video/slideshow";
import { TITLE_MOTION_OPTIONS, TITLE_STYLE_OPTIONS } from "@/lib/video/director";

export function TitleFields({
  card,
  allowBackgroundImage = false,
  onChange,
  onImage,
}: {
  card: TitleCard;
  allowBackgroundImage?: boolean;
  onChange: (next: TitleCard) => void;
  onImage?: (slot: "logo" | "bg", file: File) => void;
}) {
  const set = (partial: Partial<TitleCard>) => onChange({ ...card, ...partial, role: card.role });
  return (
    <div className="space-y-2">
      <label className="block">{card.role === "intro" ? "메인 제목" : "엔딩 메인 문구"}
        <input value={card.main} onChange={(e) => set({ main: e.target.value })} className="mt-1 h-8 w-full rounded bg-white/10 px-2" />
      </label>
      {card.role === "intro" ? (
        <label className="block">보조 제목
          <input value={card.sub} onChange={(e) => set({ sub: e.target.value })} className="mt-1 h-8 w-full rounded bg-white/10 px-2" />
        </label>
      ) : (
        <label className="block">보조 문구
          <input value={card.sub || card.thanks} onChange={(e) => set({ sub: e.target.value, thanks: e.target.value })} className="mt-1 h-8 w-full rounded bg-white/10 px-2" />
        </label>
      )}
      {card.role === "ending" ? (
        <label className="block">회사명 또는 모임명
          <input value={card.org} onChange={(e) => set({ org: e.target.value })} className="mt-1 h-8 w-full rounded bg-white/10 px-2" />
        </label>
      ) : null}
      <label className="block">날짜
        <input value={card.date} onChange={(e) => set({ date: e.target.value })} placeholder="2026. 10. 1" className="mt-1 h-8 w-full rounded bg-white/10 px-2" />
      </label>
      <label className="block">표시 시간
        <input
          type="number"
          min={3}
          max={30}
          step={0.5}
          value={card.seconds}
          onChange={(e) => set({ seconds: Math.min(30, Math.max(3, Number(e.target.value) || card.seconds)) })}
          className="mt-1 h-8 w-full rounded bg-white/10 px-2"
        />
        <span className="mt-1 block text-[10px] text-white/40">
          {card.role === "intro"
            ? "기본 7초. 5초에서 8초가 무난합니다."
            : "기본 6초. 5초에서 7초가 무난합니다. 이 구간에서 배경음악이 0까지 작아집니다."}
        </span>
      </label>
      <div>
        <p className="text-[11px] text-white/50">스타일</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {TITLE_STYLE_OPTIONS.map((option) => (
            <button key={option.id} type="button" onClick={() => set({ style: option.id, bg: TITLE_STYLE_BG[option.id] })} className={`rounded px-2 py-1 text-[11px] font-bold ${card.style === option.id ? "bg-[#D4A04E] text-[#1c150e]" : "bg-white/10"}`}>
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[11px] text-white/50">움직임</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {TITLE_MOTION_OPTIONS.map((option) => (
            <button key={option.id} type="button" onClick={() => set({ motion: option.id })} className={`rounded px-2 py-1 text-[11px] font-bold ${card.motion === option.id ? "bg-[#D4A04E] text-[#1c150e]" : "bg-white/10"}`}>
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-2">배경색
          <input type="color" value={toHex(card.bg)} onChange={(e) => set({ bg: e.target.value })} />
        </label>
        <button type="button" onClick={() => set({ bg: "#000000" })} className="rounded bg-black px-2 py-1 text-[11px] font-bold ring-1 ring-white/30">검정</button>
        <label className="relative inline-flex h-7 cursor-pointer items-center overflow-hidden rounded bg-white/10 px-2 text-[11px] font-bold">
          고객 로고
          <input type="file" accept="image/*" className="absolute inset-0 cursor-pointer opacity-0" onChange={(e) => { const file = e.target.files?.[0]; if (file) onImage?.("logo", file); e.target.value = ""; }} />
        </label>
        {card.logo ? <button type="button" onClick={() => set({ logo: "" })} className="text-[11px] text-white/50">로고 빼기</button> : null}
        {allowBackgroundImage ? (
          <>
            <label className="relative inline-flex h-7 cursor-pointer items-center overflow-hidden rounded bg-white/10 px-2 text-[11px] font-bold">
              배경 이미지
              <input type="file" accept="image/*" className="absolute inset-0 cursor-pointer opacity-0" onChange={(e) => { const file = e.target.files?.[0]; if (file) onImage?.("bg", file); e.target.value = ""; }} />
            </label>
            {card.bgImage ? <button type="button" onClick={() => set({ bgImage: undefined })} className="text-[11px] text-white/50">배경 빼기</button> : null}
          </>
        ) : null}
      </div>
      <p className="text-[10px] leading-relaxed text-white/40">회사, 모임, 고객 로고만 영상에 들어갑니다. 프로그램 로고는 편집 화면에만 있고 최종 영상에는 넣지 않습니다.</p>
    </div>
  );
}

function toHex(color: string) {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#1a140f";
}
