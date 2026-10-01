import { useMemo, useState } from "react";
import { toast } from "sonner";
import { reviewDraft } from "@/lib/studio/production-check";
import { CONVERT_PRESETS } from "@/lib/studio/reflow";
import { useStudio } from "@/lib/studio/store";

export function ReviewPanel() {
  const drafts = useStudio((s) => s.drafts);
  const activeId = useStudio((s) => s.activeId);
  const brief = useStudio((s) => s.brief);
  const applyReviewFix = useStudio((s) => s.applyReviewFix);
  const draft = drafts.find((item) => item.id === activeId) ?? drafts[0];
  const rows = useMemo(() => (draft ? reviewDraft(draft, brief) : []), [draft, brief]);
  if (!draft) return null;
  return (
    <div className="max-h-56 overflow-y-auto border-b border-border bg-white px-4 py-3">
      <p className="text-sm font-bold">제작검수 결과</p>
      <ul className="mt-2 space-y-1.5">
        {rows.map((row) => (
          <li key={row.id} className="flex items-start justify-between gap-3 text-[12px]">
            <span>{row.ok ? "✅" : "⚠"} {row.text}</span>
            {!row.ok && row.fix ? (
              <button type="button" onClick={() => applyReviewFix(row.fix!)} className="shrink-0 rounded-md bg-primary px-2 py-1 text-[11px] font-bold text-primary-foreground">
                자동수정
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ConvertPanel() {
  const addReflowDraft = useStudio((s) => s.addReflowDraft);
  const [customW, setCustomW] = useState(500);
  const [customH, setCustomH] = useState(90);
  const [unit, setUnit] = useState<"cm" | "mm">("cm");
  const groups = [...new Set(CONVERT_PRESETS.map((item) => item.group))];
  return (
    <div className="border-b border-border bg-white px-4 py-3">
      <p className="text-sm font-bold">다른 규격으로 변환</p>
      <p className="mt-1 text-[11px] text-muted-foreground">원본 시안은 그대로 두고, 문구·사진·로고를 새 규격에 다시 배치한 버전을 만듭니다.</p>
      {groups.map((group) => (
        <div key={group} className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="w-14 text-[11px] font-bold text-muted-foreground">{group}</span>
          {CONVERT_PRESETS.filter((item) => item.group === group).map((item) => (
            <button key={item.label} type="button" onClick={() => { addReflowDraft(item.w, item.h, item.label); toast.success(`${item.label} 버전을 새로 만들었습니다.`); }} className="rounded-md border border-border px-2 py-1 text-[11px] font-bold">
              {item.label}
            </button>
          ))}
        </div>
      ))}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="w-14 text-[11px] font-bold text-muted-foreground">기타</span>
        <input value={customW} onChange={(e) => setCustomW(Number(e.target.value) || 0)} className="h-8 w-20 rounded-md border border-border px-2 text-[12px]" />
        <span>×</span>
        <input value={customH} onChange={(e) => setCustomH(Number(e.target.value) || 0)} className="h-8 w-20 rounded-md border border-border px-2 text-[12px]" />
        <select value={unit} onChange={(e) => setUnit(e.target.value as "cm" | "mm")} className="h-8 rounded-md border border-border px-2 text-[12px]">
          <option value="cm">cm</option>
          <option value="mm">mm</option>
        </select>
        <button
          type="button"
          onClick={() => {
            const factor = unit === "cm" ? 10 : 1;
            addReflowDraft(customW * factor, customH * factor, `${customW}×${customH}${unit}`);
            toast.success("사용자 지정 규격 버전을 새로 만들었습니다.");
          }}
          className="rounded-md bg-primary px-2 py-1 text-[11px] font-bold text-primary-foreground"
        >
          사용자 지정
        </button>
      </div>
    </div>
  );
}
