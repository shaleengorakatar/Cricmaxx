import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PendingMarket } from "@/types/admin";
import { CheckCircle, XCircle, User, Calendar } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface MarketApprovalPanelProps {
  markets: PendingMarket[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

const MarketApprovalPanel = ({ markets, onApprove, onReject }: MarketApprovalPanelProps) => {
  const { toast } = useToast();

  const handleApprove = (market: PendingMarket) => {
    onApprove(market.id);
    toast({
      title: "Market approved",
      description: `"${market.question}" is now live for trading`,
    });
  };

  const handleReject = (market: PendingMarket) => {
    onReject(market.id);
    toast({
      title: "Market rejected",
      description: `"${market.question}" has been rejected`,
      variant: "destructive",
    });
  };

  if (markets.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center">
          <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">All caught up!</h3>
          <p className="text-sm text-muted-foreground">
            No markets pending approval
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3 md:space-y-4">
      {markets.map(market => (
        <Card key={market.id} className="p-4 md:p-5">
          <div className="space-y-4">
            <div>
              <div className="flex items-start justify-between gap-4 mb-3">
                <h3 className="font-semibold text-foreground text-base line-clamp-2 flex-1">
                  {market.question}
                </h3>
                <Badge variant="outline">Pending</Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>Creator: <span className="text-foreground font-medium">{market.creator}</span></span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Expires: {format(new Date(market.expiryTime), "MMM dd, yyyy")}</span>
                </div>
              </div>

              <div className="mt-3 space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Category: </span>
                  <Badge variant="secondary">{market.category}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Resolution Source: </span>
                  <span className="text-foreground">{market.resolutionSource}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Submitted {format(new Date(market.submittedAt), "MMM dd, yyyy 'at' HH:mm")}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-border">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-white active:scale-95 transition-transform">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Approve Market</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to approve this market? It will immediately become available for trading.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleApprove(market)}>
                      Approve
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="flex-1 h-12 active:scale-95 transition-transform">
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reject Market</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to reject this market? The creator will be notified.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => handleReject(market)}
                      className="bg-destructive text-destructive-foreground"
                    >
                      Reject
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default MarketApprovalPanel;
