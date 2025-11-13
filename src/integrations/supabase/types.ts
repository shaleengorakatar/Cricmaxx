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
      profiles: {
        Row: {
          balance: number | null
          created_at: string | null
          email: string
          id: string
          kyc_verified: boolean | null
          mfa_enabled: boolean | null
          name: string
          terms_accepted_at: string | null
          updated_at: string | null
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          email: string
          id: string
          kyc_verified?: boolean | null
          mfa_enabled?: boolean | null
          name: string
          terms_accepted_at?: string | null
          updated_at?: string | null
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          email?: string
          id?: string
          kyc_verified?: boolean | null
          mfa_enabled?: boolean | null
          name?: string
          terms_accepted_at?: string | null
          updated_at?: string | null
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
      [_ in never]: never
    }
    Functions: {
      check_rate_limit: {
        Args: {
          _max_attempts?: number
          _operation_type: string
          _user_id: string
          _window_minutes?: number
        }
        Returns: Json
      }
      detect_fraud_patterns: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      process_wallet_operation: {
        Args: {
          _amount: number
          _metadata?: Json
          _operation: string
          _user_id: string
        }
        Returns: Json
      }
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
