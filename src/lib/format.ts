import { format, isToday, isTomorrow, isYesterday, parseISO } from "date-fns";
import { ko } from "date-fns/locale";

export function parseDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const iso = value.length === 10 ? `${value}T00:00:00` : value;
  const d = parseISO(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value: string | Date | null | undefined): string {
  const d = parseDate(value);
  if (!d) return "—";
  return format(d, "M월 d일 (eee)", { locale: ko });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  const d = parseDate(value);
  if (!d) return "—";
  return format(d, "M월 d일 HH:mm", { locale: ko });
}

export function formatClock(value: string | Date | null | undefined): string {
  const d = parseDate(value);
  if (!d) return "";
  if (isToday(d)) return format(d, "오늘 HH:mm", { locale: ko });
  if (isYesterday(d)) return format(d, "어제 HH:mm", { locale: ko });
  if (isTomorrow(d)) return format(d, "내일 HH:mm", { locale: ko });
  return format(d, "M/d HH:mm", { locale: ko });
}

export function dueLabel(value: string | Date | null | undefined): string {
  const d = parseDate(value);
  if (!d) return "납기 미정";
  if (isToday(d)) return "오늘 납기";
  if (isTomorrow(d)) return "내일 납기";
  return `${format(d, "M월 d일", { locale: ko })} 납기`;
}

export function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return String(value ?? "");
}

export function toDateOnly(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s || null;
}

export function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value);
  return 0;
}

export function asBool(value: unknown): boolean {
  return value === true || value === "t" || value === "true";
}

export function seoulDate(value: string | Date = new Date()): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  }
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

export function seoulMonth(value?: string | Date): string {
  return seoulDate(value ?? new Date()).slice(0, 7);
}

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const dt = new Date(Date.UTC(y || 2026, (m || 1) - 1 + delta, 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function formatYearMonth(ym: string): string {
  const [y, m] = ym.split("-");
  if (!y || !m) return ym;
  return `${Number(y)}년 ${Number(m)}월`;
}
