import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Sparkles } from "lucide-react";
import { z } from "zod";

const applicationSchema = z.object({
  description: z.string().trim().min(50, "Please provide at least 50 characters describing what you do").max(500),
  followerCount: z.number().min(0, "Follower count must be positive"),
  socialMediaPlatform: z.string().min(1, "Please select a platform"),
  socialMediaHandle: z.string().trim().min(2, "Handle must be at least 2 characters").max(100),
  previousExperience: z.string().trim().max(500).optional(),
});

interface CreatorApplicationFormProps {
  onApplicationSubmitted: () => void;
}

export const CreatorApplicationForm = ({ onApplicationSubmitted }: CreatorApplicationFormProps) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    description: "",
    followerCount: "",
    socialMediaPlatform: "",
    socialMediaHandle: "",
    previousExperience: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validated = applicationSchema.parse({
        ...formData,
        followerCount: parseInt(formData.followerCount) || 0,
      });

      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to submit an application",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('creator_applications')
        .insert({
          user_id: user.id,
          description: validated.description,
          follower_count: validated.followerCount,
          social_media_platform: validated.socialMediaPlatform,
          social_media_handle: validated.socialMediaHandle,
          previous_experience: validated.previousExperience || null,
        });

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          toast({
            title: "Application already submitted",
            description: "You have already submitted a creator application. Please wait for admin review.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      toast({
        title: "Application submitted!",
        description: "Your creator application has been submitted for review. We'll notify you once it's reviewed.",
      });
      
      onApplicationSubmitted();
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        console.error('Error submitting application:', error);
        toast({
          title: "Submission failed",
          description: "Failed to submit application. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent" />
          Apply to Become a Creator
        </CardTitle>
        <CardDescription>
          Creators can launch automated prediction markets and earn 2% commission on trading volume. 
          Applications are reviewed by admins within 24-48 hours.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">What do you do? *</Label>
            <Textarea
              id="description"
              placeholder="Describe your background, expertise, and why you want to create prediction markets (minimum 50 characters)"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="min-h-[100px] resize-none"
              required
            />
            <p className="text-xs text-muted-foreground">
              {formData.description.length}/500 characters
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="platform">Social Media Platform *</Label>
              <Select
                value={formData.socialMediaPlatform}
                onValueChange={(value) => setFormData({ ...formData, socialMediaPlatform: value })}
                required
              >
                <SelectTrigger id="platform">
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="twitter">Twitter/X</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="youtube">YouTube</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="handle">Social Media Handle *</Label>
              <Input
                id="handle"
                type="text"
                placeholder="@yourhandle"
                value={formData.socialMediaHandle}
                onChange={(e) => setFormData({ ...formData, socialMediaHandle: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="followers">Follower Count *</Label>
            <Input
              id="followers"
              type="number"
              placeholder="10000"
              value={formData.followerCount}
              onChange={(e) => setFormData({ ...formData, followerCount: e.target.value })}
              min="0"
              required
            />
            <p className="text-xs text-muted-foreground">
              Applications with 10,000+ followers are prioritized for approval
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="experience">Previous Experience (Optional)</Label>
            <Textarea
              id="experience"
              placeholder="Any prior experience with prediction markets, trading, or content creation"
              value={formData.previousExperience}
              onChange={(e) => setFormData({ ...formData, previousExperience: e.target.value })}
              className="min-h-[80px] resize-none"
            />
          </div>

          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <p className="text-sm font-medium text-foreground">Approval Criteria:</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>✓ 10,000+ followers strongly recommended</li>
              <li>✓ Clear description of expertise and goals</li>
              <li>✓ Verifiable social media presence</li>
              <li>✓ Compliance with platform terms and CFTC regulations</li>
            </ul>
          </div>

          <Button
            type="submit"
            className="w-full h-12 text-base"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Application'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};