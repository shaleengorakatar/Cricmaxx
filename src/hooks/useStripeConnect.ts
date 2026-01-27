import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface StripeConnectStatus {
  connected: boolean;
  status: "not_connected" | "pending" | "pending_verification" | "active";
  payouts_enabled: boolean;
  charges_enabled?: boolean;
  details_submitted?: boolean;
}

export function useStripeConnect() {
  const [status, setStatus] = useState<StripeConnectStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect-status");

      if (error) throw error;

      setStatus(data);
    } catch (err) {
      console.error("Failed to fetch Stripe Connect status:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch status");
      setStatus({
        connected: false,
        status: "not_connected",
        payouts_enabled: false,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const startOnboarding = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect-onboard");

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err) {
      console.error("Failed to start Stripe onboarding:", err);
      setError(err instanceof Error ? err.message : "Failed to start onboarding");
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const requestPayout = useCallback(async (amount: number) => {
    try {
      const { data, error } = await supabase.functions.invoke("stripe-payout", {
        body: { amount },
      });

      if (error) throw error;

      return data;
    } catch (err) {
      console.error("Payout request failed:", err);
      throw err;
    }
  }, []);

  return {
    status,
    isLoading,
    isConnecting,
    error,
    startOnboarding,
    requestPayout,
    refreshStatus: fetchStatus,
  };
}
