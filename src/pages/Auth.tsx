import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { PasswordRequirements, validatePassword } from "@/components/auth/PasswordRequirements";
import cricmaxxLogo from "@/assets/cricmaxx-logo.webp";

// Custom password validation
const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .max(100)
  .refine((p) => /[A-Z]/.test(p), "Password must contain an uppercase letter")
  .refine((p) => /[a-z]/.test(p), "Password must contain a lowercase letter")
  .refine((p) => /[0-9]/.test(p), "Password must contain a number")
  .refine((p) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p), "Password must contain a special character");

const signUpSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  username: z.string().trim().min(3, "Username must be at least 3 characters").max(30).regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  email: z.string().trim().email("Invalid email address").max(255),
  password: passwordSchema,
  accountType: z.enum(['trader', 'creator'])
});

const signInSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(1, "Password is required")
});

const Auth = () => {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('mode') === 'signup' ? 'signup' : 'login');
  const [loading, setLoading] = useState(false);
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();
  const { signUp, signIn, isAuthenticated, profile } = useAuth();

  // Sign up form
  const [signUpData, setSignUpData] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    accountType: "trader" as 'trader' | 'creator'
  });

  // Sign in form
  const [signInData, setSignInData] = useState({
    email: "",
    password: ""
  });

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && profile) {
      const redirect = searchParams.get('redirect');
      if (redirect) {
        navigate(redirect);
      } else {
        navigate('/dashboard');
      }
    }
  }, [isAuthenticated, profile, navigate, searchParams]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validated = signUpSchema.parse(signUpData);
      setLoading(true);

      // Check if username is already taken
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', validated.username.toLowerCase())
        .single();

      if (existingUser) {
        toast({
          title: "Username taken",
          description: "This username is already in use. Please choose another.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const { data, error } = await signUp(
        validated.email,
        validated.password,
        validated.name,
        validated.accountType
      );

      if (error) {
        if (error.message.includes('already registered')) {
          toast({
            title: "Email already in use",
            description: "This email is already registered. Please sign in instead.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Sign up failed",
            description: error.message,
            variant: "destructive",
          });
        }
        return;
      }

      if (data.user) {
        // Update profile with username
        await supabase
          .from('profiles')
          .update({ username: validated.username.toLowerCase() })
          .eq('id', data.user.id);

        toast({
          title: "Account created!",
          description: "Welcome to CricMaxx. Start predicting!",
        });
      }
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

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validated = signInSchema.parse(signInData);
      setLoading(true);

      const { data, error } = await signIn(validated.email, validated.password);

      if (error) {
        toast({
          title: "Login failed",
          description: error.message === "Invalid login credentials" 
            ? "Incorrect email or password" 
            : error.message,
          variant: "destructive",
        });
        return;
      }

      if (data.user) {
        // Check if user has MFA enabled (simulated)
        const userProfile = await fetchUserProfile(data.user.id);
        
        if (userProfile?.mfa_enabled) {
          setMfaStep(true);
        } else {
          toast({
            title: "Welcome back!",
            description: "Successfully signed in to CricMaxx.",
          });
          // Will redirect via useEffect
        }
      }
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

  const fetchUserProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('mfa_enabled')
      .eq('id', userId)
      .single();
    return data;
  };

  const handleMfaVerify = () => {
    // Simulate MFA verification (accept any code for prototype)
    if (mfaCode.length === 6) {
      toast({
        title: "Verified!",
        description: "Two-factor authentication successful.",
      });
      setMfaStep(false);
      // Will redirect via useEffect
    } else {
      toast({
        title: "Invalid code",
        description: "Please enter a 6-digit code.",
        variant: "destructive",
      });
    }
  };

  if (mfaStep) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="px-4 md:px-6">
            <CardTitle className="text-xl md:text-2xl">Two-Factor Authentication</CardTitle>
            <CardDescription className="text-sm md:text-base">
              Enter the 6-digit code from your authenticator app or email
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-4 md:px-6">
            <div className="space-y-2">
              <Label htmlFor="mfa-code" className="text-sm md:text-base">Verification Code</Label>
              <Input
                id="mfa-code"
                type="text"
                maxLength={6}
                placeholder="123456"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                className="h-12 text-center text-2xl tracking-widest"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                onClick={handleMfaVerify}
                className="flex-1 h-12 active:scale-95 transition-transform"
                disabled={mfaCode.length !== 6}
              >
                Verify
              </Button>
              <Button 
                variant="outline"
                onClick={() => setMfaStep(false)}
                className="flex-1 h-12 active:scale-95 transition-transform"
              >
                Skip for now
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {/* Back button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => navigate(-1)}
        className="absolute top-4 left-4 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>
      
      <Card className="w-full max-w-md">
        <CardHeader className="text-center px-4 md:px-6">
          <img 
            src={cricmaxxLogo} 
            alt="CricMaxx" 
            className="h-24 w-auto mx-auto -mb-2"
          />
          <CardDescription className="text-base">Fast. Live. Fun.</CardDescription>
        </CardHeader>
        <CardContent className="px-4 md:px-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 h-12">
              <TabsTrigger value="login" className="text-sm md:text-base">Login</TabsTrigger>
              <TabsTrigger value="signup" className="text-sm md:text-base">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleSignIn} className="space-y-4 mt-6">
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="text-sm md:text-base">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@example.com"
                    value={signInData.email}
                    onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                    className="h-12 text-base"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password" className="text-sm md:text-base">Password</Label>
                  <PasswordInput
                    id="login-password"
                    placeholder="••••••••"
                    value={signInData.password}
                    onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                    className="h-12 text-base"
                    required
                  />
                </div>
                <div className="flex justify-end">
                  <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <Button 
                  type="submit" 
                  className="w-full h-12 text-base active:scale-95 transition-transform"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4 mt-6">
                <div className="space-y-2">
                  <Label htmlFor="signup-name" className="text-sm md:text-base">Full Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="John Doe"
                    value={signUpData.name}
                    onChange={(e) => setSignUpData({ ...signUpData, name: e.target.value })}
                    className="h-12 text-base"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-username" className="text-sm md:text-base">Username</Label>
                  <Input
                    id="signup-username"
                    type="text"
                    placeholder="johndoe"
                    value={signUpData.username}
                    onChange={(e) => setSignUpData({ ...signUpData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                    className="h-12 text-base"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Letters, numbers, and underscores only
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email" className="text-sm md:text-base">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    value={signUpData.email}
                    onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                    className="h-12 text-base"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password" className="text-sm md:text-base">Password</Label>
                  <PasswordInput
                    id="signup-password"
                    placeholder="••••••••"
                    value={signUpData.password}
                    onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                    className="h-12 text-base"
                    required
                  />
                  <PasswordRequirements password={signUpData.password} />
                </div>
                <Button 
                  type="submit" 
                  className="w-full h-12 text-base bg-accent text-accent-foreground hover:bg-accent/90 active:scale-95 transition-transform"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    'Create Account'
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
