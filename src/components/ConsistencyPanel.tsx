import type { AgreementData } from "../lib/types";
import { Card, Notice } from "./ui";
import { VerdictBadge } from "./agreement";

export function ConsistencyPanel({ agreement: a }: { agreement: AgreementData }) {
  const generic = a.agreement_type === "GENERIC";
  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-[16px] text-paper-100">Term check</h3>
          <p className="mt-1 text-[12px] text-paper-500">
            {generic
              ? "Skipped — nothing structured to verify"
              : `Attempt ${a.consistency_check_attempts} · ${a.revision_count} revision${a.revision_count === 1 ? "" : "s"}`}
          </p>
        </div>
        <VerdictBadge verdict={a.consistency_verdict} />
      </div>

      {a.consistency_rationale && (
        <blockquote className="whitespace-pre-wrap break-words rounded-md border-l-2 border-quill-400/60 bg-ink-950/50 px-3.5 py-3 text-[13px] leading-relaxed text-paper-200">
          {a.consistency_rationale}
        </blockquote>
      )}

      {a.consistency_verdict === "CONSISTENT" && (
        <Notice tone="success">
          {generic
            ? "A generic agreement has no structured terms, so it goes straight to the counterparty."
            : "Every structured term is supported by the text. The counterparty can accept."}
        </Notice>
      )}
      {a.consistency_verdict === "INCONSISTENT" && (
        <Notice tone="error" title="A term clashes with the text">
          At least one number or date contradicts what the text says. The proposer needs to fix the
          text or the term and revise. The check then re-runs on every term.
        </Notice>
      )}
      {a.consistency_verdict === "COULD_NOT_DETERMINE" && (
        <Notice tone="warn" title="A term isn't backed by the text">
          At least one term isn't stated clearly enough (or is priced in fiat, which can't be
          verified). An unstated money-moving term never passes. Spell it out in the text and revise.
        </Notice>
      )}
    </Card>
  );
}
