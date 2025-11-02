// Paper Context - State Management for Research Papers
// Based on Open Paper's proven state management patterns

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type {
  Paper,
  PaperHighlight,
  PaperAnnotation,
  PaperConversation,
  PaperMessage,
  HighlightWithAnnotations,
} from '../lib/papers/types';
import * as paperApi from '../lib/papers/api';
import { useAuth } from './AuthContext';

interface PaperContextType {
  // Current paper
  currentPaper: Paper | null;
  loading: boolean;
  error: string | null;

  // Paper operations
  loadPaper: (paperId: string) => Promise<void>;
  uploadPaper: (file: File, title?: string) => Promise<string>;
  updatePaperMetadata: (paperId: string, updates: Partial<Paper>) => Promise<void>;
  deletePaper: (paperId: string) => Promise<void>;

  // Highlights
  highlights: PaperHighlight[];
  selectedHighlight: PaperHighlight | null;
  createHighlight: (
    pageNumber: number,
    textContent: string,
    position: any,
    color?: string
  ) => Promise<void>;
  selectHighlight: (highlightId: string | null) => void;
  updateHighlightColor: (highlightId: string, color: string) => Promise<void>;
  deleteHighlight: (highlightId: string) => Promise<void>;

  // Annotations
  annotations: Record<string, PaperAnnotation[]>; // keyed by highlight_id
  createAnnotation: (highlightId: string, content: string) => Promise<void>;
  updateAnnotation: (annotationId: string, content: string) => Promise<void>;
  deleteAnnotation: (annotationId: string) => Promise<void>;

  // Conversations & Chat
  currentConversation: PaperConversation | null;
  messages: PaperMessage[];
  isStreaming: boolean;
  startConversation: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  loadConversation: (conversationId: string) => Promise<void>;

  // Viewer state
  currentPage: number;
  setCurrentPage: (page: number) => void;
  totalPages: number;

  // Search within paper
  searchResults: any[];
  searchInPaper: (query: string) => void;
}

const PaperContext = createContext<PaperContextType | undefined>(undefined);

