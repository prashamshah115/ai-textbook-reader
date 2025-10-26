import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

// Types
export interface WeekBundle {
  id: string;
  user_id: string;
  course_code: string;
  course_name: string | null;
  institution: string;
  week_number: number;
  week_topic: string;
  parallel_run_id: string | null;
  aggregated_content: AggregatedContent;
  aggregated_at: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AggregatedContent {
  textbooks: TextbookReference[];
  slides: SlideReference[];
  homework: HomeworkReference[];
  papers: PaperReference[];
  parallelRunId?: string;
  aggregatedAt: string;
}

export interface TextbookReference {
  title: string;
  authors?: string[];
  pages: [number, number];
  chapter?: number;
  url?: string;
  confidence?: number;
}

export interface SlideReference {
  title: string;
  url: string;
  pages: number;
  professor?: string;
  confidence?: number;
}

export interface HomeworkReference {
  assignment: string;
  problems: string[];
  url?: string;
  dueDate?: string;
  confidence?: number;
}

export interface PaperReference {
  title: string;
  authors: string[];
  url: string;
  year: number;
  venue?: string;
  confidence?: number;
}

export interface ContentItem {
  id: string;
  week_bundle_id: string;
  content_type: 'textbook' | 'slides' | 'homework' | 'paper';
  title: string;
  source_url: string | null;
  metadata: any;
  confidence_score: number | null;
  parallel_citation: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface ContentAccess {
  id: string;
  user_id: string;
  content_item_id: string;
  page_number: number | null;
  duration_seconds: number;
  accessed_at: string;
  auto_notes_generated: boolean;
  questions_answered: number;
  session_id: string | null;
}

interface WeekBundleContextType {
  // State
  currentBundle: WeekBundle | null;
  contentItems: ContentItem[];
  selectedContent: ContentItem | null;
  currentPage: number;
  loading: boolean;
  error: string | null;

  // Bundle management
  loadBundle: (bundleId: string) => Promise<void>;
  createBundle: (params: {
    courseCode: string;
    institution: string;
    weekNumber: number;
    weekTopic: string;
  }) => Promise<string>;

  // Content selection
  selectContent: (contentItem: ContentItem) => void;
  setCurrentPage: (page: number) => void;

  // Access tracking
  trackAccess: (contentItemId: string, pageNumber?: number) => Promise<void>;
  updateAccessDuration: (accessId: string, durationSeconds: number) => Promise<void>;
}

const WeekBundleContext = createContext<WeekBundleContextType | undefined>(undefined);

export function WeekBundleProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [currentBundle, setCurrentBundle] = useState<WeekBundle | null>(null);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load a week bundle by ID
  const loadBundle = async (bundleId: string) => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch week bundle
      const { data: bundle, error: bundleError } = await supabase
        .from('week_bundles')
        .select('*')
        .eq('id', bundleId)
        .eq('user_id', user.id)
        .single();

      if (bundleError) throw bundleError;

      setCurrentBundle(bundle);

      // Fetch content items
      const { data: items, error: itemsError } = await supabase
        .from('content_items')
        .select('*')
        .eq('week_bundle_id', bundleId)
        .order('display_order', { ascending: true });

      if (itemsError) throw itemsError;

      setContentItems(items || []);

      // Auto-select first content item
      if (items && items.length > 0) {
        setSelectedContent(items[0]);
      }

    } catch (err) {
      console.error('Error loading bundle:', err);
      setError(err instanceof Error ? err.message : 'Failed to load bundle');
    } finally {
      setLoading(false);
    }
  };

  // Create a new week bundle
  const createBundle = async (params: {
    courseCode: string;
    institution: string;
    weekNumber: number;
    weekTopic: string;
  }): Promise<string> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    setLoading(true);
    setError(null);

    try {
      // Call aggregation API
      const response = await fetch('/api/week/aggregate-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...params,
          userId: user.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create bundle');
      }

      const data = await response.json();

      // Load the newly created bundle
      await loadBundle(data.bundleId);

      return data.bundleId;

    } catch (err) {
      console.error('Error creating bundle:', err);
      const message = err instanceof Error ? err.message : 'Failed to create bundle';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  // Select a content item
  const selectContent = (contentItem: ContentItem) => {
    setSelectedContent(contentItem);
    setCurrentPage(1); // Reset to first page
  };

  // Track content access
  const trackAccess = async (contentItemId: string, pageNumber?: number) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('content_access')
        .insert({
          user_id: user.id,
          content_item_id: contentItemId,
          page_number: pageNumber,
          accessed_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Error tracking access:', error);
      }
    } catch (err) {
      console.error('Error tracking access:', err);
    }
  };

  // Update access duration
  const updateAccessDuration = async (accessId: string, durationSeconds: number) => {
    try {
      const { error } = await supabase
        .from('content_access')
        .update({ duration_seconds: durationSeconds })
        .eq('id', accessId);

      if (error) {
        console.error('Error updating duration:', error);
      }
    } catch (err) {
      console.error('Error updating duration:', err);
    }
  };

  const value: WeekBundleContextType = {
    currentBundle,
    contentItems,
    selectedContent,
    currentPage,
    loading,
    error,
    loadBundle,
    createBundle,
    selectContent,
    setCurrentPage,
    trackAccess,
    updateAccessDuration,
  };

  return (
    <WeekBundleContext.Provider value={value}>
      {children}
    </WeekBundleContext.Provider>
  );
}

export function useWeekBundle() {
  const context = useContext(WeekBundleContext);
  if (context === undefined) {
    throw new Error('useWeekBundle must be used within a WeekBundleProvider');
  }
  return context;
}


