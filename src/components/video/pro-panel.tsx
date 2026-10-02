import { useState } from "react";
import {
  ENTERS,
  EXITS,
  GRADE_PRESETS,
  NEUTRAL_GRADE,
  SCENE_TRANSITIONS,
  SPEEDS,
  TEXT_FONTS,
  TEXT_PRESETS,
  gradePreset,
  retimed,
  textPresetPatch,
  transitionSeconds,
  type FontChoice,
  type Grade,
  type Keyframe,
  type SpeedRamp,
  type TextAlign,
  type TextEnter,
  type TextExit,
  type UserPreset,
} from "@/lib/video/pro-edit";

export type ProClip = {
  id: string;
  kind: string;
  name: string;
  text: string;
  color: string;
  fontSize: number;
  x: number;
  y: number;
  volume: number;
  duration: number;
  start: number;
  transition?: string;
  textMotion?: string;
  textStyle?: string;
  title?: { role?: string };
  pip?: boolean;
  font?: string;
  fontWeight?: number;
  letterSpacing?: number;
  lineHeight?: number;
  align?: TextAlign;
  strokeWidth?: number;
  strokeColor?: string;
  textShadow?: number;
  box?: boolean;
  boxColor?: string;
  boxAlpha?: number;
  opacity?: number;
  rotate?: number;
  placed?: boolean;
  enter?: TextEnter;
  exit?: TextExit;
  enterSec?: number;
  exitSec?: number;
  animSpeed?: number;
  transitionSec?: number;
  grade?: Grade;
  keyframes?: Keyframe[];
  speed?: number;
  speedRamp?: SpeedRamp;
  scale?: number;
  radius?: number;
  pipShadow?: number;
};

export function ProTools({
  safeOn,
  onSafe,
  onOverlay,
}: {
  safeOn: boolean;
  onSafe: (on: boolean) => void;
  onOverlay: (file: File | undefined) => void;
}) {
  return (
    <div className="mt-3 space-y-2 border-b border-white/10 pb-3">
      <button type="button" onClick={() => onSafe(!safeOn)} className={`h-8 rounded-md px-2 text-[11px] font-bold ${safeOn ? "bg-[#D4A04E] text-[#1c150e]" : "bg-white/10"}`}>
        안전영역 {safeOn ? "켜짐" : "꺼짐"}
      </button>
      <label className="flex h-8 cursor-pointer items-center justify-center rounded-md border border-white/15 text-[11px] font-bold">
        로고·프레임 올리기
        <input type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" className="hidden" onChange={(e) => { onOverlay(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      <p className="text-[10px] leading-relaxed text-white/40">PNG는 투명하게 올라갑니다. 위치, 크기, 투명도, 모서리, 그림자는 올린 뒤 조절합니다.</p>
    </div>
  );
}

