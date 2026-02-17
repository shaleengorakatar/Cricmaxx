import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Share2, Twitter, Instagram, Link2, Download, Copy, CheckCircle2 } from "lucide-react";
import { Market } from "@/types/market";

interface SocialShareButtonsProps {
  market: Market;
}

const SocialShareButtons = ({ market }: SocialShareButtonsProps) => {
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  const marketUrl = `https://cricmaxx.com/market/${market.id}`;
  
  const shareText = `🎯 ${market.question}\n\n📊 YES: $${market.yesPrice.toFixed(2)} | NO: $${market.noPrice.toFixed(2)}\n💰 Volume: $${market.volume.toLocaleString()}\n\nMake your prediction now on CricMaxx!\n\n🔑 Use invite code WC26 to join`;

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(marketUrl)}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(marketUrl);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleTwitterShare = () => {
    window.open(twitterUrl, '_blank', 'noopener,noreferrer,width=600,height=400');
  };

  const handleInstagramShare = () => {
    // Instagram doesn't support direct URL sharing, show preview for screenshot
    setShowPreview(true);
  };

  const generateShareGraphic = () => {
    // This creates a visual representation for Instagram stories
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return null;

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 1920);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#16213e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1080, 1920);

    // Card background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.roundRect(60, 400, 960, 800, 40);
    ctx.fill();

    // Question text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    
    const words = market.question.split(' ');
    let lines: string[] = [];
    let currentLine = '';
    
    words.forEach(word => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(testLine).width > 880) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });
    if (currentLine) lines.push(currentLine);

    lines.forEach((line, i) => {
      ctx.fillText(line, 540, 520 + (i * 60));
    });

    // Prices
    const priceY = 520 + (lines.length * 60) + 80;
    
    // YES box
    ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
    ctx.roundRect(90, priceY, 420, 120, 20);
    ctx.fill();
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 32px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('YES', 300, priceY + 45);
    ctx.font = 'bold 48px system-ui';
    ctx.fillText(`$${market.yesPrice.toFixed(2)}`, 300, priceY + 95);

    // NO box
    ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
    ctx.roundRect(570, priceY, 420, 120, 20);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 32px system-ui';
    ctx.fillText('NO', 780, priceY + 45);
    ctx.font = 'bold 48px system-ui';
    ctx.fillText(`$${market.noPrice.toFixed(2)}`, 780, priceY + 95);

    // Volume
    ctx.fillStyle = '#9ca3af';
    ctx.font = '28px system-ui';
    ctx.fillText(`$${market.volume.toLocaleString()} Volume`, 540, priceY + 200);

    // CTA
    ctx.fillStyle = '#8b5cf6';
    ctx.font = 'bold 36px system-ui';
    ctx.fillText('Predict Now!', 540, priceY + 300);

    return canvas.toDataURL('image/png');
  };

  const handleDownloadGraphic = () => {
    const dataUrl = generateShareGraphic();
    if (!dataUrl) {
      toast.error("Failed to generate graphic");
      return;
    }

    const link = document.createElement('a');
    link.download = `prediction-${market.id.slice(0, 8)}.png`;
    link.href = dataUrl;
    link.click();
    toast.success("Image downloaded! Share it on Instagram");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Share2 className="h-4 w-4" />
            Share
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={handleTwitterShare} className="gap-2 cursor-pointer">
            <Twitter className="h-4 w-4" />
            Share on X (Twitter)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleInstagramShare} className="gap-2 cursor-pointer">
            <Instagram className="h-4 w-4" />
            Share on Instagram
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleCopyLink} className="gap-2 cursor-pointer">
            {copied ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Link2 className="h-4 w-4" />}
            {copied ? "Copied!" : "Copy Link"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDownloadGraphic} className="gap-2 cursor-pointer">
            <Download className="h-4 w-4" />
            Download Graphic
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Instagram Share Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Share to Instagram</DialogTitle>
            <DialogDescription>
              Download this graphic and share it to your Instagram story or post
            </DialogDescription>
          </DialogHeader>
          
          {/* Preview Card */}
          <div className="bg-gradient-to-b from-slate-900 to-slate-800 rounded-lg p-6 text-white space-y-4">
            <div className="bg-white/10 rounded-lg p-4">
              <p className="font-semibold text-center mb-4">{market.question}</p>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-success/20 rounded-lg p-3 text-center">
                  <p className="text-xs text-success mb-1">YES</p>
                  <p className="text-xl font-bold text-success">${market.yesPrice.toFixed(2)}</p>
                </div>
                <div className="bg-destructive/20 rounded-lg p-3 text-center">
                  <p className="text-xs text-destructive mb-1">NO</p>
                  <p className="text-xl font-bold text-destructive">${market.noPrice.toFixed(2)}</p>
                </div>
              </div>
              
              <p className="text-center text-sm text-muted-foreground mt-3">
                ${market.volume.toLocaleString()} Volume
              </p>
            </div>
            
            <p className="text-center font-semibold" style={{ color: 'hsl(var(--primary))' }}>Predict Now!</p>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleDownloadGraphic} className="flex-1 gap-2">
              <Download className="h-4 w-4" />
              Download Image
            </Button>
            <Button variant="outline" onClick={handleCopyLink} className="gap-2">
              <Copy className="h-4 w-4" />
              Copy Link
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SocialShareButtons;