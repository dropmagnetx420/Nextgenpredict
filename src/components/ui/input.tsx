import * as React from "react";
import { cn } from "@/lib/utils";

const baseField =
  "flex w-full rounded-xl border border-white/12 bg-black/25 px-3.5 py-2 text-sm text-foreground shadow-inner transition-colors placeholder:text-muted/70 focus-visible:outline-none focus-visible:border-secondary/70 focus-visible:ring-2 focus-visible:ring-secondary/25 disabled:cursor-not-allowed disabled:opacity-50";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        baseField,
        "h-10 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(baseField, "min-h-[88px] resize-y", className)} {...props} />
  )
);
Textarea.displayName = "Textarea";

export { Input, Textarea, baseField };
