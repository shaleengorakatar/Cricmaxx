import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Vote, Coins } from "lucide-react";

interface PollLeaderboardUser {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  total_votes: number;
  total_staked: number;
  polls_won: number;
}

interface PollLeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PollLeaderboardModal = ({ isOpen, onClose }: PollLeaderboardModalProps) => {
  const { user } = useAuth();

  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ['poll-leaderboard'],
    queryFn: async () => {
      // Get all poll votes with user info
      const { data: votes, error: votesError } = await supabase
        .from('poll_votes')
        .select('user_id, option_id, amount, poll_id');

      if (votesError) throw votesError;
      if (!votes?.length) return [];

      // Get resolved polls with winning options
      const { data: resolvedPolls } = await supabase
        .from('prediction_polls')
        .select('id, winning_option_id')
        .eq('status', 'resolved')
        .not('winning_option_id', 'is', null);

      const winningOptions = new Map<string, string>();
      (resolvedPolls || []).forEach((p: any) => {
        if (p.winning_option_id) winningOptions.set(p.id, p.winning_option_id);
      });

      // Aggregate per user
      const userMap = new Map<string, { total_votes: number; total_staked: number; polls_won: number; won_polls_set: Set<string> }>();

      for (const vote of votes) {
        const existing = userMap.get(vote.user_id) || { total_votes: 0, total_staked: 0, polls_won: 0, won_polls_set: new Set<string>() };
        existing.total_votes++;
        existing.total_staked += Number(vote.amount);

        const winningOption = winningOptions.get(vote.poll_id);
        if (winningOption && vote.option_id === winningOption && !existing.won_polls_set.has(vote.poll_id)) {
          existing.polls_won++;
          existing.won_polls_set.add(vote.poll_id);
        }

        userMap.set(vote.user_id, existing);
      }

      // Get user profiles
      const userIds = [...userMap.keys()];
      const { data: profiles } = await supabase
        .from('leaderboard_profiles')
        .select('id, username, display_name, name, avatar_url')
        .in('id', userIds);

      const profileMap = new Map<string, any>();
      (profiles || []).forEach((p: any) => profileMap.set(p.id, p));

      // Build leaderboard
      const result: PollLeaderboardUser[] = userIds.map(uid => {
        const stats = userMap.get(uid)!;
        const prof = profileMap.get(uid);
        return {
          id: uid,
          username: prof?.username || null,
          display_name: prof?.display_name || prof?.name || null,
          avatar_url: prof?.avatar_url || null,
          total_votes: stats.total_votes,
          total_staked: stats.total_staked,
          polls_won: stats.polls_won,
        };
      });

      // Sort by polls won, then total staked
      result.sort((a, b) => b.polls_won - a.polls_won || b.total_staked - a.total_staked);

      return result.slice(0, 50);
    },
    enabled: isOpen,
  });

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Trophy className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Trophy className="w-5 h-5 text-amber-600" />;
    return <span className="w-5 h-5 flex items-center justify-center text-sm font-medium text-muted-foreground">#{rank}</span>;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col" hideDescription>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-accent" />
            Poll Leaderboard
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-1">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <Skeleton className="w-5 h-5 rounded" />
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-24 mb-1" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-5 w-12" />
                </div>
              ))}
            </div>
          ) : leaderboard && leaderboard.length > 0 ? (
            leaderboard.map((entry, index) => {
              const rank = index + 1;
              const isCurrentUser = entry.id === user?.id;

              return (
                <div
                  key={entry.id}
                  className={`flex items-center gap-2 p-3 rounded-lg transition-colors ${
                    isCurrentUser ? 'bg-primary/10 border border-primary/20' : ''
                  } ${rank <= 3 ? 'bg-gradient-to-r from-accent/5 to-transparent' : ''}`}
                >
                  <div className="w-6 flex justify-center shrink-0">
                    {getRankIcon(rank)}
                  </div>

                  <Avatar className="w-8 h-8 shrink-0">
                    <AvatarImage src={entry.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {(entry.display_name || entry.username || 'U').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 text-left min-w-0">
                    <p className="font-medium text-foreground text-sm truncate flex items-center gap-1">
                      {entry.display_name || entry.username || 'Anonymous'}
                      {isCurrentUser && <span className="text-xs text-primary">(You)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {entry.total_votes} votes • {entry.total_staked} staked
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Trophy className="w-3.5 h-3.5 text-accent" />
                    <span className="font-bold text-accent text-sm">
                      {entry.polls_won} won
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Vote className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No poll activity yet. Be the first to vote!
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PollLeaderboardModal;
