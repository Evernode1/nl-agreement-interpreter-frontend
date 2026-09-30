import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Hash, Scale, Search, ShieldCheck } from "lucide-react";
import { Card, buttonClass } from "../components/ui";
import { TypeIcon } from "../components/agreement";
import { TYPE_META, TYPE_ORDER } from "../lib/terms";

const steps = [
  {
    n: "01",
    title: "Draft it twice",
    body: "Write the agreement in plain English, and enter the exact numbers and dates that should govern money: rent, due day, milestone payments, deadlines, confidentiality period.",
  },
  {
    n: "02",
    title: "Every term is checked",
    body: "Validators judge each structured term against your text, one verdict per term. Code, not the model, combines them. A term the text never states doesn't pass.",
  },
  {
    n: "03",
    title: "Accept and run it",
    body: "Once the counterparty accepts, paying rent, funding escrow, submitting and approving milestones are plain deterministic code. No AI is involved in the happy path.",
  },
  {
    n: "04",
    title: "Disputes go to evidence",
    body: "If someone contests an action, the contract fetches the evidence pages itself and validators judge them against the agreed text. A party's own description is only a claim.",
  },
];

const principles = [
  {
    icon: Hash,
    title: "The model never sets a number",
    body: "It isn't asked to read “$1,200 a month” and produce a wei amount. You supply the exact values; the model only judges whether your words support them, or clearly contradict them.",
  },
  {
    icon: ShieldCheck,
    title: "Missing isn't passing",
    body: "Every money-moving term gets its own verdict. A term the model skips, or the text leaves unstated, counts as undetermined, and the agreement can't be accepted until the text backs it.",
  },
  {
    icon: Search,
    title: "Evidence, not eloquence",
    body: "Escrow is released and a breach is confirmed only when evidence the contract fetched itself supports the verdict. No fetchable evidence means no verdict, never a guess.",
  },
  {
    icon: Scale,
    title: "Two different safe defaults",
    body: "A stuck milestone dispute freezes the escrow, because paying and refunding are equally hard to undo. A stuck rent or NDA dispute defaults to dismissed, because nothing is escrowed on it.",
  },
];

function Highlight({ children }: { children: string }) {
  return <mark className="rounded bg-quill-400/20 px-1 text-paper-100">{children}</mark>;
}

function TermRow({ id, verdict }: { id: string; verdict: "ok" | "unknown" }) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-ink-800 py-2 last:border-b-0">
      <span className="font-mono text-[12px] text-paper-400">{id}</span>
      {verdict === "ok" ? (
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-sage-400">
          <span className="h-1.5 w-1.5 rounded-full bg-sage-400" /> Consistent
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-gold-300">
          <span className="h-1.5 w-1.5 rounded-full bg-gold-400" /> Could not determine
        </span>
      )}
    </li>
  );
}

export function Landing() {
  return (
    <div className="space-y-24">
      <section className="grid gap-10 pt-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="font-display text-[42px] leading-[1.08] text-paper-100 sm:text-[52px]"
          >
            Plain English in.
            <br />
            <span className="text-quill-400">An agreement that runs itself.</span>
          </motion.h1>
          <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-paper-400">
            Draft a rent lease, a freelance milestone contract or an NDA as ordinary text plus the exact
            numbers. GenLayer validators check that your words support every number before anyone can
            accept, and settle disputes from evidence the contract fetches itself.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/new" className={buttonClass("primary", "px-5 py-3 text-[14px]")}>
              Draft an agreement <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/explore" className={buttonClass("secondary", "px-5 py-3 text-[14px]")}>
              Explore agreements
            </Link>
          </div>
        </div>

        {/* The one deliberate visual moment: what a term check looks like. */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-wide text-paper-500">The term check, illustrated</p>
            <p className="text-[11px] text-paper-600">Example — not a live result</p>
          </div>
          <p className="agreement-prose mt-4 rounded-md border border-ink-700 bg-ink-950/50 px-4 py-4 text-[14px] leading-[1.75] text-paper-300">
            The Tenant pays <Highlight>1.5 ETH</Highlight> each month, due on or before the{" "}
            <Highlight>5th</Highlight>. Rent paid late carries a fee of <Highlight>5%</Highlight> of one
            month's rent. The lease begins on <Highlight>2026-11-01</Highlight>.
          </p>
          <p className="mt-4 text-[12px] text-paper-500">One verdict per structured term:</p>
          <ul className="mt-1">
            <TermRow id="monthly_rent" verdict="ok" />
            <TermRow id="due_day" verdict="ok" />
            <TermRow id="late_fee" verdict="ok" />
            <TermRow id="lease_start" verdict="ok" />
            <TermRow id="lease_end" verdict="unknown" />
          </ul>
          <p className="mt-3 text-[12px] leading-relaxed text-paper-400">
            The text never states an end date, so that term can't pass. The proposer has to add it
            before the tenant can accept.
          </p>
        </Card>
      </section>

      <section>
        <h2 className="font-display text-[26px] text-paper-100">How it works</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <div key={step.n} className="border-t border-ink-700 pt-4">
              <span className="font-mono text-[12px] text-quill-400">{step.n}</span>
              <h3 className="mt-2 font-display text-[17px] text-paper-100">{step.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-paper-400">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-[26px] text-paper-100">Four kinds of agreement</h2>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-paper-400">
          One contract, one lifecycle. Each type decides which terms are structured and how money moves.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {TYPE_ORDER.map((t) => (
            <Card key={t} className="p-5">
              <TypeIcon type={t} className="h-5 w-5 text-quill-400" />
              <h3 className="mt-3 font-display text-[16px] text-paper-100">{TYPE_META[t].label}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-paper-400">{TYPE_META[t].blurb}</p>
              <p className="mt-3 text-[12px] text-paper-500">
                <span className="text-paper-400">Checked: </span>
                {TYPE_META[t].checks}
              </p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-[26px] text-paper-100">A genuine intelligent contract, not a form</h2>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-paper-400">
          A plain “fill in the fields and both click accept” contract needs no AI, and can't tell you that
          the numbers you typed don't match the text you pasted. Consensus adds exactly two things: a
          term-by-term faithfulness check, and an evidence-grounded ruling when an action is contested.
        </p>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {principles.map((p) => (
            <Card key={p.title} className="p-5">
              <p.icon className="h-5 w-5 text-quill-400" strokeWidth={1.6} />
              <h3 className="mt-3 font-display text-[16px] text-paper-100">{p.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-paper-400">{p.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <Card className="p-6">
          <h2 className="font-display text-[20px] text-paper-100">Honest limitations</h2>
          <ul className="mt-4 space-y-3 text-[13px] leading-relaxed text-paper-400">
            <li>
              The term check is English comprehension, not legal review. It doesn't judge fairness,
              enforceability or jurisdiction.
            </li>
            <li>
              Evidence links are chosen by the parties. The contract guarantees it reads them itself,
              not that the page is authoritative or unchanged. Pages behind a login or JavaScript may not
              load, which safely means no verdict.
            </li>
            <li>
              Prices stated only in fiat can't be verified, so write amounts in ETH or exact wei.
            </li>
            <li>
              A dispute can't claw back funds that already moved. A stuck milestone dispute stays locked
              until the client pays anyway or both parties confirm a refund. There is no arbitrator.
            </li>
            <li>Parties are wallet addresses only. There is no identity verification.</li>
          </ul>
        </Card>
      </section>
    </div>
  );
}
