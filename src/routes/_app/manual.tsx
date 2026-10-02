import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PriceTable, QuoteCalculator } from "@/components/quote-calculator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CATALOG,
  CATEGORIES,
  FILE_RULES,
  FLYER_MIN,
  FOLD_TYPES,
  OUTPUT_RULES,
  PHONE_SCRIPTS,
  PRICE_NOTE,
  PRINT_GUIDE,
  REQUEST_GUIDE,
  TERMS,
  VENDORS,
  WOOJIN_STEPS,
  greetingLine,
  suggestFolder,
  suggestOutputName,
  suggestRequestName,
} from "@/lib/catalog";
import { PrintGuideFigure } from "@/components/print-guide-figures";
import { useStaffSession } from "@/lib/staff-session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/manual")({
  component: ManualPage,
});

const TABS = [
  { id: "price", label: "단가표" },
  { id: "quote", label: "견적" },
  { id: "phone", label: "전화응대" },
  { id: "request", label: "의뢰서" },
  { id: "card", label: "명함접수" },
  { id: "terms", label: "용어" },
  { id: "output", label: "출력파일" },
  { id: "print", label: "인쇄작업" },
  { id: "files", label: "파일명" },
  { id: "vendors", label: "매입처" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function ManualPage() {
  const [tab, setTab] = useState<TabId>("price");
  const staffName = useStaffSession((s) => s.name);

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[13px] text-muted">디자인팀 업무 매뉴얼 · 최연수 대표 · 손채은 과장 · 지재회 대리</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">단가 · 응대 · 용어</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">{PRICE_NOTE}</p>
      </header>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "h-10 shrink-0 rounded-full px-3.5 text-sm transition-colors duration-150",
              tab === t.id
                ? "bg-primary text-primary-fg"
                : "bg-elevated text-muted shadow-[var(--shadow-border)] hover:text-fg",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "price" && <PriceSection />}
      {tab === "quote" && (
        <section className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)] md:p-5">
          <h2 className="font-display text-lg font-semibold">전화 견적</h2>
          <p className="mt-1 text-[13px] text-muted">
            매뉴얼 1장 단가 기준. 부가세 별도. 명함·스티커·봉투는 1건(시안 1종) 단가입니다.
          </p>
          <div className="mt-4">
            <QuoteCalculator />
          </div>
        </section>
      )}
      {tab === "phone" && <PhoneSection staffName={staffName} />}
      {tab === "request" && <RequestSection />}
      {tab === "card" && <CardOrderSection />}
      {tab === "terms" && <TermsSection />}
      {tab === "output" && <OutputSection />}
      {tab === "print" && <PrintSection />}
      {tab === "files" && <FilesSection />}
      {tab === "vendors" && <VendorsSection />}
    </div>
  );
}

