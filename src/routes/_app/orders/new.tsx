import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { OrderForm, type OrderFormValue } from "@/components/order-form";
import { createOrder, getBootstrap } from "@/lib/server/api";
import { useStaffSession } from "@/lib/staff-session";

export const Route = createFileRoute("/_app/orders/new")({
  component: NewOrderPage,
});

function NewOrderPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const staffName = useStaffSession((s) => s.name) || "직원";
  const { data } = useQuery({ queryKey: ["bootstrap"], queryFn: () => getBootstrap() });

  const mutation = useMutation({
    mutationFn: (value: OrderFormValue) =>
      createOrder({
        data: {
          ...value,
          staffName,
          items: value.items.map(({ productId, widthCm, heightCm, qty, memo, copy, unitPrice }) => ({
            productId,
            widthCm,
            heightCm,
            qty,
            memo,
            copy,
            unitPrice,
          })),
        },
      }),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries();
      toast.success(`${res.orderNo} 접수했습니다.`);
      await navigate({ to: "/orders/$id", params: { id: String(res.id) } });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "저장에 실패했습니다."),
  });

  if (!data) return <p className="text-muted">불러오는 중…</p>;

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[13px] text-muted">전화 응대 항목은 매뉴얼에서 확인하고, 여기에 남기면 전 직원이 봅니다.</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">새 주문</h1>
      </header>
      <OrderForm
        products={data.products}
        clients={data.clients}
        staff={data.staff}
        company={data.company}
        initial={{ assignee: staffName }}
        submitLabel="접수하기"
        pending={mutation.isPending}
        onSubmit={(value) => {
          if (!value.title.trim()) {
            toast.error("작업명을 적어 주세요.");
            return;
          }
          mutation.mutate(value);
        }}
      />
    </div>
  );
}
