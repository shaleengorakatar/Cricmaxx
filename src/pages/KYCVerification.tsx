import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const kycSchema = z.object({
  fullName: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  address: z.string().trim().min(10, "Please enter a complete address").max(500)
});

const KYCVerification = () => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    address: "",
    idDocument: null as File | null
  });
  const [dobDay, setDobDay] = useState("");
  const [dobMonth, setDobMonth] = useState("");
  const [dobYear, setDobYear] = useState("");
  
  // Generate year options (18 years ago to 100 years ago)
  const currentYear = new Date().getFullYear();
  const years = useMemo(() => {
    const arr = [];
    for (let y = currentYear - 18; y >= currentYear - 100; y--) {
      arr.push(y);
    }
    return arr;
  }, [currentYear]);
  
  const months = [
    { value: "01", label: "January" },
    { value: "02", label: "February" },
    { value: "03", label: "March" },
    { value: "04", label: "April" },
    { value: "05", label: "May" },
    { value: "06", label: "June" },
    { value: "07", label: "July" },
    { value: "08", label: "August" },
    { value: "09", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ];
  
  // Generate days based on selected month/year
  const days = useMemo(() => {
    const daysInMonth = dobMonth && dobYear 
      ? new Date(parseInt(dobYear), parseInt(dobMonth), 0).getDate()
      : 31;
    return Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, '0'));
  }, [dobMonth, dobYear]);
  
  // Combine to date string
  const dateOfBirth = dobYear && dobMonth && dobDay ? `${dobYear}-${dobMonth}-${dobDay}` : "";
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  // Redirect if already verified
  if (profile?.kyc_verified) {
    navigate('/dashboard');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Validate date of birth is complete
      if (!dateOfBirth) {
        toast({
          title: "Validation error",
          description: "Please select your complete date of birth",
          variant: "destructive",
        });
        return;
      }
      
      const validated = kycSchema.parse({ ...formData, dateOfBirth });
      setLoading(true);

      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in to submit KYC",
          variant: "destructive",
        });
        return;
      }

      // Submit KYC data
      const { error: kycError } = await supabase
        .from('kyc_submissions')
        .insert({
          user_id: user.id,
          full_name: validated.fullName,
          date_of_birth: dateOfBirth,
          address: validated.address,
          status: 'pending'
        });

      if (kycError) throw kycError;

      // Auto-verify for prototype (in production, admin would verify)
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ kyc_verified: true })
        .eq('id', user.id);

      if (updateError) throw updateError;

      toast({
        title: "Verification submitted!",
        description: "Your identity has been verified. You can now start trading.",
      });

      navigate('/dashboard');
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Submission failed",
          description: "Please try again later",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData({ ...formData, idDocument: e.target.files[0] });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center px-4 md:px-6">
          <div className="mx-auto mb-4 w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center">
            <ShieldCheck className="w-8 h-8 text-accent" />
          </div>
          <CardTitle className="text-xl md:text-2xl">Identity Verification</CardTitle>
          <CardDescription className="text-sm md:text-base">
            Shariz is a regulated platform and requires KYC (Know Your Customer) verification for all users as mandated by federal law.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 md:px-6">
          <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-sm md:text-base">Full Legal Name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="As shown on government ID"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="h-12 text-base"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm md:text-base">Date of Birth</Label>
              <div className="grid grid-cols-3 gap-2">
                <Select value={dobMonth} onValueChange={setDobMonth}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {months.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={dobDay} onValueChange={setDobDay}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Day" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {days.map((d) => (
                      <SelectItem key={d} value={d}>{parseInt(d)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={dobYear} onValueChange={setDobYear}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {years.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs md:text-sm text-muted-foreground">
                You must be 18 years or older to use Shariz
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address" className="text-sm md:text-base">Residential Address</Label>
              <Input
                id="address"
                type="text"
                placeholder="Street address, City, State, ZIP"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="h-12 text-base"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="idDocument" className="text-sm md:text-base">Government-Issued ID (Optional for demo)</Label>
              <Input
                id="idDocument"
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileChange}
                className="h-12 cursor-pointer"
              />
              <p className="text-xs md:text-sm text-muted-foreground">
                Upload a clear photo of your driver's license, passport, or national ID
              </p>
            </div>

            <div className="bg-muted/50 border border-border rounded-lg p-4">
              <h3 className="font-semibold mb-2 text-sm md:text-base">Why we need this information:</h3>
              <ul className="text-xs md:text-sm text-muted-foreground space-y-1">
                <li>• Federal regulations require identity verification for all traders</li>
                <li>• This helps prevent fraud and ensures platform security</li>
                <li>• Your information is encrypted and stored securely</li>
                <li>• Verification typically takes a few minutes</li>
              </ul>
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 text-base bg-accent text-accent-foreground hover:bg-accent/90 active:scale-95 transition-transform"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Verification'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default KYCVerification;
