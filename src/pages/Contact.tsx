import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, MessageSquare, FileText, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

const Contact = () => {
  const [subject, setSubject] = useState("");
  const [issueType, setIssueType] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!issueType || !description.trim()) {
      toast({
        title: "Missing information",
        description: "Please select an issue type and provide a description.",
        variant: "destructive",
      });
      return;
    }

    const emailSubject = `[${issueType}] ${subject || "Support Request"}`;
    const emailBody = `Issue Type: ${issueType}\n\nDescription:\n${description}\n\n---\nPlease attach any relevant screenshots or files to this email.`;
    
    const mailtoLink = `mailto:support@cricmaxx.com?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    
    window.location.href = mailtoLink;
    
    toast({
      title: "Opening email client",
      description: "Your default email app should open with the message pre-filled.",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <Card className="border-border">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Contact Support</CardTitle>
            <CardDescription>
              Have an issue or question? Fill out the form below and we'll get back to you as soon as possible.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="issueType">Issue Type *</Label>
                <Select value={issueType} onValueChange={setIssueType}>
                  <SelectTrigger id="issueType">
                    <SelectValue placeholder="Select issue type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Account Issue">Account Issue</SelectItem>
                    <SelectItem value="Trading Problem">Trading Problem</SelectItem>
                    <SelectItem value="Deposit/Withdrawal">Deposit/Withdrawal</SelectItem>
                    <SelectItem value="Technical Bug">Technical Bug</SelectItem>
                    <SelectItem value="Market Resolution">Market Resolution</SelectItem>
                    <SelectItem value="Feature Request">Feature Request</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject (Optional)</Label>
                <Input
                  id="subject"
                  placeholder="Brief summary of your issue"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Please describe your issue in detail. Include any relevant information like transaction IDs, market names, or error messages."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  className="resize-none"
                />
              </div>

              <div className="bg-muted/50 rounded-lg p-4 border border-border">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-foreground">Need to attach files?</p>
                    <p className="text-muted-foreground">
                      Click the button below to open your email app where you can attach screenshots, documents, or other files.
                    </p>
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full" size="lg">
                <Mail className="h-4 w-4 mr-2" />
                Open Email to Send
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                This will open your default email app with the message pre-filled.
                <br />
                Email: <span className="font-medium text-foreground">support@cricmaxx.com</span>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Contact;