function PriceSection() {
  return (
    <div className="space-y-6">
      {CATEGORIES.map((cat) => (
        <section
          key={cat}
          className="overflow-hidden rounded-[var(--radius-lg)] bg-surface shadow-[var(--shadow-border)]"
        >
          <div className="flex items-center justify-between bg-primary px-4 py-3 text-primary-fg">
            <h2 className="font-display text-base font-semibold">{cat}</h2>
          </div>
          <PriceTable rows={CATALOG.filter((r) => r.category === cat)} />
        </section>
      ))}

      <section className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)] md:p-5">
        <h2 className="font-display text-base font-semibold">전단 · 최소수량만</h2>
        <p className="mt-1 text-[13px] text-muted">
          가격표에 없음. 종이재질에 따라 변동. 적은 수량도 가능하지만 장당 단가가 비싸집니다. 매입 확인 후
          안내.
        </p>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {FLYER_MIN.map((f) => (
            <li
              key={f.size}
              className="rounded-[var(--radius-md)] bg-elevated px-3 py-2 text-sm shadow-[var(--shadow-border)]"
            >
              <p className="font-medium">{f.size}</p>
              <p className="text-muted">{f.qty}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function CheckList({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <section className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)] md:p-5">
      <h3 className="font-display text-base font-semibold">{title}</h3>
      <ol className="mt-3 space-y-2">
        {items.map((item, i) => (
          <li key={item} className="flex gap-3 text-sm">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-accent">
              {i + 1}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function PhoneSection({ staffName }: { staffName: string }) {
  const line = greetingLine(staffName || "○○○");
  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-lg)] bg-primary p-4 text-primary-fg md:p-5">
        <p className="text-[12px] tracking-wide text-primary-fg/75">
          첫 인사 · 메모하면서 응대, 담당자 성함과 연락처 확인
        </p>
        <p className="mt-2 font-display text-xl font-bold">{line}</p>
      </section>
      <CheckList title="현수막 의뢰" items={PHONE_SCRIPTS.banner} />
      <CheckList title="감사패 · 기념패" items={PHONE_SCRIPTS.plaque} />
      <CheckList title="X배너 의뢰" items={PHONE_SCRIPTS.xbanner} />
      <CheckList title="책자 의뢰" items={PHONE_SCRIPTS.booklet} />
      <CheckList title="이전에 했던 것 재의뢰" items={PHONE_SCRIPTS.reorder} />
      <CheckList title="방문수령 · 납품 · 시공" items={PHONE_SCRIPTS.pickup} />
      <CheckList title="퀵 · 택배" items={PHONE_SCRIPTS.ship} />
      <CheckList title="세금계산서" items={PHONE_SCRIPTS.tax} />
    </div>
  );
}

function RequestSection() {
  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-lg)] bg-primary p-4 text-primary-fg md:p-5">
        <p className="text-[12px] text-primary-fg/75">매뉴얼 4. 의뢰서</p>
        <p className="mt-1 font-display text-xl font-bold">주문 의뢰서</p>
        <p className="mt-2 text-sm text-primary-fg/85">
          주문 상세에서 「의뢰서」를 누르면 이 양식으로 인쇄됩니다. 담당자는 상단에서 고른 이름입니다.
        </p>
      </section>
      {REQUEST_GUIDE.map((block) => (
        <CheckList key={block.title} title={block.title} items={block.items} />
      ))}
    </div>
  );
}

function CardOrderSection() {
  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)] md:p-5">
        <h3 className="font-display text-base font-semibold">우진협동조합 명함 접수</h3>
        <p className="mt-1 text-[13px] text-muted">
          명함 사이즈와 도수(4도 단면 / 8도 양면)를 반드시 확인. 재질마다 출고일이 다릅니다.
        </p>
      </section>
      <CheckList title="접수 순서" items={WOOJIN_STEPS} />
    </div>
  );
}

