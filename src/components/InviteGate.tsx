import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles } from "lucide-react";
import cricmaxxLogo from "@/assets/cricmaxx-logo.webp";

const INVITE_CODE = "WC26";
const STORAGE_KEY = "cricmaxx_invite_verified";

interface InviteGateProps {
  children: React.ReactNode;
}

export const useInviteAccess = () => {
  const isVerified = localStorage.getItem(STORAGE_KEY) === "true";
  return { isVerified };
};

const InviteGate = ({ children }: InviteGateProps) => {
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [verified, setVerified] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === "true";
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (code.toUpperCase().trim() === INVITE_CODE) {
      localStorage.setItem(STORAGE_KEY, "true");
      setVerified(true);
      setError(false);
    } else {
      setError(true);
    }
  };

  if (verified) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-md border-primary/20 shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto">
            <img 
              src={cricmaxxLogo} 
              alt="CricMaxx" 
              className="h-20 w-auto mx-auto"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              <CardTitle className="text-xl">Closed Beta</CardTitle>
            </div>
            <CardDescription className="text-base">
              Welcome to CricMaxx! This is an invite-only testing phase.
              <br />
              Please enter your invitation code to continue.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Enter invitation code"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setError(false);
                }}
                className={`h-12 text-center text-lg tracking-widest uppercase ${
                  error ? "border-destructive focus-visible:ring-destructive" : ""
                }`}
                autoFocus
              />
              {error && (
                <p className="text-sm text-destructive text-center">
                  Invalid invitation code. Please try again.
                </p>
              )}
            </div>
            <Button 
              type="submit" 
              className="w-full h-12 text-base"
              disabled={!code.trim()}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Enter CricMaxx
            </Button>
          </form>
          <p className="text-xs text-muted-foreground text-center mt-6">
            Don't have a code? Contact us at{" "}
            <a href="mailto:support@cricmaxx.com" className="text-primary hover:underline">
              support@cricmaxx.com
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default InviteGate;
