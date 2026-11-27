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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          changed_at: string
          id: number
          new_row: Json | null
          old_row: Json | null
          operation: string
          record_id: string
          source: string
          table_name: string
        }
        Insert: {
          changed_at?: string
          id?: never
          new_row?: Json | null
          old_row?: Json | null
          operation: string
          record_id: string
          source: string
          table_name: string
        }
        Update: {
          changed_at?: string
          id?: never
          new_row?: Json | null
          old_row?: Json | null
          operation?: string
          record_id?: string
          source?: string
          table_name?: string
        }
        Relationships: []
      }
      agent_instructions: {
        Row: {
          active: boolean
          body: string
          created_at: string
          id: string
          key: string
          last_changed_by: string
          position: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          body: string
          created_at?: string
          id?: string
          key: string
          last_changed_by?: string
          position?: number
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          id?: string
          key?: string
          last_changed_by?: string
          position?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_person_id: string | null
          blocked_task_id: string | null
          blocking_task_id: string
          created_at: string
          id: string
          last_changed_by: string
          note: string | null
          updated_at: string
        }
        Insert: {
          blocked_person_id?: string | null
          blocked_task_id?: string | null
          blocking_task_id: string
          created_at?: string
          id?: string
          last_changed_by?: string
          note?: string | null
          updated_at?: string
        }
        Update: {
          blocked_person_id?: string | null
          blocked_task_id?: string | null
          blocking_task_id?: string
          created_at?: string
          id?: string
          last_changed_by?: string
          note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_person_id_fkey"
            columns: ["blocked_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocked_task_id_fkey"
            columns: ["blocked_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocked_task_id_fkey"
            columns: ["blocked_task_id"]
            isOneToOne: false
            referencedRelation: "v_priorities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocked_task_id_fkey"
            columns: ["blocked_task_id"]
            isOneToOne: false
            referencedRelation: "v_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocking_task_id_fkey"
            columns: ["blocking_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocking_task_id_fkey"
            columns: ["blocking_task_id"]
            isOneToOne: false
            referencedRelation: "v_priorities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocking_task_id_fkey"
            columns: ["blocking_task_id"]
            isOneToOne: false
            referencedRelation: "v_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      checkpoints: {
        Row: {
          completed_at: string | null
          created_at: string
          due_date: string
          id: string
          kind: string
          last_changed_by: string
          name: string
          project_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          due_date: string
          id?: string
          kind: string
          last_changed_by?: string
          name: string
          project_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          due_date?: string
          id?: string
          kind?: string
          last_changed_by?: string
          name?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkpoints_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          id: string
          last_changed_by: string
          logo: string | null
          logo_path: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_changed_by?: string
          logo?: string | null
          logo_path?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_changed_by?: string
          logo?: string | null
          logo_path?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      features: {
        Row: {
          color: string | null
          created_at: string
          id: string
          last_changed_by: string
          name: string
          position: number | null
          project_id: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          last_changed_by?: string
          name: string
          position?: number | null
          project_id: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          last_changed_by?: string
          name?: string
          position?: number | null
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "features_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_items: {
        Row: {
          body: string
          created_at: string
          id: string
          last_changed_by: string
          triaged_at: string | null
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          last_changed_by?: string
          triaged_at?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          last_changed_by?: string
          triaged_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      people: {
        Row: {
          created_at: string
          id: string
          last_changed_by: string
          name: string
          role: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_changed_by?: string
          name: string
          role?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_changed_by?: string
          name?: string
          role?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_people: {
        Row: {
          created_at: string
          id: string
          last_changed_by: string
          person_id: string
          project_id: string
          role: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_changed_by?: string
          person_id: string
          project_id: string
          role?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_changed_by?: string
          person_id?: string
          project_id?: string
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_people_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_people_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client: string | null
          closed_at: string | null
          color: string | null
          created_at: string
          github_repo: string | null
          icon: string | null
          id: string
          last_changed_by: string
          logo: string | null
          logo_path: string | null
          name: string
          scope: string
          short_name: string | null
          start_date: string | null
          status: string
          updated_at: string
          weekly_hours: number | null
        }
        Insert: {
          client?: string | null
          closed_at?: string | null
          color?: string | null
          created_at?: string
          github_repo?: string | null
          icon?: string | null
          id?: string
          last_changed_by?: string
          logo?: string | null
          logo_path?: string | null
          name: string
          scope: string
          short_name?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          weekly_hours?: number | null
        }
        Update: {
          client?: string | null
          closed_at?: string | null
          color?: string | null
          created_at?: string
          github_repo?: string | null
          icon?: string | null
          id?: string
          last_changed_by?: string
          logo?: string | null
          logo_path?: string | null
          name?: string
          scope?: string
          short_name?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          weekly_hours?: number | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          checkpoint_id: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          feature_id: string | null
          github_issue_number: number | null
          id: string
          impact: string
          kind: string | null
          last_changed_by: string
          next_action: string | null
          origin: string
          position: number | null
          project_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          checkpoint_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          feature_id?: string | null
          github_issue_number?: number | null
          id?: string
          impact?: string
          kind?: string | null
          last_changed_by?: string
          next_action?: string | null
          origin?: string
          position?: number | null
          project_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          checkpoint_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          feature_id?: string | null
          github_issue_number?: number | null
          id?: string
          impact?: string
          kind?: string | null
          last_changed_by?: string
          next_action?: string | null
          origin?: string
          position?: number | null
          project_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_checkpoint_id_project_id_fkey"
            columns: ["checkpoint_id", "project_id"]
            isOneToOne: false
            referencedRelation: "checkpoints"
            referencedColumns: ["id", "project_id"]
          },
          {
            foreignKeyName: "tasks_feature_id_project_id_fkey"
            columns: ["feature_id", "project_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id", "project_id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          created_at: string
          entry_date: string
          hours: number
          id: string
          last_changed_by: string
          note: string | null
          project_id: string
          task_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          entry_date: string
          hours: number
          id?: string
          last_changed_by?: string
          note?: string | null
          project_id: string
          task_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          entry_date?: string
          hours?: number
          id?: string
          last_changed_by?: string
          note?: string | null
          project_id?: string
          task_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_task_id_project_id_fkey"
            columns: ["task_id", "project_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id", "project_id"]
          },
          {
            foreignKeyName: "time_entries_task_id_project_id_fkey"
            columns: ["task_id", "project_id"]
            isOneToOne: false
            referencedRelation: "v_priorities"
            referencedColumns: ["id", "project_id"]
          },
          {
            foreignKeyName: "time_entries_task_id_project_id_fkey"
            columns: ["task_id", "project_id"]
            isOneToOne: false
            referencedRelation: "v_tasks"
            referencedColumns: ["id", "project_id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          board_columns: string[] | null
          grouped_columns: string[] | null
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          board_columns?: string[] | null
          grouped_columns?: string[] | null
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          board_columns?: string[] | null
          grouped_columns?: string[] | null
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      waiting_items: {
        Row: {
          ask_by: string | null
          asked_at: string | null
          created_at: string
          description: string
          id: string
          kind: string
          last_changed_by: string
          person_id: string
          received_at: string | null
          task_id: string
          updated_at: string
        }
        Insert: {
          ask_by?: string | null
          asked_at?: string | null
          created_at?: string
          description: string
          id?: string
          kind: string
          last_changed_by?: string
          person_id: string
          received_at?: string | null
          task_id: string
          updated_at?: string
        }
        Update: {
          ask_by?: string | null
          asked_at?: string | null
          created_at?: string
          description?: string
          id?: string
          kind?: string
          last_changed_by?: string
          person_id?: string
          received_at?: string | null
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "waiting_items_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiting_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiting_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "v_priorities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiting_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "v_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_priorities: {
        Row: {
          blocks_others: boolean | null
          checkpoint_due_date: string | null
          checkpoint_id: string | null
          checkpoint_name: string | null
          completed_at: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          effective_due_date: string | null
          estimated_hours: number | null
          feature_id: string | null
          github_issue_number: number | null
          has_question_to_ask: boolean | null
          id: string | null
          impact: string | null
          is_blocked: boolean | null
          is_waiting: boolean | null
          kind: string | null
          last_activity: string | null
          last_changed_by: string | null
          next_action: string | null
          origin: string | null
          position: number | null
          priority_level: number | null
          priority_rank: number | null
          project_id: string | null
          project_name: string | null
          project_scope: string | null
          project_status: string | null
          status: string | null
          title: string | null
          updated_at: string | null
          waiting_on: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_checkpoint_id_project_id_fkey"
            columns: ["checkpoint_id", "project_id"]
            isOneToOne: false
            referencedRelation: "checkpoints"
            referencedColumns: ["id", "project_id"]
          },
          {
            foreignKeyName: "tasks_feature_id_project_id_fkey"
            columns: ["feature_id", "project_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id", "project_id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      v_tasks: {
        Row: {
          blocks_others: boolean | null
          checkpoint_due_date: string | null
          checkpoint_id: string | null
          checkpoint_name: string | null
          completed_at: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          effective_due_date: string | null
          estimated_hours: number | null
          feature_id: string | null
          github_issue_number: number | null
          has_question_to_ask: boolean | null
          id: string | null
          impact: string | null
          is_blocked: boolean | null
          is_waiting: boolean | null
          kind: string | null
          last_activity: string | null
          last_changed_by: string | null
          next_action: string | null
          origin: string | null
          position: number | null
          project_id: string | null
          project_name: string | null
          project_scope: string | null
          project_status: string | null
          status: string | null
          title: string | null
          updated_at: string | null
          waiting_on: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_checkpoint_id_project_id_fkey"
            columns: ["checkpoint_id", "project_id"]
            isOneToOne: false
            referencedRelation: "checkpoints"
            referencedColumns: ["id", "project_id"]
          },
          {
            foreignKeyName: "tasks_feature_id_project_id_fkey"
            columns: ["feature_id", "project_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id", "project_id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      app_source: { Args: never; Returns: string }
      is_coordinator_owner: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
