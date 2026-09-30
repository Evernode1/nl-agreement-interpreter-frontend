import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, Search } from "lucide-react";
import { useAllAgreements } from "../hooks/useAllAgreements";
import { isContractConfigured } from "../lib/chains";
import { TYPE_META, TYPE_ORDER } from "../lib/terms";
import type { AgreementStatus, AgreementType } from "../lib/types";
import { Button, Card, EmptyState, HelperText, Input, PageHeader, Select } from "../components/ui";
import { AgreementCard } from "../components/agreement";

const PAGE_SIZE = 12;

const STATUS_FILTERS: { value: AgreementStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "Any status" },
  { value: "PROPOSED", label: "Ready to accept" },
  { value: "NEEDS_REVIEW", label: "Needs review" },
  { value: "FLAGGED_INCONSISTENT", label: "Flagged inconsistent" },
  { value: "ACTIVE", label: "Active" },
  { value: "COMPLETED", label: "Completed" },
  { value: "BREACHED", label: "Breached" },
  { value: "REJECTED", label: "Rejected" },
];

export function Explore() {
  const navigate = useNavigate();
  const { agreements, loading, error, refresh } = useAllAgreements();
  const [idQuery, setIdQuery] = useState("");
  const [type, setType] = useState<AgreementType | "ALL">("ALL");
  const [status, setStatus] = useState<AgreementStatus | "ALL">("ALL");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const filtered = useMemo(
    () =>
      agreements.filter(
        (a) => (type === "ALL" || a.agreement_type === type) && (status === "ALL" || a.status === status),
      ),
    [agreements, type, status],
  );

  const idValid = /^\d+$/.test(idQuery.trim());

  return (
    <div className="space-y-8">
      <PageHeader
        title="Explore agreements"
        actions={
          <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} loading={loading} onClick={() => void refresh()}>
            Refresh
          </Button>
        }
      >
        Every agreement is public: its text, its terms, the validators' reasoning, and the evidence any
        dispute was decided on. Browse them, or jump straight to one by number.
      </PageHeader>

      <Card className="flex flex-col gap-3 p-4 sm:flex-row">
        <div className="flex-1">
          <Input
            inputMode="numeric"
            placeholder="Open an agreement by number (e.g. 3)"
            value={idQuery}
            onChange={(e) => setIdQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && idValid) navigate(`/agreement/${idQuery.trim()}`);
            }}
          />
        </div>
        <Button icon={<Search className="h-4 w-4" />} disabled={!idValid} onClick={() => navigate(`/agreement/${idQuery.trim()}`)}>
          Open
        </Button>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          aria-label="Filter by type"
          value={type}
          onChange={(e) => {
            setType(e.target.value as AgreementType | "ALL");
            setVisible(PAGE_SIZE);
          }}
        >
          <option value="ALL">Any type</option>
          {TYPE_ORDER.map((t) => (
            <option key={t} value={t}>
              {TYPE_META[t].label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as AgreementStatus | "ALL");
            setVisible(PAGE_SIZE);
          }}
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>

      {!isContractConfigured && (
        <HelperText tone="error">No contract address is configured, so there is nothing to browse yet.</HelperText>
      )}
      {error && <HelperText tone="error">{error}</HelperText>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.slice(0, visible).map((a) => (
          <AgreementCard key={a.agreement_id} agreement={a} />
        ))}
      </div>

      {!loading && filtered.length === 0 && isContractConfigured && (
        <EmptyState title={agreements.length === 0 ? "No agreements yet" : "Nothing matches those filters"}>
          {agreements.length === 0 ? "Be the first to draft one." : "Try a different type or status."}
        </EmptyState>
      )}

      {visible < filtered.length && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
            Show more
          </Button>
        </div>
      )}
    </div>
  );
}
