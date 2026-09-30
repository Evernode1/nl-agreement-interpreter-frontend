import type { AgreementData, AgreementStatus, AgreementType, MilestoneData } from "./types";
import { NATIVE_SYMBOL, formatDate, fromWei, isValidAmount, ordinal, sameAddress, toWei } from "./format";

// ---------------------------------------------------------------------------
// Protocol constants — copied from AgreementInterpreter.py so the UI can reject bad input before
// spending a consensus round on it. The contract remains the source of truth.
// ---------------------------------------------------------------------------

export const MIN_TEXT_LEN = 40;
export const MAX_TEXT_LEN = 6000;
export const MAX_ACTION_TEXT_LEN = 2000;
export const MAX_MILESTONES = 5;
export const MAX_DUE_DAY_OF_MONTH = 28;
export const MAX_LATE_FEE_BPS = 5000;
export const MAX_CONFIDENTIALITY_DAYS = 3650;
export const MAX_EVIDENCE_URLS = 3;
export const MAX_URL_LEN = 500;
export const MAX_DISPUTE_ATTEMPTS = 5;
export const REVISION_COOLDOWN_MINUTES = 5;
export const DISPUTE_COOLDOWN_MINUTES = 10;

export const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------------------
// Agreement types
// ---------------------------------------------------------------------------

export interface TypeMeta {
  type: AgreementType;
  label: string;
  blurb: string;
  roleA: string;
  roleB: string;
  /** What actually moves money / gets checked for this type. */
  checks: string;
}

export const TYPE_META: Record<AgreementType, TypeMeta> = {
  RENT: {
    type: "RENT",
    label: "Rent lease",
    blurb: "Monthly rent with a due day and a late fee, paid straight through to the landlord.",
    roleA: "Landlord",
    roleB: "Tenant",
    checks: "Rent, due day, lease dates, late fee",
  },
  FREELANCE_MILESTONE: {
    type: "FREELANCE_MILESTONE",
    label: "Freelance milestones",
    blurb: "Client funds escrow up front; each milestone pays out on approval or an evidence-backed ruling.",
    roleA: "Client",
    roleB: "Contractor",
    checks: "Escrow total, milestone count, and each milestone's scope, amount and deadline",
  },
  NDA: {
    type: "NDA",
    label: "Non-disclosure (NDA)",
    blurb: "A confidentiality duration on-chain. A confirmed breach is recorded as a fact, not a payout.",
    roleA: "Disclosing party",
    roleB: "Receiving party",
    checks: "Confidentiality duration",
  },
  GENERIC: {
    type: "GENERIC",
    label: "Generic agreement",
    blurb: "Any plain-English agreement with no on-chain money terms. Disputes are still evidence-backed.",
    roleA: "Party A",
    roleB: "Party B",
    checks: "Nothing structured — the text is the agreement",
  },
};

export const TYPE_ORDER: AgreementType[] = ["RENT", "FREELANCE_MILESTONE", "NDA", "GENERIC"];

export function roleLabel(type: AgreementType, side: "a" | "b"): string {
  return side === "a" ? TYPE_META[type].roleA : TYPE_META[type].roleB;
}

export const PRE_ACTIVE: AgreementStatus[] = ["PROPOSED", "NEEDS_REVIEW", "FLAGGED_INCONSISTENT"];

export function isPreActive(status: AgreementStatus): boolean {
  return PRE_ACTIVE.includes(status);
}

// ---------------------------------------------------------------------------
// Draft form
// ---------------------------------------------------------------------------

export interface MilestoneDraft {
  description: string;
  amount: string; // in native units, e.g. "1.5"
  deadline: string; // YYYY-MM-DD
}

export interface DraftForm {
  type: AgreementType;
  counterparty: string;
  rawText: string;
  // RENT
  rentAmount: string;
  dueDay: string;
  leaseStart: string;
  leaseEnd: string;
  lateFeePercent: string;
  // FREELANCE_MILESTONE
  milestones: MilestoneDraft[];
  // NDA
  ndaDays: string;
}

export const emptyMilestone = (): MilestoneDraft => ({ description: "", amount: "", deadline: "" });

export function emptyDraft(type: AgreementType = "RENT"): DraftForm {
  return {
    type,
    counterparty: "",
    rawText: "",
    rentAmount: "",
    dueDay: "1",
    leaseStart: "",
    leaseEnd: "",
    lateFeePercent: "5",
    milestones: [emptyMilestone()],
    ndaDays: "365",
  };
}

