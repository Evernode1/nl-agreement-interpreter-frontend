import { createClient, createAccount } from "genlayer-js";
import { TransactionStatus, ExecutionResult } from "genlayer-js/types";
import { activeChain, CONTRACT_ADDRESS } from "./chains";
import type { AgreementData, AgreementType, MilestoneData, Signer } from "./types";
import { withActiveProvider } from "./injectedWallets";
import { sameAddress } from "./format";

// A read-only client needs no signer at all: every view method on AgreementInterpreter is a
// free call with no wallet interaction, so the app can show agreements before any wallet exists.
const readClient = createClient({ chain: activeChain });

/**
 * Builds a write-capable client bound to a specific signer for exactly one transaction.
 * `signer` is either a raw private key (burner wallet) or an already-connected injected
 * address string (MetaMask etc, per genlayer-js's own account-as-address pattern).
 */
function writeClientFor(signer: `0x${string}`, isPrivateKey: boolean) {
  const account: unknown = isPrivateKey ? createAccount(signer) : signer;
  return createClient({ chain: activeChain, account } as Parameters<typeof createClient>[0]);
}

export type { Signer };

/** Native-token balance for a wallet address (for a "have I got gas" hint in the UI). */
export async function readClientBalance(address: `0x${string}`): Promise<bigint> {
  const client = readClient as unknown as {
    getBalance: (args: { address: `0x${string}` }) => Promise<bigint>;
  };
  return client.getBalance({ address });
}

/**
 * genlayer-js can hand back decoded contract dicts as `Map`s and integers as `bigint`s. The UI
 * wants plain objects and numbers, so normalise once here: Map -> object, bigint -> number when
 * it is safe (otherwise a decimal string, which is what wei fields already are).
 */
function normalize(value: unknown): unknown {
  if (value instanceof Map) {
    const obj: Record<string, unknown> = {};
    value.forEach((v, k) => {
      obj[String(k)] = normalize(v);
    });
    return obj;
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === "bigint") {
    return value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= -BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(value)
      : value.toString();
  }
  if (value && typeof value === "object") {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) obj[k] = normalize(v);
    return obj;
  }
  return value;
}

async function read<T>(functionName: string, args: unknown[] = []): Promise<T> {
  const raw = await readClient.readContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args,
    stateStatus: "accepted",
  });
  return normalize(raw) as T;
}

/** Shape of the fields we care about on a transaction receipt -- kept loose/`unknown`-cast at
 * the call site since we don't depend on genlayer-js's exact receipt type surface. */
interface ReceiptExecutionInfo {
  txExecutionResultName?: string;
  stderr?: string;
  result?: { stderr?: string };
  data?: { stderr?: string };
}

/** Writes that run a consensus round (consistency check, evidence-backed dispute) take much
 * longer than a plain state change, because validators fetch pages and run the model. */
const RETRIES_PLAIN = 60;
const RETRIES_CONSENSUS = 160;
const POLL_INTERVAL_MS = 3000;

async function write(
  signer: Signer,
  functionName: string,
  args: unknown[],
  opts: { valueWei?: bigint; consensus?: boolean } = {},
): Promise<string> {
  const isPrivateKey = !!signer.privateKey;
  const client = writeClientFor(signer.privateKey ?? signer.address, isPrivateKey);
  // For an injected wallet, make sure the wallet the user actually picked is the one that signs
  // (matters when several extensions are installed). No-op for the burner wallet.
  const hash = await withActiveProvider(isPrivateKey ? null : (signer.provider ?? null), () =>
    client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName,
      args,
      value: opts.valueWei ?? 0n,
    }),
  );
  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
    retries: opts.consensus ? RETRIES_CONSENSUS : RETRIES_PLAIN,
    interval: POLL_INTERVAL_MS,
    fullTransaction: true,
  });

  // Consensus reaching ACCEPTED only means validators agreed on an outcome -- that outcome can
  // itself be a failed execution (a contract-side validation error, for instance). Treating
  // ACCEPTED alone as success would show a false "success" toast while nothing was written.
  const r = receipt as unknown as ReceiptExecutionInfo;
  if (r.txExecutionResultName === ExecutionResult.FINISHED_WITH_ERROR) {
    const detail = r.stderr || r.result?.stderr || r.data?.stderr;
    throw new Error(
      detail
        ? `The contract rejected this transaction: ${cleanContractError(detail)}`
        : "The contract rejected this transaction (execution failed). Double-check your inputs.",
    );
  }
  if (r.txExecutionResultName === ExecutionResult.NOT_VOTED) {
    throw new Error(
      "The network hasn't finished voting on this transaction yet. Wait a moment and check whether it went through before retrying.",
    );
  }
  return hash;
}

