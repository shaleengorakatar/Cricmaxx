import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Search, Loader2, Users, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface MarketWithPositions {
  id: string;
  question: string;
  category: string;
  status: string;
  yes_price: number;
  no_price: number;
  volume: number;
  expiry_time: string;
  created_at: string;
  prediction_count: number | null;
}

interface MarketParticipant {
  user_id: string;
  user_name: string;
  user_email: string;
  side: string;
  total_size: number;
  avg_entry_price: number;
  order_count: number;
  total_spent: number;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  approved: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  open: "bg-green-500/10 text-green-600 border-green-500/20",
  closed: "bg-muted text-muted-foreground",
  resolved: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
};

const PredictionsOverviewPanel = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);

  // Fetch all markets
  const { data: markets, isLoading: marketsLoading } = useQuery({
    queryKey: ["admin-all-markets", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("markets")
        .select("id, question, category, status, yes_price, no_price, volume, expiry_time, created_at, prediction_count")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as MarketWithPositions[];
    },
    refetchInterval: 30000,
  });

  // Fetch participants for selected market
  const { data: participants, isLoading: participantsLoading } = useQuery({
    queryKey: ["admin-market-participants", selectedMarketId],
    queryFn: async () => {
      if (!selectedMarketId) return null;

      // Get positions for this market
      const { data: positions, error: posError } = await supabase
        .from("positions")
        .select("user_id, side, size, entry_price")
        .eq("market_id", selectedMarketId)
        .gt("size", 0);

      if (posError) throw posError;

      // Get orders for this market
      const { data: orders, error: ordError } = await supabase
        .from("orders")
        .select("user_id, side, quantity, price, status, filled_quantity")
        .eq("market_id", selectedMarketId);

      if (ordError) throw ordError;

      // Collect unique user IDs
      const userIds = [
        ...new Set([
          ...(positions?.map((p) => p.user_id) || []),
          ...(orders?.map((o) => o.user_id) || []),
        ]),
      ];

      if (userIds.length === 0) return [];

      // Get user profiles
      const { data: profiles, error: profError } = await supabase
        .from("profiles")
        .select("id, name, email, display_name, username")
        .in("id", userIds);

      if (profError) throw profError;

      const profileMap = new Map(
        profiles?.map((p) => [
          p.id,
          { name: p.display_name || p.username || p.name, email: p.email },
        ]) || []
      );

      // Aggregate per user
      const userMap = new Map<string, MarketParticipant>();

      positions?.forEach((pos) => {
        const key = `${pos.user_id}-${pos.side}`;
        const existing = userMap.get(key);
        const profile = profileMap.get(pos.user_id);

        if (existing) {
          existing.total_size += pos.size;
          existing.total_spent += pos.size * pos.entry_price;
          existing.avg_entry_price =
            existing.total_spent / existing.total_size;
        } else {
          userMap.set(key, {
            user_id: pos.user_id,
            user_name: profile?.name || "Unknown",
            user_email: profile?.email || "",
            side: pos.side,
            total_size: pos.size,
            avg_entry_price: pos.entry_price,
            order_count: 0,
            total_spent: pos.size * pos.entry_price,
          });
        }
      });

      // Count orders per user-side
      orders?.forEach((ord) => {
        const key = `${ord.user_id}-${ord.side}`;
        const existing = userMap.get(key);
        if (existing) {
          existing.order_count += 1;
        } else {
          const profile = profileMap.get(ord.user_id);
          userMap.set(key, {
            user_id: ord.user_id,
            user_name: profile?.name || "Unknown",
            user_email: profile?.email || "",
            side: ord.side,
            total_size: ord.filled_quantity || 0,
            avg_entry_price: ord.price || 0,
            order_count: 1,
            total_spent: (ord.filled_quantity || 0) * (ord.price || 0),
          });
        }
      });

      return Array.from(userMap.values()).sort(
        (a, b) => b.total_size - a.total_size
      );
    },
    enabled: !!selectedMarketId,
  });

  const filteredMarkets = markets?.filter((m) =>
    m.question.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedMarket = markets?.find((m) => m.id === selectedMarketId);

  // Detail view for a selected market
  if (selectedMarketId && selectedMarket) {
    const yesBettors = participants?.filter((p) => p.side === "yes") || [];
    const noBettors = participants?.filter((p) => p.side === "no") || [];
    const totalYesTokens = yesBettors.reduce((s, p) => s + p.total_size, 0);
    const totalNoTokens = noBettors.reduce((s, p) => s + p.total_size, 0);

    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          onClick={() => setSelectedMarketId(null)}
          className="mb-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Predictions
        </Button>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg">{selectedMarket.question}</CardTitle>
                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                  <Badge variant="outline">{selectedMarket.category}</Badge>
                  <Badge className={statusColors[selectedMarket.status] || ""}>
                    {selectedMarket.status}
                  </Badge>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-foreground">
                  {selectedMarket.volume.toFixed(0)}
                </div>
                <div className="text-xs text-muted-foreground">Total Volume</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-green-500/10">
                <div className="text-2xl font-bold text-green-600">
                  {(selectedMarket.yes_price * 100).toFixed(0)}%
                </div>
                <div className="text-xs text-muted-foreground">Yes Price</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-red-500/10">
                <div className="text-2xl font-bold text-red-600">
                  {(selectedMarket.no_price * 100).toFixed(0)}%
                </div>
                <div className="text-xs text-muted-foreground">No Price</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-foreground">
                  {(participants?.length || 0)}
                </div>
                <div className="text-xs text-muted-foreground">Participants</div>
              </div>
            </div>

            {participantsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : !participants || participants.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No participants yet
              </div>
            ) : (
              <div className="space-y-6">
                {/* YES side */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-3 w-3 rounded-full bg-green-500" />
                    <h4 className="font-semibold text-foreground">
                      YES Bettors ({yesBettors.length})
                    </h4>
                    <span className="text-sm text-muted-foreground ml-auto">
                      Total: {totalYesTokens.toFixed(1)} tokens
                    </span>
                  </div>
                  {yesBettors.length > 0 ? (
                    <div className="rounded-md border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead className="text-right">Tokens</TableHead>
                            <TableHead className="text-right">Avg Price</TableHead>
                            <TableHead className="text-right">Spent</TableHead>
                            <TableHead className="text-right">Orders</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {yesBettors.map((p) => (
                            <TableRow key={`${p.user_id}-yes`}>
                              <TableCell>
                                <div>
                                  <div className="font-medium text-foreground">{p.user_name}</div>
                                  <div className="text-xs text-muted-foreground">{p.user_email}</div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-semibold text-green-600">
                                {p.total_size.toFixed(1)}
                              </TableCell>
                              <TableCell className="text-right">
                                {(p.avg_entry_price * 100).toFixed(0)}%
                              </TableCell>
                              <TableCell className="text-right">
                                {p.total_spent.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right">{p.order_count}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground pl-5">No YES bettors</p>
                  )}
                </div>

                {/* NO side */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                    <h4 className="font-semibold text-foreground">
                      NO Bettors ({noBettors.length})
                    </h4>
                    <span className="text-sm text-muted-foreground ml-auto">
                      Total: {totalNoTokens.toFixed(1)} tokens
                    </span>
                  </div>
                  {noBettors.length > 0 ? (
                    <div className="rounded-md border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead className="text-right">Tokens</TableHead>
                            <TableHead className="text-right">Avg Price</TableHead>
                            <TableHead className="text-right">Spent</TableHead>
                            <TableHead className="text-right">Orders</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {noBettors.map((p) => (
                            <TableRow key={`${p.user_id}-no`}>
                              <TableCell>
                                <div>
                                  <div className="font-medium text-foreground">{p.user_name}</div>
                                  <div className="text-xs text-muted-foreground">{p.user_email}</div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-semibold text-red-600">
                                {p.total_size.toFixed(1)}
                              </TableCell>
                              <TableCell className="text-right">
                                {(p.avg_entry_price * 100).toFixed(0)}%
                              </TableCell>
                              <TableCell className="text-right">
                                {p.total_spent.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right">{p.order_count}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground pl-5">No NO bettors</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Market list view
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search predictions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {marketsLoading ? (
        <Card className="p-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </Card>
      ) : !filteredMarkets || filteredMarkets.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          No predictions found
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredMarkets.map((market) => (
            <Card
              key={market.id}
              className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => setSelectedMarketId(market.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground text-sm line-clamp-2">
                    {market.question}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">{market.category}</Badge>
                    <Badge className={`text-xs ${statusColors[market.status] || ""}`}>
                      {market.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Vol: {market.volume.toFixed(0)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Expires: {format(new Date(market.expiry_time), "MMM dd")}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="flex gap-2 text-xs">
                      <span className="text-green-600 font-semibold">
                        Y {(market.yes_price * 100).toFixed(0)}%
                      </span>
                      <span className="text-red-600 font-semibold">
                        N {(market.no_price * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default PredictionsOverviewPanel;