/** Rebuilds an editable form from an on-chain agreement (used by "revise"). */
export function draftFromAgreement(a: AgreementData, milestones: MilestoneData[]): DraftForm {
  return {
    type: a.agreement_type,
    counterparty: a.party_b,
    rawText: a.raw_text,
    rentAmount: a.agreement_type === "RENT" ? fromWei(a.monthly_rent_wei, 18) : "",
    dueDay: a.due_day_of_month ? String(a.due_day_of_month) : "1",
    leaseStart: a.lease_start_date.slice(0, 10),
    leaseEnd: a.lease_end_date.slice(0, 10),
    lateFeePercent: String(a.late_fee_bps / 100),
    milestones:
      a.agreement_type === "FREELANCE_MILESTONE" && milestones.length > 0
        ? milestones.map((m) => ({
            description: m.description,
            amount: fromWei(m.amount_wei, 18),
            deadline: m.deadline.slice(0, 10),
          }))
        : [emptyMilestone()],
    ndaDays: a.confidentiality_duration_days ? String(a.confidentiality_duration_days) : "365",
  };
}

const isPositiveInt = (s: string) => /^\d+$/.test(s.trim());

export function lateFeeBps(form: DraftForm): number {
  const n = Number(form.lateFeePercent);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

/**
 * Mirrors `_require_text_bounds` / `_require_type_fields` in the contract. Returns the first
 * problem in plain language, or null when the draft is ready to submit.
 */
export function validateDraft(
  form: DraftForm,
  opts: { mode: "propose" | "revise"; selfAddress?: string | null },
): string | null {
  if (opts.mode === "propose") {
    const cp = form.counterparty.trim();
    if (!ADDRESS_RE.test(cp)) {
      return "The counterparty needs a valid wallet address (0x… with 40 hex characters).";
    }
    if (sameAddress(cp, opts.selfAddress)) return "The counterparty can't be your own address.";
  }

  const textLen = form.rawText.trim().length;
  if (textLen < MIN_TEXT_LEN || textLen > MAX_TEXT_LEN) {
    return `The agreement text must be ${MIN_TEXT_LEN}–${MAX_TEXT_LEN} characters (currently ${textLen}).`;
  }

  if (form.type === "RENT") {
    if (!isValidAmount(form.rentAmount)) return "Monthly rent must be an amount greater than zero.";
    const due = Number(form.dueDay);
    if (!isPositiveInt(form.dueDay) || due < 1 || due > MAX_DUE_DAY_OF_MONTH) {
      return `The rent due day must be a whole number from 1 to ${MAX_DUE_DAY_OF_MONTH}.`;
    }
    if (!DATE_RE.test(form.leaseStart) || !DATE_RE.test(form.leaseEnd)) {
      return "Pick both a lease start date and a lease end date.";
    }
    if (form.leaseEnd <= form.leaseStart) return "The lease must end after it starts.";
    const bps = lateFeeBps(form);
    if (!Number.isFinite(bps) || bps < 0 || bps > MAX_LATE_FEE_BPS) {
      return `The late fee must be between 0% and ${MAX_LATE_FEE_BPS / 100}% of one month's rent.`;
    }
  }

  if (form.type === "FREELANCE_MILESTONE") {
    const count = form.milestones.length;
    if (count < 1 || count > MAX_MILESTONES) return `Use between 1 and ${MAX_MILESTONES} milestones.`;
    let previous = "";
    for (let i = 0; i < count; i++) {
      const m = form.milestones[i];
      const n = i + 1;
      const d = m.description.trim();
      if (d.length < 1 || d.length > MAX_ACTION_TEXT_LEN) {
        return `Milestone ${n} needs a description (up to ${MAX_ACTION_TEXT_LEN} characters).`;
      }
      if (!isValidAmount(m.amount)) return `Milestone ${n} needs a payment amount greater than zero.`;
      if (!DATE_RE.test(m.deadline)) return `Milestone ${n} needs a deadline date.`;
      if (previous && m.deadline < previous) {
        return "Milestone deadlines must be in non-decreasing order.";
      }
      previous = m.deadline;
    }
  }

  if (form.type === "NDA") {
    const days = Number(form.ndaDays);
    if (!isPositiveInt(form.ndaDays) || days < 1 || days > MAX_CONFIDENTIALITY_DAYS) {
      return `The confidentiality duration must be 1–${MAX_CONFIDENTIALITY_DAYS} days.`;
    }
  }

  return null;
}

/** Contract-shaped arguments. Fields that don't apply to a type MUST be zero/empty or the
 *  contract rejects the call, so they're blanked here based on the selected type. */
export function toTermArgs(form: DraftForm) {
  const rent = form.type === "RENT";
  const freelance = form.type === "FREELANCE_MILESTONE";
  const nda = form.type === "NDA";
  return {
    monthlyRentWei: rent ? toWei(form.rentAmount) : 0n,
    dueDayOfMonth: rent ? Number(form.dueDay) : 0,
    leaseStartDate: rent ? form.leaseStart : "",
    leaseEndDate: rent ? form.leaseEnd : "",
    lateFeeBps: rent ? lateFeeBps(form) : 0,
    milestoneDescriptions: freelance ? form.milestones.map((m) => m.description.trim()) : [],
    milestoneAmountsWei: freelance ? form.milestones.map((m) => toWei(m.amount)) : [],
    milestoneDeadlines: freelance ? form.milestones.map((m) => m.deadline) : [],
    confidentialityDurationDays: nda ? Number(form.ndaDays) : 0,
  };
}

// ---------------------------------------------------------------------------
// "What the checker will see" — one line per consequential term, exactly as the contract builds
// them in `_consequential_terms`, plus a cheap client-side look for each value in the text.
// ---------------------------------------------------------------------------

/** Same rendering as the contract's `_format_amount`: wei plus a code-computed ETH equivalent. */
export function contractAmount(wei: bigint): string {
  const whole = wei / 10n ** 18n;
  const frac = (wei % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
  return `${wei.toString()} wei (${whole.toString()}.${frac === "" ? "0" : frac} ETH)`;
}

export type TextCheck = "found" | "missing" | "n/a";

export interface PreviewTerm {
  id: string;
  label: string;
  value: string;
  /** The exact line the consensus model is shown for this term. */
  contractLine: string;
  check: TextCheck;
}

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const NUMBER_WORDS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function mentionsAmount(text: string, wei: bigint): boolean {
  if (wei <= 0n) return false;
  const exact = wei.toString();
  const dec = fromWei(wei, 18);
  const group = (n: string) => n.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (text.includes(exact) || text.includes(group(exact))) return true;
  const re = new RegExp(`(^|[^\\d.,])${escapeRe(dec)}(?!\\d|\\.\\d)`);
  return re.test(text);
}

function mentionsDate(text: string, iso: string): boolean {
  if (!DATE_RE.test(iso)) return false;
  if (text.includes(iso)) return true;
  const [y, m, d] = iso.split("-").map(Number);
  const month = MONTHS[m - 1];
  if (!month) return false;
  const monthAlt = `(?:${month}|${month.slice(0, 3)}\\.?)`;
  const dayAlt = `0?${d}(?:st|nd|rd|th)?`;
  const patterns = [
    new RegExp(`\\b${monthAlt}\\s+${dayAlt}\\s*,?\\s*${y}\\b`, "i"),
    new RegExp(`\\b${dayAlt}\\s+(?:of\\s+)?${monthAlt}\\s*,?\\s*${y}\\b`, "i"),
  ];
  return patterns.some((p) => p.test(text));
}

function mentionsDueDay(text: string, day: number): boolean {
  const re = new RegExp(
    `\\b${day}(?:st|nd|rd|th)\\b|\\bday\\s+(?:of\\s+the\\s+month\\s+)?${day}\\b|\\bdue\\s+(?:on\\s+)?(?:the\\s+)?${day}\\b`,
    "i",
  );
  return re.test(text);
}

function mentionsLateFee(text: string, bps: number): boolean {
  if (bps === 0) return /no late fee|without (?:a )?late fee|late fees? (?:is|are) (?:waived|zero)|\b0\s*%|\bzero\b/i.test(text);
  const pct = bps / 100;
  const pctStr = escapeRe(String(pct));
  return new RegExp(`(^|[^\\d.])${pctStr}\\s*(?:%|percent)`, "i").test(text) || new RegExp(`\\b${bps}\\s*(?:bps|basis points)`, "i").test(text);
}

function mentionsDuration(text: string, days: number): boolean {
  if (new RegExp(`(^|[^\\d.,])${days}(?!\\d)`).test(text)) return true;
  const alts: string[] = [];
  if (days % 365 === 0) {
    const y = days / 365;
    alts.push(`${y}[\\s-]*years?`);
    if (NUMBER_WORDS[y]) alts.push(`${NUMBER_WORDS[y]}[\\s-]*years?`);
  }
  if (days % 30 === 0) {
    const mo = days / 30;
    alts.push(`${mo}[\\s-]*months?`);
    if (NUMBER_WORDS[mo]) alts.push(`${NUMBER_WORDS[mo]}[\\s-]*months?`);
  }
  return alts.length > 0 && new RegExp(`\\b(?:${alts.join("|")})\\b`, "i").test(text);
}

function mentionsCount(text: string, n: number): boolean {
  const word = NUMBER_WORDS[n];
  const alt = word ? `(?:${n}|${word})` : String(n);
  return new RegExp(`\\b${alt}\\s+(?:\\w+\\s+)?milestones?\\b`, "i").test(text);
}

const checked = (ok: boolean): TextCheck => (ok ? "found" : "missing");

/** Terms that are complete enough to preview. Incomplete fields are skipped rather than guessed. */
export function previewTerms(form: DraftForm): PreviewTerm[] {
  const text = form.rawText;
  const out: PreviewTerm[] = [];

  if (form.type === "RENT") {
    if (isValidAmount(form.rentAmount)) {
      const wei = toWei(form.rentAmount);
      out.push({
        id: "monthly_rent",
        label: "Monthly rent",
        value: `${form.rentAmount.trim()} ${NATIVE_SYMBOL}`,
        contractLine: `Monthly rent: ${contractAmount(wei)}`,
        check: checked(mentionsAmount(text, wei)),
      });
    }
    const due = Number(form.dueDay);
    if (isPositiveInt(form.dueDay) && due >= 1 && due <= MAX_DUE_DAY_OF_MONTH) {
      out.push({
        id: "due_day",
        label: "Due day of month",
        value: `${ordinal(due)} of the month`,
        contractLine: `Rent due day of month: ${due}`,
        check: checked(mentionsDueDay(text, due)),
      });
    }
    if (DATE_RE.test(form.leaseStart)) {
      out.push({
        id: "lease_start",
        label: "Lease start",
        value: formatDate(form.leaseStart),
        contractLine: `Lease start date: ${form.leaseStart}`,
        check: checked(mentionsDate(text, form.leaseStart)),
      });
    }
    if (DATE_RE.test(form.leaseEnd)) {
      out.push({
        id: "lease_end",
        label: "Lease end",
        value: formatDate(form.leaseEnd),
        contractLine: `Lease end date: ${form.leaseEnd}`,
        check: checked(mentionsDate(text, form.leaseEnd)),
      });
    }
    const bps = lateFeeBps(form);
    if (Number.isFinite(bps) && bps >= 0 && bps <= MAX_LATE_FEE_BPS) {
      out.push({
        id: "late_fee",
        label: "Late fee",
        value: `${bps / 100}% of one month's rent`,
        contractLine: `Late fee: ${bps} bps (${bps / 100}%) of one month's rent`,
        check: checked(mentionsLateFee(text, bps)),
      });
    }
  }

  if (form.type === "NDA") {
    const days = Number(form.ndaDays);
    if (isPositiveInt(form.ndaDays) && days >= 1 && days <= MAX_CONFIDENTIALITY_DAYS) {
      out.push({
        id: "confidentiality_duration",
        label: "Confidentiality duration",
        value: `${days} days`,
        contractLine: `Confidentiality duration: ${days} days`,
        check: checked(mentionsDuration(text, days)),
      });
    }
  }

  if (form.type === "FREELANCE_MILESTONE") {
    const usable = form.milestones.filter((m) => isValidAmount(m.amount));
    if (usable.length > 0 && usable.length === form.milestones.length) {
      const total = form.milestones.reduce((sum, m) => sum + toWei(m.amount), 0n);
      out.push({
        id: "escrow_total",
        label: "Total escrow",
        value: `${fromWei(total, 18)} ${NATIVE_SYMBOL}`,
        contractLine: `Total escrow (sum of all milestone amounts): ${contractAmount(total)}`,
        check: checked(mentionsAmount(text, total)),
      });
    }
    const n = form.milestones.length;
    out.push({
      id: "milestone_count",
      label: "Number of milestones",
      value: String(n),
      contractLine: `Number of milestones: ${n}`,
      check: checked(mentionsCount(text, n)),
    });
    form.milestones.forEach((m, i) => {
      const k = i + 1;
      if (m.description.trim()) {
        out.push({
          id: `milestone_${i}_description`,
          label: `Milestone ${k} scope`,
          value: m.description.trim(),
          contractLine: `Milestone ${k} description: ${m.description.trim()}`,
          check: "n/a",
        });
      }
      if (isValidAmount(m.amount)) {
        const wei = toWei(m.amount);
        out.push({
          id: `milestone_${i}_amount`,
          label: `Milestone ${k} payment`,
          value: `${m.amount.trim()} ${NATIVE_SYMBOL}`,
          contractLine: `Milestone ${k} payment amount: ${contractAmount(wei)}`,
          check: checked(mentionsAmount(text, wei)),
        });
      }
      if (DATE_RE.test(m.deadline)) {
        out.push({
          id: `milestone_${i}_deadline`,
          label: `Milestone ${k} deadline`,
          value: formatDate(m.deadline),
          contractLine: `Milestone ${k} deadline: ${m.deadline}`,
          check: checked(mentionsDate(text, m.deadline)),
        });
      }
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Starter text, generated deterministically from the structured terms so the two agree.
// ---------------------------------------------------------------------------

const walletOrBlank = (addr: string | null | undefined, blank: string) =>
  addr && ADDRESS_RE.test(addr.trim()) ? addr.trim() : blank;

export function draftTextFromTerms(form: DraftForm, selfAddress?: string | null): string {
  const roles = TYPE_META[form.type];
  const a = walletOrBlank(selfAddress, `[${roles.roleA.toLowerCase()} wallet]`);
  const b = walletOrBlank(form.counterparty, `[${roles.roleB.toLowerCase()} wallet]`);

  if (form.type === "RENT") {
    const wei = isValidAmount(form.rentAmount) ? toWei(form.rentAmount) : 0n;
    const amount = wei > 0n ? `${fromWei(wei, 18)} ETH (${wei.toString()} wei)` : "[monthly rent] ETH";
    const due = Number(form.dueDay) >= 1 ? ordinal(Number(form.dueDay)) : "[due]";
    const bps = lateFeeBps(form);
    const lateClause =
      Number.isFinite(bps) && bps > 0
        ? `Rent paid after the ${due} day of the month carries a late fee of ${bps / 100}% of one month's rent, added to that month's payment.`
        : "No late fee applies.";
    return [
      "RESIDENTIAL LEASE AGREEMENT",
      "",
      `This lease is between the Landlord (wallet ${a}) and the Tenant (wallet ${b}) for the property at [describe the property].`,
      "",
      `1. Term. The lease begins on ${form.leaseStart || "[start date]"} and ends on ${form.leaseEnd || "[end date]"}.`,
      `2. Rent. The Tenant pays monthly rent of ${amount}. Rent is due on or before the ${due} day of each month and is paid directly to the Landlord.`,
      `3. Late fee. ${lateClause}`,
      "4. Conduct. The Tenant keeps the property in good condition, uses it only as a residence, and does not sublet it without the Landlord's written consent. The Landlord keeps the property habitable and gives reasonable notice before entering.",
    ].join("\n");
  }

  if (form.type === "FREELANCE_MILESTONE") {
    const amounts = form.milestones.map((m) => (isValidAmount(m.amount) ? toWei(m.amount) : 0n));
    const total = amounts.reduce((s, x) => s + x, 0n);
    const n = form.milestones.length;
    const lines = form.milestones.map((m, i) => {
      const amt = amounts[i] > 0n ? `${fromWei(amounts[i], 18)} ETH (${amounts[i].toString()} wei)` : "[amount] ETH";
      return `Milestone ${i + 1}: ${m.description.trim() || "[describe the deliverable]"}. Payment: ${amt}. Deadline: ${m.deadline || "[deadline]"}.`;
    });
    return [
      "FREELANCE SERVICES AGREEMENT WITH MILESTONE PAYMENTS",
      "",
      `This agreement is between the Client (wallet ${a}) and the Contractor (wallet ${b}).`,
      "",
      `The Client places the full contract price of ${total > 0n ? `${fromWei(total, 18)} ETH (${total.toString()} wei)` : "[total] ETH"} in escrow before the Contractor accepts. The work is split into ${n} milestone${n === 1 ? "" : "s"}, each paid from escrow when the Client approves it, or when the submitted deliverable is judged to satisfy the milestone as described.`,
      "",
      ...lines,
      "",
      "The Contractor submits each milestone with an https link to the deliverable, and that link is the evidence used if the Client disputes the milestone.",
    ].join("\n");
  }

  if (form.type === "NDA") {
    const days = Number(form.ndaDays);
    return [
      "NON-DISCLOSURE AGREEMENT",
      "",
      `This agreement is between the Disclosing Party (wallet ${a}) and the Receiving Party (wallet ${b}).`,
      "",
      "1. Confidential information. Anything the Disclosing Party shares that is marked, or would reasonably be understood, to be confidential, including [describe the information].",
      "2. Obligations. The Receiving Party uses it only for [permitted purpose], does not disclose it to anyone else, and protects it with reasonable care.",
      `3. Duration. These obligations last for ${Number.isFinite(days) && days > 0 ? days : "[number of]"} days from the date this agreement becomes active.`,
      "4. Exceptions. Information that is already public through no fault of the Receiving Party, or that the Receiving Party developed independently, is not confidential.",
    ].join("\n");
  }

  return [
    "GENERAL AGREEMENT",
    "",
    `This agreement is between Party A (wallet ${a}) and Party B (wallet ${b}).`,
    "",
    "1. Purpose. [Describe what the parties are agreeing to.]",
    "2. Party A will [describe Party A's obligations].",
    "3. Party B will [describe Party B's obligations].",
    "4. Evidence. If either party alleges the other has not followed this agreement, the allegation is judged from public evidence at https links the alleging party provides.",
  ].join("\n");
}

/** True while the text still contains `[bracketed placeholders]` from the starter template. */
export function hasPlaceholders(text: string): boolean {
  return /\[[^\]\n]{2,}\]/.test(text);
}

// ---------------------------------------------------------------------------
// Dashboard hints
// ---------------------------------------------------------------------------

export interface ActionHint {
  label: string;
  tone: "action" | "wait" | "info";
}

/** One-line "what can I do here?" for a given viewer, derived from agreement-level data only. */
export function actionHint(a: AgreementData, me: string | null | undefined): ActionHint | null {
  const isA = sameAddress(a.party_a, me);
  const isB = sameAddress(a.party_b, me);
  if (!isA && !isB) return null;
  const freelance = a.agreement_type === "FREELANCE_MILESTONE";

  if (a.status === "PROPOSED") {
    if (isB) {
      return freelance && !a.escrow_funded
        ? { label: "Waiting for the client to fund escrow", tone: "wait" }
        : { label: "Ready for you to accept or reject", tone: "action" };
    }
    return freelance && !a.escrow_funded
      ? { label: "Fund escrow so it can be accepted", tone: "action" }
      : { label: "Waiting for the counterparty to accept", tone: "wait" };
  }
  if (a.status === "NEEDS_REVIEW" || a.status === "FLAGGED_INCONSISTENT") {
    return isA
      ? { label: "Revise the text or terms", tone: "action" }
      : { label: "Proposer is revising this draft", tone: "wait" };
  }
  if (a.status === "ACTIVE") {
    if (a.dispute_status === "OPEN") return { label: "A dispute round is open", tone: "info" };
    if (a.agreement_type === "RENT" && isB) return { label: "Pay rent / view lease", tone: "action" };
    if (freelance) return { label: "Manage milestones", tone: "info" };
  }
  return null;
}

/** Sum of milestone amounts in wei (what `fund_milestone_escrow` expects to receive exactly). */
export function escrowTotalWei(milestones: MilestoneData[]): bigint {
  return milestones.reduce((sum, m) => sum + BigInt(m.amount_wei), 0n);
}

// ---------------------------------------------------------------------------
// Evidence URLs — mirrors `_require_evidence_url` (https only, public host, no whitespace).
// ---------------------------------------------------------------------------

export function validateEvidenceUrl(url: string, label = "Evidence URL"): string | null {
  const u = url.trim();
  if (u.length < 12 || u.length > MAX_URL_LEN) {
    return `${label} must be an https:// link of at most ${MAX_URL_LEN} characters.`;
  }
  if (!u.startsWith("https://") || /\s/.test(u)) {
    return `${label} must be a single https:// link with no spaces.`;
  }
  const host = u
    .slice("https://".length)
    .split("/")[0]
    .split("?")[0]
    .split("#")[0]
    .split("@")
    .pop()!
    .split(":")[0]
    .toLowerCase();
  if (
    host === "" ||
    !host.includes(".") ||
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.startsWith("127.") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    host.startsWith("169.254.") ||
    host === "0.0.0.0"
  ) {
    return `${label} must point to a public website.`;
  }
  return null;
}
