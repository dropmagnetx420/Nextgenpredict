"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FormBanner, SubmitButton } from "@/components/ui/form";
import { saveMarket } from "@/app/actions/admin";
import { SPORTS } from "@/lib/constants";
import type { ActionResult, Market } from "@/lib/types";

/** `datetime-local` needs `YYYY-MM-DDTHH:mm` in local time. */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function MarketForm({ market }: { market?: Market }) {
  const router = useRouter();
  const [state, action] = useActionState<ActionResult<Market> | null, FormData>(
    saveMarket,
    null
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "Saved.");
      router.push("/admin/markets");
    }
  }, [state, router]);

  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <Card>
      <CardContent className="p-6">
        <form action={action} className="space-y-5">
          {market && <input type="hidden" name="id" value={market.id} />}

          {state && !state.ok && <FormBanner>{state.error}</FormBanner>}

          <Field label="Title" htmlFor="title" errors={errors?.title}>
            <Input
              id="title"
              name="title"
              required
              defaultValue={market?.title ?? ""}
              placeholder="Arsenal vs Chelsea — Premier League"
            />
          </Field>

          <Field
            label="Question"
            htmlFor="question"
            hint="Phrase it so YES is unambiguous."
            errors={errors?.question}
          >
            <Input
              id="question"
              name="question"
              required
              defaultValue={market?.question ?? ""}
              placeholder="Will Arsenal win?"
            />
          </Field>

          <Field label="Description" htmlFor="description" errors={errors?.description}>
            <Textarea
              id="description"
              name="description"
              rows={4}
              maxLength={2000}
              defaultValue={market?.description ?? ""}
              placeholder="Resolution source, edge cases, and what counts as a win."
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Sport" htmlFor="sport" errors={errors?.sport}>
              <Select name="sport" defaultValue={market?.sport ?? "football"}>
                <SelectTrigger id="sport">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPORTS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="League" htmlFor="league" errors={errors?.league}>
              <Input
                id="league"
                name="league"
                defaultValue={market?.league ?? ""}
                placeholder="Premier League"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Team A" htmlFor="team_a" errors={errors?.team_a}>
              <Input id="team_a" name="team_a" defaultValue={market?.team_a ?? ""} />
            </Field>
            <Field label="Team B" htmlFor="team_b" errors={errors?.team_b}>
              <Input id="team_b" name="team_b" defaultValue={market?.team_b ?? ""} />
            </Field>
            <Field label="Team A logo URL" htmlFor="team_a_logo" errors={errors?.team_a_logo}>
              <Input
                id="team_a_logo"
                name="team_a_logo"
                defaultValue={market?.team_a_logo ?? ""}
                placeholder="https://…"
              />
            </Field>
            <Field label="Team B logo URL" htmlFor="team_b_logo" errors={errors?.team_b_logo}>
              <Input
                id="team_b_logo"
                name="team_b_logo"
                defaultValue={market?.team_b_logo ?? ""}
                placeholder="https://…"
              />
            </Field>
          </div>

          <Field label="Banner URL" htmlFor="banner_url" errors={errors?.banner_url}>
            <Input
              id="banner_url"
              name="banner_url"
              defaultValue={market?.banner_url ?? ""}
              placeholder="https://…"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Opening YES price (¢)"
              htmlFor="yes_price"
              hint="2–98. NO is the remainder."
              errors={errors?.yes_price}
            >
              <Input
                id="yes_price"
                name="yes_price"
                type="number"
                min={2}
                max={98}
                step="1"
                required
                defaultValue={market?.yes_price ?? 50}
              />
            </Field>
            <Field label="Min trade (USDG)" htmlFor="min_trade" errors={errors?.min_trade}>
              <Input
                id="min_trade"
                name="min_trade"
                type="number"
                min={1}
                step="0.01"
                required
                defaultValue={market?.min_trade ?? 1}
              />
            </Field>
            <Field label="Max trade (USDG)" htmlFor="max_trade" errors={errors?.max_trade}>
              <Input
                id="max_trade"
                name="max_trade"
                type="number"
                min={1}
                step="0.01"
                required
                defaultValue={market?.max_trade ?? 1000}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start time" htmlFor="start_time" errors={errors?.start_time}>
              <Input
                id="start_time"
                name="start_time"
                type="datetime-local"
                required
                defaultValue={toLocalInput(market?.start_time)}
              />
            </Field>
            <Field
              label="Close time"
              htmlFor="end_time"
              hint="Trading stops here."
              errors={errors?.end_time}
            >
              <Input
                id="end_time"
                name="end_time"
                type="datetime-local"
                required
                defaultValue={toLocalInput(market?.end_time)}
              />
            </Field>
          </div>

          <Field label="Status" htmlFor="status" errors={errors?.status}>
            <Select
              name="status"
              defaultValue={
                market && ["draft", "open", "closed"].includes(market.status)
                  ? market.status
                  : "draft"
              }
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft — hidden from members</SelectItem>
                <SelectItem value="open">Open — accepting trades</SelectItem>
                <SelectItem value="closed">Closed — awaiting settlement</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                name="is_featured"
                value="true"
                defaultChecked={market?.is_featured ?? false}
                className="h-4 w-4 rounded border-white/20 bg-black/25"
              />
              Feature on the homepage
            </label>
            <label className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                name="is_trending"
                value="true"
                defaultChecked={market?.is_trending ?? false}
                className="h-4 w-4 rounded border-white/20 bg-black/25"
              />
              Mark as trending
            </label>
          </div>

          <SubmitButton size="lg" pendingLabel="Saving…">
            {market ? "Save changes" : "Create market"}
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
