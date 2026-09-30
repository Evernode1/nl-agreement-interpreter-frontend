export type AgreementType = "RENT" | "FREELANCE_MILESTONE" | "NDA" | "GENERIC";

export type AgreementStatus =
  | "PROPOSED"
  | "FLAGGED_INCONSISTENT"
  | "NEEDS_REVIEW"
  | "ACTIVE"
  | "REJECTED"
  | "COMPLETED"
  | "BREACHED";

export type MilestoneStatus = "PENDING" | "SUBMITTED" | "APPROVED" | "DISPUTED" | "REFUNDED";

export type DisputeStatus = "NONE" | "OPEN" | "BREACH_CONFIRMED" | "DISMISSED";

export type ConsistencyVerdict = "" | "CONSISTENT" | "INCONSISTENT" | "COULD_NOT_DETERMINE";

/** Mirrors the dict returned by `get_agreement` on the contract. Amounts in wei are strings. */
export interface AgreementData {
  agreement_id: string;
  party_a: string;
  party_b: string;
  agreement_type: AgreementType;
  raw_text: string;
  status: AgreementStatus;
  proposed_at: string;
  accepted_at: string;
  revision_count: number;
  consistency_verdict: ConsistencyVerdict;
  consistency_rationale: string;
  consistency_check_attempts: number;
  monthly_rent_wei: string;
  due_day_of_month: number;
  lease_start_date: string;
  lease_end_date: string;
  late_fee_bps: number;
  rent_payments_made: number;
  milestone_count: number;
  escrow_funded: boolean;
  escrow_balance: string;
  confidentiality_duration_days: number;
  dispute_status: DisputeStatus;
  dispute_rationale: string;
  dispute_attempts: number;
  breach_count: number;
  dispute_action_description: string;
  dispute_evidence_urls: string; // newline-joined
}

/** Mirrors the dict returned by `get_milestone` / `list_milestones`. */
export interface MilestoneData {
  agreement_id: string;
  index: number;
  description: string;
  amount_wei: string;
  deadline: string;
  status: MilestoneStatus;
  deliverable_description: string;
  deliverable_url: string;
  client_evidence_url: string;
  submitted_at: string;
  resolved_at: string;
  dispute_rationale: string;
  dispute_attempts: number;
  refund_confirmed_by_client: boolean;
  refund_confirmed_by_contractor: boolean;
}

export interface BurnerWallet {
  address: `0x${string}`;
  createdAt: string;
}

export type WalletMode = "none" | "burner-locked" | "burner-unlocked" | "injected";

/** A usable signer: an address, optionally paired with the private key that controls it
 *  (present for an unlocked burner wallet, absent for an injected/extension wallet, where
 *  the extension itself holds the key and signs via the browser). */
export interface Signer {
  address: `0x${string}`;
  privateKey?: `0x${string}`;
  /** The EIP-1193 provider of the injected wallet the user picked (absent for the burner). */
  provider?: import("./injectedWallets").Eip1193Provider;
}
