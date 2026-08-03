"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DashboardNav, type NavItem } from "@/components/dashboard/dashboard-nav";
import { SignOutButton } from "@/components/dashboard/sign-out-button";

export function MobileNav({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="iconSm" className="lg:hidden" aria-label="Open menu">
          <Menu />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xs">
        <DialogTitle>Menu</DialogTitle>
        <div className="mt-2">
          <DashboardNav items={items} onNavigate={() => setOpen(false)} />
        </div>
        <div className="mt-4 border-t border-white/10 pt-4">
          <SignOutButton />
        </div>
      </DialogContent>
    </Dialog>
  );
}
