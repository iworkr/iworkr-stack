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
          unit_price: number | null
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          invoice_id: string
          quantity?: number | null
          sort_order?: number | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number | null
          sort_order?: number | null
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
      schedule_blocks: {
        Row: {
          client_name: string | null
          created_at: string | null
          end_time: string
          id: string
          is_conflict: boolean | null
          job_id: string | null
          location: string | null
          metadata: Json | null
          notes: string | null
          organization_id: string
          start_time: string
          status: Database["public"]["Enums"]["schedule_block_status"] | null
          technician_id: string
          title: string
          travel_minutes: number | null
          updated_at: string | null
        }
        Insert: {
          client_name?: string | null
          created_at?: string | null
          end_time: string
          id?: string
          is_conflict?: boolean | null
          job_id?: string | null
          location?: string | null
          metadata?: Json | null
          notes?: string | null
          organization_id: string
          start_time: string
          status?: Database["public"]["Enums"]["schedule_block_status"] | null
          technician_id: string
          title: string
          travel_minutes?: number | null
          updated_at?: string | null
        }
        Update: {
          client_name?: string | null
          created_at?: string | null
          end_time?: string
          id?: string
          is_conflict?: boolean | null
          job_id?: string | null
          location?: string | null
          metadata?: Json | null
          notes?: string | null
          organization_id?: string
          start_time?: string
          status?: Database["public"]["Enums"]["schedule_block_status"] | null
          technician_id?: string
          title?: string
          travel_minutes?: number | null
          updated_at?: string | null
        }
        Relationships: [
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
      telemetry_events: {
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
          break_duration_minutes: number | null
          break_end: string | null
          break_start: string | null
          clock_in: string
          clock_in_lat: number | null
          clock_in_lng: number | null
          clock_out: string | null
          clock_out_lat: number | null
          clock_out_lng: number | null
          created_at: string | null
          geo_warning: boolean | null
          id: string
          job_id: string | null
          metadata: Json | null
          notes: string | null
          organization_id: string
          status: string
          total_minutes: number | null
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          break_duration_minutes?: number | null
          break_end?: string | null
          break_start?: string | null
          clock_in?: string
          clock_in_lat?: number | null
          clock_in_lng?: number | null
          clock_out?: string | null
          clock_out_lat?: number | null
          clock_out_lng?: number | null
          created_at?: string | null
          geo_warning?: boolean | null
          id?: string
          job_id?: string | null
          metadata?: Json | null
          notes?: string | null
          organization_id: string
          status?: string
          total_minutes?: number | null
          type?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          break_duration_minutes?: number | null
          break_end?: string | null
          break_start?: string | null
          clock_in?: string
          clock_in_lat?: number | null
          clock_in_lng?: number | null
          clock_out?: string | null
          clock_out_lat?: number | null
          clock_out_lng?: number | null
          created_at?: string | null
          geo_warning?: boolean | null
          id?: string
          job_id?: string | null
          metadata?: Json | null
          notes?: string | null
          organization_id?: string
          status?: string
          total_minutes?: number | null
          type?: string
          updated_at?: string | null
          user_id?: string
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
          client_name: string | null
          created_at: string | null
          end_time: string
          id: string
          is_conflict: boolean | null
          job_id: string | null
          location: string | null
          metadata: Json | null
          notes: string | null
          organization_id: string
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
      get_ai_insights: { Args: { p_org_id: string }; Returns: Json }
      get_assets_overview: { Args: { p_org_id: string }; Returns: Json }
      get_automation_stats: {
        Args: { p_flow_id?: string; p_org_id: string }
        Returns: Json
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
      get_or_create_dm: {
        Args: { p_organization_id: string; p_other_user_id: string }
        Returns: string
      }
      get_org_plan: { Args: { org_id: string }; Returns: string }
      get_quote_pipeline: { Args: { p_org_id: string }; Returns: Json }
      get_roles_with_counts: { Args: { p_org_id: string }; Returns: Json }
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
      save_dashboard_layout: { Args: { p_layout: Json }; Returns: undefined }
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
      asset_category: "vehicle" | "tool" | "equipment" | "other"
      asset_status: "available" | "assigned" | "maintenance" | "retired"
      channel_type: "dm" | "group" | "job_context" | "broadcast" | "triage"
      client_status: "active" | "lead" | "churned" | "inactive"
      client_type: "residential" | "commercial"
      email_status:
        | "queued"
        | "sent"
        | "delivered"
        | "bounced"
        | "complained"
        | "failed"
      flow_status: "active" | "paused" | "draft" | "archived"
      form_status: "draft" | "published" | "archived"
      integration_status: "connected" | "disconnected" | "error" | "syncing"
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
      quote_status:
        | "draft"
        | "sent"
        | "viewed"
        | "accepted"
        | "rejected"
        | "expired"
      schedule_block_status:
        | "scheduled"
        | "en_route"
        | "on_site"
        | "in_progress"
        | "complete"
        | "cancelled"
      schedule_event_type: "break" | "meeting" | "personal" | "unavailable"
      stock_level: "ok" | "low" | "critical"
      submission_status: "pending" | "signed" | "expired" | "rejected"
      subscription_status:
        | "active"
        | "past_due"
        | "canceled"
        | "incomplete"
        | "trialing"
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
      asset_category: ["vehicle", "tool", "equipment", "other"],
      asset_status: ["available", "assigned", "maintenance", "retired"],
      channel_type: ["dm", "group", "job_context", "broadcast", "triage"],
      client_status: ["active", "lead", "churned", "inactive"],
      client_type: ["residential", "commercial"],
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
      integration_status: ["connected", "disconnected", "error", "syncing"],
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
      quote_status: [
        "draft",
        "sent",
        "viewed",
        "accepted",
        "rejected",
        "expired",
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
      stock_level: ["ok", "low", "critical"],
      submission_status: ["pending", "signed", "expired", "rejected"],
      subscription_status: [
        "active",
        "past_due",
        "canceled",
        "incomplete",
        "trialing",
      ],
    },
  },
} as const
