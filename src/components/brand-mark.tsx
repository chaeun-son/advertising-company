import { BRAND, PRODUCT_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src={BRAND.symbol}
      alt={PRODUCT_NAME}
      className={cn("object-contain", className)}
    />
  );
}
