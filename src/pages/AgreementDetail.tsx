import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useWallet } from "../context/WalletContext";
import { useAgreement } from "../hooks/useAgreement";
import { formatIsoTimestamp, sameAddress } from "../lib/format";
import { isPreActive } from "../lib/terms";
import { Card, CopyButton, HelperText, InfoRow, SectionTitle, Spinner } from "../components/ui";
import {
  LifecycleStepper,
  PartyLine,
  StatusBadge,
  TermsList,
  TypeTag,
} from "../components/agreement";
import { ConsistencyPanel } from "../components/ConsistencyPanel";
import { ActionsPanel } from "../components/ActionsPanel";
import { MilestonesPanel } from "../components/MilestonesPanel";
import { DisputeRecord } from "../components/DisputeRecord";
import { RevisePanel } from "../components/RevisePanel";

export function AgreementDetail() {
  const { id } = useParams<{ id: string }>();
  const wallet = useWallet();
  const { agreement: a, milestones, loading, notFound, error, refresh } = useAgreement(id ?? null);
  const [reviseOpen, setReviseOpen] = useState(false);

  if (!id) return <p className="text-[14px] text-paper-400">No agreement number given.</p>;

  if (loading && !a) {
    return (
      <div className="flex items-center gap-2 text-[14px] text-paper-400">
        <Spinner /> Loading agreement #{id}…
      </div>
    );
  }
  if (error && !a) {
    return (
      <Card className="p-6">
        <HelperText tone="error">{error}</HelperText>
      </Card>
    );
  }
  if (notFound || !a) {
    return (
      <Card className="space-y-2 p-6">
        <p className="font-display text-[18px] text-paper-100">No agreement #{id}</p>
        <p className="text-[13px] text-paper-400">
          There's no agreement with that number.{" "}
          <Link to="/explore" className="text-quill-300 hover:text-quill-200">
            Browse the ones that exist
          </Link>
          .
        </p>
      </Card>
    );
  }

  const me = wallet.address;
  const isA = sameAddress(a.party_a, me);
  const canRevise = isA && isPreActive(a.status) && !a.escrow_funded;
  const freelance = a.agreement_type === "FREELANCE_MILESTONE";

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Link to="/explore" className="inline-flex items-center gap-1.5 text-[13px] text-paper-500 hover:text-paper-100">
          <ArrowLeft className="h-3.5 w-3.5" /> All agreements
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-[28px] text-paper-100">Agreement #{a.agreement_id}</h1>
            <TypeTag type={a.agreement_type} />
            <StatusBadge status={a.status} />
          </div>
          <button
            onClick={() => void refresh()}
            className="inline-flex items-center gap-1.5 rounded-md border border-ink-600 px-2.5 py-1.5 text-[12px] text-paper-400 hover:border-quill-400"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>

      <Card className="p-6">
        <LifecycleStepper agreement={a} />
      </Card>

      {reviseOpen && canRevise && (
        <RevisePanel
          agreement={a}
          milestones={milestones}
          refresh={refresh}
          onClose={() => setReviseOpen(false)}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        {/* ---------------- Left: the agreement itself ---------------- */}
        <div className="space-y-6">
          <Card className="p-6">
            <SectionTitle aside={<CopyButton value={a.raw_text} label="Copy text" />}>The agreement</SectionTitle>
            <div className="rounded-md border border-ink-700 bg-ink-950/50 px-5 py-5">
              <p className="agreement-prose text-[15px] leading-[1.8] text-paper-200">{a.raw_text}</p>
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-paper-500">
              This is what the parties agreed to in words. The structured terms below are what the
              contract acts on, and the validators confirmed the two agree before it could be accepted.
            </p>
          </Card>

          <Card className="p-6">
            <SectionTitle>Structured terms</SectionTitle>
            <TermsList agreement={a} />
          </Card>

          {freelance ? (
            <MilestonesPanel agreement={a} milestones={milestones} refresh={refresh} />
          ) : (
            <DisputeRecord agreement={a} />
          )}
        </div>

        {/* ---------------- Right: parties, check, actions ---------------- */}
        <div className="space-y-6 lg:sticky lg:top-6">
          <Card className="p-5">
            <h3 className="font-display text-[16px] text-paper-100">Parties</h3>
            <div className="mt-3 space-y-3">
              <PartyLine type={a.agreement_type} side="a" address={a.party_a} me={me} />
              <PartyLine type={a.agreement_type} side="b" address={a.party_b} me={me} />
            </div>
            <dl className="mt-4 border-t border-ink-800 pt-2">
              <InfoRow label="Proposed">{formatIsoTimestamp(a.proposed_at)}</InfoRow>
              <InfoRow label="Accepted">{a.accepted_at ? formatIsoTimestamp(a.accepted_at) : "—"}</InfoRow>
              <InfoRow label="Revisions">{a.revision_count}</InfoRow>
            </dl>
          </Card>

          <ConsistencyPanel agreement={a} />

          <ActionsPanel
            agreement={a}
            milestones={milestones}
            refresh={refresh}
            reviseOpen={reviseOpen}
            onToggleRevise={() => setReviseOpen((v) => !v)}
          />
        </div>
      </div>
    </div>
  );
}
