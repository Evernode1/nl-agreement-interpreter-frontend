import { AlertTriangle, Check, Minus, Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import type { AgreementType } from "../lib/types";
import {
  ADDRESS_RE,
  MAX_DUE_DAY_OF_MONTH,
  MAX_LATE_FEE_BPS,
  MAX_MILESTONES,
  MAX_TEXT_LEN,
  MIN_TEXT_LEN,
  TYPE_META,
  TYPE_ORDER,
  draftTextFromTerms,
  emptyDraft,
  emptyMilestone,
  hasPlaceholders,
  previewTerms,
} from "../lib/terms";
import type { DraftForm, PreviewTerm } from "../lib/terms";
import { NATIVE_SYMBOL } from "../lib/format";
import { Button, Card, HelperText, Input, Label, Textarea } from "./ui";
import { TypeIcon } from "./agreement";

// ---------------------------------------------------------------------------
// Type selector
// ---------------------------------------------------------------------------

export function TypeSelector({
  value,
  onChange,
}: {
  value: AgreementType;
  onChange: (t: AgreementType) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {TYPE_ORDER.map((t) => {
        const meta = TYPE_META[t];
        const active = t === value;
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            aria-pressed={active}
            className={`rounded-lg border p-4 text-left transition-colors ${
              active
                ? "border-quill-400 bg-quill-400/10"
                : "border-ink-700 bg-ink-900/60 hover:border-ink-600"
            }`}
          >
            <div className="flex items-center gap-2">
              <TypeIcon type={t} className={`h-4 w-4 ${active ? "text-quill-300" : "text-paper-400"}`} />
              <span className="font-display text-[15px] text-paper-100">{meta.label}</span>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-paper-400">{meta.blurb}</p>
            <p className="mt-2 text-[11px] text-paper-500">
              <span className="text-paper-400">Checked: </span>
              {meta.checks}
            </p>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Type-specific structured terms
// ---------------------------------------------------------------------------

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <Label hint={hint}>{label}</Label>
      {children}
    </div>
  );
}

function RentFields({ form, onChange }: { form: DraftForm; onChange: (f: DraftForm) => void }) {
  const set = (patch: Partial<DraftForm>) => onChange({ ...form, ...patch });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Monthly rent" hint={NATIVE_SYMBOL}>
        <Input
          inputMode="decimal"
          placeholder="e.g. 1.5"
          value={form.rentAmount}
          onChange={(e) => set({ rentAmount: e.target.value })}
        />
      </Field>
      <Field label="Due day of month" hint={`1–${MAX_DUE_DAY_OF_MONTH}`}>
        <Input
          type="number"
          min={1}
          max={MAX_DUE_DAY_OF_MONTH}
          value={form.dueDay}
          onChange={(e) => set({ dueDay: e.target.value })}
        />
      </Field>
      <Field label="Lease start">
        <Input type="date" value={form.leaseStart} onChange={(e) => set({ leaseStart: e.target.value })} />
      </Field>
      <Field label="Lease end">
        <Input type="date" value={form.leaseEnd} onChange={(e) => set({ leaseEnd: e.target.value })} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Late fee" hint={`0–${MAX_LATE_FEE_BPS / 100}% of one month's rent`}>
          <div className="flex items-center gap-3">
            <Input
              inputMode="decimal"
              className="w-32"
              value={form.lateFeePercent}
              onChange={(e) => set({ lateFeePercent: e.target.value })}
            />
            <span className="text-[13px] text-paper-400">% added when rent is paid after the due day</span>
          </div>
        </Field>
      </div>
    </div>
  );
}

function MilestoneFields({ form, onChange }: { form: DraftForm; onChange: (f: DraftForm) => void }) {
  const update = (i: number, patch: Partial<DraftForm["milestones"][number]>) => {
    const next = form.milestones.map((m, idx) => (idx === i ? { ...m, ...patch } : m));
    onChange({ ...form, milestones: next });
  };
  return (
    <div className="space-y-4">
      {form.milestones.map((m, i) => (
        <div key={i} className="rounded-md border border-ink-700 bg-ink-950/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-[12px] text-quill-300">Milestone {i + 1}</span>
            <button
              type="button"
              disabled={form.milestones.length <= 1}
              onClick={() => onChange({ ...form, milestones: form.milestones.filter((_, idx) => idx !== i) })}
              className="text-paper-500 hover:text-seal-400 disabled:opacity-30"
              aria-label={`Remove milestone ${i + 1}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-3">
            <Field label="Deliverable">
              <Textarea
                rows={2}
                placeholder="What exactly must be delivered for this payment?"
                value={m.description}
                onChange={(e) => update(i, { description: e.target.value })}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Payment" hint={NATIVE_SYMBOL}>
                <Input
                  inputMode="decimal"
                  placeholder="e.g. 0.5"
                  value={m.amount}
                  onChange={(e) => update(i, { amount: e.target.value })}
                />
              </Field>
              <Field label="Deadline">
                <Input type="date" value={m.deadline} onChange={(e) => update(i, { deadline: e.target.value })} />
              </Field>
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        disabled={form.milestones.length >= MAX_MILESTONES}
        onClick={() => onChange({ ...form, milestones: [...form.milestones, emptyMilestone()] })}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-quill-300 hover:text-quill-200 disabled:opacity-30"
      >
        <Plus className="h-4 w-4" /> Add milestone
        <span className="text-paper-500">
          ({form.milestones.length}/{MAX_MILESTONES})
        </span>
      </button>
      <HelperText>
        Deadlines must be in non-decreasing order. The client funds escrow with the exact sum of all
        payments before the contractor can accept.
      </HelperText>
    </div>
  );
}

function NdaFields({ form, onChange }: { form: DraftForm; onChange: (f: DraftForm) => void }) {
  return (
    <Field label="Confidentiality duration" hint="1–3650 days">
      <div className="flex items-center gap-3">
        <Input
          type="number"
          min={1}
          max={3650}
          className="w-32"
          value={form.ndaDays}
          onChange={(e) => onChange({ ...form, ndaDays: e.target.value })}
        />
        <span className="text-[13px] text-paper-400">days from activation</span>
      </div>
    </Field>
  );
}

// ---------------------------------------------------------------------------
// "What the checker will see"
// ---------------------------------------------------------------------------

function CheckMark({ check }: { check: PreviewTerm["check"] }) {
  if (check === "found") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-sage-400">
        <Check className="h-3.5 w-3.5" /> in text
      </span>
    );
  }
  if (check === "missing") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-gold-300">
        <AlertTriangle className="h-3.5 w-3.5" /> not found
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-paper-500">
      <Minus className="h-3.5 w-3.5" /> judged by validators
    </span>
  );
}

export function TermPreview({ form }: { form: DraftForm }) {
  const terms = previewTerms(form);
  if (form.type === "GENERIC") {
    return (
      <p className="text-[13px] leading-relaxed text-paper-400">
        A generic agreement has no structured terms, so the term check is skipped and it goes
        straight to “ready to accept”. Disputes over it are still decided from evidence.
      </p>
    );
  }
  if (terms.length === 0) {
    return <p className="text-[13px] text-paper-500">Fill in the terms above to preview what the validators will check.</p>;
  }
  const missing = terms.filter((t) => t.check === "missing").length;
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-ink-800 rounded-md border border-ink-700 bg-ink-950/40">
        {terms.map((t) => (
          <li key={t.id} className="flex items-start justify-between gap-4 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[12px] text-paper-500">{t.label}</p>
              <p className="mt-0.5 break-words text-[13px] text-paper-100">{t.value}</p>
              <p className="mt-1 break-all font-mono text-[10.5px] leading-snug text-paper-600">{t.contractLine}</p>
            </div>
            <div className="shrink-0 pt-0.5">
              <CheckMark check={t.check} />
            </div>
          </li>
        ))}
      </ul>
      {missing > 0 ? (
        <HelperText>
          {missing} term{missing === 1 ? " doesn't" : "s don't"} appear in your text. That's a quick
          local look for the number or date, not the real check — but a term the text never states
          will come back “could not determine” and block acceptance.
        </HelperText>
      ) : (
        <HelperText>
          Every value was found in your text. The validators still judge each one; this is only a
          pre-flight look.
        </HelperText>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The whole editor
// ---------------------------------------------------------------------------

export function DraftEditor({
  form,
  onChange,
  mode,
  selfAddress,
  lockType = false,
}: {
  form: DraftForm;
  onChange: (f: DraftForm) => void;
  mode: "propose" | "revise";
  selfAddress?: string | null;
  lockType?: boolean;
}) {
  const textLen = form.rawText.trim().length;
  const textOk = textLen >= MIN_TEXT_LEN && textLen <= MAX_TEXT_LEN;

  const fillFromTerms = () => {
    if (form.rawText.trim() && !window.confirm("Replace the current text with a starter drafted from your terms?")) return;
    onChange({ ...form, rawText: draftTextFromTerms(form, selfAddress) });
  };

  const changeType = (type: AgreementType) => {
    // Keep what the user typed for the shared fields; reset type-specific ones to a clean slate.
    const fresh = emptyDraft(type);
    onChange({ ...fresh, counterparty: form.counterparty, rawText: form.rawText });
  };

  const counterpartyBad = form.counterparty.trim() !== "" && !ADDRESS_RE.test(form.counterparty.trim());

  return (
    <div className="space-y-6">
      {mode === "propose" && (
        <Card className="space-y-4 p-6">
          <Label>Agreement type</Label>
          <TypeSelector value={form.type} onChange={changeType} />
        </Card>
      )}
      {mode === "revise" && lockType && (
        <p className="text-[12px] text-paper-500">
          The agreement type ({TYPE_META[form.type].label}) and counterparty are fixed once proposed. You can
          change the text and every structured term.
        </p>
      )}

      {mode === "propose" && (
        <Card className="space-y-2 p-6">
          <Label hint={TYPE_META[form.type].roleB}>Counterparty wallet</Label>
          <Input
            className="font-mono"
            placeholder="0x…"
            value={form.counterparty}
            onChange={(e) => onChange({ ...form, counterparty: e.target.value })}
          />
          {counterpartyBad ? (
            <HelperText tone="error">That doesn't look like a wallet address (0x + 40 hex characters).</HelperText>
          ) : (
            <HelperText>
              You are the {TYPE_META[form.type].roleA.toLowerCase()}. Only this address can accept the
              agreement.
            </HelperText>
          )}
        </Card>
      )}

      {form.type !== "GENERIC" && (
        <Card className="space-y-4 p-6">
          <div>
            <Label>Structured terms</Label>
            <p className="text-[13px] leading-relaxed text-paper-400">
              These exact numbers and dates are what the contract will act on. You type them; the
              model never derives them. It only judges whether your text supports each one.
            </p>
          </div>
          {form.type === "RENT" && <RentFields form={form} onChange={onChange} />}
          {form.type === "FREELANCE_MILESTONE" && <MilestoneFields form={form} onChange={onChange} />}
          {form.type === "NDA" && <NdaFields form={form} onChange={onChange} />}
        </Card>
      )}

      <Card className="space-y-3 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <Label hint={`${MIN_TEXT_LEN}–${MAX_TEXT_LEN} characters`}>Agreement text, in plain English</Label>
        </div>
        <Textarea
          rows={14}
          className="agreement-prose text-[14.5px] leading-relaxed"
          placeholder="Write the agreement the way you would explain it to the other person. State every amount and date you entered above."
          value={form.rawText}
          onChange={(e) => onChange({ ...form, rawText: e.target.value })}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className={`font-mono text-[12px] ${textOk || textLen === 0 ? "text-paper-500" : "text-seal-400"}`}>
            {textLen} / {MAX_TEXT_LEN}
          </span>
          <Button type="button" variant="secondary" onClick={fillFromTerms}>
            Draft text from my terms
          </Button>
        </div>
        {hasPlaceholders(form.rawText) && (
          <HelperText>
            Your text still has [bracketed placeholders]. Replace them with real details before you
            submit so the validators read the actual agreement.
          </HelperText>
        )}
        {form.type !== "GENERIC" && (
          <HelperText>
            The checker compares money as 1 unit = 10^18 wei, labelled “ETH” in its prompt (this app
            shows the same amount as {NATIVE_SYMBOL}). Write amounts as “1.5 ETH” or the exact wei
            figure. A price stated only in fiat can't be verified and will block acceptance.
          </HelperText>
        )}
      </Card>

      {form.type !== "GENERIC" && (
        <Card className="space-y-3 p-6">
          <Label>What the validators will check</Label>
          <TermPreview form={form} />
        </Card>
      )}
    </div>
  );
}
