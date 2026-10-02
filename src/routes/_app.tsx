import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { RequireSignIn } from "@/components/require-sign-in";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { getBootstrap } from "@/lib/server/api";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <RequireSignIn>
      <SignedShell />
    </RequireSignIn>
  );
}

function SignedShell() {
  const { data, isPending, error } = useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => getBootstrap(),
  });

  if (error && error instanceof Error && error.message === "Unauthorized") {
    return <RedirectToSignIn />;
  }

  if (isPending || !data) {
    return (
      <AppShell staff={[]}>
        <p className="text-sm text-muted">작업판을 불러오는 중…</p>
      </AppShell>
    );
  }

  return (
    <AppShell staff={data.staff}>
      <Outlet />
    </AppShell>
  );
}
