import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Fingerprint, Mail, User, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";
import { useToast } from "@/hooks/use-toast";
import { PasswordRequirements, validatePassword } from "@/components/auth/PasswordRequirements";

const MobileAuth = () => {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const { isAvailable, authenticate } = useBiometricAuth();
  const { toast } = useToast();
  
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const handleBiometricAuth = async () => {
    const result = await authenticate();
    
    if (result.success) {
      toast({
        title: "Authentication successful",
        description: "Logging you in...",
      });
      navigate('/mobile');
    } else {
      toast({
        title: "Authentication failed",
        description: result.error || "Could not authenticate with biometrics",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(formData.email, formData.password);
        if (error) throw error;
        
        toast({
          title: "Welcome back!",
          description: "Logged in successfully",
        });
        navigate('/mobile');
      } else {
        // Validate password before signup
        const passwordValidation = validatePassword(formData.password);
        if (!passwordValidation.isValid) {
          toast({
            title: "Password doesn't meet requirements",
            description: passwordValidation.errors[0],
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        const { error } = await signUp(
          formData.email,
          formData.password,
          formData.name,
          'trader'
        );
        if (error) throw error;
        
        toast({
          title: "Account created!",
          description: "Welcome to CricMaxx! Start predicting.",
        });
      }
    } catch (error: any) {
      toast({
        title: isLogin ? "Login failed" : "Signup failed",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col p-4">
      <Button
        variant="ghost"
        onClick={() => navigate('/')}
        className="self-start mb-4"
      >
        <ArrowLeft className="h-5 w-5 mr-2" />
        Back
      </Button>

      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">
            CricMaxx 🏏
          </h1>
          <p className="text-muted-foreground">
            {isLogin ? 'Sign in to your account' : 'Create your account'}
          </p>
        </div>

        <Card className="p-6 mb-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <Label htmlFor="name" className="text-base">Full Name</Label>
                <div className="relative mt-2">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="pl-10 h-14 text-base"
                    required={!isLogin}
                  />
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="email" className="text-base">Email</Label>
              <div className="relative mt-2">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="pl-10 h-14 text-base"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password" className="text-base">Password</Label>
              <PasswordInput
                id="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="h-14 text-base mt-2"
                required
              />
              {!isLogin && <PasswordRequirements password={formData.password} />}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-14 text-base"
            >
              {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          {isLogin && isAvailable && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-card text-muted-foreground">Or</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleBiometricAuth}
                className="w-full h-14 text-base"
              >
                <Fingerprint className="h-5 w-5 mr-2" />
                Use Biometric Login
              </Button>
            </>
          )}
        </Card>

        <Button
          variant="ghost"
          onClick={() => setIsLogin(!isLogin)}
          className="text-base"
        >
          {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </Button>
      </div>
    </div>
  );
};

export default MobileAuth;
