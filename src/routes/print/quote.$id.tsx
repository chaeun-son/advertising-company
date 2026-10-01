import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PrintDocument } from "@/components/print-document";
import { RequireSignIn } from "@/components/require-sign-in";
import { Button } from "@/components/ui/button";
import { getDocument } from "@/lib/server/api";

export const Route = createFileRoute("/print/quote/$id")({
  component: PrintPage,
});

function PrintPage() {
  return (
    <RequireSignIn>
      <QuoteBody />
    </RequireSignIn>
  );
}

function QuoteBody() {
  const { id } = Route.useParams();
  const { data, isPending, error } = useQuery({
    queryKey: ["document", id],
    queryFn: () => getDocument({ data: { id: Number(id) } }),
  });

  if (isPending) return <p className="p-8 text-muted">문서를 여는 중…</p>;
  if (error || !data) {
    return (
      <p className="p-8 text-stamp">{error instanceof Error ? error.message : "문서가 없습니다."}</p>
    );
  }

  return (
    <div className="min-h-dvh bg-bg py-6">
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center justify-between px-4">
        <Button variant="ghost" asChild>
          <Link to="/orders/$id" params={{ id: String(data.orderId) }}>
            주문으로
          </Link>
        </Button>
        <Button onClick={() => window.print()}>인쇄</Button>
      </div>
      <PrintDocument doc={data} />
    </div>
  );
}
