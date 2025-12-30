/**
 * Database types generated from Supabase schema
 * Run `npm run db:generate` to regenerate from live database
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          avatar_url: string | null;
          bio: string | null;
          birth_year: number | null;
          city: string;
          location: unknown | null; // PostGIS geography type
          interests: string[];
          subscription_type: 'free' | 'participant' | 'organizer';
          subscription_expires_at: string | null;
          rating: number;
          reviews_count: number;
          events_organized: number;
          events_attended: number;
          no_show_count: number;
          is_verified: boolean;
          is_banned: boolean;
          banned_until: string | null;
          push_token: string | null;
          last_active_at: string | null;
          role: 'user' | 'moderator' | 'admin';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          avatar_url?: string | null;
          bio?: string | null;
          birth_year?: number | null;
          city: string;
          location?: unknown | null;
          interests?: string[];
          subscription_type?: 'free' | 'participant' | 'organizer';
          subscription_expires_at?: string | null;
          rating?: number;
          reviews_count?: number;
          events_organized?: number;
          events_attended?: number;
          no_show_count?: number;
          is_verified?: boolean;
          is_banned?: boolean;
          banned_until?: string | null;
          push_token?: string | null;
          last_active_at?: string | null;
          role?: 'user' | 'moderator' | 'admin';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          avatar_url?: string | null;
          bio?: string | null;
          birth_year?: number | null;
          city?: string;
          location?: unknown | null;
          interests?: string[];
          subscription_type?: 'free' | 'participant' | 'organizer';
          subscription_expires_at?: string | null;
          rating?: number;
          reviews_count?: number;
          events_organized?: number;
          events_attended?: number;
          no_show_count?: number;
          is_verified?: boolean;
          is_banned?: boolean;
          banned_until?: string | null;
          push_token?: string | null;
          last_active_at?: string | null;
          role?: 'user' | 'moderator' | 'admin';
          created_at?: string;
          updated_at?: string;
        };
      };
      activity_categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          icon: string | null;
          color: string | null;
          parent_id: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          icon?: string | null;
          color?: string | null;
          parent_id?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          icon?: string | null;
          color?: string | null;
          parent_id?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
      };
      events: {
        Row: {
          id: string;
          organizer_id: string;
          title: string;
          description: string | null;
          category_id: string | null;
          tags: string[];
          cover_image_url: string | null;
          starts_at: string;
          ends_at: string | null;
          duration_minutes: number | null;
          timezone: string;
          location: unknown; // PostGIS geography type
          address: string;
          place_name: string | null;
          place_details: string | null;
          city: string;
          min_participants: number;
          max_participants: number | null;
          current_participants: number;
          is_public: boolean;
          requires_approval: boolean;
          allow_chat: boolean;
          entry_fee: number;
          status: 'draft' | 'published' | 'cancelled' | 'completed';
          cancelled_reason: string | null;
          views_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organizer_id: string;
          title: string;
          description?: string | null;
          category_id?: string | null;
          tags?: string[];
          cover_image_url?: string | null;
          starts_at: string;
          ends_at?: string | null;
          duration_minutes?: number | null;
          timezone?: string;
          location: unknown;
          address: string;
          place_name?: string | null;
          place_details?: string | null;
          city: string;
          min_participants?: number;
          max_participants?: number | null;
          current_participants?: number;
          is_public?: boolean;
          requires_approval?: boolean;
          allow_chat?: boolean;
          entry_fee?: number;
          status?: 'draft' | 'published' | 'cancelled' | 'completed';
          cancelled_reason?: string | null;
          views_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organizer_id?: string;
          title?: string;
          description?: string | null;
          category_id?: string | null;
          tags?: string[];
          cover_image_url?: string | null;
          starts_at?: string;
          ends_at?: string | null;
          duration_minutes?: number | null;
          timezone?: string;
          location?: unknown;
          address?: string;
          place_name?: string | null;
          place_details?: string | null;
          city?: string;
          min_participants?: number;
          max_participants?: number | null;
          current_participants?: number;
          is_public?: boolean;
          requires_approval?: boolean;
          allow_chat?: boolean;
          entry_fee?: number;
          status?: 'draft' | 'published' | 'cancelled' | 'completed';
          cancelled_reason?: string | null;
          views_count?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      event_participants: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          status: 'pending' | 'approved' | 'declined' | 'cancelled' | 'attended' | 'no_show';
          payment_id: string | null;
          payment_status: 'pending' | 'paid' | 'refunded' | null;
          message_to_organizer: string | null;
          joined_at: string;
          approved_at: string | null;
          cancelled_at: string | null;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id: string;
          status?: 'pending' | 'approved' | 'declined' | 'cancelled' | 'attended' | 'no_show';
          payment_id?: string | null;
          payment_status?: 'pending' | 'paid' | 'refunded' | null;
          message_to_organizer?: string | null;
          joined_at?: string;
          approved_at?: string | null;
          cancelled_at?: string | null;
        };
        Update: {
          id?: string;
          event_id?: string;
          user_id?: string;
          status?: 'pending' | 'approved' | 'declined' | 'cancelled' | 'attended' | 'no_show';
          payment_id?: string | null;
          payment_status?: 'pending' | 'paid' | 'refunded' | null;
          message_to_organizer?: string | null;
          joined_at?: string;
          approved_at?: string | null;
          cancelled_at?: string | null;
        };
      };
      reviews: {
        Row: {
          id: string;
          event_id: string;
          reviewer_id: string;
          reviewee_id: string;
          rating: number;
          comment: string | null;
          review_type: 'organizer_to_participant' | 'participant_to_organizer';
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          reviewer_id: string;
          reviewee_id: string;
          rating: number;
          comment?: string | null;
          review_type: 'organizer_to_participant' | 'participant_to_organizer';
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          reviewer_id?: string;
          reviewee_id?: string;
          rating?: number;
          comment?: string | null;
          review_type?: 'organizer_to_participant' | 'participant_to_organizer';
          created_at?: string;
        };
      };
      event_messages: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          content: string;
          is_system: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id: string;
          content: string;
          is_system?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          user_id?: string;
          content?: string;
          is_system?: boolean;
          created_at?: string;
        };
      };
      app_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          type: 'participant' | 'organizer';
          starts_at: string;
          expires_at: string;
          payment_id: string | null;
          amount: number;
          is_active: boolean;
          auto_renew: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: 'participant' | 'organizer';
          starts_at: string;
          expires_at: string;
          payment_id?: string | null;
          amount: number;
          is_active?: boolean;
          auto_renew?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: 'participant' | 'organizer';
          starts_at?: string;
          expires_at?: string;
          payment_id?: string | null;
          amount?: number;
          is_active?: boolean;
          auto_renew?: boolean;
          created_at?: string;
        };
      };
      event_payments: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          amount: number;
          yookassa_payment_id: string | null;
          status: 'pending' | 'succeeded' | 'cancelled' | 'refunded';
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id: string;
          amount: number;
          yookassa_payment_id?: string | null;
          status?: 'pending' | 'succeeded' | 'cancelled' | 'refunded';
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          user_id?: string;
          amount?: number;
          yookassa_payment_id?: string | null;
          status?: 'pending' | 'succeeded' | 'cancelled' | 'refunded';
          created_at?: string;
        };
      };
      saved_events: {
        Row: {
          user_id: string;
          event_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          event_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          event_id?: string;
          created_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          body: string | null;
          data: Json;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          title: string;
          body?: string | null;
          data?: Json;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          title?: string;
          body?: string | null;
          data?: Json;
          is_read?: boolean;
          created_at?: string;
        };
      };
    };
    Views: {};
    Functions: {
      increment_participants: {
        Args: { p_event_id: string };
        Returns: undefined;
      };
      decrement_participants: {
        Args: { p_event_id: string };
        Returns: undefined;
      };
      increment_no_show: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
      recalculate_rating: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
      search_events_nearby: {
        Args: {
          p_latitude: number;
          p_longitude: number;
          p_distance_meters: number;
          p_category_id?: string;
          p_date_from?: string;
          p_date_to?: string;
          p_city?: string;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          id: string;
          title: string;
          description: string | null;
          category_id: string | null;
          starts_at: string;
          location: unknown;
          address: string;
          place_name: string | null;
          city: string;
          current_participants: number;
          max_participants: number | null;
          organizer_id: string;
          distance_meters: number;
        }[];
      };
    };
    Enums: {
      subscription_type: 'free' | 'participant' | 'organizer';
      user_role: 'user' | 'moderator' | 'admin';
      event_status: 'draft' | 'published' | 'cancelled' | 'completed';
      participant_status: 'pending' | 'approved' | 'declined' | 'cancelled' | 'attended' | 'no_show';
      payment_status: 'pending' | 'paid' | 'refunded';
      payment_type: 'pending' | 'succeeded' | 'cancelled' | 'refunded';
      review_type: 'organizer_to_participant' | 'participant_to_organizer';
    };
  };
};

// Helper types for easier access
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T];
export type Functions<T extends keyof Database['public']['Functions']> =
  Database['public']['Functions'][T];
