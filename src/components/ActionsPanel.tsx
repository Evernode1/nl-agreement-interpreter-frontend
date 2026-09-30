import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useWallet } from "../context/WalletContext";
import { useRunner } from "../hooks/useRunner";
import {
  acceptAgreement,
  completeLease,
  fundMilestoneEscrow,
  raiseDispute,
  recordRentPayment,
  rejectAgreement,
} from "../lib/client";
import type { AgreementData, MilestoneData } from "../lib/types";
import {
  NATIVE_SYMBOL,
  formatDate,
  fromWei,
  fromWeiExact,
  nowIso,
  sameAddress,
  utcDayOfMonth,
} from "../lib/format";
import {
  DISPUTE_COOLDOWN_MINUTES,
  MAX_ACTION_TEXT_LEN,
  MAX_DISPUTE_ATTEMPTS,
  MAX_EVIDENCE_URLS,
  REVISION_COOLDOWN_MINUTES,
  escrowTotalWei,
  isPreActive,
  roleLabel,
  validateEvidenceUrl,
} from "../lib/terms";
import { Button, Card, HelperText, Input, Label, Notice, Textarea } from "./ui";
import { ConsensusNotice } from "./agreement";
import { WalletPanel } from "./WalletPanel";

// ---------------------------------------------------------------------------
// Rent payment (tenant)
// ---------------------------------------------------------------------------

