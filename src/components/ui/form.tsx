"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Submit button wired to the enclosing form's pending state, so every form
 * gets consistent disabled + spinner behaviour without extra state.
 */
export function SubmitButton({
  children,
  pendingLabel,
  className,
  ...props
}: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending || props.disabled} className={cn(className)} {...props}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {pending ? (pendingLabel ?? "Working…") : children}
    </Button>
  );
}

export function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p className="text-xs font-medium text-rose-300" role="alert">
      {messages[0]}
    </p>
  );
}

export function FormBanner({
  variant = "error",
  children,
}: {
  variant?: "error" | "success" | "info";
  children: React.ReactNode;
}) {
  if (!children) return null;
  const styles = {
    error: "border-rose-400/30 bg-rose-500/10 text-rose-200",
    success: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    info: "border-secondary/30 bg-secondary/10 text-secondary",
  }[variant];

  return (
    <div className={cn("rounded-xl border px-4 py-3 text-sm", styles)} role="status">
      {children}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  errors,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  errors?: string[];
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground/90">
        {label}
      </label>
      {children}
      {hint && !errors?.length && <p className="text-xs text-muted">{hint}</p>}
      <FieldError messages={errors} />
    </div>
  );
}
