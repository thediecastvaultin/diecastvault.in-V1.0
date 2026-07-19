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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_events: {
        Row: {
          created_at: string
          description: string | null
          id: string
          kind: string
          link: string | null
          meta: Json
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          kind: string
          link?: string | null
          meta?: Json
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          link?: string | null
          meta?: Json
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      addresses: {
        Row: {
          city: string
          country: string
          created_at: string
          full_name: string
          id: string
          is_default: boolean
          line1: string
          line2: string | null
          phone: string
          postal_code: string
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          city: string
          country?: string
          created_at?: string
          full_name: string
          id?: string
          is_default?: boolean
          line1: string
          line2?: string | null
          phone: string
          postal_code: string
          state: string
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          full_name?: string
          id?: string
          is_default?: boolean
          line1?: string
          line2?: string | null
          phone?: string
          postal_code?: string
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_notifications: {
        Row: {
          body: string | null
          created_at: string
          display_order: number
          expires_at: string | null
          id: string
          kind: string
          link: string | null
          read: boolean
          starts_at: string | null
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          display_order?: number
          expires_at?: string | null
          id?: string
          kind: string
          link?: string | null
          read?: boolean
          starts_at?: string | null
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          display_order?: number
          expires_at?: string | null
          id?: string
          kind?: string
          link?: string | null
          read?: boolean
          starts_at?: string | null
          title?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          active: boolean
          body: string | null
          channel: string
          created_at: string
          created_by: string | null
          display_order: number
          expires_at: string | null
          id: string
          kind: string
          link: string | null
          pinned: boolean
          push_sent: boolean
          starts_at: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          body?: string | null
          channel?: string
          created_at?: string
          created_by?: string | null
          display_order?: number
          expires_at?: string | null
          id?: string
          kind?: string
          link?: string | null
          pinned?: boolean
          push_sent?: boolean
          starts_at?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string | null
          channel?: string
          created_at?: string
          created_by?: string | null
          display_order?: number
          expires_at?: string | null
          id?: string
          kind?: string
          link?: string | null
          pinned?: boolean
          push_sent?: boolean
          starts_at?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      auction_drafts: {
        Row: {
          brand: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          images: Json
          min_increment: number
          product_name: string
          rules: string
          scale: string
          series: string
          starting_bid: number
          updated_at: string
        }
        Insert: {
          brand?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          images?: Json
          min_increment?: number
          product_name?: string
          rules?: string
          scale?: string
          series?: string
          starting_bid?: number
          updated_at?: string
        }
        Update: {
          brand?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          images?: Json
          min_increment?: number
          product_name?: string
          rules?: string
          scale?: string
          series?: string
          starting_bid?: number
          updated_at?: string
        }
        Relationships: []
      }
      auction_events: {
        Row: {
          amount: number | null
          color: string
          created_at: string
          display_name: string
          id: string
          kind: string
          session_id: string
          text: string | null
          tone: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          color?: string
          created_at?: string
          display_name: string
          id?: string
          kind: string
          session_id: string
          text?: string | null
          tone?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          color?: string
          created_at?: string
          display_name?: string
          id?: string
          kind?: string
          session_id?: string
          text?: string | null
          tone?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      auction_logs: {
        Row: {
          bid_history: Json
          brand: string | null
          closed_by_name: string | null
          closed_by_user_id: string | null
          created_at: string
          duration_seconds: number | null
          ended_at: string
          id: string
          image_url: string | null
          participant_count: number
          product_name: string
          scale: string | null
          series: string | null
          session_id: string | null
          started_at: string | null
          status: string
          total_bids: number
          winner_email: string | null
          winner_name: string | null
          winner_phone: string | null
          winner_user_id: string | null
          winning_bid: number | null
        }
        Insert: {
          bid_history?: Json
          brand?: string | null
          closed_by_name?: string | null
          closed_by_user_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string
          id?: string
          image_url?: string | null
          participant_count?: number
          product_name: string
          scale?: string | null
          series?: string | null
          session_id?: string | null
          started_at?: string | null
          status?: string
          total_bids?: number
          winner_email?: string | null
          winner_name?: string | null
          winner_phone?: string | null
          winner_user_id?: string | null
          winning_bid?: number | null
        }
        Update: {
          bid_history?: Json
          brand?: string | null
          closed_by_name?: string | null
          closed_by_user_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string
          id?: string
          image_url?: string | null
          participant_count?: number
          product_name?: string
          scale?: string | null
          series?: string | null
          session_id?: string | null
          started_at?: string | null
          status?: string
          total_bids?: number
          winner_email?: string | null
          winner_name?: string | null
          winner_phone?: string | null
          winner_user_id?: string | null
          winning_bid?: number | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      badges: {
        Row: {
          category: string
          code: string
          created_at: string
          description: string
          icon: string
          image_url: string | null
          name: string
          sort_order: number
        }
        Insert: {
          category?: string
          code: string
          created_at?: string
          description: string
          icon?: string
          image_url?: string | null
          name: string
          sort_order?: number
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          description?: string
          icon?: string
          image_url?: string | null
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          cart_id: string
          created_at: string
          id: string
          product_id: string
          quantity: number
          unit_price_cents: number
          updated_at: string
        }
        Insert: {
          cart_id: string
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          unit_price_cents: number
          updated_at?: string
        }
        Update: {
          cart_id?: string
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          unit_price_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          created_at: string
          id: string
          session_token: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          session_token?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          session_token?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      coupon_redemptions: {
        Row: {
          coupon_code: string
          created_at: string
          discount_cents: number
          id: string
          order_id: string | null
          user_id: string
        }
        Insert: {
          coupon_code: string
          created_at?: string
          discount_cents?: number
          id?: string
          order_id?: string | null
          user_id: string
        }
        Update: {
          coupon_code?: string
          created_at?: string
          discount_cents?: number
          id?: string
          order_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          expires_at: string | null
          first_x_customers: number | null
          id: string
          max_discount_cents: number | null
          max_uses: number | null
          max_uses_per_person: number | null
          min_order_cents: number
          updated_at: string
          used_count: number
          valid_from: string | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          discount_type: string
          discount_value: number
          expires_at?: string | null
          first_x_customers?: number | null
          id?: string
          max_discount_cents?: number | null
          max_uses?: number | null
          max_uses_per_person?: number | null
          min_order_cents?: number
          updated_at?: string
          used_count?: number
          valid_from?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          first_x_customers?: number | null
          id?: string
          max_discount_cents?: number | null
          max_uses?: number | null
          max_uses_per_person?: number | null
          min_order_cents?: number
          updated_at?: string
          used_count?: number
          valid_from?: string | null
        }
        Relationships: []
      }
      notification_reads: {
        Row: {
          notification_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          notification_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          notification_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "admin_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          line_total_cents: number
          order_id: string
          product_id: string | null
          product_image: string | null
          product_name: string
          product_series: string | null
          quantity: number
          unit_price_cents: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total_cents: number
          order_id: string
          product_id?: string | null
          product_image?: string | null
          product_name: string
          product_series?: string | null
          quantity: number
          unit_price_cents: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total_cents?: number
          order_id?: string
          product_id?: string | null
          product_image?: string | null
          product_name?: string
          product_series?: string | null
          quantity?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          actor_name: string | null
          created_at: string
          customer_email: string | null
          customer_name: string | null
          id: string
          new_value: Json | null
          order_id: string | null
          order_number: string
          previous_value: Json | null
          snapshot: Json
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          new_value?: Json | null
          order_id?: string | null
          order_number: string
          previous_value?: Json | null
          snapshot?: Json
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          new_value?: Json | null
          order_id?: string | null
          order_number?: string
          previous_value?: Json | null
          snapshot?: Json
        }
        Relationships: []
      }
      order_number_counters: {
        Row: {
          last_seq: number
          period: string
          updated_at: string
        }
        Insert: {
          last_seq?: number
          period: string
          updated_at?: string
        }
        Update: {
          last_seq?: number
          period?: string
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          admin_notes: string | null
          archived_at: string | null
          auction_log_id: string | null
          contact_email: string
          coupon_code: string | null
          created_at: string
          discount_cents: number
          id: string
          notes: string | null
          order_number: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          shipping_address: Json
          shipping_cents: number
          status: Database["public"]["Enums"]["order_status"]
          subtotal_cents: number
          tax_cents: number
          total_cents: number
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          archived_at?: string | null
          auction_log_id?: string | null
          contact_email: string
          coupon_code?: string | null
          created_at?: string
          discount_cents?: number
          id?: string
          notes?: string | null
          order_number?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          shipping_address: Json
          shipping_cents?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_cents: number
          tax_cents?: number
          total_cents: number
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          archived_at?: string | null
          auction_log_id?: string | null
          contact_email?: string
          coupon_code?: string | null
          created_at?: string
          discount_cents?: number
          id?: string
          notes?: string | null
          order_number?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          shipping_address?: Json
          shipping_cents?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_auction_log_id_fkey"
            columns: ["auction_log_id"]
            isOneToOne: false
            referencedRelation: "auction_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_costs: {
        Row: {
          cost_cents: number
          created_at: string
          product_id: string
          updated_at: string
        }
        Insert: {
          cost_cents?: number
          created_at?: string
          product_id: string
          updated_at?: string
        }
        Update: {
          cost_cents?: number
          created_at?: string
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          color: string | null
          coming_soon: boolean
          condition: string
          created_at: string
          description: string | null
          featured: boolean
          id: string
          image_urls: string[]
          low_stock_threshold: number
          max_per_customer: number
          meta_description: string | null
          meta_title: string | null
          name: string
          og_image_url: string | null
          price_cents: number
          rarity: string | null
          search_vector: unknown
          series: string
          slug: string
          status: string
          stock_quantity: number
          updated_at: string
          year: number | null
        }
        Insert: {
          category_id?: string | null
          color?: string | null
          coming_soon?: boolean
          condition?: string
          created_at?: string
          description?: string | null
          featured?: boolean
          id?: string
          image_urls?: string[]
          low_stock_threshold?: number
          max_per_customer?: number
          meta_description?: string | null
          meta_title?: string | null
          name: string
          og_image_url?: string | null
          price_cents: number
          rarity?: string | null
          search_vector?: unknown
          series: string
          slug: string
          status?: string
          stock_quantity?: number
          updated_at?: string
          year?: number | null
        }
        Update: {
          category_id?: string | null
          color?: string | null
          coming_soon?: boolean
          condition?: string
          created_at?: string
          description?: string | null
          featured?: boolean
          id?: string
          image_urls?: string[]
          low_stock_threshold?: number
          max_per_customer?: number
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          og_image_url?: string | null
          price_cents?: number
          rarity?: string | null
          search_vector?: unknown
          series?: string
          slug?: string
          status?: string
          stock_quantity?: number
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          phone: string | null
          shipping_address: Json | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          phone?: string | null
          shipping_address?: Json | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          shipping_address?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          approved: boolean
          body: string | null
          created_at: string
          id: string
          image_url: string | null
          product_id: string
          rating: number
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approved?: boolean
          body?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          product_id: string
          rating: number
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approved?: boolean
          body?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          product_id?: string
          rating?: number
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_code: string
          earned_at: string
          granted_by: string | null
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          badge_code: string
          earned_at?: string
          granted_by?: string | null
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          badge_code?: string
          earned_at?: string
          granted_by?: string | null
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_code_fkey"
            columns: ["badge_code"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["code"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wishlist: {
        Row: {
          created_at: string
          id: string
          owned: boolean
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          owned?: boolean
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          owned?: boolean
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_count_scope: { Args: { _scope: string }; Returns: number }
      admin_grant_badge: {
        Args: { _code: string; _target: string }
        Returns: undefined
      }
      admin_grant_role_by_email: {
        Args: {
          _email: string
          _grant: boolean
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: {
          email: string
          granted: boolean
          user_id: string
        }[]
      }
      admin_list_customers: {
        Args: never
        Returns: {
          display_name: string
          email: string
          last_order_at: string
          order_count: number
          phone: string
          total_spent_cents: number
          user_id: string
        }[]
      }
      admin_prepare_production: {
        Args: { _include_flash?: boolean; _include_notifications?: boolean }
        Returns: Json
      }
      admin_reset_scope: { Args: { _scope: string }; Returns: Json }
      admin_revoke_badge: {
        Args: { _code: string; _target: string }
        Returns: undefined
      }
      admin_set_role: {
        Args: {
          _grant: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _target_user: string
        }
        Returns: undefined
      }
      auction_finalize_if_expired: { Args: never; Returns: boolean }
      award_badge: { Args: { _code: string; _user: string }; Returns: boolean }
      build_order_snapshot:
        | {
            Args: { _order: Database["public"]["Tables"]["orders"]["Row"] }
            Returns: Json
          }
        | { Args: { _order_id: string }; Returns: Json }
      check_purchase_limit: {
        Args: { _product_id: string; _requested_qty: number }
        Returns: {
          allowed: boolean
          already_purchased: number
          limit_per_customer: number
          product_name: string
        }[]
      }
      clear_active_auction: { Args: never; Returns: undefined }
      evaluate_user_badges: { Args: { _user: string }; Returns: undefined }
      finalize_active_auction: { Args: never; Returns: string }
      get_leaderboard: {
        Args: { _kind: string; _period: string }
        Returns: {
          avatar_url: string
          display_name: string
          user_id: string
          value: number
        }[]
      }
      get_user_rank: { Args: { _user: string }; Returns: string }
      get_user_stats: { Args: { _user: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      link_my_orders: { Args: never; Returns: number }
      log_order_event: {
        Args: {
          _action: string
          _new: Json
          _order: Database["public"]["Tables"]["orders"]["Row"]
          _prev: Json
        }
        Returns: undefined
      }
      next_order_number: { Args: never; Returns: string }
      validate_coupon: {
        Args: { _code: string; _subtotal_cents: number }
        Returns: {
          code: string
          discount_cents: number
          discount_type: string
          discount_value: number
          max_discount_cents: number
          min_order_cents: number
          reason: string
          valid: boolean
        }[]
      }
      write_order_log: {
        Args: {
          _action: string
          _new: Json
          _order_id: string
          _order_number: string
          _previous: Json
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "customer" | "staff"
      order_status:
        | "pending"
        | "paid"
        | "packed"
        | "shipped"
        | "delivered"
        | "cancelled"
      payment_method: "cod" | "online"
      payment_status: "pending" | "paid" | "refunded" | "failed"
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
      app_role: ["admin", "customer", "staff"],
      order_status: [
        "pending",
        "paid",
        "packed",
        "shipped",
        "delivered",
        "cancelled",
      ],
      payment_method: ["cod", "online"],
      payment_status: ["pending", "paid", "refunded", "failed"],
    },
  },
} as const
