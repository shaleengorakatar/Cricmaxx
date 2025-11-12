export interface PendingMarket {
  id: string;
  question: string;
  creator: string;
  creatorId: string;
  category: string;
  expiryTime: string;
  resolutionSource: string;
  submittedAt: string;
}

export interface AdminMarket {
  id: string;
  question: string;
  status: "open" | "closed" | "resolved";
  volume: number;
  expiryTime: string;
  outcome?: "yes" | "no" | "void";
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  signupDate: string;
  kycVerified: boolean;
  balance: number;
  role: "trader" | "creator" | "admin";
  isBanned: boolean;
  totalVolume: number;
}

export interface FraudAlert {
  id: string;
  userId: string;
  userName: string;
  alertType: "high_volume" | "multiple_withdrawals" | "suspicious_ip" | "rapid_trading";
  description: string;
  timestamp: string;
  severity: "low" | "medium" | "high";
  status: "pending" | "reviewed" | "resolved";
}

export interface RecentActivity {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  marketId?: string;
  amount?: number;
}

export interface PlatformStats {
  activeUsers: number;
  totalUsers: number;
  activeMarkets: number;
  totalMarkets: number;
  totalVolume: number;
  todayTrades: number;
  todayVolume: number;
  pendingApprovals: number;
}
