import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink, CheckCircle2, AlertCircle, Wallet } from "lucide-react";
import { useStripeConnect } from "@/hooks/useStripeConnect";

const StripeConnectCard = () => {
  const { status, isLoading, isConnecting, startOnboarding, refreshStatus } = useStripeConnect();

  if (isLoading) {
    return (
      <Card className="p-4 md:p-6">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  const getStatusBadge = () => {
    switch (status?.status) {
      case "active":
        return (
          <Badge variant="default" className="bg-green-500/20 text-green-400 border-green-500/30">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Connected
          </Badge>
        );
      case "pending_verification":
        return (
          <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            <AlertCircle className="h-3 w-3 mr-1" />
            Pending Verification
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary" className="bg-orange-500/20 text-orange-400 border-orange-500/30">
            <AlertCircle className="h-3 w-3 mr-1" />
            Setup Incomplete
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground">
            Not Connected
          </Badge>
        );
    }
  };

  const getActionButton = () => {
    if (status?.status === "active") {
      return (
        <Button variant="outline" size="sm" onClick={refreshStatus}>
          Refresh Status
        </Button>
      );
    }

    if (status?.status === "pending" || status?.status === "pending_verification") {
      return (
        <Button onClick={() => startOnboarding()} disabled={isConnecting} size="sm">
          {isConnecting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Opening...
            </>
          ) : (
            <>
              Complete Setup
              <ExternalLink className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      );
    }

    return (
      <Button onClick={() => startOnboarding()} disabled={isConnecting}>
        {isConnecting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Opening...
          </>
        ) : (
          <>
            <Wallet className="h-4 w-4 mr-2" />
            Connect Bank Account
          </>
        )}
      </Button>
    );
  };

  return (
    <Card className="p-4 md:p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base md:text-lg font-semibold text-foreground">Payout Settings</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Connect your bank account to receive payouts
          </p>
        </div>
        {getStatusBadge()}
      </div>

      <div className="space-y-3">
        {status?.status === "active" ? (
          <p className="text-sm text-green-400">
            ✓ Your bank account is connected. You can now redeem tokens for real money.
          </p>
        ) : status?.status === "pending_verification" ? (
          <p className="text-sm text-yellow-400">
            Your account is being verified by Stripe. This usually takes 1-2 business days.
          </p>
        ) : status?.status === "pending" ? (
          <p className="text-sm text-orange-400">
            Please complete your Stripe account setup to enable payouts.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Connect your bank account through Stripe to redeem tokens for USD. Payouts typically arrive in 2-5 business days.
          </p>
        )}

        {getActionButton()}
      </div>
    </Card>
  );
};

export default StripeConnectCard;
