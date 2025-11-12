import { Card } from "@/components/ui/card";
import { AlertCircle, DollarSign, Shield, CheckCircle } from "lucide-react";

const CreatorGuidance = () => {
  return (
    <Card className="p-4 md:p-6">
      <h3 className="text-base md:text-lg font-semibold text-foreground mb-4">Creator Guidelines</h3>
      
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-foreground text-sm mb-1">CFTC Compliance</h4>
            <p className="text-xs text-muted-foreground">
              All markets are fixed-payout $1 contracts under CFTC regulations. 
              Only use approved templates and real, verifiable events.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-foreground text-sm mb-1">Admin Approval Required</h4>
            <p className="text-xs text-muted-foreground">
              All markets must be approved by Shariz admins before going live. 
              This ensures quality and compliance standards.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <DollarSign className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-foreground text-sm mb-1">Fee Structure</h4>
            <p className="text-xs text-muted-foreground">
              Creators earn 2% of trading volume as commission. Platform fee is 3%. 
              You'll see earnings update in real-time as trades occur.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-foreground text-sm mb-1">Best Practices</h4>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>Use clear, unambiguous question wording</li>
              <li>Specify reliable resolution sources</li>
              <li>Set appropriate expiry dates (event start time)</li>
              <li>Choose events with publicly verifiable outcomes</li>
            </ul>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default CreatorGuidance;
