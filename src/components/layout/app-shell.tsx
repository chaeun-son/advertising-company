import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, Clapperboard, ClipboardList, LayoutGrid, PenTool, Plus, Settings2, Users } from "lucide-react";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { PRODUCT_NAME } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { signOut } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { useStaffSession } from "@/lib/staff-session";
import { cn } from "@/lib/utils";
import type { Staff } from "@/lib/types";

const NAV = [
  { to: "/", label: "작업현황", icon: LayoutGrid, exact: true },
  { to: "/orders", label: "주문관리", icon: ClipboardList, exact: false },
  { to: "/studio", label: "편집실", icon: PenTool, exact: false },
  { to: "/video", label: "영상 편집", icon: Clapperboard, exact: false },
  { to: "/clients", label: "거래처", icon: Users, exact: false },
  { to: "/manual", label: "매뉴얼", icon: BookOpen, exact: false },
  { to: "/settings", label: "설정", icon: Settings2, exact: false },
] as const;

export function AppShell({
  children,
  staff,
}: {
  children: ReactNode;
  staff: Staff[];
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const wide = pathname.startsWith("/studio") || pathname.startsWith("/video");
  const { name, setName, hydrate, hydrated } = useStaffSession();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated || staff.length === 0) return;
    if (!name || !staff.some((s) => s.name === name)) {
      setName(staff[0]!.name);
    }
  }, [hydrated, name, staff, setName]);

  return (
    <div className="min-h-dvh bg-[#f4f0ea] text-[#302621]">
      <header className="no-print sticky top-0 z-30 border-b border-[#ded7ce] bg-[#fffdf9]">
        <div className="mx-auto flex min-h-16 max-w-[96rem] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 md:px-5">
          <Link to="/" className="flex min-w-0 items-center gap-2" aria-label={PRODUCT_NAME}>
            <span className="relative block size-8 rotate-[30deg]" aria-hidden>
              <span className="absolute left-0.5 top-0.5 h-3 w-5 rounded-sm bg-gradient-to-br from-[#e0b063] to-[#78502d]" />
              <span className="absolute left-1.5 top-2 h-3 w-5 rounded-sm bg-gradient-to-br from-[#9b6b3d] to-[#3b2517]" />
              <span className="absolute left-0.5 top-4 h-3 w-5 rounded-sm bg-gradient-to-br from-[#d5a75f] to-[#7f5631]" />
            </span>
            <span className="leading-none">
              <span className="block font-serif text-[15px] tracking-[0.08em]">CRESORA</span>
              <span className="mt-1 block text-[8px] font-bold tracking-[0.28em] text-[#a1713d]">STUDIO</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-0.5 lg:flex">
            {NAV.map((item) => {
              const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors",
                    active ? "bg-[#362319] text-[#fffaf2]" : "text-[#756a62] hover:bg-[#eee9e2]",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="hidden min-h-10 min-w-[8rem] flex-1 lg:block" aria-hidden />
          <div className="ml-auto flex items-center gap-2">
            {staff.length > 0 ? (
              <NativeSelect
                aria-label="현재 작업자"
                className="h-9 w-[8.8rem] border-[#ddd7cf] bg-white text-[13px] md:w-40"
                value={name}
                onChange={(e) => setName(e.target.value)}
              >
                {staff.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name} {s.role}
                  </option>
                ))}
              </NativeSelect>
            ) : null}
            <CompactSignOut />
            <Button asChild size="sm" className="hidden bg-[#362319] text-[#fffaf2] sm:inline-flex">
              <Link to="/orders/new">
                <Plus />
                새 주문
              </Link>
            </Button>
            <Button asChild size="icon" className="bg-[#362319] text-[#fffaf2] sm:hidden">
              <Link to="/orders/new" aria-label="새 주문">
                <Plus />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main
        className={
          wide
            ? "h-[calc(100dvh-4.5rem)] overflow-hidden"
            : "mx-auto w-full max-w-[88rem] px-3 pb-24 pt-4 md:px-5 md:pb-10 md:pt-6"
        }
      >
        {children}
      </main>

      {wide ? null : (
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
        {NAV.map((item) => {
          const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-h-14 min-w-[4.4rem] flex-1 flex-col items-center justify-center gap-0.5 text-[10px]",
                active ? "text-primary" : "text-muted",
              )}
            >
              <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      )}
    </div>
  );
}

function CompactSignOut() {
  const user = useCurrentUser();
  const [signingOut, setSigningOut] = useState(false);
  const gateSession = useSyncExternalStore(
    () => () => {},
    hasGateSessionMarker,
    () => false,
  );
  if (!user || gateSession) return null;
  return (
    <button
      type="button"
      className="h-10 shrink-0 px-2 text-[12px] text-muted hover:text-fg"
      disabled={signingOut}
      onClick={() => {
        setSigningOut(true);
        void signOut("/login").catch(() => setSigningOut(false));
      }}
    >
      {signingOut ? "…" : "로그아웃"}
    </button>
  );
}

