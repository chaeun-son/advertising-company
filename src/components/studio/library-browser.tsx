import { useMemo } from "react";
import { LIBRARY_BACKGROUNDS, folderCount, type LibraryItem } from "@/lib/studio/library-catalog";
import { useStudio } from "@/lib/studio/store";
import { toast } from "sonner";

export function LibraryBrowser() {
  const folder = useStudio((s) => s.libraryFolder);
  const query = useStudio((s) => s.libraryQuery);
  const uploads = useStudio((s) => s.uploads);
  const applyBackground = useStudio((s) => s.applyBackground);
  const placeAsset = useStudio((s) => s.placeAsset);
  const removeUpload = useStudio((s) => s.removeUpload);

  const items = useMemo(() => {
    const pool: LibraryItem[] =
      folder === "mine"
        ? uploads
        : folder === "original"
          ? LIBRARY_BACKGROUNDS.filter((i) => i.original)
          : folder === "all"
            ? [...LIBRARY_BACKGROUNDS, ...uploads]
            : LIBRARY_BACKGROUNDS.filter((i) => i.category === folder);
    const q = query.trim().toLowerCase();
    if (!q) return pool;
    return pool.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.tags.some((t) => t.toLowerCase().includes(q)) ||
        i.id.toLowerCase().includes(q),
    );
  }, [folder, query, uploads]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-shrink-0 flex-wrap items-end justify-between gap-2 border-b border-border bg-panel px-4 py-3">
        <div>
          <p className="panel-label">자료실 폴더</p>
          <h2 className="mt-1 text-base font-black tracking-tight">벡터 배경 {folderCount("all")}점</h2>
          <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-muted-foreground">
            가운데를 비운 4:1 원본 SVG입니다. 카드를 누르면 시안 맨 아래에 깔리고, 개체로 넣으면 옮기고 키울 수 있습니다.
          </p>
        </div>
        <p className="text-[12px] font-bold text-muted-foreground">{items.length}점</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-4">
        {items.length === 0 ? (
          <p className="px-2 py-8 text-center text-[13px] text-muted-foreground">
            {folder === "mine" ? "올린 파일이 없습니다. 왼쪽에서 SVG나 사진을 넣으세요." : "검색 결과가 없습니다."}
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <li key={item.id} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    applyBackground(item);
                    toast.success(`${item.title}을 배경으로 올렸습니다`);
                  }}
                  className="group w-full overflow-hidden rounded-lg border border-border bg-card text-left transition-colors hover:border-primary"
                >
                  <span className="block aspect-[4/1] overflow-hidden bg-muted">
                    <img src={item.src} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </span>
                  <span className="flex items-center gap-2 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-[12px] font-bold">{item.title}</span>
                    {item.original ? (
                      <span className="shrink-0 rounded border border-border px-1.5 py-px text-[10px] font-bold text-muted-foreground">
                        원본
                      </span>
                    ) : null}
                  </span>
                </button>
                <div className="absolute right-2 top-2 flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      placeAsset(item);
                      toast.success(`${item.title}을 개체로 넣었습니다`);
                    }}
                    className="rounded bg-card/95 px-1.5 py-0.5 text-[10px] font-bold shadow-sm ring-1 ring-border"
                  >
                    개체
                  </button>
                  {uploads.some((u) => u.id === item.id) ? (
                    <button
                      type="button"
                      onClick={() => removeUpload(item.id)}
                      className="rounded bg-card/95 px-1.5 py-0.5 text-[10px] font-bold text-bleed shadow-sm ring-1 ring-border"
                    >
                      삭제
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
