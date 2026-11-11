
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "application_notes": {
                  Row: {
                    "application_id": string,"created_at": string,"internal_note": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "application_id": string,"created_at"?: string,"internal_note": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "application_id"?: string,"created_at"?: string,"internal_note"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "application_notes_application_id_fkey"
      columns: ["application_id"]
isOneToOne: true
      referencedRelation: "applications"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "application_notes_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"applications": {
                  Row: {
                    "applicant_message": string | null,"created_at": string,"id": string,"responses": NonNullable<Json>,"reviewed_at": string | null,"reviewed_by": string | null,"status": Database["public"]['Enums']["volunteer_status"],"submitted_at": string,"updated_at": string,"volunteer_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "applicant_message"?: string | null,"created_at"?: string,"id"?: string,"responses"?: NonNullable<Json>,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["volunteer_status"],"submitted_at"?: string,"updated_at"?: string,"volunteer_id": string
                  }
                  Update: {
                    "applicant_message"?: string | null,"created_at"?: string,"id"?: string,"responses"?: NonNullable<Json>,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["volunteer_status"],"submitted_at"?: string,"updated_at"?: string,"volunteer_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "applications_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "applications_volunteer_id_fkey"
      columns: ["volunteer_id"]
isOneToOne: false
      referencedRelation: "volunteers"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"entity_id": string,"id": number,"new_value": string | null,"old_value": string | null,"organization_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"entity_id": string,"id"?: never,"new_value"?: string | null,"old_value"?: string | null,"organization_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"entity_id"?: string,"id"?: never,"new_value"?: string | null,"old_value"?: string | null,"organization_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"custom_fields": {
                  Row: {
                    "created_at": string,"entity_type": string,"field_name": string,"field_type": string,"id": string,"options": NonNullable<Json>,"organization_id": string,"position": number,"required": boolean,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"entity_type": string,"field_name": string,"field_type": string,"id"?: string,"options"?: NonNullable<Json>,"organization_id": string,"position"?: number,"required"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"entity_type"?: string,"field_name"?: string,"field_type"?: string,"id"?: string,"options"?: NonNullable<Json>,"organization_id"?: string,"position"?: number,"required"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "custom_fields_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "capacity": number | null,"category": string | null,"created_at": string,"description": string | null,"ends_at": string,"id": string,"location": string | null,"organization_id": string,"registration_deadline": string | null,"requirements": string | null,"starts_at": string,"status": Database["public"]['Enums']["event_status"],"title": string,"updated_at": string,"registration_count": number | null
                  }
                  ComputedFields: "registration_count"
                  Insert: {
                    "capacity"?: number | null,"category"?: string | null,"created_at"?: string,"description"?: string | null,"ends_at": string,"id"?: string,"location"?: string | null,"organization_id": string,"registration_deadline"?: string | null,"requirements"?: string | null,"starts_at": string,"status"?: Database["public"]['Enums']["event_status"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "capacity"?: number | null,"category"?: string | null,"created_at"?: string,"description"?: string | null,"ends_at"?: string,"id"?: string,"location"?: string | null,"organization_id"?: string,"registration_deadline"?: string | null,"requirements"?: string | null,"starts_at"?: string,"status"?: Database["public"]['Enums']["event_status"],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"invitations": {
                  Row: {
                    "created_at": string,"email": string,"expires_at": string,"id": string,"issued_by": string | null,"organization_id": string,"redeemed_at": string | null,"redeemed_by": string | null,"revoked_at": string | null,"role": Database["public"]['Enums']["app_role"],"token_hash": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"expires_at": string,"id"?: string,"issued_by"?: string | null,"organization_id": string,"redeemed_at"?: string | null,"redeemed_by"?: string | null,"revoked_at"?: string | null,"role"?: Database["public"]['Enums']["app_role"],"token_hash": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"expires_at"?: string,"id"?: string,"issued_by"?: string | null,"organization_id"?: string,"redeemed_at"?: string | null,"redeemed_by"?: string | null,"revoked_at"?: string | null,"role"?: Database["public"]['Enums']["app_role"],"token_hash"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitations_issued_by_fkey"
      columns: ["issued_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitations_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitations_redeemed_by_fkey"
      columns: ["redeemed_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "created_at": string,"id": string,"organization_id": string,"role": Database["public"]['Enums']["app_role"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"organization_id": string,"role"?: Database["public"]['Enums']["app_role"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"organization_id"?: string,"role"?: Database["public"]['Enums']["app_role"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "created_at": string,"default_rejection_message": string | null,"id": string,"logo_url": string | null,"name": string,"primary_color": string | null,"secondary_color": string | null,"settings": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"default_rejection_message"?: string | null,"id"?: string,"logo_url"?: string | null,"name": string,"primary_color"?: string | null,"secondary_color"?: string | null,"settings"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"default_rejection_message"?: string | null,"id"?: string,"logo_url"?: string | null,"name"?: string,"primary_color"?: string | null,"secondary_color"?: string | null,"settings"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"registrations": {
                  Row: {
                    "attendance_status": string | null,"created_at": string,"custom_responses": NonNullable<Json>,"event_id": string,"id": string,"status": Database["public"]['Enums']["registration_status"],"updated_at": string,"volunteer_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attendance_status"?: string | null,"created_at"?: string,"custom_responses"?: NonNullable<Json>,"event_id": string,"id"?: string,"status"?: Database["public"]['Enums']["registration_status"],"updated_at"?: string,"volunteer_id": string
                  }
                  Update: {
                    "attendance_status"?: string | null,"created_at"?: string,"custom_responses"?: NonNullable<Json>,"event_id"?: string,"id"?: string,"status"?: Database["public"]['Enums']["registration_status"],"updated_at"?: string,"volunteer_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "registrations_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "registrations_volunteer_id_fkey"
      columns: ["volunteer_id"]
isOneToOne: false
      referencedRelation: "volunteers"
      referencedColumns: ["id"]
    }
                  ]
                },"users": {
                  Row: {
                    "created_at": string,"email": string | null,"first_name": string | null,"id": string,"last_name": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"first_name"?: string | null,"id": string,"last_name"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"first_name"?: string | null,"id"?: string,"last_name"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"volunteers": {
                  Row: {
                    "availability_days": (Database["public"]['Enums']["weekday"])[],"consent_accepted_at": string | null,"created_at": string,"emergency_contact_name": string | null,"emergency_contact_phone": string | null,"emergency_contact_relationship": string | null,"id": string,"location": string | null,"organization_id": string | null,"phone": string | null,"shift_preference": Database["public"]['Enums']["shift"] | null,"skills": (string)[],"status": Database["public"]['Enums']["volunteer_status"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "availability_days"?: (Database["public"]['Enums']["weekday"])[],"consent_accepted_at"?: string | null,"created_at"?: string,"emergency_contact_name"?: string | null,"emergency_contact_phone"?: string | null,"emergency_contact_relationship"?: string | null,"id"?: string,"location"?: string | null,"organization_id"?: string | null,"phone"?: string | null,"shift_preference"?: Database["public"]['Enums']["shift"] | null,"skills"?: (string)[],"status"?: Database["public"]['Enums']["volunteer_status"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "availability_days"?: (Database["public"]['Enums']["weekday"])[],"consent_accepted_at"?: string | null,"created_at"?: string,"emergency_contact_name"?: string | null,"emergency_contact_phone"?: string | null,"emergency_contact_relationship"?: string | null,"id"?: string,"location"?: string | null,"organization_id"?: string | null,"phone"?: string | null,"shift_preference"?: Database["public"]['Enums']["shift"] | null,"skills"?: (string)[],"status"?: Database["public"]['Enums']["volunteer_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "volunteers_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "volunteers_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "create_invitation":
{ Args: { "invitee_email": string,"invitee_role"?: Database["public"]['Enums']["app_role"] }; Returns: {
              "invitation_id": string,"token": string
            }[]
                           },
"redeem_invitation":
{ Args: { "invitation_token": string }; Returns: string
                           },
"registration_count":
{ Args: { "": Database["public"]['Tables']["events"]['Row'] }; Returns: { error: true } & "the function public.registration_count with parameter or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache"
                           },
"revoke_invitation":
{ Args: { "target_invitation_id": string }; Returns: undefined
                           },
"set_user_role":
{ Args: { "new_role": Database["public"]['Enums']["app_role"],"target_user_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "app_role": "admin"|"manager"|"volunteer","event_status": "draft"|"published"|"cancelled"|"completed","registration_status": "registered"|"cancelled","shift": "morning"|"afternoon"|"evening","volunteer_status": "pending"|"approved"|"rejected","weekday": "monday"|"tuesday"|"wednesday"|"thursday"|"friday"|"saturday"|"sunday"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "app_role": ["admin", "manager", "volunteer"],"event_status": ["draft", "published", "cancelled", "completed"],"registration_status": ["registered", "cancelled"],"shift": ["morning", "afternoon", "evening"],"volunteer_status": ["pending", "approved", "rejected"],"weekday": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
          }
        }
} as const
