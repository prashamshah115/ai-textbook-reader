import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { WeekBundle, ContentItem, AggregatedContent } from './WeekBundleContext';

// Daily session tracking
export interface DailySession {
  day: string;
  topic: string;
  pages: number[];
  activities: string[];
  completed: boolean;
  questionsAnswered?: number;
  questionsCorrect?: number;
}

// Knowledge graph node
export interface KnowledgeNode {
  concept: string;
  mastery: number;
  lastPracticed: Date;
}

// Sprint = WeekBundle + additional tracking
export interface Sprint extends WeekBundle {
  dailySessions: DailySession[];
  knowledgeGraph: KnowledgeNode[];
  autoNotes: string;
  progress: number; // 0-100
}

interface SprintContextType {
  // State
  currentSprint: Sprint | null;
  allSprints: Sprint[];
  contentItems: ContentItem[];
  selectedContent: ContentItem | null;
  activeDayIndex: number | null;
  currentPage: number;
  loading: boolean;
  error: string | null;

  // View management
  viewMode: 'dashboard' | 'detail' | 'reader';
  setViewMode: (mode: 'dashboard' | 'detail' | 'reader') => void;

  // Sprint management
  loadAllSprints: () => Promise<void>;
  loadSprint: (bundleId: string) => Promise<void>;
  createSprint: (params: {
    courseCode: string;
    institution: string;
    weekNumber: number;
    weekTopic: string;
  }) => Promise<string>;

  // Content selection
  selectContent: (contentItem: ContentItem) => void;
  setCurrentPage: (page: number) => void;

  // Progress tracking
  setActiveDayIndex: (index: number | null) => void;
  completeActivity: (dayIndex: number, activityIndex: number) => void;
  answerQuestion: (dayIndex: number, correct: boolean) => void;

  // Access tracking
  trackAccess: (contentItemId: string, pageNumber?: number) => Promise<void>;
}

const SprintContext = createContext<SprintContextType | undefined>(undefined);

