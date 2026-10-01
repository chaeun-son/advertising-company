import { MonitorSmartphone } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getInstallSnapshot, promptInstall, subscribeInstall, type InstallSnapshot } from "@/lib/pwa-install";

const empty: InstallSnapshot = { canPrompt: false, installed: false };

export function InstallApp() {
  const snap = useSyncExternalStore(subscribeInstall, getInstallSnapshot, () => empty);
  const [busy, setBusy] = useState(false);

  async function onInstall() {
    setBusy(true);
    try {
      const result = await promptInstall();
      if (result === "accepted") toast.success("시작 메뉴에 애드스마일이 생겼습니다.");
      else if (result === "dismissed") toast.message("설치를 미뤘습니다. 나중에 설정에서 다시 할 수 있습니다.");
      else toast.message("이 창에서는 바로 설치가 안 됩니다. 아래 순서를 따라 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)] md:p-5">
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-primary/12 text-primary">
          <MonitorSmartphone className="size-5" />
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold">프로그램처럼 쓰기</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            웹으로 열어도, 윈도우 아이콘으로 열어도 세 명이 같은 작업판입니다. 컴퓨터마다
            따로 설치하는 프로그램이 아닙니다.
          </p>
        </div>
      </div>

      {snap.installed ? (
        <p className="mt-4 rounded-[var(--radius-sm)] bg-elevated px-3 py-2.5 text-sm text-fg shadow-[var(--shadow-border)]">
          이 창은 이미 프로그램처럼 열려 있습니다. 시작 메뉴나 홈 화면 아이콘으로 들어오시면 됩니다.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {snap.canPrompt ? (
            <Button type="button" onClick={() => void onInstall()} disabled={busy}>
              {busy ? "설치 창 여는 중…" : "이 컴퓨터에 설치"}
            </Button>
          ) : null}

          <ol className="space-y-3 text-sm leading-relaxed">
            <li>
              <p className="font-medium">윈도우 PC</p>
              <p className="mt-0.5 text-muted">
                Edge 또는 Chrome으로 이 작업실을 연 다음, 주소창 오른쪽{" "}
                <span className="font-medium text-fg">설치</span> 아이콘, 또는 메뉴(···) →{" "}
                <span className="font-medium text-fg">앱 설치</span>를 누릅니다. 시작 메뉴에
                「애드스마일」이 생기고, 작업 표시줄에 고정할 수 있습니다.
              </p>
            </li>
            <li>
              <p className="font-medium">휴대폰</p>
              <p className="mt-0.5 text-muted">
                아이폰은 공유 → 홈 화면에 추가. 안드로이드는 메뉴 → 앱 설치 / 홈 화면에 추가.
              </p>
            </li>
          </ol>
        </div>
      )}
    </section>
  );
}
