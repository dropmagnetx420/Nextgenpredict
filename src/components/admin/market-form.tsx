"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { MAX_MARKET_OPTIONS } from "@/lib/validators";
import type { ActionResult, Market, MarketOption } from "@/lib/types";

/** `datetime-local` needs `YYYY-MM-DDTHH:mm` in local time. */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface MarketFormProps {
  market?: Market;
  options?: Pick<MarketOption, "label" | "price">[];
  /** Once a market has predictions on it, its outcome set is frozen. */
  hasTrades?: boolean;
}

interface OptionRow {
  key: number;
  label: string;
  price: string;
}

/** Even opening quote across n outcomes, e.g. 3 → 33¢ each. */
function evenPrice(count: number): string {
  return String(Math.max(1, Math.min(99, Math.round(100 / Math.max(count, 1)))));
}

function presetRows(labels: string[], startKey: number): OptionRow[] {
  const price = evenPrice(labels.length);
  return labels.map((label, index) => ({ key: startKey + index, label, price }));
}

export function MarketForm({ market, options: existingOptions, hasTrades }: MarketFormProps) {
  const router = useRouter();
  const [state, action] = useActionState<ActionResult<Market> | null, FormData>(
    saveMarket,
    null
  );

  const [rows, setRows] = useState<OptionRow[]>(() =>
    existingOptions?.length
      ? existingOptions.map((option, index) => ({
          key: index,
          label: option.label,
          price: String(option.price),
        }))
      : presetRows(["", ""], 0)
  );
  // Monotonic so React keys stay stable as rows are added and removed.
  const [nextKey, setNextKey] = useState(() => rows.length);

  const locked = Boolean(hasTrades);

  function updateRow(key: number, patch: Partial<OptionRow>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row))
    );
  }

  function addRow() {
    setRows((current) => [...current, { key: nextKey, label: "", price: evenPrice(current.length + 1) }]);
    setNextKey((key) => key + 1);
  }

  function removeRow(key: number) {
    setRows((current) => (current.length <= 2 ? current : current.filter((row) => row.key !== key)));
  }

  function applyPreset(labels: string[]) {
    setRows(presetRows(labels, nextKey));
    setNextKey((key) => key + labels.length);
  }

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
            hint="What are members predicting?"
            errors={errors?.question}
          >
            <Input
              id="question"
              name="question"
              required
              defaultValue={market?.question ?? ""}
              placeholder="Which team will win the match?"
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

          <div className="space-y-3 rounded-2xl border border-white/12 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground/90">Outcomes</p>
                <p className="text-xs text-muted">
                  {locked
                    ? "This market already has predictions, so its outcomes are locked."
                    : "Two or more. Opening odds are in cents and move with traded volume."}
                </p>
              </div>
              {!locked && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => applyPreset(["Home", "Draw", "Away"])}
                  >
                    Home / Draw / Away
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => applyPreset(["Yes", "No"])}
                  >
                    Yes / No
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {rows.map((row, index) => (
                <div key={row.key} className="flex items-start gap-2">
                  <div className="flex-1">
                    <label className="sr-only" htmlFor={`option_label_${row.key}`}>
                      Outcome {index + 1} name
                    </label>
                    <Input
                      id={`option_label_${row.key}`}
                      name="option_label"
                      required
                      readOnly={locked}
                      maxLength={60}
                      value={row.label}
                      onChange={(event) => updateRow(row.key, { label: event.target.value })}
                      placeholder={`Outcome ${index + 1}`}
                    />
                  </div>
                  <div className="w-28">
                    <label className="sr-only" htmlFor={`option_price_${row.key}`}>
                      Outcome {index + 1} opening odds in cents
                    </label>
                    <Input
                      id={`option_price_${row.key}`}
                      name="option_price"
                      type="number"
                      min={1}
                      max={99}
                      step="1"
                      required
                      readOnly={locked}
                      value={row.price}
                      onChange={(event) => updateRow(row.key, { price: event.target.value })}
                      aria-label={`Outcome ${index + 1} opening odds in cents`}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={locked || rows.length <= 2}
                    onClick={() => removeRow(row.key)}
                    aria-label={`Remove outcome ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {!locked && rows.length < MAX_MARKET_OPTIONS && (
              <Button type="button" variant="ghost" size="sm" onClick={addRow}>
                <Plus className="h-4 w-4" />
                Add outcome
              </Button>
            )}

            {errors?.options?.length ? (
              <p className="text-xs font-medium text-rose-300" role="alert">
                {errors.options[0]}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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
