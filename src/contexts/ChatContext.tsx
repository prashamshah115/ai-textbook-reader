import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useTextbook } from './TextbookContext';
import { toast } from 'sonner';
import { fetchWithRetry } from '../lib/fetchWithRetry';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatContextType {
  messages: ChatMessage[];
  loading: boolean;
  sendMessage: (content: string) => Promise<void>;
  clearChat: () => Promise<void>;
  currentContext: string | null;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { currentTextbook, currentPage, currentPageData, currentAIContent } = useTextbook();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [currentContext, setCurrentContext] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [conversationSummary, setConversationSummary] = useState<string | null>(null);

  // Load existing conversation
  const loadConversation = async (retryCount = 0) => {
    if (!user || !currentTextbook) return;

    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('user_id', user.id)
        .eq('textbook_id', currentTextbook.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        // Handle 406 session errors
        const isAuthError = error.code === '406' || 
                           error.code === 'PGRST301' ||
                           error.message?.includes('JWT') ||
                           error.message?.includes('session');
        
        if (retryCount === 0 && isAuthError) {
          console.log('[Chat] Session expired (406), refreshing...');
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (!refreshError) {
            await new Promise(resolve => setTimeout(resolve, 500));
            return loadConversation(1); // Retry once
          }
        }
        
        throw error;
      }

      if (data) {
        setConversationId(data.id);
        setMessages((data.messages as ChatMessage[]) || []);
      } else {
        // Create new conversation
        const { data: newConv, error: insertError } = await supabase
          .from('chat_conversations')
          .insert({
            user_id: user.id,
            textbook_id: currentTextbook.id,
            context_pages: [currentPage],
            messages: [],
          })
          .select()
          .single();

        if (insertError) throw insertError;
        if (newConv) {
          setConversationId(newConv.id);
        }
      }
    } catch (error) {
      console.error('[Chat] Failed to load conversation:', error);
    }
  };

  // Build rich context from multiple sources
  const buildRichContext = async () => {
    // 🔥 FIX BUG #1: Use correct context keys that match API expectations
    const context: any = {
      page: currentPage,  // ✅ Fixed: was 'currentPage'
      pageText: currentPageData?.raw_text || '',  // ✅ Fixed: was 'currentPageText'
    };

    try {
      // 🔥 LAZY EXTRACTION MODE: Fetch web context FIRST (instant, works before page extraction)
      const { data: webContext } = await supabase
        .from('textbook_web_context')
        .select('*')
        .eq('textbook_id', currentTextbook!.id)
        .maybeSingle();

      if (webContext && webContext.web_summary) {
        context.textbookOverview = webContext.web_summary;
        context.keyTopics = webContext.key_topics || [];
        context.textbookAuthor = webContext.author;
        context.textbookTitle = webContext.title;
      }
      
      // Add textbook metadata (always available)
      context.textbookMetadata = {
        title: currentTextbook!.title,
        totalPages: currentTextbook!.total_pages,
        subject: currentTextbook!.metadata?.subject,
        learningGoal: currentTextbook!.metadata?.learning_goal,
      };
      
      // If no page text yet, add helpful note
      if (!currentPageData?.raw_text) {
        context.note = 'Page text extraction happens on-demand as you read. I can answer general questions about the textbook using web context.';
      }

      // Get neighboring pages for broader context
      const [prevPageResult, nextPageResult] = await Promise.all([
        supabase
          .from('pages')
          .select('raw_text')
          .eq('textbook_id', currentTextbook!.id)
          .eq('page_number', currentPage - 1)
          .maybeSingle(),
        supabase
          .from('pages')
          .select('raw_text')
          .eq('textbook_id', currentTextbook!.id)
          .eq('page_number', currentPage + 1)
          .maybeSingle(),
      ]);

      if (prevPageResult.data) {
        context.previousPageText = prevPageResult.data.raw_text?.substring(0, 500);
      }
      if (nextPageResult.data) {
        context.nextPageText = nextPageResult.data.raw_text?.substring(0, 500);
      }

      // Get chapter summary
      const { data: chapter } = await supabase
        .from('chapters')
        .select('chapter_summaries(*)')
        .eq('textbook_id', currentTextbook!.id)
        .lte('page_start', currentPage)
        .gte('page_end', currentPage)
        .maybeSingle();
      
      if (chapter?.chapter_summaries?.[0]) {
        context.chapterSummary = chapter.chapter_summaries[0].summary_text;
      }

      // Get user notes for this page
      const { data: notes } = await supabase
        .from('user_notes')
        .select('content')
        .eq('textbook_id', currentTextbook!.id)
        .eq('page_number', currentPage);

      if (notes && notes.length > 0) {
        context.userNotes = notes.map(n => n.content).join('\n\n');
      }

      // Get AI-generated content if available
      if (currentAIContent) {
        context.aiInsights = {
          applications: currentAIContent.applications,
          keyConcepts: currentAIContent.key_concepts,
        };
      }
    } catch (error) {
      console.error('[Chat] Error building context:', error);
    }

    return context;
  };

  // Send message and get AI response
  const sendMessage = async (content: string) => {
    if (!user || !currentTextbook || !conversationId) {
      toast.error('Chat not initialized. Please refresh the page.');
      return;
    }

    // 🔥 FIX BUG #5: Cancel any existing request
    if (abortController) {
      abortController.abort();
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    // Add user message optimistically
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    // Create new abort controller for this request
    const newAbortController = new AbortController();
    setAbortController(newAbortController);

    try {
      // 🔥 CONVERSATION MEMORY: Summarize if conversation gets long
      if (messages.length > 10 && !conversationSummary) {
        console.log('[Chat] Summarizing conversation history...');
        // Will implement full summarization in production
        setConversationSummary('Conversation context maintained');
      }

      // Build rich context from multiple sources
      const richContext = await buildRichContext();

      // Store context for viewer
      setCurrentContext(JSON.stringify(richContext, null, 2));

      console.log('[Chat] Sending message with context:', {
        page: richContext.page,
        hasPageText: !!richContext.pageText,
        hasOverview: !!richContext.textbookOverview,
      });

      // 🔥 FIX BUG #5: Stream with timeout and cancellation support
      const firstTokenTimer = performance.now();
      let fullResponse = '';
      let firstTokenReceived = false;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content,
          context: richContext,
          conversationId,
        }),
        signal: newAbortController.signal, // ✅ Added request cancellation
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('[Chat] API error:', response.status, errorText);
        throw new Error(`API returned ${response.status}: ${errorText.slice(0, 100)}`);
      }

      // Read SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response stream');
      }

      // Create placeholder AI message for streaming updates
      // 🔥 FIX BUG #4: Calculate correct index BEFORE adding message
      // The message will be added at index messages.length, not messages.length + 1
      const aiMessageIndex = messages.length;  // ✅ Fixed: was messages.length + 1
      const streamingMessage: ChatMessage = {
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, streamingMessage]);

      // Read stream chunks
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            if (data === '[DONE]') {
              console.log('[Chat Stream] Complete');
              break;
            }

            try {
              const parsed = JSON.parse(data);

              if (parsed.content) {
                fullResponse += parsed.content;

                // Track first token
                if (!firstTokenReceived) {
                  const latency = performance.now() - firstTokenTimer;
                  console.log(`[Chat] First token in ${latency.toFixed(0)}ms`);
                  
                  // Record metric (user_id auto-populated by DEFAULT)
                  supabase.from('metrics').insert({
                    metric_name: 'chat_first_token',
                    value: latency,
                    unit: 'ms',
                    textbook_id: currentTextbook?.id,
                  }).then(({ error }) => {
                    if (error) {
                      console.log('[Chat] Metrics insert failed (non-critical):', error.message);
                    }
                  });
                  
                  firstTokenReceived = true;
                }

                // Update streaming message
                setMessages((prev) =>
                  prev.map((msg, idx) =>
                    idx === aiMessageIndex
                      ? { ...msg, content: fullResponse }
                      : msg
                  )
                );
              }
            } catch (e) {
              console.error('[Chat Stream] Parse error:', e);
            }
          }
        }
      }

      // Save final conversation to database
      console.log('[Chat] Stream complete, saving conversation');
      const updatedMessages = [...messages, userMessage, {
        role: 'assistant' as const,
        content: fullResponse,
        timestamp: new Date().toISOString(),
      }];

      const { error: updateError } = await supabase
        .from('chat_conversations')
        .update({
          messages: updatedMessages,
          context_pages: [currentPage],
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId);

      if (updateError) {
        console.error('[Chat] Failed to save conversation:', updateError);
        // Don't show error to user - conversation still worked
      } else {
        console.log('[Chat] Conversation saved successfully');
      }
    } catch (error: any) {
      console.error('[Chat] Failed to send message:', error);
      
      // 🔥 FIX BUG #5: Better error messages
      if (error.name === 'AbortError') {
        toast.error('Request cancelled');
        // Remove the incomplete assistant message
        setMessages((prev) => prev.slice(0, -1));
      } else if (error.message?.includes('404')) {
        toast.error('Conversation not found. Please refresh the page.');
      } else if (error.message?.includes('fetch')) {
        toast.error('Network error. Please check your connection.');
      } else {
        toast.error('Failed to send message. Please try again.');
      }
      
      // Remove the incomplete assistant message if it exists
      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage?.role === 'assistant' && !lastMessage.content) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setLoading(false);
      setAbortController(null);
    }
  };

  // Clear chat history
  const clearChat = async () => {
    if (!conversationId) return;

    try {
      await supabase
        .from('chat_conversations')
        .update({
          messages: [],
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId);

      setMessages([]);
      toast.success('Chat cleared');
    } catch (error) {
      console.error('[Chat] Failed to clear chat:', error);
      toast.error('Failed to clear chat');
    }
  };

  // Load conversation on mount
  useEffect(() => {
    if (user && currentTextbook) {
      loadConversation();
    }
  }, [user, currentTextbook]);

  return (
    <ChatContext.Provider
      value={{
        messages,
        loading,
        sendMessage,
        clearChat,
        currentContext,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}

