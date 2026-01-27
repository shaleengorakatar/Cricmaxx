import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, Clock, ExternalLink, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CreatorApplication {
  id: string;
  user_id: string;
  description: string;
  follower_count: number;
  social_media_platform: string;
  social_media_handle: string;
  creator_type: string | null;
  previous_experience: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  created_at: string;
  profiles: {
    name: string;
    email: string;
  };
}

const CREATOR_TYPE_LABELS: Record<string, string> = {
  cricket_analyst: "Cricket Analyst",
  sports_commentator: "Sports Commentator",
  sports_journalist: "Sports Journalist",
  fantasy_sports: "Fantasy Sports Expert",
  betting_tipster: "Betting Tipster",
  influencer: "Sports Influencer",
  podcaster: "Sports Podcaster",
  youtuber: "Sports YouTuber",
  streamer: "Live Streamer",
  other: "Other",
};

export const CreatorApplicationsPanel = () => {
  const [applications, setApplications] = useState<CreatorApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<CreatorApplication | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('creator_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching applications:', error);
      toast({
        title: "Error",
        description: "Failed to load applications",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Fetch profile data for each application
    const applicationsWithProfiles = await Promise.all(
      (data || []).map(async (app) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, email')
          .eq('id', app.user_id)
          .single();
        
        return {
          ...app,
          profiles: profile || { name: 'Unknown', email: 'Unknown' }
        } as CreatorApplication;
      })
    );

    setApplications(applicationsWithProfiles);
    setLoading(false);
  };

  const meetsApprovalCriteria = (app: CreatorApplication) => {
    return {
      hasFollowers: app.follower_count >= 10000,
      hasDescription: app.description.length >= 50,
      hasVerifiableHandle: app.social_media_handle.length >= 2,
      overallScore: (
        (app.follower_count >= 10000 ? 1 : 0) +
        (app.description.length >= 50 ? 1 : 0) +
        (app.social_media_handle.length >= 2 ? 1 : 0) +
        (app.previous_experience ? 1 : 0)
      ),
    };
  };

  const handleReview = async (appId: string, status: 'approved' | 'rejected') => {
    setProcessing(true);
    const app = applications.find(a => a.id === appId);
    
    if (!app) return;

    try {
      // Update application status
      const { error: updateError } = await supabase
        .from('creator_applications')
        .update({
          status,
          admin_notes: adminNotes || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', appId);

      if (updateError) throw updateError;

      // If approved, add creator role to user
      if (status === 'approved') {
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: app.user_id,
            role: 'creator',
          });

        if (roleError && roleError.code !== '23505') { // Ignore duplicate key error
          throw roleError;
        }
      }

      toast({
        title: status === 'approved' ? "Application approved!" : "Application rejected",
        description: status === 'approved' 
          ? "User has been granted creator access" 
          : "Application has been rejected",
      });

      setSelectedApp(null);
      setAdminNotes("");
      fetchApplications();
    } catch (error) {
      console.error('Error reviewing application:', error);
      toast({
        title: "Error",
        description: "Failed to process application",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <Card><CardContent className="py-8 text-center text-muted-foreground">Loading applications...</CardContent></Card>;
  }

  const pendingApps = applications.filter(a => a.status === 'pending');
  const reviewedApps = applications.filter(a => a.status !== 'pending');

  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-accent" />
              Pending Creator Applications ({pendingApps.length})
            </CardTitle>
            <CardDescription>
              Review applications and approve creators who meet the criteria
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pendingApps.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No pending applications</p>
            ) : (
              <div className="space-y-4">
                {pendingApps.map((app) => {
                  const criteria = meetsApprovalCriteria(app);
                  return (
                    <Card key={app.id} className="border-l-4 border-l-yellow-500">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-semibold text-foreground">{app.profiles.name}</h3>
                            <p className="text-sm text-muted-foreground">{app.profiles.email}</p>
                          </div>
                          <Badge variant="secondary">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        </div>
                        
                        <div className="space-y-2 mb-3">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium">Platform:</span>
                            <span className="text-muted-foreground capitalize">{app.social_media_platform}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium">Handle:</span>
                            <span className="text-muted-foreground">{app.social_media_handle}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium">Followers:</span>
                            <span className={criteria.hasFollowers ? "text-green-600 font-semibold" : "text-muted-foreground"}>
                              {app.follower_count.toLocaleString()}
                              {criteria.hasFollowers && " ✓"}
                            </span>
                          </div>
                          {app.creator_type && (
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-medium">Creator Type:</span>
                              <Badge variant="outline" className="text-xs">
                                {CREATOR_TYPE_LABELS[app.creator_type] || app.creator_type}
                              </Badge>
                            </div>
                          )}
                        </div>

                        <div className="bg-muted/50 p-3 rounded text-sm mb-3">
                          <p className="font-medium mb-1">Description:</p>
                          <p className="text-muted-foreground line-clamp-2">{app.description}</p>
                        </div>

                        <div className="bg-muted/30 p-2 rounded mb-3">
                          <p className="text-xs font-medium mb-1">Approval Checklist:</p>
                          <div className="grid grid-cols-2 gap-1 text-xs">
                            <div className={criteria.hasFollowers ? "text-green-600" : "text-muted-foreground"}>
                              {criteria.hasFollowers ? "✓" : "✗"} 10,000+ followers
                            </div>
                            <div className={criteria.hasDescription ? "text-green-600" : "text-muted-foreground"}>
                              {criteria.hasDescription ? "✓" : "✗"} Valid description
                            </div>
                            <div className={criteria.hasVerifiableHandle ? "text-green-600" : "text-muted-foreground"}>
                              {criteria.hasVerifiableHandle ? "✓" : "✗"} Social handle
                            </div>
                            <div className={app.previous_experience ? "text-green-600" : "text-muted-foreground"}>
                              {app.previous_experience ? "✓" : "✗"} Experience noted
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Score: {criteria.overallScore}/4
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              setSelectedApp(app);
                              setAdminNotes("");
                            }}
                          >
                            Review Application
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {reviewedApps.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Reviewed Applications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {reviewedApps.map((app) => (
                  <div key={app.id} className="flex items-center justify-between p-3 bg-muted/30 rounded">
                    <div>
                      <p className="font-medium text-sm">{app.profiles.name}</p>
                      <p className="text-xs text-muted-foreground">{app.social_media_handle}</p>
                    </div>
                    <Badge variant={app.status === 'approved' ? 'default' : 'destructive'}>
                      {app.status === 'approved' ? (
                        <><CheckCircle2 className="h-3 w-3 mr-1" /> Approved</>
                      ) : (
                        <><XCircle className="h-3 w-3 mr-1" /> Rejected</>
                      )}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!selectedApp} onOpenChange={() => setSelectedApp(null)}>
        <DialogContent className="max-w-lg sm:max-w-2xl max-h-[85vh] overflow-y-auto mx-4 sm:mx-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Review Application</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Review and approve or reject this creator application
            </DialogDescription>
          </DialogHeader>
          
          {selectedApp && (
            <div className="space-y-3 sm:space-y-4">
              <div className="bg-muted/50 rounded-lg p-3">
                <h3 className="font-semibold text-sm mb-1">Applicant</h3>
                <p className="text-sm">{selectedApp.profiles.name}</p>
                <p className="text-xs text-muted-foreground truncate">{selectedApp.profiles.email}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-lg p-3">
                  <h3 className="font-semibold text-xs mb-1">Platform</h3>
                  <p className="text-sm capitalize">{selectedApp.social_media_platform}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <h3 className="font-semibold text-xs mb-1">Followers</h3>
                  <p className="text-sm font-medium">{selectedApp.follower_count.toLocaleString()}</p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-sm mb-1">Handle</h3>
                <p className="text-sm text-muted-foreground">{selectedApp.social_media_handle}</p>
              </div>

              {selectedApp.creator_type && (
                <div>
                  <h3 className="font-semibold text-sm mb-1">Creator Type</h3>
                  <Badge variant="secondary">
                    {CREATOR_TYPE_LABELS[selectedApp.creator_type] || selectedApp.creator_type}
                  </Badge>
                </div>
              )}

              <div>
                <h3 className="font-semibold text-sm mb-1">Description</h3>
                <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4 sm:line-clamp-none">{selectedApp.description}</p>
              </div>

              {selectedApp.previous_experience && (
                <div>
                  <h3 className="font-semibold text-sm mb-1">Experience</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3 sm:line-clamp-none">{selectedApp.previous_experience}</p>
                </div>
              )}

              <div>
                <Label htmlFor="admin-notes" className="text-sm">Admin Notes</Label>
                <Textarea
                  id="admin-notes"
                  placeholder="Add notes..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="mt-1.5 min-h-[60px]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="default"
                  className="flex-1 h-11"
                  onClick={() => handleReview(selectedApp.id, 'approved')}
                  disabled={processing}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 h-11"
                  onClick={() => handleReview(selectedApp.id, 'rejected')}
                  disabled={processing}
                >
                  <XCircle className="h-4 w-4 mr-1.5" />
                  Reject
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};