export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      cache_metadata: {
        Row: {
          cache_key: string
          cache_type: string
          last_updated: string
          metadata: Json | null
          ttl_seconds: number
        }
        Insert: {
          cache_key: string
          cache_type: string
          last_updated?: string
          metadata?: Json | null
          ttl_seconds?: number
        }
        Update: {
          cache_key?: string
          cache_type?: string
          last_updated?: string
          metadata?: Json | null
          ttl_seconds?: number
        }
        Relationships: []
      }
      creator_applications: {
        Row: {
          admin_notes: string | null
          created_at: string
          creator_type: string | null
          description: string
          follower_count: number
          id: string
          previous_experience: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          social_media_handle: string
          social_media_platform: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          creator_type?: string | null
          description: string
          follower_count: number
          id?: string
          previous_experience?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          social_media_handle: string
          social_media_platform: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          creator_type?: string | null
          description?: string
          follower_count?: number
          id?: string
          previous_experience?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          social_media_handle?: string
          social_media_platform?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      distributed_cache: {
        Row: {
          cache_key: string
          cache_type: string
          created_at: string
          data: Json
          expires_at: string
          updated_at: string
        }
        Insert: {
          cache_key: string
          cache_type: string
          created_at?: string
          data: Json
          expires_at: string
          updated_at?: string
        }
        Update: {
          cache_key?: string
          cache_type?: string
          created_at?: string
          data?: Json
          expires_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_notifications: {
        Row: {
          email_type: string
          id: string
          metadata: Json | null
          sent_at: string
          subject: string
          user_id: string
        }
        Insert: {
          email_type: string
          id?: string
          metadata?: Json | null
          sent_at?: string
          subject: string
          user_id: string
        }
        Update: {
          email_type?: string
          id?: string
          metadata?: Json | null
          sent_at?: string
          subject?: string
          user_id?: string
        }
        Relationships: []
      }
      fraud_alerts: {
        Row: {
          actual_value: number | null
          alert_type: string
          created_at: string
          description: string
          id: string
          metadata: Json | null
          resolution_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string
          status: string
          threshold_value: number | null
          time_window_hours: number | null
          user_id: string
        }
        Insert: {
          actual_value?: number | null
          alert_type: string
          created_at?: string
          description: string
          id?: string
          metadata?: Json | null
          resolution_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity: string
          status?: string
          threshold_value?: number | null
          time_window_hours?: number | null
          user_id: string
        }
        Update: {
          actual_value?: number | null
          alert_type?: string
          created_at?: string
          description?: string
          id?: string
          metadata?: Json | null
          resolution_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          status?: string
          threshold_value?: number | null
          time_window_hours?: number | null
          user_id?: string
        }
        Relationships: []
      }
      fraud_thresholds: {
        Row: {
          alert_type: string
          created_at: string
          description: string
          enabled: boolean
          id: string
          severity: string
          threshold_value: number
          time_window_hours: number
          updated_at: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          description: string
          enabled?: boolean
          id?: string
          severity: string
          threshold_value: number
          time_window_hours: number
          updated_at?: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          severity?: string
          threshold_value?: number
          time_window_hours?: number
          updated_at?: string
        }
        Relationships: []
      }
      friend_invite_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
          used_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          token: string
          used_at?: string | null
          used_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          used_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friend_invite_tokens_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "friend_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_invite_tokens_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "leaderboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_invite_tokens_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "mv_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_invite_tokens_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_invite_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "friend_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_invite_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_invite_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "mv_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_invite_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "friend_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "mv_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "friend_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "mv_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_keys: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          idempotency_key: string
          operation_type: string
          request_hash: string
          response_data: Json | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          idempotency_key: string
          operation_type: string
          request_hash: string
          response_data?: Json | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          idempotency_key?: string
          operation_type?: string
          request_hash?: string
          response_data?: Json | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      kyc_access_log: {
        Row: {
          access_type: string
          accessed_at: string
          accessed_by: string
          id: string
          ip_address: string | null
          kyc_submission_id: string | null
          user_agent: string | null
        }
        Insert: {
          access_type: string
          accessed_at?: string
          accessed_by: string
          id?: string
          ip_address?: string | null
          kyc_submission_id?: string | null
          user_agent?: string | null
        }
        Update: {
          access_type?: string
          accessed_at?: string
          accessed_by?: string
          id?: string
          ip_address?: string | null
          kyc_submission_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kyc_access_log_kyc_submission_id_fkey"
            columns: ["kyc_submission_id"]
            isOneToOne: false
            referencedRelation: "kyc_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_submissions: {
        Row: {
          address: string
          date_of_birth: string
          full_name: string
          id: string
          id_document_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          submitted_at: string | null
          user_id: string
        }
        Insert: {
          address: string
          date_of_birth: string
          full_name: string
          id?: string
          id_document_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          submitted_at?: string | null
          user_id: string
        }
        Update: {
          address?: string
          date_of_birth?: string
          full_name?: string
          id?: string
          id_document_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          submitted_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      market_oracle_rules: {
        Row: {
          comparison_operator: string
          created_at: string
          data_source_url: string
          entity_id: string
          entity_name: string
          entity_type: string
          event_template: string
          id: string
          market_id: string
          match_date: string
          match_id: string
          match_name: string
          outcome_if_false: string
          outcome_if_true: string
          resolution_error: string | null
          resolution_status: string
          resolution_value: number | null
          resolved_at: string | null
          stat_field: string
          threshold_value: number
          updated_at: string
        }
        Insert: {
          comparison_operator: string
          created_at?: string
          data_source_url: string
          entity_id: string
          entity_name: string
          entity_type: string
          event_template: string
          id?: string
          market_id: string
          match_date: string
          match_id: string
          match_name: string
          outcome_if_false: string
          outcome_if_true: string
          resolution_error?: string | null
          resolution_status?: string
          resolution_value?: number | null
          resolved_at?: string | null
          stat_field: string
          threshold_value: number
          updated_at?: string
        }
        Update: {
          comparison_operator?: string
          created_at?: string
          data_source_url?: string
          entity_id?: string
          entity_name?: string
          entity_type?: string
          event_template?: string
          id?: string
          market_id?: string
          match_date?: string
          match_id?: string
          match_name?: string
          outcome_if_false?: string
          outcome_if_true?: string
          resolution_error?: string | null
          resolution_status?: string
          resolution_value?: number | null
          resolved_at?: string | null
          stat_field?: string
          threshold_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_oracle_rules_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_oracle_rules_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "mv_market_stats"
            referencedColumns: ["market_id"]
          },
        ]
      }
      market_resolution_log: {
        Row: {
          action: string
          api_response: Json | null
          created_at: string
          error_message: string | null
          id: string
          market_id: string
          notes: string | null
          outcome: string | null
          performed_by: string | null
          source: string
        }
        Insert: {
          action: string
          api_response?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          market_id: string
          notes?: string | null
          outcome?: string | null
          performed_by?: string | null
          source: string
        }
        Update: {
          action?: string
          api_response?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          market_id?: string
          notes?: string | null
          outcome?: string | null
          performed_by?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_resolution_log_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_resolution_log_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "mv_market_stats"
            referencedColumns: ["market_id"]
          },
        ]
      }
      markets: {
        Row: {
          category: string
          created_at: string
          created_by: string
          creator_fee_percent: number
          description: string | null
          expiry_time: string
          id: string
          image_url: string | null
          is_featured: boolean | null
          liquidity_pool: number
          no_price: number
          outcome: string | null
          platform_fee_percent: number
          pool_enabled: boolean
          pool_no_shares: number
          pool_yes_shares: number
          prediction_count: number | null
          price_history: Json | null
          question: string
          resolution_notes: string | null
          resolution_source: string | null
          resolution_time: string | null
          resolution_window_hours: number | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          type: string
          updated_at: string
          volume: number
          yes_price: number
        }
        Insert: {
          category: string
          created_at?: string
          created_by: string
          creator_fee_percent?: number
          description?: string | null
          expiry_time: string
          id?: string
          image_url?: string | null
          is_featured?: boolean | null
          liquidity_pool?: number
          no_price?: number
          outcome?: string | null
          platform_fee_percent?: number
          pool_enabled?: boolean
          pool_no_shares?: number
          pool_yes_shares?: number
          prediction_count?: number | null
          price_history?: Json | null
          question: string
          resolution_notes?: string | null
          resolution_source?: string | null
          resolution_time?: string | null
          resolution_window_hours?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          type: string
          updated_at?: string
          volume?: number
          yes_price?: number
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          creator_fee_percent?: number
          description?: string | null
          expiry_time?: string
          id?: string
          image_url?: string | null
          is_featured?: boolean | null
          liquidity_pool?: number
          no_price?: number
          outcome?: string | null
          platform_fee_percent?: number
          pool_enabled?: boolean
          pool_no_shares?: number
          pool_yes_shares?: number
          prediction_count?: number | null
          price_history?: Json | null
          question?: string
          resolution_notes?: string | null
          resolution_source?: string | null
          resolution_time?: string | null
          resolution_window_hours?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          type?: string
          updated_at?: string
          volume?: number
          yes_price?: number
        }
        Relationships: []
      }
      onboarding_status: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          skipped_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          skipped_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          skipped_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      order_queue: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          market_id: string
          max_retries: number
          metadata: Json | null
          order_type: string
          price: number
          priority: number
          processed_at: string | null
          quantity: number
          retry_count: number
          side: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          market_id: string
          max_retries?: number
          metadata?: Json | null
          order_type: string
          price: number
          priority?: number
          processed_at?: string | null
          quantity: number
          retry_count?: number
          side: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          market_id?: string
          max_retries?: number
          metadata?: Json | null
          order_type?: string
          price?: number
          priority?: number
          processed_at?: string | null
          quantity?: number
          retry_count?: number
          side?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          avg_fill_price: number | null
          created_at: string
          filled_quantity: number
          id: string
          market_id: string
          order_type: string
          price: number | null
          quantity: number
          side: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_fill_price?: number | null
          created_at?: string
          filled_quantity?: number
          id?: string
          market_id: string
          order_type: string
          price?: number | null
          quantity: number
          side: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_fill_price?: number | null
          created_at?: string
          filled_quantity?: number
          id?: string
          market_id?: string
          order_type?: string
          price?: number | null
          quantity?: number
          side?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "mv_market_stats"
            referencedColumns: ["market_id"]
          },
        ]
      }
      positions: {
        Row: {
          closed_at: string | null
          created_at: string
          entry_price: number
          id: string
          market_id: string
          opened_at: string
          pnl: number | null
          side: string
          size: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          entry_price: number
          id?: string
          market_id: string
          opened_at?: string
          pnl?: number | null
          side: string
          size: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          entry_price?: number
          id?: string
          market_id?: string
          opened_at?: string
          pnl?: number | null
          side?: string
          size?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "positions_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "mv_market_stats"
            referencedColumns: ["market_id"]
          },
          {
            foreignKeyName: "positions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "friend_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "mv_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      price_alerts: {
        Row: {
          condition: string
          created_at: string
          id: string
          market_id: string
          side: string
          target_price: number
          triggered: boolean
          triggered_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          condition: string
          created_at?: string
          id?: string
          market_id: string
          side: string
          target_price: number
          triggered?: boolean
          triggered_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          condition?: string
          created_at?: string
          id?: string
          market_id?: string
          side?: string
          target_price?: number
          triggered?: boolean
          triggered_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "friend_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "mv_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          balance: number | null
          created_at: string | null
          creator_tier: string | null
          creator_verified: boolean | null
          display_name: string | null
          email: string
          id: string
          kyc_verified: boolean | null
          last_active_at: string | null
          markets_created: number | null
          mfa_enabled: boolean | null
          name: string
          predictions_correct: number
          predictions_total: number
          rating_score: number
          share_trades_with_friends: boolean | null
          show_on_leaderboard: boolean
          terms_accepted_at: string | null
          total_creator_earnings: number | null
          total_creator_volume: number | null
          updated_at: string | null
          username: string | null
          version: number
        }
        Insert: {
          avatar_url?: string | null
          balance?: number | null
          created_at?: string | null
          creator_tier?: string | null
          creator_verified?: boolean | null
          display_name?: string | null
          email: string
          id: string
          kyc_verified?: boolean | null
          last_active_at?: string | null
          markets_created?: number | null
          mfa_enabled?: boolean | null
          name: string
          predictions_correct?: number
          predictions_total?: number
          rating_score?: number
          share_trades_with_friends?: boolean | null
          show_on_leaderboard?: boolean
          terms_accepted_at?: string | null
          total_creator_earnings?: number | null
          total_creator_volume?: number | null
          updated_at?: string | null
          username?: string | null
          version?: number
        }
        Update: {
          avatar_url?: string | null
          balance?: number | null
          created_at?: string | null
          creator_tier?: string | null
          creator_verified?: boolean | null
          display_name?: string | null
          email?: string
          id?: string
          kyc_verified?: boolean | null
          last_active_at?: string | null
          markets_created?: number | null
          mfa_enabled?: boolean | null
          name?: string
          predictions_correct?: number
          predictions_total?: number
          rating_score?: number
          share_trades_with_friends?: boolean | null
          show_on_leaderboard?: boolean
          terms_accepted_at?: string | null
          total_creator_earnings?: number | null
          total_creator_volume?: number | null
          updated_at?: string | null
          username?: string | null
          version?: number
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          attempt_count: number
          created_at: string
          id: string
          operation_type: string
          updated_at: string
          user_id: string
          window_start: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          id?: string
          operation_type: string
          updated_at?: string
          user_id: string
          window_start?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          id?: string
          operation_type?: string
          updated_at?: string
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      resolution_notifications: {
        Row: {
          created_at: string
          email_sent: boolean | null
          id: string
          market_id: string
          message: string
          notification_type: string
          outcome: string | null
          payout_amount: number | null
          push_sent: boolean | null
          read: boolean | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_sent?: boolean | null
          id?: string
          market_id: string
          message: string
          notification_type: string
          outcome?: string | null
          payout_amount?: number | null
          push_sent?: boolean | null
          read?: boolean | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_sent?: boolean | null
          id?: string
          market_id?: string
          message?: string
          notification_type?: string
          outcome?: string | null
          payout_amount?: number | null
          push_sent?: boolean | null
          read?: boolean | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resolution_notifications_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resolution_notifications_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "mv_market_stats"
            referencedColumns: ["market_id"]
          },
        ]
      }
      system_metrics: {
        Row: {
          id: string
          metadata: Json | null
          metric_name: string
          metric_type: string
          metric_value: number
          recorded_at: string
        }
        Insert: {
          id?: string
          metadata?: Json | null
          metric_name: string
          metric_type: string
          metric_value: number
          recorded_at?: string
        }
        Update: {
          id?: string
          metadata?: Json | null
          metric_name?: string
          metric_type?: string
          metric_value?: number
          recorded_at?: string
        }
        Relationships: []
      }
      trades: {
        Row: {
          buy_order_id: string
          buyer_id: string
          buyer_side: string
          created_at: string
          id: string
          market_id: string
          price: number
          quantity: number
          sell_order_id: string
          seller_id: string
        }
        Insert: {
          buy_order_id: string
          buyer_id: string
          buyer_side: string
          created_at?: string
          id?: string
          market_id: string
          price: number
          quantity: number
          sell_order_id: string
          seller_id: string
        }
        Update: {
          buy_order_id?: string
          buyer_id?: string
          buyer_side?: string
          created_at?: string
          id?: string
          market_id?: string
          price?: number
          quantity?: number
          sell_order_id?: string
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_buy_order_id_fkey"
            columns: ["buy_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "mv_market_stats"
            referencedColumns: ["market_id"]
          },
          {
            foreignKeyName: "trades_sell_order_id_fkey"
            columns: ["sell_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          id: string
          metadata: Json | null
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string
          id?: string
          metadata?: Json | null
          status?: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          id?: string
          metadata?: Json | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      friend_profiles: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          id: string | null
          last_active_at: string | null
          predictions_correct: number | null
          predictions_total: number | null
          rating_score: number | null
          share_trades_with_friends: boolean | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          display_name?: string | null
          id?: string | null
          last_active_at?: string | null
          predictions_correct?: number | null
          predictions_total?: number | null
          rating_score?: number | null
          share_trades_with_friends?: boolean | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          display_name?: string | null
          id?: string | null
          last_active_at?: string | null
          predictions_correct?: number | null
          predictions_total?: number | null
          rating_score?: number | null
          share_trades_with_friends?: boolean | null
          username?: string | null
        }
        Relationships: []
      }
      leaderboard_profiles: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          id: string | null
          predictions_correct: number | null
          predictions_total: number | null
          rating_score: number | null
          show_on_leaderboard: boolean | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          display_name?: string | null
          id?: string | null
          predictions_correct?: number | null
          predictions_total?: number | null
          rating_score?: number | null
          show_on_leaderboard?: boolean | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          display_name?: string | null
          id?: string | null
          predictions_correct?: number | null
          predictions_total?: number | null
          rating_score?: number | null
          show_on_leaderboard?: boolean | null
          username?: string | null
        }
        Relationships: []
      }
      mv_leaderboard: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          id: string | null
          predictions_correct: number | null
          predictions_total: number | null
          rank: number | null
          rating_score: number | null
          show_on_leaderboard: boolean | null
          username: string | null
          win_rate: number | null
        }
        Relationships: []
      }
      mv_market_stats: {
        Row: {
          category: string | null
          created_at: string | null
          filled_volume: number | null
          market_id: string | null
          no_price: number | null
          question: string | null
          status: string | null
          total_orders: number | null
          unique_traders: number | null
          updated_at: string | null
          volume: number | null
          yes_price: number | null
        }
        Relationships: []
      }
      order_book_aggregated: {
        Row: {
          market_id: string | null
          order_count: number | null
          price: number | null
          side: string | null
          total_quantity: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "mv_market_stats"
            referencedColumns: ["market_id"]
          },
        ]
      }
    }
    Functions: {
      append_price_history: {
        Args: { p_market_id: string; p_no_price: number; p_yes_price: number }
        Returns: undefined
      }
      batch_check_order_status: {
        Args: { _order_ids: string[] }
        Returns: {
          avg_fill_price: number
          filled_quantity: number
          order_id: string
          status: string
        }[]
      }
      batch_get_market_prices: {
        Args: { _market_ids: string[] }
        Returns: {
          market_id: string
          no_price: number
          updated_at: string
          volume: number
          yes_price: number
        }[]
      }
      batch_get_markets: {
        Args: { _market_ids: string[] }
        Returns: {
          category: string
          created_at: string
          description: string
          expiry_time: string
          id: string
          no_price: number
          question: string
          status: string
          volume: number
          yes_price: number
        }[]
      }
      batch_get_positions: {
        Args: { _market_ids: string[]; _user_id: string }
        Returns: {
          current_value: number
          entry_price: number
          market_id: string
          side: string
          size: number
        }[]
      }
      cache_cleanup: { Args: never; Returns: number }
      cache_get_or_set: {
        Args: { _cache_key: string; _cache_type: string; _ttl_seconds?: number }
        Returns: Json
      }
      cache_invalidate: { Args: { _key_prefix: string }; Returns: number }
      cache_set: {
        Args: {
          _cache_key: string
          _cache_type: string
          _data: Json
          _ttl_seconds?: number
        }
        Returns: undefined
      }
      check_rate_limit: {
        Args: {
          _max_attempts?: number
          _operation_type: string
          _user_id: string
          _window_minutes?: number
        }
        Returns: Json
      }
      check_rate_limit_fast: {
        Args: {
          _max_attempts?: number
          _operation_type: string
          _user_id: string
          _window_minutes?: number
        }
        Returns: Json
      }
      cleanup_expired_records: { Args: never; Returns: Json }
      detect_fraud_patterns: { Args: never; Returns: undefined }
      get_cache_analytics: { Args: { _hours?: number }; Returns: Json }
      get_creator_analytics: { Args: { _user_id: string }; Returns: Json }
      get_leaderboard_cached: { Args: { _limit?: number }; Returns: Json }
      get_market_creator_info: { Args: { _market_id: string }; Returns: Json }
      get_market_detail: {
        Args: { _market_id: string; _user_id?: string }
        Returns: Json
      }
      get_market_resolution_history: {
        Args: { market_uuid: string }
        Returns: {
          action: string
          created_at: string
          error_message: string
          id: string
          notes: string
          outcome: string
          performed_by_name: string
          source: string
        }[]
      }
      get_market_stats_cached: {
        Args: { _category?: string; _limit?: number; _status?: string }
        Returns: Json
      }
      get_platform_analytics_readonly: {
        Args: { _hours?: number }
        Returns: Json
      }
      get_queue_analytics: { Args: { _hours?: number }; Returns: Json }
      get_rate_limit_stats: { Args: never; Returns: Json }
      get_system_health: { Args: never; Returns: Json }
      get_user_dashboard: { Args: { _user_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      process_order_queue: { Args: { batch_size?: number }; Returns: Json }
      process_wallet_operation: {
        Args: {
          _amount: number
          _metadata?: Json
          _operation: string
          _user_id: string
        }
        Returns: Json
      }
      process_wallet_operation_pooled: {
        Args: {
          _amount: number
          _metadata?: Json
          _operation: string
          _user_id: string
        }
        Returns: Json
      }
      process_wallet_operation_v2: {
        Args: {
          _amount: number
          _expected_version: number
          _idempotency_key?: string
          _metadata?: Json
          _operation: string
          _user_id: string
        }
        Returns: Json
      }
      refresh_leaderboard: { Args: never; Returns: undefined }
      refresh_market_stats: { Args: never; Returns: undefined }
      update_creator_tier: { Args: { _user_id: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "creator" | "trader"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "creator", "trader"],
    },
  },
} as const
