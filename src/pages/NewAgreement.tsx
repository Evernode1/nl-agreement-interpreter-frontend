import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import { useToast } from "../context/ToastContext";
import { findLatestProposedBy, proposeAgreement } from "../lib/client";
import { isContractConfigured } from "../lib/chains";
import { emptyDraft, toTermArgs, validateDraft } from "../lib/terms";
import type { DraftForm } from "../lib/terms";
import { Button, Card, HelperText, PageHeader } from "../components/ui";
import { ConsensusNotice } from "../components/agreement";
import { DraftEditor } from "../components/DraftEditor";
import { WalletPanel } from "../components/WalletPanel";

export function NewAgreement() {
  const wallet = useWallet();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState<DraftForm>(() => emptyDraft("RENT"));
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async () => {
    setFormError(null);
    const err = validateDraft(form, { mode: "propose", selfAddress: wallet.address });
    if (err) {
      setFormError(err);
      return;
    }
    if (!wallet.signer) {
      setFormError("Connect a wallet first.");
      return;
    }
    setSubmitting(true);
    try {
      await proposeAgreement(wallet.signer, {
        counterparty: form.counterparty.trim(),
        type: form.type,
        rawText: form.rawText.trim(),
        ...toTermArgs(form),
      });
      // The receipt doesn't reliably carry the new id, so look up the newest one we opened.
      let createdId: string | null = null;
      try {
        createdId = (await findLatestProposedBy(wallet.signer.address))?.agreement_id ?? null;
      } catch {
        /* fall back to the dashboard below */
      }
      toast.push("success", "Agreement proposed", "The term check has run — see the result.");
      navigate(createdId ? `/agreement/${createdId}` : "/dashboard");
    } catch (e) {
      toast.push("error", "Could not propose the agreement", e instanceof Error ? e.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader title="Draft an agreement">
        Write it in plain English, then give the exact numbers and dates the contract will act on.
        GenLayer validators check that your words support every one of them before the other party
        can accept.
      </PageHeader>

      {!isContractConfigured && (
        <Card className="p-4">
          <HelperText tone="error">
            No contract address is configured. Set VITE_CONTRACT_ADDRESS before deploying.
          </HelperText>
        </Card>
      )}

      <DraftEditor form={form} onChange={setForm} mode="propose" selfAddress={wallet.address} />

      <Card className="space-y-4 p-6">
        {submitting && <ConsensusNotice kind="consistency" />}
        {formError && <HelperText tone="error">{formError}</HelperText>}
        {wallet.address ? (
          <Button className="w-full" loading={submitting} onClick={submit}>
            Propose agreement & run the term check
          </Button>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="text-[14px] text-paper-200">Connect or create a wallet to propose this agreement.</p>
            <WalletPanel />
          </div>
        )}
        <HelperText>
          Proposing runs the consensus check straight away. If every term passes, the counterparty can
          accept (a freelance agreement also needs escrow funded first). If not, you'll see why and can
          revise the text or the terms.
        </HelperText>
      </Card>
    </div>
  );
}
