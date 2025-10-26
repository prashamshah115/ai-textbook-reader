// Database types - Comprehensive schema for AI Textbook Reader
// Auto-generated types based on Supabase schema

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      allowed_users: {
        Row: {
          email: string
          added_by: string | null
          added_at: string
          role: 'admin' | 'user'
        }
        Insert: {
          email: string
          added_by?: string | null
          added_at?: string
          role?: 'admin' | 'user'
        }
        Update: {
          email?: string
          added_by?: string | null
          added_at?: string
          role?: 'admin' | 'user'
        }
      }
      textbooks: {
        Row: {
          id: string
          user_id: string
          title: string
          pdf_url: string | null
          total_pages: number
          metadata: Json | null
          created_at: string
          processing_status: 'pending' | 'processing' | 'completed' | 'failed'
          processing_progress: number
          processing_started_at: string | null
          processing_completed_at: string | null
          processing_error: string | null
          ai_processing_status: 'pending' | 'processing' | 'completed' | 'failed'
          ai_processing_progress: number
          ai_processing_started_at: string | null
          ai_processing_completed_at: string | null
          ai_processing_error: string | null
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          pdf_url?: string | null
          total_pages?: number
          metadata?: Json | null
          created_at?: string
          processing_status?: 'pending' | 'processing' | 'completed' | 'failed'
          processing_progress?: number
          processing_started_at?: string | null
          processing_completed_at?: string | null
          processing_error?: string | null
          ai_processing_status?: 'pending' | 'processing' | 'completed' | 'failed'
          ai_processing_progress?: number
          ai_processing_started_at?: string | null
          ai_processing_completed_at?: string | null
          ai_processing_error?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          pdf_url?: string | null
          total_pages?: number
          metadata?: Json | null
          created_at?: string
          processing_status?: 'pending' | 'processing' | 'completed' | 'failed'
          processing_progress?: number
          processing_started_at?: string | null
          processing_completed_at?: string | null
          processing_error?: string | null
          ai_processing_status?: 'pending' | 'processing' | 'completed' | 'failed'
          ai_processing_progress?: number
          ai_processing_started_at?: string | null
          ai_processing_completed_at?: string | null
          ai_processing_error?: string | null
        }
      }
      pages: {
        Row: {
          id: string
          textbook_id: string
          page_number: number
          raw_text: string
          processed: boolean
          created_at: string
          embedding: string | null  // vector type stored as string
          embedding_model: string | null
          embedding_created_at: string | null
        }
        Insert: {
          id?: string
          textbook_id: string
          page_number: number
          raw_text: string
          processed?: boolean
          created_at?: string
          embedding?: string | null
          embedding_model?: string | null
          embedding_created_at?: string | null
        }
        Update: {
          id?: string
          textbook_id?: string
          page_number?: number
          raw_text?: string
          processed?: boolean
          created_at?: string
          embedding?: string | null
          embedding_model?: string | null
          embedding_created_at?: string | null
        }
      }
      chapters: {
        Row: {
          id: string
          textbook_id: string
          chapter_number: number
          title: string
          page_start: number
          page_end: number
          chapter_summaries: string | null
          created_at: string
        }
        Insert: {
          id?: string
          textbook_id: string
          chapter_number: number
          title: string
          page_start: number
          page_end: number
          chapter_summaries?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          textbook_id?: string
          chapter_number?: number
          title?: string
          page_start?: number
          page_end?: number
          chapter_summaries?: string | null
          created_at?: string
        }
      }
      ai_processed_content: {
        Row: {
          id: string
          page_id: string
          summary: string | null
          key_concepts: Json | null
          connections_to_previous: Json | null
          applications: Json | null
          practice_questions: Json | null
          generated_at: string
        }
        Insert: {
          id?: string
          page_id: string
          summary?: string | null
          key_concepts?: Json | null
          connections_to_previous?: Json | null
          applications?: Json | null
          practice_questions?: Json | null
          generated_at?: string
        }
        Update: {
          id?: string
          page_id?: string
          summary?: string | null
          key_concepts?: Json | null
          connections_to_previous?: Json | null
          applications?: Json | null
          practice_questions?: Json | null
          generated_at?: string
        }
      }
      user_notes: {
        Row: {
          id: string
          user_id: string
          textbook_id: string
          page_number: number | null
          content: string
          position: Json | null
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          textbook_id: string
          page_number?: number | null
          content: string
          position?: Json | null
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          textbook_id?: string
          page_number?: number | null
          content?: string
          position?: Json | null
          updated_at?: string
        }
      }
      chat_conversations: {
        Row: {
          id: string
          user_id: string
          textbook_id: string
          context_pages: number[]
          messages: Json
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          textbook_id: string
          context_pages?: number[]
          messages?: Json
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          textbook_id?: string
          context_pages?: number[]
          messages?: Json
          updated_at?: string
        }
      }
      user_preferences: {
        Row: {
          user_id: string
          learning_goals: string | null
          target_level: 'beginner' | 'intermediate' | 'advanced'
          preferred_summary_style: 'concise' | 'detailed' | 'bullet-points'
          ai_personality: string | null
          updated_at: string
        }
        Insert: {
          user_id: string
          learning_goals?: string | null
          target_level?: 'beginner' | 'intermediate' | 'advanced'
          preferred_summary_style?: 'concise' | 'detailed' | 'bullet-points'
          ai_personality?: string | null
          updated_at?: string
        }
        Update: {
          user_id?: string
          learning_goals?: string | null
          target_level?: 'beginner' | 'intermediate' | 'advanced'
          preferred_summary_style?: 'concise' | 'detailed' | 'bullet-points'
          ai_personality?: string | null
          updated_at?: string
        }
      }
      // Week Bundle System
      week_bundles: {
        Row: {
          id: string
          user_id: string
          course_code: string
          course_name: string | null
          institution: string | null
          week_number: number
          week_topic: string
          parallel_run_id: string | null
          aggregated_content: Json
          aggregated_at: string | null
          status: 'active' | 'archived' | 'deleted'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          course_code: string
          course_name?: string | null
          institution?: string | null
          week_number: number
          week_topic: string
          parallel_run_id?: string | null
          aggregated_content: Json
          aggregated_at?: string | null
          status?: 'active' | 'archived' | 'deleted'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          course_code?: string
          course_name?: string | null
          institution?: string | null
          week_number?: number
          week_topic?: string
          parallel_run_id?: string | null
          aggregated_content?: Json
          aggregated_at?: string | null
          status?: 'active' | 'archived' | 'deleted'
          created_at?: string
          updated_at?: string
        }
      }
      content_items: {
        Row: {
          id: string
          week_bundle_id: string
          content_type: 'textbook' | 'slides' | 'homework' | 'paper'
          title: string
          source_url: string | null
          metadata: Json
          confidence_score: number | null
          parallel_citation: string | null
          display_order: number
          extracted_text: string | null
          extraction_status: 'pending' | 'processing' | 'completed' | 'failed'
          extraction_error: string | null
          extracted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          week_bundle_id: string
          content_type: 'textbook' | 'slides' | 'homework' | 'paper'
          title: string
          source_url?: string | null
          metadata?: Json
          confidence_score?: number | null
          parallel_citation?: string | null
          display_order?: number
          extracted_text?: string | null
          extraction_status?: 'pending' | 'processing' | 'completed' | 'failed'
          extraction_error?: string | null
          extracted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          week_bundle_id?: string
          content_type?: 'textbook' | 'slides' | 'homework' | 'paper'
          title?: string
          source_url?: string | null
          metadata?: Json
          confidence_score?: number | null
          parallel_citation?: string | null
          display_order?: number
          extracted_text?: string | null
          extraction_status?: 'pending' | 'processing' | 'completed' | 'failed'
          extraction_error?: string | null
          extracted_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      content_access: {
        Row: {
          id: string
          user_id: string
          content_item_id: string
          page_number: number | null
          duration_seconds: number
          accessed_at: string
          auto_notes_generated: boolean
          questions_answered: number
          session_id: string | null
        }
        Insert: {
          id?: string
          user_id: string
          content_item_id: string
          page_number?: number | null
          duration_seconds?: number
          accessed_at?: string
          auto_notes_generated?: boolean
          questions_answered?: number
          session_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          content_item_id?: string
          page_number?: number | null
          duration_seconds?: number
          accessed_at?: string
          auto_notes_generated?: boolean
          questions_answered?: number
          session_id?: string | null
        }
      }
      // Flashcard System
      flashcards: {
        Row: {
          id: string
          user_id: string
          textbook_id: string
          page_number: number | null
          question: string
          answer: string
          hint: string | null
          ease_factor: number
          interval_days: number
          repetitions: number
          next_review: string
          last_reviewed: string | null
          source: 'manual' | 'ai_generated' | 'highlighted'
          difficulty: 'easy' | 'medium' | 'hard' | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          textbook_id: string
          page_number?: number | null
          question: string
          answer: string
          hint?: string | null
          ease_factor?: number
          interval_days?: number
          repetitions?: number
          next_review?: string
          last_reviewed?: string | null
          source?: 'manual' | 'ai_generated' | 'highlighted'
          difficulty?: 'easy' | 'medium' | 'hard' | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          textbook_id?: string
          page_number?: number | null
          question?: string
          answer?: string
          hint?: string | null
          ease_factor?: number
          interval_days?: number
          repetitions?: number
          next_review?: string
          last_reviewed?: string | null
          source?: 'manual' | 'ai_generated' | 'highlighted'
          difficulty?: 'easy' | 'medium' | 'hard' | null
          created_at?: string
          updated_at?: string
        }
      }
      flashcard_reviews: {
        Row: {
          id: string
          flashcard_id: string
          user_id: string
          quality: number
          time_taken_seconds: number | null
          reviewed_at: string
        }
        Insert: {
          id?: string
          flashcard_id: string
          user_id: string
          quality: number
          time_taken_seconds?: number | null
          reviewed_at?: string
        }
        Update: {
          id?: string
          flashcard_id?: string
          user_id?: string
          quality?: number
          time_taken_seconds?: number | null
          reviewed_at?: string
        }
      }
      user_study_stats: {
        Row: {
          id: string
          user_id: string
          textbook_id: string | null
          date: string
          cards_reviewed: number
          cards_learned: number
          study_time_seconds: number
          streak_days: number
        }
        Insert: {
          id?: string
          user_id: string
          textbook_id?: string | null
          date?: string
          cards_reviewed?: number
          cards_learned?: number
          study_time_seconds?: number
          streak_days?: number
        }
        Update: {
          id?: string
          user_id?: string
          textbook_id?: string | null
          date?: string
          cards_reviewed?: number
          cards_learned?: number
          study_time_seconds?: number
          streak_days?: number
        }
      }
      // Semantic Search & Analytics
      search_queries: {
        Row: {
          id: string
          user_id: string | null
          textbook_id: string | null
          query_text: string
          results_count: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          textbook_id?: string | null
          query_text: string
          results_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          textbook_id?: string | null
          query_text?: string
          results_count?: number
          created_at?: string
        }
      }
      user_reading_stats: {
        Row: {
          id: string
          user_id: string
          textbook_id: string
          topic: string
          confidence_score: number
          times_reviewed: number
          times_failed: number
          last_reviewed: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          textbook_id: string
          topic: string
          confidence_score?: number
          times_reviewed?: number
          times_failed?: number
          last_reviewed?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          textbook_id?: string
          topic?: string
          confidence_score?: number
          times_reviewed?: number
          times_failed?: number
          last_reviewed?: string | null
          created_at?: string
        }
      }
      concept_maps: {
        Row: {
          id: string
          user_id: string
          textbook_id: string
          chapter_id: string | null
          page_range_start: number | null
          page_range_end: number | null
          concepts: Json
          relationships: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          textbook_id: string
          chapter_id?: string | null
          page_range_start?: number | null
          page_range_end?: number | null
          concepts?: Json
          relationships?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          textbook_id?: string
          chapter_id?: string | null
          page_range_start?: number | null
          page_range_end?: number | null
          concepts?: Json
          relationships?: Json
          created_at?: string
          updated_at?: string
        }
      }
      // Metrics
      metrics: {
        Row: {
          id: string
          metric_name: string
          value: number
          unit: string
          textbook_id: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          metric_name: string
          value: number
          unit: string
          textbook_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          metric_name?: string
          value?: number
          unit?: string
          textbook_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_pages: {
        Args: {
          query_embedding: string
          match_threshold?: number
          match_count?: number
          filter_textbook_id?: string
        }
        Returns: {
          id: string
          textbook_id: string
          page_number: number
          raw_text: string
          similarity: number
        }[]
      }
      get_due_cards_count: {
        Args: {
          p_user_id: string
          p_textbook_id: string
        }
        Returns: number
      }
      update_study_streak: {
        Args: {
          p_user_id: string
          p_textbook_id: string
        }
        Returns: void
      }
      update_concept_confidence: {
        Args: {
          p_user_id: string
          p_textbook_id: string
          p_topic: string
          p_success: boolean
        }
        Returns: void
      }
    }
    Enums: {
      user_role: 'admin' | 'user'
      target_level: 'beginner' | 'intermediate' | 'advanced'
      summary_style: 'concise' | 'detailed' | 'bullet-points'
      processing_status: 'pending' | 'processing' | 'completed' | 'failed'
      content_type: 'textbook' | 'slides' | 'homework' | 'paper'
      extraction_status: 'pending' | 'processing' | 'completed' | 'failed'
      flashcard_source: 'manual' | 'ai_generated' | 'highlighted'
      flashcard_difficulty: 'easy' | 'medium' | 'hard'
    }
  }
}
