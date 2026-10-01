import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src="/adsmile-mark.png"
      alt="애드스마일"
      className={cn("object-contain", className)}
    />
  );
}
