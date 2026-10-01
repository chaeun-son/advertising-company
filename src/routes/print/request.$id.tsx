import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PrintRequest } from "@/components/print-request";
import { RequireSignIn } from "@/components/require-sign-in";
import { Button } from "@/components/ui/button";
import { getBootstrap, getOrder } from "@/lib/server/api";
import { useStaffSession } from "@/lib/staff-session";

export const Route = createFileRoute("/print/request/$id")({
  component: RequestPrintPage,
});

function RequestPrintPage() {
  return (
    <RequireSignIn>
      <RequestBody />
    </RequireSignIn>
  );
}

function RequestBody() {
  const { id } = Route.useParams();
  const staffName = useStaffSession((s) => s.name);
  const orderQ = useQuery({
    queryKey: ["order", Number(id)],
    queryFn: () => getOrder({ data: { id: Number(id) } }),
  });
  const boot = useQuery({ queryKey: ["bootstrap"], queryFn: () => getBootstrap() });

  if (orderQ.isPending || boot.isPending) {
    return <p className="p-8 text-muted">의뢰서를 여는 중…</p>;
  }
  if (orderQ.error || !orderQ.data || !boot.data) {
    return (
      <p className="p-8 text-stamp">
        {orderQ.error instanceof Error ? orderQ.error.message : "주문이 없습니다."}
      </p>
    );
  }

  return (
    <div className="min-h-dvh bg-bg py-6">
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center justify-between px-4">
        <Button variant="ghost" asChild>
          <Link to="/orders/$id" params={{ id }}>
            주문으로
          </Link>
        </Button>
        <Button onClick={() => window.print()}>인쇄</Button>
      </div>
      <PrintRequest
        order={orderQ.data}
        company={boot.data.company}
        staffName={staffName || orderQ.data.createdBy}
      />
    </div>
  );
}
