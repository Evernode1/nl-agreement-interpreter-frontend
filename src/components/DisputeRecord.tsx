import { ExternalLink } from "lucide-react";
import type { AgreementData } from "../lib/types";
import { splitUrls } from "../lib/format";
import { MAX_DISPUTE_ATTEMPTS } from "../lib/terms";
import { Card } from "./ui";
import { DisputeBadge } from "./agreement";

/** Read-only record of the latest RENT / NDA / GENERIC dispute round. */
export function DisputeRecord({ agreement: a }: { agreement: AgreementData }) {
  if (a.dispute_status === "NONE" && a.breach_count === 0) return null;
  const urls = splitUrls(a.dispute_evidence_urls);
  return (
    <Card className="space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-[18px] text-paper-100">Dispute record</h3>
          <p className="mt-1 text-[12px] text-paper-500">
            Round attempts: {a.dispute_attempts} of {MAX_DISPUTE_ATTEMPTS} · Confirmed breaches across all
            rounds: {a.breach_count}
          </p>
        </div>
        <DisputeBadge status={a.dispute_status} />
      </div>

      {a.dispute_action_description && (
        <div>
          <p className="text-[12px] text-paper-500">The allegation (an unverified claim)</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-paper-200">
            {a.dispute_action_description}
          </p>
        </div>
      )}

      {urls.length > 0 && (
        <div>
          <p className="text-[12px] text-paper-500">Evidence the contract fetched</p>
          <ul className="mt-1.5 space-y-1.5">
            {urls.map((u) => (
              <li key={u}>
                <a
                  href={u}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex max-w-full items-center gap-1.5 break-all font-mono text-[12px] text-quill-300 hover:text-quill-200"
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  {u}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {a.dispute_rationale && (
        <blockquote className="whitespace-pre-wrap break-words rounded-md border-l-2 border-quill-400/60 bg-ink-950/50 px-3.5 py-3 text-[13px] leading-relaxed text-paper-200">
          {a.dispute_rationale}
        </blockquote>
      )}

      <p className="text-[12px] leading-relaxed text-paper-500">
        A breach is only confirmed when the evidence itself supports it — never from either side's
        description alone. After {MAX_DISPUTE_ATTEMPTS} inconclusive rounds an unresolved dispute here
        defaults to dismissed, because nothing is escrowed on the verdict.
      </p>
    </Card>
  );
}
