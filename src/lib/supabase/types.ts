export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type OrgRole =
  | "owner"
  | "admin"
  | "manager"
  | "senior_tech"
  | "technician"
  | "apprentice"
  | "subcontractor"
  | "office_admin";

export type InviteStatus = "pending" | "accepted" | "expired";
export type SubscriptionStatus = "active" | "past_due" | "canceled" | "incomplete" | "trialing";
export type MemberStatus = "active" | "pending" | "suspended" | "archived";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          phone: string | null;
          timezone: string;
          notification_preferences: Json;
          onboarding_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
          timezone?: string;
          notification_preferences?: Json;
          onboarding_completed?: boolean;
        };
        Update: {
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
          timezone?: string;
          notification_preferences?: Json;
          onboarding_completed?: boolean;
        };
      };
      organizations: {
        Row: {
          id: string;
          slug: string;
          name: string;
          trade: string | null;
          logo_url: string | null;
          polar_customer_id: string | null;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          trade?: string | null;
          logo_url?: string | null;
          polar_customer_id?: string | null;
          settings?: Json;
        };
        Update: {
          slug?: string;
          name?: string;
          trade?: string | null;
          logo_url?: string | null;
          polar_customer_id?: string | null;
          settings?: Json;
        };
      };
      organization_members: {
        Row: {
          organization_id: string;
          user_id: string;
          role: OrgRole;
          status: MemberStatus;
          branch: string;
          skills: string[];
          hourly_rate: number | null;
          invited_by: string | null;
          joined_at: string;
        };
        Insert: {
          organization_id: string;
          user_id: string;
          role?: OrgRole;
          status?: MemberStatus;
          branch?: string;
          skills?: string[];
          hourly_rate?: number | null;
          invited_by?: string | null;
        };
        Update: {
          role?: OrgRole;
          status?: MemberStatus;
          branch?: string;
          skills?: string[];
          hourly_rate?: number | null;
        };
      };
      organization_invites: {
        Row: {
          id: string;
          organization_id: string;
          email: string;
          role: OrgRole;
          status: InviteStatus;
          invited_by: string;
          token: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          organization_id: string;
          email: string;
          role?: OrgRole;
          status?: InviteStatus;
          invited_by: string;
          token?: string;
          expires_at?: string;
        };
        Update: {
          role?: OrgRole;
          status?: InviteStatus;
        };
      };
      subscriptions: {
        Row: {
          id: string;
          organization_id: string;
          polar_subscription_id: string;
          polar_product_id: string | null;
          plan_key: string;
          status: SubscriptionStatus;
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          canceled_at: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          organization_id: string;
          polar_subscription_id: string;
          polar_product_id?: string | null;
          plan_key: string;
          status?: SubscriptionStatus;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          metadata?: Json;
        };
        Update: {
          plan_key?: string;
          status?: SubscriptionStatus;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          canceled_at?: string | null;
          metadata?: Json;
        };
      };
      audit_log: {
        Row: {
          id: string;
          organization_id: string | null;
          user_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          old_data: Json | null;
          new_data: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          organization_id?: string | null;
          user_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          old_data?: Json | null;
          new_data?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
        };
        Update: never;
      };
    };
    Functions: {
      get_user_org_ids: {
        Args: Record<string, never>;
        Returns: string[];
      };
      get_user_role: {
        Args: { org_id: string };
        Returns: OrgRole | null;
      };
      user_has_role: {
        Args: { org_id: string; min_role: OrgRole };
        Returns: boolean;
      };
      org_has_active_subscription: {
        Args: { org_id: string };
        Returns: boolean;
      };
      get_org_plan: {
        Args: { org_id: string };
        Returns: string | null;
      };
    };
  };
}
