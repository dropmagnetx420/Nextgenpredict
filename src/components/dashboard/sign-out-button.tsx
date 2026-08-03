"use client";

import { LogOut } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { signOut } from "@/app/actions/auth";

export function SignOutButton({ className, variant = "ghost", size }: ButtonProps) {
  return (
    <form action={signOut} className={className}>
      <Button type="submit" variant={variant} size={size} className="w-full justify-start gap-2">
        <LogOut aria-hidden /> Sign out
      </Button>
    </form>
  );
}
