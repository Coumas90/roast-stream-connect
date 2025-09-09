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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      alert_incidents: {
        Row: {
          acknowledged_at: string | null
          alert_rule_id: string
          channels_notified: Json | null
          created_at: string | null
          id: string
          message: string
          metadata: Json | null
          resolved_at: string | null
          severity: string
          status: string
          triggered_at: string
          triggered_by: string | null
          updated_at: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          alert_rule_id: string
          channels_notified?: Json | null
          created_at?: string | null
          id?: string
          message: string
          metadata?: Json | null
          resolved_at?: string | null
          severity: string
          status?: string
          triggered_at?: string
          triggered_by?: string | null
          updated_at?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          alert_rule_id?: string
          channels_notified?: Json | null
          created_at?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          resolved_at?: string | null
          severity?: string
          status?: string
          triggered_at?: string
          triggered_by?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alert_incidents_alert_rule_id_fkey"
            columns: ["alert_rule_id"]
            isOneToOne: false
            referencedRelation: "alert_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_rules: {
        Row: {
          alert_type: string
          channels: Json | null
          cooldown_minutes: number
          created_at: string
          enabled: boolean
          id: string
          metadata: Json | null
          name: string
          severity: string
          threshold_operator: string | null
          threshold_value: number | null
          updated_at: string
        }
        Insert: {
          alert_type: string
          channels?: Json | null
          cooldown_minutes?: number
          created_at?: string
          enabled?: boolean
          id: string
          metadata?: Json | null
          name: string
          severity?: string
          threshold_operator?: string | null
          threshold_value?: number | null
          updated_at?: string
        }
        Update: {
          alert_type?: string
          channels?: Json | null
          cooldown_minutes?: number
          created_at?: string
          enabled?: boolean
          id?: string
          metadata?: Json | null
          name?: string
          severity?: string
          threshold_operator?: string | null
          threshold_value?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      chaos_scenarios: {
        Row: {
          configuration: Json
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          name: string
          provider: Database["public"]["Enums"]["app_pos_provider"]
          success_criteria: Json
          test_type: string
          updated_at: string
        }
        Insert: {
          configuration?: Json
          created_at?: string
          description?: string | null
          enabled?: boolean
          id: string
          name: string
          provider?: Database["public"]["Enums"]["app_pos_provider"]
          success_criteria?: Json
          test_type: string
          updated_at?: string
        }
        Update: {
          configuration?: Json
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          name?: string
          provider?: Database["public"]["Enums"]["app_pos_provider"]
          success_criteria?: Json
          test_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      chaos_test_metrics: {
        Row: {
          expected_value: number | null
          id: string
          metadata: Json | null
          metric_name: string
          metric_type: string
          passed: boolean | null
          recorded_at: string
          test_run_id: string
          threshold_operator: string | null
          unit: string | null
          value: number
        }
        Insert: {
          expected_value?: number | null
          id?: string
          metadata?: Json | null
          metric_name: string
          metric_type: string
          passed?: boolean | null
          recorded_at?: string
          test_run_id: string
          threshold_operator?: string | null
          unit?: string | null
          value: number
        }
        Update: {
          expected_value?: number | null
          id?: string
          metadata?: Json | null
          metric_name?: string
          metric_type?: string
          passed?: boolean | null
          recorded_at?: string
          test_run_id?: string
          threshold_operator?: string | null
          unit?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "chaos_test_metrics_test_run_id_fkey"
            columns: ["test_run_id"]
            isOneToOne: false
            referencedRelation: "chaos_test_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      chaos_test_runs: {
        Row: {
          configuration: Json
          created_at: string
          created_by: string | null
          duration_ms: number | null
          finished_at: string | null
          id: string
          provider: Database["public"]["Enums"]["app_pos_provider"]
          results: Json
          scenario_name: string
          started_at: string
          status: string
          target_location_id: string | null
          test_type: string
          updated_at: string
          violations: Json[] | null
        }
        Insert: {
          configuration?: Json
          created_at?: string
          created_by?: string | null
          duration_ms?: number | null
          finished_at?: string | null
          id?: string
          provider?: Database["public"]["Enums"]["app_pos_provider"]
          results?: Json
          scenario_name: string
          started_at?: string
          status?: string
          target_location_id?: string | null
          test_type: string
          updated_at?: string
          violations?: Json[] | null
        }
        Update: {
          configuration?: Json
          created_at?: string
          created_by?: string | null
          duration_ms?: number | null
          finished_at?: string | null
          id?: string
          provider?: Database["public"]["Enums"]["app_pos_provider"]
          results?: Json
          scenario_name?: string
          started_at?: string
          status?: string
          target_location_id?: string | null
          test_type?: string
          updated_at?: string
          violations?: Json[] | null
        }
        Relationships: []
      }
      coffee_varieties: {
        Row: {
          active: boolean
          available_bulk: boolean
          available_packaged: boolean
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_url: string | null
          name: string
          origin: string | null
          price_per_kg: number | null
          specifications: Json | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          available_bulk?: boolean
          available_packaged?: boolean
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          origin?: string | null
          price_per_kg?: number | null
          specifications?: Json | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          available_bulk?: boolean
          available_packaged?: boolean
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          origin?: string | null
          price_per_kg?: number | null
          specifications?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
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
            foreignKeyName: "consumption_daily_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations_public"
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
      consumptions: {
        Row: {
          client_id: string
          created_at: string
          date: string
          discounts: number
          id: string
          items: number
          location_id: string
          meta: Json
          orders: number
          provider: string
          taxes: number
          total: number
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          date: string
          discounts?: number
          id?: string
          items?: number
          location_id: string
          meta?: Json
          orders?: number
          provider: string
          taxes?: number
          total?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          date?: string
          discounts?: number
          id?: string
          items?: number
          location_id?: string
          meta?: Json
          orders?: number
          provider?: string
          taxes?: number
          total?: number
          updated_at?: string
        }
        Relationships: []
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
            foreignKeyName: "entitlements_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations_public"
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
            foreignKeyName: "invitations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations_public"
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
      job_heartbeats: {
        Row: {
          created_at: string
          job_name: string
          last_alert_at: string | null
          last_run_at: string
          metadata: Json | null
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          job_name: string
          last_alert_at?: string | null
          last_run_at?: string
          metadata?: Json | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          job_name?: string
          last_alert_at?: string | null
          last_run_at?: string
          metadata?: Json | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      job_locks: {
        Row: {
          holder: string
          lease_until: string
          name: string
          updated_at: string
        }
        Insert: {
          holder?: string
          lease_until: string
          name: string
          updated_at?: string
        }
        Update: {
          holder?: string
          lease_until?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      location_stock: {
        Row: {
          coffee_variety_id: string
          created_at: string
          current_kg: number
          hopper_number: number
          id: string
          last_refill_at: string | null
          location_id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          coffee_variety_id: string
          created_at?: string
          current_kg?: number
          hopper_number?: number
          id?: string
          last_refill_at?: string | null
          location_id: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          coffee_variety_id?: string
          created_at?: string
          current_kg?: number
          hopper_number?: number
          id?: string
          last_refill_at?: string | null
          location_id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_stock_coffee_variety_id_fkey"
            columns: ["coffee_variety_id"]
            isOneToOne: false
            referencedRelation: "coffee_varieties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_stock_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_stock_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations_public"
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
      order_items: {
        Row: {
          coffee_variety_id: string
          created_at: string
          id: string
          notes: string | null
          order_proposal_id: string
          quantity_kg: number
          unit_price: number | null
        }
        Insert: {
          coffee_variety_id: string
          created_at?: string
          id?: string
          notes?: string | null
          order_proposal_id: string
          quantity_kg: number
          unit_price?: number | null
        }
        Update: {
          coffee_variety_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          order_proposal_id?: string
          quantity_kg?: number
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_coffee_variety_id_fkey"
            columns: ["coffee_variety_id"]
            isOneToOne: false
            referencedRelation: "coffee_varieties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_proposal_id_fkey"
            columns: ["order_proposal_id"]
            isOneToOne: false
            referencedRelation: "order_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      order_proposals: {
        Row: {
          coffee_variety: string | null
          created_by: string | null
          delivery_type: string | null
          id: string
          items: Json
          location_id: string
          notes: string | null
          odoo_so_number: string | null
          proposed_at: string
          source: string
          status: Database["public"]["Enums"]["order_status"]
          tenant_id: string
        }
        Insert: {
          coffee_variety?: string | null
          created_by?: string | null
          delivery_type?: string | null
          id?: string
          items: Json
          location_id: string
          notes?: string | null
          odoo_so_number?: string | null
          proposed_at?: string
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          tenant_id: string
        }
        Update: {
          coffee_variety?: string | null
          created_by?: string | null
          delivery_type?: string | null
          id?: string
          items?: Json
          location_id?: string
          notes?: string | null
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
            foreignKeyName: "order_proposals_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations_public"
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
          consecutive_rotation_failures: number | null
          created_at: string
          expires_at: string | null
          id: string
          issued_at: string
          last_rotation_at: string | null
          last_rotation_attempt_at: string | null
          location_id: string | null
          next_attempt_at: string | null
          provider: Database["public"]["Enums"]["app_pos_provider"]
          rotation_attempt_id: string | null
          rotation_error_code: string | null
          rotation_error_msg: string | null
          rotation_id: string | null
          rotation_status: string | null
          secret_ref: string
          status: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          consecutive_rotation_failures?: number | null
          created_at?: string
          expires_at?: string | null
          id?: string
          issued_at: string
          last_rotation_at?: string | null
          last_rotation_attempt_at?: string | null
          location_id?: string | null
          next_attempt_at?: string | null
          provider: Database["public"]["Enums"]["app_pos_provider"]
          rotation_attempt_id?: string | null
          rotation_error_code?: string | null
          rotation_error_msg?: string | null
          rotation_id?: string | null
          rotation_status?: string | null
          secret_ref: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          consecutive_rotation_failures?: number | null
          created_at?: string
          expires_at?: string | null
          id?: string
          issued_at?: string
          last_rotation_at?: string | null
          last_rotation_attempt_at?: string | null
          location_id?: string | null
          next_attempt_at?: string | null
          provider?: Database["public"]["Enums"]["app_pos_provider"]
          rotation_attempt_id?: string | null
          rotation_error_code?: string | null
          rotation_error_msg?: string | null
          rotation_id?: string | null
          rotation_status?: string | null
          secret_ref?: string
          status?: string
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
            foreignKeyName: "pos_credentials_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations_public"
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
      pos_logs: {
        Row: {
          event_code: Database["public"]["Enums"]["pos_event_code"] | null
          id: string
          level: string
          location_id: string | null
          message: string
          meta: Json
          provider: Database["public"]["Enums"]["app_pos_provider"] | null
          scope: string
          tenant_id: string | null
          ts: string
        }
        Insert: {
          event_code?: Database["public"]["Enums"]["pos_event_code"] | null
          id?: string
          level: string
          location_id?: string | null
          message: string
          meta?: Json
          provider?: Database["public"]["Enums"]["app_pos_provider"] | null
          scope: string
          tenant_id?: string | null
          ts?: string
        }
        Update: {
          event_code?: Database["public"]["Enums"]["pos_event_code"] | null
          id?: string
          level?: string
          location_id?: string | null
          message?: string
          meta?: Json
          provider?: Database["public"]["Enums"]["app_pos_provider"] | null
          scope?: string
          tenant_id?: string | null
          ts?: string
        }
        Relationships: []
      }
      pos_orders: {
        Row: {
          external_id: string
          id: string
          inserted_at: string
          location_id: string
          occurred_at: string
          provider: Database["public"]["Enums"]["app_pos_provider"]
          status: string | null
          tenant_id: string
          total: number | null
          updated_at: string
        }
        Insert: {
          external_id: string
          id?: string
          inserted_at?: string
          location_id: string
          occurred_at: string
          provider: Database["public"]["Enums"]["app_pos_provider"]
          status?: string | null
          tenant_id: string
          total?: number | null
          updated_at?: string
        }
        Update: {
          external_id?: string
          id?: string
          inserted_at?: string
          location_id?: string
          occurred_at?: string
          provider?: Database["public"]["Enums"]["app_pos_provider"]
          status?: string | null
          tenant_id?: string
          total?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      pos_products: {
        Row: {
          external_id: string
          id: string
          inserted_at: string
          location_id: string
          name: string | null
          price: number | null
          provider: Database["public"]["Enums"]["app_pos_provider"]
          sku: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          external_id: string
          id?: string
          inserted_at?: string
          location_id: string
          name?: string | null
          price?: number | null
          provider: Database["public"]["Enums"]["app_pos_provider"]
          sku?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          external_id?: string
          id?: string
          inserted_at?: string
          location_id?: string
          name?: string | null
          price?: number | null
          provider?: Database["public"]["Enums"]["app_pos_provider"]
          sku?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      pos_provider_credentials: {
        Row: {
          ciphertext: string
          created_at: string
          last_verified_at: string | null
          location_id: string
          masked_hints: Json
          provider: Database["public"]["Enums"]["app_pos_provider"]
          rotation_attempt_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          ciphertext: string
          created_at?: string
          last_verified_at?: string | null
          location_id: string
          masked_hints?: Json
          provider: Database["public"]["Enums"]["app_pos_provider"]
          rotation_attempt_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          ciphertext?: string
          created_at?: string
          last_verified_at?: string | null
          location_id?: string
          masked_hints?: Json
          provider?: Database["public"]["Enums"]["app_pos_provider"]
          rotation_attempt_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      pos_rotation_metrics: {
        Row: {
          duration_ms: number | null
          id: string
          job_run_id: string | null
          location_id: string | null
          meta: Json | null
          metric_type: string
          provider: Database["public"]["Enums"]["app_pos_provider"] | null
          recorded_at: string
          value: number | null
        }
        Insert: {
          duration_ms?: number | null
          id?: string
          job_run_id?: string | null
          location_id?: string | null
          meta?: Json | null
          metric_type: string
          provider?: Database["public"]["Enums"]["app_pos_provider"] | null
          recorded_at?: string
          value?: number | null
        }
        Update: {
          duration_ms?: number | null
          id?: string
          job_run_id?: string | null
          location_id?: string | null
          meta?: Json | null
          metric_type?: string
          provider?: Database["public"]["Enums"]["app_pos_provider"] | null
          recorded_at?: string
          value?: number | null
        }
        Relationships: []
      }
      pos_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: number
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: number
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: number
        }
        Relationships: []
      }
      pos_sync_runs: {
        Row: {
          attempt: number | null
          client_id: string | null
          count: number | null
          duration_ms: number | null
          error: string | null
          finished_at: string | null
          id: string
          items: number
          kind: string
          location_id: string
          meta: Json | null
          ok: boolean
          provider: Database["public"]["Enums"]["app_pos_provider"]
          started_at: string
          status: string | null
          updated_at: string
        }
        Insert: {
          attempt?: number | null
          client_id?: string | null
          count?: number | null
          duration_ms?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          items?: number
          kind: string
          location_id: string
          meta?: Json | null
          ok?: boolean
          provider: Database["public"]["Enums"]["app_pos_provider"]
          started_at?: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          attempt?: number | null
          client_id?: string | null
          count?: number | null
          duration_ms?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          items?: number
          kind?: string
          location_id?: string
          meta?: Json | null
          ok?: boolean
          provider?: Database["public"]["Enums"]["app_pos_provider"]
          started_at?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pos_sync_status: {
        Row: {
          consecutive_failures: number
          created_at: string
          last_error: string | null
          last_run_at: string | null
          location_id: string
          next_attempt_at: string | null
          paused_until: string | null
          provider: Database["public"]["Enums"]["app_pos_provider"]
          updated_at: string
        }
        Insert: {
          consecutive_failures?: number
          created_at?: string
          last_error?: string | null
          last_run_at?: string | null
          location_id: string
          next_attempt_at?: string | null
          paused_until?: string | null
          provider: Database["public"]["Enums"]["app_pos_provider"]
          updated_at?: string
        }
        Update: {
          consecutive_failures?: number
          created_at?: string
          last_error?: string | null
          last_run_at?: string | null
          location_id?: string
          next_attempt_at?: string | null
          paused_until?: string | null
          provider?: Database["public"]["Enums"]["app_pos_provider"]
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
      recipe_steps: {
        Row: {
          created_at: string
          description: string
          id: string
          recipe_id: string
          step_order: number
          time_minutes: number | null
          title: string
          updated_at: string
          water_ml: number | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          recipe_id: string
          step_order: number
          time_minutes?: number | null
          title: string
          updated_at?: string
          water_ml?: number | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          recipe_id?: string
          step_order?: number
          time_minutes?: number | null
          title?: string
          updated_at?: string
          water_ml?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_steps_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          active: boolean
          coffee_amount: string | null
          coffee_type: string | null
          coffee_variety_id: string | null
          created_at: string
          created_by: string | null
          custom_coffee_name: string | null
          custom_coffee_origin: string | null
          description: string | null
          grind: string | null
          id: string
          is_active: boolean
          method: string | null
          name: string
          notes: string | null
          params: Json | null
          ratio: string | null
          status: string
          temperature: string | null
          tenant_id: string | null
          time: string | null
          type: string
          updated_at: string
          water_amount: string | null
        }
        Insert: {
          active?: boolean
          coffee_amount?: string | null
          coffee_type?: string | null
          coffee_variety_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_coffee_name?: string | null
          custom_coffee_origin?: string | null
          description?: string | null
          grind?: string | null
          id?: string
          is_active?: boolean
          method?: string | null
          name: string
          notes?: string | null
          params?: Json | null
          ratio?: string | null
          status?: string
          temperature?: string | null
          tenant_id?: string | null
          time?: string | null
          type?: string
          updated_at?: string
          water_amount?: string | null
        }
        Update: {
          active?: boolean
          coffee_amount?: string | null
          coffee_type?: string | null
          coffee_variety_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_coffee_name?: string | null
          custom_coffee_origin?: string | null
          description?: string | null
          grind?: string | null
          id?: string
          is_active?: boolean
          method?: string | null
          name?: string
          notes?: string | null
          params?: Json | null
          ratio?: string | null
          status?: string
          temperature?: string | null
          tenant_id?: string | null
          time?: string | null
          type?: string
          updated_at?: string
          water_amount?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipes_coffee_variety_id_fkey"
            columns: ["coffee_variety_id"]
            isOneToOne: false
            referencedRelation: "coffee_varieties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rotation_cb: {
        Row: {
          created_at: string
          failures: number
          location_id: string
          provider: Database["public"]["Enums"]["app_pos_provider"]
          resume_at: string | null
          state: string
          updated_at: string
          window_start: string
        }
        Insert: {
          created_at?: string
          failures?: number
          location_id: string
          provider: Database["public"]["Enums"]["app_pos_provider"]
          resume_at?: string | null
          state?: string
          updated_at?: string
          window_start?: string
        }
        Update: {
          created_at?: string
          failures?: number
          location_id?: string
          provider?: Database["public"]["Enums"]["app_pos_provider"]
          resume_at?: string | null
          state?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
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
            foreignKeyName: "stock_ledger_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations_public"
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
            foreignKeyName: "user_roles_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations_public"
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
      locations_public: {
        Row: {
          code: string | null
          created_at: string | null
          id: string | null
          name: string | null
          tenant_id: string | null
          timezone: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          tenant_id?: never
          timezone?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          tenant_id?: never
          timezone?: string | null
        }
        Relationships: []
      }
      pos_credentials_public: {
        Row: {
          created_at: string | null
          credential_status: string | null
          id: string | null
          location_id: string | null
          provider: Database["public"]["Enums"]["app_pos_provider"] | null
          rotation_status: string | null
          rotation_status_display: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          credential_status?: never
          id?: string | null
          location_id?: string | null
          provider?: Database["public"]["Enums"]["app_pos_provider"] | null
          rotation_status?: string | null
          rotation_status_display?: never
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          credential_status?: never
          id?: string | null
          location_id?: string | null
          provider?: Database["public"]["Enums"]["app_pos_provider"] | null
          rotation_status?: string | null
          rotation_status_display?: never
          status?: string | null
          updated_at?: string | null
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
            foreignKeyName: "pos_credentials_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_dashboard_breakers: {
        Row: {
          failures: number | null
          location_id: string | null
          location_name: string | null
          provider: Database["public"]["Enums"]["app_pos_provider"] | null
          resume_at: string | null
          state: string | null
          status_color: string | null
          tenant_name: string | null
          updated_at: string | null
          window_start: string | null
        }
        Relationships: []
      }
      pos_dashboard_expirations: {
        Row: {
          consecutive_rotation_failures: number | null
          days_until_expiry: number | null
          expires_at: string | null
          hours_until_expiry: number | null
          last_rotation_at: string | null
          location_id: string | null
          location_name: string | null
          provider: Database["public"]["Enums"]["app_pos_provider"] | null
          rotation_status: string | null
          status: string | null
          tenant_name: string | null
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
            foreignKeyName: "pos_credentials_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_invitation: {
        Args: { _token: string }
        Returns: undefined
      }
      acknowledge_alert_incident: {
        Args: { p_incident_id: string }
        Returns: boolean
      }
      assign_role_by_email: {
        Args: {
          _email: string
          _location_code?: string
          _role: Database["public"]["Enums"]["app_role"]
          _tenant_slug?: string
        }
        Returns: undefined
      }
      calculate_pos_mttr_7d: {
        Args: Record<PropertyKey, never>
        Returns: {
          avg_mttr_minutes: number
          failure_count: number
          location_id: string
          mttr_status: string
          provider: Database["public"]["Enums"]["app_pos_provider"]
          recovery_count: number
        }[]
      }
      cb_check_state: {
        Args:
          | {
              _location_id?: string
              _provider: Database["public"]["Enums"]["app_pos_provider"]
            }
          | { _provider: Database["public"]["Enums"]["app_pos_provider"] }
        Returns: Json
      }
      cb_record_failure: {
        Args:
          | {
              _location_id?: string
              _provider: Database["public"]["Enums"]["app_pos_provider"]
            }
          | { _provider: Database["public"]["Enums"]["app_pos_provider"] }
        Returns: Json
      }
      cb_record_success: {
        Args:
          | {
              _location_id?: string
              _provider: Database["public"]["Enums"]["app_pos_provider"]
            }
          | { _provider: Database["public"]["Enums"]["app_pos_provider"] }
        Returns: Json
      }
      check_consecutive_rotation_failures: {
        Args: Record<PropertyKey, never>
        Returns: {
          consecutive_failures: number
          last_error: string
          last_rotation_id: string
          location_id: string
          provider: Database["public"]["Enums"]["app_pos_provider"]
        }[]
      }
      claim_job_lock: {
        Args: { p_name: string; p_ttl_seconds: number }
        Returns: {
          acquired: boolean
          holder: string
        }[]
      }
      complete_chaos_test: {
        Args: {
          p_results?: Json
          p_status?: string
          p_test_run_id: string
          p_violations?: Json[]
        }
        Returns: boolean
      }
      connect_pos_location: {
        Args: {
          _api_key: string
          _location_id: string
          _provider: Database["public"]["Enums"]["app_pos_provider"]
        }
        Returns: undefined
      }
      create_location_invitation: {
        Args: {
          _email: string
          _expires_in_minutes?: number
          _location_id: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: {
          email: string
          expires_at: string
          id: string
          location_id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          token: string
        }[]
      }
      effective_pos: {
        Args: { _location_id?: string; _tenant_id: string }
        Returns: {
          connected: boolean
          provider: Database["public"]["Enums"]["app_pos_provider"]
          source: string
        }[]
      }
      execute_atomic_rotation: {
        Args: {
          p_expires_at?: string
          p_location_id: string
          p_new_token_encrypted: string
          p_provider: Database["public"]["Enums"]["app_pos_provider"]
          p_rotation_id: string
        }
        Returns: {
          is_idempotent: boolean
          operation_result: string
          rows_affected: number
          token_id: string
        }[]
      }
      gc_pos_rotation_metrics_batched: {
        Args: { _batch_size?: number; _retention_days?: number }
        Returns: Json
      }
      get_accessible_locations: {
        Args: Record<PropertyKey, never>
        Returns: {
          code: string
          created_at: string
          id: string
          name: string
          tenant_id: string
          timezone: string
        }[]
      }
      get_active_alert_rules: {
        Args: Record<PropertyKey, never>
        Returns: {
          alert_type: string
          channels: Json
          cooldown_minutes: number
          id: string
          metadata: Json
          name: string
          severity: string
          threshold_operator: string
          threshold_value: number
        }[]
      }
      get_auth_status: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_fudo_credentials_expiring: {
        Args:
          | { _days_ahead?: number }
          | { _days_ahead?: number; _limit?: number }
        Returns: {
          days_until_expiry: number
          expires_at: string
          last_rotation_attempt_at: string
          location_id: string
          secret_ref: string
        }[]
      }
      get_pos_credentials_public: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          credential_status: string
          id: string
          location_id: string
          provider: Database["public"]["Enums"]["app_pos_provider"]
          rotation_status: string
          rotation_status_display: string
          status: string
          updated_at: string
        }[]
      }
      get_pos_credentials_safe: {
        Args: { _location_id: string }
        Returns: {
          last_verified_at: string
          location_id: string
          masked_hints: Json
          provider: Database["public"]["Enums"]["app_pos_provider"]
          status: string
          updated_at: string
        }[]
      }
      get_pos_dashboard_summary: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_pos_settings: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_recent_alert_incidents: {
        Args: { _limit?: number }
        Returns: {
          acknowledged_at: string
          alert_rule_id: string
          channels_notified: Json
          id: string
          message: string
          metadata: Json
          resolved_at: string
          rule_name: string
          severity: string
          status: string
          triggered_at: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_alert_in_cooldown: {
        Args: { _alert_id: string; _cooldown_minutes: number }
        Returns: boolean
      }
      is_tupa_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      lease_fudo_rotation_candidates: {
        Args: { p_cooldown?: unknown; p_limit?: number }
        Returns: {
          expires_at: string
          location_id: string
          secret_ref: string
        }[]
      }
      list_location_invitations: {
        Args: { _location_id: string }
        Returns: {
          accepted_at: string
          created_at: string
          created_by: string
          email: string
          expires_at: string
          id: string
          location_id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          updated_at: string
        }[]
      }
      list_location_members: {
        Args: { _location_id: string }
        Returns: {
          created_at: string
          email: string
          full_name: string
          location_id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }[]
      }
      log_invitation_event: {
        Args: {
          _email: string
          _event: string
          _invitation_id: string
          _metadata?: Json
          _tenant_id: string
        }
        Returns: undefined
      }
      log_pos_credential_access: {
        Args: {
          _location_id?: string
          _operation: string
          _provider?: string
          _table_name: string
        }
        Returns: undefined
      }
      mark_credential_for_rotation: {
        Args: {
          _location_id: string
          _provider: Database["public"]["Enums"]["app_pos_provider"]
        }
        Returns: boolean
      }
      mark_rotation_attempt: {
        Args: {
          _location_id: string
          _provider: Database["public"]["Enums"]["app_pos_provider"]
        }
        Returns: boolean
      }
      pos_credentials_expiring_soon: {
        Args: { days_ahead?: number }
        Returns: {
          days_until_expiry: number
          expires_at: string
          issued_at: string
          last_rotation_at: string
          location_id: string
          provider: Database["public"]["Enums"]["app_pos_provider"]
          status: string
        }[]
      }
      pos_provider_credentials_public: {
        Args: { _location_id: string }
        Returns: {
          last_verified_at: string
          location_id: string
          masked_hints: Json
          provider: Database["public"]["Enums"]["app_pos_provider"]
          status: string
          updated_at: string
        }[]
      }
      pos_security_audit_summary: {
        Args: Record<PropertyKey, never>
        Returns: {
          access_count: number
          last_access: string
          location_id: string
          provider: Database["public"]["Enums"]["app_pos_provider"]
          unique_users: number
        }[]
      }
      record_alert_incident: {
        Args: {
          p_alert_rule_id: string
          p_message: string
          p_metadata?: Json
          p_severity: string
          p_triggered_by?: string
        }
        Returns: string
      }
      record_chaos_metric: {
        Args: {
          p_expected_value?: number
          p_metadata?: Json
          p_metric_name: string
          p_metric_type: string
          p_test_run_id: string
          p_threshold_operator?: string
          p_unit?: string
          p_value: number
        }
        Returns: boolean
      }
      record_rotation_metric: {
        Args: {
          p_duration_ms?: number
          p_job_run_id: string
          p_location_id?: string
          p_meta?: Json
          p_metric_type?: string
          p_provider?: Database["public"]["Enums"]["app_pos_provider"]
          p_value?: number
        }
        Returns: undefined
      }
      release_job_lock: {
        Args: { p_holder: string; p_name: string }
        Returns: boolean
      }
      renew_job_lock: {
        Args: { p_holder: string; p_name: string; p_ttl_seconds: number }
        Returns: boolean
      }
      reset_rotation_failures: {
        Args: {
          _location_id: string
          _provider: Database["public"]["Enums"]["app_pos_provider"]
        }
        Returns: boolean
      }
      resolve_alert_incident: {
        Args: { p_incident_id: string }
        Returns: boolean
      }
      revoke_invitation: {
        Args: { _invitation_id: string }
        Returns: undefined
      }
      revoke_role_by_email: {
        Args: {
          _email: string
          _location_code?: string
          _role: Database["public"]["Enums"]["app_role"]
          _tenant_slug?: string
        }
        Returns: undefined
      }
      rotate_invitation_token: {
        Args: { _expires_in_minutes?: number; _invitation_id: string }
        Returns: {
          expires_at: string
          id: string
          token: string
        }[]
      }
      run_pos_rotation: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      run_scheduled_gc: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      secure_token_rotation: {
        Args: { _location_id: string; _new_token: string; _provider: string }
        Returns: boolean
      }
      set_pos_location: {
        Args: {
          _config?: Json
          _connected: boolean
          _location_id: string
          _provider: Database["public"]["Enums"]["app_pos_provider"]
        }
        Returns: undefined
      }
      set_pos_tenant: {
        Args: {
          _config?: Json
          _connected: boolean
          _provider: Database["public"]["Enums"]["app_pos_provider"]
          _tenant_id: string
        }
        Returns: undefined
      }
      start_chaos_test: {
        Args: {
          p_custom_config?: Json
          p_scenario_id: string
          p_target_location_id?: string
        }
        Returns: string
      }
      trigger_pos_credentials_rotation: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      update_job_heartbeat: {
        Args: { p_job_name: string; p_metadata?: Json; p_status?: string }
        Returns: undefined
      }
      update_pos_setting: {
        Args: { _key: string; _value: number }
        Returns: boolean
      }
      update_rotation_status: {
        Args: {
          p_attempt_id?: string
          p_error_code?: string
          p_error_msg?: string
          p_location_id: string
          p_provider: Database["public"]["Enums"]["app_pos_provider"]
          p_status: string
        }
        Returns: undefined
      }
      upsert_consumption: {
        Args: {
          _client_id: string
          _date: string
          _discounts: number
          _items: number
          _location_id: string
          _meta: Json
          _orders: number
          _provider: string
          _taxes: number
          _total: number
        }
        Returns: string
      }
      user_can_manage_pos: {
        Args: { _location_id: string }
        Returns: boolean
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
      pos_event_code:
        | "rotation_started"
        | "rotation_failure"
        | "rotation_success"
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
      pos_event_code: [
        "rotation_started",
        "rotation_failure",
        "rotation_success",
      ],
      stock_txn_type: ["receipt", "consumption", "adjustment"],
    },
  },
} as const
