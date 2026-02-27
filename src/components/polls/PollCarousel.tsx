import { useState, useEffect, useCallback } from "react";
import { PollCard } from "@/components/polls/PollCard";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PollOption {
  id: string;
  option_text: string;
  vote_count: number;
  total_amount: number;
}

interface Poll {
  id: string;
  question: string;
  description?: string | null;
  closes_at: string;
  status: string;
  total_pool: number;
  winning_option_id: string | null;
  options: PollOption[];
  user_vote: { option_id: string; amount: number } | null;
}

interface PollCarouselProps {
  polls: Poll[];
  highlightId: string | null;
  onVoted: () => void;
}

export const PollCarousel = ({ polls, highlightId, onVoted }: PollCarouselProps) => {
  const initialIndex = highlightId
    ? Math.max(0, polls.findIndex(p => p.id === highlightId))
    : 0;
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    if (highlightId) {
      const idx = polls.findIndex(p => p.id === highlightId);
      if (idx >= 0) setCurrentIndex(idx);
    }
  }, [highlightId, polls]);

  const goTo = useCallback((idx: number) => {
    setCurrentIndex(Math.max(0, Math.min(polls.length - 1, idx)));
  }, [polls.length]);

  if (polls.length === 0) return null;

  const poll = polls[currentIndex];

  return (
    <div className="space-y-4">
      {/* Navigation header */}
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-full"
          disabled={currentIndex === 0}
          onClick={() => goTo(currentIndex - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground tabular-nums">
          {currentIndex + 1} of {polls.length}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-full"
          disabled={currentIndex === polls.length - 1}
          onClick={() => goTo(currentIndex + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Poll card */}
      <div id={`poll-${poll.id}`} className={highlightId === poll.id ? "ring-2 ring-primary rounded-lg" : ""}>
        <PollCard poll={poll} onVoted={onVoted} />
      </div>

      {/* Dot indicators */}
      {polls.length > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {polls.map((p, i) => (
            <button
              key={p.id}
              onClick={() => goTo(i)}
              className={`h-2 w-2 rounded-full transition-all ${
                i === currentIndex
                  ? "bg-primary w-4"
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
