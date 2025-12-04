import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, User, Calendar, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

interface PendingMarket {
  id: string;
  question: string;
  category: string;
  expiry_time: string;
  created_at: string;
  description: string | null;
  created_by: string;
  creator_name?: string;
}

const MarketApprovalPanel = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: markets, isLoading } = useQuery({
    queryKey: ['pending-markets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('markets')
        .select('id, question, category, expiry_time, created_at, description, created_by')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch creator profiles
      if (data && data.length > 0) {
        const creatorIds = [...new Set(data.map(m => m.created_by))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', creatorIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p.name]) || []);

        return data.map(market => ({
          ...market,
          creator_name: profileMap.get(market.created_by) || 'Unknown'
        })) as PendingMarket[];
      }

      return data as PendingMarket[];
    },
    refetchInterval: 30000,
  });

  const approveMutation = useMutation({
    mutationFn: async (marketId: string) => {
      const { error } = await supabase
        .from('markets')
        .update({ status: 'approved' })
        .eq('id', marketId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-markets'] });
      queryClient.invalidateQueries({ queryKey: ['platform-stats'] });
      toast({
        title: "Market approved",
        description: "The market is now live for trading",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to approve market",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (marketId: string) => {
      const { error } = await supabase
        .from('markets')
        .update({ status: 'rejected' })
        .eq('id', marketId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-markets'] });
      queryClient.invalidateQueries({ queryKey: ['platform-stats'] });
      toast({
        title: "Market rejected",
        description: "The market has been rejected",
        variant: "destructive",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reject market",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card className="p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </Card>
    );
  }

  if (!markets || markets.length === 0) {
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
                  <span>Creator: <span className="text-foreground font-medium">{market.creator_name}</span></span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Expires: {format(new Date(market.expiry_time), "MMM dd, yyyy")}</span>
                </div>
              </div>

              <div className="mt-3 space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Category: </span>
                  <Badge variant="secondary">{market.category}</Badge>
                </div>
                {market.description && (
                  <div>
                    <span className="text-muted-foreground">Description: </span>
                    <span className="text-foreground">{market.description}</span>
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  Submitted {format(new Date(market.created_at), "MMM dd, yyyy 'at' HH:mm")}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-border">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-white active:scale-95 transition-transform"
                    disabled={approveMutation.isPending}
                  >
                    {approveMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
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
                    <AlertDialogAction onClick={() => approveMutation.mutate(market.id)}>
                      Approve
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="destructive" 
                    className="flex-1 h-12 active:scale-95 transition-transform"
                    disabled={rejectMutation.isPending}
                  >
                    {rejectMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <XCircle className="h-4 w-4 mr-2" />
                    )}
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
                      onClick={() => rejectMutation.mutate(market.id)}
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
