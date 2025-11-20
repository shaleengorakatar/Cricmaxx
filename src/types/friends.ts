export interface Friend {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  last_active_at: string;
  share_trades_with_friends: boolean;
  active_trades: number;
  win_rate: number;
  friendship_id: string;
}

export interface FriendRequest {
  id: string;
  user_id?: string;
  friend_id?: string;
  created_at: string;
  profiles: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface FriendTrade {
  id: string;
  side: 'yes' | 'no';
  size: number;
  entry_price: number;
  opened_at: string;
  user_id: string;
  market_id: string;
  profiles: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    share_trades_with_friends: boolean;
  };
  markets: {
    id: string;
    question: string;
    category: string;
    yes_price: number;
    no_price: number;
    volume: number;
    expiry_time: string;
    status: string;
  };
}

export interface SearchUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  friendship_status: 'none' | 'pending' | 'accepted' | 'blocked';
}

export interface InviteLink {
  invite_url: string;
  token: string;
  expires_at: string;
}
