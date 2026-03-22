/**
 * @module SupabaseTypes
 * @status COMPLETE
 * @description Auto-generated Supabase database type definitions
 * @lastAudit 2026-03-22
 */
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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_agent_calls: {
        Row: {
          caller_name: string | null
          caller_number: string | null
          created_at: string | null
          duration_seconds: number | null
          id: string
          metadata: Json | null
          organization_id: string
          outcome: string | null
          recording_url: string | null
          sentiment: string | null
          summary: string | null
          transcript: string | null
        }
        Insert: {
          caller_name?: string | null
          caller_number?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          metadata?: Json | null
          organization_id: string
          outcome?: string | null
          recording_url?: string | null
          sentiment?: string | null
          summary?: string | null
          transcript?: string | null
        }
        Update: {
          caller_name?: string | null
          caller_number?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          outcome?: string | null
          recording_url?: string | null
          sentiment?: string | null
          summary?: string | null
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_calls_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_config: {
        Row: {
          booking_enabled: boolean | null
          business_hours_end: string | null
          business_hours_mode: string | null
          business_hours_start: string | null
          created_at: string | null
          enabled: boolean | null
          escalation_number: string | null
          greeting_message: string | null
          id: string
          knowledge_base: string | null
          max_call_duration_seconds: number | null
          organization_id: string
          transfer_enabled: boolean | null
          updated_at: string | null
          voice_id: string | null
        }
        Insert: {
          booking_enabled?: boolean | null
          business_hours_end?: string | null
          business_hours_mode?: string | null
          business_hours_start?: string | null
          created_at?: string | null
          enabled?: boolean | null
          escalation_number?: string | null
          greeting_message?: string | null
          id?: string
          knowledge_base?: string | null
          max_call_duration_seconds?: number | null
          organization_id: string
          transfer_enabled?: boolean | null
          updated_at?: string | null
          voice_id?: string | null
        }
        Update: {
          booking_enabled?: boolean | null
          business_hours_end?: string | null
          business_hours_mode?: string | null
          business_hours_start?: string | null
          created_at?: string | null
          enabled?: boolean | null
          escalation_number?: string | null
          greeting_message?: string | null
          id?: string
          knowledge_base?: string | null
          max_call_duration_seconds?: number | null
          organization_id?: string
          transfer_enabled?: boolean | null
          updated_at?: string | null
          voice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          job_id: string | null
          metadata: Json | null
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          job_id?: string | null
          metadata?: Json | null
          organization_id: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          job_id?: string | null
          metadata?: Json | null
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_messages_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_chat_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          organization_id: string
          revoked_at: string | null
          scopes: string[] | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name?: string
          organization_id: string
          revoked_at?: string | null
          scopes?: string[] | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          organization_id?: string
          revoked_at?: string | null
          scopes?: string[] | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ar_measurements: {
        Row: {
          accuracy_cm: number | null
          created_at: string | null
          id: string
          job_id: string | null
          measurement_type: string
          notes: string | null
          organization_id: string
          photo_url: string | null
          points: Json
          unit: string
          used_lidar: boolean | null
          user_id: string
          value: number
        }
        Insert: {
          accuracy_cm?: number | null
          created_at?: string | null
          id?: string
          job_id?: string | null
          measurement_type?: string
          notes?: string | null
          organization_id: string
          photo_url?: string | null
          points?: Json
          unit?: string
          used_lidar?: boolean | null
          user_id: string
          value: number
        }
        Update: {
          accuracy_cm?: number | null
          created_at?: string | null
          id?: string
          job_id?: string | null
          measurement_type?: string
          notes?: string | null
          organization_id?: string
          photo_url?: string | null
          points?: Json
          unit?: string
          used_lidar?: boolean | null
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "ar_measurements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_measurements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_audits: {
        Row: {
          action: string
          asset_id: string | null
          created_at: string | null
          id: string
          inventory_id: string | null
          metadata: Json | null
          notes: string | null
          organization_id: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          asset_id?: string | null
          created_at?: string | null
          id?: string
          inventory_id?: string | null
          metadata?: Json | null
          notes?: string | null
          organization_id: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          asset_id?: string | null
          created_at?: string | null
          id?: string
          inventory_id?: string | null
          metadata?: Json | null
          notes?: string | null
          organization_id?: string
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_audits_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_audits_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_audits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_audits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          assigned_to: string | null
          barcode: string | null
          category: Database["public"]["Enums"]["asset_category"] | null
          created_at: string | null
          deleted_at: string | null
          id: string
          image_url: string | null
          last_service: string | null
          location: string | null
          location_lat: number | null
          location_lng: number | null
          make: string | null
          metadata: Json | null
          model: string | null
          name: string
          next_service: string | null
          notes: string | null
          organization_id: string
          purchase_cost: number | null
          purchase_date: string | null
          serial_number: string | null
          service_interval_days: number | null
          status: Database["public"]["Enums"]["asset_status"] | null
          updated_at: string | null
          warranty_expiry: string | null
          year: number | null
        }
        Insert: {
          assigned_to?: string | null
          barcode?: string | null
          category?: Database["public"]["Enums"]["asset_category"] | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          image_url?: string | null
          last_service?: string | null
          location?: string | null
          location_lat?: number | null
          location_lng?: number | null
          make?: string | null
          metadata?: Json | null
          model?: string | null
          name: string
          next_service?: string | null
          notes?: string | null
          organization_id: string
          purchase_cost?: number | null
          purchase_date?: string | null
          serial_number?: string | null
          service_interval_days?: number | null
          status?: Database["public"]["Enums"]["asset_status"] | null
          updated_at?: string | null
          warranty_expiry?: string | null
          year?: number | null
        }
        Update: {
          assigned_to?: string | null
          barcode?: string | null
          category?: Database["public"]["Enums"]["asset_category"] | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          image_url?: string | null
          last_service?: string | null
          location?: string | null
          location_lat?: number | null
          location_lng?: number | null
          make?: string | null
          metadata?: Json | null
          model?: string | null
          name?: string
          next_service?: string | null
          notes?: string | null
          organization_id?: string
          purchase_cost?: number | null
          purchase_date?: string | null
          serial_number?: string | null
          service_interval_days?: number | null
          status?: Database["public"]["Enums"]["asset_status"] | null
          updated_at?: string | null
          warranty_expiry?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          new_data: Json | null
          old_data: Json | null
          organization_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_sessions: {
        Row: {
          accessed_count: number | null
          created_at: string
          dossier_urls: string[] | null
          expires_at: string
          generated_by: string
          id: string
          is_revoked: boolean | null
          last_accessed_at: string | null
          magic_link_token: string | null
          organization_id: string
          scope_date_from: string | null
          scope_date_to: string | null
          scope_participant_id: string | null
          scope_type: string
          title: string
          watermark_text: string | null
        }
        Insert: {
          accessed_count?: number | null
          created_at?: string
          dossier_urls?: string[] | null
          expires_at: string
          generated_by: string
          id?: string
          is_revoked?: boolean | null
          last_accessed_at?: string | null
          magic_link_token?: string | null
          organization_id: string
          scope_date_from?: string | null
          scope_date_to?: string | null
          scope_participant_id?: string | null
          scope_type: string
          title?: string
          watermark_text?: string | null
        }
        Update: {
          accessed_count?: number | null
          created_at?: string
          dossier_urls?: string[] | null
          expires_at?: string
          generated_by?: string
          id?: string
          is_revoked?: boolean | null
          last_accessed_at?: string | null
          magic_link_token?: string | null
          organization_id?: string
          scope_date_from?: string | null
          scope_date_to?: string | null
          scope_participant_id?: string | null
          scope_type?: string
          title?: string
          watermark_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_sessions_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_sessions_scope_participant_id_fkey"
            columns: ["scope_participant_id"]
            isOneToOne: false
            referencedRelation: "participant_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_flows: {
        Row: {
          blocks: Json | null
          category: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          last_run: string | null
          name: string
          organization_id: string
          run_count: number | null
          status: Database["public"]["Enums"]["flow_status"] | null
          trigger_config: Json | null
          updated_at: string | null
        }
        Insert: {
          blocks?: Json | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          last_run?: string | null
          name: string
          organization_id: string
          run_count?: number | null
          status?: Database["public"]["Enums"]["flow_status"] | null
          trigger_config?: Json | null
          updated_at?: string | null
        }
        Update: {
          blocks?: Json | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          last_run?: string | null
          name?: string
          organization_id?: string
          run_count?: number | null
          status?: Database["public"]["Enums"]["flow_status"] | null
          trigger_config?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_flows_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_flows_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_logs: {
        Row: {
          completed_at: string | null
          error: string | null
          flow_id: string
          id: string
          organization_id: string
          result: Json | null
          started_at: string | null
          status: string
          trigger_data: Json | null
        }
        Insert: {
          completed_at?: string | null
          error?: string | null
          flow_id: string
          id?: string
          organization_id: string
          result?: Json | null
          started_at?: string | null
          status?: string
          trigger_data?: Json | null
        }
        Update: {
          completed_at?: string | null
          error?: string | null
          flow_id?: string
          id?: string
          organization_id?: string
          result?: Json | null
          started_at?: string | null
          status?: string
          trigger_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "automation_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_queue: {
        Row: {
          attempts: number | null
          block_index: number
          completed_at: string | null
          created_at: string | null
          error: string | null
          event_data: Json
          execute_at: string
          flow_id: string
          id: string
          max_attempts: number | null
          organization_id: string
          status: string | null
        }
        Insert: {
          attempts?: number | null
          block_index?: number
          completed_at?: string | null
          created_at?: string | null
          error?: string | null
          event_data: Json
          execute_at: string
          flow_id: string
          id?: string
          max_attempts?: number | null
          organization_id: string
          status?: string | null
        }
        Update: {
          attempts?: number | null
          block_index?: number
          completed_at?: string | null
          created_at?: string | null
          error?: string | null
          event_data?: Json
          execute_at?: string
          flow_id?: string
          id?: string
          max_attempts?: number | null
          organization_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_queue_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "automation_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      award_rules: {
        Row: {
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          notes: string | null
          organization_id: string
          rule_type: string
          source: string | null
          updated_at: string
          value_numeric: number | null
          value_text: string | null
        }
        Insert: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          rule_type: string
          source?: string | null
          updated_at?: string
          value_numeric?: number | null
          value_text?: string | null
        }
        Update: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          rule_type?: string
          source?: string | null
          updated_at?: string
          value_numeric?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "award_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      behaviour_events: {
        Row: {
          antecedent: string | null
          behaviour_description: string
          behaviour_type: string
          bsp_id: string | null
          consequence: string | null
          created_at: string | null
          duration_minutes: number | null
          id: string
          intensity: string | null
          linked_incident_id: string | null
          notes: string | null
          occurred_at: string
          organization_id: string
          outcome: string | null
          participant_id: string
          restrictive_practice_id: string | null
          restrictive_practice_used: boolean | null
          shift_id: string | null
          strategies_used: string[] | null
          triggers_identified: string[] | null
          worker_id: string
        }
        Insert: {
          antecedent?: string | null
          behaviour_description: string
          behaviour_type: string
          bsp_id?: string | null
          consequence?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          intensity?: string | null
          linked_incident_id?: string | null
          notes?: string | null
          occurred_at?: string
          organization_id: string
          outcome?: string | null
          participant_id: string
          restrictive_practice_id?: string | null
          restrictive_practice_used?: boolean | null
          shift_id?: string | null
          strategies_used?: string[] | null
          triggers_identified?: string[] | null
          worker_id: string
        }
        Update: {
          antecedent?: string | null
          behaviour_description?: string
          behaviour_type?: string
          bsp_id?: string | null
          consequence?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          intensity?: string | null
          linked_incident_id?: string | null
          notes?: string | null
          occurred_at?: string
          organization_id?: string
          outcome?: string | null
          participant_id?: string
          restrictive_practice_id?: string | null
          restrictive_practice_used?: boolean | null
          shift_id?: string | null
          strategies_used?: string[] | null
          triggers_identified?: string[] | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "behaviour_events_bsp_id_fkey"
            columns: ["bsp_id"]
            isOneToOne: false
            referencedRelation: "behaviour_support_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "behaviour_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      behaviour_support_plans: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          author_name: string | null
          author_role: string | null
          consent_date: string | null
          consent_obtained: boolean | null
          created_at: string | null
          document_url: string | null
          id: string
          next_review_date: string | null
          notes: string | null
          organization_id: string
          participant_id: string
          prevention_strategies: Json | null
          reinforcement_strategies: Json | null
          response_strategies: Json | null
          review_date: string | null
          start_date: string | null
          status: string
          target_behaviours: Json | null
          title: string
          triggers: Json | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          author_name?: string | null
          author_role?: string | null
          consent_date?: string | null
          consent_obtained?: boolean | null
          created_at?: string | null
          document_url?: string | null
          id?: string
          next_review_date?: string | null
          notes?: string | null
          organization_id: string
          participant_id: string
          prevention_strategies?: Json | null
          reinforcement_strategies?: Json | null
          response_strategies?: Json | null
          review_date?: string | null
          start_date?: string | null
          status?: string
          target_behaviours?: Json | null
          title: string
          triggers?: Json | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          author_name?: string | null
          author_role?: string | null
          consent_date?: string | null
          consent_obtained?: boolean | null
          created_at?: string | null
          document_url?: string | null
          id?: string
          next_review_date?: string | null
          notes?: string | null
          organization_id?: string
          participant_id?: string
          prevention_strategies?: Json | null
          reinforcement_strategies?: Json | null
          response_strategies?: Json | null
          review_date?: string | null
          start_date?: string | null
          status?: string
          target_behaviours?: Json | null
          title?: string
          triggers?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "behaviour_support_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          ai_agent_phone: string | null
          city: string | null
          country: string | null
          created_at: string | null
          email: string | null
          id: string
          is_headquarters: boolean | null
          metadata: Json | null
          name: string
          organization_id: string
          phone: string | null
          postal_code: string | null
          state: string | null
          status: string | null
          tax_rate: number | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          ai_agent_phone?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_headquarters?: boolean | null
          metadata?: Json | null
          name: string
          organization_id: string
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          status?: string | null
          tax_rate?: number | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          ai_agent_phone?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_headquarters?: boolean | null
          metadata?: Json | null
          name?: string
          organization_id?: string
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          status?: string | null
          tax_rate?: number | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_kits: {
        Row: {
          accent_color: string | null
          created_at: string | null
          custom_css: string | null
          favicon_url: string | null
          font_body: string | null
          font_heading: string | null
          id: string
          is_active: boolean | null
          logo_dark_url: string | null
          logo_url: string | null
          metadata: Json | null
          name: string
          organization_id: string
          primary_color: string | null
          secondary_color: string | null
          tagline: string | null
          updated_at: string | null
        }
        Insert: {
          accent_color?: string | null
          created_at?: string | null
          custom_css?: string | null
          favicon_url?: string | null
          font_body?: string | null
          font_heading?: string | null
          id?: string
          is_active?: boolean | null
          logo_dark_url?: string | null
          logo_url?: string | null
          metadata?: Json | null
          name?: string
          organization_id: string
          primary_color?: string | null
          secondary_color?: string | null
          tagline?: string | null
          updated_at?: string | null
        }
        Update: {
          accent_color?: string | null
          created_at?: string | null
          custom_css?: string | null
          favicon_url?: string | null
          font_body?: string | null
          font_heading?: string | null
          id?: string
          is_active?: boolean | null
          logo_dark_url?: string | null
          logo_url?: string | null
          metadata?: Json | null
          name?: string
          organization_id?: string
          primary_color?: string | null
          secondary_color?: string | null
          tagline?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_kits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_reviews: {
        Row: {
          brand_kit_id: string | null
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
          organization_id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          brand_kit_id?: string | null
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
          organization_id: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          brand_kit_id?: string | null
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
          organization_id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_reviews_brand_kit_id_fkey"
            columns: ["brand_kit_id"]
            isOneToOne: false
            referencedRelation: "brand_kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_reviews_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_allocations: {
        Row: {
          category: string
          consumed_budget: number
          created_at: string
          id: string
          organization_id: string
          participant_id: string
          quarantined_budget: number
          service_agreement_id: string
          total_budget: number
          updated_at: string
        }
        Insert: {
          category: string
          consumed_budget?: number
          created_at?: string
          id?: string
          organization_id: string
          participant_id: string
          quarantined_budget?: number
          service_agreement_id: string
          total_budget?: number
          updated_at?: string
        }
        Update: {
          category?: string
          consumed_budget?: number
          created_at?: string
          id?: string
          organization_id?: string
          participant_id?: string
          quarantined_budget?: number
          service_agreement_id?: string
          total_budget?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_allocations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_allocations_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_allocations_service_agreement_id_fkey"
            columns: ["service_agreement_id"]
            isOneToOne: false
            referencedRelation: "service_agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_quarantine_ledger: {
        Row: {
          allocation_id: string
          amount: number
          created_at: string
          description: string | null
          id: string
          ndis_item_number: string | null
          organization_id: string
          resolved_at: string | null
          shift_id: string | null
          status: string
        }
        Insert: {
          allocation_id: string
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          ndis_item_number?: string | null
          organization_id: string
          resolved_at?: string | null
          shift_id?: string | null
          status: string
        }
        Update: {
          allocation_id?: string
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          ndis_item_number?: string | null
          organization_id?: string
          resolved_at?: string | null
          shift_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_quarantine_ledger_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "budget_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_quarantine_ledger_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_quarantine_ledger_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      care_chat_channels: {
        Row: {
          channel_type: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_archived: boolean | null
          is_read_only: boolean | null
          name: string | null
          organization_id: string
          parent_group_name: string | null
          participant_id: string | null
          updated_at: string
        }
        Insert: {
          channel_type: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean | null
          is_read_only?: boolean | null
          name?: string | null
          organization_id: string
          parent_group_name?: string | null
          participant_id?: string | null
          updated_at?: string
        }
        Update: {
          channel_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean | null
          is_read_only?: boolean | null
          name?: string | null
          organization_id?: string
          parent_group_name?: string | null
          participant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_chat_channels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      care_chat_members: {
        Row: {
          added_by_roster: boolean | null
          channel_id: string
          is_permanent: boolean | null
          joined_at: string | null
          last_read_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          added_by_roster?: boolean | null
          channel_id: string
          is_permanent?: boolean | null
          joined_at?: string | null
          last_read_at?: string | null
          role?: string
          user_id: string
        }
        Update: {
          added_by_roster?: boolean | null
          channel_id?: string
          is_permanent?: boolean | null
          joined_at?: string | null
          last_read_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_chat_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "care_chat_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      care_chat_messages: {
        Row: {
          attachments: Json | null
          channel_id: string
          content: string
          created_at: string
          id: string
          is_deleted: boolean | null
          is_edited: boolean | null
          is_pinned: boolean | null
          message_type: string
          metadata: Json | null
          reply_to_id: string | null
          sender_id: string | null
          updated_at: string
        }
        Insert: {
          attachments?: Json | null
          channel_id: string
          content: string
          created_at?: string
          id?: string
          is_deleted?: boolean | null
          is_edited?: boolean | null
          is_pinned?: boolean | null
          message_type?: string
          metadata?: Json | null
          reply_to_id?: string | null
          sender_id?: string | null
          updated_at?: string
        }
        Update: {
          attachments?: Json | null
          channel_id?: string
          content?: string
          created_at?: string
          id?: string
          is_deleted?: boolean | null
          is_edited?: boolean | null
          is_pinned?: boolean | null
          message_type?: string
          metadata?: Json | null
          reply_to_id?: string | null
          sender_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_chat_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "care_chat_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_chat_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "care_chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      care_goals: {
        Row: {
          achieved_at: string | null
          care_plan_id: string
          created_at: string
          description: string | null
          evidence_notes: string | null
          id: string
          milestones: Json | null
          ndis_goal_reference: string | null
          organization_id: string
          participant_id: string
          priority: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["goal_status"]
          support_category: string | null
          target_outcome: string | null
          title: string
          updated_at: string
        }
        Insert: {
          achieved_at?: string | null
          care_plan_id: string
          created_at?: string
          description?: string | null
          evidence_notes?: string | null
          id?: string
          milestones?: Json | null
          ndis_goal_reference?: string | null
          organization_id: string
          participant_id: string
          priority?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["goal_status"]
          support_category?: string | null
          target_outcome?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          achieved_at?: string | null
          care_plan_id?: string
          created_at?: string
          description?: string | null
          evidence_notes?: string | null
          id?: string
          milestones?: Json | null
          ndis_goal_reference?: string | null
          organization_id?: string
          participant_id?: string
          priority?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["goal_status"]
          support_category?: string | null
          target_outcome?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_goals_care_plan_id_fkey"
            columns: ["care_plan_id"]
            isOneToOne: false
            referencedRelation: "care_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_goals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_goals_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      care_plans: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          assessor_name: string | null
          assessor_role: string | null
          created_at: string
          domains: Json
          id: string
          next_review_date: string | null
          notes: string | null
          organization_id: string
          participant_id: string
          review_date: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["care_plan_status"]
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          assessor_name?: string | null
          assessor_role?: string | null
          created_at?: string
          domains?: Json
          id?: string
          next_review_date?: string | null
          notes?: string | null
          organization_id: string
          participant_id: string
          review_date?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["care_plan_status"]
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          assessor_name?: string | null
          assessor_role?: string | null
          created_at?: string
          domains?: Json
          id?: string
          next_review_date?: string | null
          notes?: string | null
          organization_id?: string
          participant_id?: string
          review_date?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["care_plan_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_plans_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_plans_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      care_typing_indicators: {
        Row: {
          channel_id: string
          started_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          started_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_typing_indicators_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "care_chat_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_members: {
        Row: {
          channel_id: string
          joined_at: string | null
          last_read_at: string | null
          muted: boolean | null
          role: string | null
          user_id: string
        }
        Insert: {
          channel_id: string
          joined_at?: string | null
          last_read_at?: string | null
          muted?: boolean | null
          role?: string | null
          user_id: string
        }
        Update: {
          channel_id?: string
          joined_at?: string | null
          last_read_at?: string | null
          muted?: boolean | null
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          context_id: string | null
          context_type: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_archived: boolean | null
          last_message_at: string | null
          metadata: Json | null
          name: string | null
          organization_id: string
          type: Database["public"]["Enums"]["channel_type"]
          updated_at: string | null
        }
        Insert: {
          context_id?: string | null
          context_type?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean | null
          last_message_at?: string | null
          metadata?: Json | null
          name?: string | null
          organization_id: string
          type?: Database["public"]["Enums"]["channel_type"]
          updated_at?: string | null
        }
        Update: {
          context_id?: string | null
          context_type?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean | null
          last_message_at?: string | null
          metadata?: Json | null
          name?: string | null
          organization_id?: string
          type?: Database["public"]["Enums"]["channel_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channels_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_actions: {
        Row: {
          completed_at: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          evidence: Json | null
          id: string
          notes: string | null
          organization_id: string
          owner_id: string | null
          owner_name: string | null
          priority: string | null
          source_id: string | null
          source_reference: string | null
          source_type: string
          status: string
          title: string
          updated_at: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          evidence?: Json | null
          id?: string
          notes?: string | null
          organization_id: string
          owner_id?: string | null
          owner_name?: string | null
          priority?: string | null
          source_id?: string | null
          source_reference?: string | null
          source_type: string
          status?: string
          title: string
          updated_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          evidence?: Json | null
          id?: string
          notes?: string | null
          organization_id?: string
          owner_id?: string | null
          owner_name?: string | null
          priority?: string | null
          source_id?: string | null
          source_reference?: string | null
          source_type?: string
          status?: string
          title?: string
          updated_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ci_actions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_line_items: {
        Row: {
          claim_batch_id: string | null
          created_at: string
          description: string
          funder_id: string | null
          gst_amount: number | null
          id: string
          ndis_item_number: string | null
          organization_id: string
          participant_id: string
          quantity: number
          region_modifier: number | null
          rejection_code: string | null
          rejection_reason: string | null
          service_date: string | null
          shift_id: string | null
          status: string
          total_amount: number
          unit_rate: number
          updated_at: string
          worker_id: string | null
        }
        Insert: {
          claim_batch_id?: string | null
          created_at?: string
          description: string
          funder_id?: string | null
          gst_amount?: number | null
          id?: string
          ndis_item_number?: string | null
          organization_id: string
          participant_id: string
          quantity: number
          region_modifier?: number | null
          rejection_code?: string | null
          rejection_reason?: string | null
          service_date?: string | null
          shift_id?: string | null
          status: string
          total_amount: number
          unit_rate: number
          updated_at?: string
          worker_id?: string | null
        }
        Update: {
          claim_batch_id?: string | null
          created_at?: string
          description?: string
          funder_id?: string | null
          gst_amount?: number | null
          id?: string
          ndis_item_number?: string | null
          organization_id?: string
          participant_id?: string
          quantity?: number
          region_modifier?: number | null
          rejection_code?: string | null
          rejection_reason?: string | null
          service_date?: string | null
          shift_id?: string | null
          status?: string
          total_amount?: number
          unit_rate?: number
          updated_at?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_line_items_funder_id_fkey"
            columns: ["funder_id"]
            isOneToOne: false
            referencedRelation: "funders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_line_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_line_items_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_line_items_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_line_items_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_claim_batch"
            columns: ["claim_batch_id"]
            isOneToOne: false
            referencedRelation: "proda_claim_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contacts: {
        Row: {
          client_id: string
          created_at: string | null
          email: string | null
          id: string
          is_primary: boolean | null
          name: string
          phone: string | null
          role: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean | null
          name: string
          phone?: string | null
          role?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean | null
          name?: string
          phone?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          address_lat: number | null
          address_lng: number | null
          billing_terms: string | null
          created_at: string | null
          deleted_at: string | null
          email: string | null
          estimated_value: number | null
          id: string
          last_active_at: string | null
          lead_source: string | null
          metadata: Json | null
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          pipeline_status: string | null
          pipeline_updated_at: string | null
          since: string | null
          status: Database["public"]["Enums"]["client_status"] | null
          tags: string[] | null
          type: Database["public"]["Enums"]["client_type"] | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          address_lat?: number | null
          address_lng?: number | null
          billing_terms?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          estimated_value?: number | null
          id?: string
          last_active_at?: string | null
          lead_source?: string | null
          metadata?: Json | null
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          pipeline_status?: string | null
          pipeline_updated_at?: string | null
          since?: string | null
          status?: Database["public"]["Enums"]["client_status"] | null
          tags?: string[] | null
          type?: Database["public"]["Enums"]["client_type"] | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          address_lat?: number | null
          address_lng?: number | null
          billing_terms?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          estimated_value?: number | null
          id?: string
          last_active_at?: string | null
          lead_source?: string | null
          metadata?: Json | null
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          pipeline_status?: string | null
          pipeline_updated_at?: string | null
          since?: string | null
          status?: Database["public"]["Enums"]["client_status"] | null
          tags?: string[] | null
          type?: Database["public"]["Enums"]["client_type"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_layouts: {
        Row: {
          created_at: string | null
          id: string
          layout: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          layout?: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          layout?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      document_events: {
        Row: {
          actor_email: string | null
          actor_name: string | null
          created_at: string | null
          description: string | null
          document_id: string
          document_type: string
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          organization_id: string | null
          user_agent: string | null
        }
        Insert: {
          actor_email?: string | null
          actor_name?: string | null
          created_at?: string | null
          description?: string | null
          document_id: string
          document_type: string
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          organization_id?: string | null
          user_agent?: string | null
        }
        Update: {
          actor_email?: string | null
          actor_name?: string | null
          created_at?: string | null
          description?: string | null
          document_id?: string
          document_type?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          organization_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          event_type: string
          id: string
          job_id: string | null
          metadata: Json | null
          organization_id: string
          recipient_email: string
          resend_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["email_status"] | null
          subject: string | null
        }
        Insert: {
          event_type: string
          id?: string
          job_id?: string | null
          metadata?: Json | null
          organization_id: string
          recipient_email: string
          resend_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"] | null
          subject?: string | null
        }
        Update: {
          event_type?: string
          id?: string
          job_id?: string | null
          metadata?: Json | null
          organization_id?: string
          recipient_email?: string
          resend_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"] | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      external_agencies: {
        Row: {
          abn: string | null
          address: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          organization_id: string
          type: string
          updated_at: string
        }
        Insert: {
          abn?: string | null
          address?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          organization_id: string
          type: string
          updated_at?: string
        }
        Update: {
          abn?: string | null
          address?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          organization_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_agencies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fatigue_overrides: {
        Row: {
          approved_by: string
          created_at: string
          gap_hours: number
          id: string
          justification: string
          organization_id: string
          previous_shift_id: string | null
          shift_id: string
          worker_id: string
        }
        Insert: {
          approved_by: string
          created_at?: string
          gap_hours: number
          id?: string
          justification: string
          organization_id: string
          previous_shift_id?: string | null
          shift_id: string
          worker_id: string
        }
        Update: {
          approved_by?: string
          created_at?: string
          gap_hours?: number
          id?: string
          justification?: string
          organization_id?: string
          previous_shift_id?: string | null
          shift_id?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fatigue_overrides_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fatigue_overrides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fatigue_overrides_previous_shift_id_fkey"
            columns: ["previous_shift_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fatigue_overrides_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fatigue_overrides_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_positions: {
        Row: {
          accuracy: number | null
          altitude: number | null
          battery: number | null
          current_job_id: string | null
          heading: number | null
          id: string
          lat: number
          lng: number
          organization_id: string
          speed: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          altitude?: number | null
          battery?: number | null
          current_job_id?: string | null
          heading?: number | null
          id?: string
          lat: number
          lng: number
          organization_id: string
          speed?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accuracy?: number | null
          altitude?: number | null
          battery?: number | null
          current_job_id?: string | null
          heading?: number | null
          id?: string
          lat?: number
          lng?: number
          organization_id?: string
          speed?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_positions_current_job_id_fkey"
            columns: ["current_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_positions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      footprint_trails: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          path: Json
          technician_id: string
          timestamps: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          path?: Json
          technician_id: string
          timestamps?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          path?: Json
          technician_id?: string
          timestamps?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "footprint_trails_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "footprint_trails_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      form_assignments: {
        Row: {
          condition_type: string
          condition_value: string | null
          created_at: string
          form_template_id: string
          id: string
          is_mandatory: boolean
          organization_id: string
        }
        Insert: {
          condition_type?: string
          condition_value?: string | null
          created_at?: string
          form_template_id: string
          id?: string
          is_mandatory?: boolean
          organization_id: string
        }
        Update: {
          condition_type?: string
          condition_value?: string | null
          created_at?: string
          form_template_id?: string
          id?: string
          is_mandatory?: boolean
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_assignments_form_template_id_fkey"
            columns: ["form_template_id"]
            isOneToOne: false
            referencedRelation: "form_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      form_responses: {
        Row: {
          created_at: string
          data: Json
          form_template_id: string
          id: string
          job_id: string | null
          organization_id: string
          signature_svg: string | null
          status: string
          submitted_at: string | null
          submitted_by: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          form_template_id: string
          id?: string
          job_id?: string | null
          organization_id: string
          signature_svg?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          form_template_id?: string
          id?: string
          job_id?: string | null
          organization_id?: string
          signature_svg?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_responses_form_template_id_fkey"
            columns: ["form_template_id"]
            isOneToOne: false
            referencedRelation: "form_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_responses_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_responses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          client_id: string | null
          created_at: string | null
          data: Json | null
          document_hash: string | null
          expires_at: string | null
          form_id: string
          id: string
          job_id: string | null
          metadata: Json | null
          organization_id: string
          pdf_url: string | null
          signature: string | null
          signed_at: string | null
          status: Database["public"]["Enums"]["submission_status"] | null
          submitted_by: string | null
          submitter_name: string | null
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          data?: Json | null
          document_hash?: string | null
          expires_at?: string | null
          form_id: string
          id?: string
          job_id?: string | null
          metadata?: Json | null
          organization_id: string
          pdf_url?: string | null
          signature?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["submission_status"] | null
          submitted_by?: string | null
          submitter_name?: string | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          data?: Json | null
          document_hash?: string | null
          expires_at?: string | null
          form_id?: string
          id?: string
          job_id?: string | null
          metadata?: Json | null
          organization_id?: string
          pdf_url?: string | null
          signature?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["submission_status"] | null
          submitted_by?: string | null
          submitter_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      form_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          organization_id: string
          requires_signature: boolean
          schema: Json
          stage: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          organization_id: string
          requires_signature?: boolean
          schema?: Json
          stage?: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string
          requires_signature?: boolean
          schema?: Json
          stage?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "form_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          blocks: Json | null
          category: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          is_library: boolean | null
          is_verified: boolean | null
          layout_config: Json | null
          organization_id: string
          settings: Json | null
          status: Database["public"]["Enums"]["form_status"] | null
          submissions_count: number | null
          title: string
          updated_at: string | null
          version: number | null
        }
        Insert: {
          blocks?: Json | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_library?: boolean | null
          is_verified?: boolean | null
          layout_config?: Json | null
          organization_id: string
          settings?: Json | null
          status?: Database["public"]["Enums"]["form_status"] | null
          submissions_count?: number | null
          title: string
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          blocks?: Json | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_library?: boolean | null
          is_verified?: boolean | null
          layout_config?: Json | null
          organization_id?: string
          settings?: Json | null
          status?: Database["public"]["Enums"]["form_status"] | null
          submissions_count?: number | null
          title?: string
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "forms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_logs: {
        Row: {
          cost: number | null
          created_at: string | null
          fuel_date: string | null
          id: string
          litres: number | null
          location_lat: number | null
          location_lng: number | null
          ocr_data: Json | null
          organization_id: string
          price_per_litre: number | null
          receipt_url: string | null
          station_name: string | null
          user_id: string
          vehicle_id: string
        }
        Insert: {
          cost?: number | null
          created_at?: string | null
          fuel_date?: string | null
          id?: string
          litres?: number | null
          location_lat?: number | null
          location_lng?: number | null
          ocr_data?: Json | null
          organization_id: string
          price_per_litre?: number | null
          receipt_url?: string | null
          station_name?: string | null
          user_id: string
          vehicle_id: string
        }
        Update: {
          cost?: number | null
          created_at?: string | null
          fuel_date?: string | null
          id?: string
          litres?: number | null
          location_lat?: number | null
          location_lng?: number | null
          ocr_data?: Json | null
          organization_id?: string
          price_per_litre?: number | null
          receipt_url?: string | null
          station_name?: string | null
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      funders: {
        Row: {
          billing_reference: string | null
          contact_email: string | null
          created_at: string
          id: string
          is_active: boolean | null
          is_primary: boolean | null
          name: string
          organization_id: string
          participant_id: string
          type: string
          updated_at: string
        }
        Insert: {
          billing_reference?: string | null
          contact_email?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          name: string
          organization_id: string
          participant_id: string
          type: string
          updated_at?: string
        }
        Update: {
          billing_reference?: string | null
          contact_email?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          name?: string
          organization_id?: string
          participant_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funders_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_progress_links: {
        Row: {
          contribution_summary: string | null
          created_at: string
          goal_id: string
          id: string
          progress_note_id: string
        }
        Insert: {
          contribution_summary?: string | null
          created_at?: string
          goal_id: string
          id?: string
          progress_note_id: string
        }
        Update: {
          contribution_summary?: string | null
          created_at?: string
          goal_id?: string
          id?: string
          progress_note_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_progress_links_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "care_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_progress_links_progress_note_id_fkey"
            columns: ["progress_note_id"]
            isOneToOne: false
            referencedRelation: "progress_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_meetings: {
        Row: {
          actions_generated: Json | null
          agenda: string | null
          attendees: Json | null
          created_at: string | null
          created_by: string | null
          decisions: Json | null
          id: string
          meeting_date: string
          meeting_type: string | null
          minutes: string | null
          organization_id: string
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          actions_generated?: Json | null
          agenda?: string | null
          attendees?: Json | null
          created_at?: string | null
          created_by?: string | null
          decisions?: Json | null
          id?: string
          meeting_date: string
          meeting_type?: string | null
          minutes?: string | null
          organization_id: string
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          actions_generated?: Json | null
          agenda?: string | null
          attendees?: Json | null
          created_at?: string | null
          created_by?: string | null
          decisions?: Json | null
          id?: string
          meeting_date?: string
          meeting_type?: string | null
          minutes?: string | null
          organization_id?: string
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "governance_meetings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      health_observations: {
        Row: {
          created_at: string
          id: string
          is_abnormal: boolean
          notes: string | null
          observation_type: Database["public"]["Enums"]["observation_type"]
          observed_at: string
          organization_id: string
          participant_id: string
          shift_id: string | null
          unit: string | null
          value_diastolic: number | null
          value_numeric: number | null
          value_systolic: number | null
          value_text: string | null
          worker_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_abnormal?: boolean
          notes?: string | null
          observation_type: Database["public"]["Enums"]["observation_type"]
          observed_at?: string
          organization_id: string
          participant_id: string
          shift_id?: string | null
          unit?: string | null
          value_diastolic?: number | null
          value_numeric?: number | null
          value_systolic?: number | null
          value_text?: string | null
          worker_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_abnormal?: boolean
          notes?: string | null
          observation_type?: Database["public"]["Enums"]["observation_type"]
          observed_at?: string
          organization_id?: string
          participant_id?: string
          shift_id?: string | null
          unit?: string | null
          value_diastolic?: number | null
          value_numeric?: number | null
          value_systolic?: number | null
          value_text?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_observations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_observations_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_observations_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_observations_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      help_articles: {
        Row: {
          category: string
          content: string
          created_at: string | null
          icon: string | null
          id: string
          published: boolean | null
          slug: string
          sort_order: number | null
          summary: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category?: string
          content: string
          created_at?: string | null
          icon?: string | null
          id?: string
          published?: boolean | null
          slug: string
          sort_order?: number | null
          summary?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          icon?: string | null
          id?: string
          published?: boolean | null
          slug?: string
          sort_order?: number | null
          summary?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      help_thread_replies: {
        Row: {
          author_id: string | null
          content: string
          created_at: string | null
          id: string
          is_accepted: boolean | null
          thread_id: string
          upvotes: number | null
        }
        Insert: {
          author_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          is_accepted?: boolean | null
          thread_id: string
          upvotes?: number | null
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          is_accepted?: boolean | null
          thread_id?: string
          upvotes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "help_thread_replies_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "help_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      help_threads: {
        Row: {
          author_id: string | null
          category: string | null
          content: string
          created_at: string | null
          id: string
          is_solved: boolean | null
          reply_count: number | null
          title: string
          updated_at: string | null
          upvotes: number | null
        }
        Insert: {
          author_id?: string | null
          category?: string | null
          content: string
          created_at?: string | null
          id?: string
          is_solved?: boolean | null
          reply_count?: number | null
          title: string
          updated_at?: string | null
          upvotes?: number | null
        }
        Update: {
          author_id?: string | null
          category?: string | null
          content?: string
          created_at?: string | null
          id?: string
          is_solved?: boolean | null
          reply_count?: number | null
          title?: string
          updated_at?: string | null
          upvotes?: number | null
        }
        Relationships: []
      }
      help_tickets: {
        Row: {
          created_at: string | null
          id: string
          message: string
          organization_id: string | null
          severity: string
          status: string
          subject: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          organization_id?: string | null
          severity?: string
          status?: string
          subject: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          organization_id?: string | null
          severity?: string
          status?: string
          subject?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "help_tickets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hosting_deployments: {
        Row: {
          branch: string | null
          build_duration_ms: number | null
          commit_message: string | null
          commit_sha: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          error_message: string | null
          generation_id: string | null
          id: string
          metadata: Json | null
          organization_id: string
          preview_url: string | null
          production_url: string | null
          service_id: string
          status: string
        }
        Insert: {
          branch?: string | null
          build_duration_ms?: number | null
          commit_message?: string | null
          commit_sha?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          generation_id?: string | null
          id?: string
          metadata?: Json | null
          organization_id: string
          preview_url?: string | null
          production_url?: string | null
          service_id: string
          status?: string
        }
        Update: {
          branch?: string | null
          build_duration_ms?: number | null
          commit_message?: string | null
          commit_sha?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          generation_id?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          preview_url?: string | null
          production_url?: string | null
          service_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "hosting_deployments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hosting_deployments_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "stack_generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hosting_deployments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hosting_deployments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "hosting_services"
            referencedColumns: ["id"]
          },
        ]
      }
      hosting_services: {
        Row: {
          auto_deploy: boolean | null
          bandwidth_gb: number | null
          build_command: string | null
          created_at: string | null
          created_by: string | null
          custom_domain: string | null
          domain: string | null
          environment_vars: Json | null
          framework: string | null
          id: string
          metadata: Json | null
          name: string
          organization_id: string
          output_directory: string | null
          plan: string | null
          project_id: string | null
          provider: string | null
          region: string | null
          ssl_enabled: boolean | null
          status: string
          storage_gb: number | null
          updated_at: string | null
        }
        Insert: {
          auto_deploy?: boolean | null
          bandwidth_gb?: number | null
          build_command?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_domain?: string | null
          domain?: string | null
          environment_vars?: Json | null
          framework?: string | null
          id?: string
          metadata?: Json | null
          name: string
          organization_id: string
          output_directory?: string | null
          plan?: string | null
          project_id?: string | null
          provider?: string | null
          region?: string | null
          ssl_enabled?: boolean | null
          status?: string
          storage_gb?: number | null
          updated_at?: string | null
        }
        Update: {
          auto_deploy?: boolean | null
          bandwidth_gb?: number | null
          build_command?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_domain?: string | null
          domain?: string | null
          environment_vars?: Json | null
          framework?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          organization_id?: string
          output_directory?: string | null
          plan?: string | null
          project_id?: string | null
          provider?: string | null
          region?: string | null
          ssl_enabled?: boolean | null
          status?: string
          storage_gb?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hosting_services_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hosting_services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hosting_services_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "stack_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          category: Database["public"]["Enums"]["incident_category"]
          created_at: string
          description: string
          id: string
          immediate_actions: string | null
          is_reportable: boolean
          location: string | null
          occurred_at: string
          organization_id: string
          participant_id: string | null
          photos: string[] | null
          reported_at: string
          resolution_notes: string | null
          resolved_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          severity: Database["public"]["Enums"]["incident_severity"]
          shift_id: string | null
          status: Database["public"]["Enums"]["incident_status"]
          title: string
          updated_at: string
          witnesses: Json | null
          worker_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["incident_category"]
          created_at?: string
          description: string
          id?: string
          immediate_actions?: string | null
          is_reportable?: boolean
          location?: string | null
          occurred_at?: string
          organization_id: string
          participant_id?: string | null
          photos?: string[] | null
          reported_at?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          shift_id?: string | null
          status?: Database["public"]["Enums"]["incident_status"]
          title: string
          updated_at?: string
          witnesses?: Json | null
          worker_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["incident_category"]
          created_at?: string
          description?: string
          id?: string
          immediate_actions?: string | null
          is_reportable?: boolean
          location?: string | null
          occurred_at?: string
          organization_id?: string
          participant_id?: string | null
          photos?: string[] | null
          reported_at?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          shift_id?: string | null
          status?: Database["public"]["Enums"]["incident_status"]
          title?: string
          updated_at?: string
          witnesses?: Json | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_sync_log: {
        Row: {
          created_at: string | null
          direction: string
          entity_id: string | null
          entity_type: string
          error_message: string | null
          id: string
          integration_id: string
          metadata: Json | null
          organization_id: string | null
          provider_entity_id: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          direction: string
          entity_id?: string | null
          entity_type: string
          error_message?: string | null
          id?: string
          integration_id: string
          metadata?: Json | null
          organization_id?: string | null
          provider_entity_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string | null
          direction?: string
          entity_id?: string | null
          entity_type?: string
          error_message?: string | null
          id?: string
          integration_id?: string
          metadata?: Json | null
          organization_id?: string | null
          provider_entity_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_sync_log_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_sync_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_webhooks: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_type: string
          id: string
          integration_id: string | null
          payload: Json
          processed: boolean | null
          processed_at: string | null
          provider: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          integration_id?: string | null
          payload?: Json
          processed?: boolean | null
          processed_at?: string | null
          provider: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          integration_id?: string | null
          payload?: Json
          processed?: boolean | null
          processed_at?: string | null
          provider?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_webhooks_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          access_token: string | null
          category: string | null
          config: Json | null
          connected_as: string | null
          connected_email: string | null
          connection_id: string | null
          created_at: string | null
          credentials: Json | null
          error_message: string | null
          id: string
          last_sync: string | null
          metadata: Json | null
          organization_id: string
          provider: string
          provider_org_id: string | null
          refresh_token: string | null
          scopes: string[] | null
          settings: Json | null
          status: Database["public"]["Enums"]["integration_status"] | null
          sync_enabled: boolean | null
          token_expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          access_token?: string | null
          category?: string | null
          config?: Json | null
          connected_as?: string | null
          connected_email?: string | null
          connection_id?: string | null
          created_at?: string | null
          credentials?: Json | null
          error_message?: string | null
          id?: string
          last_sync?: string | null
          metadata?: Json | null
          organization_id: string
          provider: string
          provider_org_id?: string | null
          refresh_token?: string | null
          scopes?: string[] | null
          settings?: Json | null
          status?: Database["public"]["Enums"]["integration_status"] | null
          sync_enabled?: boolean | null
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string | null
          category?: string | null
          config?: Json | null
          connected_as?: string | null
          connected_email?: string | null
          connection_id?: string | null
          created_at?: string | null
          credentials?: Json | null
          error_message?: string | null
          id?: string
          last_sync?: string | null
          metadata?: Json | null
          organization_id?: string
          provider?: string
          provider_org_id?: string | null
          refresh_token?: string | null
          scopes?: string[] | null
          settings?: Json | null
          status?: Database["public"]["Enums"]["integration_status"] | null
          sync_enabled?: boolean | null
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          barcode: string | null
          bin_location: string | null
          category: string | null
          created_at: string | null
          id: string
          last_counted_at: string | null
          location: string | null
          max_quantity: number | null
          metadata: Json | null
          min_quantity: number | null
          name: string
          organization_id: string
          quantity: number | null
          sku: string | null
          stock_level: Database["public"]["Enums"]["stock_level"] | null
          supplier: string | null
          unit_cost: number | null
          updated_at: string | null
        }
        Insert: {
          barcode?: string | null
          bin_location?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          last_counted_at?: string | null
          location?: string | null
          max_quantity?: number | null
          metadata?: Json | null
          min_quantity?: number | null
          name: string
          organization_id: string
          quantity?: number | null
          sku?: string | null
          stock_level?: Database["public"]["Enums"]["stock_level"] | null
          supplier?: string | null
          unit_cost?: number | null
          updated_at?: string | null
        }
        Update: {
          barcode?: string | null
          bin_location?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          last_counted_at?: string | null
          location?: string | null
          max_quantity?: number | null
          metadata?: Json | null
          min_quantity?: number | null
          name?: string
          organization_id?: string
          quantity?: number | null
          sku?: string | null
          stock_level?: Database["public"]["Enums"]["stock_level"] | null
          supplier?: string | null
          unit_cost?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_events: {
        Row: {
          created_at: string | null
          id: string
          invoice_id: string
          metadata: Json | null
          text: string
          type: Database["public"]["Enums"]["invoice_event_type"]
        }
        Insert: {
          created_at?: string | null
          id?: string
          invoice_id: string
          metadata?: Json | null
          text: string
          type: Database["public"]["Enums"]["invoice_event_type"]
        }
        Update: {
          created_at?: string | null
          id?: string
          invoice_id?: string
          metadata?: Json | null
          text?: string
          type?: Database["public"]["Enums"]["invoice_event_type"]
        }
        Relationships: [
          {
            foreignKeyName: "invoice_events_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          created_at: string | null
          description: string
          id: string
          invoice_id: string
          quantity: number | null
          sort_order: number | null
          tax_rate_percent: number | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          invoice_id: string
          quantity?: number | null
          sort_order?: number | null
          tax_rate_percent?: number | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number | null
          sort_order?: number | null
          tax_rate_percent?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_address: string | null
          client_email: string | null
          client_id: string | null
          client_name: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          discount_total: number | null
          discount_type: string | null
          discount_value: number | null
          display_id: string
          due_date: string
          id: string
          issue_date: string
          job_id: string | null
          metadata: Json | null
          notes: string | null
          organization_id: string
          paid_date: string | null
          payment_link: string | null
          payment_method: string | null
          pdf_url: string | null
          polar_checkout_url: string | null
          quote_id: string | null
          receipt_email: string | null
          receipt_url: string | null
          secure_token: string | null
          status: Database["public"]["Enums"]["invoice_status"] | null
          stripe_payment_intent_id: string | null
          subtotal: number | null
          tax: number | null
          tax_rate: number | null
          total: number | null
          updated_at: string | null
        }
        Insert: {
          client_address?: string | null
          client_email?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          discount_total?: number | null
          discount_type?: string | null
          discount_value?: number | null
          display_id: string
          due_date: string
          id?: string
          issue_date?: string
          job_id?: string | null
          metadata?: Json | null
          notes?: string | null
          organization_id: string
          paid_date?: string | null
          payment_link?: string | null
          payment_method?: string | null
          pdf_url?: string | null
          polar_checkout_url?: string | null
          quote_id?: string | null
          receipt_email?: string | null
          receipt_url?: string | null
          secure_token?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          stripe_payment_intent_id?: string | null
          subtotal?: number | null
          tax?: number | null
          tax_rate?: number | null
          total?: number | null
          updated_at?: string | null
        }
        Update: {
          client_address?: string | null
          client_email?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          discount_total?: number | null
          discount_type?: string | null
          discount_value?: number | null
          display_id?: string
          due_date?: string
          id?: string
          issue_date?: string
          job_id?: string | null
          metadata?: Json | null
          notes?: string | null
          organization_id?: string
          paid_date?: string | null
          payment_link?: string | null
          payment_method?: string | null
          pdf_url?: string | null
          polar_checkout_url?: string | null
          quote_id?: string | null
          receipt_email?: string | null
          receipt_url?: string | null
          secure_token?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          stripe_payment_intent_id?: string | null
          subtotal?: number | null
          tax?: number | null
          tax_rate?: number | null
          total?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      iot_devices: {
        Row: {
          battery_level: number | null
          config: Json | null
          created_at: string | null
          device_type: string
          firmware_version: string | null
          id: string
          last_seen_at: string | null
          linked_asset_id: string | null
          mac_address: string | null
          name: string
          organization_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          battery_level?: number | null
          config?: Json | null
          created_at?: string | null
          device_type?: string
          firmware_version?: string | null
          id?: string
          last_seen_at?: string | null
          linked_asset_id?: string | null
          mac_address?: string | null
          name: string
          organization_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          battery_level?: number | null
          config?: Json | null
          created_at?: string | null
          device_type?: string
          firmware_version?: string | null
          id?: string
          last_seen_at?: string | null
          linked_asset_id?: string | null
          mac_address?: string | null
          name?: string
          organization_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "iot_devices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      iot_readings: {
        Row: {
          alert_triggered: boolean | null
          created_at: string | null
          device_id: string
          id: string
          job_id: string | null
          max_threshold: number | null
          metadata: Json | null
          min_threshold: number | null
          organization_id: string
          reading_type: string
          recorded_at: string | null
          snapshot_url: string | null
          unit: string
          user_id: string | null
          value: number
        }
        Insert: {
          alert_triggered?: boolean | null
          created_at?: string | null
          device_id: string
          id?: string
          job_id?: string | null
          max_threshold?: number | null
          metadata?: Json | null
          min_threshold?: number | null
          organization_id: string
          reading_type: string
          recorded_at?: string | null
          snapshot_url?: string | null
          unit: string
          user_id?: string | null
          value: number
        }
        Update: {
          alert_triggered?: boolean | null
          created_at?: string | null
          device_id?: string
          id?: string
          job_id?: string | null
          max_threshold?: number | null
          metadata?: Json | null
          min_threshold?: number | null
          organization_id?: string
          reading_type?: string
          recorded_at?: string | null
          snapshot_url?: string | null
          unit?: string
          user_id?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "iot_readings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "iot_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iot_readings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iot_readings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_activity: {
        Row: {
          created_at: string | null
          id: string
          job_id: string
          metadata: Json | null
          photos: string[] | null
          text: string
          type: Database["public"]["Enums"]["activity_type"]
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          job_id: string
          metadata?: Json | null
          photos?: string[] | null
          text: string
          type: Database["public"]["Enums"]["activity_type"]
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          job_id?: string
          metadata?: Json | null
          photos?: string[] | null
          text?: string
          type?: Database["public"]["Enums"]["activity_type"]
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_activity_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_activity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_line_items: {
        Row: {
          created_at: string | null
          description: string
          id: string
          job_id: string
          quantity: number
          sort_order: number
          unit_price_cents: number
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          job_id: string
          quantity?: number
          sort_order?: number
          unit_price_cents?: number
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          job_id?: string
          quantity?: number
          sort_order?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_line_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_media: {
        Row: {
          annotations: Json | null
          caption: string | null
          created_at: string | null
          file_size_bytes: number | null
          file_type: string
          file_url: string
          id: string
          job_id: string
          location_lat: number | null
          location_lng: number | null
          metadata: Json | null
          organization_id: string
          taken_at: string | null
          thumbnail_url: string | null
          uploaded_by: string
          watermark_data: Json | null
        }
        Insert: {
          annotations?: Json | null
          caption?: string | null
          created_at?: string | null
          file_size_bytes?: number | null
          file_type?: string
          file_url: string
          id?: string
          job_id: string
          location_lat?: number | null
          location_lng?: number | null
          metadata?: Json | null
          organization_id: string
          taken_at?: string | null
          thumbnail_url?: string | null
          uploaded_by: string
          watermark_data?: Json | null
        }
        Update: {
          annotations?: Json | null
          caption?: string | null
          created_at?: string | null
          file_size_bytes?: number | null
          file_type?: string
          file_url?: string
          id?: string
          job_id?: string
          location_lat?: number | null
          location_lng?: number | null
          metadata?: Json | null
          organization_id?: string
          taken_at?: string | null
          thumbnail_url?: string | null
          uploaded_by?: string
          watermark_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "job_media_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_media_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_media_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_subtasks: {
        Row: {
          completed: boolean | null
          created_at: string | null
          id: string
          job_id: string
          sort_order: number | null
          title: string
        }
        Insert: {
          completed?: boolean | null
          created_at?: string | null
          id?: string
          job_id: string
          sort_order?: number | null
          title: string
        }
        Update: {
          completed?: boolean | null
          created_at?: string | null
          id?: string
          job_id?: string
          sort_order?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_subtasks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_timer_sessions: {
        Row: {
          created_at: string | null
          duration_seconds: number | null
          end_lat: number | null
          end_lng: number | null
          ended_at: string | null
          id: string
          job_id: string
          organization_id: string
          start_lat: number | null
          start_lng: number | null
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          duration_seconds?: number | null
          end_lat?: number | null
          end_lng?: number | null
          ended_at?: string | null
          id?: string
          job_id: string
          organization_id: string
          start_lat?: number | null
          start_lng?: number | null
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          duration_seconds?: number | null
          end_lat?: number | null
          end_lng?: number | null
          ended_at?: string | null
          id?: string
          job_id?: string
          organization_id?: string
          start_lat?: number | null
          start_lng?: number | null
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_timer_sessions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_timer_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_timer_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          actual_hours: number | null
          assignee_id: string | null
          client_id: string | null
          cost: number | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          description: string | null
          display_id: string
          due_date: string | null
          estimated_duration_minutes: number | null
          estimated_hours: number | null
          id: string
          labels: string[] | null
          location: string | null
          location_lat: number | null
          location_lng: number | null
          metadata: Json | null
          organization_id: string
          priority: Database["public"]["Enums"]["job_priority"] | null
          revenue: number | null
          status: Database["public"]["Enums"]["job_status"] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          actual_hours?: number | null
          assignee_id?: string | null
          client_id?: string | null
          cost?: number | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          display_id: string
          due_date?: string | null
          estimated_duration_minutes?: number | null
          estimated_hours?: number | null
          id?: string
          labels?: string[] | null
          location?: string | null
          location_lat?: number | null
          location_lng?: number | null
          metadata?: Json | null
          organization_id: string
          priority?: Database["public"]["Enums"]["job_priority"] | null
          revenue?: number | null
          status?: Database["public"]["Enums"]["job_status"] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          actual_hours?: number | null
          assignee_id?: string | null
          client_id?: string | null
          cost?: number | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          display_id?: string
          due_date?: string | null
          estimated_duration_minutes?: number | null
          estimated_hours?: number | null
          id?: string
          labels?: string[] | null
          location?: string | null
          location_lat?: number | null
          location_lng?: number | null
          metadata?: Json | null
          organization_id?: string
          priority?: Database["public"]["Enums"]["job_priority"] | null
          revenue?: number | null
          status?: Database["public"]["Enums"]["job_status"] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_articles: {
        Row: {
          category: string | null
          created_at: string | null
          created_by: string | null
          file_size_bytes: number | null
          file_type: string | null
          file_url: string | null
          id: string
          is_pinned: boolean | null
          manufacturer: string | null
          metadata: Json | null
          model_number: string | null
          organization_id: string
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          file_size_bytes?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_pinned?: boolean | null
          manufacturer?: string | null
          metadata?: Json | null
          model_number?: string | null
          organization_id: string
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          file_size_bytes?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_pinned?: boolean | null
          manufacturer?: string | null
          metadata?: Json | null
          model_number?: string | null
          organization_id?: string
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_articles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_articles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          days: number
          end_date: string
          id: string
          notes: string | null
          organization_id: string
          reason: string | null
          start_date: string
          status: string
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          days?: number
          end_date: string
          id?: string
          notes?: string | null
          organization_id: string
          reason?: string | null
          start_date: string
          status?: string
          type?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          days?: number
          end_date?: string
          id?: string
          notes?: string | null
          organization_id?: string
          reason?: string | null
          start_date?: string
          status?: string
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      load_sheet_predictions: {
        Row: {
          acknowledged: boolean | null
          acknowledged_at: string | null
          created_at: string | null
          id: string
          items: Json
          organization_id: string
          prediction_date: string
          user_id: string
        }
        Insert: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          created_at?: string | null
          id?: string
          items?: Json
          organization_id: string
          prediction_date?: string
          user_id: string
        }
        Update: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          created_at?: string | null
          id?: string
          items?: Json
          organization_id?: string
          prediction_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "load_sheet_predictions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_sheet_predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mail_queue: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_type: string
          id: string
          organization_id: string
          payload: Json
          processed_at: string | null
          recipient_email: string
          retry_count: number | null
          status: Database["public"]["Enums"]["mail_queue_status"] | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          organization_id: string
          payload?: Json
          processed_at?: string | null
          recipient_email: string
          retry_count?: number | null
          status?: Database["public"]["Enums"]["mail_queue_status"] | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          organization_id?: string
          payload?: Json
          processed_at?: string | null
          recipient_email?: string
          retry_count?: number | null
          status?: Database["public"]["Enums"]["mail_queue_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "mail_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      market_benchmarks: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          period: string
          period_end: string
          period_start: string
          price_avg: number
          price_high: number
          price_low: number
          price_median: number
          price_p25: number
          price_p75: number
          price_stddev: number | null
          region_code: string
          sample_size: number
          service_category: string
          service_type: string | null
          updated_at: string
          win_rate_high: number | null
          win_rate_low: number | null
          win_rate_median: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          period?: string
          period_end: string
          period_start: string
          price_avg?: number
          price_high?: number
          price_low?: number
          price_median?: number
          price_p25?: number
          price_p75?: number
          price_stddev?: number | null
          region_code?: string
          sample_size?: number
          service_category: string
          service_type?: string | null
          updated_at?: string
          win_rate_high?: number | null
          win_rate_low?: number | null
          win_rate_median?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          period?: string
          period_end?: string
          period_start?: string
          price_avg?: number
          price_high?: number
          price_low?: number
          price_median?: number
          price_p25?: number
          price_p75?: number
          price_stddev?: number | null
          region_code?: string
          sample_size?: number
          service_category?: string
          service_type?: string | null
          updated_at?: string
          win_rate_high?: number | null
          win_rate_low?: number | null
          win_rate_median?: number | null
        }
        Relationships: []
      }
      market_pricing_data: {
        Row: {
          capacity: string | null
          created_at: string
          id: string
          job_title: string | null
          line_item_count: number
          location_lat: number | null
          location_lng: number | null
          metadata: Json | null
          organization_id: string
          quote_id: string | null
          quote_status: string | null
          region_code: string
          service_category: string
          service_type: string | null
          total_price: number
          updated_at: string
        }
        Insert: {
          capacity?: string | null
          created_at?: string
          id?: string
          job_title?: string | null
          line_item_count?: number
          location_lat?: number | null
          location_lng?: number | null
          metadata?: Json | null
          organization_id: string
          quote_id?: string | null
          quote_status?: string | null
          region_code?: string
          service_category: string
          service_type?: string | null
          total_price?: number
          updated_at?: string
        }
        Update: {
          capacity?: string | null
          created_at?: string
          id?: string
          job_title?: string | null
          line_item_count?: number
          location_lat?: number | null
          location_lng?: number | null
          metadata?: Json | null
          organization_id?: string
          quote_id?: string | null
          quote_status?: string | null
          region_code?: string
          service_category?: string
          service_type?: string | null
          total_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_pricing_data_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_pricing_data_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      market_trends: {
        Row: {
          avg_price: number
          created_at: string
          high_price: number | null
          id: string
          low_price: number | null
          median_price: number
          metadata: Json | null
          period_end: string
          period_start: string
          price_change_pct: number | null
          region_code: string
          service_category: string
          service_type: string | null
          volume: number
        }
        Insert: {
          avg_price?: number
          created_at?: string
          high_price?: number | null
          id?: string
          low_price?: number | null
          median_price?: number
          metadata?: Json | null
          period_end: string
          period_start: string
          price_change_pct?: number | null
          region_code?: string
          service_category: string
          service_type?: string | null
          volume?: number
        }
        Update: {
          avg_price?: number
          created_at?: string
          high_price?: number | null
          id?: string
          low_price?: number | null
          median_price?: number
          metadata?: Json | null
          period_end?: string
          period_start?: string
          price_change_pct?: number | null
          region_code?: string
          service_category?: string
          service_type?: string | null
          volume?: number
        }
        Relationships: []
      }
      medication_administration_records: {
        Row: {
          administered_at: string
          created_at: string
          id: string
          medication_id: string
          notes: string | null
          organization_id: string
          outcome: Database["public"]["Enums"]["mar_outcome"]
          participant_id: string
          prn_effectiveness: string | null
          prn_followup_at: string | null
          prn_followup_done: boolean | null
          shift_id: string | null
          witness_id: string | null
          worker_id: string
        }
        Insert: {
          administered_at?: string
          created_at?: string
          id?: string
          medication_id: string
          notes?: string | null
          organization_id: string
          outcome: Database["public"]["Enums"]["mar_outcome"]
          participant_id: string
          prn_effectiveness?: string | null
          prn_followup_at?: string | null
          prn_followup_done?: boolean | null
          shift_id?: string | null
          witness_id?: string | null
          worker_id: string
        }
        Update: {
          administered_at?: string
          created_at?: string
          id?: string
          medication_id?: string
          notes?: string | null
          organization_id?: string
          outcome?: Database["public"]["Enums"]["mar_outcome"]
          participant_id?: string
          prn_effectiveness?: string | null
          prn_followup_at?: string | null
          prn_followup_done?: boolean | null
          shift_id?: string | null
          witness_id?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_administration_records_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "participant_medications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_administration_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_administration_records_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_administration_records_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_administration_records_witness_id_fkey"
            columns: ["witness_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_administration_records_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_acknowledgements: {
        Row: {
          acknowledged_at: string
          message_id: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          message_id: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_acknowledgements_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "care_chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          channel_id: string
          content: string
          created_at: string | null
          deleted_at: string | null
          edited_at: string | null
          id: string
          metadata: Json | null
          reactions: Json | null
          reply_to_id: string | null
          sender_id: string
          type: Database["public"]["Enums"]["message_type"]
        }
        Insert: {
          channel_id: string
          content?: string
          created_at?: string | null
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          metadata?: Json | null
          reactions?: Json | null
          reply_to_id?: string | null
          sender_id: string
          type?: Database["public"]["Enums"]["message_type"]
        }
        Update: {
          channel_id?: string
          content?: string
          created_at?: string | null
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          metadata?: Json | null
          reactions?: Json | null
          reply_to_id?: string | null
          sender_id?: string
          type?: Database["public"]["Enums"]["message_type"]
        }
        Relationships: [
          {
            foreignKeyName: "messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ndis_catalogue: {
        Row: {
          base_rate_national: number
          base_rate_remote: number | null
          base_rate_very_remote: number | null
          cancellation_eligible: boolean | null
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          irregularity_indicator: string | null
          is_group_based: boolean | null
          non_face_to_face_eligible: boolean | null
          provider_travel_eligible: boolean | null
          registration_group: string | null
          support_category: string
          support_item_name: string
          support_item_number: string
          unit: string
        }
        Insert: {
          base_rate_national: number
          base_rate_remote?: number | null
          base_rate_very_remote?: number | null
          cancellation_eligible?: boolean | null
          created_at?: string
          effective_from: string
          effective_to?: string | null
          id?: string
          irregularity_indicator?: string | null
          is_group_based?: boolean | null
          non_face_to_face_eligible?: boolean | null
          provider_travel_eligible?: boolean | null
          registration_group?: string | null
          support_category: string
          support_item_name: string
          support_item_number: string
          unit: string
        }
        Update: {
          base_rate_national?: number
          base_rate_remote?: number | null
          base_rate_very_remote?: number | null
          cancellation_eligible?: boolean | null
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          irregularity_indicator?: string | null
          is_group_based?: boolean | null
          non_face_to_face_eligible?: boolean | null
          provider_travel_eligible?: boolean | null
          registration_group?: string | null
          support_category?: string
          support_item_name?: string
          support_item_number?: string
          unit?: string
        }
        Relationships: []
      }
      ndis_region_modifiers: {
        Row: {
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          label: string
          mmm_classification: number
          modifier_percentage: number
        }
        Insert: {
          created_at?: string
          effective_from: string
          effective_to?: string | null
          id?: string
          label: string
          mmm_classification: number
          modifier_percentage: number
        }
        Update: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          label?: string
          mmm_classification?: number
          modifier_percentage?: number
        }
        Relationships: []
      }
      ndis_sync_log: {
        Row: {
          created_at: string
          effective_from: string
          error_message: string | null
          filename: string | null
          id: string
          items_closed: number
          items_inserted: number
          items_updated: number
          organization_id: string | null
          source: string
          status: string
          synced_by: string | null
        }
        Insert: {
          created_at?: string
          effective_from: string
          error_message?: string | null
          filename?: string | null
          id?: string
          items_closed?: number
          items_inserted?: number
          items_updated?: number
          organization_id?: string | null
          source?: string
          status?: string
          synced_by?: string | null
        }
        Update: {
          created_at?: string
          effective_from?: string
          error_message?: string | null
          filename?: string | null
          id?: string
          items_closed?: number
          items_inserted?: number
          items_updated?: number
          organization_id?: string | null
          source?: string
          status?: string
          synced_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ndis_sync_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_replies: {
        Row: {
          body: string
          created_at: string
          id: string
          notification_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          notification_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          notification_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_replies_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_link: string | null
          action_type: string | null
          archived: boolean | null
          body: string | null
          context: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          organization_id: string
          read: boolean | null
          related_client_id: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          related_job_id: string | null
          sender_id: string | null
          sender_name: string | null
          snoozed_until: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          action_link?: string | null
          action_type?: string | null
          archived?: boolean | null
          body?: string | null
          context?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          organization_id: string
          read?: boolean | null
          related_client_id?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          related_job_id?: string | null
          sender_id?: string | null
          sender_name?: string | null
          snoozed_until?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          action_link?: string | null
          action_type?: string | null
          archived?: boolean | null
          body?: string | null
          context?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          read?: boolean | null
          related_client_id?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          related_job_id?: string | null
          sender_id?: string | null
          sender_name?: string | null
          snoozed_until?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_client_id_fkey"
            columns: ["related_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_job_id_fkey"
            columns: ["related_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_checklists: {
        Row: {
          authorised_at: string | null
          authorised_to_work: boolean | null
          checklist_items: Json
          created_at: string | null
          id: string
          notes: string | null
          organization_id: string
          signed_off_at: string | null
          signed_off_by: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          authorised_at?: string | null
          authorised_to_work?: boolean | null
          checklist_items?: Json
          created_at?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          signed_off_at?: string | null
          signed_off_by?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          authorised_at?: string | null
          authorised_to_work?: boolean | null
          checklist_items?: Json
          created_at?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          signed_off_at?: string | null
          signed_off_by?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_checklists_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_features: {
        Row: {
          beta_advanced_analytics: boolean | null
          beta_ai_scheduling: boolean | null
          beta_family_portal: boolean | null
          beta_mobile_offline: boolean | null
          beta_proda_claims: boolean | null
          created_at: string
          manual_tier_override: string | null
          max_api_calls_daily: number | null
          max_sms_monthly: number | null
          max_storage_gb: number | null
          organization_id: string
          override_expires_at: string | null
          override_reason: string | null
          override_set_by: string | null
          updated_at: string
        }
        Insert: {
          beta_advanced_analytics?: boolean | null
          beta_ai_scheduling?: boolean | null
          beta_family_portal?: boolean | null
          beta_mobile_offline?: boolean | null
          beta_proda_claims?: boolean | null
          created_at?: string
          manual_tier_override?: string | null
          max_api_calls_daily?: number | null
          max_sms_monthly?: number | null
          max_storage_gb?: number | null
          organization_id: string
          override_expires_at?: string | null
          override_reason?: string | null
          override_set_by?: string | null
          updated_at?: string
        }
        Update: {
          beta_advanced_analytics?: boolean | null
          beta_ai_scheduling?: boolean | null
          beta_family_portal?: boolean | null
          beta_mobile_offline?: boolean | null
          beta_proda_claims?: boolean | null
          created_at?: string
          manual_tier_override?: string | null
          max_api_calls_daily?: number | null
          max_sms_monthly?: number | null
          max_storage_gb?: number | null
          organization_id?: string
          override_expires_at?: string | null
          override_reason?: string | null
          override_set_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_features_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invites: {
        Row: {
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          role_id: string | null
          status: Database["public"]["Enums"]["invite_status"]
          token: string
        }
        Insert: {
          created_at?: string | null
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          role_id?: string | null
          status?: Database["public"]["Enums"]["invite_status"]
          token?: string
        }
        Update: {
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          role_id?: string | null
          status?: Database["public"]["Enums"]["invite_status"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_invites_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "organization_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          branch: string | null
          hourly_rate: number | null
          invited_by: string | null
          joined_at: string | null
          last_active_at: string | null
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          role_id: string | null
          skills: string[] | null
          status: Database["public"]["Enums"]["member_status"]
          user_id: string
        }
        Insert: {
          branch?: string | null
          hourly_rate?: number | null
          invited_by?: string | null
          joined_at?: string | null
          last_active_at?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          role_id?: string | null
          skills?: string[] | null
          status?: Database["public"]["Enums"]["member_status"]
          user_id: string
        }
        Update: {
          branch?: string | null
          hourly_rate?: number | null
          invited_by?: string | null
          joined_at?: string | null
          last_active_at?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          role_id?: string | null
          skills?: string[] | null
          status?: Database["public"]["Enums"]["member_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "organization_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_roles: {
        Row: {
          color: string
          created_at: string | null
          id: string
          is_system_role: boolean | null
          name: string
          organization_id: string
          permissions: Json
          scopes: Json
        }
        Insert: {
          color?: string
          created_at?: string | null
          id?: string
          is_system_role?: boolean | null
          name: string
          organization_id: string
          permissions?: Json
          scopes?: Json
        }
        Update: {
          color?: string
          created_at?: string | null
          id?: string
          is_system_role?: boolean | null
          name?: string
          organization_id?: string
          permissions?: Json
          scopes?: Json
        }
        Relationships: [
          {
            foreignKeyName: "organization_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          billing_provider: string
          brand_color_hex: string | null
          brand_logo_url: string | null
          charges_enabled: boolean
          connect_onboarded_at: string | null
          created_at: string | null
          id: string
          industry_type: string
          logo_url: string | null
          name: string
          payouts_enabled: boolean
          plan_tier: string
          platform_fee_percent: number
          polar_customer_id: string | null
          rc_original_app_user_id: string | null
          settings: Json | null
          slug: string
          stripe_account_id: string | null
          stripe_customer_id: string | null
          subscription_active_until: string | null
          trade: string | null
          updated_at: string | null
        }
        Insert: {
          billing_provider?: string
          brand_color_hex?: string | null
          brand_logo_url?: string | null
          charges_enabled?: boolean
          connect_onboarded_at?: string | null
          created_at?: string | null
          id?: string
          industry_type?: string
          logo_url?: string | null
          name: string
          payouts_enabled?: boolean
          plan_tier?: string
          platform_fee_percent?: number
          polar_customer_id?: string | null
          rc_original_app_user_id?: string | null
          settings?: Json | null
          slug: string
          stripe_account_id?: string | null
          stripe_customer_id?: string | null
          subscription_active_until?: string | null
          trade?: string | null
          updated_at?: string | null
        }
        Update: {
          billing_provider?: string
          brand_color_hex?: string | null
          brand_logo_url?: string | null
          charges_enabled?: boolean
          connect_onboarded_at?: string | null
          created_at?: string | null
          id?: string
          industry_type?: string
          logo_url?: string | null
          name?: string
          payouts_enabled?: boolean
          plan_tier?: string
          platform_fee_percent?: number
          polar_customer_id?: string | null
          rc_original_app_user_id?: string | null
          settings?: Json | null
          slug?: string
          stripe_account_id?: string | null
          stripe_customer_id?: string | null
          subscription_active_until?: string | null
          trade?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      participant_medications: {
        Row: {
          created_at: string
          dosage: string
          end_date: string | null
          frequency: Database["public"]["Enums"]["medication_frequency"]
          generic_name: string | null
          id: string
          is_active: boolean
          is_prn: boolean
          medication_name: string
          organization_id: string
          participant_id: string
          pharmacy: string | null
          prescribing_doctor: string | null
          prn_reason: string | null
          route: Database["public"]["Enums"]["medication_route"]
          special_instructions: string | null
          start_date: string | null
          time_slots: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          dosage: string
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["medication_frequency"]
          generic_name?: string | null
          id?: string
          is_active?: boolean
          is_prn?: boolean
          medication_name: string
          organization_id: string
          participant_id: string
          pharmacy?: string | null
          prescribing_doctor?: string | null
          prn_reason?: string | null
          route?: Database["public"]["Enums"]["medication_route"]
          special_instructions?: string | null
          start_date?: string | null
          time_slots?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          dosage?: string
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["medication_frequency"]
          generic_name?: string | null
          id?: string
          is_active?: boolean
          is_prn?: boolean
          medication_name?: string
          organization_id?: string
          participant_id?: string
          pharmacy?: string | null
          prescribing_doctor?: string | null
          prn_reason?: string | null
          route?: Database["public"]["Enums"]["medication_route"]
          special_instructions?: string | null
          start_date?: string | null
          time_slots?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_medications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_medications_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_profiles: {
        Row: {
          address: string | null
          address_lat: number | null
          address_lng: number | null
          client_id: string
          communication_preferences: string | null
          communication_type: string | null
          created_at: string
          critical_alerts: string[] | null
          date_of_birth: string | null
          emergency_contacts: Json | null
          gender: string | null
          id: string
          intake_status: string | null
          management_type: string | null
          mobility_requirements: string | null
          mobility_status: string | null
          ndis_number: string | null
          notes: string | null
          organization_id: string
          plan_manager_id: string | null
          preferred_name: string | null
          primary_diagnosis: string | null
          primary_nominee: Json | null
          status: string | null
          support_categories: string[] | null
          support_coordinator_id: string | null
          triggers_and_risks: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          address_lat?: number | null
          address_lng?: number | null
          client_id: string
          communication_preferences?: string | null
          communication_type?: string | null
          created_at?: string
          critical_alerts?: string[] | null
          date_of_birth?: string | null
          emergency_contacts?: Json | null
          gender?: string | null
          id?: string
          intake_status?: string | null
          management_type?: string | null
          mobility_requirements?: string | null
          mobility_status?: string | null
          ndis_number?: string | null
          notes?: string | null
          organization_id: string
          plan_manager_id?: string | null
          preferred_name?: string | null
          primary_diagnosis?: string | null
          primary_nominee?: Json | null
          status?: string | null
          support_categories?: string[] | null
          support_coordinator_id?: string | null
          triggers_and_risks?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          address_lat?: number | null
          address_lng?: number | null
          client_id?: string
          communication_preferences?: string | null
          communication_type?: string | null
          created_at?: string
          critical_alerts?: string[] | null
          date_of_birth?: string | null
          emergency_contacts?: Json | null
          gender?: string | null
          id?: string
          intake_status?: string | null
          management_type?: string | null
          mobility_requirements?: string | null
          mobility_status?: string | null
          ndis_number?: string | null
          notes?: string | null
          organization_id?: string
          plan_manager_id?: string | null
          preferred_name?: string | null
          primary_diagnosis?: string | null
          primary_nominee?: Json | null
          status?: string | null
          support_categories?: string[] | null
          support_coordinator_id?: string | null
          triggers_and_risks?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_profiles_plan_manager_id_fkey"
            columns: ["plan_manager_id"]
            isOneToOne: false
            referencedRelation: "external_agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_profiles_support_coordinator_id_fkey"
            columns: ["support_coordinator_id"]
            isOneToOne: false
            referencedRelation: "external_agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          client_email: string | null
          client_name: string | null
          collected_by: string | null
          created_at: string
          currency: string
          id: string
          invoice_id: string | null
          metadata: Json | null
          organization_id: string
          payment_method: string
          platform_fee_cents: number
          status: string
          stripe_charge_id: string | null
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          client_email?: string | null
          client_name?: string | null
          collected_by?: string | null
          created_at?: string
          currency?: string
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          organization_id: string
          payment_method?: string
          platform_fee_cents?: number
          status?: string
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          client_email?: string | null
          client_name?: string | null
          collected_by?: string | null
          created_at?: string
          currency?: string
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          organization_id?: string
          payment_method?: string
          platform_fee_cents?: number
          status?: string
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount: number
          bank: string | null
          created_at: string | null
          id: string
          invoice_ids: string[] | null
          metadata: Json | null
          organization_id: string
          payout_date: string
          status: Database["public"]["Enums"]["payout_status"] | null
        }
        Insert: {
          amount: number
          bank?: string | null
          created_at?: string | null
          id?: string
          invoice_ids?: string[] | null
          metadata?: Json | null
          organization_id: string
          payout_date: string
          status?: Database["public"]["Enums"]["payout_status"] | null
        }
        Update: {
          amount?: number
          bank?: string | null
          created_at?: string | null
          id?: string
          invoice_ids?: string[] | null
          metadata?: Json | null
          organization_id?: string
          payout_date?: string
          status?: Database["public"]["Enums"]["payout_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "payouts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_exports: {
        Row: {
          api_response: Json | null
          batch_status: string
          created_at: string
          error_details: Json | null
          exported_by: string | null
          id: string
          organization_id: string
          period_end: string
          period_start: string
          target_platform: string
          timesheet_ids: string[]
          total_cost: number | null
          total_hours: number | null
          worker_count: number | null
        }
        Insert: {
          api_response?: Json | null
          batch_status?: string
          created_at?: string
          error_details?: Json | null
          exported_by?: string | null
          id?: string
          organization_id: string
          period_end: string
          period_start: string
          target_platform: string
          timesheet_ids: string[]
          total_cost?: number | null
          total_hours?: number | null
          worker_count?: number | null
        }
        Update: {
          api_response?: Json | null
          batch_status?: string
          created_at?: string
          error_details?: Json | null
          exported_by?: string | null
          id?: string
          organization_id?: string
          period_end?: string
          period_start?: string
          target_platform?: string
          timesheet_ids?: string[]
          total_cost?: number | null
          total_hours?: number | null
          worker_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_exports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_events: {
        Row: {
          created_at: string | null
          entity_id: string
          entity_type: string
          error: string | null
          event_type: string
          id: string
          idempotency_key: string | null
          organization_id: string
          payload: Json | null
          source: string
          status: string
        }
        Insert: {
          created_at?: string | null
          entity_id: string
          entity_type: string
          error?: string | null
          event_type: string
          id?: string
          idempotency_key?: string | null
          organization_id: string
          payload?: Json | null
          source?: string
          status?: string
        }
        Update: {
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          error?: string | null
          event_type?: string
          id?: string
          idempotency_key?: string | null
          organization_id?: string
          payload?: Json | null
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_manager_invoices: {
        Row: {
          created_at: string
          extracted_line_items: Json | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          matched_participant_confidence: number | null
          notes: string | null
          ocr_raw_output: Json | null
          organization_id: string
          participant_id: string | null
          pdf_url: string | null
          provider_name: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_abn: string | null
          source_email: string | null
          status: string
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          extracted_line_items?: Json | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          matched_participant_confidence?: number | null
          notes?: string | null
          ocr_raw_output?: Json | null
          organization_id: string
          participant_id?: string | null
          pdf_url?: string | null
          provider_name?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_abn?: string | null
          source_email?: string | null
          status: string
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          extracted_line_items?: Json | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          matched_participant_confidence?: number | null
          notes?: string | null
          ocr_raw_output?: Json | null
          organization_id?: string
          participant_id?: string | null
          pdf_url?: string | null
          provider_name?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_abn?: string | null
          source_email?: string | null
          status?: string
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_manager_invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_manager_invoices_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_manager_invoices_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_acknowledgements: {
        Row: {
          acknowledged_at: string
          id: string
          organization_id: string
          policy_id: string
          policy_version: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          id?: string
          organization_id: string
          policy_id: string
          policy_version: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          id?: string
          organization_id?: string
          policy_id?: string
          policy_version?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_acknowledgements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_acknowledgements_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policy_register"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_register: {
        Row: {
          acknowledgement_deadline: string | null
          approved_at: string | null
          approved_by: string | null
          category: string
          content: string | null
          created_at: string | null
          created_by: string | null
          document_url: string | null
          effective_date: string | null
          id: string
          organization_id: string
          requires_acknowledgement: boolean | null
          review_date: string | null
          status: string
          title: string
          updated_at: string | null
          version: string
        }
        Insert: {
          acknowledgement_deadline?: string | null
          approved_at?: string | null
          approved_by?: string | null
          category: string
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          document_url?: string | null
          effective_date?: string | null
          id?: string
          organization_id: string
          requires_acknowledgement?: boolean | null
          review_date?: string | null
          status?: string
          title: string
          updated_at?: string | null
          version?: string
        }
        Update: {
          acknowledgement_deadline?: string | null
          approved_at?: string | null
          approved_by?: string | null
          category?: string
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          document_url?: string | null
          effective_date?: string | null
          id?: string
          organization_id?: string
          requires_acknowledgement?: boolean | null
          review_date?: string | null
          status?: string
          title?: string
          updated_at?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_register_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          created_at: string | null
          id: string
          option_index: number
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          option_index: number
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          option_index?: number
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          channel_id: string
          closes_at: string | null
          created_at: string | null
          id: string
          is_anonymous: boolean | null
          is_closed: boolean | null
          message_id: string
          options: Json
          question: string
        }
        Insert: {
          channel_id: string
          closes_at?: string | null
          created_at?: string | null
          id?: string
          is_anonymous?: boolean | null
          is_closed?: boolean | null
          message_id: string
          options?: Json
          question: string
        }
        Update: {
          channel_id?: string
          closes_at?: string | null
          created_at?: string | null
          id?: string
          is_anonymous?: boolean | null
          is_closed?: boolean | null
          message_id?: string
          options?: Json
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "polls_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      position_history: {
        Row: {
          heading: number | null
          id: string
          lat: number
          lng: number
          organization_id: string
          recorded_at: string
          speed: number | null
          status: string
          user_id: string
        }
        Insert: {
          heading?: number | null
          id?: string
          lat: number
          lng: number
          organization_id: string
          recorded_at?: string
          speed?: number | null
          status?: string
          user_id: string
        }
        Update: {
          heading?: number | null
          id?: string
          lat?: number
          lng?: number
          organization_id?: string
          recorded_at?: string
          speed?: number | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "position_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      proda_claim_batches: {
        Row: {
          batch_number: string
          created_at: string
          error_log: Json | null
          failed_claims: number | null
          id: string
          notes: string | null
          organization_id: string
          paid_amount: number | null
          payload_url: string | null
          proda_reference: string | null
          reconciled_at: string | null
          remittance_url: string | null
          status: Database["public"]["Enums"]["proda_batch_status"]
          submitted_at: string | null
          submitted_by: string | null
          successful_claims: number | null
          total_amount: number
          total_claims: number
          updated_at: string
        }
        Insert: {
          batch_number: string
          created_at?: string
          error_log?: Json | null
          failed_claims?: number | null
          id?: string
          notes?: string | null
          organization_id: string
          paid_amount?: number | null
          payload_url?: string | null
          proda_reference?: string | null
          reconciled_at?: string | null
          remittance_url?: string | null
          status?: Database["public"]["Enums"]["proda_batch_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          successful_claims?: number | null
          total_amount?: number
          total_claims?: number
          updated_at?: string
        }
        Update: {
          batch_number?: string
          created_at?: string
          error_log?: Json | null
          failed_claims?: number | null
          id?: string
          notes?: string | null
          organization_id?: string
          paid_amount?: number | null
          payload_url?: string | null
          proda_reference?: string | null
          reconciled_at?: string | null
          remittance_url?: string | null
          status?: Database["public"]["Enums"]["proda_batch_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          successful_claims?: number | null
          total_amount?: number
          total_claims?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proda_claim_batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proda_claim_batches_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          dashboard_layout: Json | null
          email: string
          email_bounced: boolean | null
          fcm_token: string | null
          full_name: string | null
          id: string
          is_super_admin: boolean | null
          notification_preferences: Json | null
          onboarding_completed: boolean | null
          phone: string | null
          preferences: Json | null
          push_enabled: boolean | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          dashboard_layout?: Json | null
          email: string
          email_bounced?: boolean | null
          fcm_token?: string | null
          full_name?: string | null
          id: string
          is_super_admin?: boolean | null
          notification_preferences?: Json | null
          onboarding_completed?: boolean | null
          phone?: string | null
          preferences?: Json | null
          push_enabled?: boolean | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          dashboard_layout?: Json | null
          email?: string
          email_bounced?: boolean | null
          fcm_token?: string | null
          full_name?: string | null
          id?: string
          is_super_admin?: boolean | null
          notification_preferences?: Json | null
          onboarding_completed?: boolean | null
          phone?: string | null
          preferences?: Json | null
          push_enabled?: boolean | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      progress_notes: {
        Row: {
          context_of_support: string | null
          created_at: string
          evv_end_lat: number | null
          evv_end_lng: number | null
          evv_end_time: string | null
          evv_start_lat: number | null
          evv_start_lng: number | null
          evv_start_time: string | null
          goals_linked: Json | null
          id: string
          job_id: string | null
          organization_id: string
          outcomes_achieved: string | null
          participant_id: string | null
          risks_identified: string | null
          worker_id: string
        }
        Insert: {
          context_of_support?: string | null
          created_at?: string
          evv_end_lat?: number | null
          evv_end_lng?: number | null
          evv_end_time?: string | null
          evv_start_lat?: number | null
          evv_start_lng?: number | null
          evv_start_time?: string | null
          goals_linked?: Json | null
          id?: string
          job_id?: string | null
          organization_id: string
          outcomes_achieved?: string | null
          participant_id?: string | null
          risks_identified?: string | null
          worker_id: string
        }
        Update: {
          context_of_support?: string | null
          created_at?: string
          evv_end_lat?: number | null
          evv_end_lng?: number | null
          evv_end_time?: string | null
          evv_start_lat?: number | null
          evv_start_lng?: number | null
          evv_start_time?: string | null
          goals_linked?: Json | null
          id?: string
          job_id?: string | null
          organization_id?: string
          outcomes_achieved?: string | null
          participant_id?: string | null
          risks_identified?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_notes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_notes_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_notes_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      public_holidays: {
        Row: {
          created_at: string
          date: string
          id: string
          name: string
          organization_id: string
          state: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          name: string
          organization_id: string
          state: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          name?: string
          organization_id?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_holidays_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_line_items: {
        Row: {
          created_at: string | null
          description: string
          id: string
          quantity: number | null
          quote_id: string
          sort_order: number | null
          tax_rate: number | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          quantity?: number | null
          quote_id: string
          sort_order?: number | null
          tax_rate?: number | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          quantity?: number | null
          quote_id?: string
          sort_order?: number | null
          tax_rate?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_line_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          client_address: string | null
          client_email: string | null
          client_id: string | null
          client_name: string | null
          created_at: string | null
          created_by: string | null
          display_id: string
          id: string
          invoice_id: string | null
          issue_date: string
          job_id: string | null
          metadata: Json | null
          notes: string | null
          organization_id: string
          secure_token: string
          signature_url: string | null
          signed_at: string | null
          signed_by: string | null
          status: Database["public"]["Enums"]["quote_status"]
          subtotal: number | null
          tax: number | null
          tax_rate: number | null
          terms: string | null
          title: string | null
          total: number | null
          updated_at: string | null
          valid_until: string | null
        }
        Insert: {
          client_address?: string | null
          client_email?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string | null
          created_by?: string | null
          display_id: string
          id?: string
          invoice_id?: string | null
          issue_date?: string
          job_id?: string | null
          metadata?: Json | null
          notes?: string | null
          organization_id: string
          secure_token?: string
          signature_url?: string | null
          signed_at?: string | null
          signed_by?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number | null
          tax?: number | null
          tax_rate?: number | null
          terms?: string | null
          title?: string | null
          total?: number | null
          updated_at?: string | null
          valid_until?: string | null
        }
        Update: {
          client_address?: string | null
          client_email?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string | null
          created_by?: string | null
          display_id?: string
          id?: string
          invoice_id?: string | null
          issue_date?: string
          job_id?: string | null
          metadata?: Json | null
          notes?: string | null
          organization_id?: string
          secure_token?: string
          signature_url?: string | null
          signed_at?: string | null
          signed_by?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number | null
          tax?: number | null
          tax_rate?: number | null
          terms?: string | null
          title?: string | null
          total?: number | null
          updated_at?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      restrictive_practices: {
        Row: {
          authorization_ref: string | null
          authorized_by: string | null
          behavior_after: string | null
          behavior_before: string | null
          behavior_during: string | null
          created_at: string
          debrief_completed_at: string | null
          debrief_notes: string | null
          duration_minutes: number | null
          end_time: string | null
          id: string
          incident_id: string
          organization_id: string
          participant_id: string
          practice_type: Database["public"]["Enums"]["restrictive_practice_type"]
          reason: string
          start_time: string
        }
        Insert: {
          authorization_ref?: string | null
          authorized_by?: string | null
          behavior_after?: string | null
          behavior_before?: string | null
          behavior_during?: string | null
          created_at?: string
          debrief_completed_at?: string | null
          debrief_notes?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          incident_id: string
          organization_id: string
          participant_id: string
          practice_type: Database["public"]["Enums"]["restrictive_practice_type"]
          reason: string
          start_time: string
        }
        Update: {
          authorization_ref?: string | null
          authorized_by?: string | null
          behavior_after?: string | null
          behavior_before?: string | null
          behavior_during?: string | null
          created_at?: string
          debrief_completed_at?: string | null
          debrief_notes?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          incident_id?: string
          organization_id?: string
          participant_id?: string
          practice_type?: Database["public"]["Enums"]["restrictive_practice_type"]
          reason?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "restrictive_practices_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restrictive_practices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restrictive_practices_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rollout_log: {
        Row: {
          committed_at: string | null
          committed_by: string | null
          conflicts_detail: Json | null
          created_at: string
          id: string
          organization_id: string
          rollout_end_date: string
          rollout_start_date: string
          status: string
          template_id: string | null
          total_committed: number
          total_conflicts: number
          total_projected: number
        }
        Insert: {
          committed_at?: string | null
          committed_by?: string | null
          conflicts_detail?: Json | null
          created_at?: string
          id?: string
          organization_id: string
          rollout_end_date: string
          rollout_start_date: string
          status?: string
          template_id?: string | null
          total_committed?: number
          total_conflicts?: number
          total_projected?: number
        }
        Update: {
          committed_at?: string | null
          committed_by?: string | null
          conflicts_detail?: Json | null
          created_at?: string
          id?: string
          organization_id?: string
          rollout_end_date?: string
          rollout_start_date?: string
          status?: string
          template_id?: string | null
          total_committed?: number
          total_conflicts?: number
          total_projected?: number
        }
        Relationships: [
          {
            foreignKeyName: "rollout_log_committed_by_fkey"
            columns: ["committed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rollout_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rollout_log_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "roster_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      roster_templates: {
        Row: {
          created_at: string
          created_by: string | null
          cycle_length_days: number
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          organization_id: string
          participant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          cycle_length_days: number
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          organization_id: string
          participant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cycle_length_days?: number
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          organization_id?: string
          participant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roster_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_templates_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      route_runs: {
        Row: {
          actual_finish_time: string | null
          created_at: string | null
          estimated_drive_minutes: number | null
          estimated_finish_time: string | null
          id: string
          job_sequence: Json
          metadata: Json | null
          optimized: boolean | null
          organization_id: string
          run_date: string
          status: string
          total_distance_km: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          actual_finish_time?: string | null
          created_at?: string | null
          estimated_drive_minutes?: number | null
          estimated_finish_time?: string | null
          id?: string
          job_sequence?: Json
          metadata?: Json | null
          optimized?: boolean | null
          organization_id: string
          run_date?: string
          status?: string
          total_distance_km?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          actual_finish_time?: string | null
          created_at?: string | null
          estimated_drive_minutes?: number | null
          estimated_finish_time?: string | null
          id?: string
          job_sequence?: Json
          metadata?: Json | null
          optimized?: boolean | null
          organization_id?: string
          run_date?: string
          status?: string
          total_distance_km?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_runs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_assessments: {
        Row: {
          assessed_by: string | null
          assessor_name: string | null
          control_measures: Json
          created_at: string | null
          hazards: Json
          id: string
          job_id: string
          location_lat: number | null
          location_lng: number | null
          lone_worker_enabled: boolean
          metadata: Json | null
          notes: string | null
          organization_id: string
          signed_at: string | null
          site_safe: boolean
          status: string
          updated_at: string | null
        }
        Insert: {
          assessed_by?: string | null
          assessor_name?: string | null
          control_measures?: Json
          created_at?: string | null
          hazards?: Json
          id?: string
          job_id: string
          location_lat?: number | null
          location_lng?: number | null
          lone_worker_enabled?: boolean
          metadata?: Json | null
          notes?: string | null
          organization_id: string
          signed_at?: string | null
          site_safe?: boolean
          status?: string
          updated_at?: string | null
        }
        Update: {
          assessed_by?: string | null
          assessor_name?: string | null
          control_measures?: Json
          created_at?: string | null
          hazards?: Json
          id?: string
          job_id?: string
          location_lat?: number | null
          location_lng?: number | null
          lone_worker_enabled?: boolean
          metadata?: Json | null
          notes?: string | null
          organization_id?: string
          signed_at?: string | null
          site_safe?: boolean
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "safety_assessments_assessed_by_fkey"
            columns: ["assessed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_assessments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_assessments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_detections: {
        Row: {
          bounding_box: Json | null
          category: string | null
          condition: string | null
          confidence: number | null
          created_at: string | null
          detected_at: string | null
          detection_type: string
          estimated_age_years: number | null
          id: string
          included_in_quote: boolean | null
          keyframe_url: string | null
          label: string
          make: string | null
          mapped_inventory_item_id: string | null
          metadata: Json | null
          model: string | null
          opportunity_value: number | null
          organization_id: string
          scan_id: string
          severity: string | null
          suggested_action: string | null
          thumbnail_url: string | null
          voice_note: string | null
        }
        Insert: {
          bounding_box?: Json | null
          category?: string | null
          condition?: string | null
          confidence?: number | null
          created_at?: string | null
          detected_at?: string | null
          detection_type?: string
          estimated_age_years?: number | null
          id?: string
          included_in_quote?: boolean | null
          keyframe_url?: string | null
          label: string
          make?: string | null
          mapped_inventory_item_id?: string | null
          metadata?: Json | null
          model?: string | null
          opportunity_value?: number | null
          organization_id: string
          scan_id: string
          severity?: string | null
          suggested_action?: string | null
          thumbnail_url?: string | null
          voice_note?: string | null
        }
        Update: {
          bounding_box?: Json | null
          category?: string | null
          condition?: string | null
          confidence?: number | null
          created_at?: string | null
          detected_at?: string | null
          detection_type?: string
          estimated_age_years?: number | null
          id?: string
          included_in_quote?: boolean | null
          keyframe_url?: string | null
          label?: string
          make?: string | null
          mapped_inventory_item_id?: string | null
          metadata?: Json | null
          model?: string | null
          opportunity_value?: number | null
          organization_id?: string
          scan_id?: string
          severity?: string | null
          suggested_action?: string | null
          thumbnail_url?: string | null
          voice_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scan_detections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_detections_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "site_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_opportunities: {
        Row: {
          category: string | null
          cost_to_fix: number | null
          created_at: string | null
          description: string | null
          detection_id: string | null
          estimated_value: number | null
          id: string
          inventory_item_id: string | null
          organization_id: string
          priority: string | null
          quote_id: string | null
          roi_annual: number | null
          scan_id: string
          snapshot_url: string | null
          status: string | null
          title: string
        }
        Insert: {
          category?: string | null
          cost_to_fix?: number | null
          created_at?: string | null
          description?: string | null
          detection_id?: string | null
          estimated_value?: number | null
          id?: string
          inventory_item_id?: string | null
          organization_id: string
          priority?: string | null
          quote_id?: string | null
          roi_annual?: number | null
          scan_id: string
          snapshot_url?: string | null
          status?: string | null
          title: string
        }
        Update: {
          category?: string | null
          cost_to_fix?: number | null
          created_at?: string | null
          description?: string | null
          detection_id?: string | null
          estimated_value?: number | null
          id?: string
          inventory_item_id?: string | null
          organization_id?: string
          priority?: string | null
          quote_id?: string | null
          roi_annual?: number | null
          scan_id?: string
          snapshot_url?: string | null
          status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "scan_opportunities_detection_id_fkey"
            columns: ["detection_id"]
            isOneToOne: false
            referencedRelation: "scan_detections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_opportunities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_opportunities_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "site_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      schads_award_rates: {
        Row: {
          base_rate: number
          casual_loading: number | null
          created_at: string
          description: string | null
          effective_date: string
          id: number
          level_code: string
        }
        Insert: {
          base_rate: number
          casual_loading?: number | null
          created_at?: string
          description?: string | null
          effective_date: string
          id?: number
          level_code: string
        }
        Update: {
          base_rate?: number
          casual_loading?: number | null
          created_at?: string
          description?: string | null
          effective_date?: string
          id?: number
          level_code?: string
        }
        Relationships: []
      }
      schedule_blocks: {
        Row: {
          cancellation_reason: string | null
          cancellation_type: string | null
          cancelled_at: string | null
          client_name: string | null
          created_at: string | null
          end_time: string
          generated_from_template_id: string | null
          id: string
          is_conflict: boolean | null
          is_short_notice_cancellation: boolean | null
          job_id: string | null
          location: string | null
          metadata: Json | null
          notes: string | null
          organization_id: string
          participant_id: string | null
          rollout_id: string | null
          start_time: string
          status: Database["public"]["Enums"]["schedule_block_status"] | null
          technician_id: string
          title: string
          travel_minutes: number | null
          updated_at: string | null
        }
        Insert: {
          cancellation_reason?: string | null
          cancellation_type?: string | null
          cancelled_at?: string | null
          client_name?: string | null
          created_at?: string | null
          end_time: string
          generated_from_template_id?: string | null
          id?: string
          is_conflict?: boolean | null
          is_short_notice_cancellation?: boolean | null
          job_id?: string | null
          location?: string | null
          metadata?: Json | null
          notes?: string | null
          organization_id: string
          participant_id?: string | null
          rollout_id?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["schedule_block_status"] | null
          technician_id: string
          title: string
          travel_minutes?: number | null
          updated_at?: string | null
        }
        Update: {
          cancellation_reason?: string | null
          cancellation_type?: string | null
          cancelled_at?: string | null
          client_name?: string | null
          created_at?: string | null
          end_time?: string
          generated_from_template_id?: string | null
          id?: string
          is_conflict?: boolean | null
          is_short_notice_cancellation?: boolean | null
          job_id?: string | null
          location?: string | null
          metadata?: Json | null
          notes?: string | null
          organization_id?: string
          participant_id?: string | null
          rollout_id?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["schedule_block_status"] | null
          technician_id?: string
          title?: string
          travel_minutes?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_blocks_generated_from_template_id_fkey"
            columns: ["generated_from_template_id"]
            isOneToOne: false
            referencedRelation: "template_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_blocks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_blocks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_blocks_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_blocks_rollout_id_fkey"
            columns: ["rollout_id"]
            isOneToOne: false
            referencedRelation: "rollout_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_blocks_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_events: {
        Row: {
          created_at: string | null
          end_time: string
          id: string
          notes: string | null
          organization_id: string
          start_time: string
          title: string
          type: Database["public"]["Enums"]["schedule_event_type"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          end_time: string
          id?: string
          notes?: string | null
          organization_id: string
          start_time: string
          title: string
          type?: Database["public"]["Enums"]["schedule_event_type"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          end_time?: string
          id?: string
          notes?: string | null
          organization_id?: string
          start_time?: string
          title?: string
          type?: Database["public"]["Enums"]["schedule_event_type"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sentinel_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          created_at: string
          description: string
          id: string
          organization_id: string
          participant_id: string | null
          resolution_action: string | null
          resolution_notes: string | null
          resolved_at: string | null
          severity: Database["public"]["Enums"]["sentinel_severity"]
          shift_id: string | null
          source_id: string | null
          source_table: string | null
          status: Database["public"]["Enums"]["sentinel_status"]
          title: string
          triggered_keywords: string[] | null
          worker_id: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          created_at?: string
          description: string
          id?: string
          organization_id: string
          participant_id?: string | null
          resolution_action?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["sentinel_severity"]
          shift_id?: string | null
          source_id?: string | null
          source_table?: string | null
          status?: Database["public"]["Enums"]["sentinel_status"]
          title: string
          triggered_keywords?: string[] | null
          worker_id?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          created_at?: string
          description?: string
          id?: string
          organization_id?: string
          participant_id?: string | null
          resolution_action?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["sentinel_severity"]
          shift_id?: string | null
          source_id?: string | null
          source_table?: string | null
          status?: Database["public"]["Enums"]["sentinel_status"]
          title?: string
          triggered_keywords?: string[] | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sentinel_alerts_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sentinel_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sentinel_alerts_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sentinel_alerts_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sentinel_alerts_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sentinel_keywords: {
        Row: {
          category: string | null
          created_at: string
          id: string
          is_system_default: boolean | null
          keyword: string
          organization_id: string | null
          severity: Database["public"]["Enums"]["sentinel_severity"] | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          is_system_default?: boolean | null
          keyword: string
          organization_id?: string | null
          severity?: Database["public"]["Enums"]["sentinel_severity"] | null
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          is_system_default?: boolean | null
          keyword?: string
          organization_id?: string | null
          severity?: Database["public"]["Enums"]["sentinel_severity"] | null
        }
        Relationships: [
          {
            foreignKeyName: "sentinel_keywords_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_agreements: {
        Row: {
          category_allocations: Json | null
          consumed_budget: number | null
          created_at: string
          document_url: string | null
          end_date: string | null
          funding_management_type: string | null
          id: string
          ndis_line_items: Json | null
          notes: string | null
          organization_id: string
          participant_id: string
          pdf_url: string | null
          quarantined_budget: number | null
          signed_at: string | null
          signed_by: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["agreement_status"]
          title: string
          total_budget: number | null
          updated_at: string
        }
        Insert: {
          category_allocations?: Json | null
          consumed_budget?: number | null
          created_at?: string
          document_url?: string | null
          end_date?: string | null
          funding_management_type?: string | null
          id?: string
          ndis_line_items?: Json | null
          notes?: string | null
          organization_id: string
          participant_id: string
          pdf_url?: string | null
          quarantined_budget?: number | null
          signed_at?: string | null
          signed_by?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["agreement_status"]
          title: string
          total_budget?: number | null
          updated_at?: string
        }
        Update: {
          category_allocations?: Json | null
          consumed_budget?: number | null
          created_at?: string
          document_url?: string | null
          end_date?: string | null
          funding_management_type?: string | null
          id?: string
          ndis_line_items?: Json | null
          notes?: string | null
          organization_id?: string
          participant_id?: string
          pdf_url?: string | null
          quarantined_budget?: number | null
          signed_at?: string | null
          signed_by?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["agreement_status"]
          title?: string
          total_budget?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_agreements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_agreements_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_financial_ledgers: {
        Row: {
          actual_cost: number | null
          actual_margin: number | null
          actual_revenue: number | null
          cost_breakdown: Json | null
          created_at: string
          id: string
          is_broken_shift: boolean | null
          is_overtime: boolean | null
          is_public_holiday: boolean | null
          ndis_line_item: string | null
          organization_id: string
          participant_id: string | null
          penalty_type: string | null
          projected_cost: number | null
          projected_margin: number | null
          projected_revenue: number | null
          revenue_breakdown: Json | null
          schedule_block_id: string
          travel_cost: number | null
          travel_distance_km: number | null
          travel_duration_mins: number | null
          travel_revenue: number | null
          updated_at: string
          worker_id: string | null
        }
        Insert: {
          actual_cost?: number | null
          actual_margin?: number | null
          actual_revenue?: number | null
          cost_breakdown?: Json | null
          created_at?: string
          id?: string
          is_broken_shift?: boolean | null
          is_overtime?: boolean | null
          is_public_holiday?: boolean | null
          ndis_line_item?: string | null
          organization_id: string
          participant_id?: string | null
          penalty_type?: string | null
          projected_cost?: number | null
          projected_margin?: number | null
          projected_revenue?: number | null
          revenue_breakdown?: Json | null
          schedule_block_id: string
          travel_cost?: number | null
          travel_distance_km?: number | null
          travel_duration_mins?: number | null
          travel_revenue?: number | null
          updated_at?: string
          worker_id?: string | null
        }
        Update: {
          actual_cost?: number | null
          actual_margin?: number | null
          actual_revenue?: number | null
          cost_breakdown?: Json | null
          created_at?: string
          id?: string
          is_broken_shift?: boolean | null
          is_overtime?: boolean | null
          is_public_holiday?: boolean | null
          ndis_line_item?: string | null
          organization_id?: string
          participant_id?: string | null
          penalty_type?: string | null
          projected_cost?: number | null
          projected_margin?: number | null
          projected_revenue?: number | null
          revenue_breakdown?: Json | null
          schedule_block_id?: string
          travel_cost?: number | null
          travel_distance_km?: number | null
          travel_duration_mins?: number | null
          travel_revenue?: number | null
          updated_at?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_financial_ledgers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_financial_ledgers_schedule_block_id_fkey"
            columns: ["schedule_block_id"]
            isOneToOne: true
            referencedRelation: "schedule_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_financial_ledgers_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      site_health_scores: {
        Row: {
          client_id: string | null
          compliance_score: number | null
          created_at: string | null
          critical_count: number | null
          efficiency_score: number | null
          id: string
          opportunity_count: number | null
          organization_id: string
          overall_score: number
          safety_score: number | null
          scan_id: string
          total_detections: number | null
          total_opportunity_value: number | null
        }
        Insert: {
          client_id?: string | null
          compliance_score?: number | null
          created_at?: string | null
          critical_count?: number | null
          efficiency_score?: number | null
          id?: string
          opportunity_count?: number | null
          organization_id: string
          overall_score?: number
          safety_score?: number | null
          scan_id: string
          total_detections?: number | null
          total_opportunity_value?: number | null
        }
        Update: {
          client_id?: string | null
          compliance_score?: number | null
          created_at?: string | null
          critical_count?: number | null
          efficiency_score?: number | null
          id?: string
          opportunity_count?: number | null
          organization_id?: string
          overall_score?: number
          safety_score?: number | null
          scan_id?: string
          total_detections?: number | null
          total_opportunity_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "site_health_scores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_health_scores_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "site_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      site_scans: {
        Row: {
          client_id: string | null
          completed_at: string | null
          created_at: string | null
          detection_count: number | null
          duration_seconds: number | null
          id: string
          job_id: string | null
          keyframe_count: number | null
          metadata: Json | null
          organization_id: string
          scan_date: string | null
          status: string
          total_opportunity_value: number | null
          user_id: string
          voice_transcript: string | null
        }
        Insert: {
          client_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          detection_count?: number | null
          duration_seconds?: number | null
          id?: string
          job_id?: string | null
          keyframe_count?: number | null
          metadata?: Json | null
          organization_id: string
          scan_date?: string | null
          status?: string
          total_opportunity_value?: number | null
          user_id: string
          voice_transcript?: string | null
        }
        Update: {
          client_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          detection_count?: number | null
          duration_seconds?: number | null
          id?: string
          job_id?: string | null
          keyframe_count?: number | null
          metadata?: Json | null
          organization_id?: string
          scan_date?: string | null
          status?: string
          total_opportunity_value?: number | null
          user_id?: string
          voice_transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_scans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_scans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stack_generations: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          deploy_log: string | null
          deploy_url: string | null
          duration_ms: number | null
          error_message: string | null
          id: string
          metadata: Json | null
          model: string | null
          organization_id: string
          output_files: Json | null
          preview_url: string | null
          project_id: string
          prompt: string
          status: string
          token_count: number | null
          version: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          deploy_log?: string | null
          deploy_url?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          model?: string | null
          organization_id: string
          output_files?: Json | null
          preview_url?: string | null
          project_id: string
          prompt: string
          status?: string
          token_count?: number | null
          version?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          deploy_log?: string | null
          deploy_url?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          model?: string | null
          organization_id?: string
          output_files?: Json | null
          preview_url?: string | null
          project_id?: string
          prompt?: string
          status?: string
          token_count?: number | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stack_generations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stack_generations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stack_generations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "stack_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      stack_projects: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          framework: string | null
          id: string
          metadata: Json | null
          name: string
          organization_id: string
          production_url: string | null
          repo_url: string | null
          status: string
          template: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          framework?: string | null
          id?: string
          metadata?: Json | null
          name: string
          organization_id: string
          production_url?: string | null
          repo_url?: string | null
          status?: string
          template?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          framework?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          organization_id?: string
          production_url?: string | null
          repo_url?: string | null
          status?: string
          template?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stack_projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stack_projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_leave: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          end_date: string
          id: string
          leave_type: string
          notes: string | null
          organization_id: string
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          end_date: string
          id?: string
          leave_type: string
          notes?: string | null
          organization_id: string
          start_date: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          end_date?: string
          id?: string
          leave_type?: string
          notes?: string | null
          organization_id?: string
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_leave_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_leave_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_leave_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_profiles: {
        Row: {
          availability: Json | null
          base_hourly_rate: number
          contracted_hours: number | null
          created_at: string
          date_of_birth: string | null
          emergency_contact: Json | null
          employment_type: string
          home_address: string | null
          home_lat: number | null
          home_lng: number | null
          id: string
          license_number: string | null
          max_weekly_hours: number | null
          notes: string | null
          organization_id: string
          qualifications: string[] | null
          schads_level: string
          superannuation_fund: string | null
          superannuation_number: string | null
          tax_file_number_hash: string | null
          updated_at: string
          user_id: string
          vehicle_registration: string | null
          visa_status: string | null
        }
        Insert: {
          availability?: Json | null
          base_hourly_rate?: number
          contracted_hours?: number | null
          created_at?: string
          date_of_birth?: string | null
          emergency_contact?: Json | null
          employment_type?: string
          home_address?: string | null
          home_lat?: number | null
          home_lng?: number | null
          id?: string
          license_number?: string | null
          max_weekly_hours?: number | null
          notes?: string | null
          organization_id: string
          qualifications?: string[] | null
          schads_level?: string
          superannuation_fund?: string | null
          superannuation_number?: string | null
          tax_file_number_hash?: string | null
          updated_at?: string
          user_id: string
          vehicle_registration?: string | null
          visa_status?: string | null
        }
        Update: {
          availability?: Json | null
          base_hourly_rate?: number
          contracted_hours?: number | null
          created_at?: string
          date_of_birth?: string | null
          emergency_contact?: Json | null
          employment_type?: string
          home_address?: string | null
          home_lat?: number | null
          home_lng?: number | null
          id?: string
          license_number?: string | null
          max_weekly_hours?: number | null
          notes?: string | null
          organization_id?: string
          qualifications?: string[] | null
          schads_level?: string
          superannuation_fund?: string | null
          superannuation_number?: string | null
          tax_file_number_hash?: string | null
          updated_at?: string
          user_id?: string
          vehicle_registration?: string | null
          visa_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          completed_at: string | null
          created_at: string | null
          from_location: string | null
          from_user_id: string | null
          id: string
          inventory_item_id: string
          notes: string | null
          organization_id: string
          quantity: number
          requested_at: string | null
          responded_at: string | null
          status: string
          to_location: string | null
          to_user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          from_location?: string | null
          from_user_id?: string | null
          id?: string
          inventory_item_id: string
          notes?: string | null
          organization_id: string
          quantity?: number
          requested_at?: string | null
          responded_at?: string | null
          status?: string
          to_location?: string | null
          to_user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          from_location?: string | null
          from_user_id?: string | null
          id?: string
          inventory_item_id?: string
          notes?: string | null
          organization_id?: string
          quantity?: number
          requested_at?: string | null
          responded_at?: string | null
          status?: string
          to_location?: string | null
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          canceled_at: string | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          metadata: Json | null
          organization_id: string
          plan_key: string
          polar_product_id: string | null
          polar_subscription_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          metadata?: Json | null
          organization_id: string
          plan_key: string
          polar_product_id?: string | null
          polar_subscription_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          plan_key?: string
          polar_product_id?: string | null
          polar_subscription_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admin_audit_logs: {
        Row: {
          action_type: string
          admin_email: string
          admin_id: string
          created_at: string
          id: string
          ip_address: string | null
          mutation_payload: Json | null
          new_state: Json | null
          notes: string | null
          previous_state: Json | null
          target_org_id: string | null
          target_record_id: string | null
          target_table: string | null
          user_agent: string | null
        }
        Insert: {
          action_type: string
          admin_email: string
          admin_id: string
          created_at?: string
          id?: string
          ip_address?: string | null
          mutation_payload?: Json | null
          new_state?: Json | null
          notes?: string | null
          previous_state?: Json | null
          target_org_id?: string | null
          target_record_id?: string | null
          target_table?: string | null
          user_agent?: string | null
        }
        Update: {
          action_type?: string
          admin_email?: string
          admin_id?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          mutation_payload?: Json | null
          new_state?: Json | null
          notes?: string | null
          previous_state?: Json | null
          target_org_id?: string | null
          target_record_id?: string | null
          target_table?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      support_coordination_cases: {
        Row: {
          case_type: string | null
          closed_at: string | null
          closure_outcome: string | null
          closure_reason: string | null
          contacts: Json | null
          coordinator_id: string
          created_at: string | null
          goals: Json | null
          id: string
          notes: string | null
          opened_at: string | null
          organization_id: string
          participant_id: string
          referrals: Json | null
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          case_type?: string | null
          closed_at?: string | null
          closure_outcome?: string | null
          closure_reason?: string | null
          contacts?: Json | null
          coordinator_id: string
          created_at?: string | null
          goals?: Json | null
          id?: string
          notes?: string | null
          opened_at?: string | null
          organization_id: string
          participant_id: string
          referrals?: Json | null
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          case_type?: string | null
          closed_at?: string | null
          closure_outcome?: string | null
          closure_reason?: string | null
          contacts?: Json | null
          coordinator_id?: string
          created_at?: string | null
          goals?: Json | null
          id?: string
          notes?: string | null
          opened_at?: string | null
          organization_id?: string
          participant_id?: string
          referrals?: Json | null
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_coordination_cases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      telemetry_events: {
        Row: {
          app_version: string | null
          battery_level: number | null
          branch_id: string | null
          console_buffer: Json | null
          device_model: string | null
          effective_bandwidth: string | null
          error_message: string | null
          error_name: string | null
          event_timestamp: string
          gps_lat: number | null
          gps_lng: number | null
          has_screenshot: boolean | null
          id: string
          industry_mode: string | null
          is_offline_mode: boolean | null
          last_action: string | null
          memory_usage_mb: number | null
          network_type: string | null
          organization_id: string | null
          os_version: string | null
          payload: Json
          platform: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          route: string | null
          screenshot_path: string | null
          severity: string
          stack_trace: string | null
          status: string
          user_email: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          app_version?: string | null
          battery_level?: number | null
          branch_id?: string | null
          console_buffer?: Json | null
          device_model?: string | null
          effective_bandwidth?: string | null
          error_message?: string | null
          error_name?: string | null
          event_timestamp?: string
          gps_lat?: number | null
          gps_lng?: number | null
          has_screenshot?: boolean | null
          id?: string
          industry_mode?: string | null
          is_offline_mode?: boolean | null
          last_action?: string | null
          memory_usage_mb?: number | null
          network_type?: string | null
          organization_id?: string | null
          os_version?: string | null
          payload?: Json
          platform?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          route?: string | null
          screenshot_path?: string | null
          severity?: string
          stack_trace?: string | null
          status?: string
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          app_version?: string | null
          battery_level?: number | null
          branch_id?: string | null
          console_buffer?: Json | null
          device_model?: string | null
          effective_bandwidth?: string | null
          error_message?: string | null
          error_name?: string | null
          event_timestamp?: string
          gps_lat?: number | null
          gps_lng?: number | null
          has_screenshot?: boolean | null
          id?: string
          industry_mode?: string | null
          is_offline_mode?: boolean | null
          last_action?: string | null
          memory_usage_mb?: number | null
          network_type?: string | null
          organization_id?: string | null
          os_version?: string | null
          payload?: Json
          platform?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          route?: string | null
          screenshot_path?: string | null
          severity?: string
          stack_trace?: string | null
          status?: string
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      telemetry_events_2026_03: {
        Row: {
          app_version: string | null
          battery_level: number | null
          branch_id: string | null
          console_buffer: Json | null
          device_model: string | null
          effective_bandwidth: string | null
          error_message: string | null
          error_name: string | null
          event_timestamp: string
          gps_lat: number | null
          gps_lng: number | null
          has_screenshot: boolean | null
          id: string
          industry_mode: string | null
          is_offline_mode: boolean | null
          last_action: string | null
          memory_usage_mb: number | null
          network_type: string | null
          organization_id: string | null
          os_version: string | null
          payload: Json
          platform: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          route: string | null
          screenshot_path: string | null
          severity: string
          stack_trace: string | null
          status: string
          user_email: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          app_version?: string | null
          battery_level?: number | null
          branch_id?: string | null
          console_buffer?: Json | null
          device_model?: string | null
          effective_bandwidth?: string | null
          error_message?: string | null
          error_name?: string | null
          event_timestamp?: string
          gps_lat?: number | null
          gps_lng?: number | null
          has_screenshot?: boolean | null
          id?: string
          industry_mode?: string | null
          is_offline_mode?: boolean | null
          last_action?: string | null
          memory_usage_mb?: number | null
          network_type?: string | null
          organization_id?: string | null
          os_version?: string | null
          payload?: Json
          platform?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          route?: string | null
          screenshot_path?: string | null
          severity?: string
          stack_trace?: string | null
          status?: string
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          app_version?: string | null
          battery_level?: number | null
          branch_id?: string | null
          console_buffer?: Json | null
          device_model?: string | null
          effective_bandwidth?: string | null
          error_message?: string | null
          error_name?: string | null
          event_timestamp?: string
          gps_lat?: number | null
          gps_lng?: number | null
          has_screenshot?: boolean | null
          id?: string
          industry_mode?: string | null
          is_offline_mode?: boolean | null
          last_action?: string | null
          memory_usage_mb?: number | null
          network_type?: string | null
          organization_id?: string | null
          os_version?: string | null
          payload?: Json
          platform?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          route?: string | null
          screenshot_path?: string | null
          severity?: string
          stack_trace?: string | null
          status?: string
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      telemetry_events_2026_04: {
        Row: {
          app_version: string | null
          battery_level: number | null
          branch_id: string | null
          console_buffer: Json | null
          device_model: string | null
          effective_bandwidth: string | null
          error_message: string | null
          error_name: string | null
          event_timestamp: string
          gps_lat: number | null
          gps_lng: number | null
          has_screenshot: boolean | null
          id: string
          industry_mode: string | null
          is_offline_mode: boolean | null
          last_action: string | null
          memory_usage_mb: number | null
          network_type: string | null
          organization_id: string | null
          os_version: string | null
          payload: Json
          platform: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          route: string | null
          screenshot_path: string | null
          severity: string
          stack_trace: string | null
          status: string
          user_email: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          app_version?: string | null
          battery_level?: number | null
          branch_id?: string | null
          console_buffer?: Json | null
          device_model?: string | null
          effective_bandwidth?: string | null
          error_message?: string | null
          error_name?: string | null
          event_timestamp?: string
          gps_lat?: number | null
          gps_lng?: number | null
          has_screenshot?: boolean | null
          id?: string
          industry_mode?: string | null
          is_offline_mode?: boolean | null
          last_action?: string | null
          memory_usage_mb?: number | null
          network_type?: string | null
          organization_id?: string | null
          os_version?: string | null
          payload?: Json
          platform?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          route?: string | null
          screenshot_path?: string | null
          severity?: string
          stack_trace?: string | null
          status?: string
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          app_version?: string | null
          battery_level?: number | null
          branch_id?: string | null
          console_buffer?: Json | null
          device_model?: string | null
          effective_bandwidth?: string | null
          error_message?: string | null
          error_name?: string | null
          event_timestamp?: string
          gps_lat?: number | null
          gps_lng?: number | null
          has_screenshot?: boolean | null
          id?: string
          industry_mode?: string | null
          is_offline_mode?: boolean | null
          last_action?: string | null
          memory_usage_mb?: number | null
          network_type?: string | null
          organization_id?: string | null
          os_version?: string | null
          payload?: Json
          platform?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          route?: string | null
          screenshot_path?: string | null
          severity?: string
          stack_trace?: string | null
          status?: string
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      telemetry_events_2026_05: {
        Row: {
          app_version: string | null
          battery_level: number | null
          branch_id: string | null
          console_buffer: Json | null
          device_model: string | null
          effective_bandwidth: string | null
          error_message: string | null
          error_name: string | null
          event_timestamp: string
          gps_lat: number | null
          gps_lng: number | null
          has_screenshot: boolean | null
          id: string
          industry_mode: string | null
          is_offline_mode: boolean | null
          last_action: string | null
          memory_usage_mb: number | null
          network_type: string | null
          organization_id: string | null
          os_version: string | null
          payload: Json
          platform: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          route: string | null
          screenshot_path: string | null
          severity: string
          stack_trace: string | null
          status: string
          user_email: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          app_version?: string | null
          battery_level?: number | null
          branch_id?: string | null
          console_buffer?: Json | null
          device_model?: string | null
          effective_bandwidth?: string | null
          error_message?: string | null
          error_name?: string | null
          event_timestamp?: string
          gps_lat?: number | null
          gps_lng?: number | null
          has_screenshot?: boolean | null
          id?: string
          industry_mode?: string | null
          is_offline_mode?: boolean | null
          last_action?: string | null
          memory_usage_mb?: number | null
          network_type?: string | null
          organization_id?: string | null
          os_version?: string | null
          payload?: Json
          platform?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          route?: string | null
          screenshot_path?: string | null
          severity?: string
          stack_trace?: string | null
          status?: string
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          app_version?: string | null
          battery_level?: number | null
          branch_id?: string | null
          console_buffer?: Json | null
          device_model?: string | null
          effective_bandwidth?: string | null
          error_message?: string | null
          error_name?: string | null
          event_timestamp?: string
          gps_lat?: number | null
          gps_lng?: number | null
          has_screenshot?: boolean | null
          id?: string
          industry_mode?: string | null
          is_offline_mode?: boolean | null
          last_action?: string | null
          memory_usage_mb?: number | null
          network_type?: string | null
          organization_id?: string | null
          os_version?: string | null
          payload?: Json
          platform?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          route?: string | null
          screenshot_path?: string | null
          severity?: string
          stack_trace?: string | null
          status?: string
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      telemetry_events_2026_06: {
        Row: {
          app_version: string | null
          battery_level: number | null
          branch_id: string | null
          console_buffer: Json | null
          device_model: string | null
          effective_bandwidth: string | null
          error_message: string | null
          error_name: string | null
          event_timestamp: string
          gps_lat: number | null
          gps_lng: number | null
          has_screenshot: boolean | null
          id: string
          industry_mode: string | null
          is_offline_mode: boolean | null
          last_action: string | null
          memory_usage_mb: number | null
          network_type: string | null
          organization_id: string | null
          os_version: string | null
          payload: Json
          platform: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          route: string | null
          screenshot_path: string | null
          severity: string
          stack_trace: string | null
          status: string
          user_email: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          app_version?: string | null
          battery_level?: number | null
          branch_id?: string | null
          console_buffer?: Json | null
          device_model?: string | null
          effective_bandwidth?: string | null
          error_message?: string | null
          error_name?: string | null
          event_timestamp?: string
          gps_lat?: number | null
          gps_lng?: number | null
          has_screenshot?: boolean | null
          id?: string
          industry_mode?: string | null
          is_offline_mode?: boolean | null
          last_action?: string | null
          memory_usage_mb?: number | null
          network_type?: string | null
          organization_id?: string | null
          os_version?: string | null
          payload?: Json
          platform?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          route?: string | null
          screenshot_path?: string | null
          severity?: string
          stack_trace?: string | null
          status?: string
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          app_version?: string | null
          battery_level?: number | null
          branch_id?: string | null
          console_buffer?: Json | null
          device_model?: string | null
          effective_bandwidth?: string | null
          error_message?: string | null
          error_name?: string | null
          event_timestamp?: string
          gps_lat?: number | null
          gps_lng?: number | null
          has_screenshot?: boolean | null
          id?: string
          industry_mode?: string | null
          is_offline_mode?: boolean | null
          last_action?: string | null
          memory_usage_mb?: number | null
          network_type?: string | null
          organization_id?: string | null
          os_version?: string | null
          payload?: Json
          platform?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          route?: string | null
          screenshot_path?: string | null
          severity?: string
          stack_trace?: string | null
          status?: string
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      telemetry_events_legacy_jobs: {
        Row: {
          battery_level: number | null
          connection_type: string | null
          created_at: string | null
          device_model: string | null
          event_data: Json | null
          event_type: string
          flag_reason: string | null
          flagged: boolean | null
          id: string
          ip_address: string | null
          job_id: string
          location_accuracy: number | null
          location_altitude: number | null
          location_lat: number | null
          location_lng: number | null
          organization_id: string
          os_version: string | null
          session_id: string | null
          timestamp: string
          user_id: string
        }
        Insert: {
          battery_level?: number | null
          connection_type?: string | null
          created_at?: string | null
          device_model?: string | null
          event_data?: Json | null
          event_type: string
          flag_reason?: string | null
          flagged?: boolean | null
          id?: string
          ip_address?: string | null
          job_id: string
          location_accuracy?: number | null
          location_altitude?: number | null
          location_lat?: number | null
          location_lng?: number | null
          organization_id: string
          os_version?: string | null
          session_id?: string | null
          timestamp?: string
          user_id: string
        }
        Update: {
          battery_level?: number | null
          connection_type?: string | null
          created_at?: string | null
          device_model?: string | null
          event_data?: Json | null
          event_type?: string
          flag_reason?: string | null
          flagged?: boolean | null
          id?: string
          ip_address?: string | null
          job_id?: string
          location_accuracy?: number | null
          location_altitude?: number | null
          location_lat?: number | null
          location_lng?: number | null
          organization_id?: string
          os_version?: string | null
          session_id?: string | null
          timestamp?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telemetry_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telemetry_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telemetry_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      template_shifts: {
        Row: {
          backup_worker_id: string | null
          created_at: string
          day_of_cycle: number
          end_time: string
          id: string
          ndis_line_item: string | null
          notes: string | null
          organization_id: string
          primary_worker_id: string | null
          public_holiday_behavior: string
          start_time: string
          support_purpose: string | null
          template_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          backup_worker_id?: string | null
          created_at?: string
          day_of_cycle: number
          end_time: string
          id?: string
          ndis_line_item?: string | null
          notes?: string | null
          organization_id: string
          primary_worker_id?: string | null
          public_holiday_behavior?: string
          start_time: string
          support_purpose?: string | null
          template_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          backup_worker_id?: string | null
          created_at?: string
          day_of_cycle?: number
          end_time?: string
          id?: string
          ndis_line_item?: string | null
          notes?: string | null
          organization_id?: string
          primary_worker_id?: string | null
          public_holiday_behavior?: string
          start_time?: string
          support_purpose?: string | null
          template_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_shifts_backup_worker_id_fkey"
            columns: ["backup_worker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_shifts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_shifts_primary_worker_id_fkey"
            columns: ["primary_worker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_shifts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "roster_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      terminal_connection_tokens: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          secret: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          secret: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          secret?: string
        }
        Relationships: [
          {
            foreignKeyName: "terminal_connection_tokens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          allowances_captured: Json | null
          award_interpretation: Json | null
          break_duration_minutes: number | null
          break_end: string | null
          break_minutes: number | null
          break_start: string | null
          breaks: Json | null
          clock_in: string
          clock_in_lat: number | null
          clock_in_lng: number | null
          clock_in_location: Json | null
          clock_out: string | null
          clock_out_lat: number | null
          clock_out_lng: number | null
          clock_out_location: Json | null
          created_at: string | null
          exception_notes: string | null
          exception_resolved: boolean | null
          exception_resolved_by: string | null
          exception_type: string | null
          geo_warning: boolean | null
          geofence_override_reason: string | null
          id: string
          is_auto_clock_out: boolean | null
          is_geofence_override: boolean | null
          is_leave_entry: boolean | null
          is_manual_entry: boolean | null
          job_id: string | null
          leave_type: string | null
          metadata: Json | null
          notes: string | null
          organization_id: string
          scheduled_end: string | null
          scheduled_start: string | null
          shift_id: string | null
          status: string
          timesheet_id: string | null
          total_hours: number | null
          total_minutes: number | null
          travel_km: number | null
          travel_minutes: number | null
          type: string
          updated_at: string | null
          user_id: string
          variance_minutes: number | null
          worker_id: string | null
        }
        Insert: {
          allowances_captured?: Json | null
          award_interpretation?: Json | null
          break_duration_minutes?: number | null
          break_end?: string | null
          break_minutes?: number | null
          break_start?: string | null
          breaks?: Json | null
          clock_in?: string
          clock_in_lat?: number | null
          clock_in_lng?: number | null
          clock_in_location?: Json | null
          clock_out?: string | null
          clock_out_lat?: number | null
          clock_out_lng?: number | null
          clock_out_location?: Json | null
          created_at?: string | null
          exception_notes?: string | null
          exception_resolved?: boolean | null
          exception_resolved_by?: string | null
          exception_type?: string | null
          geo_warning?: boolean | null
          geofence_override_reason?: string | null
          id?: string
          is_auto_clock_out?: boolean | null
          is_geofence_override?: boolean | null
          is_leave_entry?: boolean | null
          is_manual_entry?: boolean | null
          job_id?: string | null
          leave_type?: string | null
          metadata?: Json | null
          notes?: string | null
          organization_id: string
          scheduled_end?: string | null
          scheduled_start?: string | null
          shift_id?: string | null
          status?: string
          timesheet_id?: string | null
          total_hours?: number | null
          total_minutes?: number | null
          travel_km?: number | null
          travel_minutes?: number | null
          type?: string
          updated_at?: string | null
          user_id: string
          variance_minutes?: number | null
          worker_id?: string | null
        }
        Update: {
          allowances_captured?: Json | null
          award_interpretation?: Json | null
          break_duration_minutes?: number | null
          break_end?: string | null
          break_minutes?: number | null
          break_start?: string | null
          breaks?: Json | null
          clock_in?: string
          clock_in_lat?: number | null
          clock_in_lng?: number | null
          clock_in_location?: Json | null
          clock_out?: string | null
          clock_out_lat?: number | null
          clock_out_lng?: number | null
          clock_out_location?: Json | null
          created_at?: string | null
          exception_notes?: string | null
          exception_resolved?: boolean | null
          exception_resolved_by?: string | null
          exception_type?: string | null
          geo_warning?: boolean | null
          geofence_override_reason?: string | null
          id?: string
          is_auto_clock_out?: boolean | null
          is_geofence_override?: boolean | null
          is_leave_entry?: boolean | null
          is_manual_entry?: boolean | null
          job_id?: string | null
          leave_type?: string | null
          metadata?: Json | null
          notes?: string | null
          organization_id?: string
          scheduled_end?: string | null
          scheduled_start?: string | null
          shift_id?: string | null
          status?: string
          timesheet_id?: string | null
          total_hours?: number | null
          total_minutes?: number | null
          travel_km?: number | null
          travel_minutes?: number | null
          type?: string
          updated_at?: string | null
          user_id?: string
          variance_minutes?: number | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_timesheet_id_fkey"
            columns: ["timesheet_id"]
            isOneToOne: false
            referencedRelation: "timesheets"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet_adjustments: {
        Row: {
          adjustment_type: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string
          id: string
          new_values: Json
          old_values: Json
          organization_id: string
          original_entry_id: string
          reason: string
        }
        Insert: {
          adjustment_type: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by: string
          id?: string
          new_values: Json
          old_values: Json
          organization_id: string
          original_entry_id: string
          reason: string
        }
        Update: {
          adjustment_type?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string
          id?: string
          new_values?: Json
          old_values?: Json
          organization_id?: string
          original_entry_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_adjustments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_adjustments_original_entry_id_fkey"
            columns: ["original_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheets: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          exported_at: string | null
          id: string
          is_locked: boolean | null
          notes: string | null
          organization_id: string
          period_end: string
          period_start: string
          status: string
          total_allowances: number | null
          total_hours: number | null
          total_leave: number | null
          total_ordinary: number | null
          total_overtime: number | null
          updated_at: string
          worker_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          exported_at?: string | null
          id?: string
          is_locked?: boolean | null
          notes?: string | null
          organization_id: string
          period_end: string
          period_start: string
          status?: string
          total_allowances?: number | null
          total_hours?: number | null
          total_leave?: number | null
          total_ordinary?: number | null
          total_overtime?: number | null
          updated_at?: string
          worker_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          exported_at?: string | null
          id?: string
          is_locked?: boolean | null
          notes?: string | null
          organization_id?: string
          period_end?: string
          period_start?: string
          status?: string
          total_allowances?: number | null
          total_hours?: number | null
          total_leave?: number | null
          total_ordinary?: number | null
          total_overtime?: number | null
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      van_stock: {
        Row: {
          created_at: string | null
          id: string
          inventory_item_id: string
          last_restocked_at: string | null
          min_quantity: number | null
          organization_id: string
          quantity: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          inventory_item_id: string
          last_restocked_at?: string | null
          min_quantity?: number | null
          organization_id: string
          quantity?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          inventory_item_id?: string
          last_restocked_at?: string | null
          min_quantity?: number | null
          organization_id?: string
          quantity?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "van_stock_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "van_stock_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "van_stock_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_checks: {
        Row: {
          check_date: string
          created_at: string | null
          id: string
          items: Json
          notes: string | null
          odometer_km: number | null
          odometer_photo_url: string | null
          organization_id: string
          signed_at: string | null
          status: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          check_date?: string
          created_at?: string | null
          id?: string
          items?: Json
          notes?: string | null
          odometer_km?: number | null
          odometer_photo_url?: string | null
          organization_id: string
          signed_at?: string | null
          status?: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          check_date?: string
          created_at?: string | null
          id?: string
          items?: Json
          notes?: string | null
          odometer_km?: number | null
          odometer_photo_url?: string | null
          organization_id?: string
          signed_at?: string | null
          status?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_checks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_checks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_checks_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          id: string
          last_service_date: string | null
          last_service_km: number | null
          make: string | null
          metadata: Json | null
          model: string | null
          name: string
          odometer_km: number | null
          organization_id: string
          registration: string | null
          service_interval_km: number | null
          status: string
          updated_at: string | null
          vin: string | null
          year: number | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          id?: string
          last_service_date?: string | null
          last_service_km?: number | null
          make?: string | null
          metadata?: Json | null
          model?: string | null
          name: string
          odometer_km?: number | null
          organization_id: string
          registration?: string | null
          service_interval_km?: number | null
          status?: string
          updated_at?: string | null
          vin?: string | null
          year?: number | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          id?: string
          last_service_date?: string | null
          last_service_km?: number | null
          make?: string | null
          metadata?: Json | null
          model?: string | null
          name?: string
          odometer_km?: number | null
          organization_id?: string
          registration?: string | null
          service_interval_km?: number | null
          status?: string
          updated_at?: string | null
          vin?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_credentials: {
        Row: {
          created_at: string
          credential_name: string | null
          credential_type: Database["public"]["Enums"]["credential_type"]
          document_url: string | null
          expiry_date: string | null
          id: string
          issued_date: string | null
          notes: string | null
          organization_id: string
          updated_at: string
          user_id: string
          verification_status: Database["public"]["Enums"]["verification_status"]
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          credential_name?: string | null
          credential_type: Database["public"]["Enums"]["credential_type"]
          document_url?: string | null
          expiry_date?: string | null
          id?: string
          issued_date?: string | null
          notes?: string | null
          organization_id: string
          updated_at?: string
          user_id: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          credential_name?: string | null
          credential_type?: Database["public"]["Enums"]["credential_type"]
          document_url?: string | null
          expiry_date?: string | null
          id?: string
          issued_date?: string | null
          notes?: string | null
          organization_id?: string
          updated_at?: string
          user_id?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "worker_credentials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_credentials_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_credentials_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_branding: {
        Row: {
          created_at: string | null
          custom_email_domain: string | null
          dns_records: Json | null
          dns_status: string | null
          id: string
          logo_dark_url: string | null
          logo_light_url: string | null
          primary_color_hex: string | null
          resend_domain_id: string | null
          text_on_primary_hex: string | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          custom_email_domain?: string | null
          dns_records?: Json | null
          dns_status?: string | null
          id?: string
          logo_dark_url?: string | null
          logo_light_url?: string | null
          primary_color_hex?: string | null
          resend_domain_id?: string | null
          text_on_primary_hex?: string | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          custom_email_domain?: string | null
          dns_records?: Json | null
          dns_status?: string | null
          id?: string
          logo_dark_url?: string | null
          logo_light_url?: string | null
          primary_color_hex?: string | null
          resend_domain_id?: string | null
          text_on_primary_hex?: string | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_branding_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_email_templates: {
        Row: {
          body_html: string | null
          created_at: string | null
          event_type: string
          id: string
          is_active: boolean | null
          organization_id: string
          subject_line: string
          updated_at: string | null
        }
        Insert: {
          body_html?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          is_active?: boolean | null
          organization_id: string
          subject_line: string
          updated_at?: string | null
        }
        Update: {
          body_html?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          is_active?: boolean | null
          organization_id?: string
          subject_line?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workspace_email_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      archive_completed_jobs: { Args: never; Returns: undefined }
      assign_job_to_schedule: {
        Args: {
          p_end_time: string
          p_job_id: string
          p_org_id: string
          p_start_time: string
          p_technician_id: string
        }
        Returns: Json
      }
      check_credential_expiries: { Args: never; Returns: undefined }
      check_overdue_invoices: {
        Args: never
        Returns: {
          client_address: string | null
          client_email: string | null
          client_id: string | null
          client_name: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          discount_total: number | null
          discount_type: string | null
          discount_value: number | null
          display_id: string
          due_date: string
          id: string
          issue_date: string
          job_id: string | null
          metadata: Json | null
          notes: string | null
          organization_id: string
          paid_date: string | null
          payment_link: string | null
          payment_method: string | null
          pdf_url: string | null
          polar_checkout_url: string | null
          quote_id: string | null
          receipt_email: string | null
          receipt_url: string | null
          secure_token: string | null
          status: Database["public"]["Enums"]["invoice_status"] | null
          stripe_payment_intent_id: string | null
          subtotal: number | null
          tax: number | null
          tax_rate: number | null
          total: number | null
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      check_permission: {
        Args: { p_action: string; p_module: string }
        Returns: boolean
      }
      check_schedule_conflicts: { Args: { p_org_id: string }; Returns: Json }
      check_upcoming_schedule: {
        Args: never
        Returns: {
          cancellation_reason: string | null
          cancellation_type: string | null
          cancelled_at: string | null
          client_name: string | null
          created_at: string | null
          end_time: string
          generated_from_template_id: string | null
          id: string
          is_conflict: boolean | null
          is_short_notice_cancellation: boolean | null
          job_id: string | null
          location: string | null
          metadata: Json | null
          notes: string | null
          organization_id: string
          participant_id: string | null
          rollout_id: string | null
          start_time: string
          status: Database["public"]["Enums"]["schedule_block_status"] | null
          technician_id: string
          title: string
          travel_minutes: number | null
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "schedule_blocks"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      consume_inventory: {
        Args: {
          p_actor_id?: string
          p_inventory_id: string
          p_job_id?: string
          p_notes?: string
          p_quantity: number
        }
        Returns: Json
      }
      consume_shift_quarantine: { Args: { p_shift_id: string }; Returns: Json }
      create_client_full: {
        Args: {
          p_address?: string
          p_address_lat?: number
          p_address_lng?: number
          p_billing_terms?: string
          p_contact_email?: string
          p_contact_name?: string
          p_contact_phone?: string
          p_contact_role?: string
          p_email?: string
          p_name: string
          p_notes?: string
          p_org_id: string
          p_phone?: string
          p_status?: string
          p_tags?: string[]
          p_type?: string
        }
        Returns: Json
      }
      create_invoice_full: {
        Args: {
          p_client_address?: string
          p_client_email?: string
          p_client_id?: string
          p_client_name?: string
          p_created_by?: string
          p_due_date?: string
          p_issue_date?: string
          p_items?: Json
          p_notes?: string
          p_org_id: string
          p_payment_link?: string
          p_status?: string
          p_tax_rate?: number
        }
        Returns: Json
      }
      create_job_with_estimate: {
        Args: {
          p_assignee_id?: string
          p_client_id?: string
          p_description?: string
          p_due_date?: string
          p_labels?: string[]
          p_line_items?: Json
          p_location?: string
          p_location_lat?: number
          p_location_lng?: number
          p_org_id: string
          p_priority?: string
          p_revenue?: number
          p_status?: string
          p_title: string
        }
        Returns: Json
      }
      create_organization_with_owner: {
        Args: { org_name: string; org_slug: string; org_trade?: string }
        Returns: Json
      }
      generate_batch_number: {
        Args: { p_organization_id: string }
        Returns: string
      }
      get_ai_insights: { Args: { p_org_id: string }; Returns: Json }
      get_assets_overview: { Args: { p_org_id: string }; Returns: Json }
      get_automation_stats: {
        Args: { p_flow_id?: string; p_org_id: string }
        Returns: Json
      }
      get_award_rule: {
        Args: {
          p_date?: string
          p_organization_id: string
          p_rule_type: string
        }
        Returns: number
      }
      get_cascading_delays: {
        Args: { p_date?: string; p_org_id: string; p_technician_id: string }
        Returns: {
          block_id: string
          caused_by_block: string
          delay_minutes: number
          scheduled_end: string
          scheduled_start: string
          title: string
        }[]
      }
      get_client_details: { Args: { p_client_id: string }; Returns: Json }
      get_clients_with_stats: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_org_id: string
          p_search?: string
          p_sort_asc?: boolean
          p_sort_by?: string
          p_status?: string
          p_type?: string
        }
        Returns: Json
      }
      get_daily_revenue_chart: {
        Args: { p_days?: number; p_org_id: string }
        Returns: Json
      }
      get_dashboard_layout: { Args: never; Returns: Json }
      get_dashboard_snapshot: { Args: { p_org_id: string }; Returns: Json }
      get_dashboard_stats: {
        Args: { p_org_id: string; p_range_end?: string; p_range_start?: string }
        Returns: Json
      }
      get_filtered_jobs: {
        Args: {
          p_assignee_id?: string
          p_labels?: string[]
          p_limit?: number
          p_offset?: number
          p_org_id: string
          p_priority?: string
          p_search?: string
          p_status?: string
        }
        Returns: Json
      }
      get_finance_overview: {
        Args: { p_month_end?: string; p_month_start?: string; p_org_id: string }
        Returns: Json
      }
      get_forms_overview: { Args: { p_org_id: string }; Returns: Json }
      get_integrations_overview: { Args: { p_org_id: string }; Returns: Json }
      get_invoice_detail: { Args: { p_invoice_id: string }; Returns: Json }
      get_invoice_pipeline: { Args: { p_org_id: string }; Returns: Json }
      get_job_details: { Args: { p_job_id: string }; Returns: Json }
      get_job_pipeline: { Args: { p_org_id: string }; Returns: Json }
      get_last_messages_for_channels: {
        Args: { p_channel_ids: string[] }
        Returns: {
          channel_id: string
          content: string
          sender_name: string
          unread_count: number
        }[]
      }
      get_live_dispatch: { Args: { p_org_id: string }; Returns: Json }
      get_member_stats: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: Json
      }
      get_my_schedule: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: Json
      }
      get_ndis_category_counts: {
        Args: never
        Returns: {
          count: number
          support_category: string
        }[]
      }
      get_ndis_rate: {
        Args: {
          p_date?: string
          p_mmm_classification?: number
          p_support_item_number: string
        }
        Returns: {
          base_rate: number
          effective_rate: number
          region_modifier_pct: number
          support_item_name: string
          support_item_number: string
          unit: string
        }[]
      }
      get_or_create_dm: {
        Args: { p_organization_id: string; p_other_user_id: string }
        Returns: string
      }
      get_org_plan: { Args: { org_id: string }; Returns: string }
      get_quote_pipeline: { Args: { p_org_id: string }; Returns: Json }
      get_roles_with_counts: { Args: { p_org_id: string }; Returns: Json }
      get_schads_rate: {
        Args: { p_date?: string; p_level_code: string }
        Returns: number
      }
      get_schads_rate_with_loading: {
        Args: {
          p_date?: string
          p_employment_type: string
          p_level_code: string
        }
        Returns: number
      }
      get_schedule_view: {
        Args: { p_date?: string; p_org_id: string }
        Returns: Json
      }
      get_team_overview: { Args: { p_org_id: string }; Returns: Json }
      get_team_status: { Args: { p_org_id: string }; Returns: Json }
      get_user_channel_ids: { Args: never; Returns: string[] }
      get_user_org_ids: { Args: never; Returns: string[] }
      get_user_org_role: { Args: { p_org_id: string }; Returns: string }
      get_user_role: {
        Args: { org_id: string }
        Returns: Database["public"]["Enums"]["org_role"]
      }
      get_worker_leave_in_range: {
        Args: {
          p_end_date: string
          p_org_id: string
          p_start_date: string
          p_user_id: string
        }
        Returns: {
          end_date: string
          id: string
          leave_type: string
          notes: string
          start_date: string
        }[]
      }
      has_permission: {
        Args: { p_action: string; p_module: string; p_org_id: string }
        Returns: boolean
      }
      increment_field: {
        Args: { field_name: string; row_id: string; table_name: string }
        Returns: undefined
      }
      increment_form_submissions: {
        Args: { form_id: string }
        Returns: undefined
      }
      invite_member: {
        Args: {
          p_actor_id?: string
          p_branch?: string
          p_email: string
          p_org_id: string
          p_role: string
          p_role_id?: string
        }
        Returns: Json
      }
      is_public_holiday: {
        Args: { p_date: string; p_organization_id: string; p_state?: string }
        Returns: boolean
      }
      is_worker_on_leave: {
        Args: { p_date: string; p_org_id: string; p_user_id: string }
        Returns: boolean
      }
      log_asset_service: {
        Args: { p_actor_id?: string; p_asset_id: string; p_notes?: string }
        Returns: Json
      }
      mark_inbox_read: { Args: { p_ids: string[] }; Returns: undefined }
      mark_invoice_sent_with_link: {
        Args: { p_base_url?: string; p_invoice_id: string }
        Returns: Json
      }
      mark_overdue_invoices: { Args: { p_org_id?: string }; Returns: Json }
      move_schedule_block: {
        Args: {
          p_block_id: string
          p_end_time: string
          p_start_time: string
          p_technician_id: string
        }
        Returns: Json
      }
      org_has_active_subscription: {
        Args: { org_id: string }
        Returns: boolean
      }
      publish_form: { Args: { p_form_id: string }; Returns: Json }
      quarantine_shift_budget: {
        Args: {
          p_allocation_id: string
          p_amount: number
          p_description?: string
          p_ndis_item_number?: string
          p_organization_id: string
          p_shift_id: string
        }
        Returns: Json
      }
      record_audit_access: { Args: { p_token: string }; Returns: Json }
      release_shift_quarantine: { Args: { p_shift_id: string }; Returns: Json }
      save_dashboard_layout: { Args: { p_layout: Json }; Returns: Json }
      save_form_draft: {
        Args: { p_data: Json; p_submission_id: string }
        Returns: Json
      }
      seed_industry_defaults: {
        Args: { p_org_id: string; p_trade: string }
        Returns: undefined
      }
      set_all_flows_status: {
        Args: { p_org_id: string; p_pause: boolean }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      sign_and_lock_submission: {
        Args: {
          p_document_hash: string
          p_metadata?: Json
          p_signature: string
          p_submission_id: string
        }
        Returns: Json
      }
      snooze_inbox_item: {
        Args: { p_id: string; p_until: string }
        Returns: undefined
      }
      toggle_asset_custody: {
        Args: {
          p_actor_id?: string
          p_asset_id: string
          p_notes?: string
          p_target_user_id?: string
        }
        Returns: Json
      }
      toggle_flow_status: { Args: { p_flow_id: string }; Returns: Json }
      toggle_integration_status: {
        Args: {
          p_connect: boolean
          p_connection_id?: string
          p_integration_id: string
        }
        Returns: Json
      }
      unsnooze_expired_notifications: { Args: never; Returns: number }
      update_fleet_position: {
        Args: {
          p_accuracy?: number
          p_battery?: number
          p_heading?: number
          p_lat: number
          p_lng: number
          p_org_id: string
          p_speed?: number
          p_status?: string
        }
        Returns: Json
      }
      update_integration_settings: {
        Args: { p_integration_id: string; p_settings: Json }
        Returns: Json
      }
      update_role_permissions: {
        Args: { p_permissions: Json; p_role_id: string; p_scopes?: Json }
        Returns: Json
      }
      user_has_role: {
        Args: {
          min_role: Database["public"]["Enums"]["org_role"]
          org_id: string
        }
        Returns: boolean
      }
      validate_schedule_drop: {
        Args: {
          p_end_time: string
          p_exclude_block?: string
          p_location_lat?: number
          p_location_lng?: number
          p_org_id: string
          p_start_time: string
          p_technician_id: string
        }
        Returns: Json
      }
      verify_document_hash: { Args: { p_hash: string }; Returns: Json }
    }
    Enums: {
      activity_type:
        | "status_change"
        | "comment"
        | "photo"
        | "invoice"
        | "creation"
        | "assignment"
        | "note"
      agreement_status:
        | "draft"
        | "pending_signature"
        | "active"
        | "expired"
        | "cancelled"
      asset_category: "vehicle" | "tool" | "equipment" | "other"
      asset_status: "available" | "assigned" | "maintenance" | "retired"
      care_plan_status: "draft" | "active" | "under_review" | "archived"
      channel_type: "dm" | "group" | "job_context" | "broadcast" | "triage"
      client_status: "active" | "lead" | "churned" | "inactive"
      client_type: "residential" | "commercial"
      credential_type:
        | "NDIS_SCREENING"
        | "WWCC"
        | "FIRST_AID"
        | "MANUAL_HANDLING"
        | "MEDICATION_COMPETENCY"
        | "CPR"
        | "DRIVERS_LICENSE"
        | "POLICE_CHECK"
        | "OTHER"
      email_status:
        | "queued"
        | "sent"
        | "delivered"
        | "bounced"
        | "complained"
        | "failed"
      flow_status: "active" | "paused" | "draft" | "archived"
      form_status: "draft" | "published" | "archived"
      goal_status:
        | "not_started"
        | "in_progress"
        | "achieved"
        | "on_hold"
        | "abandoned"
      incident_category:
        | "fall"
        | "medication_error"
        | "behavioral"
        | "environmental"
        | "injury"
        | "near_miss"
        | "property_damage"
        | "abuse_allegation"
        | "restrictive_practice"
        | "other"
      incident_severity: "low" | "medium" | "high" | "critical"
      incident_status:
        | "reported"
        | "under_review"
        | "investigation"
        | "resolved"
        | "closed"
      integration_status:
        | "connected"
        | "disconnected"
        | "error"
        | "syncing"
        | "expired"
        | "paused"
      invite_status: "pending" | "accepted" | "expired"
      invoice_event_type:
        | "created"
        | "sent"
        | "viewed"
        | "paid"
        | "voided"
        | "reminder"
      invoice_status:
        | "draft"
        | "sent"
        | "viewed"
        | "partially_paid"
        | "paid"
        | "overdue"
        | "voided"
      job_priority: "urgent" | "high" | "medium" | "low" | "none"
      job_status:
        | "backlog"
        | "todo"
        | "scheduled"
        | "en_route"
        | "on_site"
        | "in_progress"
        | "done"
        | "completed"
        | "invoiced"
        | "archived"
        | "cancelled"
      mail_queue_status: "pending" | "processing" | "failed" | "failed_fatal"
      mar_outcome:
        | "given"
        | "refused"
        | "absent"
        | "withheld"
        | "self_administered"
        | "prn_given"
        | "not_available"
        | "other"
      medication_frequency:
        | "once_daily"
        | "twice_daily"
        | "three_times_daily"
        | "four_times_daily"
        | "every_morning"
        | "every_night"
        | "weekly"
        | "fortnightly"
        | "monthly"
        | "prn"
        | "other"
      medication_route:
        | "oral"
        | "sublingual"
        | "topical"
        | "inhaled"
        | "subcutaneous"
        | "intramuscular"
        | "rectal"
        | "ophthalmic"
        | "otic"
        | "nasal"
        | "transdermal"
        | "other"
      member_status: "active" | "pending" | "suspended" | "archived"
      message_type:
        | "text"
        | "image"
        | "file"
        | "voice"
        | "location"
        | "poll"
        | "system"
      notification_type:
        | "job_assigned"
        | "quote_approved"
        | "mention"
        | "system"
        | "review"
        | "invoice_paid"
        | "schedule_conflict"
        | "form_signed"
        | "team_invite"
        | "job_cancelled"
        | "job_rescheduled"
        | "message_received"
        | "compliance_warning"
      observation_type:
        | "blood_pressure"
        | "blood_glucose"
        | "heart_rate"
        | "temperature"
        | "weight"
        | "oxygen_saturation"
        | "respiration_rate"
        | "seizure"
        | "pain_level"
        | "bowel_movement"
        | "fluid_intake"
        | "food_intake"
        | "sleep_quality"
        | "mood"
        | "other"
      org_role:
        | "owner"
        | "admin"
        | "manager"
        | "senior_tech"
        | "technician"
        | "apprentice"
        | "subcontractor"
        | "office_admin"
      payout_status: "completed" | "pending" | "processing"
      proda_batch_status:
        | "draft"
        | "validating"
        | "submitted"
        | "processing"
        | "partially_reconciled"
        | "reconciled"
        | "failed"
      quote_status:
        | "draft"
        | "sent"
        | "viewed"
        | "accepted"
        | "rejected"
        | "expired"
      restrictive_practice_type:
        | "seclusion"
        | "chemical_restraint"
        | "mechanical_restraint"
        | "physical_restraint"
        | "environmental_restraint"
      schedule_block_status:
        | "scheduled"
        | "en_route"
        | "on_site"
        | "in_progress"
        | "complete"
        | "cancelled"
      schedule_event_type: "break" | "meeting" | "personal" | "unavailable"
      sentinel_severity: "info" | "warning" | "critical"
      sentinel_status:
        | "active"
        | "acknowledged"
        | "escalated"
        | "dismissed"
        | "resolved"
      stock_level: "ok" | "low" | "critical"
      submission_status: "pending" | "signed" | "expired" | "rejected"
      subscription_status:
        | "active"
        | "past_due"
        | "canceled"
        | "incomplete"
        | "trialing"
      verification_status: "pending" | "verified" | "rejected" | "expired"
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
      activity_type: [
        "status_change",
        "comment",
        "photo",
        "invoice",
        "creation",
        "assignment",
        "note",
      ],
      agreement_status: [
        "draft",
        "pending_signature",
        "active",
        "expired",
        "cancelled",
      ],
      asset_category: ["vehicle", "tool", "equipment", "other"],
      asset_status: ["available", "assigned", "maintenance", "retired"],
      care_plan_status: ["draft", "active", "under_review", "archived"],
      channel_type: ["dm", "group", "job_context", "broadcast", "triage"],
      client_status: ["active", "lead", "churned", "inactive"],
      client_type: ["residential", "commercial"],
      credential_type: [
        "NDIS_SCREENING",
        "WWCC",
        "FIRST_AID",
        "MANUAL_HANDLING",
        "MEDICATION_COMPETENCY",
        "CPR",
        "DRIVERS_LICENSE",
        "POLICE_CHECK",
        "OTHER",
      ],
      email_status: [
        "queued",
        "sent",
        "delivered",
        "bounced",
        "complained",
        "failed",
      ],
      flow_status: ["active", "paused", "draft", "archived"],
      form_status: ["draft", "published", "archived"],
      goal_status: [
        "not_started",
        "in_progress",
        "achieved",
        "on_hold",
        "abandoned",
      ],
      incident_category: [
        "fall",
        "medication_error",
        "behavioral",
        "environmental",
        "injury",
        "near_miss",
        "property_damage",
        "abuse_allegation",
        "restrictive_practice",
        "other",
      ],
      incident_severity: ["low", "medium", "high", "critical"],
      incident_status: [
        "reported",
        "under_review",
        "investigation",
        "resolved",
        "closed",
      ],
      integration_status: [
        "connected",
        "disconnected",
        "error",
        "syncing",
        "expired",
        "paused",
      ],
      invite_status: ["pending", "accepted", "expired"],
      invoice_event_type: [
        "created",
        "sent",
        "viewed",
        "paid",
        "voided",
        "reminder",
      ],
      invoice_status: [
        "draft",
        "sent",
        "viewed",
        "partially_paid",
        "paid",
        "overdue",
        "voided",
      ],
      job_priority: ["urgent", "high", "medium", "low", "none"],
      job_status: [
        "backlog",
        "todo",
        "scheduled",
        "en_route",
        "on_site",
        "in_progress",
        "done",
        "completed",
        "invoiced",
        "archived",
        "cancelled",
      ],
      mail_queue_status: ["pending", "processing", "failed", "failed_fatal"],
      mar_outcome: [
        "given",
        "refused",
        "absent",
        "withheld",
        "self_administered",
        "prn_given",
        "not_available",
        "other",
      ],
      medication_frequency: [
        "once_daily",
        "twice_daily",
        "three_times_daily",
        "four_times_daily",
        "every_morning",
        "every_night",
        "weekly",
        "fortnightly",
        "monthly",
        "prn",
        "other",
      ],
      medication_route: [
        "oral",
        "sublingual",
        "topical",
        "inhaled",
        "subcutaneous",
        "intramuscular",
        "rectal",
        "ophthalmic",
        "otic",
        "nasal",
        "transdermal",
        "other",
      ],
      member_status: ["active", "pending", "suspended", "archived"],
      message_type: [
        "text",
        "image",
        "file",
        "voice",
        "location",
        "poll",
        "system",
      ],
      notification_type: [
        "job_assigned",
        "quote_approved",
        "mention",
        "system",
        "review",
        "invoice_paid",
        "schedule_conflict",
        "form_signed",
        "team_invite",
        "job_cancelled",
        "job_rescheduled",
        "message_received",
        "compliance_warning",
      ],
      observation_type: [
        "blood_pressure",
        "blood_glucose",
        "heart_rate",
        "temperature",
        "weight",
        "oxygen_saturation",
        "respiration_rate",
        "seizure",
        "pain_level",
        "bowel_movement",
        "fluid_intake",
        "food_intake",
        "sleep_quality",
        "mood",
        "other",
      ],
      org_role: [
        "owner",
        "admin",
        "manager",
        "senior_tech",
        "technician",
        "apprentice",
        "subcontractor",
        "office_admin",
      ],
      payout_status: ["completed", "pending", "processing"],
      proda_batch_status: [
        "draft",
        "validating",
        "submitted",
        "processing",
        "partially_reconciled",
        "reconciled",
        "failed",
      ],
      quote_status: [
        "draft",
        "sent",
        "viewed",
        "accepted",
        "rejected",
        "expired",
      ],
      restrictive_practice_type: [
        "seclusion",
        "chemical_restraint",
        "mechanical_restraint",
        "physical_restraint",
        "environmental_restraint",
      ],
      schedule_block_status: [
        "scheduled",
        "en_route",
        "on_site",
        "in_progress",
        "complete",
        "cancelled",
      ],
      schedule_event_type: ["break", "meeting", "personal", "unavailable"],
      sentinel_severity: ["info", "warning", "critical"],
      sentinel_status: [
        "active",
        "acknowledged",
        "escalated",
        "dismissed",
        "resolved",
      ],
      stock_level: ["ok", "low", "critical"],
      submission_status: ["pending", "signed", "expired", "rejected"],
      subscription_status: [
        "active",
        "past_due",
        "canceled",
        "incomplete",
        "trialing",
      ],
      verification_status: ["pending", "verified", "rejected", "expired"],
    },
  },
} as const
