import * as React from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      className={cn("block text-[13px] font-medium text-muted mb-1.5", className)}
      {...props}
    />
  );
}
