export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      schools: {
        Row: {
          id: string;
          inep: string | null;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          inep?: string | null;
          name: string;
        };
        Update: {
          id?: string;
          inep?: string | null;
          name?: string;
        };
      };
      classrooms: {
        Row: {
          id: string;
          school_id: string;
          year_grade: string;
          label: string;
          shift: string;
          dt_user_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          year_grade: string;
          label: string;
          shift: string;
          dt_user_id?: string | null;
        };
        Update: {
          school_id?: string;
          year_grade?: string;
          label?: string;
          shift?: string;
          dt_user_id?: string | null;
        };
      };
      students: {
        Row: {
          id: string;
          school_id: string;
          classroom_id: string;
          enrollment_code: string | null;
          name: string;
          birthdate: string | null;
          responsible_name: string | null;
          responsible_phone: string | null;
          status: string;
          is_leader: boolean;
          is_vice_leader: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          classroom_id: string;
          enrollment_code?: string | null;
          name: string;
          birthdate?: string | null;
          responsible_name?: string | null;
          responsible_phone?: string | null;
          status?: string;
          is_leader?: boolean;
          is_vice_leader?: boolean;
        };
        Update: {
          school_id?: string;
          classroom_id?: string;
          enrollment_code?: string | null;
          name?: string;
          birthdate?: string | null;
          responsible_name?: string | null;
          responsible_phone?: string | null;
          status?: string;
          is_leader?: boolean;
          is_vice_leader?: boolean;
        };
      };
      profiles: {
        Row: {
          user_id: string;
          role: string;
          school_id: string | null;
          classroom_id: string | null;
          full_name: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          role: string;
          school_id?: string | null;
          classroom_id?: string | null;
          full_name: string;
        };
        Update: {
          role?: string;
          school_id?: string | null;
          classroom_id?: string | null;
          full_name?: string;
        };
      };
      access_locks: {
        Row: {
          classroom_id: string;
          bio_form_locked: boolean;
          locked_at: string | null;
          locked_by: string | null;
        };
        Insert: {
          classroom_id: string;
          bio_form_locked?: boolean;
          locked_at?: string | null;
          locked_by?: string | null;
        };
        Update: {
          bio_form_locked?: boolean;
          locked_at?: string | null;
          locked_by?: string | null;
        };
      };
      student_photos: {
        Row: {
          student_id: string;
          storage_path: string;
          updated_at: string;
          updated_by: string;
        };
        Insert: {
          student_id: string;
          storage_path: string;
          updated_by: string;
        };
        Update: {
          storage_path?: string;
          updated_by?: string;
        };
      };
      seat_maps: {
        Row: {
          classroom_id: string;
          layout_json: Json;
          updated_at: string;
          updated_by: string;
        };
        Insert: {
          classroom_id: string;
          layout_json: Json;
          updated_by: string;
        };
        Update: {
          layout_json?: Json;
          updated_by?: string;
        };
      };
      bio_forms: {
        Row: {
          student_id: string;
          sections_json: Json;
          completed: boolean;
          updated_at: string;
        };
        Insert: {
          student_id: string;
          sections_json?: Json;
          completed?: boolean;
        };
        Update: {
          sections_json?: Json;
          completed?: boolean;
        };
      };
      attendance_logs: {
        Row: {
          id: string;
          student_id: string;
          classroom_id: string;
          type: string;
          notes: string | null;
          created_at: string;
          created_by: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          classroom_id: string;
          type: string;
          notes?: string | null;
          created_by: string;
        };
        Update: {
          notes?: string;
        };
      };
      audit_log: {
        Row: {
          id: string;
          action: string;
          entity: string;
          entity_id: string;
          actor_user_id: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          action: string;
          entity: string;
          entity_id: string;
          actor_user_id: string;
          metadata?: Json;
        };
        Update: {
          action?: string;
          entity?: string;
          entity_id?: string;
          actor_user_id?: string;
          metadata?: Json;
        };
      };
    };
    Views: {
      v_classroom_stats: {
        Row: {
          classroom_id: string;
          school_id: string;
          school_name: string;
          year_grade: string;
          label: string;
          shift: string;
          total_students: number;
          bio_completed: number;
          bio_pending: number;
          photos_uploaded: number;
          photos_missing: number;
        };
      };
      v_classroom_characterization: {
        Row: {
          classroom_id: string;
          student_id: string;
          student_name: string;
          birthdate: string | null;
          responsible_name: string | null;
          status: string;
          sections_json: Json;
          bio_completed: boolean;
        };
      };
    };
    Functions: {};
    Enums: {};
  };
}
