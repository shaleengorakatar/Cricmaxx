// Re-export from the centralized AuthContext
// This file exists for backwards compatibility with existing imports
export { useAuth, AuthProvider } from "@/contexts/AuthContext";
export type { UserProfile, UserRole } from "@/contexts/AuthContext";