export function SprintProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'dashboard' | 'detail' | 'reader'>('dashboard');
  const [currentSprint, setCurrentSprint] = useState<Sprint | null>(null);
  const [allSprints, setAllSprints] = useState<Sprint[]>([]);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
  const [activeDayIndex, setActiveDayIndex] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load all sprints for dashboard
  const loadAllSprints = async () => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: bundles, error: bundlesError } = await supabase
        .from('week_bundles')
        .select('*')
        .eq('user_id', user.id)
        .order('course_code', { ascending: true })
        .order('week_number', { ascending: true });

      if (bundlesError) throw bundlesError;

      // Convert bundles to sprints
      const sprints = (bundles || []).map(bundle => enrichBundleToSprint(bundle));
      setAllSprints(sprints);

    } catch (err) {
      console.error('Error loading sprints:', err);
      setError(err instanceof Error ? err.message : 'Failed to load sprints');
    } finally {
      setLoading(false);
    }
  };

  // Load a single sprint by ID
  const loadSprint = async (bundleId: string) => {
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

      // Convert to sprint
      const sprint = enrichBundleToSprint(bundle);
      setCurrentSprint(sprint);

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
      console.error('Error loading sprint:', err);
      setError(err instanceof Error ? err.message : 'Failed to load sprint');
    } finally {
      setLoading(false);
    }
  };

  // Create a new sprint
  const createSprint = async (params: {
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
        throw new Error(errorData.error || 'Failed to create sprint');
      }

      const data = await response.json();

      // Load the newly created sprint
      await loadSprint(data.bundleId);

      return data.bundleId;

    } catch (err) {
      console.error('Error creating sprint:', err);
      const message = err instanceof Error ? err.message : 'Failed to create sprint';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  // Select a content item
  const selectContent = (contentItem: ContentItem) => {
    setSelectedContent(contentItem);
    setCurrentPage(1);
  };

  // Complete an activity
  const completeActivity = (dayIndex: number, activityIndex: number) => {
    if (!currentSprint) return;

    const updatedSessions = [...currentSprint.dailySessions];
    if (updatedSessions[dayIndex]) {
      updatedSessions[dayIndex] = {
        ...updatedSessions[dayIndex],
        completed: true,
      };

      setCurrentSprint({
        ...currentSprint,
        dailySessions: updatedSessions,
        progress: calculateProgress(updatedSessions),
      });
    }
  };

  // Answer a question
  const answerQuestion = (dayIndex: number, correct: boolean) => {
    if (!currentSprint) return;

    const updatedSessions = [...currentSprint.dailySessions];
    if (updatedSessions[dayIndex]) {
      updatedSessions[dayIndex] = {
        ...updatedSessions[dayIndex],
        questionsAnswered: (updatedSessions[dayIndex].questionsAnswered || 0) + 1,
        questionsCorrect: (updatedSessions[dayIndex].questionsCorrect || 0) + (correct ? 1 : 0),
      };

      setCurrentSprint({
        ...currentSprint,
        dailySessions: updatedSessions,
      });
    }
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

  const value: SprintContextType = {
    currentSprint,
    allSprints,
    contentItems,
    selectedContent,
    activeDayIndex,
    currentPage,
    loading,
    error,
    viewMode,
    setViewMode,
    loadAllSprints,
    loadSprint,
    createSprint,
    selectContent,
    setCurrentPage,
    setActiveDayIndex,
    completeActivity,
    answerQuestion,
    trackAccess,
  };

  return (
    <SprintContext.Provider value={value}>
      {children}
    </SprintContext.Provider>
  );
}

export function useSprint() {
  const context = useContext(SprintContext);
  if (context === undefined) {
    throw new Error('useSprint must be used within a SprintProvider');
  }
  return context;
}

// Helper: Enrich WeekBundle to Sprint
function enrichBundleToSprint(bundle: WeekBundle): Sprint {
  // Generate 7 daily sessions based on week topic
  const dailySessions = generateDailySessions(bundle.week_topic);
  
  // Generate knowledge graph (mock for now)
  const knowledgeGraph = generateKnowledgeGraph(bundle.week_topic);
  
  // Auto-generate notes (or retrieve if stored)
  const autoNotes = generateAutoNotes(bundle);
  
  // Calculate progress
  const progress = calculateProgress(dailySessions);

  return {
    ...bundle,
    dailySessions,
    knowledgeGraph,
    autoNotes,
    progress,
  };
}

// Helper: Generate daily sessions
function generateDailySessions(weekTopic: string): DailySession[] {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  return days.map((day, index) => ({
    day,
    topic: index === 0 ? `Introduction to ${weekTopic}` : 
           index === days.length - 1 ? 'Review & Practice' :
           `${weekTopic} - Part ${index + 1}`,
    pages: [100 + (index * 10), 110 + (index * 10)],
    activities: [
      `Read assigned pages`,
      `Review key concepts`,
      `Complete practice questions`,
    ],
    completed: false,
  }));
}

// Helper: Generate knowledge graph
function generateKnowledgeGraph(weekTopic: string): KnowledgeNode[] {
  const concepts = [weekTopic, 'Core Concepts', 'Advanced Topics', 'Applications'];
  
  return concepts.map(concept => ({
    concept,
    mastery: Math.floor(Math.random() * 100),
    lastPracticed: new Date(),
  }));
}

// Helper: Generate auto-notes
function generateAutoNotes(bundle: WeekBundle): string {
  return `# ${bundle.course_code} - Week ${bundle.week_number}: ${bundle.week_topic}

## Overview
This week covers ${bundle.week_topic.toLowerCase()}.

## Key Concepts
- Concept 1
- Concept 2
- Concept 3

## Important Formulas
(To be generated from extracted text)

## Practice Questions
(To be generated from extracted text)
`;
}

// Helper: Calculate progress percentage
function calculateProgress(sessions: DailySession[]): number {
  if (sessions.length === 0) return 0;
  const completedCount = sessions.filter(s => s.completed).length;
  return Math.round((completedCount / sessions.length) * 100);
}

