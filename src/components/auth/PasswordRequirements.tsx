import { Check, X } from "lucide-react";
import { useMemo } from "react";

interface PasswordRequirementsProps {
  password: string;
  showRequirements?: boolean;
}

interface Requirement {
  label: string;
  test: (password: string) => boolean;
}

const requirements: Requirement[] = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "One uppercase letter (A-Z)", test: (p) => /[A-Z]/.test(p) },
  { label: "One lowercase letter (a-z)", test: (p) => /[a-z]/.test(p) },
  { label: "One number (0-9)", test: (p) => /[0-9]/.test(p) },
  { label: "One special character (!@#$%^&*)", test: (p) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
];

export const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (password.length < 8) errors.push("Password must be at least 8 characters");
  if (!/[A-Z]/.test(password)) errors.push("Password must contain an uppercase letter");
  if (!/[a-z]/.test(password)) errors.push("Password must contain a lowercase letter");
  if (!/[0-9]/.test(password)) errors.push("Password must contain a number");
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push("Password must contain a special character");
  
  return { isValid: errors.length === 0, errors };
};

export const PasswordRequirements = ({ password, showRequirements = true }: PasswordRequirementsProps) => {
  const results = useMemo(() => {
    return requirements.map((req) => ({
      ...req,
      met: req.test(password),
    }));
  }, [password]);

  const allMet = results.every((r) => r.met);
  const anyTyped = password.length > 0;

  if (!showRequirements || (!anyTyped && !showRequirements)) {
    return null;
  }

  return (
    <div className="space-y-2 mt-2 p-3 rounded-lg bg-muted/50 border border-border">
      <p className="text-xs font-medium text-muted-foreground mb-2">Password must contain:</p>
      <ul className="space-y-1.5">
        {results.map((req, index) => (
          <li
            key={index}
            className={`flex items-center gap-2 text-xs transition-colors ${
              req.met ? "text-accent" : "text-muted-foreground"
            }`}
          >
            {req.met ? (
              <Check className="h-3.5 w-3.5 text-accent" />
            ) : (
              <X className="h-3.5 w-3.5 text-muted-foreground/50" />
            )}
            <span>{req.label}</span>
          </li>
        ))}
      </ul>
      {anyTyped && allMet && (
        <p className="text-xs text-accent font-medium mt-2 flex items-center gap-1">
          <Check className="h-3.5 w-3.5" />
          Password meets all requirements!
        </p>
      )}
    </div>
  );
};

export default PasswordRequirements;