function PayRent({
  agreement: a,
  busy,
  anyBusy,
  onPay,
}: {
  agreement: AgreementData;
  busy: boolean;
  anyBusy: boolean;
  onPay: (amountWei: bigint) => void;
}) {
  const rent = BigInt(a.monthly_rent_wei);
  const fee = (rent * BigInt(a.late_fee_bps)) / 10000n;
  const onTime = utcDayOfMonth() <= a.due_day_of_month;
  const required = onTime ? rent : rent + fee;
  const ended = nowIso() > a.lease_end_date;

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-ink-700 bg-ink-950/40 p-3.5">
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-paper-500">Due now</span>
          <span className={`text-[11px] ${onTime ? "text-sage-400" : "text-gold-300"}`}>
            {onTime ? "On time" : "Late — includes the late fee"}
          </span>
        </div>
        <p className="mt-1 font-mono text-[18px] text-paper-100">
          {fromWeiExact(required)} {NATIVE_SYMBOL}
        </p>
        <p className="mt-1 break-all font-mono text-[11px] text-paper-500">{required.toString()} wei</p>
        {!onTime && (
          <p className="mt-2 text-[12px] text-paper-400">
            Rent {fromWei(rent, 6)} + late fee {fromWei(fee, 6)} {NATIVE_SYMBOL}
          </p>
        )}
      </div>
      <Button className="w-full" loading={busy} disabled={anyBusy || ended} onClick={() => onPay(required)}>
        {ended ? "The lease term has ended" : "Pay rent"}
      </Button>
      <HelperText>
        The payment must match exactly and goes straight to the landlord. On-time is judged on the
        chain's clock (UTC). If a payment is rejected right at midnight UTC, refresh and try again.
      </HelperText>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dispute form (RENT / NDA / GENERIC)
// ---------------------------------------------------------------------------

function DisputeForm({
  agreement: a,
  busy,
  anyBusy,
  onSubmit,
}: {
  agreement: AgreementData;
  busy: boolean;
  anyBusy: boolean;
  onSubmit: (description: string, urls: string[]) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [urls, setUrls] = useState<string[]>([""]);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const d = description.trim();
    if (d.length < 1 || d.length > MAX_ACTION_TEXT_LEN) {
      setError(`Describe what happened (up to ${MAX_ACTION_TEXT_LEN} characters).`);
      return;
    }
    const cleaned = urls.map((u) => u.trim()).filter(Boolean);
    if (cleaned.length < 1 || cleaned.length > MAX_EVIDENCE_URLS) {
      setError(`Provide 1–${MAX_EVIDENCE_URLS} evidence links.`);
      return;
    }
    for (const u of cleaned) {
      const err = validateEvidenceUrl(u);
      if (err) {
        setError(err);
        return;
      }
    }
    const ok = await onSubmit(d, cleaned);
    if (ok) {
      setOpen(false);
      setDescription("");
      setUrls([""]);
    }
  };

  if (!open) {
    return (
      <div className="space-y-2">
        <Button variant="secondary" className="w-full" disabled={anyBusy} onClick={() => setOpen(true)}>
          Raise a dispute
        </Button>
        <HelperText>
          Alleging the other party didn't follow the text? The contract fetches your evidence itself and
          the validators judge it against the agreement.
          {a.dispute_status === "OPEN" && ` A round is already open (${a.dispute_attempts}/${MAX_DISPUTE_ATTEMPTS} attempts).`}
        </HelperText>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>What did the other party do?</Label>
        <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div>
        <Label hint={`1–${MAX_EVIDENCE_URLS} https:// links`}>Evidence</Label>
        <div className="space-y-2">
          {urls.map((u, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                className="font-mono"
                placeholder="https://…"
                value={u}
                onChange={(e) => setUrls(urls.map((x, idx) => (idx === i ? e.target.value : x)))}
              />
              <button
                type="button"
                disabled={urls.length <= 1}
                onClick={() => setUrls(urls.filter((_, idx) => idx !== i))}
                className="text-paper-500 hover:text-seal-400 disabled:opacity-30"
                aria-label="Remove link"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          disabled={urls.length >= MAX_EVIDENCE_URLS}
          onClick={() => setUrls([...urls, ""])}
          className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-quill-300 hover:text-quill-200 disabled:opacity-30"
        >
          <Plus className="h-4 w-4" /> Add link
        </button>
        <HelperText>
          Your written account is only a claim — a verdict needs the fetched evidence to back it. Pages
          that need a login or JavaScript may not load, which safely means no verdict. Re-running an open
          dispute has a {DISPUTE_COOLDOWN_MINUTES}-minute cooldown.
        </HelperText>
      </div>
      {busy && <ConsensusNotice kind="evidence" />}
      {error && <HelperText tone="error">{error}</HelperText>}
      <div className="flex gap-2">
        <Button loading={busy} disabled={anyBusy} onClick={submit}>
          Run dispute round
        </Button>
        <Button variant="ghost" disabled={anyBusy} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The panel
// ---------------------------------------------------------------------------

export function ActionsPanel({
  agreement: a,
  milestones,
  refresh,
  reviseOpen,
  onToggleRevise,
}: {
  agreement: AgreementData;
  milestones: MilestoneData[];
  refresh: () => Promise<void>;
  reviseOpen: boolean;
  onToggleRevise: () => void;
}) {
  const wallet = useWallet();
  const { busy, run } = useRunner(refresh);
  const id = a.agreement_id;
  const anyBusy = busy !== null;

  const isA = sameAddress(a.party_a, wallet.address);
  const isB = sameAddress(a.party_b, wallet.address);
  const freelance = a.agreement_type === "FREELANCE_MILESTONE";
  const preActive = isPreActive(a.status);
  const escrowTotal = escrowTotalWei(milestones);

  const roleChip = isA ? roleLabel(a.agreement_type, "a") : isB ? roleLabel(a.agreement_type, "b") : null;

  const header = (
    <div className="flex items-start justify-between gap-3">
      <h3 className="font-display text-[16px] text-paper-100">Your actions</h3>
      {roleChip && (
        <span className="rounded-full bg-quill-400/15 px-2.5 py-0.5 text-[11px] text-quill-200">{roleChip}</span>
      )}
    </div>
  );

  // -- Not connected ---------------------------------------------------------
  if (!wallet.address) {
    return (
      <Card className="space-y-4 p-5">
        {header}
        <p className="text-[13px] leading-relaxed text-paper-400">
          Connect a wallet to act on this agreement. Reading it never needs one.
        </p>
        <WalletPanel />
      </Card>
    );
  }

  const leaseEnded = a.agreement_type === "RENT" && nowIso() >= a.lease_end_date;

  return (
    <Card className="space-y-5 p-5">
      {header}

      {!isA && !isB && (
        <Notice tone="info">
          You're viewing as an observer. Only the two parties can act on this agreement
          {a.agreement_type === "RENT" && a.status === "ACTIVE" ? ", though anyone may close a finished lease" : ""}.
        </Notice>
      )}

      {/* ---------- Before activation ---------- */}
      {preActive && isB && (
        <div className="space-y-3">
          {a.status === "PROPOSED" && (!freelance || a.escrow_funded) ? (
            <>
              <Button
                className="w-full"
                loading={busy === "accept"}
                disabled={anyBusy}
                onClick={() =>
                  run("accept", (s) => acceptAgreement(s, id), "Agreement accepted", "It's now active.")
                }
              >
                Accept agreement
              </Button>
              <HelperText>
                Accepting activates it exactly as written. Read the text and the structured terms first —
                the term check confirms they agree, not that the deal is fair.
              </HelperText>
            </>
          ) : (
            <Notice tone="warn" title="Not ready to accept yet">
              {a.status === "NEEDS_REVIEW" || a.status === "FLAGGED_INCONSISTENT"
                ? "The term check didn't pass. The proposer has to revise it first."
                : "The client must fund escrow before this can be accepted."}
            </Notice>
          )}
        </div>
      )}

      {preActive && isA && (
        <div className="space-y-4">
          {freelance && !a.escrow_funded && (
            <div className="space-y-2">
              <div className="rounded-md border border-ink-700 bg-ink-950/40 p-3.5">
                <p className="text-[12px] text-paper-500">Escrow to fund (sum of all milestones)</p>
                <p className="mt-1 font-mono text-[18px] text-paper-100">
                  {fromWeiExact(escrowTotal)} {NATIVE_SYMBOL}
                </p>
                <p className="mt-1 break-all font-mono text-[11px] text-paper-500">{escrowTotal.toString()} wei</p>
              </div>
              <Button
                className="w-full"
                loading={busy === "fund"}
                disabled={anyBusy || a.status !== "PROPOSED" || escrowTotal === 0n}
                onClick={() =>
                  run(
                    "fund",
                    (s) => fundMilestoneEscrow(s, id, escrowTotal),
                    "Escrow funded",
                    "The contractor can accept now.",
                  )
                }
              >
                Fund escrow
              </Button>
              <HelperText>
                {a.status === "PROPOSED"
                  ? "Once escrow is funded this draft can no longer be revised. If it's withdrawn, escrow is refunded to you."
                  : "Fix the term check first — funding is only offered once every term is supported, because a funded draft can't be revised."}
              </HelperText>
            </div>
          )}

          {!a.escrow_funded ? (
            <div className="space-y-2">
              <Button variant="secondary" className="w-full" disabled={anyBusy} onClick={onToggleRevise}>
                {reviseOpen ? "Close the editor" : "Revise text or terms"}
              </Button>
              <HelperText>
                Revising re-runs the term check on every term. There is a {REVISION_COOLDOWN_MINUTES}-minute
                cooldown between checks.
              </HelperText>
            </div>
          ) : (
            <HelperText>Escrow is funded, so the text and terms are locked in.</HelperText>
          )}
        </div>
      )}

      {preActive && (isA || isB) && (
        <div className="border-t border-ink-800 pt-4">
          <Button
            variant="danger"
            className="w-full"
            loading={busy === "reject"}
            disabled={anyBusy}
            onClick={() => {
              if (!window.confirm("Reject and close this agreement? This can't be undone.")) return;
              void run(
                "reject",
                (s) => rejectAgreement(s, id),
                isA ? "Agreement withdrawn" : "Agreement rejected",
                a.escrow_funded ? "Escrow was refunded to the client." : undefined,
              );
            }}
          >
            {isA ? "Withdraw agreement" : "Reject agreement"}
          </Button>
        </div>
      )}

      {/* ---------- Active ---------- */}
      {a.status === "ACTIVE" && a.agreement_type === "RENT" && isB && (
        <PayRent
          agreement={a}
          busy={busy === "rent"}
          anyBusy={anyBusy}
          onPay={(amount) =>
            void run(
              "rent",
              (s) => recordRentPayment(s, id, amount),
              "Rent paid",
              "It went straight to the landlord.",
            )
          }
        />
      )}

      {a.status === "ACTIVE" && a.agreement_type === "RENT" && (
        <div className="space-y-2 border-t border-ink-800 pt-4 first:border-t-0 first:pt-0">
          <Button
            variant="secondary"
            className="w-full"
            loading={busy === "complete"}
            disabled={anyBusy || !leaseEnded}
            onClick={() =>
              run("complete", (s) => completeLease(s, id), "Lease completed", "The agreement is now closed.")
            }
          >
            Mark lease completed
          </Button>
          <HelperText>
            {leaseEnded
              ? "The lease term is over. Anyone can close it."
              : `Available once the lease ends on ${formatDate(a.lease_end_date)}.`}
          </HelperText>
        </div>
      )}

      {a.status === "ACTIVE" && freelance && (isA || isB) && (
        <Notice tone="info">Milestone actions — submit, approve, dispute, refund — are on each milestone below.</Notice>
      )}

      {a.status === "ACTIVE" && !freelance && (isA || isB) && (
        <div className="border-t border-ink-800 pt-4 first:border-t-0 first:pt-0">
          <DisputeForm
            agreement={a}
            busy={busy === "dispute"}
            anyBusy={anyBusy}
            onSubmit={(description, urls) =>
              run(
                "dispute",
                (s) => raiseDispute(s, id, description, urls),
                "Dispute round finished",
                "See the dispute record for the verdict.",
              )
            }
          />
        </div>
      )}

      {/* ---------- Closed ---------- */}
      {a.status === "COMPLETED" && <Notice tone="success">This agreement ran to its end. Nothing more to do.</Notice>}
      {a.status === "BREACHED" && (
        <Notice tone="error" title="Breach confirmed">
          The validators found the evidence supports a breach. This is recorded as a fact on-chain;
          no funds move automatically.
        </Notice>
      )}
      {a.status === "REJECTED" && <Notice tone="info">This agreement was rejected and is closed.</Notice>}
    </Card>
  );
}
