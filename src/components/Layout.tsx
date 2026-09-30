import { NavLink, Outlet } from "react-router-dom";
import { FileSignature } from "lucide-react";
import { WalletPanel } from "./WalletPanel";
import { activeNetworkLabel, isContractConfigured } from "../lib/chains";

const navItems = [
  { to: "/", label: "Overview", end: true },
  { to: "/new", label: "Draft an agreement" },
  { to: "/dashboard", label: "My agreements" },
  { to: "/explore", label: "Explore" },
];

export function Layout() {
  return (
    <div className="min-h-screen bg-ink-950 bg-grain text-paper-100 [background-size:18px_18px]">
      {!isContractConfigured && (
        <div className="border-b border-seal-500/40 bg-seal-500/10 px-4 py-2 text-center text-[12px] text-seal-400">
          No contract address is configured yet — set VITE_CONTRACT_ADDRESS in your .env before deploying.
        </div>
      )}
      <header className="border-b border-ink-800">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <NavLink to="/" className="flex items-center gap-2.5">
            <FileSignature className="h-6 w-6 text-quill-400" strokeWidth={1.6} />
            <span className="font-display text-[19px] leading-none text-paper-100">
              Agreement <span className="text-quill-400">Interpreter</span>
            </span>
          </NavLink>
          <nav className="flex flex-wrap items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
                    isActive ? "bg-ink-800 text-quill-300" : "text-paper-400 hover:text-paper-100"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <WalletPanel />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10">
        <Outlet />
      </main>

      <footer className="mt-16 border-t border-ink-800">
        <div className="mx-auto max-w-6xl px-5 py-8 text-[12px] text-paper-500">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>
              No admin, no arbitrator. The model judges whether text supports a number, and whether
              evidence supports a claim. It never sets a number that moves money.
            </p>
            <p className="font-mono text-paper-600">{activeNetworkLabel}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
