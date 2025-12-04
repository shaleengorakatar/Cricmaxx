import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Target, Award, Sparkles } from "lucide-react";

const UserRatingBadge = () => {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (!profile) return null;

  const ratingScore = profile.rating_score || 1000;
  const predictionsTotal = profile.predictions_total || 0;
  const predictionsCorrect = profile.predictions_correct || 0;
  const losses = predictionsTotal - predictionsCorrect;
  const winRate = predictionsTotal > 0 
    ? Math.round((predictionsCorrect / predictionsTotal) * 100) 
    : 0;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-full transition-colors"
      >
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="font-semibold text-primary text-sm">
          🔮 {ratingScore}
        </span>
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Your Rating Breakdown
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Rating Score */}
            <div className="text-center py-4 bg-primary/10 rounded-lg">
              <p className="text-4xl font-bold text-primary">🔮 {ratingScore}</p>
              <p className="text-sm text-muted-foreground mt-1">Prediction Rating</p>
            </div>

            {/* Rating Explanation */}
            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
              <p className="mb-2">Rating changes:</p>
              <div className="flex justify-between">
                <span className="text-green-500">+100 per correct prediction</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-500">−50 per incorrect prediction</span>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="p-3 text-center">
                  <Target className="w-5 h-5 mx-auto text-primary mb-1" />
                  <p className="text-xl font-bold">{predictionsTotal}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <TrendingUp className="w-5 h-5 mx-auto text-green-500 mb-1" />
                  <p className="text-xl font-bold text-green-500">{predictionsCorrect}</p>
                  <p className="text-xs text-muted-foreground">Wins</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <TrendingDown className="w-5 h-5 mx-auto text-red-500 mb-1" />
                  <p className="text-xl font-bold text-red-500">{losses}</p>
                  <p className="text-xs text-muted-foreground">Losses</p>
                </CardContent>
              </Card>
            </div>

            {/* Win Rate */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-primary" />
                    <span className="font-medium">Win Rate</span>
                  </div>
                  <span className="text-xl font-bold text-primary">{winRate}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${winRate}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default UserRatingBadge;