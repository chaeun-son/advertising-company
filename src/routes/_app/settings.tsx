import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { InstallApp } from "@/components/install-app";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addStaff,
  exportShopBackup,
  getBootstrap,
  getMonthlyArchive,
  getStorageStats,
  listMonthlyArchives,
  removeStaff,
  deleteProduct,
  restoreShopBackup,
  saveMonthlyArchive,
  updateCompany,
  upsertProduct,
} from "@/lib/server/api";
import type { CompanyProfile, ProductUnit } from "@/lib/types";
import { formatYearMonth } from "@/lib/format";
import { won } from "@/lib/pricing";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["bootstrap"], queryFn: () => getBootstrap() });
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [productName, setProductName] = useState("");
  const [productUnit, setProductUnit] = useState<ProductUnit>("㎡");
  const [productPrice, setProductPrice] = useState("8000");
  const [staffName, setStaffName] = useState("");
  const [staffRole, setStaffRole] = useState("직원");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (data) setCompany(data.company);
  }, [data]);

  const saveCompany = useMutation({
    mutationFn: () => {
      if (!company) throw new Error("회사 정보가 없습니다.");
      return updateCompany({ data: company });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      toast.success("회사 정보를 저장했습니다.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "저장 실패"),
  });

  const saveProduct = useMutation({
    mutationFn: () =>
      upsertProduct({
        data: {
          name: productName,
          unit: productUnit,
          unitPrice: Number(productPrice) || 0,
        },
      }),
    onSuccess: async () => {
      setProductName("");
      await queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      toast.success("품목을 추가했습니다.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "추가 실패"),
  });

  const saveStaff = useMutation({
    mutationFn: () => addStaff({ data: { name: staffName, role: staffRole } }),
    onSuccess: async () => {
      setStaffName("");
      await queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      toast.success("직원을 추가했습니다.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "추가 실패"),
  });

  const deleteProductMut = useMutation({
    mutationFn: (id: number) => deleteProduct({ data: { id } }),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      toast.success(
        res.hidden
          ? `${res.name}은 주문에 쓰여서 단가표에서만 뺐습니다.`
          : `${res.name}을 삭제했습니다.`,
      );
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "삭제 실패"),
  });

  const deleteStaffMut = useMutation({
    mutationFn: (id: number) => removeStaff({ data: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      toast.success("직원을 삭제했습니다.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "삭제 실패"),
  });

  const patchProduct = useMutation({
    mutationFn: (p: {
      id: number;
      name: string;
      unit: ProductUnit;
      unitPrice: number;
      active: boolean;
      category?: string;
      minQty?: number;
    }) => upsertProduct({ data: p }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bootstrap"] }),
  });

  const exportMut = useMutation({
    mutationFn: () => exportShopBackup(),
    onSuccess: (res) => {
      const blob = new Blob([res.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const stamp = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
      const a = document.createElement("a");
      a.href = url;
      a.download = `adsmile-backup-${stamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("백업 파일을 저장했습니다.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "내보내기 실패"),
  });

  const restoreMut = useMutation({
    mutationFn: (json: string) => restoreShopBackup({ data: { json } }),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries();
      toast.success(
        `되돌렸습니다. 주문 ${res.counts.orders}건 · 거래처 ${res.counts.clients}곳`,
      );
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "가져오기 실패"),
  });

  const archivesQ = useQuery({
    queryKey: ["monthly-archives"],
    queryFn: () => listMonthlyArchives(),
  });
  const storageQ = useQuery({
    queryKey: ["storage-stats"],
    queryFn: () => getStorageStats(),
  });

  const snapshotMut = useMutation({
    mutationFn: () => saveMonthlyArchive(),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ["monthly-archives"] });
      toast.success(`${formatYearMonth(res.month)} 보관본을 남겼습니다. 주문 ${res.orderCount}건`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "보관 실패"),
  });

  const downloadArchiveMut = useMutation({
    mutationFn: (month: string) => getMonthlyArchive({ data: { month } }),
    onSuccess: (res) => {
      const blob = new Blob([res.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `adsmile-${res.month}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${formatYearMonth(res.month)} 파일을 저장했습니다.`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "내려받기 실패"),
  });

  if (!data || !company) return <p className="text-muted">불러오는 중…</p>;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[13px] text-muted">견적서·명세서에 찍히는 내용</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">설정</h1>
      </header>

      <InstallApp />

      <section className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)] md:p-5">
        <h2 className="font-display text-base font-semibold">자사 정보</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="상호" value={company.name} onChange={(v) => setCompany({ ...company, name: v })} />
          <Field label="대표" value={company.ownerName} onChange={(v) => setCompany({ ...company, ownerName: v })} />
          <Field label="사업자번호" value={company.bizNo} onChange={(v) => setCompany({ ...company, bizNo: v })} />
          <Field label="전화" value={company.phone} onChange={(v) => setCompany({ ...company, phone: v })} />
          <Field label="팩스" value={company.fax} onChange={(v) => setCompany({ ...company, fax: v })} />
          <Field label="이메일" value={company.email} onChange={(v) => setCompany({ ...company, email: v })} />
          <Field label="직인 문구" value={company.sealLabel} onChange={(v) => setCompany({ ...company, sealLabel: v })} />
          <Field label="업태" value={company.bizType} onChange={(v) => setCompany({ ...company, bizType: v })} />
          <Field label="종목" value={company.bizItem} onChange={(v) => setCompany({ ...company, bizItem: v })} />
          <div className="sm:col-span-2">
            <Label>주소</Label>
            <Input value={company.address} onChange={(e) => setCompany({ ...company, address: e.target.value })} />
          </div>
          <Field label="은행" value={company.bankName} onChange={(v) => setCompany({ ...company, bankName: v })} />
          <Field label="계좌" value={company.bankAccount} onChange={(v) => setCompany({ ...company, bankAccount: v })} />
          <Field label="예금주" value={company.bankHolder} onChange={(v) => setCompany({ ...company, bankHolder: v })} />
          <Field
            label="견적 유효일"
            type="number"
            value={String(company.quoteValidDays)}
            onChange={(v) => setCompany({ ...company, quoteValidDays: Number(v) || 14 })}
          />
          <Field
            label="급행 배수"
            value={String(company.rushRate)}
            onChange={(v) => setCompany({ ...company, rushRate: Number(v) || 1.3 })}
          />
          <Field
            label="직원 초대코드"
            value={company.inviteCode}
            onChange={(v) => setCompany({ ...company, inviteCode: v })}
          />
          <label className="flex h-11 items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={company.vatIncluded}
              onChange={(e) => setCompany({ ...company, vatIncluded: e.target.checked })}
            />
            단가에 부가세 포함
          </label>
        </div>
        <Button className="mt-4" onClick={() => saveCompany.mutate()} disabled={saveCompany.isPending}>
          회사 정보 저장
        </Button>
      </section>

      <section className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)] md:p-5">
        <h2 className="font-display text-base font-semibold">품목 단가</h2>
        <ul className="mt-3 divide-y divide-border">
          {data.products.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <span>
                <span className="mr-2 text-[12px] text-subtle">{p.category}</span>
                {p.name}
                <span className="ml-2 text-muted">
                  {won(p.unitPrice)} / {p.unit}
                  {p.minQty > 1 ? ` · 최소 ${p.minQty}` : ""}
                </span>
              </span>
              <label className="flex items-center gap-2 text-[13px] text-muted">
                단가
                <Input
                  className="h-10 w-28"
                  type="number"
                  defaultValue={p.unitPrice}
                  onBlur={(e) =>
                    patchProduct.mutate({
                      id: p.id,
                      name: p.name,
                      unit: p.unit,
                      unitPrice: Number(e.target.value) || 0,
                      active: p.active,
                      category: p.category,
                      minQty: p.minQty,
                    })
                  }
                />
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10 text-stamp"
                aria-label={`${p.name} 삭제`}
                disabled={deleteProductMut.isPending}
                onClick={() => {
                  if (window.confirm(`${p.name} 품목을 단가표에서 뺄까요?`)) {
                    deleteProductMut.mutate(p.id);
                  }
                }}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
        <form
          className="mt-4 grid gap-2 sm:grid-cols-[1fr_6rem_7rem_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            saveProduct.mutate();
          }}
        >
          <Input
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="품목명"
            required
          />
          <NativeSelect value={productUnit} onChange={(e) => setProductUnit(e.target.value as ProductUnit)}>
            <option value="㎡">㎡</option>
            <option value="개">개</option>
            <option value="건">건</option>
            <option value="자">자</option>
          </NativeSelect>
          <Input
            type="number"
            min={0}
            value={productPrice}
            onChange={(e) => setProductPrice(e.target.value)}
            placeholder="단가"
          />
          <Button type="submit" disabled={saveProduct.isPending}>
            추가
          </Button>
        </form>
      </section>

      <section className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)] md:p-5">
        <h2 className="font-display text-base font-semibold">직원</h2>
        <p className="mt-1 text-[13px] text-muted">
          상단에서 본인을 고르면 대화·이력이 그 이름으로 남습니다. 새 사람은 여기 추가한 뒤, 초대코드로 계정을 만듭니다.
        </p>
        <ul className="mt-3 space-y-2">
          {data.staff.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] bg-elevated px-3 py-2 text-sm shadow-[var(--shadow-border)]"
            >
              <span>
                {s.name}
                <span className="ml-1 text-muted">{s.role}</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10 text-stamp"
                disabled={data.staff.length <= 1 || deleteStaffMut.isPending}
                onClick={() => {
                  if (window.confirm(`${s.name} 님을 직원 목록에서 뺄까요?`)) {
                    deleteStaffMut.mutate(s.id);
                  }
                }}
                aria-label={`${s.name} 삭제`}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!staffName.trim()) return;
            saveStaff.mutate();
          }}
        >
          <Input value={staffName} onChange={(e) => setStaffName(e.target.value)} placeholder="이름" required />
          <Input value={staffRole} onChange={(e) => setStaffRole(e.target.value)} placeholder="역할" />
          <Button type="submit" disabled={saveStaff.isPending}>
            추가
          </Button>
        </form>
      </section>

      <section className="rounded-[var(--radius-lg)] bg-primary p-4 text-primary-fg shadow-[var(--shadow-border)] md:p-5">
        <h2 className="font-display text-base font-semibold">외부에 안 보이게</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-primary-fg/90">
          <li>작업실 주소는 직원 카톡·전화로만 보냅니다. 홈페이지·명함·검색에 올리지 마세요.</li>
          <li>각자 이메일+비밀번호로 들어갑니다. 구글 공개 로그인은 막아 두었습니다.</li>
          <li>새 직원은 설정에 이름을 추가한 뒤, 초대코드를 알려 주고 계정을 만들게 합니다. 기본 코드는 adsmile 이니 바로 바꾸세요.</li>
          <li>단가·주문·시안은 로그인해야만 보입니다. 로그아웃하면 빈 들어가기 화면만 나옵니다.</li>
          <li>거래처에게 견적서를 보낼 때는 인쇄본·파일만 주세요. 이 프로그램 주소는 주지 마세요.</li>
        </ol>
      </section>

      <section className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)] md:p-5">
        <h2 className="font-display text-base font-semibold">달별 보관 · 백업</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          따로 저장소를 만들 필요 없습니다. 글(주문·단가·거래처)은 몇 년을 쌓아도 아주
          적습니다. 용량을 쓰는 건 올린 시안 그림뿐이고, 올릴 때 이미 줄여 둡니다. 사무소
          규모면 수년은 거뜬합니다. 달이 바뀌어도 자료는 안 지워집니다.
        </p>
        {storageQ.data ? (
          <p className="mt-3 rounded-[var(--radius-sm)] bg-elevated px-3 py-2.5 text-[13px] leading-relaxed shadow-[var(--shadow-border)]">
            지금 주문 {storageQ.data.orders}건 · 거래처 {storageQ.data.clients}곳 · 시안 그림{" "}
            {storageQ.data.images}장 · 그림 {formatBytes(storageQ.data.imageBytes)}
            {storageQ.data.archiveBytes > 0
              ? ` · 달별 보관 ${formatBytes(storageQ.data.archiveBytes)}`
              : ""}
          </p>
        ) : null}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button type="button" onClick={() => snapshotMut.mutate()} disabled={snapshotMut.isPending}>
            {snapshotMut.isPending ? "보관 중…" : "지금 이달 보관"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => exportMut.mutate()}
            disabled={exportMut.isPending}
          >
            {exportMut.isPending ? "만드는 중…" : "백업 파일 내려받기"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={restoreMut.isPending}
          >
            {restoreMut.isPending ? "되돌리는 중…" : "백업으로 되돌리기"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              if (
                !window.confirm(
                  "지금 작업판이 이 백업 파일 내용으로 바뀝니다. 지금 내용은 사라집니다. 계속할까요?",
                )
              ) {
                return;
              }
              const json = await file.text();
              restoreMut.mutate(json);
            }}
          />
        </div>
        <ul className="mt-4 divide-y divide-border">
          {(archivesQ.data ?? []).length === 0 ? (
            <li className="py-2 text-sm text-muted">아직 달별 보관본이 없습니다. 지금 이달 보관을 눌러 두세요.</li>
          ) : (
            (archivesQ.data ?? []).map((a) => (
              <li key={a.month} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span>
                  {a.current ? "이번 달 · " : ""}
                  {formatYearMonth(a.month)}
                  <span className="ml-2 text-muted">주문 {a.orderCount}건</span>
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={downloadArchiveMut.isPending}
                  onClick={() => downloadArchiveMut.mutate(a.month)}
                >
                  파일 받기
                </Button>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}

function formatBytes(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "0MB";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))}KB`;
  return `${(n / (1024 * 1024)).toFixed(n >= 10 * 1024 * 1024 ? 0 : 1)}MB`;
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