export function PaperProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  
  // Paper state
  const [currentPaper, setCurrentPaper] = useState<Paper | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Highlights and annotations
  const [highlights, setHighlights] = useState<PaperHighlight[]>([]);
  const [selectedHighlight, setSelectedHighlight] = useState<PaperHighlight | null>(null);
  const [annotations, setAnnotations] = useState<Record<string, PaperAnnotation[]>>({});

  // Chat state
  const [currentConversation, setCurrentConversation] = useState<PaperConversation | null>(
    null
  );
  const [messages, setMessages] = useState<PaperMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  // Viewer state
  const [currentPage, setCurrentPage] = useState(1);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // ============================================
  // PAPER OPERATIONS
  // ============================================

  const loadPaper = useCallback(async (paperId: string) => {
    setLoading(true);
    setError(null);
    try {
      const paper = await paperApi.getPaper(paperId);
      setCurrentPaper(paper);

      // Load related data
      const [highlightsData, conversationsData] = await Promise.all([
        paperApi.getHighlights(paperId),
        paperApi.listConversations(paperId),
      ]);

      setHighlights(highlightsData);

      // Load annotations for each highlight
      const annotationsMap: Record<string, PaperAnnotation[]> = {};
      for (const highlight of highlightsData) {
        const anns = await paperApi.getAnnotations(highlight.id);
        annotationsMap[highlight.id] = anns;
      }
      setAnnotations(annotationsMap);

      // Use most recent conversation or create new one
      if (conversationsData.length > 0) {
        const conversation = conversationsData[0];
        setCurrentConversation(conversation);
        const msgs = await paperApi.getMessages(conversation.id);
        setMessages(msgs);
      }

      // Subscribe to real-time updates
      const subscription = paperApi.subscribeToPaperUpdates(paperId, (updatedPaper) => {
        setCurrentPaper(updatedPaper);
      });

      return () => {
        subscription.unsubscribe();
      };
    } catch (err: any) {
      setError(err.message);
      console.error('Failed to load paper:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const uploadPaper = useCallback(async (file: File, title?: string): Promise<string> => {
    if (!user) {
      throw new Error('Not authenticated - please sign in');
    }
    
    setLoading(true);
    setError(null);
    try {
      const { paper_id } = await paperApi.uploadPaper(file, user.id, title);

      // Subscribe to processing updates
      paperApi.subscribeToPaperUpdates(paper_id, (paper) => {
        if (paper.status === 'completed') {
          setCurrentPaper(paper);
        }
      });

      return paper_id;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const updatePaperMetadata = useCallback(
    async (paperId: string, updates: Partial<Paper>) => {
      try {
        const updated = await paperApi.updatePaper(paperId, updates);
        if (currentPaper?.id === paperId) {
          setCurrentPaper(updated);
        }
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [currentPaper]
  );

  const deletePaper = useCallback(async (paperId: string) => {
    try {
      await paperApi.deletePaper(paperId);
      if (currentPaper?.id === paperId) {
        setCurrentPaper(null);
        setHighlights([]);
        setAnnotations({});
        setMessages([]);
      }
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [currentPaper]);

  // ============================================
  // HIGHLIGHT OPERATIONS
  // ============================================

  const createHighlight = useCallback(
    async (
      pageNumber: number,
      textContent: string,
      position: any,
      color: string = 'yellow'
    ) => {
      if (!currentPaper) return;

      try {
        const highlight = await paperApi.createHighlight({
          paper_id: currentPaper.id,
          page_number: pageNumber,
          text_content: textContent,
          position,
          color: color as any,
        });

        setHighlights((prev) => [...prev, highlight]);
        setAnnotations((prev) => ({ ...prev, [highlight.id]: [] }));
        setSelectedHighlight(highlight);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [currentPaper]
  );

  const selectHighlight = useCallback(
    (highlightId: string | null) => {
      if (!highlightId) {
        setSelectedHighlight(null);
        return;
      }
      const highlight = highlights.find((h) => h.id === highlightId);
      setSelectedHighlight(highlight || null);
    },
    [highlights]
  );

  const updateHighlightColor = useCallback(async (highlightId: string, color: string) => {
    try {
      const updated = await paperApi.updateHighlight(highlightId, { color: color as any });
      setHighlights((prev) => prev.map((h) => (h.id === highlightId ? updated : h)));
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  const deleteHighlight = useCallback(async (highlightId: string) => {
    try {
      await paperApi.deleteHighlight(highlightId);
      setHighlights((prev) => prev.filter((h) => h.id !== highlightId));
      setAnnotations((prev) => {
        const newAnnotations = { ...prev };
        delete newAnnotations[highlightId];
        return newAnnotations;
      });
      if (selectedHighlight?.id === highlightId) {
        setSelectedHighlight(null);
      }
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [selectedHighlight]);

  // ============================================
  // ANNOTATION OPERATIONS
  // ============================================

  const createAnnotation = useCallback(async (highlightId: string, content: string) => {
    try {
      const annotation = await paperApi.createAnnotation({ highlight_id: highlightId, content });
      setAnnotations((prev) => ({
        ...prev,
        [highlightId]: [...(prev[highlightId] || []), annotation],
      }));
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  const updateAnnotation = useCallback(async (annotationId: string, content: string) => {
    try {
      const updated = await paperApi.updateAnnotation(annotationId, content);
      setAnnotations((prev) => {
        const newAnnotations = { ...prev };
        Object.keys(newAnnotations).forEach((highlightId) => {
          newAnnotations[highlightId] = newAnnotations[highlightId].map((a) =>
            a.id === annotationId ? updated : a
          );
        });
        return newAnnotations;
      });
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  const deleteAnnotation = useCallback(async (annotationId: string) => {
    try {
      await paperApi.deleteAnnotation(annotationId);
      setAnnotations((prev) => {
        const newAnnotations = { ...prev };
        Object.keys(newAnnotations).forEach((highlightId) => {
          newAnnotations[highlightId] = newAnnotations[highlightId].filter(
            (a) => a.id !== annotationId
          );
        });
        return newAnnotations;
      });
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  // ============================================
  // CHAT OPERATIONS
  // ============================================

  const startConversation = useCallback(async () => {
    if (!currentPaper) return;

    try {
      const conversation = await paperApi.createConversation({
        paper_id: currentPaper.id,
        context_type: 'paper',
      });
      setCurrentConversation(conversation);
      setMessages([]);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [currentPaper]);

  const loadConversation = useCallback(async (conversationId: string) => {
    try {
      const conversation = await paperApi.getConversation(conversationId);
      const msgs = await paperApi.getMessages(conversationId);
      setCurrentConversation(conversation);
      setMessages(msgs);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!currentConversation) {
        await startConversation();
        if (!currentConversation) return;
      }

      // Add user message immediately
      const userMessage: PaperMessage = {
        id: crypto.randomUUID(),
        conversation_id: currentConversation!.id,
        user_id: '', // Will be filled by server
        role: 'user',
        content,
        citations: null,
        model: null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);

      setIsStreaming(true);
      try {
        const stream = await paperApi.sendMessage({
          conversation_id: currentConversation!.id,
          content,
        });

        // Process streaming response
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let assistantContent = '';

        const assistantMessage: PaperMessage = {
          id: crypto.randomUUID(),
          conversation_id: currentConversation!.id,
          user_id: '',
          role: 'assistant',
          content: '',
          citations: [],
          model: 'groq',
          created_at: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, assistantMessage]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                if (parsed.type === 'content') {
                  assistantContent += parsed.content;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessage.id
                        ? { ...m, content: assistantContent }
                        : m
                    )
                  );
                } else if (parsed.type === 'citation') {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessage.id
                        ? {
                            ...m,
                            citations: [...(m.citations || []), parsed.citation],
                          }
                        : m
                    )
                  );
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setIsStreaming(false);
      }
    },
    [currentConversation, startConversation]
  );

  // ============================================
  // SEARCH
  // ============================================

  const searchInPaper = useCallback(
    (query: string) => {
      if (!currentPaper?.metadata?.pages) {
        setSearchResults([]);
        return;
      }

      const results: any[] = [];
      const pages = currentPaper.metadata.pages as any[];

      pages.forEach((page: any) => {
        const text = page.text.toLowerCase();
        const queryLower = query.toLowerCase();
        let index = text.indexOf(queryLower);

        while (index !== -1) {
          results.push({
            page_number: page.page_number,
            text: page.text.slice(Math.max(0, index - 50), index + query.length + 50),
            index,
          });
          index = text.indexOf(queryLower, index + 1);
        }
      });

      setSearchResults(results);
    },
    [currentPaper]
  );

  const value: PaperContextType = {
    currentPaper,
    loading,
    error,
    loadPaper,
    uploadPaper,
    updatePaperMetadata,
    deletePaper,
    highlights,
    selectedHighlight,
    createHighlight,
    selectHighlight,
    updateHighlightColor,
    deleteHighlight,
    annotations,
    createAnnotation,
    updateAnnotation,
    deleteAnnotation,
    currentConversation,
    messages,
    isStreaming,
    startConversation,
    sendMessage,
    loadConversation,
    currentPage,
    setCurrentPage,
    totalPages: currentPaper?.total_pages || 0,
    searchResults,
    searchInPaper,
  };

  return <PaperContext.Provider value={value}>{children}</PaperContext.Provider>;
}

export function usePaper() {
  const context = useContext(PaperContext);
  if (!context) {
    throw new Error('usePaper must be used within PaperProvider');
  }
  return context;
}

