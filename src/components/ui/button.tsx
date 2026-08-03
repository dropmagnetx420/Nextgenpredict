import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/70 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-primary to-secondary text-primary-foreground shadow-[0_0_24px_-6px_var(--color-primary)] hover:shadow-[0_0_36px_-4px_var(--color-primary)] hover:brightness-110",
        accent:
          "bg-gradient-to-r from-accent to-secondary text-background hover:brightness-110",
        destructive:
          "bg-gradient-to-r from-rose-500 to-red-600 text-white hover:brightness-110",
        outline:
          "border border-white/15 bg-white/[0.03] text-foreground hover:border-secondary/60 hover:text-secondary hover:bg-white/[0.06]",
        ghost: "text-muted hover:text-foreground hover:bg-white/[0.06]",
        link: "text-secondary underline-offset-4 hover:underline",
        success:
          "bg-gradient-to-r from-emerald-500 to-accent text-background hover:brightness-110",
      },
      size: {
        default: "h-10 px-5",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-7 text-base",
        icon: "h-10 w-10",
        iconSm: "h-8 w-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
