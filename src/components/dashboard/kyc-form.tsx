"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FormBanner, SubmitButton } from "@/components/ui/form";
import { submitKyc } from "@/app/actions/kyc";
import { createClient } from "@/lib/supabase/client";
import { KYC_DOC_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ActionResult, KycDocType, KycRequest } from "@/lib/types";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

type Slot = "front" | "back" | "selfie";

export function KycForm({ userId, defaultName }: { userId: string; defaultName: string }) {
  const [docType, setDocType] = useState<KycDocType>("national_id");
  const [paths, setPaths] = useState<Partial<Record<Slot, string>>>({});
  const [uploading, setUploading] = useState<Slot | null>(null);

  const [state, action] = useActionState<ActionResult<KycRequest> | null, FormData>(
    submitKyc,
    null
  );

  useEffect(() => {
    if (state?.ok) toast.success(state.message ?? "Documents submitted.");
  }, [state]);

  const upload = async (slot: Slot, file: File) => {
    if (file.size > MAX_BYTES) {
      toast.error("Files must be 5 MB or smaller.");
      return;
    }
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Upload a JPG, PNG, WebP or PDF.");
      return;
    }

    setUploading(slot);
    const supabase = createClient();
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${userId}/${slot}-${Date.now()}.${extension}`;

    const { error } = await supabase.storage
      .from("kyc-documents")
      .upload(path, file, { upsert: true, contentType: file.type });

    setUploading(null);

    if (error) {
      toast.error("Upload failed. Please try again.");
      return;
    }

    setPaths((prev) => ({ ...prev, [slot]: path }));
    toast.success("File uploaded.");
  };

  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const needsBack = docType !== "passport";
  const ready = Boolean(paths.front && paths.selfie && (!needsBack || paths.back));

  return (
    <Card>
      <CardContent className="p-6">
        <form action={action} className="space-y-5">
          <input type="hidden" name="front_path" value={paths.front ?? ""} />
          <input type="hidden" name="back_path" value={paths.back ?? ""} />
          <input type="hidden" name="selfie_path" value={paths.selfie ?? ""} />
          <input type="hidden" name="doc_type" value={docType} />

          {state?.ok && <FormBanner variant="success">{state.message}</FormBanner>}
          {state && !state.ok && <FormBanner>{state.error}</FormBanner>}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Document type" htmlFor="doc-type">
              <Select
                value={docType}
                onValueChange={(value) => setDocType(value as KycDocType)}
              >
                <SelectTrigger id="doc-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(KYC_DOC_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Document number"
              htmlFor="document_number"
              errors={errors?.document_number}
            >
              <Input id="document_number" name="document_number" required />
            </Field>

            <Field
              label="Full legal name"
              htmlFor="full_name"
              hint="Exactly as printed on your document."
              errors={errors?.full_name}
            >
              <Input id="full_name" name="full_name" defaultValue={defaultName} required />
            </Field>

            <Field
              label="Date of birth"
              htmlFor="date_of_birth"
              hint="You must be 18 or older."
              errors={errors?.date_of_birth}
            >
              <Input id="date_of_birth" name="date_of_birth" type="date" required />
            </Field>

            <Field label="Country" htmlFor="country" errors={errors?.country}>
              <Input id="country" name="country" required placeholder="United Kingdom" />
            </Field>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground/90">Uploads</p>

            <UploadSlot
              label="Document front"
              slot="front"
              uploaded={Boolean(paths.front)}
              busy={uploading === "front"}
              onSelect={upload}
              error={errors?.front_path?.[0]}
            />

            {needsBack && (
              <UploadSlot
                label="Document back"
                slot="back"
                uploaded={Boolean(paths.back)}
                busy={uploading === "back"}
                onSelect={upload}
                error={errors?.back_path?.[0]}
              />
            )}

            <UploadSlot
              label="Selfie holding your document"
              slot="selfie"
              uploaded={Boolean(paths.selfie)}
              busy={uploading === "selfie"}
              onSelect={upload}
              error={errors?.selfie_path?.[0]}
            />

            <p className="text-xs text-muted">
              JPG, PNG, WebP or PDF up to 5 MB each. Documents are stored encrypted and only
              seen by our review team.
            </p>
          </div>

          <SubmitButton
            className="w-full"
            size="lg"
            pendingLabel="Submitting…"
            disabled={!ready}
          >
            Submit for review
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}

function UploadSlot({
  label,
  slot,
  uploaded,
  busy,
  onSelect,
  error,
}: {
  label: string;
  slot: Slot;
  uploaded: boolean;
  busy: boolean;
  onSelect: (slot: Slot, file: File) => void;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors",
          uploaded
            ? "border-accent/40 bg-accent/10 text-accent"
            : "border-white/12 bg-black/25 text-muted hover:border-secondary/50 hover:text-foreground"
        )}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : uploaded ? (
          <Check className="h-4 w-4" aria-hidden />
        ) : (
          <Upload className="h-4 w-4" aria-hidden />
        )}
        <span className="flex-1">{label}</span>
        <span className="text-xs">{uploaded ? "Uploaded" : busy ? "Uploading…" : "Choose"}</span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onSelect(slot, file);
          event.target.value = "";
        }}
      />

      {error && (
        <p className="mt-1 text-xs font-medium text-rose-300" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
