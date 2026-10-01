import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium tracking-tight",
  {
    variants: {
      tone: {
        ink: "bg-primary/10 text-primary",
        draft: "bg-draft/12 text-draft",
        review: "bg-warn/12 text-warn",
        make: "bg-make/12 text-make",
        done: "bg-ok/12 text-ok",
        hold: "bg-muted/15 text-muted",
        stamp: "bg-stamp/12 text-stamp",
      },
    },
    defaultVariants: { tone: "ink" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
