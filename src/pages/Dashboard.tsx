import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { useWallet } from "../context/WalletContext";
import { useAllAgreements } from "../hooks/useAllAgreements";
import { isContractConfigured } from "../lib/chains";
import { actionHint, roleLabel } from "../lib/terms";
import { sameAddress } from "../lib/format";
import type { AgreementData } from "../lib/types";
import { Button, buttonClass, Card, EmptyState, HelperText, PageHeader, SectionTitle } from "../components/ui";
import { AgreementCard } from "../components/agreement";
import { WalletPanel } from "../components/WalletPanel";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-900/60 px-4 py-3">
      <p className="font-display text-[26px] leading-none text-paper-100">{value}</p>
      <p className="mt-1.5 text-[12px] text-paper-500">{label}</p>
    </div>
  );
}

export function Dashboard() {
  const wallet = useWallet();
  const { agreements, loading, error, refresh } = useAllAgreements();
  const me = wallet.address;

  if (!me) {
    return (
      <div className="mx-auto max-w-2xl space-y-8">
        <PageHeader title="My agreements">
          Everything you've proposed, and everything proposed to you, in one place.
        </PageHeader>
        <Card className="flex flex-col items-start gap-4 p-6">
          <p className="text-[14px] text-paper-200">Connect or create a wallet to see your agreements.</p>
          <WalletPanel />
        </Card>
      </div>
    );
  }

  const mine = agreements.filter((a) => sameAddress(a.party_a, me) || sameAddress(a.party_b, me));
  const withHint = mine.map((a) => ({ a, hint: actionHint(a, me) }));
  const attention = withHint.filter((x) => x.hint?.tone === "action");
  const attentionIds = new Set(attention.map((x) => x.a.agreement_id));
  const hintFor = (a: AgreementData) => withHint.find((x) => x.a.agreement_id === a.agreement_id)?.hint ?? null;

  const proposedByMe = mine.filter((a) => sameAddress(a.party_a, me) && !attentionIds.has(a.agreement_id));
  const proposedToMe = mine.filter((a) => sameAddress(a.party_b, me) && !attentionIds.has(a.agreement_id));
  const active = mine.filter((a) => a.status === "ACTIVE").length;
  const closed = mine.filter((a) => ["COMPLETED", "BREACHED", "REJECTED"].includes(a.status)).length;

  return (
    <div className="space-y-10">
      <PageHeader
        title="My agreements"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} loading={loading} onClick={() => void refresh()}>
              Refresh
            </Button>
            <Link to="/new" className={buttonClass("primary")}>
              Draft an agreement
            </Link>
          </div>
        }
      >
        Everything you've proposed, and everything proposed to you.
      </PageHeader>

      {!isContractConfigured && (
        <HelperText tone="error">No contract address is configured, so there is nothing to load yet.</HelperText>
      )}
      {error && <HelperText tone="error">{error}</HelperText>}

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Total" value={mine.length} />
        <Stat label="Need your action" value={attention.length} />
        <Stat label="Active" value={active} />
        <Stat label="Closed" value={closed} />
      </div>

      {!loading && mine.length === 0 && isContractConfigured && (
        <EmptyState title="No agreements yet">
          Draft your first one, or ask a counterparty to propose one to{" "}
          <span className="break-all font-mono text-paper-200">{me}</span>.
        </EmptyState>
      )}

      {attention.length > 0 && (
        <section>
          <SectionTitle>Needs your attention</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {attention.map(({ a, hint }) => (
              <AgreementCard key={a.agreement_id} agreement={a} me={me} hint={hint} />
            ))}
          </div>
        </section>
      )}

      {proposedToMe.length > 0 && (
        <section>
          <SectionTitle
            aside={<span className="text-[12px] text-paper-500">You are the counterparty</span>}
          >
            Proposed to you
          </SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {proposedToMe.map((a) => (
              <AgreementCard key={a.agreement_id} agreement={a} me={me} hint={hintFor(a)} />
            ))}
          </div>
        </section>
      )}

      {proposedByMe.length > 0 && (
        <section>
          <SectionTitle aside={<span className="text-[12px] text-paper-500">You proposed these</span>}>
            Proposed by you
          </SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {proposedByMe.map((a) => (
              <AgreementCard key={a.agreement_id} agreement={a} me={me} hint={hintFor(a)} />
            ))}
          </div>
        </section>
      )}

      {mine.length > 0 && (
        <p className="text-[12px] text-paper-600">
          Roles vary by type — e.g. {roleLabel("RENT", "a").toLowerCase()} / {roleLabel("RENT", "b").toLowerCase()} for a
          lease, {roleLabel("FREELANCE_MILESTONE", "a").toLowerCase()} / {roleLabel("FREELANCE_MILESTONE", "b").toLowerCase()} for milestones.
        </p>
      )}
    </div>
  );
}
