import { useCallback, useEffect, useRef, useState } from "react";
import { listAllAgreements } from "../lib/client";
import type { AgreementData } from "../lib/types";
import { isContractConfigured } from "../lib/chains";

interface UseAllAgreementsResult {
  /** Newest first. */
  agreements: AgreementData[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const POLL_MS = 30_000;

/**
 * The contract has no "agreements for this address" view, so the dashboard and explorer read the
 * full registry (paged) and filter client-side. Fine for a hackathon-scale registry; a production
 * deployment would want an indexer.
 */
export function useAllAgreements(): UseAllAgreementsResult {
  const [agreements, setAgreements] = useState<AgreementData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!isContractConfigured) {
      setLoading(false);
      return;
    }
    try {
      const all = await listAllAgreements();
      if (!mounted.current) return;
      setAgreements([...all].reverse());
      setError(null);
    } catch (e) {
      if (!mounted.current) return;
      setError(e instanceof Error ? e.message : "Could not load agreements from the network.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return { agreements, loading, error, refresh };
}
