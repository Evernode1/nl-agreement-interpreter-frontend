import { useState } from "react";
import { reviseAgreement } from "../lib/client";
import { useWallet } from "../context/WalletContext";
import { useRunner } from "../hooks/useRunner";
import type { AgreementData, MilestoneData } from "../lib/types";
import { draftFromAgreement, toTermArgs, validateDraft } from "../lib/terms";
import type { DraftForm } from "../lib/terms";
import { Button, Card, HelperText } from "./ui";
import { ConsensusNotice } from "./agreement";
import { DraftEditor } from "./DraftEditor";

export function RevisePanel({
  agreement,
  milestones,
  refresh,
  onClose,
}: {
  agreement: AgreementData;
  milestones: MilestoneData[];
  refresh: () => Promise<void>;
  onClose: () => void;
}) {
  const wallet = useWallet();
  const { busy, run } = useRunner(refresh);
  const [form, setForm] = useState<DraftForm>(() => draftFromAgreement(agreement, milestones));
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const err = validateDraft(form, { mode: "revise", selfAddress: wallet.address });
    if (err) {
      setError(err);
      return;
    }
    const ok = await run(
      "revise",
      (s) =>
        reviseAgreement(s, agreement.agreement_id, {
          rawText: form.rawText.trim(),
          ...toTermArgs(form),
        }),
      "Revision submitted",
      "The term check has re-run on every term.",
    );
    if (ok) onClose();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-[22px] text-paper-100">Revise this agreement</h2>
        <button onClick={onClose} className="text-[13px] text-paper-500 hover:text-paper-100">
          Close
        </button>
      </div>

      <DraftEditor form={form} onChange={setForm} mode="revise" selfAddress={wallet.address} lockType />

      <Card className="space-y-4 p-6">
        {busy === "revise" && <ConsensusNotice kind="consistency" />}
        {error && <HelperText tone="error">{error}</HelperText>}
        <div className="flex gap-3">
          <Button loading={busy === "revise"} disabled={busy !== null} onClick={submit}>
            Submit revision & re-check
          </Button>
          <Button variant="ghost" disabled={busy !== null} onClick={onClose}>
            Cancel
          </Button>
        </div>
      </Card>
    </div>
  );
}
