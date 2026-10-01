import { FolderOpen, Search, Upload } from "lucide-react";
import { useRef } from "react";
import { LIBRARY_FOLDERS, folderCount } from "@/lib/studio/library-catalog";
import { useStudio } from "@/lib/studio/store";
import { toast } from "sonner";

export function LibraryPanel() {
  const uploads = useStudio((s) => s.uploads);
  const addUpload = useStudio((s) => s.addUpload);
  const applyBackground = useStudio((s) => s.applyBackground);
  const createBlank = useStudio((s) => s.createBlank);
  const folder = useStudio((s) => s.libraryFolder);
  const setFolder = useStudio((s) => s.setLibraryFolder);
  const query = useStudio((s) => s.libraryQuery);
  const setQuery = useStudio((s) => s.setLibraryQuery);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    try {
      let last = null as Awaited<ReturnType<typeof addUpload>> | null;
      for (const file of Array.from(files)) {
        last = await addUpload(file);
      }
      if (last) {
        setFolder("mine");
        applyBackground(last);
        toast.success("내 파일에 넣고 배경으로 올렸습니다");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "업로드 실패");
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border px-4 py-3">
        <p className="panel-label">자료실</p>
        <h2 className="mt-1 text-base font-black tracking-tight">배경 폴더</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          폴더를 고르면 오른쪽에서 {folderCount("all")}점을 펼칩니다. 원본은 직접 그린 20점입니다.
        </p>
      </div>

      <div className="border-b border-border px-4 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="이름 · 태그 검색"
            className="h-8 w-full rounded-md border border-border bg-card pl-7 pr-2 text-xs outline-none focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-1 md:flex-col">
          {LIBRARY_FOLDERS.map((c) => {
            const n = folderCount(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setFolder(c.id)}
                className={`inline-flex h-8 items-center justify-between gap-2 rounded-md px-2.5 text-[12px] font-bold md:w-full ${
                  folder === c.id ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground"
                }`}
              >
                <span>{c.label}</span>
                <span className={folder === c.id ? "opacity-80" : "text-muted-foreground"}>{n}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setFolder("mine")}
            className={`inline-flex h-8 items-center justify-between gap-2 rounded-md px-2.5 text-[12px] font-bold md:w-full ${
              folder === "mine" ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground"
            }`}
          >
            <span>내 파일</span>
            <span className={folder === "mine" ? "opacity-80" : "text-muted-foreground"}>{uploads.length}</span>
          </button>
        </div>
        <div className="mt-2 flex gap-1">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-card text-[12px] font-bold"
          >
            <Upload className="size-3.5" />
            SVG · 이미지 넣기
          </button>
          <button
            type="button"
            onClick={() => {
              createBlank();
              toast.message("빈 도화지를 열었습니다");
            }}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border px-2.5 text-[12px] font-bold"
          >
            <FolderOpen className="size-3.5" />
            빈 도화지
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".svg,image/svg+xml,image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              onFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </div>
    </div>
  );
}
