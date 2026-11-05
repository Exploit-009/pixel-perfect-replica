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
      execution_audit: {
        Row: {
          command_id: string | null
          created_at: string
          details: Json
          event: string
          id: string
          session_id: string | null
          user_id: string
        }
        Insert: {
          command_id?: string | null
          created_at?: string
          details?: Json
          event: string
          id?: string
          session_id?: string | null
          user_id: string
        }
        Update: {
          command_id?: string | null
          created_at?: string
          details?: Json
          event?: string
          id?: string
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "execution_audit_command_id_fkey"
            columns: ["command_id"]
            isOneToOne: false
            referencedRelation: "execution_commands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_audit_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "execution_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      execution_commands: {
        Row: {
          argv: string[]
          command: string
          confirmed_at: string | null
          created_at: string
          duration_ms: number | null
          exit_code: number | null
          expires_at: string
          id: string
          remote_job_id: string | null
          session_id: string
          state: string
          stderr: string
          stdout: string
          user_id: string
        }
        Insert: {
          argv: string[]
          command: string
          confirmed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          exit_code?: number | null
          expires_at: string
          id?: string
          remote_job_id?: string | null
          session_id: string
          state?: string
          stderr?: string
          stdout?: string
          user_id: string
        }
        Update: {
          argv?: string[]
          command?: string
          confirmed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          exit_code?: number | null
          expires_at?: string
          id?: string
          remote_job_id?: string | null
          session_id?: string
          state?: string
          stderr?: string
          stdout?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "execution_commands_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "execution_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      execution_permissions: {
        Row: {
          allow_assessment: boolean
          enabled: boolean
          granted_at: string
          user_id: string
        }
        Insert: {
          allow_assessment?: boolean
          enabled?: boolean
          granted_at?: string
          user_id: string
        }
        Update: {
          allow_assessment?: boolean
          enabled?: boolean
          granted_at?: string
          user_id?: string
        }
        Relationships: []
      }
      execution_scopes: {
        Row: {
          authorization_document: string
          created_at: string
          expires_at: string | null
          id: string
          kind: string
          name: string
          network: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          targets: string[]
          user_id: string
        }
        Insert: {
          authorization_document: string
          created_at?: string
          expires_at?: string | null
          id?: string
          kind: string
          name: string
          network?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          targets?: string[]
          user_id: string
        }
        Update: {
          authorization_document?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          kind?: string
          name?: string
          network?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          targets?: string[]
          user_id?: string
        }
        Relationships: []
      }
      execution_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          remote_id: string | null
          scope_id: string
          state: string
          tools: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          remote_id?: string | null
          scope_id: string
          state?: string
          tools?: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          remote_id?: string | null
          scope_id?: string
          state?: string
          tools?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "execution_sessions_scope_id_fkey"
            columns: ["scope_id"]
            isOneToOne: false
            referencedRelation: "execution_scopes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          save_conversations: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          id: string
          save_conversations?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          save_conversations?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      saved_conversations: {
        Row: {
          agent: string
          created_at: string
          id: string
          messages: Json
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agent?: string
          created_at?: string
          id: string
          messages?: Json
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agent?: string
          created_at?: string
          id?: string
          messages?: Json
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