/** The contract prefixes its user-facing errors with [EXPECTED] / [TRANSIENT] / [LLM_ERROR]. */
function cleanContractError(detail: string): string {
  const match = detail.match(/\[(EXPECTED|TRANSIENT|LLM_ERROR)\]\s*([^\n]*)/);
  if (!match) return detail;
  const [, kind, message] = match;
  if (kind === "TRANSIENT") return `${message} (temporary — try again in a moment)`;
  if (kind === "LLM_ERROR") return `${message} (the consensus model call failed — try again)`;
  return message;
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

export const getAgreement = (id: string) => read<AgreementData>("get_agreement", [id]);
export const getMilestone = (id: string, index: number) =>
  read<MilestoneData>("get_milestone", [id, index]);
export const listMilestones = (id: string) => read<MilestoneData[]>("list_milestones", [id]);
export const listAgreements = (offset: number, limit: number) =>
  read<AgreementData[]>("list_agreements", [offset, limit]);

/** Pages through every agreement (oldest first, as stored). Capped so a huge registry can't hang the UI. */
export async function listAllAgreements(cap = 600, pageSize = 50): Promise<AgreementData[]> {
  const out: AgreementData[] = [];
  for (let offset = 0; offset < cap; offset += pageSize) {
    const page = await listAgreements(offset, pageSize);
    out.push(...page);
    if (page.length < pageSize) break;
  }
  return out;
}

/**
 * `propose_agreement` returns the new id from the contract, but a transaction receipt doesn't
 * reliably surface it, so after proposing we look for the newest agreement this address opened.
 */
export async function findLatestProposedBy(address: string): Promise<AgreementData | null> {
  const all = await listAllAgreements();
  for (let i = all.length - 1; i >= 0; i--) {
    if (sameAddress(all[i].party_a, address)) return all[i];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export interface TermArgs {
  monthlyRentWei: bigint;
  dueDayOfMonth: number;
  leaseStartDate: string;
  leaseEndDate: string;
  lateFeeBps: number;
  milestoneDescriptions: string[];
  milestoneAmountsWei: bigint[];
  milestoneDeadlines: string[];
  confidentialityDurationDays: number;
}

/** Proposes an agreement. The contract immediately runs the per-term consistency round. */
export const proposeAgreement = (
  signer: Signer,
  params: { counterparty: string; type: AgreementType; rawText: string } & TermArgs,
) =>
  write(
    signer,
    "propose_agreement",
    [
      params.counterparty,
      params.type,
      params.rawText,
      params.monthlyRentWei,
      params.dueDayOfMonth,
      params.leaseStartDate,
      params.leaseEndDate,
      params.lateFeeBps,
      params.milestoneDescriptions,
      params.milestoneAmountsWei,
      params.milestoneDeadlines,
      params.confidentialityDurationDays,
    ],
    { consensus: true },
  );

/** Amends a not-yet-accepted agreement and re-runs the consistency round on every term. */
export const reviseAgreement = (
  signer: Signer,
  id: string,
  params: { rawText: string } & TermArgs,
) =>
  write(
    signer,
    "revise_agreement",
    [
      id,
      params.rawText,
      params.monthlyRentWei,
      params.dueDayOfMonth,
      params.leaseStartDate,
      params.leaseEndDate,
      params.lateFeeBps,
      params.milestoneDescriptions,
      params.milestoneAmountsWei,
      params.milestoneDeadlines,
      params.confidentialityDurationDays,
    ],
    { consensus: true },
  );

export const acceptAgreement = (signer: Signer, id: string) =>
  write(signer, "accept_agreement", [id]);

export const rejectAgreement = (signer: Signer, id: string) =>
  write(signer, "reject_agreement", [id]);

export const recordRentPayment = (signer: Signer, id: string, amountWei: bigint) =>
  write(signer, "record_rent_payment", [id], { valueWei: amountWei });

export const completeLease = (signer: Signer, id: string) =>
  write(signer, "complete_lease", [id]);

export const fundMilestoneEscrow = (signer: Signer, id: string, amountWei: bigint) =>
  write(signer, "fund_milestone_escrow", [id], { valueWei: amountWei });

export const submitMilestone = (
  signer: Signer,
  id: string,
  index: number,
  deliverableDescription: string,
  deliverableUrl: string,
) => write(signer, "submit_milestone", [id, index, deliverableDescription, deliverableUrl]);

export const approveMilestone = (signer: Signer, id: string, index: number) =>
  write(signer, "approve_milestone", [id, index]);

/** Evidence-backed consensus round: the contract fetches the deliverable URL itself. */
export const disputeMilestone = (
  signer: Signer,
  id: string,
  index: number,
  reason: string,
  clientEvidenceUrl: string,
) => write(signer, "dispute_milestone", [id, index, reason, clientEvidenceUrl], { consensus: true });

export const confirmMilestoneRefund = (signer: Signer, id: string, index: number) =>
  write(signer, "confirm_milestone_refund", [id, index]);

/** RENT / NDA / GENERIC dispute: 1-3 evidence URLs that the contract fetches inside consensus. */
export const raiseDispute = (
  signer: Signer,
  id: string,
  actionDescription: string,
  evidenceUrls: string[],
) => write(signer, "raise_dispute", [id, actionDescription, evidenceUrls], { consensus: true });
