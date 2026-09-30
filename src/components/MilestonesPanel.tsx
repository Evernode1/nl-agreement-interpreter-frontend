import { useState } from "react";
import { Check, ExternalLink } from "lucide-react";
import { useWallet } from "../context/WalletContext";
import { useRunner } from "../hooks/useRunner";
import {
  approveMilestone,
  confirmMilestoneRefund,
  disputeMilestone,
  submitMilestone,
} from "../lib/client";
import type { AgreementData, MilestoneData, Signer } from "../lib/types";
import { NATIVE_SYMBOL, formatDate, formatIsoTimestamp, fromWei, nowIso, sameAddress } from "../lib/format";
import { DISPUTE_COOLDOWN_MINUTES, MAX_ACTION_TEXT_LEN, validateEvidenceUrl } from "../lib/terms";
import { Button, Card, HelperText, Input, Label, SectionTitle, Textarea } from "./ui";
import { ConsensusNotice, MilestoneStatusBadge } from "./agreement";

type Run = (
  label: string,
  fn: (signer: Signer) => Promise<unknown>,
  successTitle: string,
  successDetail?: string,
) => Promise<boolean>;

function EvidenceLink({ url, label }: { url: string; label: string }) {
  if (!url) return null;
  return (
    <div>
      <p className="text-[12px] text-paper-500">{label}</p>
      <a
        href={url}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-0.5 inline-flex max-w-full items-center gap-1.5 break-all font-mono text-[12px] text-quill-300 hover:text-quill-200"
      >
        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
        {url}
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// One milestone
// ---------------------------------------------------------------------------

function MilestoneCard({
  agreement,
  m,
  isA,
  isB,
  busy,
  run,
}: {
  agreement: AgreementData;
  m: MilestoneData;
  isA: boolean;
  isB: boolean;
  busy: string | null;
  run: Run;
}) {
  const id = agreement.agreement_id;
  const active = agreement.status === "ACTIVE";
  const i = m.index;

  const [form, setForm] = useState<"none" | "submit" | "dispute">("none");
  const [desc, setDesc] = useState("");
  const [url, setUrl] = useState("");
  const [reason, setReason] = useState("");
  const [clientUrl, setClientUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const overdue = m.status === "PENDING" && nowIso().slice(0, 10) > m.deadline.slice(0, 10);
  const anyBusy = busy !== null;

  const closeForm = () => {
    setForm("none");
    setError(null);
  };

  const onSubmit = async () => {
    setError(null);
    const d = desc.trim();
    if (d.length < 1 || d.length > MAX_ACTION_TEXT_LEN) {
      setError(`Describe the deliverable (up to ${MAX_ACTION_TEXT_LEN} characters).`);
      return;
    }
    const urlErr = validateEvidenceUrl(url, "Deliverable link");
    if (urlErr) {
      setError(urlErr);
      return;
    }
    const ok = await run(
      `submit-${i}`,
      (s) => submitMilestone(s, id, i, d, url.trim()),
      "Milestone submitted",
      "The client can now approve it or dispute it.",
    );
    if (ok) {
      closeForm();
      setDesc("");
      setUrl("");
    }
  };

  const onDispute = async () => {
    setError(null);
    const r = reason.trim();
    if (r.length < 1 || r.length > MAX_ACTION_TEXT_LEN) {
      setError(`Explain your reason (up to ${MAX_ACTION_TEXT_LEN} characters).`);
      return;
    }
    if (clientUrl.trim()) {
      const urlErr = validateEvidenceUrl(clientUrl, "Your evidence link");
      if (urlErr) {
        setError(urlErr);
        return;
      }
    }
    const ok = await run(
      `dispute-${i}`,
      (s) => disputeMilestone(s, id, i, r, clientUrl.trim()),
      "Dispute round finished",
      "If the evidence supported the deliverable it was paid; otherwise the milestone is locked.",
    );
    if (ok) {
      closeForm();
      setReason("");
      setClientUrl("");
    }
  };

  const iConfirmed = (isA && m.refund_confirmed_by_client) || (isB && m.refund_confirmed_by_contractor);

  return (
    <div className="rounded-lg border border-ink-700 bg-ink-950/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[12px] text-quill-300">Milestone {i + 1}</p>
          <p className="mt-1 whitespace-pre-wrap break-words font-display text-[15px] leading-relaxed text-paper-100">
            {m.description}
          </p>
        </div>
        <MilestoneStatusBadge status={m.status} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
        <span className="text-paper-200">
          <span className="text-paper-500">Payment </span>
          <span className="font-mono">
            {fromWei(m.amount_wei, 6)} {NATIVE_SYMBOL}
          </span>
        </span>
        <span className="text-paper-200">
          <span className="text-paper-500">Deadline </span>
          {formatDate(m.deadline)}
        </span>
        {overdue && (
          <span className="rounded-full bg-gold-500/15 px-2 py-0.5 text-[11px] text-gold-300">Past deadline</span>
        )}
      </div>

      {(m.deliverable_url || m.deliverable_description) && (
        <div className="mt-4 space-y-3 border-t border-ink-800 pt-4">
          {m.deliverable_description && (
            <div>
              <p className="text-[12px] text-paper-500">
                Contractor's description (a claim) · submitted {formatIsoTimestamp(m.submitted_at)}
              </p>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-paper-200">
                {m.deliverable_description}
              </p>
            </div>
          )}
          <EvidenceLink url={m.deliverable_url} label="Deliverable evidence (committed at submission)" />
          <EvidenceLink url={m.client_evidence_url} label="Client's counter-evidence" />
        </div>
      )}

      {m.dispute_rationale && (
        <div className="mt-4 border-t border-ink-800 pt-4">
          <p className="text-[12px] text-paper-500">
            Validators' reasoning · {m.dispute_attempts} dispute round{m.dispute_attempts === 1 ? "" : "s"}
          </p>
          <blockquote className="mt-1.5 whitespace-pre-wrap break-words rounded-md border-l-2 border-quill-400/60 bg-ink-950/60 px-3.5 py-3 text-[13px] leading-relaxed text-paper-200">
            {m.dispute_rationale}
          </blockquote>
        </div>
      )}

      {m.resolved_at && (
        <p className="mt-4 text-[12px] text-paper-500">
          {m.status === "APPROVED" ? "Paid" : "Refunded"} {formatIsoTimestamp(m.resolved_at)}
        </p>
      )}

      {/* ---- Actions ---- */}
      {active && m.status === "PENDING" && isB && (
        <div className="mt-4 border-t border-ink-800 pt-4">
          {form !== "submit" ? (
            <Button variant="secondary" disabled={anyBusy} onClick={() => setForm("submit")}>
              Submit this milestone
            </Button>
          ) : (
            <div className="space-y-3">
              <div>
                <Label>What you're delivering</Label>
                <Textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} />
              </div>
              <div>
                <Label hint="https:// only">Link to the deliverable</Label>
                <Input
                  className="font-mono"
                  placeholder="https://github.com/… or a public page"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
                <HelperText>
                  The contract fetches this page itself if the client disputes. It is fixed the moment you
                  submit, so use a stable link.
                </HelperText>
              </div>
              {error && <HelperText tone="error">{error}</HelperText>}
              <div className="flex gap-2">
                <Button loading={busy === `submit-${i}`} disabled={anyBusy} onClick={onSubmit}>
                  Submit milestone
                </Button>
                <Button variant="ghost" disabled={anyBusy} onClick={closeForm}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {active && isA && (m.status === "SUBMITTED" || m.status === "DISPUTED") && (
        <div className="mt-4 space-y-3 border-t border-ink-800 pt-4">
          {form !== "dispute" && (
            <div className="flex flex-wrap gap-2">
              <Button
                loading={busy === `approve-${i}`}
                disabled={anyBusy}
                onClick={() =>
                  run(
                    `approve-${i}`,
                    (s) => approveMilestone(s, id, i),
                    "Milestone approved",
                    "The payment was released from escrow to the contractor.",
                  )
                }
              >
                {m.status === "DISPUTED" ? "Pay anyway" : "Approve & pay"}
              </Button>
              <Button variant="secondary" disabled={anyBusy} onClick={() => setForm("dispute")}>
                {m.status === "DISPUTED" ? "Dispute again" : "Dispute"}
              </Button>
            </div>
          )}
          {form === "dispute" && (
            <div className="space-y-3">
              <div>
                <Label>Why doesn't this satisfy the milestone?</Label>
                <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <div>
                <Label hint="optional · https:// only">Your own evidence link</Label>
                <Input
                  className="font-mono"
                  placeholder="https://…"
                  value={clientUrl}
                  onChange={(e) => setClientUrl(e.target.value)}
                />
                <HelperText>
                  Your written reason is only a claim. The validators judge the contractor's deliverable
                  page (and yours, if given) against the milestone as agreed. Re-running a dispute has a{" "}
                  {DISPUTE_COOLDOWN_MINUTES}-minute cooldown.
                </HelperText>
              </div>
              {busy === `dispute-${i}` && <ConsensusNotice kind="evidence" />}
              {error && <HelperText tone="error">{error}</HelperText>}
              <div className="flex gap-2">
                <Button loading={busy === `dispute-${i}`} disabled={anyBusy} onClick={onDispute}>
                  Run dispute round
                </Button>
                <Button variant="ghost" disabled={anyBusy} onClick={closeForm}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {m.status === "DISPUTED" && (
        <div className="mt-4 space-y-3 border-t border-ink-800 pt-4">
          <p className="text-[12px] leading-relaxed text-paper-400">
            These funds stay locked: paying and refunding are equally hard to undo, so neither is the
            default. They move only if the client pays anyway, or <span className="text-paper-200">both</span>{" "}
            parties confirm a refund.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px]">
            <span className={m.refund_confirmed_by_client ? "text-sage-400" : "text-paper-500"}>
              {m.refund_confirmed_by_client ? "✓" : "○"} Client agreed to refund
            </span>
            <span className={m.refund_confirmed_by_contractor ? "text-sage-400" : "text-paper-500"}>
              {m.refund_confirmed_by_contractor ? "✓" : "○"} Contractor agreed to refund
            </span>
          </div>
          {(isA || isB) && (
            <Button
              variant="secondary"
              loading={busy === `refund-${i}`}
              disabled={anyBusy || iConfirmed}
              icon={iConfirmed ? <Check className="h-4 w-4" /> : undefined}
              onClick={() =>
                run(
                  `refund-${i}`,
                  (s) => confirmMilestoneRefund(s, id, i),
                  "Refund confirmation recorded",
                  "The refund executes once both parties have confirmed.",
                )
              }
            >
              {iConfirmed ? "You've confirmed — waiting for the other party" : "Confirm mutual refund"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The panel
// ---------------------------------------------------------------------------

export function MilestonesPanel({
  agreement,
  milestones,
  refresh,
}: {
  agreement: AgreementData;
  milestones: MilestoneData[];
  refresh: () => Promise<void>;
}) {
  const wallet = useWallet();
  const { busy, run } = useRunner(refresh);
  const isA = sameAddress(agreement.party_a, wallet.address);
  const isB = sameAddress(agreement.party_b, wallet.address);

  const total = milestones.reduce((s, m) => s + BigInt(m.amount_wei), 0n);
  const paid = milestones.filter((m) => m.status === "APPROVED").reduce((s, m) => s + BigInt(m.amount_wei), 0n);
  const pct = total > 0n ? Number((paid * 10000n) / total) / 100 : 0;

  return (
    <Card className="space-y-5 p-6">
      <SectionTitle
        aside={
          <span className="font-mono text-[12px] text-paper-500">
            {fromWei(paid.toString(), 6)} / {fromWei(total.toString(), 6)} {NATIVE_SYMBOL} paid
          </span>
        }
      >
        Milestones
      </SectionTitle>

      <div className="h-1.5 overflow-hidden rounded-full bg-ink-800" aria-hidden>
        <div className="h-full rounded-full bg-sage-400 transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>

      {milestones.length === 0 ? (
        <p className="text-[13px] text-paper-500">No milestones were recorded.</p>
      ) : (
        <div className="space-y-4">
          {milestones.map((m) => (
            <MilestoneCard
              key={m.index}
              agreement={agreement}
              m={m}
              isA={isA}
              isB={isB}
              busy={busy}
              run={run}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
