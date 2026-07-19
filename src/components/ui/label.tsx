"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const labelVariants = cva(
  "text-sm font-medium leading-none tracking-tight peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
);

type LabelProps = React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
  VariantProps<typeof labelVariants> & { required?: boolean };

const Label = React.forwardRef<React.ElementRef<typeof LabelPrimitive.Root>, LabelProps>(
  ({ className, children, required, ...props }, ref) => (
    <LabelPrimitive.Root ref={ref} className={cn(labelVariants(), className)} {...props}>
      {children}
      {required ? <RequiredMark /> : null}
    </LabelPrimitive.Root>
  ),
);
Label.displayName = LabelPrimitive.Root.displayName;

/** Inline red asterisk for required fields. Use next to any label text. */
const RequiredMark = ({ className }: { className?: string }) => (
  <span
    aria-hidden="true"
    className={cn("ml-0.5 text-destructive select-none", className)}
  >
    *
  </span>
);
RequiredMark.displayName = "RequiredMark";

export { Label, RequiredMark };
