# Agreement Interpreter — frontend

Frontend for the `AgreementInterpreter` Intelligent Contract on [GenLayer](https://genlayer.com)
(`nl-agreement-interpreter` v1.2). Visual system and wallet flow are adapted from the Proof of Life
Vault frontend; the palette and every page are new (ink-blue + paper + quill, instead of vault + brass).

Vite + React + TypeScript + Tailwind, talking to the chain directly through `genlayer-js`.
No backend, no API keys.

## What's included

- **Every contract method**, wired end to end: `propose_agreement`, `revise_agreement`,
  `accept_agreement`, `reject_agreement`, `record_rent_payment`, `complete_lease`,
  `fund_milestone_escrow`, `submit_milestone`, `approve_milestone`, `dispute_milestone`,
  `confirm_milestone_refund`, `raise_dispute`, plus all views.
- **Draft page** for all four types (RENT, FREELANCE_MILESTONE, NDA, GENERIC) with client-side
  validation mirroring the contract's rules, a "draft text from my terms" helper, and a live
  **"what the validators will check"** preview: one line per structured term, exactly as the contract
  builds them, with a quick local look for each value in your text.
- **Agreement page**: the text shown as a sheet, lifecycle stepper (proposed → term check → accepted →
  closed), the validators' per-agreement rationale, structured terms, parties, and role-aware actions.
- **Milestones panel**: submit (with committed https evidence link), approve / pay anyway, evidence-backed
  dispute, and the 2-of-2 mutual refund with per-party confirmation state.
- **Dispute record** for RENT / NDA / GENERIC: allegation, fetched evidence links, verdict, attempt budget.
- **Dashboard** ("needs your attention", proposed to you, proposed by you) and **Explore** (filter by type
  and status, open by number).
- **Same wallet as Proof of Life Vault**: create an encrypted in-browser wallet, import a key, or connect
  any EIP-6963 / injected EVM wallet.

## Setup

1. Deploy `contracts/AgreementInterpreter.py` in [GenLayer Studio](https://studio.genlayer.com) and copy the address.
2. `cp .env.example .env` and set `VITE_CONTRACT_ADDRESS` and `VITE_GENLAYER_NETWORK`.
3. `npm install && npm run dev`
4. Vercel: import as a Vite project, add the same two env vars. `vercel.json` has the SPA rewrite.

## Things to know

- **Consensus writes are slow.** `propose`, `revise`, `dispute_milestone` and `raise_dispute` run
  validator rounds, so the client waits up to ~8 minutes for them (vs ~3 for plain writes) and shows a
  "validators are working" notice. Keep the tab open.
- **Units.** The app shows amounts in `GEN` (see `NATIVE_SYMBOL` in `src/lib/format.ts`; change it if your
  network's token differs), but the contract's consistency prompt labels 10^18 wei as "ETH". The draft
  helper therefore writes "X ETH (N wei)" into starter text so the model can match it. Write amounts the
  same way in your own text.
- **No per-address view on the contract**, so Dashboard and Explore page through `list_agreements` and
  filter client-side (capped at 600). Fine at demo scale; use an indexer beyond that.
- **Proposal ids.** After `propose_agreement` the app looks up your newest agreement to navigate to it,
  since the receipt doesn't reliably carry the returned id.
- Rent "on time" is judged by the chain clock (UTC day of month), so the pay button computes the exact
  amount from the UTC day; a payment sent right at midnight UTC can be rejected — refresh and retry.
- The built-in wallet is a convenience signer for Studio/testnet, not a hardened wallet.

## Structure

```
src/
  lib/         client.ts (contract), terms.ts (validation + preview), format.ts, wallet crypto, chains
  context/     WalletContext, ToastContext
  hooks/       useAgreement, useAllAgreements, useRunner
  components/  ui, agreement (badges/stepper/cards), DraftEditor, MilestonesPanel, ActionsPanel, ...
  pages/       Landing, NewAgreement, Dashboard, Explore, AgreementDetail
```
