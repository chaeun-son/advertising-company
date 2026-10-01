import type { ReactNode } from "react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { BrandMark } from "@/components/brand-mark";

export function RequireSignIn({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg px-6">
        <div className="flex flex-col items-center gap-3 text-muted">
          <BrandMark className="size-10 text-primary" />
          <p className="h-8 w-40 animate-pulse rounded-full bg-border" />
          <p className="text-sm">작업실 여는 중…</p>
        </div>
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;
  return <>{children}</>;
}
