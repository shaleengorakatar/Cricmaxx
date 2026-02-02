import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CreditCard, ArrowUpCircle, ArrowDownCircle, CheckCircle, Clock, XCircle } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

interface PaymentRecord {
  id: string;
  type: string;
  amount: number;
  status: string;
  created_at: string;
  metadata: {
    source?: string;
    stripe_session_id?: string;
    payment_method?: string;
  } | null;
}

const PaymentHistory = () => {
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchPayments();
    }
  }, [user]);

  const fetchPayments = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, type, amount, status, created_at, metadata")
        .eq("user_id", user.id)
        .in("type", ["deposit", "withdrawal"])
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setPayments((data as PaymentRecord[]) || []);
    } catch (error) {
      console.error("Error fetching payment history:", error);
    } finally {
      setLoading(false);
    }
  };

  const getPaymentIcon = (type: string) => {
    return type === "deposit" ? (
      <ArrowUpCircle className="h-4 w-4 text-accent" />
    ) : (
      <ArrowDownCircle className="h-4 w-4 text-destructive" />
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-accent" />;
      case "pending":
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };

  const getPaymentMethod = (metadata: PaymentRecord["metadata"]) => {
    if (!metadata) return "Direct";
    if (metadata.source === "stripe") return "Card/Stripe";
    if (metadata.source === "paypal") return "PayPal";
    return "Direct";
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No payment history yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {payments.map((payment) => (
        <div
          key={payment.id}
          className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            {getPaymentIcon(payment.type)}
            <div>
              <p className="text-sm font-medium">
                {payment.type === "deposit" ? "Tokens Added" : "Redemption"}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(payment.created_at), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className={`text-sm font-medium ${payment.type === "deposit" ? "text-accent" : "text-destructive"}`}>
                {payment.type === "deposit" ? "+" : "-"}{Math.round(Math.abs(payment.amount) * 100) / 100} tokens
              </p>
              <p className="text-xs text-muted-foreground">
                {getPaymentMethod(payment.metadata)}
              </p>
            </div>
            {getStatusIcon(payment.status)}
          </div>
        </div>
      ))}
    </div>
  );
};

export default PaymentHistory;
