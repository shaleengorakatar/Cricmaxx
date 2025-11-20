import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link2, Copy, Check } from "lucide-react";
import { useFriends } from "@/hooks/useFriends";
import { toast } from "sonner";

const InviteLinkGenerator = () => {
  const [inviteUrl, setInviteUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { generateInviteLink } = useFriends();

  const handleGenerate = async () => {
    setGenerating(true);
    const invite = await generateInviteLink();
    setGenerating(false);

    if (invite) {
      setInviteUrl(invite.invite_url);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success("Invite link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy link");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Link2 className="w-5 h-5" />
          Invite a Friend
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Generate a unique invite link to share with friends
        </p>

        {!inviteUrl ? (
          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {generating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Generating...
              </>
            ) : (
              'Generate Invite Link'
            )}
          </Button>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={inviteUrl}
                readOnly
                className="flex-1 text-sm"
              />
              <Button
                onClick={handleCopy}
                size="sm"
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {copied ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              This link expires in 7 days
            </p>
            <Button
              onClick={handleGenerate}
              variant="outline"
              size="sm"
              className="w-full"
            >
              Generate New Link
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InviteLinkGenerator;
