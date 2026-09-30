import { useCallback, useEffect, useRef, useState } from "react";
import { getAgreement, listMilestones } from "../lib/client";
import type { AgreementData, MilestoneData } from "../lib/types";
import { isContractConfigured } from "../lib/chains";

interface UseAgreementResult {
  agreement: AgreementData | null;
  milestones: MilestoneData[];
  loading: boolean;
  notFound: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const POLL_MS = 12_000;

export function useAgreement(id: string | null): UseAgreementResult {
  const [agreement, setAgreement] = useState<AgreementData | null>(null);
  const [milestones, setMilestones] = useState<MilestoneData[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!id || !isContractConfigured) {
      setLoading(false);
      return;
    }
    try {
      const a = await getAgreement(id);
      const ms = a.agreement_type === "FREELANCE_MILESTONE" ? await listMilestones(id) : [];
      if (!mounted.current) return;
      setAgreement(a);
      setMilestones(ms);
      setNotFound(false);
      setError(null);
    } catch (e) {
      if (!mounted.current) return;
      const message = e instanceof Error ? e.message : "Could not read the agreement from the network.";
      if (/no agreement found/i.test(message)) {
        setAgreement(null);
        setMilestones([]);
        setNotFound(true);
        setError(null);
      } else {
        setError(message);
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    setAgreement(null);
    setMilestones([]);
    setNotFound(false);
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return { agreement, milestones, loading, notFound, error, refresh };
}
