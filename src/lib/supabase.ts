import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables not found. Using mock data mode.');
  // For development without Supabase, we'll handle this gracefully
}

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Database types
export interface Database {
  public: {
    Tables: {
      assets: {
        Row: {
          id: string;
          name: string;
          type: 'application' | 'database' | 'infrastructure' | 'middleware' | 'cloud-service' | 'third-party-service';
          category: string;
          description: string;
          owner: string;
          status: 'active' | 'inactive' | 'deprecated' | 'planned';
          criticality: 'high' | 'medium' | 'low';
          tags: string[];
          metadata: Record<string, any>;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          type: 'application' | 'database' | 'infrastructure' | 'middleware' | 'cloud-service' | 'third-party-service';
          category: string;
          description: string;
          owner: string;
          status?: 'active' | 'inactive' | 'deprecated' | 'planned';
          criticality?: 'high' | 'medium' | 'low';
          tags?: string[];
          metadata?: Record<string, any>;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          type?: 'application' | 'database' | 'infrastructure' | 'middleware' | 'cloud-service' | 'third-party-service';
          category?: string;
          description?: string;
          owner?: string;
          status?: 'active' | 'inactive' | 'deprecated' | 'planned';
          criticality?: 'high' | 'medium' | 'low';
          tags?: string[];
          metadata?: Record<string, any>;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      asset_uploads: {
        Row: {
          id: string;
          file_name: string;
          file_size: number | null;
          status: 'pending' | 'processing' | 'completed' | 'failed';
          progress: number;
          total_rows: number;
          processed_rows: number;
          error_rows: number;
          errors: any[];
          uploaded_by: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          file_name: string;
          file_size?: number | null;
          status?: 'pending' | 'processing' | 'completed' | 'failed';
          progress?: number;
          total_rows?: number;
          processed_rows?: number;
          error_rows?: number;
          errors?: any[];
          uploaded_by?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          file_name?: string;
          file_size?: number | null;
          status?: 'pending' | 'processing' | 'completed' | 'failed';
          progress?: number;
          total_rows?: number;
          processed_rows?: number;
          error_rows?: number;
          errors?: any[];
          uploaded_by?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
      };
    };
  };
}