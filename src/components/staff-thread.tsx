import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { formatClock } from "@/lib/format";
import type { Message } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StaffThread({
  messages,
  staffName,
  pending,
  onSend,
}: {
  messages: Message[];
  staffName: string;
  pending?: boolean;
  onSend: (body: string) => void;
}) {
  const [body, setBody] = useState("");

  return (
    <section className="flex min-h-[22rem] flex-col rounded-[var(--radius-lg)] bg-surface shadow-[var(--shadow-border)]">
      <header className="border-b border-border px-4 py-3">
        <h2 className="font-display text-base font-semibold">작업 대화</h2>
        <p className="text-[12px] text-muted">카톡 대신 이 주문 안에서만 오갑니다.</p>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">아직 대화가 없습니다.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn(m.kind === "system" && "opacity-80")}>
              <div className="flex items-baseline gap-2 text-[12px] text-subtle">
                <span className="font-medium text-muted">{m.staffName}</span>
                <span>{formatClock(m.createdAt)}</span>
              </div>
              <p
                className={cn(
                  "mt-1 text-sm leading-relaxed",
                  m.kind === "system" ? "text-muted" : "text-fg",
                )}
              >
                {m.body}
              </p>
            </div>
          ))
        )}
      </div>
      <form
        className="border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const next = body.trim();
          if (!next) return;
          onSend(next);
          setBody("");
        }}
      >
        <Textarea
          className="min-h-[4.5rem]"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={`${staffName} 이름으로 남기기`}
        />
        <Button type="submit" className="mt-2 w-full" disabled={pending || !body.trim()}>
          보내기
        </Button>
      </form>
    </section>
  );
}