function TermsSection() {
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const needle = q.trim();
    const list = needle
      ? TERMS.filter((t) => t.name.includes(needle) || t.body.includes(needle) || t.group.includes(needle))
      : TERMS;
    const map = new Map<string, typeof TERMS>();
    for (const t of list) {
      const arr = map.get(t.group) ?? [];
      arr.push(t);
      map.set(t.group, arr);
    }
    return [...map.entries()];
  }, [q]);

  return (
    <div className="space-y-4">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="열재단, 배다, 세네카…" />
      {groups.length === 0 ? (
        <p className="text-sm text-muted">해당하는 용어가 없습니다.</p>
      ) : (
        groups.map(([group, items]) => (
          <section
            key={group}
            className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)] md:p-5"
          >
            <h3 className="font-display text-base font-semibold">{group}</h3>
            <dl className="mt-3 divide-y divide-border">
              {items.map((t) => (
                <div key={t.name} className="grid gap-1 py-2.5 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
                  <dt className="text-sm font-medium">{t.name}</dt>
                  <dd className="text-sm text-muted">{t.body}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))
      )}
      <section className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)] md:p-5">
        <h3 className="font-display text-base font-semibold">접지</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {FOLD_TYPES.map((f) => (
            <span
              key={f}
              className="rounded-full bg-elevated px-3 py-1.5 text-[13px] shadow-[var(--shadow-border)]"
            >
              {f}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

function OutputSection() {
  return (
    <div className="space-y-4">
      {OUTPUT_RULES.map((block) => (
        <section
          key={block.title}
          className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)] md:p-5"
        >
          <h3 className="font-display text-base font-semibold">{block.title}</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {block.items.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function PrintSection() {
  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-lg)] bg-primary p-4 text-primary-fg md:p-5">
        <p className="text-[12px] tracking-wide text-primary-fg/75">인쇄(일러스트) · 2026. 9. 17. 최연수 대표 교육</p>
        <p className="mt-1 font-display text-xl font-bold">새 문서부터 서체 확인까지</p>
        <p className="mt-2 text-sm text-primary-fg/85">
          초보·새 디자이너가 오면 이 장을 본다. 화면만 보지 말고 출력해서 확인한다.
        </p>
        <a
          href="/adsmile-print-guide.pdf"
          download="인쇄작업.pdf"
          className="mt-4 inline-flex h-10 items-center rounded-full bg-surface px-4 text-sm font-medium text-fg"
        >
          인쇄작업 PDF 받기
        </a>
      </section>
      {PRINT_GUIDE.map((block) => (
        <section
          key={block.id}
          className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)] md:p-5"
        >
          <h3 className="font-display text-base font-semibold">{block.title}</h3>
          <div className="mt-3">
            <PrintGuideFigure id={block.figure} caption={block.caption} />
          </div>
          <ol className="mt-4 space-y-2">
            {block.items.map((item, i) => (
              <li key={item} className="flex gap-3 text-sm">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-accent">
                  {i + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function FilesSection() {
  const [content, setContent] = useState("덕진지점 이벤트");
  const [item, setItem] = useState("현수막");
  const [size, setSize] = useState("150×140");
  const [material, setMaterial] = useState("상단큐방");
  const [qty, setQty] = useState("1장");
  const [extra, setExtra] = useState(false);
  const folder = suggestFolder(content, item);
  const request = suggestRequestName(content, extra);
  const output = suggestOutputName(`${folder.replace(` ${item}`, "")}`, size, material, qty);

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)] md:p-5">
        <h3 className="font-display text-base font-semibold">오늘 날짜로 이름 만들기</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="fc">내용</Label>
            <Input id="fc" value={content} onChange={(e) => setContent(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="fi">품목</Label>
            <Input id="fi" value={item} onChange={(e) => setItem(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="fs">사이즈</Label>
            <Input id="fs" value={size} onChange={(e) => setSize(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="fm">재질·후가공</Label>
            <Input id="fm" value={material} onChange={(e) => setMaterial(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="fq">수량</Label>
            <Input id="fq" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={extra}
            onChange={(e) => setExtra(e.target.checked)}
          />
          품목 2가지 이상 (의뢰서에 「외」)
        </label>
        <dl className="mt-4 space-y-2 text-sm">
          <div>
            <dt className="text-[12px] text-muted">폴더</dt>
            <dd className="font-mono text-[13px]">{folder}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-muted">의뢰서</dt>
            <dd className="font-mono text-[13px]">{request}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-muted">출력 파일</dt>
            <dd className="font-mono text-[13px]">{output}</dd>
          </div>
        </dl>
      </section>
      {FILE_RULES.map((block) => (
        <section
          key={block.title}
          className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)] md:p-5"
        >
          <h3 className="font-display text-base font-semibold">{block.title}</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {block.items.map((itemLine) => (
              <li key={itemLine}>{itemLine}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function VendorsSection() {
  const [q, setQ] = useState("");
  const list = VENDORS.filter(
    (v) => !q.trim() || v.name.includes(q) || v.use.includes(q) || v.phone.includes(q),
  );
  return (
    <div className="space-y-3">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="포맥스, 퀵, 제본…" />
      <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-lg)] bg-surface shadow-[var(--shadow-border)]">
        {list.map((v) => (
          <li key={v.name} className="px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium">{v.name}</p>
              <a href={`tel:${v.phone.split(" / ")[0]}`} className="tabular-nums text-sm text-accent">
                {v.phone}
              </a>
            </div>
            <p className="mt-1 text-[13px] text-muted">{v.use}</p>
            {v.email ? <p className="mt-0.5 text-[12px] text-subtle">{v.email}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
