import { Link } from "react-router-dom";
import { Briefcase, FileText, Home, Lock } from "lucide-react";
import type { ReactNode } from "react";
import type {
  AgreementData,
  AgreementStatus,
  AgreementType,
  ConsistencyVerdict,
  DisputeStatus,
  MilestoneStatus,
} from "../lib/types";
import {
  NATIVE_SYMBOL,
  bpsToPercent,
  daysToLabel,
  formatDate,
  formatIsoTimestamp,
  fromWei,
  fromWeiExact,
  ordinal,
  sameAddress,
  shortAddress,
  truncate,
} from "../lib/format";
import { TYPE_META, roleLabel } from "../lib/terms";
import type { ActionHint } from "../lib/terms";
import { AddressPill, InfoRow } from "./ui";

// ---------------------------------------------------------------------------
// Pills / badges
// ---------------------------------------------------------------------------

function Pill({ dot, text, children }: { dot: string; text: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[13px] font-medium ${text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {children}
    </span>
  );
}

const STATUS_STYLES: Record<AgreementStatus, { label: string; dot: string; text: string }> = {
  PROPOSED: { label: "Ready to accept", dot: "bg-sage-400", text: "text-sage-400" },
  NEEDS_REVIEW: { label: "Needs review", dot: "bg-gold-400", text: "text-gold-300" },
  FLAGGED_INCONSISTENT: { label: "Flagged inconsistent", dot: "bg-seal-400", text: "text-seal-400" },
  ACTIVE: { label: "Active", dot: "bg-quill-400", text: "text-quill-300" },
  COMPLETED: { label: "Completed", dot: "bg-sage-400", text: "text-sage-400" },
  BREACHED: { label: "Breached", dot: "bg-seal-400", text: "text-seal-400" },
  REJECTED: { label: "Rejected", dot: "bg-paper-500", text: "text-paper-400" },
};

export function StatusBadge({ status }: { status: AgreementStatus }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.REJECTED;
  return (
    <Pill dot={s.dot} text={s.text}>
      {s.label}
    </Pill>
  );
}

const VERDICT_STYLES: Record<string, { label: string; dot: string; text: string }> = {
  CONSISTENT: { label: "Consistent", dot: "bg-sage-400", text: "text-sage-400" },
  INCONSISTENT: { label: "Inconsistent", dot: "bg-seal-400", text: "text-seal-400" },
  COULD_NOT_DETERMINE: { label: "Could not determine", dot: "bg-gold-400", text: "text-gold-300" },
  "": { label: "Not checked yet", dot: "bg-paper-500", text: "text-paper-400" },
};

export function VerdictBadge({ verdict }: { verdict: ConsistencyVerdict }) {
  const s = VERDICT_STYLES[verdict] ?? VERDICT_STYLES[""];
  return (
    <Pill dot={s.dot} text={s.text}>
      {s.label}
    </Pill>
  );
}

const MILESTONE_STYLES: Record<MilestoneStatus, { label: string; dot: string; text: string }> = {
  PENDING: { label: "Pending", dot: "bg-paper-500", text: "text-paper-400" },
  SUBMITTED: { label: "Submitted", dot: "bg-quill-400", text: "text-quill-300" },
  APPROVED: { label: "Paid", dot: "bg-sage-400", text: "text-sage-400" },
  DISPUTED: { label: "Disputed — funds locked", dot: "bg-gold-400", text: "text-gold-300" },
  REFUNDED: { label: "Refunded", dot: "bg-paper-400", text: "text-paper-200" },
};

export function MilestoneStatusBadge({ status }: { status: MilestoneStatus }) {
  const s = MILESTONE_STYLES[status] ?? MILESTONE_STYLES.PENDING;
  return (
    <Pill dot={s.dot} text={s.text}>
      {s.label}
    </Pill>
  );
}

const DISPUTE_STYLES: Record<DisputeStatus, { label: string; dot: string; text: string }> = {
  NONE: { label: "No dispute", dot: "bg-paper-500", text: "text-paper-400" },
  OPEN: { label: "Open — inconclusive so far", dot: "bg-gold-400", text: "text-gold-300" },
  BREACH_CONFIRMED: { label: "Breach confirmed", dot: "bg-seal-400", text: "text-seal-400" },
  DISMISSED: { label: "Dismissed", dot: "bg-sage-400", text: "text-sage-400" },
};

export function DisputeBadge({ status }: { status: DisputeStatus }) {
  const s = DISPUTE_STYLES[status] ?? DISPUTE_STYLES.NONE;
  return (
    <Pill dot={s.dot} text={s.text}>
      {s.label}
    </Pill>
  );
}

const TYPE_ICONS: Record<AgreementType, typeof Home> = {
  RENT: Home,
  FREELANCE_MILESTONE: Briefcase,
  NDA: Lock,
  GENERIC: FileText,
};

export function TypeIcon({ type, className = "h-4 w-4" }: { type: AgreementType; className?: string }) {
  const Icon = TYPE_ICONS[type] ?? FileText;
  return <Icon className={className} strokeWidth={1.6} />;
}

export function TypeTag({ type }: { type: AgreementType }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-600 bg-ink-950/50 px-2.5 py-1 text-[12px] text-paper-200">
      <TypeIcon type={type} className="h-3.5 w-3.5 text-quill-300" />
      {TYPE_META[type]?.label ?? type}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Parties
// ---------------------------------------------------------------------------

export function PartyLine({
  type,
  side,
  address,
  me,
}: {
  type: AgreementType;
  side: "a" | "b";
  address: string;
  me?: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12px] text-paper-500">{roleLabel(type, side)}</span>
      <AddressPill address={address} you={sameAddress(address, me)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Key figure for list cards
// ---------------------------------------------------------------------------

export function keyFigure(a: AgreementData): string {
  switch (a.agreement_type) {
    case "RENT":
      return `${fromWei(a.monthly_rent_wei)} ${NATIVE_SYMBOL} / month · due on the ${ordinal(a.due_day_of_month)}`;
    case "FREELANCE_MILESTONE":
      return `${a.milestone_count} milestone${a.milestone_count === 1 ? "" : "s"}${
        a.escrow_funded ? ` · ${fromWei(a.escrow_balance)} ${NATIVE_SYMBOL} in escrow` : " · escrow not funded"
      }`;
    case "NDA":
      return `Confidential for ${daysToLabel(a.confidentiality_duration_days)}`;
    default:
      return "No on-chain money terms";
  }
}

// ---------------------------------------------------------------------------
// List card
// ---------------------------------------------------------------------------

export function AgreementCard({
  agreement: a,
  me,
  hint,
}: {
  agreement: AgreementData;
  me?: string | null;
  hint?: ActionHint | null;
}) {
  const myRole = sameAddress(a.party_a, me)
    ? roleLabel(a.agreement_type, "a")
    : sameAddress(a.party_b, me)
      ? roleLabel(a.agreement_type, "b")
      : null;

  const hintTone =
    hint?.tone === "action"
      ? "border-quill-400/40 bg-quill-400/10 text-quill-200"
      : hint?.tone === "wait"
        ? "border-ink-600 bg-ink-950/40 text-paper-400"
        : "border-gold-500/30 bg-gold-500/10 text-gold-300";

  return (
    <Link
      to={`/agreement/${a.agreement_id}`}
      className="flex h-full flex-col rounded-lg border border-ink-700 bg-ink-900/70 p-4 transition-colors hover:border-quill-400"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TypeTag type={a.agreement_type} />
          <span className="font-mono text-[12px] text-paper-500">#{a.agreement_id}</span>
        </div>
        <StatusBadge status={a.status} />
      </div>

      <p className="mt-3 line-clamp-3 flex-1 font-display text-[14px] leading-relaxed text-paper-200">
        {truncate(a.raw_text, 170)}
      </p>

      <div className="mt-4 space-y-2 border-t border-ink-800 pt-3 text-[12px] text-paper-500">
        <p className="text-paper-400">{keyFigure(a)}</p>
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono">
            {shortAddress(a.party_a)} → {shortAddress(a.party_b)}
          </span>
          {myRole && (
            <span className="rounded-full bg-quill-400/15 px-2 py-0.5 text-[11px] text-quill-200">You: {myRole}</span>
          )}
        </div>
        {hint && (
          <p className={`rounded-md border px-2.5 py-1.5 text-[12px] ${hintTone}`}>{hint.label}</p>
        )}
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Lifecycle stepper — the one deliberate visual moment on the detail page: an agreement's whole
// life at a glance, with the consistency check shown as its own gate.
// ---------------------------------------------------------------------------

type StepState = "done" | "current" | "todo" | "warn" | "bad" | "muted";

interface Step {
  title: string;
  sub: string;
  state: StepState;
}

function buildSteps(a: AgreementData): Step[] {
  const checkState: StepState =
    a.consistency_verdict === "CONSISTENT"
      ? "done"
      : a.consistency_verdict === "INCONSISTENT"
        ? "bad"
        : a.consistency_verdict === "COULD_NOT_DETERMINE"
          ? "warn"
          : "todo";
  const checkSub =
    a.consistency_verdict === "CONSISTENT"
      ? a.agreement_type === "GENERIC"
        ? "No structured terms"
        : "Every term supported"
      : a.consistency_verdict === "INCONSISTENT"
        ? "A term clashes with the text"
        : a.consistency_verdict === "COULD_NOT_DETERMINE"
          ? "A term isn't backed by the text"
          : "Pending";

  const accepted = a.accepted_at !== "";
  const activeState: StepState = accepted ? "done" : a.status === "REJECTED" ? "muted" : a.status === "PROPOSED" ? "current" : "todo";

  const closedState: StepState =
    a.status === "COMPLETED" ? "done" : a.status === "BREACHED" ? "bad" : a.status === "REJECTED" ? "muted" : "todo";
  const closedTitle = a.status === "BREACHED" ? "Breached" : a.status === "REJECTED" ? "Rejected" : "Completed";
  const closedSub =
    a.status === "COMPLETED"
      ? "Ran to its end"
      : a.status === "BREACHED"
        ? "Breach confirmed by evidence"
        : a.status === "REJECTED"
          ? "Withdrawn before activation"
          : a.status === "ACTIVE"
            ? "In progress"
            : "—";

  return [
    { title: "Proposed", sub: formatIsoTimestamp(a.proposed_at), state: "done" },
    { title: "Term check", sub: checkSub, state: checkState },
    { title: "Accepted", sub: accepted ? formatIsoTimestamp(a.accepted_at) : "Awaiting counterparty", state: activeState },
    { title: closedTitle, sub: closedSub, state: closedState },
  ];
}

const DOT: Record<StepState, string> = {
  done: "border-sage-400 bg-sage-400 text-ink-950",
  current: "border-quill-400 bg-quill-400/20 text-quill-200",
  todo: "border-ink-600 bg-ink-900 text-paper-500",
  warn: "border-gold-400 bg-gold-400/20 text-gold-300",
  bad: "border-seal-400 bg-seal-400/20 text-seal-400",
  muted: "border-paper-600 bg-ink-900 text-paper-500",
};

const GLYPH: Record<StepState, string> = {
  done: "✓",
  current: "•",
  todo: "",
  warn: "?",
  bad: "!",
  muted: "–",
};

export function LifecycleStepper({ agreement }: { agreement: AgreementData }) {
  const steps = buildSteps(agreement);
  return (
    <ol className="grid gap-4 sm:grid-cols-4">
      {steps.map((step, i) => (
        <li key={step.title} className="relative flex items-start gap-3 sm:block">
          {i < steps.length - 1 && (
            <span className="absolute left-[15px] top-8 h-[calc(100%-8px)] w-px bg-ink-700 sm:left-9 sm:top-[15px] sm:h-px sm:w-[calc(100%-28px)]" />
          )}
          <span
            className={`relative z-10 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border text-[13px] font-semibold ${DOT[step.state]}`}
          >
            {GLYPH[step.state]}
          </span>
          <div className="sm:mt-3">
            <p className="text-[13px] font-medium text-paper-100">{step.title}</p>
            <p className="mt-0.5 text-[12px] text-paper-500">{step.sub}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Structured terms (read-only view of what governs money movement)
// ---------------------------------------------------------------------------

export function TermsList({ agreement: a }: { agreement: AgreementData }) {
  if (a.agreement_type === "RENT") {
    return (
      <dl>
        <InfoRow label="Monthly rent">
          <span className="font-mono">
            {fromWeiExact(a.monthly_rent_wei)} {NATIVE_SYMBOL}
          </span>
          <span className="block font-mono text-[11px] text-paper-500">{a.monthly_rent_wei} wei</span>
        </InfoRow>
        <InfoRow label="Due day of month">{ordinal(a.due_day_of_month)}</InfoRow>
        <InfoRow label="Lease term">
          {formatDate(a.lease_start_date)} → {formatDate(a.lease_end_date)}
        </InfoRow>
        <InfoRow label="Late fee">{bpsToPercent(a.late_fee_bps)} of one month's rent</InfoRow>
        <InfoRow label="Payments recorded">{a.rent_payments_made}</InfoRow>
      </dl>
    );
  }
  if (a.agreement_type === "FREELANCE_MILESTONE") {
    return (
      <dl>
        <InfoRow label="Milestones">{a.milestone_count}</InfoRow>
        <InfoRow label="Escrow">
          {a.escrow_funded ? (
            <span className="text-sage-400">Funded</span>
          ) : (
            <span className="text-gold-300">Not funded yet</span>
          )}
        </InfoRow>
        <InfoRow label="Escrow remaining">
          {fromWei(a.escrow_balance, 6)} {NATIVE_SYMBOL}
        </InfoRow>
      </dl>
    );
  }
  if (a.agreement_type === "NDA") {
    return (
      <dl>
        <InfoRow label="Confidentiality duration">{daysToLabel(a.confidentiality_duration_days)}</InfoRow>
        <InfoRow label="Breaches confirmed">{a.breach_count}</InfoRow>
      </dl>
    );
  }
  return (
    <p className="text-[13px] leading-relaxed text-paper-400">
      A generic agreement has no structured money or date terms. The text above is the agreement, and
      any dispute is judged against it from evidence.
    </p>
  );
}

// ---------------------------------------------------------------------------
// Consensus-in-progress notice
// ---------------------------------------------------------------------------

export function ConsensusNotice({ kind }: { kind: "consistency" | "evidence" }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-quill-400/30 bg-quill-400/10 p-3.5">
      <span className="relative mt-1 flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-quill-400 opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-quill-400" />
      </span>
      <div className="text-[13px] leading-relaxed">
        <p className="font-medium text-paper-100">
          {kind === "consistency" ? "Validators are checking every term…" : "Validators are fetching the evidence…"}
        </p>
        <p className="mt-1 text-paper-400">
          {kind === "consistency"
            ? "Each validator independently reads your text and judges every structured term against it. This usually takes a minute or two — keep this tab open."
            : "Each validator independently fetches the evidence pages and judges them against the agreed terms. This can take a few minutes — keep this tab open."}
        </p>
      </div>
    </div>
  );
}
