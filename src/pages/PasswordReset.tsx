import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { z } from "zod";

const resetSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters").max(100),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const PasswordReset = () => {
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validated = resetSchema.parse({ password, confirmPassword });
      setLoading(true);

      const { error } = await supabase.auth.updateUser({
        password: validated.password
      });

      if (error) {
        toast({
          title: "Reset failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Password updated!",
        description: "Your password has been successfully changed.",
      });
      
      navigate('/dashboard');
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center px-4 md:px-6">
          <CardTitle className="text-2xl md:text-3xl font-bold text-primary">Reset Password</CardTitle>
          <CardDescription className="text-sm md:text-base">
            Enter your new password below
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 md:px-6">
          <form onSubmit={handleReset} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm md:text-base">New Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 text-base"
                required
              />
              <p className="text-xs md:text-sm text-muted-foreground">
                Must be at least 8 characters
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-sm md:text-base">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-12 text-base"
                required
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-12 text-base active:scale-95 transition-transform"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Updating password...
                </>
              ) : (
                'Update Password'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default PasswordReset;
