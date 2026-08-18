/**
 * Hand-authored subset of the Tea Supabase schema — the tables/RPCs the admin
 * dashboard touches. Regenerate the full version once admin objects are applied:
 *
 *   supabase gen types typescript --project-id oepnxfrzlsrhnfyrqfem > lib/supabase/database.types.ts
 *
 * (that command overwrites this file with the complete, authoritative types).
 */

export type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          alias: string;
          avatar_color: string | null;
          avatar_url: string | null;
          bio: string | null;
          is_verified: boolean | null;
          is_suspended: boolean;
          is_advisor: boolean | null;
          suspended_at: string | null;
          suspension_reason: string | null;
          created_at: string | null;
          last_active_at: string | null;
          pinned_post_id: number | null;
        };
        Insert: { id: string; alias: string; [k: string]: unknown };
        Update: { [k: string]: unknown };
        Relationships: [];
      };
      posts: {
        Row: {
          id: number;
          author_id: string;
          topic_id: number | null;
          type: "original" | "quote" | "repost" | null;
          content: string | null;
          media_url: string | null;
          media_urls: string[];
          mood: string | null;
          is_deleted: boolean | null;
          comments_disabled: boolean;
          view_count: number | null;
          created_at: string | null;
        };
        Insert: { author_id: string; [k: string]: unknown };
        Update: { [k: string]: unknown };
        Relationships: [];
      };
      post_stats: {
        Row: {
          post_id: number;
          red_flag_count: number | null;
          green_flag_count: number | null;
          same_count: number | null;
          sip_count: number | null;
          comment_count: number | null;
        };
        Insert: { post_id: number; [k: string]: unknown };
        Update: { [k: string]: unknown };
        Relationships: [];
      };
      comments: {
        Row: {
          id: number;
          post_id: number;
          author_id: string;
          parent_comment_id: number | null;
          content: string;
          upvotes: number | null;
          is_deleted: boolean | null;
          created_at: string | null;
        };
        Insert: { post_id: number; author_id: string; content: string; [k: string]: unknown };
        Update: { [k: string]: unknown };
        Relationships: [];
      };
      reports: {
        Row: {
          id: number;
          reporter_id: string;
          post_id: number | null;
          comment_id: number | null;
          reason: "spam" | "harassment" | "hate_speech" | "violence" | "misinformation" | "other";
          details: string | null;
          resolved: boolean | null;
          status: string;
          created_at: string | null;
        };
        Insert: { reporter_id: string; reason: string; [k: string]: unknown };
        Update: { [k: string]: unknown };
        Relationships: [];
      };
      topics: {
        Row: {
          id: number;
          name: string;
          icon: string;
          color: string;
          post_count: number | null;
        };
        Insert: { name: string; icon: string; color: string; [k: string]: unknown };
        Update: { [k: string]: unknown };
        Relationships: [];
      };
      // ---- Admin-only tables (created by supabase/admin.sql) ----
      admins: {
        Row: { id: string; user_id: string; email: string; role: string; created_at: string };
        Insert: { user_id: string; email: string; role?: string };
        Update: { [k: string]: unknown };
        Relationships: [];
      };
      admin_audit_log: {
        Row: {
          id: string;
          actor_id: string | null;
          actor_email: string;
          action: string;
          target_type: string;
          target_id: string | null;
          target_label: string | null;
          reason: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          actor_id?: string | null;
          actor_email: string;
          action: string;
          target_type: string;
          target_id?: string | null;
          target_label?: string | null;
          reason?: string | null;
          metadata?: Json | null;
        };
        Update: { [k: string]: unknown };
        Relationships: [];
      };
      admin_broadcasts: {
        Row: {
          id: string;
          title: string;
          body: string;
          route: string | null;
          audience: string;
          status: string;
          recipients: number;
          delivered: number;
          sent_by: string;
          created_at: string;
        };
        Insert: {
          title: string;
          body: string;
          route?: string | null;
          audience?: string;
          status?: string;
          recipients?: number;
          delivered?: number;
          sent_by: string;
        };
        Update: { [k: string]: unknown };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      admin_delete_post: { Args: { p_post_id: number; p_reason: string }; Returns: undefined };
      admin_delete_comment: { Args: { p_comment_id: number; p_reason: string }; Returns: undefined };
      admin_set_suspended: { Args: { p_user_id: string; p_suspended: boolean; p_reason: string }; Returns: undefined };
      admin_set_verified: { Args: { p_user_id: string; p_verified: boolean }; Returns: undefined };
      admin_resolve_report: { Args: { p_report_id: number; p_status: string; p_reason: string }; Returns: undefined };
      admin_list_review_queue: { Args: { p_limit: number; p_cursor: string | null }; Returns: Json };
      admin_pin_post: { Args: { p_post_id: number; p_pinned: boolean }; Returns: undefined };
      is_admin: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: {
      report_reason: "spam" | "harassment" | "hate_speech" | "violence" | "misinformation" | "other";
      verdict_type: "red_flag" | "green_flag" | "same";
      post_type: "original" | "quote" | "repost";
    };
    CompositeTypes: Record<string, never>;
  };
}
