export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      consumption_daily: {
        Row: {
          created_at: string
          cups: number | null
          day: string
          grams_used: number | null
          id: string
          item_code: string | null
          location_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          cups?: number | null
          day: string
          grams_used?: number | null
          id?: string
          item_code?: string | null
          location_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          cups?: number | null
          day?: string
          grams_used?: number | null
          id?: string
          item_code?: string | null
          location_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consumption_daily_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumption_daily_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      entitlements: {
        Row: {
          academy_enabled: boolean
          auto_order_enabled: boolean
          barista_pool_enabled: boolean
          barista_tool_enabled: boolean
          created_at: string
          id: string
          location_id: string | null
          loyalty_enabled: boolean
          mystery_enabled: boolean
          pos_connected: boolean
          qa_franchise_enabled: boolean
          raffles_enabled: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          academy_enabled?: boolean
          auto_order_enabled?: boolean
          barista_pool_enabled?: boolean
          barista_tool_enabled?: boolean
          created_at?: string
          id?: string
          location_id?: string | null
          loyalty_enabled?: boolean
          mystery_enabled?: boolean
          pos_connected?: boolean
          qa_franchise_enabled?: boolean
          raffles_enabled?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          academy_enabled?: boolean
          auto_order_enabled?: boolean
          barista_pool_enabled?: boolean
          barista_tool_enabled?: boolean
          created_at?: string
          id?: string
          location_id?: string | null
          loyalty_enabled?: boolean
          mystery_enabled?: boolean
          pos_connected?: boolean
          qa_franchise_enabled?: boolean
          raffles_enabled?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entitlements_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entitlements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invitation_audit: {
        Row: {
          created_at: string
          email: string | null
          event: string
          id: string
          invitation_id: string | null
          metadata: Json | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          event: string
          id?: string
          invitation_id?: string | null
          metadata?: Json | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          event?: string
          id?: string
          invitation_id?: string | null
          metadata?: Json | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          id: string
          location_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          expires_at: string
          id?: string
          location_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          id?: string
          location_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          code: string | null
          created_at: string
          id: string
          name: string
          tenant_id: string
          timezone: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          name: string
          tenant_id: string
          timezone?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
          timezone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_proposals: {
        Row: {
          created_by: string | null
          id: string
          items: Json
          location_id: string
          odoo_so_number: string | null
          proposed_at: string
          source: string
          status: Database["public"]["Enums"]["order_status"]
          tenant_id: string
        }
        Insert: {
          created_by?: string | null
          id?: string
          items: Json
          location_id: string
          odoo_so_number?: string | null
          proposed_at?: string
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          tenant_id: string
        }
        Update: {
          created_by?: string | null
          id?: string
          items?: Json
          location_id?: string
          odoo_so_number?: string | null
          proposed_at?: string
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_proposals_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_proposals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_credentials: {
        Row: {
          created_at: string
          id: string
          location_id: string | null
          provider: Database["public"]["Enums"]["app_pos_provider"]
          secret_ref: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id?: string | null
          provider: Database["public"]["Enums"]["app_pos_provider"]
          secret_ref: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string | null
          provider?: Database["public"]["Enums"]["app_pos_provider"]
          secret_ref?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_credentials_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_credentials_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_integrations: {
        Row: {
          connected: boolean
          created_at: string
          id: string
          metadata: Json | null
          provider: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          connected?: boolean
          created_at?: string
          id?: string
          metadata?: Json | null
          provider: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          connected?: boolean
          created_at?: string
          id?: string
          metadata?: Json | null
          provider?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_integrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_integrations_location: {
        Row: {
          config: Json | null
          connected: boolean
          created_at: string
          id: string
          location_id: string
          provider: Database["public"]["Enums"]["app_pos_provider"]
          updated_at: string
        }
        Insert: {
          config?: Json | null
          connected?: boolean
          created_at?: string
          id?: string
          location_id: string
          provider: Database["public"]["Enums"]["app_pos_provider"]
          updated_at?: string
        }
        Update: {
          config?: Json | null
          connected?: boolean
          created_at?: string
          id?: string
          location_id?: string
          provider?: Database["public"]["Enums"]["app_pos_provider"]
          updated_at?: string
        }
        Relationships: []
      }
      pos_integrations_tenant: {
        Row: {
          config: Json | null
          connected: boolean
          created_at: string
          id: string
          provider: Database["public"]["Enums"]["app_pos_provider"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          config?: Json | null
          connected?: boolean
          created_at?: string
          id?: string
          provider: Database["public"]["Enums"]["app_pos_provider"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          config?: Json | null
          connected?: boolean
          created_at?: string
          id?: string
          provider?: Database["public"]["Enums"]["app_pos_provider"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          default_tenant_id: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_tenant_id?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_tenant_id?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_tenant_id_fkey"
            columns: ["default_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          method: string | null
          name: string
          params: Json | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string | null
          name: string
          params?: Json | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string | null
          name?: string
          params?: Json | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_ledger: {
        Row: {
          id: string
          item_code: string
          location_id: string
          notes: string | null
          occurred_at: string
          quantity_grams: number
          tenant_id: string
          txn_type: Database["public"]["Enums"]["stock_txn_type"]
        }
        Insert: {
          id?: string
          item_code: string
          location_id: string
          notes?: string | null
          occurred_at?: string
          quantity_grams: number
          tenant_id: string
          txn_type: Database["public"]["Enums"]["stock_txn_type"]
        }
        Update: {
          id?: string
          item_code?: string
          location_id?: string
          notes?: string | null
          occurred_at?: string
          quantity_grams?: number
          tenant_id?: string
          txn_type?: Database["public"]["Enums"]["stock_txn_type"]
        }
        Relationships: [
          {
            foreignKeyName: "stock_ledger_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_ledger_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          location_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: {
        Args: { _token: string }
        Returns: undefined
      }
      assign_role_by_email: {
        Args: {
          _email: string
          _role: Database["public"]["Enums"]["app_role"]
          _tenant_slug?: string
          _location_code?: string
        }
        Returns: undefined
      }
      connect_pos_location: {
        Args: {
          _location_id: string
          _provider: Database["public"]["Enums"]["app_pos_provider"]
          _api_key: string
        }
        Returns: undefined
      }
      create_location_invitation: {
        Args: {
          _email: string
          _role: Database["public"]["Enums"]["app_role"]
          _location_id: string
          _expires_in_minutes?: number
        }
        Returns: {
          id: string
          token: string
          email: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          location_id: string
          expires_at: string
        }[]
      }
      effective_pos: {
        Args: { _tenant_id: string; _location_id?: string }
        Returns: {
          provider: Database["public"]["Enums"]["app_pos_provider"]
          source: string
          connected: boolean
        }[]
      }
      has_role: {
        Args: {
          _user_id: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      is_tupa_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      list_location_invitations: {
        Args: { _location_id: string }
        Returns: {
          id: string
          email: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          location_id: string
          created_at: string
          updated_at: string
          expires_at: string
          accepted_at: string
          created_by: string
        }[]
      }
      log_invitation_event: {
        Args: {
          _event: string
          _invitation_id: string
          _email: string
          _tenant_id: string
          _metadata?: Json
        }
        Returns: undefined
      }
      revoke_invitation: {
        Args: { _invitation_id: string }
        Returns: undefined
      }
      revoke_role_by_email: {
        Args: {
          _email: string
          _role: Database["public"]["Enums"]["app_role"]
          _tenant_slug?: string
          _location_code?: string
        }
        Returns: undefined
      }
      rotate_invitation_token: {
        Args: { _invitation_id: string; _expires_in_minutes?: number }
        Returns: {
          id: string
          token: string
          expires_at: string
        }[]
      }
      set_pos_location: {
        Args: {
          _location_id: string
          _provider: Database["public"]["Enums"]["app_pos_provider"]
          _connected: boolean
          _config?: Json
        }
        Returns: undefined
      }
      set_pos_tenant: {
        Args: {
          _tenant_id: string
          _provider: Database["public"]["Enums"]["app_pos_provider"]
          _connected: boolean
          _config?: Json
        }
        Returns: undefined
      }
      user_has_location: {
        Args: { _location_id: string }
        Returns: boolean
      }
      user_has_tenant: {
        Args: { _tenant_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_pos_provider: "fudo" | "maxirest" | "bistrosoft" | "other"
      app_role: "tupa_admin" | "owner" | "manager" | "coffee_master" | "barista"
      order_status: "draft" | "approved" | "sent" | "fulfilled" | "cancelled"
      stock_txn_type: "receipt" | "consumption" | "adjustment"
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
      app_pos_provider: ["fudo", "maxirest", "bistrosoft", "other"],
      app_role: ["tupa_admin", "owner", "manager", "coffee_master", "barista"],
      order_status: ["draft", "approved", "sent", "fulfilled", "cancelled"],
      stock_txn_type: ["receipt", "consumption", "adjustment"],
    },
  },
} as const