export function ProPanel({
  clip,
  time,
  fonts,
  presets,
  onPatch,
  onSavePreset,
  onApplyPreset,
  onDeletePreset,
  onApplyTitle,
}: {
  clip: ProClip;
  time: number;
  fonts: FontChoice[];
  presets: UserPreset[];
  onPatch: (partial: Partial<ProClip>) => void;
  onSavePreset: (kind: UserPreset["kind"], label: string) => void;
  onApplyPreset: (preset: UserPreset) => void;
  onDeletePreset: (id: string) => void;
  onApplyTitle: (role: "intro" | "ending", payload: unknown) => void;
}) {
  const [presetName, setPresetName] = useState("");
  const textClip = clip.kind === "text" && !clip.title;
  const visual = (clip.kind === "image" || clip.kind === "video") && !clip.title;
  const elapsed = Math.max(0, time - clip.start);
  const grade = clip.grade ?? NEUTRAL_GRADE;
  const boxOn = clip.box ?? (clip.textStyle === "body" || clip.textStyle === "bar");
  const rampA = clip.speedRamp?.[0]?.speed ?? clip.speed ?? 1;
  const rampB = clip.speedRamp?.[clip.speedRamp.length - 1]?.speed ?? clip.speed ?? 1;

  function save(kind: UserPreset["kind"]) {
    const label = presetName.trim();
    if (!label) return;
    onSavePreset(kind, label);
    setPresetName("");
  }

  function addKeyframe() {
    const id = Math.random().toString(36).slice(2, 8);
    const keys = [...(clip.keyframes ?? [])];
    const near = keys.findIndex((key) => Math.abs(key.t - elapsed) < 0.08);
    const point: Keyframe = {
      id: near >= 0 ? keys[near]!.id : id,
      t: Math.round((near >= 0 ? keys[near]!.t : Math.min(elapsed, clip.duration)) * 100) / 100,
      x: clip.x,
      y: clip.y,
      scale: clip.scale ?? (clip.pip ? 0.28 : 1),
      rotate: clip.rotate ?? 0,
      opacity: clip.opacity ?? 1,
      volume: clip.volume,
    };
    if (near >= 0) keys[near] = point;
    else keys.push(point);
    onPatch({ keyframes: keys.sort((a, b) => a.t - b.t) });
  }

  return (
    <div className="space-y-3 border-t border-white/10 pt-3">
      {textClip ? (
        <section className="space-y-2">
          <p className="font-bold text-white/70">글자</p>
          <div className="flex flex-wrap gap-1">
            {TEXT_PRESETS.map((preset) => (
              <button key={preset.id} type="button" onClick={() => onPatch(textPresetPatch(preset.id) as Partial<ProClip>)} className="rounded bg-white/10 px-2 py-1 text-[11px] font-bold">{preset.label}</button>
            ))}
          </div>
          <label className="block">폰트
            <select value={clip.font ?? "pretendard"} onChange={(e) => onPatch({ font: e.target.value })} className="mt-1 h-8 w-full rounded bg-white/10 px-2">
              {[...TEXT_FONTS, ...fonts].map((font) => <option key={font.id} value={font.id}>{font.label}</option>)}
            </select>
          </label>
          <Slider label={`글자크기 ${Math.round(clip.fontSize)}`} min={16} max={180} step={1} value={clip.fontSize} onChange={(fontSize) => onPatch({ fontSize, placed: true })} />
          <Slider label={`굵기 ${clip.fontWeight ?? 700}`} min={400} max={900} step={100} value={clip.fontWeight ?? 700} onChange={(fontWeight) => onPatch({ fontWeight })} />
          <label className="flex items-center justify-between">글자색
            <input type="color" value={clip.color} onChange={(e) => onPatch({ color: e.target.value })} />
          </label>
          <Slider label={`자간 ${clip.letterSpacing ?? 0}`} min={-8} max={24} step={0.5} value={clip.letterSpacing ?? 0} onChange={(letterSpacing) => onPatch({ letterSpacing })} />
          <Slider label={`행간 ${(clip.lineHeight ?? 1.25).toFixed(2)}`} min={0.8} max={2.2} step={0.05} value={clip.lineHeight ?? 1.25} onChange={(lineHeight) => onPatch({ lineHeight })} />
          <Chips label="정렬" value={clip.align ?? "center"} options={[{ id: "left", label: "왼쪽" }, { id: "center", label: "가운데" }, { id: "right", label: "오른쪽" }]} onChange={(align) => onPatch({ align, placed: true })} />
          <Slider label={`외곽선 ${clip.strokeWidth ?? 0}`} min={0} max={16} step={0.5} value={clip.strokeWidth ?? 0} onChange={(strokeWidth) => onPatch({ strokeWidth })} />
          <label className="flex items-center justify-between">외곽선 색
            <input type="color" value={clip.strokeColor ?? "#1c150e"} onChange={(e) => onPatch({ strokeColor: e.target.value })} />
          </label>
          <Slider label={`그림자 ${clip.textShadow ?? 0}`} min={0} max={40} step={1} value={clip.textShadow ?? 0} onChange={(textShadow) => onPatch({ textShadow })} />
          <button type="button" onClick={() => onPatch({ box: !boxOn })} className={`rounded px-2 py-1 text-[11px] font-bold ${boxOn ? "bg-[#D4A04E] text-[#1c150e]" : "bg-white/10"}`}>배경박스 {boxOn ? "켜짐" : "꺼짐"}</button>
          <label className="flex items-center justify-between">박스 색
            <input type="color" value={clip.boxColor ?? "#000000"} onChange={(e) => onPatch({ boxColor: e.target.value, box: true })} />
          </label>
          <Slider label={`배경 투명도 ${Math.round((clip.boxAlpha ?? 0.55) * 100)}%`} min={0} max={1} step={0.05} value={clip.boxAlpha ?? 0.55} onChange={(boxAlpha) => onPatch({ boxAlpha, box: true })} />
          <Slider label={`전체 투명도 ${Math.round((clip.opacity ?? 1) * 100)}%`} min={0} max={1} step={0.05} value={clip.opacity ?? 1} onChange={(opacity) => onPatch({ opacity })} />
          <Slider label={`가로 ${Math.round(clip.x * 100)}%`} min={0} max={1} step={0.01} value={clip.x} onChange={(x) => onPatch({ x, placed: true })} />
          <Slider label={`세로 ${Math.round(clip.y * 100)}%`} min={0} max={1} step={0.01} value={clip.y} onChange={(y) => onPatch({ y, placed: true })} />
          <Slider label={`회전 ${Math.round(clip.rotate ?? 0)}°`} min={-180} max={180} step={1} value={clip.rotate ?? 0} onChange={(rotate) => onPatch({ rotate })} />
          <p className="font-bold text-white/70">등장 · 퇴장</p>
          <Chips label="등장" value={clip.enter ?? "none"} options={ENTERS} onChange={(enter) => onPatch({ enter })} />
          <Chips label="퇴장" value={clip.exit ?? "none"} options={EXITS} onChange={(exit) => onPatch({ exit })} />
          <Slider label={`등장 ${ (clip.enterSec ?? 0.45).toFixed(2)}초`} min={0.1} max={2} step={0.05} value={clip.enterSec ?? 0.45} onChange={(enterSec) => onPatch({ enterSec })} />
          <Slider label={`퇴장 ${(clip.exitSec ?? 0.35).toFixed(2)}초`} min={0.1} max={2} step={0.05} value={clip.exitSec ?? 0.35} onChange={(exitSec) => onPatch({ exitSec })} />
          <Slider label={`속도 ${(clip.animSpeed ?? 1).toFixed(2)}x`} min={0.5} max={2} step={0.05} value={clip.animSpeed ?? 1} onChange={(animSpeed) => onPatch({ animSpeed })} />
        </section>
      ) : null}

      {visual ? (
        <section className="space-y-2">
          <p className="font-bold text-white/70">장면 전환</p>
          <Chips label={`시간 ${transitionSeconds(clip.transition, clip.transitionSec).toFixed(2)}초`} value={clip.transition ?? "fade"} options={SCENE_TRANSITIONS} onChange={(transition) => onPatch({ transition: transition as ProClip["transition"], transitionSec: clip.transitionSec ?? 0.6 })} />
          <Slider label="전환시간" min={0.2} max={2} step={0.05} value={transitionSeconds(clip.transition, clip.transitionSec) || 0.6} onChange={(transitionSec) => onPatch({ transitionSec, transition: clip.transition === "none" ? "fade" : clip.transition })} />
          <p className="font-bold text-white/70">색보정</p>
          <div className="flex flex-wrap gap-1">
            {GRADE_PRESETS.map((preset) => (
              <button key={preset.id} type="button" onClick={() => onPatch({ grade: gradePreset(preset.id), look: "none" } as Partial<ProClip>)} className="rounded bg-white/10 px-2 py-1 text-[11px] font-bold">{preset.label}</button>
            ))}
          </div>
          <Slider label={`밝기 ${grade.brightness.toFixed(2)}`} min={-1} max={1} step={0.02} value={grade.brightness} onChange={(brightness) => onPatch({ grade: { ...grade, brightness } })} />
          <Slider label={`대비 ${grade.contrast.toFixed(2)}`} min={-1} max={1} step={0.02} value={grade.contrast} onChange={(contrast) => onPatch({ grade: { ...grade, contrast } })} />
          <Slider label={`채도 ${grade.saturation.toFixed(2)}`} min={-1} max={1} step={0.02} value={grade.saturation} onChange={(saturation) => onPatch({ grade: { ...grade, saturation } })} />
          <Slider label={`색온도 ${grade.temperature.toFixed(2)}`} min={-1} max={1} step={0.02} value={grade.temperature} onChange={(temperature) => onPatch({ grade: { ...grade, temperature } })} />
          <Slider label={`하이라이트 ${grade.highlight.toFixed(2)}`} min={-1} max={1} step={0.02} value={grade.highlight} onChange={(highlight) => onPatch({ grade: { ...grade, highlight } })} />
          <Slider label={`그림자 ${grade.shadow.toFixed(2)}`} min={-1} max={1} step={0.02} value={grade.shadow} onChange={(shadow) => onPatch({ grade: { ...grade, shadow } })} />
          <Slider label={`선명도 ${grade.sharpness.toFixed(2)}`} min={0} max={1} step={0.02} value={grade.sharpness} onChange={(sharpness) => onPatch({ grade: { ...grade, sharpness } })} />
          <button type="button" onClick={() => onPatch({ grade: { ...grade, mono: !grade.mono } })} className={`rounded px-2 py-1 text-[11px] font-bold ${grade.mono ? "bg-[#D4A04E] text-[#1c150e]" : "bg-white/10"}`}>흑백 {grade.mono ? "켜짐" : "꺼짐"}</button>
        </section>
      ) : null}

      {clip.pip ? (
        <section className="space-y-2">
          <p className="font-bold text-white/70">픽처 인 픽처</p>
          <Slider label={`크기 ${Math.round((clip.scale ?? 0.28) * 100)}%`} min={0.08} max={0.9} step={0.01} value={clip.scale ?? 0.28} onChange={(scale) => onPatch({ scale })} />
          <Slider label={`가로 ${Math.round(clip.x * 100)}%`} min={0} max={1} step={0.01} value={clip.x} onChange={(x) => onPatch({ x })} />
          <Slider label={`세로 ${Math.round(clip.y * 100)}%`} min={0} max={1} step={0.01} value={clip.y} onChange={(y) => onPatch({ y })} />
          <Slider label={`투명도 ${Math.round((clip.opacity ?? 1) * 100)}%`} min={0} max={1} step={0.05} value={clip.opacity ?? 1} onChange={(opacity) => onPatch({ opacity })} />
          <Slider label={`둥근모서리 ${Math.round(clip.radius ?? 16)}`} min={0} max={80} step={1} value={clip.radius ?? 16} onChange={(radius) => onPatch({ radius })} />
          <Slider label={`그림자 ${Math.round(clip.pipShadow ?? 18)}`} min={0} max={48} step={1} value={clip.pipShadow ?? 18} onChange={(pipShadow) => onPatch({ pipShadow })} />
        </section>
      ) : null}

      {!clip.title ? (
        <section className="space-y-2">
          <p className="font-bold text-white/70">키프레임</p>
          <button type="button" onClick={addKeyframe} className="rounded bg-white px-2 py-1 text-[11px] font-bold text-[#1c150e]">지금 위치에 키프레임</button>
          <p className="text-[10px] text-white/40">위치, 크기, 회전, 투명도, 볼륨이 이 시각에 기록되고 점 사이는 이어집니다.</p>
          {(clip.keyframes ?? []).length === 0 ? <p className="text-[10px] text-white/35">아직 키프레임이 없습니다.</p> : null}
          {(clip.keyframes ?? []).map((key) => (
            <div key={key.id} className="flex items-center gap-2 text-[11px]">
              <span className="font-mono">{key.t.toFixed(2)}s</span>
              <button type="button" onClick={() => onPatch({ keyframes: (clip.keyframes ?? []).filter((item) => item.id !== key.id) })} className="text-white/50">삭제</button>
            </div>
          ))}
        </section>
      ) : null}

      {clip.kind === "video" && !clip.pip ? (
        <section className="space-y-2">
          <p className="font-bold text-white/70">재생 속도</p>
          <div className="flex flex-wrap gap-1">
            {SPEEDS.map((speed) => (
              <button key={speed} type="button" onClick={() => onPatch({ speed, speedRamp: undefined, duration: retimed(clip.duration, clip.speed ?? 1, clip.speedRamp, speed) })} className={`rounded px-2 py-1 text-[11px] font-bold ${(clip.speed ?? 1) === speed && !clip.speedRamp ? "bg-[#D4A04E] text-[#1c150e]" : "bg-white/10"}`}>{speed}x</button>
            ))}
          </div>
          <label className="block">시작 배속
            <select value={String(rampA)} onChange={(e) => {
              const speed = Number(e.target.value);
              const speedRamp = [{ t: 0, speed }, { t: 1, speed: rampB }];
              onPatch({ speedRamp, duration: retimed(clip.duration, clip.speed ?? 1, clip.speedRamp, clip.speed ?? 1, speedRamp) });
            }} className="mt-1 h-8 w-full rounded bg-white/10 px-2">
              {SPEEDS.map((speed) => <option key={speed} value={speed}>{speed}x</option>)}
            </select>
          </label>
          <label className="block">끝 배속
            <select value={String(rampB)} onChange={(e) => {
              const speed = Number(e.target.value);
              const speedRamp = [{ t: 0, speed: rampA }, { t: 1, speed }];
              onPatch({ speedRamp, duration: retimed(clip.duration, clip.speed ?? 1, clip.speedRamp, clip.speed ?? 1, speedRamp) });
            }} className="mt-1 h-8 w-full rounded bg-white/10 px-2">
              {SPEEDS.map((speed) => <option key={speed} value={speed}>{speed}x</option>)}
            </select>
          </label>
          <p className="text-[10px] text-white/40">시작과 끝이 다르면 그 사이로 속도가 변합니다.</p>
        </section>
      ) : null}

      <section className="space-y-2">
        <p className="font-bold text-white/70">내 프리셋</p>
        <input value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="프리셋 이름" className="h-8 w-full rounded bg-white/10 px-2" />
        <div className="flex flex-wrap gap-1">
          {textClip ? <button type="button" onClick={() => save("text")} className="rounded border border-white/15 px-2 py-1 text-[11px] font-bold">글자 저장</button> : null}
          {textClip ? <button type="button" onClick={() => save("anim")} className="rounded border border-white/15 px-2 py-1 text-[11px] font-bold">움직임 저장</button> : null}
          {visual ? <button type="button" onClick={() => save("grade")} className="rounded border border-white/15 px-2 py-1 text-[11px] font-bold">색보정 저장</button> : null}
          <button type="button" onClick={() => save("intro")} className="rounded border border-white/15 px-2 py-1 text-[11px] font-bold">인트로 저장</button>
          <button type="button" onClick={() => save("ending")} className="rounded border border-white/15 px-2 py-1 text-[11px] font-bold">엔딩 저장</button>
        </div>
        {presets.length === 0 ? <p className="text-[10px] text-white/35">저장한 프리셋이 없습니다. 이 브라우저에 남아 다른 영상에서도 다시 씁니다.</p> : null}
        {presets.map((preset) => (
          <div key={preset.id} className="flex items-center gap-2 text-[11px]">
            <button type="button" onClick={() => {
              if (preset.kind === "intro" || preset.kind === "ending") onApplyTitle(preset.kind, preset.payload);
              else onApplyPreset(preset);
            }} className="truncate font-bold">{preset.label}</button>
            <span className="text-white/35">{preset.kind}</span>
            <button type="button" onClick={() => onDeletePreset(preset.id)} className="ml-auto text-white/45">삭제</button>
          </div>
        ))}
      </section>
    </div>
  );
}

function Slider({ label, min, max, step, value, onChange }: { label: string; min: number; max: number; step: number; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block text-[11px]">{label}
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full" />
    </label>
  );
}

function Chips<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string }[]; onChange: (id: T) => void }) {
  return (
    <div>
      <p className="text-[11px] text-white/50">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {options.map((option) => (
          <button key={option.id} type="button" onClick={() => onChange(option.id)} className={`rounded px-2 py-1 text-[11px] font-bold ${value === option.id ? "bg-[#D4A04E] text-[#1c150e]" : "bg-white/10"}`}>{option.label}</button>
        ))}
      </div>
    </div>
  );
}
